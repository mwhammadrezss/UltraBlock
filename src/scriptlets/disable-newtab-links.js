/**
 * UltraBlock Scriptlet: disable-newtab-links
 * Based on: AdGuard Scriptlets / uBlock Origin
 * Removes target="_blank" from all links, preventing them from opening
 * new tabs (common ad/popup technique). Observes DOM for new links.
 *
 * @param {Object} [args] - No arguments needed
 */
function disableNewtabLinks(args) {
  'use strict';

  function processLinks(root) {
    var links;
    try {
      links = (root || document).querySelectorAll('a[target="_blank"], a[target="blank"]');
    } catch (e) {
      return;
    }
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('target');
      // Also remove rel="noopener" that goes with target=_blank
      // (keep rel="nofollow" and others)
      var rel = links[i].getAttribute('rel');
      if (rel) {
        var newRel = rel.replace(/\bnoopener\b/gi, '').replace(/\bnoreferrer\b/gi, '').trim();
        if (newRel) {
          links[i].setAttribute('rel', newRel);
        } else {
          links[i].removeAttribute('rel');
        }
      }
    }
  }

  // Process existing links
  processLinks();

  // Observe for new links
  var observer = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var mutation = mutations[i];

      if (mutation.type === 'childList') {
        for (var j = 0; j < mutation.addedNodes.length; j++) {
          var node = mutation.addedNodes[j];
          if (node.nodeType !== 1) continue;

          // Check if the node itself is a link
          if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
            node.removeAttribute('target');
          }

          // Check descendants
          if (node.querySelectorAll) {
            processLinks(node);
          }
        }
      } else if (mutation.type === 'attributes') {
        var target = mutation.target;
        if (target.tagName === 'A' && target.getAttribute('target') === '_blank') {
          target.removeAttribute('target');
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
        attributeFilter: ['target']
      });
    }
  }

  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      processLinks();
      startObserver();
    });
  }

  // Also run after full load
  window.addEventListener('load', function() {
    processLinks();
  });
}
