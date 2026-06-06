/**
 * UltraBlock Scriptlet: nano-setInterval-booster
 * Based on: AdGuard Scriptlets / uBlock Origin (nano-sib)
 * Wraps setInterval so that matching callbacks run at a fraction of their
 * original delay. Useful for speeding up countdown timers that gate content.
 *
 * @param {Object} args
 * @param {string} [args.match] - Regex pattern to match against callback (empty = match all)
 * @param {string} [args.boostRatio] - Multiplier for delay (default: '0.05', meaning 20x faster)
 */
function nanoSetIntervalBooster(args) {
  'use strict';

  var match = (args && args.match) ? args.match : '';
  var boostRatio = (args && args.boostRatio) ? parseFloat(args.boostRatio) : 0.05;

  // Clamp boost ratio to sane range
  if (isNaN(boostRatio) || boostRatio <= 0) boostRatio = 0.05;
  if (boostRatio > 1) boostRatio = 1; // No point in making it slower

  var matchRegex = null;
  if (match) {
    try {
      matchRegex = new RegExp(match);
    } catch (e) {
      matchRegex = new RegExp(match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
  }

  var _origSetInterval = window.setInterval;

  window.setInterval = function setInterval(callback, delay) {
    var shouldBoost = true;

    // Check if callback matches
    if (matchRegex) {
      var cbStr = '';
      if (typeof callback === 'function') {
        cbStr = callback.toString();
      } else if (typeof callback === 'string') {
        cbStr = callback;
      }
      if (!matchRegex.test(cbStr)) {
        shouldBoost = false;
      }
    }

    if (shouldBoost) {
      var originalDelay = parseInt(delay, 10) || 0;
      var boostedDelay = Math.max(Math.floor(originalDelay * boostRatio), 1);
      // Apply with boosted (shorter) delay
      var newArgs = Array.prototype.slice.call(arguments);
      newArgs[1] = boostedDelay;
      return _origSetInterval.apply(window, newArgs);
    }

    return _origSetInterval.apply(window, arguments);
  };

  window.setInterval.toString = function() {
    return 'function setInterval() { [native code] }';
  };
}
