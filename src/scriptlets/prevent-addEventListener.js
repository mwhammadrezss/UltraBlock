/**
 * UltraBlock Scriptlet: prevent-addEventListener
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Wraps EventTarget.prototype.addEventListener to block event listeners
 * where the event type and/or callback match specified patterns.
 *
 * @param {Object} args
 * @param {string} [args.type] - Regex to match event type (e.g., 'click|mousedown') (empty = all types)
 * @param {string} [args.match] - Regex to match stringified callback (empty = all callbacks)
 */
function preventAddEventListener(args) {
  'use strict';

  var typePattern = (args && args.type) ? args.type : '';
  var matchPattern = (args && args.match) ? args.match : '';

  var typeRegex = null;
  if (typePattern) {
    try {
      typeRegex = new RegExp(typePattern);
    } catch (e) {
      typeRegex = new RegExp(typePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  var matchRegex = null;
  if (matchPattern) {
    try {
      matchRegex = new RegExp(matchPattern);
    } catch (e) {
      matchRegex = new RegExp(matchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  // Need at least one pattern to filter by
  if (!typeRegex && !matchRegex) return;

  var _origAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function addEventListener(type, callback, options) {
    var shouldBlock = true;

    // Check type
    if (typeRegex) {
      if (!typeRegex.test(type)) {
        shouldBlock = false;
      }
    }

    // Check callback
    if (shouldBlock && matchRegex) {
      var cbStr = '';
      if (typeof callback === 'function') {
        cbStr = callback.toString();
      } else if (callback && typeof callback.handleEvent === 'function') {
        cbStr = callback.handleEvent.toString();
      }
      if (!matchRegex.test(cbStr)) {
        shouldBlock = false;
      }
    }

    if (shouldBlock) {
      // Silently drop the listener
      return;
    }

    return _origAddEventListener.apply(this, arguments);
  };

  EventTarget.prototype.addEventListener.toString = function() {
    return 'function addEventListener() { [native code] }';
  };
}
