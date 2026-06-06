/**
 * UltraBlock — dopamine-detox.js v2.3
 * Dopamine Detox Filter:
 * - Grayscale notification badges
 * - Cut infinite scroll after N pages
 * - Hide Shorts/Reels/TikTok-style feeds
 * - Mute autoplay videos
 * - Remove engagement bait elements
 * Runs in ISOLATED world. Toggled via popup or keyboard shortcut.
 */
'use strict';

(function UltraDopamineDetox() {

  if (window.__ubDopamineRan) return;
  window.__ubDopamineRan = true;

  // ── Config (user can customize via storage) ────────────────────────────
  var CONFIG = {
    maxScrollPages: 3,           // Cut infinite scroll after 3 viewport heights
    grayscaleNotifs: true,       // Grayscale notification badges
    hideShorts: true,            // Hide Shorts/Reels
    hideRecommended: true,       // Hide "Recommended for you" sections
    muteAutoplay: true,          // Mute autoplaying videos
    hideEngagementBait: true,    // Hide "Trending", "Popular now"
  };

  var _scrollCount = 0;
  var _scrollLocked = false;
  var _styleInjected = false;
  var _detoxEnabled = false;

  // Check if detox mode is enabled
  try {
    chrome.storage.local.get(['dopamineDetox'], function(data) {
      _detoxEnabled = !!data.dopamineDetox;
      if (_detoxEnabled) activate();
    });
  } catch (_) {
    // If no chrome.storage (dev mode), activate by default on social sites
    var host = location.hostname;
    if (/youtube|twitter|x\.com|facebook|instagram|reddit|tiktok/i.test(host)) {
      _detoxEnabled = true;
      activate();
    }
  }

  function activate() {
    injectDetoxCSS();
    setupScrollLimiter();
    hideShorts();
    hideRecommended();
    muteAutoplay();
    setupObserver();
  }

  // ══════════════════════════════════════════════════════════════
  //  1. DETOX CSS — Grayscale badges, calm colors
  // ══════════════════════════════════════════════════════════════
  function injectDetoxCSS() {
    if (_styleInjected) return;
    _styleInjected = true;

    var css = document.createElement('style');
    css.id = 'ultrablock-dopamine-detox';
    css.textContent = [
      // Grayscale notification badges (red dots → gray)
      '[class*="badge"]:not(body), [class*="notification-count"], [class*="unread-count"], ' +
      '[class*="notif-count"], .notification-badge, [data-count]::after { ' +
      '  filter: grayscale(1) !important; opacity: 0.5 !important; }',

      // Grayscale like/heart buttons (remove dopamine red)
      '[class*="like-button"] svg, [class*="heart"] svg, ' +
      '[data-testid="like"] svg, [data-testid="heart"] svg { ' +
      '  filter: grayscale(1) !important; }',

      // Hide Shorts/Reels sections
      CONFIG.hideShorts ? [
        'ytd-rich-section-renderer:has([title="Shorts"]) { display: none !important; }',
        'ytd-reel-shelf-renderer { display: none !important; }',
        '[href*="/shorts/"] { display: none !important; }',
        'a[href*="shorts"] { display: none !important; }',
        // Instagram Reels
        'a[href*="/reels/"] { display: none !important; }',
        '[class*="reels"] { display: none !important; }',
        // Reddit video player
        // TikTok-style elements
        '[class*="short-video"] { display: none !important; }',
      ].join('\n') : '',

      // Hide recommended/suggested sections
      CONFIG.hideRecommended ? [
        // YouTube
        'ytd-watch-next-secondary-results-renderer { display: none !important; }',
        '#related { display: none !important; }',
        // Twitter/X
        '[data-testid="sidebarColumn"] [class*="trends"] { display: none !important; }',
        '[aria-label="Who to follow"] { display: none !important; }',
        // Reddit
        '[class*="recommended"] { display: none !important; }',
      ].join('\n') : '',

      // Scroll lock indicator
      '#ub-scroll-lock-banner { ' +
      '  position: fixed; bottom: 0; left: 0; right: 0; z-index: 2147483647; ' +
      '  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); ' +
      '  color: #e2e8f0; padding: 16px 24px; text-align: center; ' +
      '  font-family: -apple-system, sans-serif; font-size: 14px; ' +
      '  border-top: 2px solid #4f46e5; box-shadow: 0 -4px 20px rgba(0,0,0,0.3); }',
      '#ub-scroll-lock-banner button { ' +
      '  margin-left: 12px; padding: 6px 16px; border-radius: 6px; ' +
      '  border: 1px solid #4f46e5; background: #4f46e5; color: white; ' +
      '  cursor: pointer; font-size: 13px; font-weight: 600; }',
      '#ub-scroll-lock-banner button:hover { background: #4338ca; }',
      '#ub-scroll-lock-banner .dismiss { background: transparent; border-color: #64748b; color: #94a3b8; }',
    ].join('\n');

    (document.head || document.documentElement).appendChild(css);
  }

  // ══════════════════════════════════════════════════════════════
  //  2. INFINITE SCROLL LIMITER
  // ══════════════════════════════════════════════════════════════
  function setupScrollLimiter() {
    var viewportHeight = window.innerHeight;
    var startScroll = window.scrollY;
    var pagesScrolled = 0;

    window.addEventListener('scroll', function() {
      if (_scrollLocked) return;

      var currentScroll = window.scrollY;
      pagesScrolled = Math.floor((currentScroll - startScroll) / viewportHeight);

      if (pagesScrolled >= CONFIG.maxScrollPages && !_scrollLocked) {
        _scrollLocked = true;
        showScrollLockBanner();
      }
    }, { passive: true });
  }

  function showScrollLockBanner() {
    if (document.getElementById('ub-scroll-lock-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'ub-scroll-lock-banner';
    banner.innerHTML = '🧘 <strong>Dopamine Detox:</strong> You\'ve scrolled ' + CONFIG.maxScrollPages + ' pages. Take a break?' +
      '<button id="ub-scroll-continue">+3 more</button>' +
      '<button id="ub-scroll-dismiss" class="dismiss">Dismiss</button>';

    document.body.appendChild(banner);

    // Block further scroll (coordinate with content.js restoreScroll)
    window.__ubScrollLockedByDetox = true;
    document.body.style.setProperty('overflow', 'hidden', 'important');
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');

    document.getElementById('ub-scroll-continue').addEventListener('click', function() {
      _scrollLocked = false;
      CONFIG.maxScrollPages += 3;
      banner.remove();
      document.body.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('overflow');
    });

    document.getElementById('ub-scroll-dismiss').addEventListener('click', function() {
      _scrollLocked = false;
      CONFIG.maxScrollPages = 9999; // Effectively disable
      banner.remove();
      document.body.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('overflow');
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  3. HIDE SHORTS / REELS
  // ══════════════════════════════════════════════════════════════
  function hideShorts() {
    if (!CONFIG.hideShorts) return;
    var host = location.hostname;

    // YouTube Shorts
    if (host.indexOf('youtube.com') !== -1) {
      var shortsEls = document.querySelectorAll(
        'ytd-reel-shelf-renderer, [is-shorts], ' +
        'ytd-guide-entry-renderer a[title="Shorts"], ' +
        'ytd-mini-guide-entry-renderer a[title="Shorts"]'
      );
      for (var i = 0; i < shortsEls.length; i++) {
        shortsEls[i].style.setProperty('display', 'none', 'important');
        _hiddenEls.push(shortsEls[i]);
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  4. HIDE RECOMMENDED SECTIONS
  // ══════════════════════════════════════════════════════════════
  function hideRecommended() {
    if (!CONFIG.hideRecommended) return;

    var selectors = [
      // YouTube sidebar recommendations
      '#secondary #related',
      'ytd-watch-next-secondary-results-renderer',
      // Twitter "What's happening" / "Who to follow"
      '[data-testid="sidebarColumn"] section',
      // Facebook "Suggested for you"
      '[aria-label*="Suggested"]',
    ];

    var els = document.querySelectorAll(selectors.join(','));
    for (var i = 0; i < els.length; i++) {
      els[i].style.setProperty('display', 'none', 'important');
      _hiddenEls.push(els[i]);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  5. MUTE AUTOPLAY VIDEOS
  // ══════════════════════════════════════════════════════════════
  function muteAutoplay() {
    if (!CONFIG.muteAutoplay) return;

    var videos = document.querySelectorAll('video[autoplay], video[data-autoplay]');
    for (var i = 0; i < videos.length; i++) {
      videos[i].muted = true;
      videos[i].pause();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  6. OBSERVER
  // ══════════════════════════════════════════════════════════════
  function setupObserver() {
    var observer = new MutationObserver(function() {
      hideShorts();
      hideRecommended();
      muteAutoplay();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // Listen for toggle from popup
  try {
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.action === 'toggleDopamineDetox') {
        _detoxEnabled = msg.enabled;
        if (_detoxEnabled) activate();
        else deactivate();
      }
    });
  } catch (_) {}

  // Track elements hidden with inline styles for proper cleanup
  var _hiddenEls = [];
  var _origHideShorts = hideShorts;
  
  function deactivate() {
    var style = document.getElementById('ultrablock-dopamine-detox');
    if (style) style.remove();
    var banner = document.getElementById('ub-scroll-lock-banner');
    if (banner) banner.remove();
    window.__ubScrollLockedByDetox = false;
    document.body.style.removeProperty('overflow');
    document.documentElement.style.removeProperty('overflow');
    // Restore inline-hidden elements (BUG-25 fix)
    for (var i = 0; i < _hiddenEls.length; i++) {
      try { _hiddenEls[i].style.removeProperty('display'); } catch(_) {}
    }
    _hiddenEls = [];
    _styleInjected = false;
    _scrollLocked = false;
  }

})();
