/**
 * UltraBlock — AdNauseam Ad Detector (Content Script)
 * Detects ads on the page and reports them to the background for fake-clicking.
 */
'use strict';

(function () {
  var AD_SELECTORS = [
    'a[href*="doubleclick.net"]',
    'a[href*="googleadservices.com"]',
    'a[href*="googlesyndication.com"]',
    'a[href*="adclick"]',
    'ins.adsbygoogle a',
    '[data-ad-slot] a',
    '[data-ad-client] a',
    '.ad-container a[href]',
    '.advertisement a[href]',
    '[id*="google_ads"] a[href]',
    'a[href*="click.linksynergy"]',
    'a[href*="adf.ly"]',
    'a[href*="bit.ly"][data-ad]',
    'a[href*="amazon"][data-ad]',
  ];

  var _reported = new Set();

  function scanForAds() {
    var selector = AD_SELECTORS.join(', ');
    var elements;
    try { elements = document.querySelectorAll(selector); } catch (e) { return; }

    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var href = el.href || el.getAttribute('href') || '';
      if (!href || href === '#' || _reported.has(href)) continue;

      _reported.add(href);

      var title = el.textContent || el.title || el.getAttribute('aria-label') || '';
      title = title.trim().substring(0, 100);

      try {
        chrome.runtime.sendMessage({
          action: 'reportAd',
          ad: {
            url: href,
            title: title || 'Ad',
            domain: window.location.hostname,
            page: window.location.href,
          }
        });
      } catch (e) { /* extension context invalidated */ }
    }
  }

  // Run after page loads
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(scanForAds, 2000);
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(scanForAds, 2000);
    });
  }

  // Re-scan on dynamic content changes (SPAs, infinite scroll)
  var _mutationTimer = null;
  var observer = new MutationObserver(function () {
    if (_mutationTimer) return;
    _mutationTimer = setTimeout(function () {
      _mutationTimer = null;
      scanForAds();
    }, 3000);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
