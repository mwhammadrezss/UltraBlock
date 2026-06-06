/**
 * UltraBlock Scriptlet: adjust-setTimeout
 * Adjusts the delay of setTimeout calls matching a pattern.
 * Can speed up countdown timers used in ad walls.
 * Usage: ##+js(adjust-setTimeout, match, [newDelay], [boost])
 */
'use strict';
(function() {
  var match = args[0] || '';
  var newDelay = parseInt(args[1]) || 0;
  var boost = parseFloat(args[2]) || 0.05;

  var origSetTimeout = window.setTimeout;
  window.setTimeout = function(fn, delay) {
    var callback = fn;
    var callbackStr = '';
    if (typeof fn === 'function') {
      callbackStr = fn.toString();
    } else if (typeof fn === 'string') {
      callbackStr = fn;
    }

    var shouldAdjust = false;
    if (!match) {
      shouldAdjust = true;
    } else if (match[0] === '/' && match[match.length - 1] === '/') {
      try {
        shouldAdjust = new RegExp(match.slice(1, -1)).test(callbackStr);
      } catch (e) {}
    } else {
      shouldAdjust = callbackStr.indexOf(match) !== -1;
    }

    if (shouldAdjust) {
      if (newDelay > 0) {
        delay = newDelay;
      } else {
        delay = Math.max(1, Math.round(delay * boost));
      }
    }

    return origSetTimeout.call(window, callback, delay);
  };
})();
