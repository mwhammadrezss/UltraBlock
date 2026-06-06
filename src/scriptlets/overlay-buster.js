/**
 * UltraBlock Scriptlet: overlay-buster
 * Removes anti-adblock overlays and restores page scrolling.
 * Usage: ##+js(overlay-buster)
 */
'use strict';
(function() {
  var findOverlays = function() {
    var found = [];
    var all = document.querySelectorAll('div, section, aside');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var style = window.getComputedStyle(el);
      if (style.position === 'fixed' && style.zIndex > 999) {
        var opacity = parseFloat(style.opacity);
        var w = el.offsetWidth;
        var h = el.offsetHeight;
        // Full-page overlay detection
        if (w > window.innerWidth * 0.8 && h > window.innerHeight * 0.8) {
          found.push(el);
        }
        // Semi-transparent backdrop
        if (opacity < 0.9 && w > window.innerWidth * 0.5 && h > window.innerHeight * 0.5) {
          found.push(el);
        }
      }
    }
    return found;
  };

  var restoreScroll = function() {
    var html = document.documentElement;
    var body = document.body;
    if (html) {
      html.style.removeProperty('overflow');
      html.style.removeProperty('overflow-y');
      html.classList.remove('no-scroll', 'noscroll', 'modal-open', 'overlay-active');
    }
    if (body) {
      body.style.removeProperty('overflow');
      body.style.removeProperty('overflow-y');
      body.style.removeProperty('position');
      body.style.removeProperty('top');
      body.classList.remove('no-scroll', 'noscroll', 'modal-open', 'overlay-active');
    }
  };

  var bust = function() {
    var overlays = findOverlays();
    if (overlays.length > 0) {
      for (var i = 0; i < overlays.length; i++) {
        overlays[i].remove();
      }
      restoreScroll();
    }
  };

  // Run after short delay to let page build its overlay
  setTimeout(bust, 1000);
  setTimeout(bust, 3000);
  setTimeout(bust, 5000);

  // Also observe for newly injected overlays
  var observer = new MutationObserver(function() {
    setTimeout(bust, 100);
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
})();
