/**
 * UltraBlock Scriptlet: abort-on-property-read
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Aborts script execution when a specified property is read.
 * Defines a getter on the property that throws a ReferenceError.
 *
 * @param {Object} args
 * @param {string} args.property - Property name (supports nested: 'a.b.c')
 */
function abortOnPropertyRead(args) {
  'use strict';

  if (!args || !args.property) return;

  var property = args.property;
  var magic = String.fromCharCode(Date.now() % 26 + 97) + Math.random().toString(36).slice(2, 8);

  function abort() {
    throw new ReferenceError(magic);
  }

  function makeProxy(owner, chain) {
    var prop = chain.shift();
    if (chain.length === 0) {
      var currentValue = owner[prop];
      try {
        Object.defineProperty(owner, prop, {
          get: function() {
            abort();
          },
          set: function(val) {
            // Allow setting to avoid breaking site initialization
            currentValue = val;
          },
          configurable: true,
          enumerable: true
        });
      } catch (e) {
        // Property might not be configurable; try Proxy approach
        return;
      }
      return;
    }

    // For nested properties, we need to wait until the parent exists
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
    // Simple property on window
    var currentValue = undefined;
    try {
      currentValue = window[property];
    } catch (e) {}

    try {
      Object.defineProperty(window, property, {
        get: function() {
          abort();
        },
        set: function(val) {
          currentValue = val;
        },
        configurable: true,
        enumerable: true
      });
    } catch (e) {}
  } else {
    makeProxy(window, parts);
  }
}
