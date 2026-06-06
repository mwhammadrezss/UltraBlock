/**
 * UltraBlock Scriptlet: abort-on-property-write
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Aborts script execution when something tries to write to a specified property.
 * Defines a setter on the property that throws a ReferenceError.
 *
 * @param {Object} args
 * @param {string} args.property - Property name (supports nested: 'a.b.c')
 */
function abortOnPropertyWrite(args) {
  'use strict';

  if (!args || !args.property) return;

  var property = args.property;
  var magic = String.fromCharCode(Date.now() % 26 + 97) + Math.random().toString(36).slice(2, 8);

  function abort() {
    throw new ReferenceError(magic);
  }

  function trapProperty(owner, prop) {
    var currentValue;
    try {
      currentValue = owner[prop];
    } catch (e) {}

    try {
      Object.defineProperty(owner, prop, {
        get: function() {
          return currentValue;
        },
        set: function(val) {
          abort();
        },
        configurable: true,
        enumerable: true
      });
    } catch (e) {}
  }

  function makeProxy(owner, chain) {
    var prop = chain.shift();
    if (chain.length === 0) {
      trapProperty(owner, prop);
      return;
    }

    var current = owner[prop];
    if (current && typeof current === 'object') {
      makeProxy(current, chain);
      return;
    }

    // Parent doesn't exist yet — trap its creation
    var stored = current;
    try {
      Object.defineProperty(owner, prop, {
        get: function() {
          return stored;
        },
        set: function(val) {
          stored = val;
          if (val && typeof val === 'object') {
            try {
              makeProxy(val, chain.slice(0));
            } catch (e) {}
          }
        },
        configurable: true,
        enumerable: true
      });
    } catch (e) {}
  }

  var parts = property.split('.');
  if (parts.length === 1) {
    trapProperty(window, property);
  } else {
    makeProxy(window, parts);
  }
}
