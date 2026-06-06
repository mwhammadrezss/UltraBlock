/**
 * UltraBlock Scriptlet: remove-class
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Continuously removes specified CSS classes from matching elements.
 * Uses MutationObserver to handle dynamically added/changed elements.
 *
 * @param {Object} args
 * @param {string} args.classes - Pipe-separated class names to remove (e.g., 'ad-active|promo-visible|sponsored')
 * @param {string} [args.selector] - CSS selector to match elements (default: '.<class>' for each class)
 */
function removeClass(args) {
  'use strict';

  if (!args || !args.classes) return;

  var classes = args.classes.split('|').map(function(c) { return c.trim(); }).filter(Boolean);
  var selector = args.selector || '';

  if (!classes.length) return;

  // Build selector if not provided
  if (!selector) {
    selector = classes.map(function(cls) {
      return '.' + CSS.escape(cls);
    }).join(',');
  }

  function removeClasses(el) {
    if (!el || !el.classList) return;
    var removed = false;
    for (var i = 0; i < classes.length; i++) {
      if (el.classList.contains(classes[i])) {
        el.classList.remove(classes[i]);
        removed = true;
      }
    }
    return removed;
  }

  function processExisting() {
    try {
      var elements = document.querySelectorAll(selector);
      for (var i = 0; i < elements.length; i++) {
        removeClasses(elements[i]);
      }
    } catch (e) {}
  }

  // Process existing elements
  processExisting();

  // Observe for changes
  var _pendingProcess = false;
  var observer = new MutationObserver(function(mutations) {
    if (_pendingProcess) return;
    _pendingProcess = true;
    requestAnimationFrame(function() {
      _pendingProcess = false;
      processExisting();
    });
  });

  function startObserver() {
    var root = document.documentElement || document.body;
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  // Run again after load
  window.addEventListener('load', function() {
    processExisting();
  });
}
