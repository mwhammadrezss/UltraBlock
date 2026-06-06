/**
 * UltraBlock Scriptlet: window-close-if
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Checks if the current page URL matches a regex pattern.
 * If it matches, closes the window/tab.
 * Useful for popup/popunder ad pages.
 *
 * @param {Object} args
 * @param {string} args.match - Regex pattern to match against location.href
 */
function windowCloseIf(args) {
  'use strict';

  if (!args || !args.match) return;

  var matchRegex;
  try {
    matchRegex = new RegExp(args.match);
  } catch (e) {
    matchRegex = new RegExp(args.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }

  function checkAndClose() {
    var url = '';
    try {
      url = window.location.href;
    } catch (e) {
      return;
    }

    if (matchRegex.test(url)) {
      try {
        window.close();
      } catch (e) {}

      // If window.close() didn't work (not opened by script), try alternatives
      // Navigate to about:blank as fallback
      if (!window.closed) {
        try {
          window.location.href = 'about:blank';
        } catch (e) {}
      }
    }
  }

  // Check immediately
  checkAndClose();

  // Also check after short delay (some popups set URL via JS after load)
  setTimeout(checkAndClose, 100);
  setTimeout(checkAndClose, 500);

  // Listen for URL changes (history.pushState popups)
  window.addEventListener('popstate', checkAndClose);

  // Also watch for hashchange
  window.addEventListener('hashchange', checkAndClose);
}
