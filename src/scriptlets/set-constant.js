/**
 * UltraBlock Scriptlet: set-constant
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Sets a constant value for a property on window.
 * Supports nested properties like 'a.b.c'.
 * Supported values: true, false, 0, 1, -1, '', null, undefined,
 *   noopFunc, trueFunc, falseFunc, throwFunc, emptyObj, emptyArr, emptyStr
 *
 * @param {Object} args
 * @param {string} args.property - Property path (e.g., 'config.ads.enabled')
 * @param {string} args.value - Constant value identifier
 */
function setConstant(args) {
  'use strict';

  if (!args || !args.property || args.value === undefined) return;

  var property = args.property;
  var valueStr = args.value;

  // Resolve value from string identifier
  var value;
  switch (valueStr) {
    case 'true':      value = true; break;
    case 'false':     value = false; break;
    case '0':         value = 0; break;
    case '1':         value = 1; break;
    case '-1':        value = -1; break;
    case '':
    case 'emptyStr':  value = ''; break;
    case 'null':      value = null; break;
    case 'undefined': value = undefined; break;
    case 'noopFunc':  value = function() {}; break;
    case 'trueFunc':  value = function() { return true; }; break;
    case 'falseFunc': value = function() { return false; }; break;
    case 'throwFunc': value = function() { throw new Error('throwFunc'); }; break;
    case 'emptyObj':  value = {}; break;
    case 'emptyArr':  value = []; break;
    case 'NaN':       value = NaN; break;
    case 'Infinity':  value = Infinity; break;
    case '-Infinity': value = -Infinity; break;
    default:
      // Try numeric
      if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
        value = parseFloat(valueStr);
      } else {
        value = valueStr;
      }
      break;
  }

  function setOnObject(owner, chain) {
    var prop = chain.shift();

    if (chain.length === 0) {
      // Final property — define as non-writable constant
      try {
        Object.defineProperty(owner, prop, {
          get: function() { return value; },
          set: function() {},  // Silently ignore writes
          configurable: false,
          enumerable: true
        });
      } catch (e) {
        // Fallback: direct assignment
        try { owner[prop] = value; } catch (e2) {}
      }
      return;
    }

    // Intermediate property
    var current = owner[prop];
    if (current && typeof current === 'object') {
      setOnObject(current, chain);
      return;
    }

    // Parent doesn't exist yet — wait for it
    if (current === undefined || current === null) {
      var stored = {};
      setOnObject(stored, chain.slice(0));
      try {
        Object.defineProperty(owner, prop, {
          get: function() { return stored; },
          set: function(val) {
            if (val && typeof val === 'object') {
              // Merge our trap into the new value
              var remaining = chain.slice(0);
              setOnObject(val, remaining);
              stored = val;
            } else {
              stored = val;
            }
          },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        owner[prop] = stored;
      }
    } else {
      // Current exists but isn't an object — force it
      try {
        setOnObject(current, chain);
      } catch (e) {}
    }
  }

  var parts = property.split('.');
  setOnObject(window, parts);
}
