/**
 * UltraBlock Scriptlet: href-sanitizer
 * Removes tracking redirects from link URLs.
 * Extracts the real destination from tracking wrapper URLs.
 * Usage: ##+js(href-sanitizer, selector, attribute)
 */
'use strict';
(function() {
  var selector = args[0] || 'a[href*="redirect"]';
  var attr = args[1] || 'href';

  var sanitize = function() {
    var links = document.querySelectorAll(selector);
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var href = link.getAttribute(attr) || link.href;
      if (!href) continue;

      // Try to extract actual URL from common redirect patterns
      var realUrl = null;

      // Pattern: ?url=ENCODED_URL or ?u=ENCODED_URL
      var match = href.match(/[?&](?:url|u|redirect|target|dest|link|goto)=([^&]+)/i);
      if (match) {
        try { realUrl = decodeURIComponent(match[1]); } catch (e) {}
      }

      // Pattern: /redirect/BASE64_URL
      if (!realUrl) {
        match = href.match(/\/(?:redirect|out|go|link|click|track)\/(aHR0c[A-Za-z0-9+/=]+)/);
        if (match) {
          try { realUrl = atob(match[1]); } catch (e) {}
        }
      }

      // Validate extracted URL
      if (realUrl && (realUrl.indexOf('http://') === 0 || realUrl.indexOf('https://') === 0)) {
        link.setAttribute('href', realUrl);
        link.removeAttribute('data-href');
        // Remove click tracking handlers
        link.removeAttribute('onclick');
        link.removeAttribute('onmousedown');
      }
    }
  };

  // Run on page load and observe mutations
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sanitize);
  } else {
    sanitize();
  }

  var observer = new MutationObserver(function(mutations) {
    var shouldRun = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) { shouldRun = true; break; }
    }
    if (shouldRun) sanitize();
  });
  observer.observe(document.documentElement || document.body || document, {
    childList: true,
    subtree: true
  });
})();
