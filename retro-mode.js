/**
 * UltraBlock — retro-mode.js v2.3
 * DOM Purifier / Retro Mode: Strip all bloat from pages.
 * Removes tracking scripts, heavy frameworks, animations, and
 * renders a clean, minimal, fast-loading version of the page.
 * Toggled via popup button or Ctrl+Shift+R keyboard shortcut.
 * Runs in ISOLATED world.
 */
'use strict';

(function UltraRetroMode() {

  if (window.__ubRetroRan) return;
  window.__ubRetroRan = true;

  var _retroActive = false;
  var _savedHTML = null;
  var _retroStyle = null;

  // ══════════════════════════════════════════════════════════════
  //  RETRO MODE CSS — Minimal, clean, fast
  // ══════════════════════════════════════════════════════════════
  var RETRO_CSS = [
    '/* UltraBlock Retro Mode */',
    '* { animation: none !important; transition: none !important; scroll-behavior: auto !important; }',
    'body {',
    '  font-family: Georgia, "Times New Roman", serif !important;',
    '  font-size: 18px !important; line-height: 1.7 !important;',
    '  max-width: 720px !important; margin: 40px auto !important;',
    '  padding: 20px !important; background: #fefefe !important;',
    '  color: #1a1a1a !important;',
    '}',
    // Hide all non-content elements
    'header, footer, nav, aside, [role="banner"], [role="navigation"],',
    '[role="complementary"], [class*="sidebar"], [class*="nav-"],',
    '[class*="header"], [class*="footer"], [class*="menu"],',
    '[class*="toolbar"], [class*="cookie"], [class*="popup"],',
    '[class*="modal"], [class*="overlay"], [class*="banner"],',
    '[class*="widget"], [class*="social"], [class*="share"],',
    '[class*="comment"], [class*="related"], [class*="recommended"],',
    '[class*="newsletter"], [class*="subscribe"], [class*="promo"],',
    '[class*="ad-"], [id*="ad-"], [class*="sponsor"],',
    'iframe, object, embed, video:not([controls]),',
    '[class*="notification"], [class*="toast"],',
    '[class*="drawer"], [class*="panel"]:not(main):not(article) {',
    '  display: none !important;',
    '}',
    // Style content elements
    'main, article, [role="main"], .content, .post, .entry, .article-body,',
    '[class*="content"], [class*="article"], [class*="post-body"] {',
    '  max-width: 100% !important; margin: 0 !important;',
    '  padding: 0 !important; float: none !important;',
    '  width: 100% !important;',
    '}',
    'h1, h2, h3, h4, h5, h6 {',
    '  font-family: Georgia, serif !important;',
    '  color: #111 !important; margin: 1.5em 0 0.5em !important;',
    '  line-height: 1.3 !important;',
    '}',
    'h1 { font-size: 2em !important; }',
    'h2 { font-size: 1.5em !important; }',
    'h3 { font-size: 1.25em !important; }',
    'p { margin: 1em 0 !important; }',
    'a { color: #0066cc !important; text-decoration: underline !important; }',
    'img { max-width: 100% !important; height: auto !important; display: block !important; margin: 1em 0 !important; }',
    'pre, code { font-family: "Courier New", monospace !important; background: #f5f5f5 !important; padding: 0.5em !important; overflow-x: auto !important; }',
    'blockquote { border-left: 3px solid #ccc !important; padding-left: 1em !important; margin: 1em 0 !important; color: #555 !important; }',
    'table { border-collapse: collapse !important; width: 100% !important; margin: 1em 0 !important; }',
    'th, td { border: 1px solid #ddd !important; padding: 8px 12px !important; text-align: left !important; }',
    'ul, ol { padding-left: 2em !important; margin: 1em 0 !important; }',
    'li { margin: 0.5em 0 !important; }',
    '/* Retro Mode indicator */',
    '#ub-retro-indicator {',
    '  position: fixed; top: 12px; right: 12px; z-index: 2147483647;',
    '  background: #1a1a1a; color: #fefefe; padding: 8px 14px;',
    '  border-radius: 6px; font-family: monospace; font-size: 12px;',
    '  cursor: pointer; user-select: none;',
    '  box-shadow: 0 2px 8px rgba(0,0,0,0.3);',
    '}',
    '#ub-retro-indicator:hover { background: #333; }',
  ].join('\n');

  // ══════════════════════════════════════════════════════════════
  //  ACTIVATE RETRO MODE
  // ══════════════════════════════════════════════════════════════
  function activate() {
    if (_retroActive) return;
    _retroActive = true;

    // Neutralize trackers that already executed (script.remove() has no effect after execution)
    try {
      window.ga = function(){};
      window.gtag = function(){};
      window.fbq = function(){};
      window._gaq = {push:function(){}};
      window.dataLayer = {push:function(){}};
      window._paq = {push:function(){}};
      window.mixpanel = {track:function(){},identify:function(){}};
      window.amplitude = {getInstance:function(){return{logEvent:function(){}}}};
    } catch (_) {}

    // Remove all external stylesheets (we'll use our own)
    var links = document.querySelectorAll('link[rel="stylesheet"]');
    for (var j = 0; j < links.length; j++) {
      links[j].disabled = true;
    }

    // Remove all inline styles from elements
    var styled = document.querySelectorAll('[style]');
    for (var k = 0; k < styled.length; k++) {
      styled[k].removeAttribute('style');
    }

    // Remove all <style> tags
    var styleTags = document.querySelectorAll('style:not(#ub-retro-style)');
    for (var l = 0; l < styleTags.length; l++) {
      styleTags[l].disabled = true;
    }

    // Inject retro CSS
    _retroStyle = document.createElement('style');
    _retroStyle.id = 'ub-retro-style';
    _retroStyle.textContent = RETRO_CSS;
    document.head.appendChild(_retroStyle);

    // Add indicator badge
    var indicator = document.createElement('div');
    indicator.id = 'ub-retro-indicator';
    indicator.textContent = '📜 RETRO MODE — Click to exit';
    indicator.addEventListener('click', deactivate);
    document.body.appendChild(indicator);

    // Remove iframes, objects, embeds (except YouTube videos)
    var iframes = document.querySelectorAll('iframe, object, embed');
    for (var m = 0; m < iframes.length; m++) {
      var iSrc = iframes[m].src || '';
      if (!/youtube\.com\/embed|vimeo\.com/i.test(iSrc)) {
        iframes[m].remove();
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  DEACTIVATE — Reload page to restore original
  // ══════════════════════════════════════════════════════════════
  function deactivate() {
    _retroActive = false;
    // Easiest: just reload the page
    location.reload();
  }

  // ══════════════════════════════════════════════════════════════
  //  KEYBOARD SHORTCUT: handled by background.js (chrome.commands)
  //  Direct keydown listener REMOVED — caused double-toggle bug:
  //  both this listener and background.js command handler fired,
  //  toggling retro mode twice (net: nothing happened).
  //  background.js now sends toggleRetroMode message to the tab.
  // ══════════════════════════════════════════════════════════════

  // Listen for toggle from popup/background
  try {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.action === 'toggleRetroMode') {
        if (_retroActive) deactivate();
        else activate();
      }
    });
  } catch (_) {}

})();
