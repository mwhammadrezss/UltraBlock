// UltraBlock — YouTube Ad Killer
// Skips ads, hides overlays, removes premium prompts

(function () {
  'use strict';

  // ─── Skip ad button auto-clicker ─────────────────────────────────────────
  const SKIP_SELECTORS = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    'button.ytp-skip-ad-button',
    '.videoAdUiSkipButton',
    '.ytp-ad-skip-button-container button',
    'ytd-enforcement-message-view-model button', // NEW: enforcement dialog
    '[class*="SkipButton"]',                      // NEW: dynamic class names
  ];

  // FIX: Use getBoundingClientRect instead of offsetParent (shadow DOM compat)
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function trySkipAd() {
    for (const sel of SKIP_SELECTORS) {
      try {
        const btn = document.querySelector(sel);
        if (btn && isVisible(btn)) {
          btn.click();
          return true;
        }
      } catch (_) {}
    }
    return false;
  }

  // NOTE: Muting and playbackRate manipulation is handled exclusively by
  // inject.js (MAIN world) timeWarpEngine. This file only does cosmetic
  // hiding and skip-button clicking to avoid duplicate execution.

  // ─── Hide ad UI elements ──────────────────────────────────────────────────
  function hideAdElements() {
    const AD_SELECTORS = [
      // Ad overlays
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      '.ytp-ad-image-overlay',
      '.ytp-ad-module',
      '#player-ads',
      '.video-ads',
      '.ytp-ad-action-interstitial',
      '.ytp-ad-action-interstitial-slot',
      '.ytp-ad-preview-container',
      '.ytp-ad-preview-slot',
      // Info cards
      '.ytp-ce-element',
      // Bumper ads
      '.ytp-videowall-still',
      // Ad badge
      '.ytp-ad-badge',
      // Companion banners
      '.ytp-ad-feedback-dialog-container',
      // Masthead
      '#masthead-ad',
      // Homepage ads
      'ytd-banner-promo-renderer',
      'ytd-ad-slot-renderer',
      'ytd-in-feed-ad-layout-renderer',
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-promoted-video-renderer',
      'ytd-compact-promoted-video-renderer',
      'ytd-carousel-ad-renderer',
      'ytd-statement-banner-renderer',
      'ytd-rich-item-renderer[is-ad]',
      '#player-ads.style-scope.ytd-watch-flexy',
      // Sidebar ads
      '#watch-sidebar-ads',
      '.ytd-merch-shelf-renderer',
      // Premium banners
      'ytd-mealbar-promo-renderer',
      'ytd-popup-container ytd-promo-alert-renderer',
      // Shorts ads
      'ytd-reel-player-overlay-renderer ytd-ad-slot-renderer',
    ];

    let style = document.getElementById('ultrablock-yt');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ultrablock-yt';
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = AD_SELECTORS.join(',') + '{ display: none !important; }';
  }

  // ─── Observer: watch for ad start ────────────────────────────────────────
  let adCheckInterval = null;

  function onAdDetected() {
    // Only click skip button — muting/speed handled by inject.js
    let attempts = 0;
    if (adCheckInterval) clearInterval(adCheckInterval);
    adCheckInterval = setInterval(() => {
      const skipped = trySkipAd();
      attempts++;
      if (skipped || attempts > 30) {
        clearInterval(adCheckInterval);
        adCheckInterval = null;
      }
    }, 200);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType !== 1) continue;
        // FIX: className can be SVGAnimatedString on SVG nodes — always cast to string
        const cl = typeof node.className === 'string' ? node.className : (node.className.baseVal || '');
        const id = typeof node.id === 'string' ? node.id : '';
        if (
          cl.includes('ytp-ad') ||
          id.includes('player-ads') ||
          cl.includes('video-ads') ||
          node.tagName === 'YTD-AD-SLOT-RENDERER' ||
          node.tagName === 'YTD-IN-FEED-AD-LAYOUT-RENDERER'
        ) {
          onAdDetected();
        }
      }
    }
    hideAdElements();
  });

  // NOTE: fetch/XHR interception is handled by inject.js (MAIN world).
  // This file runs in ISOLATED world where such hooks have no effect.

  // ─── Init ─────────────────────────────────────────────────────────────────
  hideAdElements();

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Aggressive initial skip check
  let initCheck = 0;
  const initInterval = setInterval(() => {
    trySkipAd();
    hideAdElements();
    initCheck++;
    if (initCheck > 10) clearInterval(initInterval);
  }, 500);

})();
