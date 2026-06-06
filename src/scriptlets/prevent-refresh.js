/**
 * UltraBlock Scriptlet: prevent-refresh
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Removes or disables meta[http-equiv="refresh"] tags to prevent
 * automatic page redirects. Observes DOM for dynamically added meta tags.
 *
 * @param {Object} [args]
 * @param {string} [args.delay] - Only prevent refresh if delay (seconds) is less than or equal to this value. Empty = prevent all.
 */
function preventRefresh(args) {
  'use strict';

  var maxDelay = (args && args.delay) ? parseInt(args.delay, 10) : Infinity;
  if (isNaN(maxDelay)) maxDelay = Infinity;

  function shouldPrevent(metaEl) {
    if (!metaEl) return false;
    var httpEquiv = (metaEl.getAttribute('http-equiv') || '').toLowerCase();
    if (httpEquiv !== 'refresh') return false;

    var content = metaEl.getAttribute('content') || '';
    // content format: "5" or "5;url=http://..."
    var delayMatch = content.match(/^\s*(\d+)/);
    if (delayMatch) {
      var delay = parseInt(delayMatch[1], 10);
      if (delay <= maxDelay) return true;
    } else {
      // No delay specified or invalid — prevent anyway
      return true;
    }
    return false;
  }

  function disableRefreshMeta(meta) {
    if (!meta) return;
    // Remove the content attribute to prevent the refresh
    meta.removeAttribute('content');
    // Also remove http-equiv to be sure
    meta.removeAttribute('http-equiv');
    // Alternative: remove the element entirely
    try {
      meta.remove();
    } catch (e) {}
  }

  function processExisting() {
    var metas = document.querySelectorAll('meta[http-equiv="refresh"], meta[http-equiv="Refresh"]');
    for (var i = 0; i < metas.length; i++) {
      if (shouldPrevent(metas[i])) {
        disableRefreshMeta(metas[i]);
      }
    }
  }

  // Process immediately
  processExisting();

  // Observe for dynamically added meta tags
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type !== 'childList') continue;

      for (var j = 0; j < mutation.addedNodes.length; j++) {
        var node = mutation.addedNodes[j];
        if (node.nodeType !== 1) continue;

        if (node.tagName === 'META') {
          if (shouldPrevent(node)) {
            disableRefreshMeta(node);
          }
        }

        // Check if added node contains meta tags
        if (node.querySelectorAll) {
          var metas = node.querySelectorAll('meta[http-equiv="refresh"], meta[http-equiv="Refresh"]');
          for (var k = 0; k < metas.length; k++) {
            if (shouldPrevent(metas[k])) {
              disableRefreshMeta(metas[k]);
            }
          }
        }
      }
    }
  });

  function startObserver() {
    var root = document.documentElement || document.head || document.body;
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      processExisting();
      startObserver();
    });
  }

  // Also intercept document.write that might inject meta refresh
  var _origDocWrite = document.write;
  document.write = function(html) {
    if (typeof html === 'string' && /meta[^>]*http-equiv\s*=\s*["']?refresh/i.test(html)) {
      // Strip the meta refresh tag from the HTML
      html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, '');
    }
    return _origDocWrite.call(document, html);
  };
  document.write.toString = function() { return 'function write() { [native code] }'; };
}
