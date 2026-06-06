/**
 * UltraBlock Scriptlet: prevent-window-open
 * Prevents window.open() calls matching specified patterns.
 * Usage: ##+js(prevent-window-open, match, [delay], [decoy])
 */
'use strict';
(function() {
  var match = args[0] || '';
  var delay = parseInt(args[1]) || 0;
  var decoy = args[2] || '';

  var origOpen = window.open;
  window.open = function(url, target, features) {
    url = url || '';

    var shouldBlock = false;
    if (!match) {
      shouldBlock = true;
    } else if (match[0] === '/' && match[match.length - 1] === '/') {
      // Regex
      try {
        var re = new RegExp(match.slice(1, -1));
        shouldBlock = re.test(url);
      } catch (e) { shouldBlock = url.indexOf(match) !== -1; }
    } else {
      shouldBlock = url.indexOf(match) !== -1;
    }

    if (shouldBlock) {
      // Return a fake window object to prevent errors
      var fakeWin = {
        closed: false,
        close: function() { this.closed = true; },
        focus: function() {},
        blur: function() {},
        document: { write: function() {}, close: function() {} },
        location: { href: url, replace: function() {} },
        postMessage: function() {}
      };
      if (delay > 0) {
        setTimeout(function() { fakeWin.closed = true; }, delay);
      }
      return fakeWin;
    }

    return origOpen.apply(window, arguments);
  };
})();
