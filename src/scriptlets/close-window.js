/**
 * UltraBlock Scriptlet: close-window
 * Prevents window.close() from being called (often used by ad popups).
 * Usage: ##+js(close-window, [reason])
 */
'use strict';
(function() {
  var reason = args[0] || '';
  window.close = function() {
    // Silently prevent window closure
  };
  // Also prevent via setTimeout tricks
  var origClose = Window.prototype.close;
  Window.prototype.close = function() {};
})();
