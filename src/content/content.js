/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — content.js  v2.0
 *   Runs in ISOLATED world at document_start (all frames)
 *
 *   Sections:
 *   1. AD_SELECTORS        — actual ad containers (stealth-hide)
 *   2. OVERLAY_SELECTORS   — anti-adblock walls (hard-remove)
 *   3. stealthHide()       — visibility:hidden + store dimensions
 *   4. hardRemove()        — fully remove from DOM
 *   5. Cookie banner killer
 *   6. Scroll restore
 *   7. processPage()       — runs all filters
 *   8. Site-specific patches
 *   9. MutationObserver    — handles SPAs / dynamic injection
 *   10. Startup
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function UltraBlockContent() {

  // ─── Guard: Skip if running inside a YouTube ad iframe ───────────────────
  // content.js runs with all_frames:true which includes YT ad iframes.
  // Those iframes have no document.body content worth processing and cause errors.
  try {
    var _isYTAdFrame = (
      window !== window.top &&
      (location.hostname.indexOf('youtube.com') !== -1 ||
       location.hostname.indexOf('googlevideo.com') !== -1 ||
       location.hostname.indexOf('doubleclick.net') !== -1 ||
       location.hostname.indexOf('googleadservices.com') !== -1) &&
      (location.pathname.indexOf('/pagead/') !== -1 ||
       location.pathname.indexOf('/pcs/') !== -1 ||
       location.search.indexOf('adformat') !== -1 ||
       document.title === '' && document.body && document.body.children.length < 3)
    );
    if (_isYTAdFrame) return;
  } catch (_) {}

  // ─── Marker attributes (read by stealth.js for dimension spoofing) ────────
  var HIDDEN_ATTR = 'data-ub-hidden';
  var WIDTH_ATTR  = 'data-ub-w';
  var HEIGHT_ATTR = 'data-ub-h';

  // ─── Flags for scroll restoration coordination ─────────────────────────
  var _overlayWasRemoved = false;


  // ══════════════════════════════════════════════════════════════════════════
  //  1. AD_SELECTORS
  //     Real ad containers — we STEALTH-HIDE these (visibility:hidden, keep
  //     in DOM so bait-checks still see an element with real dimensions).
  // ══════════════════════════════════════════════════════════════════════════
  var AD_SELECTORS = [
    // ── Google AdSense ──────────────────────────────────────────────────
    'ins.adsbygoogle',
    'ins[data-ad-slot]',
    '[data-ad-client][data-ad-slot]',

    // ── Google Publisher Tag (GPT) ───────────────────────────────────────
    '[id^="div-gpt-ad"]',
    '[id^="google_ads_iframe"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googleadservices.com"]',

    // ── Amazon Ads ───────────────────────────────────────────────────────
    'iframe[src*="amazon-adsystem.com"]',
    '[id^="amzn_assoc_ad"]',

    // ── Taboola ──────────────────────────────────────────────────────────
    'div[id^="taboola-"]',
    '.trc_related_container',
    '[class*="taboola"]',

    // ── Outbrain ─────────────────────────────────────────────────────────
    '.OUTBRAIN',
    '[data-widget-id^="MB_"]',

    // ── Media.net ────────────────────────────────────────────────────────
    'iframe[src*="media.net"]',
    '[id^="mediaoptions_"]',

    // ── Criteo ───────────────────────────────────────────────────────────
    'iframe[src*="criteo.com"]',
    '[id^="cto_"]',

    // ── AppNexus / Xandr ─────────────────────────────────────────────────
    'iframe[src*="adnxs.com"]',

    // ── Carbon Ads ───────────────────────────────────────────────────────
    '#carbonads',
    '.carbon-ad',
    '.carbonad',

    // ── Specific ad data attributes ──────────────────────────────────────
    '[data-ad-unit]',
    '[data-ad-slot]:not([data-ad-slot=""])',
    '[data-ad-zone]',
    '[data-ad-id]',
    'amp-ad',
    'amp-sticky-ad',
    'amp-auto-ads',

    // ── Generic patterns (safe: scoped away from body/header/main) ────────
    '[id*="ad-container"]:not(body):not(header):not(main):not(nav)',
    '[id*="ad-unit"]:not(body):not(header)',
    '[id*="ad-wrapper"]:not(body)',
    '[id*="ad-placeholder"]',
    '[id*="ad-slot"]:not(body)',
    '[class*="ad-container"]:not(body):not(header):not(main)',
    '[class*="ad-unit"]:not(body)',
    '[class*="ad-slot"]:not(body)',
    '[class*="ad-wrapper"]:not(body)',
    '[class*="ad-banner"]:not(body)',
    '[class*="banner-ad"]:not(body)',
    '[class*="advertisement"]:not(body):not(header)',
    '[class*="sponsored-content"]:not(body)',

    // ── Popup / interstitial / overlay ads ───────────────────────────────
    '[class*="popup-ad"]',
    '[id*="popup-ad"]',
    '[class*="interstitial-ad"]',
    '[id*="modal-ad"]',
    '[class*="floating-ad"]',
    '[class*="sticky-ad"]',
    '[class*="fixed-ad"]',

    // ── Video ads ────────────────────────────────────────────────────────
    '[class*="video-ad"]:not(body)',
    '[id*="video-ad"]',
    '[class*="preroll"]',
    '[class*="ad-preroll"]',

    // ── Native / sponsored ───────────────────────────────────────────────
    '[class*="native-ad"]:not(body)',
    '[class*="in-article-ad"]',
    '[class*="post-ad"]',
    '[class*="content-ad"]',

    // ── Revcontent / MGID ────────────────────────────────────────────────
    '[id^="outbrain-"]',
    '[class*="outbrain"]',
    '[class*="revcontent"]',
    '[class*="mgid"]',

    // ── Iframes catch-all ────────────────────────────────────────────────
    'iframe[src*="pubmatic.com"]',
    'iframe[src*="rubiconproject.com"]',
    'iframe[src*="openx.net"]',
    'iframe[src*="taboola.com"]',
    'iframe[src*="outbrain.com"]',
    'iframe[src*="criteo.com"]',

    // ── Adult/Popup ad networks ────────────────────────────────────
    'iframe[src*="juicyads"]',
    'iframe[src*="exoclick"]',
    'iframe[src*="exosrv"]',
    'iframe[src*="trafficjunky"]',
    'iframe[src*="popads"]',
    'iframe[src*="popcash"]',
    'iframe[src*="adsterra"]',
    'iframe[src*="hilltopads"]',
    '[id*="juicyads"]',
    '[class*="juicyads"]',
    '[id*="exoclick"]',
    '[data-exo-zone]',
    // ── Persian/Iranian ad networks ────────────────────────────────
    '[id*="yektanet"]',
    '[class*="yektanet"]',
    '[id*="tapsell"]',
    '[class*="tapsell"]',
    '[id*="adivery"]',
    'iframe[src*="yektanet"]',
    'iframe[src*="tapsell"]',
    'iframe[src*="adivery"]',
    'iframe[src*="sabavision"]',

    // ── Floating / Corner / Sticky mini-ads ────────────────────────────────
    '[class*="floating-banner"]',
    '[class*="float-banner"]',
    '[id*="floating-banner"]',
    '[class*="corner-ad"]',
    '[id*="corner-ad"]',
    '[class*="sticky-banner"]',
    '[id*="sticky-banner"]',
    '[class*="bottom-fixed"]',
    '[class*="fixed-bottom-ad"]',
    '[class*="footer-ad"]',
    '[id*="footer-ad"]',
    '[class*="slide-up-ad"]',
    '[class*="push-notification"]',
    '[id*="push-notification"]',
    'div[style*="position: fixed"][style*="bottom"][style*="z-index"]',
  ];


  // ══════════════════════════════════════════════════════════════════════════
  //  2. OVERLAY_SELECTORS
  //     Anti-adblock walls — HARD-REMOVE these from DOM entirely.
  // ══════════════════════════════════════════════════════════════════════════
  var OVERLAY_SELECTORS = [
    // ── Compound class/id patterns ───────────────────────────────────────
    '[class*="adblock"][class*="wall"]',
    '[class*="adblock"][class*="overlay"]',
    '[class*="adblock"][class*="modal"]',
    '[class*="adblock"][class*="popup"]',
    '[class*="adblock"][class*="warning"]',
    '[class*="adblock"][class*="notice"]',
    '[class*="adblock"][class*="message"]',
    '[class*="adblock"][class*="gate"]',
    '[class*="adblock"][class*="banner"]',
    '[id*="adblock"][id*="overlay"]',
    '[id*="adblock"][id*="wall"]',
    '[id*="adblock"][id*="warning"]',
    '[id*="adblock"][id*="notice"]',
    '[id*="adblock"][id*="message"]',
    '[id*="adblock"][id*="modal"]',

    // ── "anti-adblock" patterns ──────────────────────────────────────────
    '[class*="anti-adblock"]',
    '[id*="anti-adblock"]',
    '[class*="adblocker-wall"]',
    '[id*="adblocker-wall"]',

    // ── Named elements ───────────────────────────────────────────────────
    '#adblock-notice',   '#adblock-overlay',  '#adblock-wall',
    '#adblock-warning',  '#ab-notification',  '#ab-overlay',
    '.adblock-notice',   '.adblock-overlay',  '.adblock-wall',
    '.adblock-warning',  '.ab-notification',  '.ab-overlay',
    '.please-disable-adblock',
    '#please-disable-adblock',
    '.disable-adblock',
    '#disable-adblock',

    // ── Cookie/GDPR banners ──────────────────────────────────────────────
    // NOTE: Cookie banners intentionally NOT listed here.
    // cookie-negotiator.js handles them by clicking "Reject All" first.
    // Removing banners here before negotiation breaks cookie-negotiator.js.

    // ── Paywall triggered by adblock detection ───────────────────────────
    '[class*="paywall"][style*="display: block"]',
    '[id*="paywall-overlay"]',
  ];


  // ══════════════════════════════════════════════════════════════════════════
  //  3. stealthHide()
  //     Keep element in DOM and mark it with HIDDEN_ATTR.
  //     stealth.js (Main World) intercepts offsetHeight/getBCR and returns
  //     stored dimensions — so anti-adblock bait checks see a normal element.
  //
  //     NOTE: getBoundingClientRect at document_start returns 0,0 (no layout
  //     yet). We do NOT measure here — stealth.js uses default fallback values
  //     (300×250) which are standard ad banner sizes and pass most checks.
  //     Dimensions are only meaningful after DOMContentLoaded; the late passes
  //     (500ms / 2000ms) in the load handler will re-run stealthHide on any
  //     already-hidden elements — but since HIDDEN_ATTR guard skips them,
  //     there is nothing to update. This is acceptable: 300×250 default is
  //     good enough to fool bait-checks.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  //  COSMETIC BLOCK REPORTING (batched to background for badge counter)
  // ══════════════════════════════════════════════════════════════════════════
  var _cosmeticBlockCount = 0;
  var _reportTimer = null;

  function reportCosmeticBlocks() {
    if (_cosmeticBlockCount > 0) {
      try {
        chrome.runtime.sendMessage({ action: 'incrementBlock', count: _cosmeticBlockCount });
      } catch (_) {}
      _cosmeticBlockCount = 0;
    }
    _reportTimer = null;
  }

  function scheduleReport() {
    if (!_reportTimer) {
      _reportTimer = setTimeout(reportCosmeticBlocks, 500);
    }
  }

  function stealthHide(el) {
    if (!el
      || el === document.body
      || el === document.documentElement
      || el.hasAttribute(HIDDEN_ATTR)) return;

    // Mark element — stealth.js will spoof its dimensions via data-ub-w/h
    // We try to capture real dimensions if layout is already available
    var w = el.offsetWidth  || 300;
    var h = el.offsetHeight || 250;

    el.setAttribute(HIDDEN_ATTR, '1');
    el.setAttribute(WIDTH_ATTR,  String(Math.max(w, 1)));
    el.setAttribute(HEIGHT_ATTR, String(Math.max(h, 1)));

    // Use visibility:hidden (NOT display:none) — keeps layout space intact
    // so dimension checks by anti-adblock scripts return non-zero values.
    // stealth.js offsetHeight/getBCR overrides serve stored values anyway.
    el.style.setProperty('visibility',     'hidden', 'important');
    el.style.setProperty('pointer-events', 'none',   'important');
    el.style.setProperty('opacity',        '0',      'important');
    _cosmeticBlockCount++;
    scheduleReport();
    // Do NOT set height:0 — that would expose us to bait-checks
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  4. hardRemove()
  //     Fully remove element from DOM — for anti-adblock overlays only.
  // ══════════════════════════════════════════════════════════════════════════
  function hardRemove(el) {
    if (!el || el === document.body || el === document.documentElement) return;
    try { el.remove(); _overlayWasRemoved = true; _cosmeticBlockCount++; scheduleReport(); } catch (_) {}
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  5. Cookie banner handling
  //     DELEGATED entirely to cookie-negotiator.js
  // ══════════════════════════════════════════════════════════════════════════


  // ══════════════════════════════════════════════════════════════════════════
  //  6. Scroll restore
  //     Anti-adblock walls lock body scroll. After removing the overlay
  //     we restore scroll and remove blur filters.
  // ══════════════════════════════════════════════════════════════════════════
  function restoreScroll() {
    var b = document.body;
    var h = document.documentElement;
    if (!b || !h) return;

    // Only restore if we actually removed an anti-adblock overlay
    if (!_overlayWasRemoved) return;

    // Don't interfere with Dopamine Detox scroll lock
    if (window.__ubScrollLockedByDetox) return;

    try {
      var bs = window.getComputedStyle(b);
      var hs = window.getComputedStyle(h);
      if (bs.overflow === 'hidden') b.style.removeProperty('overflow');
      if (hs.overflow === 'hidden') h.style.removeProperty('overflow');
      if (bs.position === 'fixed')  b.style.removeProperty('position');
      // Remove blur filter (common adblock-wall trick)
      if (b.style.filter && b.style.filter.indexOf('blur') !== -1) {
        b.style.removeProperty('filter');
      }
    } catch (_) {}
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  7. processPage()
  //     Main routine — runs all filters on the current DOM state.
  // ══════════════════════════════════════════════════════════════════════════
  function processPage() {
    // 7a. Stealth-hide actual ad elements
    for (var ai = 0; ai < AD_SELECTORS.length; ai++) {
      try {
        var adEls = document.querySelectorAll(AD_SELECTORS[ai]);
        for (var aj = 0; aj < adEls.length; aj++) stealthHide(adEls[aj]);
      } catch (_) { /* ignore invalid selectors */ }
    }

    // 7b. Hard-remove anti-adblock overlays
    for (var oi = 0; oi < OVERLAY_SELECTORS.length; oi++) {
      try {
        var ovEls = document.querySelectorAll(OVERLAY_SELECTORS[oi]);
        for (var oj = 0; oj < ovEls.length; oj++) hardRemove(ovEls[oj]);
      } catch (_) {}
    }

    // 7c. Kill floating/corner/sticky ad elements (heuristic)
    killFloatingAds();

    // 7d. Restore scroll if locked
    restoreScroll();

    // 7e. Site-specific patches
    siteSpecificPatches();
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  7c-helper. killFloatingAds()
  //     Detect and remove fixed/absolute positioned small ad containers
  //     that appear in corners or bottom of the viewport.
  // ══════════════════════════════════════════════════════════════════════════
  var _adIframeHosts = /juicyads|exoclick|exosrv|trafficjunky|popads|popcash|adsterra|hilltopads|propellerads|googlesyndication|doubleclick|adserver|banner|adzone/i;

  function killFloatingAds() {
    // Find fixed/absolute positioned elements that look like ads
    var fixed = document.querySelectorAll('div, aside, section, iframe');
    for (var fi = 0; fi < fixed.length; fi++) {
      var el = fixed[fi];
      if (el.hasAttribute(HIDDEN_ATTR)) continue;
      if (el === document.body || el === document.documentElement) continue;
      
      var style;
      try { style = window.getComputedStyle(el); } catch(_) { continue; }
      
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      
      var zIndex = parseInt(style.zIndex) || 0;
      var w = el.offsetWidth;
      var h = el.offsetHeight;
      
      // Skip navigation bars, headers, modals (too large or too important)
      if (w > window.innerWidth * 0.9 && h > window.innerHeight * 0.7) continue;
      
      // Check if this fixed element contains ad iframes or ad-like content
      var hasAdContent = false;
      
      // Check for ad iframes inside
      var innerIframes = el.querySelectorAll('iframe');
      for (var ii = 0; ii < innerIframes.length; ii++) {
        if (_adIframeHosts.test(innerIframes[ii].src || '')) {
          hasAdContent = true;
          break;
        }
      }
      
      // Check for ad images
      if (!hasAdContent) {
        var imgs = el.querySelectorAll('img');
        for (var im = 0; im < imgs.length; im++) {
          if (_adIframeHosts.test(imgs[im].src || '')) {
            hasAdContent = true;
            break;
          }
        }
      }
      
      // Check for ad-like class/id
      if (!hasAdContent) {
        var elStr = (el.id + ' ' + el.className).toLowerCase();
        if (/\bad\b|banner|adzone|adunit|sponsor|promo/i.test(elStr)) {
          hasAdContent = true;
        }
      }
      
      // Check: small fixed element at bottom corners (common pattern for floating ads)
      if (!hasAdContent && zIndex > 100 && h < 350 && h > 30) {
        var rect = el.getBoundingClientRect();
        var atBottom = rect.bottom > window.innerHeight * 0.7;
        var atCorner = rect.left < 20 || rect.right > window.innerWidth - 20;
        // If it has an iframe child, it's almost certainly an ad
        if ((atBottom || atCorner) && innerIframes.length > 0) {
          hasAdContent = true;
        }
      }
      
      if (hasAdContent) {
        stealthHide(el);
      }
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  8. Site-specific patches
  // ══════════════════════════════════════════════════════════════════════════
  function siteSpecificPatches() {
    var host = location.hostname;

    // Forbes — full-page takeover + adblock modal + subscription wall
    if (host.indexOf('forbes.com') !== -1) {
      try {
        document.querySelectorAll('.fs-sticky-footer-ad, .fbs-ad, .top-ad-container, .ad-unit, [class*="fbs-ad"], [data-ad-unit]').forEach(stealthHide);
        document.querySelectorAll('#adblockModal, .modal-backdrop, .blocking-ad-overlay, [class*="adblock"][class*="modal"], .tp-modal, .tp-backdrop, #tp-container, .paywall-overlay, [id*="piano"]').forEach(hardRemove);
        // Remove overflow:hidden from body (Forbes locks scroll)
        if (document.body) {
          document.body.style.removeProperty('overflow');
          document.body.style.removeProperty('position');
          document.documentElement.style.removeProperty('overflow');
        }
        // Remove blur from article content
        document.querySelectorAll('[class*="article-body"], [class*="body-content"], main, article').forEach(function(el) {
          el.style.removeProperty('filter');
          el.style.removeProperty('-webkit-filter');
        });
      } catch (_) {}
    }

    // Fandom — ad walls and video players
    if (host.indexOf('fandom.com') !== -1) {
      try {
        document.querySelectorAll('.ad-slot, .top-ads-container, .bottom-ads-container, .ad-holder, [class*="AdSlot"], .global-navigation__bottom-bar-ads, .recirculation-prefooter, .fandom-sticky-header-ad').forEach(stealthHide);
        document.querySelectorAll('[class*="adblock"][class*="wall"], .ad-feedback-wrapper, [id*="adblock"]').forEach(hardRemove);
        // Fandom video player ads
        document.querySelectorAll('.jw-ad, .video-player-ad, [class*="jwplayer"][class*="ad"]').forEach(stealthHide);
      } catch (_) {}
    }

    // GamePressure — anti-adblock
    if (host.indexOf('gamepressure.com') !== -1) {
      try {
        document.querySelectorAll('[class*="adblock"], [id*="adblock"], .ad-box, .ad-container').forEach(hardRemove);
      } catch (_) {}
    }

    // DailyMail — heavy banners
    if (host.indexOf('dailymail.co.uk') !== -1) {
      try {
        document.querySelectorAll('.ad-placeholder, [id^="mol-"], .mol-ads-content, [class*="sponsored"], .puff-ad, .related-partners').forEach(stealthHide);
      } catch (_) {}
    }

    // Yahoo News
    if (host.indexOf('yahoo.com') !== -1) {
      try {
        document.querySelectorAll('[data-test-locator*="ad"], .gemini-ad, .caas-da, [class*="native-ad"]').forEach(stealthHide);
      } catch (_) {}
    }

    // MSN
    if (host.indexOf('msn.com') !== -1) {
      try {
        document.querySelectorAll('[data-m-type="advertisement"], .nativead, [class*="native-ad"], [data-info-type="ad"]').forEach(stealthHide);
      } catch (_) {}
    }

    // Speedtest — ad notice
    if (host.indexOf('speedtest.net') !== -1) {
      try {
        document.querySelectorAll('.ad-notice, .ookla-ad-unit').forEach(stealthHide);
      } catch (_) {}
    }

    // Twitch — interstitial and banner ads
    if (host.indexOf('twitch.tv') !== -1) {
      try {
        document.querySelectorAll(
          '.stream-player-ads-overlay, .preview-card-stat--type-Ad, ' +
          '.ad-overlay, .tw-ad'
        ).forEach(stealthHide);
      } catch (_) {}
    }

    // Reddit — promoted posts (old + new + shreddit UI)
    if (host.indexOf('reddit.com') !== -1) {
      try {
        document.querySelectorAll(
          '[data-promoted="true"], [promoted="true"], ' +
          'div[class*="promotedlink"], div[data-testid="post-container"][data-adclickable], ' +
          'shreddit-ad-post, [data-testid="ad-slot"], ' +
          '[data-ad-id], [is-ad], [data-is-promoted-link="true"], ' +
          'faceplate-tracker[data-faceplate-tracking-context*="ad"], ' +
          '[class*="promoted"][class*="post"], ' +
          '[slot="full-post-link"][href*="/ads/"], ' +
          'article[data-subreddit-prefixed-name="u/"][data-post-click-location="promoted"]'
        ).forEach(stealthHide);
        // Also hide "Promoted" badges/containers in new Reddit
        document.querySelectorAll('[data-click-id="promoted"]').forEach(function(el) {
          var post = el.closest('article, [data-testid="post-container"], shreddit-post');
          if (post) stealthHide(post);
        });
      } catch (_) {}
    }

    // YouTube — homepage/sidebar ads (non-video; video handled by youtube.js)
    if (host.indexOf('youtube.com') !== -1) {
      try {
        document.querySelectorAll(
          '#masthead-ad, ytd-banner-promo-renderer, ytd-ad-slot-renderer, ' +
          'ytd-in-feed-ad-layout-renderer, ytd-display-ad-renderer, ' +
          'ytd-promoted-sparkles-web-renderer, ytd-promoted-video-renderer, ' +
          'ytd-compact-promoted-video-renderer, ytd-carousel-ad-renderer, ' +
          'ytd-statement-banner-renderer, ytd-mealbar-promo-renderer, ' +
          'ytd-rich-item-renderer[is-ad]'
        ).forEach(stealthHide);
      } catch (_) {}
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  9. MutationObserver
  //     Batches DOM changes via requestAnimationFrame to avoid layout
  //     thrashing. Handles SPAs where ads are injected after navigation.
  // ══════════════════════════════════════════════════════════════════════════
  var _pendingProcess = false;

  var _observer = new MutationObserver(function(mutations) {
    var shouldProcess = false;

    for (var mi = 0; mi < mutations.length; mi++) {
      var m = mutations[mi];
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        for (var ni = 0; ni < m.addedNodes.length; ni++) {
          if (m.addedNodes[ni].nodeType === 1) { // ELEMENT_NODE
            shouldProcess = true;
            break;
          }
        }
      }
      if (shouldProcess) break;
    }

    if (shouldProcess && !_pendingProcess) {
      _pendingProcess = true;
      requestAnimationFrame(function() {
        try { processPage(); } catch (_) {}
        _pendingProcess = false;
      });
    }
  });

  function startObserver() {
    var root = document.documentElement || document.body;
    if (root) {
      _observer.observe(root, {
        childList:  true,
        subtree:    true,
        attributes: false,
      });
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  //  10. STARTUP
  // ══════════════════════════════════════════════════════════════════════════

  // Start observer immediately (document_start)
  startObserver();

  // Listen for inject.js ready signal
  window.addEventListener('ultrablock-inject-ready', function(e) {
    // inject.js (MAIN world) is live — run an immediate processPage pass
    try { processPage(); } catch (_) {}
  }, { once: true, passive: true });

  // Run on DOMContentLoaded or immediately if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPage, { once: true });
  } else {
    processPage();
  }

  // Re-run after full page load (lazy-loaded ads)
  window.addEventListener('load', function() {
    try { processPage(); } catch (_) {}
    // Extra pass for late-loading ad SDKs
    setTimeout(function() { try { processPage(); } catch (_) {} }, 500);
    setTimeout(function() { try { processPage(); } catch (_) {} }, 2000);
  }, { once: true, passive: true });

  // Listen for messages from background.js
  try {
    chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
      if (msg.action === 'getPageBlockCount') {
        var count = document.querySelectorAll('[' + HIDDEN_ATTR + ']').length;
        sendResponse({ count: count });
      }
      if (msg.action === 'profileChanged') {
        // Profile switched — re-read rules and apply
        var rules = msg.rules || {};
        // Disable/enable features based on profile
        if (rules.dopamineDetox === false) {
          document.documentElement.classList.remove('ub-dopamine-detox');
        }
        if (rules.retroMode === false) {
          document.documentElement.classList.remove('ub-retro-mode');
        }
        // Trigger re-scan
        try { processPage(); } catch (_) {}
        sendResponse({ ack: true });
      }
    });
  } catch (_) {}

})();
