/**
 * UltraBlock Scriptlet: remove-attr
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Continuously removes specified attributes from matching elements.
 * Uses MutationObserver to handle dynamically added elements.
 *
 * @param {Object} args
 * @param {string} args.attrs - Pipe-separated attribute names to remove (e.g., 'onclick|data-ad|style')
 * @param {string} [args.selector] - CSS selector to match elements (default: '[<attr>]' for each attr)
 */
function removeAttr(args) {
  'use strict';

  if (!args || !args.attrs) return;

  var attrs = args.attrs.split('|').map(function(a) { return a.trim(); }).filter(Boolean);
  var selector = args.selector || '';

  if (!attrs.length) return;

  // Build selector if not provided
  if (!selector) {
    selector = attrs.map(function(attr) {
      return '[' + attr + ']';
    }).join(',');
  }

  function removeAttributes(el) {
    if (!el || !el.hasAttribute) return;
    var removed = false;
    for (var i = 0; i < attrs.length; i++) {
      if (el.hasAttribute(attrs[i])) {
        el.removeAttribute(attrs[i]);
        removed = true;
      }
    }
    return removed;
  }

  function processExisting() {
    try {
      var elements = document.querySelectorAll(selector);
      for (var i = 0; i < elements.length; i++) {
        removeAttributes(elements[i]);
      }
    } catch (e) {}
  }

  // Process existing elements
  processExisting();

  // Observe for new elements and attribute changes
  var observer = new MutationObserver(function(mutations) {
    var shouldProcess = false;
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];
      if (mutation.type === 'childList') {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var node = mutation.addedNodes[j];
          if (node.nodeType === 1) {
            shouldProcess = true;
            // Check if the added node itself matches
            try {
              if (node.matches && node.matches(selector)) {
                removeAttributes(node);
              }
              // Check descendants
              var descendants = node.querySelectorAll ? node.querySelectorAll(selector) : [];
              for (var k = 0; k < descendants.length; k++) {
                removeAttributes(descendants[k]);
              }
            } catch (e) {}
          }
        }
      } else if (mutation.type === 'attributes') {
        var target = mutation.target;
        if (target && target.nodeType === 1 && attrs.indexOf(mutation.attributeName) !== -1) {
          try {
            if (target.matches && target.matches(selector)) {
              removeAttributes(target);
            }
          } catch (e) {}
        }
      }
    }
  });

  function startObserver() {
    var root = document.documentElement || document.body;
    if (root) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: attrs
      });
    }
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }

  // Run again after load for lazy elements
  window.addEventListener('load', function() {
    processExisting();
  });
}
