/**
 * UltraBlock — inject.js v2.3 (MAIN World)
 * ONLY handles: YouTube JSON Surgery, Time-Warp, Twitch M3U8, Popup Killer
 * (fetch/XHR probe interception and Shadow DOM are in stealth.js)
 */
(function UltraBlockInject() {
  'use strict';

  var hostname = location.hostname;
  var isYouTube = hostname.indexOf('youtube.com') !== -1;
  var isTwitch = hostname.indexOf('twitch.tv') !== -1;

  // Only run on relevant sites
  if (!isYouTube && !isTwitch) {
    // Still install popup killer on all sites
    installPopupKiller();
    return;
  }

  // ══════════════════════════════════════════════════════════════
  //  YOUTUBE: API JSON Surgery
  // ══════════════════════════════════════════════════════════════

  var YT_AD_KEYS = [
    'adPlacements', 'adSlots', 'playerAds', 'adBreakHeartbeatParams',
    'adBreakParams', 'companionData', 'adPreviewRenderer',
    'adModule', 'advertisedVideo', 'adInfoRenderer',
    'playerLegacyDesktopWatchAdsRenderer', 'adSafetyReason',
    'instreamVideoAdRenderer', 'linearAdSequenceRenderer',
    'adLayoutMetadata', 'adPlacementConfig',
    'invideoOverlayAdRenderer', 'actionCompanionAdRenderer',
    'promotedSparklesWebRenderer', 'promotedSparklesTextSearchRenderer',
    'engagementPanelSectionListRenderer', 'topMediaAutoplayRenderer',
    'adLayoutLoggingData', 'adVideoId', 'adDisplayAdRenderer',
    'promotedVideoRenderer', 'carouselAdRenderer',
    'sparklesAdRenderer', 'sparklesVideoAdRenderer',
    'bannerPromoRenderer', 'mealbarPromoRenderer',
    'adInfoDialogRenderer', 'adHoverTextButtonRenderer',
    'adFeedbackRenderer', 'adPodRenderer', 'adIntroRenderer',
    'adOutroRenderer', 'serverAdsMetadata',
    'importantTextBannersWithLiveStreamAds', 'mastheadAdRenderer',
    'adImmersiveStaticRenderer', 'linearAdVideoRenderer'
  ];

  var YT_PLAYER_PATHS = ['/youtubei/v1/player', '/youtubei/v2/player'];

  function isYTPlayerURL(url) {
    if (!url) return false;
    var str = typeof url === 'string' ? url : (url.url || String(url));
    for (var i = 0; i < YT_PLAYER_PATHS.length; i++) {
      if (str.indexOf(YT_PLAYER_PATHS[i]) !== -1) return true;
    }
    return false;
  }

  function surgicallyCleanYTResponse(data) {
    if (typeof data !== 'object' || data === null) return data;
    for (var k = 0; k < YT_AD_KEYS.length; k++) {
      delete data[YT_AD_KEYS[k]];
    }
    var containers = ['contents', 'onResponseReceivedEndpoints', 'frameworkUpdates'];
    for (var c = 0; c < containers.length; c++) {
      if (data[containers[c]]) {
        try { surgicallyCleanYTResponse(data[containers[c]]); } catch (_) {}
      }
    }
    return data;
  }

  // Hook fetch for YouTube player API
  // FIX: Guard against double-wrapping (stealth.js may have already wrapped fetch)
  if (isYouTube && !window.__ubYTFetchHooked) {
    window.__ubYTFetchHooked = true;
    // Use current fetch (may already be wrapped by stealth.js - that's fine, we layer on top)
    var _origFetch = window.fetch;
    window.fetch = function fetch() {
      var args = Array.prototype.slice.call(arguments);
      var url = args[0];
      var isYTAPI = isYTPlayerURL(url);

      var p = _origFetch.apply(window, args);

      if (isYTAPI) {
        return p.then(function(response) {
          var cloned = response.clone();
          return cloned.json().then(function(data) {
            surgicallyCleanYTResponse(data);
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }).catch(function() { return response; });
        });
      }
      return p;
    };

    // Hook XHR as fallback
    var _origXHROpen = XMLHttpRequest.prototype.open;
    var _origXHRSend = XMLHttpRequest.prototype.send;
    var _xhrUrlMap = new WeakMap();

    XMLHttpRequest.prototype.open = function open(method, url) {
      _xhrUrlMap.set(this, typeof url === 'string' ? url : '');
      return _origXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function send() {
      var xhr = this;
      var url = _xhrUrlMap.get(xhr) || '';
      if (isYTPlayerURL(url)) {
        xhr.addEventListener('readystatechange', function() {
          if (xhr.readyState === 4 && xhr.status === 200) {
            try {
              var data = JSON.parse(xhr.responseText);
              surgicallyCleanYTResponse(data);
              Object.defineProperty(xhr, 'responseText', { get: function() { return JSON.stringify(data); }, configurable: true });
              Object.defineProperty(xhr, 'response', { get: function() { return JSON.stringify(data); }, configurable: true });
            } catch (_) {}
          }
        });
      }
      return _origXHRSend.apply(this, arguments);
    };

    // Intercept ytInitialPlayerResponse
    try {
      if (window.ytInitialPlayerResponse) {
        surgicallyCleanYTResponse(window.ytInitialPlayerResponse);
      }
    } catch (_) {}

    var _ytInitialData = undefined;
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      get: function() { return _ytInitialData; },
      set: function(val) {
        try { surgicallyCleanYTResponse(val); } catch (_) {}
        _ytInitialData = val;
      },
      configurable: true, enumerable: true
    });
    // Also intercept ytInitialData (homepage/search page ads)
    try {
      var _ytInitialDataOrig = window.ytInitialData;
      Object.defineProperty(window, 'ytInitialData', {
        get: function() { return _ytInitialDataOrig; },
        set: function(val) {
          try { surgicallyCleanYTResponse(val); } catch (_) {}
          _ytInitialDataOrig = val;
        },
        configurable: true, enumerable: true
      });
    } catch (_) {}


    // Disable ad experiments
    try {
      if (window.yt && window.yt.config_) {
        var cfg = window.yt.config_;
        if (cfg.EXPERIMENT_FLAGS) {
          cfg.EXPERIMENT_FLAGS.web_player_enable_ads = false;
          cfg.EXPERIMENT_FLAGS.disable_new_modular_canvases = true;
        }
      }
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════
  //  YOUTUBE: Time-Warp Engine
  // ══════════════════════════════════════════════════════════════

  if (isYouTube) {
    var YT_AD_SELECTORS = ['.ad-showing', '.ad-interrupting', '.ytp-ad-player-overlay', '[class*="ad-showing"]'];
    var SKIP_SELECTORS = [
      '.ytp-skip-ad-button', '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
      'button.ytp-skip-ad-button', '.videoAdUiSkipButton', '.ytp-ad-skip-button-container button',
    ];

    var _lastTimeWarp = 0;
    var _adEndedTimer = null;

    function timeWarpEngine() {
      try {
        var now = Date.now();
        if (now - _lastTimeWarp < 100) return;

        var adActive = false;
        for (var s = 0; s < YT_AD_SELECTORS.length; s++) {
          if (document.querySelector(YT_AD_SELECTORS[s])) { adActive = true; break; }
        }

        var video = document.querySelector('video');
        if (!video) return;
        _lastTimeWarp = now;

        if (adActive) {
          // Ad detected: rush through at 16x speed, muted
          if (_adEndedTimer) { clearTimeout(_adEndedTimer); _adEndedTimer = null; }
          // Save original volume before muting
          if (typeof video._ubSavedVolume !== 'number') {
            video._ubSavedVolume = video.volume || 1;
          }
          video.muted = true;
          video.volume = 0;
          if (video.playbackRate !== 16) video.playbackRate = 16;

          // Try skip button
          for (var i = 0; i < SKIP_SELECTORS.length; i++) {
            var btn = document.querySelector(SKIP_SELECTORS[i]);
            if (btn) {
              try {
                var r = btn.getBoundingClientRect();
                if (r.width > 0 && r.height > 0) { btn.click(); break; }
              } catch (_) {}
            }
          }
        } else {
          // No ad: debounce restore to avoid flicker when ad class briefly disappears
          if (!_adEndedTimer) {
            _adEndedTimer = setTimeout(function() {
              _adEndedTimer = null;
              var vid = document.querySelector('video');
              if (vid && !document.querySelector('.ad-showing')) {
                vid.muted = false;
                vid.volume = typeof vid._ubSavedVolume === 'number' ? vid._ubSavedVolume : 1;
                delete vid._ubSavedVolume;
                if (vid.playbackRate === 16) vid.playbackRate = 1;
              }
            }, 500);
          }
        }
      } catch (_) {}
    }

    var _ytObserver = new MutationObserver(timeWarpEngine);
    document.addEventListener('DOMContentLoaded', function() {
      var target = document.getElementById('movie_player') || document.body;
      if (target) _ytObserver.observe(target, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
    setInterval(timeWarpEngine, 250);
  }

  // ══════════════════════════════════════════════════════════════
  //  TWITCH: HLS/M3U8 Ad Patch
  // ══════════════════════════════════════════════════════════════

  if (isTwitch) {
    var TWITCH_AD_TAGS = ['stitched-ad-', 'Amazon', 'EXT-X-CUE-OUT', 'EXT-X-CUE-IN', 'ADVERTISEMENT', 'COMMERCIAL'];

    function isM3U8URL(url) {
      if (!url) return false;
      var s = typeof url === 'string' ? url : String(url);
      return s.indexOf('.m3u8') !== -1;
    }

    function patchTwitchM3U8(text) {
      try {
        var lines = text.split('\n');
        var result = [];
        var skip = false;

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          var isAdTag = false;
          for (var t = 0; t < TWITCH_AD_TAGS.length; t++) {
            if (line.indexOf(TWITCH_AD_TAGS[t]) !== -1) { isAdTag = true; break; }
          }
          if (isAdTag) {
            skip = (line.indexOf('CUE-OUT') !== -1);
            if (line.indexOf('CUE-IN') !== -1) skip = false;
            continue;
          }
          if (skip && line.length > 0 && !line.startsWith('#')) continue;
          if (line === '#EXT-X-DISCONTINUITY') continue;
          result.push(lines[i]);
        }
        return result.join('\n');
      } catch (_) { return text; }
    }

    // Hook fetch for M3U8
    // FIX: Guard against double-wrapping (inject.js YouTube hook may already wrap fetch)
    
    // Also block Twitch ad-related API calls
    var _twitchAdAPIs = /\/api\/channel\/ads|\/gql.*adRequest|usher\.ttvnw\.net.*ads/i;
    if (!window.__ubTwitchFetchHooked) {
      window.__ubTwitchFetchHooked = true;
      var _tOrigFetch = window.fetch;
      window.fetch = function fetch() {
        var args = Array.prototype.slice.call(arguments);
        var url = args[0];
        if (isM3U8URL(url)) {
          return _tOrigFetch.apply(window, args).then(function(response) {
            var cloned = response.clone();
            return cloned.text().then(function(text) {
              var cleaned = patchTwitchM3U8(text);
              return new Response(cleaned, { status: response.status, statusText: response.statusText, headers: response.headers });
            }).catch(function() { return response; });
          });
        }
        return _tOrigFetch.apply(window, args);
      };
    }

    // Twitch video ad speed-up
    setInterval(function() {
      try {
        var video = document.querySelector('video');
        if (!video) return;
        var adBanner = document.querySelector('[data-a-target="video-ad-countdown"], [class*="video-ads"]');
        if (adBanner) {
          video.muted = true;
          if (video.playbackRate !== 16) video.playbackRate = 16;
        }
      } catch (_) {}
    }, 500);
  }

  // ══════════════════════════════════════════════════════════════
  //  POPUP / POPUNDER KILLER (all sites)
  // ══════════════════════════════════════════════════════════════

  function installPopupKiller() {
    var _origWindowOpen = window.open;
    var _fakeWin = { closed: false, close: function(){}, focus: function(){}, blur: function(){}, postMessage: function(){}, location: {} };
    var _adUrlPatterns = /juicyads|exoclick|popads|popcash|trafficjunky|adsterra|hilltopads|propellerads|onclckinpg|onclckmn|capndr|acscdn|clickyab|tapsell|yektanet|clickaine|clickadu|mondiad|galaksion|richpush|rollerads|9ff1a25009|tooti\.to|jads\.co/i;

    // ─── INVISIBLE OVERLAY KILLER ─────────────────────────────────────
    // Kill invisible full-page divs with max z-index (used for click hijacking)
    function killInvisibleOverlays() {
      var allFixed = document.querySelectorAll('div, a, span, section');
      for (var i = 0; i < allFixed.length; i++) {
        var el = allFixed[i];
        var style;
        try { style = window.getComputedStyle(el); } catch(_) { continue; }
        
        // Check: invisible (opacity < 0.1) + high z-index + covers large area
        var opacity = parseFloat(style.opacity);
        var zIndex = parseInt(style.zIndex) || 0;
        var pos = style.position;
        
        if (pos !== 'fixed' && pos !== 'absolute') continue;
        if (opacity >= 0.1 && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)') continue;
        if (zIndex < 1000) continue;
        
        var rect = el.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 200) continue;
        
        // This is an invisible clickjack overlay — destroy it
        el.remove();
      }
    }

    // Run immediately and periodically
    if (document.body) killInvisibleOverlays();
    document.addEventListener('DOMContentLoaded', killInvisibleOverlays);
    setInterval(killInvisibleOverlays, 2000);

    // ─── FIRST-CLICK PROTECTION ────────────────────────────────────────
    // Intercept click events that would open ad URLs
    var _firstClickProtected = false;
    document.addEventListener('click', function(e) {
      if (!e.isTrusted) return;
      if (!_firstClickProtected) {
        _firstClickProtected = true;
        // On first click, check if there's a pending popunder
        setTimeout(function() {
          killInvisibleOverlays();
        }, 50);
      }
    }, true);

    // FIX: Previous code blocked ALL untrusted window.open calls (OAuth, payments, etc.)
    // Now: only block known ad URLs; allow all legitimate URLs through.
    // Only block blank/empty popups if they have no trusted event context.
    window.open = function open(url, target, features) {
      var urlStr = String(url || '');
      // Always block known ad popup domains
      if (_adUrlPatterns.test(urlStr)) return _fakeWin;
      // Block blank/empty popups without a trusted user gesture (pop-under trick)
      if (!urlStr || urlStr === 'about:blank') {
        try {
          var e = window.event;
          if (!e || !e.isTrusted) return _fakeWin;
        } catch (_) {}
      }
      // Allow all other popups (OAuth, payment gateways, legitimate new windows)
      return _origWindowOpen.apply(window, arguments);
    };

    // Block clicks on full-page invisible overlay links
    document.addEventListener('click', function(e) {
      if (!e.isTrusted) { e.preventDefault(); e.stopPropagation(); return; }
      var el = e.target;
      while (el && el !== document.body) {
        if (el.tagName === 'A') {
          var href = el.href || '';
          if (_adUrlPatterns.test(href)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          break;
        }
        el = el.parentElement;
      }
    }, true);
  }

  installPopupKiller();

  // Signal to content.js that inject.js is ready
  window.dispatchEvent(new CustomEvent('ultrablock-inject-ready'));

})();
