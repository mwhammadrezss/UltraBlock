/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — sponsorblock.js  v1.0
 *   SponsorBlock Integration for YouTube
 *
 *   Skips sponsor segments, intros, outros, and self-promotion
 *   in YouTube videos using the SponsorBlock crowdsourced database.
 *
 *   API: https://sponsor.ajay.app/api/
 *   Categories: sponsor, selfpromo, interaction, intro, outro, preview, filler
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function UltraBlockSponsorBlock() {

  // ─── Guard: only run on YouTube ─────────────────────────────────────
  if (location.hostname.indexOf('youtube.com') === -1) return;

  // ─── Config ─────────────────────────────────────────────────────────
  var API_BASE = 'https://sponsor.ajay.app/api';
  var CATEGORIES = ['sponsor', 'selfpromo', 'interaction', 'intro', 'outro', 'preview', 'filler'];
  var SKIP_NOTICE_DURATION = 4000; // ms to show skip notification
  var CHECK_INTERVAL = 500; // ms between time checks

  // ─── State ──────────────────────────────────────────────────────────
  var _currentVideoId = null;
  var _segments = [];
  var _skippedSegments = new Set();
  var _checkTimer = null;
  var _noticeEl = null;
  var _enabled = true;
  var _player = null;


  // ═══════════════════════════════════════════════════════════════════════
  //  MAIN LOGIC
  // ═══════════════════════════════════════════════════════════════════════

  function init() {
    // Check if feature is enabled
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['ub_sponsorblock_enabled'], function(data) {
        _enabled = data.ub_sponsorblock_enabled !== false; // enabled by default
        if (_enabled) startMonitoring();
      });
    } else {
      startMonitoring();
    }
  }

  function startMonitoring() {
    // Watch for URL changes (YouTube SPA navigation)
    var lastUrl = location.href;
    var urlObserver = new MutationObserver(function() {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        onNavigate();
      }
    });
    urlObserver.observe(document.body || document.documentElement, {
      childList: true, subtree: true
    });

    // Initial check
    onNavigate();
  }

  function onNavigate() {
    var videoId = getVideoId();
    if (!videoId || videoId === _currentVideoId) return;

    _currentVideoId = videoId;
    _segments = [];
    _skippedSegments.clear();
    stopChecking();

    // Fetch segments for this video
    fetchSegments(videoId).then(function(segments) {
      if (segments && segments.length > 0) {
        _segments = segments;
        startChecking();
      }
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  API
  // ═══════════════════════════════════════════════════════════════════════

  function fetchSegments(videoId) {
    var url = API_BASE + '/skipSegments?videoID=' + encodeURIComponent(videoId) +
              '&categories=' + encodeURIComponent(JSON.stringify(CATEGORIES));

    return fetch(url).then(function(response) {
      if (!response.ok) return [];
      return response.json();
    }).then(function(data) {
      if (!Array.isArray(data)) return [];
      return data.map(function(seg) {
        return {
          start: seg.segment[0],
          end: seg.segment[1],
          category: seg.category,
          uuid: seg.UUID
        };
      });
    }).catch(function() {
      return [];
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  TIME CHECKING & SKIPPING
  // ═══════════════════════════════════════════════════════════════════════

  function startChecking() {
    if (_checkTimer) return;
    _checkTimer = setInterval(checkTime, CHECK_INTERVAL);
  }

  function stopChecking() {
    if (_checkTimer) {
      clearInterval(_checkTimer);
      _checkTimer = null;
    }
  }

  function checkTime() {
    var video = getVideoElement();
    if (!video || video.paused) return;

    var currentTime = video.currentTime;

    for (var i = 0; i < _segments.length; i++) {
      var seg = _segments[i];
      var segKey = seg.uuid || (seg.start + '-' + seg.end);

      // Already skipped this segment in this playback
      if (_skippedSegments.has(segKey)) continue;

      // Check if we're inside a segment (with small tolerance)
      if (currentTime >= seg.start && currentTime < seg.end - 0.5) {
        // Skip!
        video.currentTime = seg.end;
        _skippedSegments.add(segKey);
        showSkipNotice(seg);
        break;
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  UI — Skip Notice
  // ═══════════════════════════════════════════════════════════════════════

  function showSkipNotice(segment) {
    removeNotice();

    var categoryLabels = {
      'sponsor': '💰 Sponsor Skipped',
      'selfpromo': '📢 Self-Promotion Skipped',
      'interaction': '👆 Interaction Reminder Skipped',
      'intro': '🎬 Intro Skipped',
      'outro': '🔚 Outro Skipped',
      'preview': '👀 Preview Skipped',
      'filler': '⏩ Filler Skipped'
    };

    var label = categoryLabels[segment.category] || '⏭️ Segment Skipped';
    var duration = Math.round(segment.end - segment.start);

    _noticeEl = document.createElement('div');
    _noticeEl.id = 'ub-sponsorblock-notice';
    _noticeEl.innerHTML = '<span class="ub-sb-label">' + label + '</span>' +
                          '<span class="ub-sb-time">(' + duration + 's)</span>' +
                          '<button class="ub-sb-undo">Undo</button>';

    // Styles
    _noticeEl.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:2147483647;' +
      'background:rgba(0,0,0,0.85);color:#fff;padding:10px 16px;border-radius:8px;' +
      'font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;' +
      'display:flex;align-items:center;gap:10px;animation:ub-sb-fadein 0.3s ease;' +
      'box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:auto;';

    var styleEl = document.createElement('style');
    styleEl.textContent = '@keyframes ub-sb-fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
      '#ub-sponsorblock-notice .ub-sb-label{font-weight:600}' +
      '#ub-sponsorblock-notice .ub-sb-time{opacity:0.7;font-size:12px}' +
      '#ub-sponsorblock-notice .ub-sb-undo{background:#4CAF50;border:none;color:#fff;padding:4px 10px;' +
      'border-radius:4px;cursor:pointer;font-size:12px;font-weight:600}' +
      '#ub-sponsorblock-notice .ub-sb-undo:hover{background:#66BB6A}';
    _noticeEl.appendChild(styleEl);

    document.body.appendChild(_noticeEl);

    // Undo button
    var undoBtn = _noticeEl.querySelector('.ub-sb-undo');
    undoBtn.addEventListener('click', function() {
      var video = getVideoElement();
      if (video) {
        video.currentTime = segment.start;
        _skippedSegments.delete(segment.uuid || (segment.start + '-' + segment.end));
      }
      removeNotice();
    });

    // Auto-remove after duration
    setTimeout(removeNotice, SKIP_NOTICE_DURATION);
  }

  function removeNotice() {
    if (_noticeEl && _noticeEl.parentNode) {
      _noticeEl.parentNode.removeChild(_noticeEl);
      _noticeEl = null;
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  function getVideoId() {
    // Try URL params first
    var url = new URL(location.href);
    var v = url.searchParams.get('v');
    if (v) return v;

    // Try embed URL pattern
    var match = location.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    // Try shorts
    match = location.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];

    return null;
  }

  function getVideoElement() {
    return document.querySelector('video.html5-main-video') ||
           document.querySelector('video');
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  START
  // ═══════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
