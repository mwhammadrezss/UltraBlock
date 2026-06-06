/**
 * UltraBlock Scriptlet: adjust-setInterval
 * Adjusts the interval/delay of setInterval calls matching a pattern.
 * Can speed up or slow down timers (e.g., countdown timers on ad walls).
 * Usage: ##+js(adjust-setInterval, match, [newDelay], [boost])
 */
'use strict';
(function() {
  var match = args[0] || '';
  var newDelay = parseInt(args[1]) || 0;
  var boost = parseFloat(args[2]) || 0.05;

  var origSetInterval = window.setInterval;
  window.setInterval = function(fn, delay) {
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

    return origSetInterval.call(window, callback, delay);
  };
})();
