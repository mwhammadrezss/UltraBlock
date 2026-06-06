/**
 * UltraBlock Scriptlet: prevent-setInterval
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Wraps window.setInterval to prevent calls where the callback matches
 * a pattern and/or the delay matches a value.
 *
 * @param {Object} args
 * @param {string} [args.match] - Regex pattern to match against stringified callback (empty = match all)
 * @param {string} [args.delay] - Delay in ms to match (empty = match all, prefix with ! to negate)
 */
function preventSetInterval(args) {
  'use strict';

  var match = (args && args.match) ? args.match : '';
  var delayStr = (args && args.delay) ? String(args.delay) : '';

  var matchRegex = null;
  if (match) {
    try {
      matchRegex = new RegExp(match);
    } catch (e) {
      matchRegex = new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  var delayMatch = null;
  var delayNegate = false;
  if (delayStr) {
    if (delayStr.charAt(0) === '!') {
      delayNegate = true;
      delayStr = delayStr.slice(1);
    }
    delayMatch = parseInt(delayStr, 10);
    if (isNaN(delayMatch)) delayMatch = null;
  }

  var _origSetInterval = window.setInterval;

  window.setInterval = function setInterval(callback, delay) {
    var shouldPrevent = true;

    // Check callback match
    if (matchRegex) {
      var cbStr = '';
      if (typeof callback === 'function') {
        cbStr = callback.toString();
      } else if (typeof callback === 'string') {
        cbStr = callback;
      }
      if (!matchRegex.test(cbStr)) {
        shouldPrevent = false;
      }
    }

    // Check delay match
    if (shouldPrevent && delayMatch !== null) {
      var actualDelay = parseInt(delay, 10) || 0;
      var matches = (actualDelay === delayMatch);
      if (delayNegate) matches = !matches;
      if (!matches) shouldPrevent = false;
    }

    if (shouldPrevent) {
      // Return a valid timer ID but schedule a no-op with very long delay
      return _origSetInterval.call(window, function() {}, 2147483647);
    }

    return _origSetInterval.apply(window, arguments);
  };

  window.setInterval.toString = function() {
    return 'function setInterval() { [native code] }';
  };
}
