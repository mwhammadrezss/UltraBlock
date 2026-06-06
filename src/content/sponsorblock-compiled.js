/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — SponsorBlock Integration (Compiled JS)
 *  Skips sponsored segments in YouTube videos using crowdsourced data.
 *  API: https://sponsor.ajay.app
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  // ── Constants ─────────────────────────────────────────────────────────
  const API_BASE = 'https://sponsor.ajay.app/api';
  const STORAGE_KEY = 'sponsorblock_config';
  const CHECK_INTERVAL = 500; // ms — how often we check video time

  const CATEGORY_COLORS = {
    sponsor:        '#00d400',
    selfpromo:      '#ffff00',
    interaction:    '#cc00ff',
    intro:          '#00ffff',
    outro:          '#0202ed',
    preview:        '#ff6347',
    music_offtopic: '#ff9900',
    filler:         '#7f7f7f'
  };

  const CATEGORY_LABELS = {
    sponsor:        'Sponsor',
    selfpromo:      'Self-Promotion',
    interaction:    'Interaction Reminder',
    intro:          'Intro',
    outro:          'Outro',
    preview:        'Preview',
    music_offtopic: 'Off-topic Music',
    filler:         'Filler'
  };

  const DEFAULT_CONFIG = {
    enabled: true,
    autoSkip: ['sponsor'],
    notify: ['selfpromo', 'interaction', 'intro', 'outro', 'preview', 'music_offtopic', 'filler'],
    showBar: true
  };

  // ── State ─────────────────────────────────────────────────────────────
  let config = { ...DEFAULT_CONFIG };
  let currentVideoId = null;
  let segments = [];
  let skipTimer = null;
  let videoEl = null;
  let previewBar = null;
  let notificationEl = null;
  let observer = null;
  let lastSkippedUUID = null;

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    loadConfig().then(() => {
      if (!config.enabled) return;
      setupNavigationListener();
      onPageChange();
    });
    setupMessageListener();
  }

  // ── Config persistence ────────────────────────────────────────────────
  function loadConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEY], result => {
        if (result[STORAGE_KEY]) {
          config = { ...DEFAULT_CONFIG, ...result[STORAGE_KEY] };
        }
        resolve();
      });
    });
  }

  function saveConfig() {
    chrome.storage.local.set({ [STORAGE_KEY]: config });
  }

  // ── Message listener (from background/popup) ──────────────────────────
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'getSponsorBlockStatus') {
        sendResponse({
          enabled: config.enabled,
          autoSkip: config.autoSkip,
          notify: config.notify,
          showBar: config.showBar,
          currentSegments: segments.length,
          videoId: currentVideoId
        });
        return false;
      }

      if (msg.action === 'toggleSponsorBlock') {
        config.enabled = msg.enabled !== undefined ? msg.enabled : !config.enabled;
        saveConfig();
        if (config.enabled) {
          onPageChange();
        } else {
          cleanup();
        }
        sendResponse({ enabled: config.enabled });
        return false;
      }

      if (msg.action === 'setSponsorBlockCategories') {
        if (msg.autoSkip) config.autoSkip = msg.autoSkip;
        if (msg.notify) config.notify = msg.notify;
        if (msg.showBar !== undefined) config.showBar = msg.showBar;
        saveConfig();
        // Re-render bar with new config
        if (previewBar && videoEl) renderPreviewBar();
        sendResponse({ success: true });
        return false;
      }

      return false;
    });
  }

  // ── YouTube SPA navigation detection ──────────────────────────────────
  function setupNavigationListener() {
    // YouTube uses History API for navigation
    const origPushState = history.pushState;
    const origReplaceState = history.replaceState;

    history.pushState = function() {
      origPushState.apply(this, arguments);
      setTimeout(onPageChange, 300);
    };

    history.replaceState = function() {
      origReplaceState.apply(this, arguments);
      setTimeout(onPageChange, 300);
    };

    window.addEventListener('popstate', () => setTimeout(onPageChange, 300));

    // Also listen for yt-navigate-finish (YouTube's custom event)
    document.addEventListener('yt-navigate-finish', () => setTimeout(onPageChange, 300));
  }

  // ── Page change handler ───────────────────────────────────────────────
  function onPageChange() {
    const videoId = extractVideoId();
    if (!videoId || videoId === currentVideoId) return;

    // New video — reset and fetch
    cleanup();
    currentVideoId = videoId;
    fetchSegments(videoId);
    waitForVideo();
  }

  function extractVideoId() {
    const url = new URL(window.location.href);
    if (url.pathname === '/watch') {
      return url.searchParams.get('v');
    }
    // Embedded or shorts
    const match = url.pathname.match(/\/(embed|shorts)\/([a-zA-Z0-9_-]{11})/);
    return match ? match[2] : null;
  }

  // ── Fetch segments from SponsorBlock API ──────────────────────────────
  function fetchSegments(videoId) {
    const allCategories = [...config.autoSkip, ...config.notify];
    if (allCategories.length === 0) return;

    const categoriesParam = encodeURIComponent(JSON.stringify(allCategories));
    const url = `${API_BASE}/skipSegments?videoID=${videoId}&categories=${categoriesParam}`;

    fetch(url)
      .then(res => {
        if (res.status === 404) return []; // No segments for this video
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        segments = Array.isArray(data) ? data : [];
        if (segments.length > 0 && videoEl) {
          startSkipTimer();
          if (config.showBar) renderPreviewBar();
        }
      })
      .catch(() => {
        segments = [];
      });
  }

  // ── Wait for video element ────────────────────────────────────────────
  function waitForVideo() {
    // Try immediately
    videoEl = document.querySelector('video.html5-main-video') ||
              document.querySelector('video');
    if (videoEl) {
      onVideoReady();
      return;
    }

    // Use MutationObserver to wait for video element
    observer = new MutationObserver((_mutations, obs) => {
      videoEl = document.querySelector('video.html5-main-video') ||
                document.querySelector('video');
      if (videoEl) {
        obs.disconnect();
        observer = null;
        onVideoReady();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Timeout fallback — stop observing after 15s
    setTimeout(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }, 15000);
  }

  function onVideoReady() {
    if (segments.length > 0) {
      startSkipTimer();
      if (config.showBar) renderPreviewBar();
    }

    // Re-render bar when video metadata loads (duration available)
    videoEl.addEventListener('loadedmetadata', () => {
      if (segments.length > 0 && config.showBar) renderPreviewBar();
    }, { once: true });
  }

  // ── Skip timer — checks current time against segments ─────────────────
  function startSkipTimer() {
    if (skipTimer) clearInterval(skipTimer);

    skipTimer = setInterval(() => {
      if (!videoEl || videoEl.paused) return;

      const currentTime = videoEl.currentTime;

      for (const seg of segments) {
        const [start, end] = seg.segment;
        const cat = seg.category;

        // Check if we're inside this segment
        if (currentTime >= start && currentTime < end - 0.5) {
          // Avoid re-skipping the same segment
          if (lastSkippedUUID === seg.UUID) continue;

          if (config.autoSkip.includes(cat)) {
            // Auto-skip
            videoEl.currentTime = end;
            lastSkippedUUID = seg.UUID;
            showNotification(`Skipped: ${CATEGORY_LABELS[cat] || cat}`, cat, true);
          } else if (config.notify.includes(cat)) {
            // Just notify once
            if (lastSkippedUUID !== seg.UUID) {
              lastSkippedUUID = seg.UUID;
              showNotification(`${CATEGORY_LABELS[cat] || cat} segment`, cat, false);
            }
          }
          break; // Only handle one segment at a time
        }
      }
    }, CHECK_INTERVAL);
  }

  // ── Notification overlay ──────────────────────────────────────────────
  function showNotification(text, category, isSkip) {
    if (notificationEl) notificationEl.remove();

    notificationEl = document.createElement('div');
    notificationEl.id = 'ub-sponsorblock-notification';
    const color = CATEGORY_COLORS[category] || '#ffffff';

    Object.assign(notificationEl.style, {
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: '99999',
      padding: '8px 16px',
      borderRadius: '4px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#fff',
      fontSize: '13px',
      fontFamily: 'Roboto, Arial, sans-serif',
      fontWeight: '500',
      borderLeft: `3px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'opacity 0.3s ease',
      opacity: '1',
      pointerEvents: 'none'
    });

    const icon = isSkip ? '⏭️' : 'ℹ️';
    notificationEl.textContent = `${icon} ${text}`;

    // Insert into the video player container
    const playerContainer = document.querySelector('.html5-video-player') ||
                            videoEl.parentElement;
    if (playerContainer) {
      playerContainer.style.position = playerContainer.style.position || 'relative';
      playerContainer.appendChild(notificationEl);
    }

    // Fade out and remove
    setTimeout(() => {
      if (notificationEl) {
        notificationEl.style.opacity = '0';
        setTimeout(() => {
          if (notificationEl) {
            notificationEl.remove();
            notificationEl = null;
          }
        }, 300);
      }
    }, isSkip ? 2000 : 3500);
  }

  // ── Preview bar — colored segments on the progress bar ────────────────
  function renderPreviewBar() {
    // Remove old bar
    if (previewBar) previewBar.remove();

    if (!videoEl || !videoEl.duration || segments.length === 0) return;

    const duration = videoEl.duration;

    // Find YouTube's progress bar container
    const progressBar = document.querySelector('.ytp-progress-bar-container') ||
                        document.querySelector('.ytp-progress-bar');
    if (!progressBar) return;

    previewBar = document.createElement('div');
    previewBar.id = 'ub-sponsorblock-bar';
    Object.assign(previewBar.style, {
      position: 'absolute',
      bottom: '0',
      left: '0',
      width: '100%',
      height: '4px',
      zIndex: '60',
      pointerEvents: 'none',
      overflow: 'hidden'
    });

    for (const seg of segments) {
      const [start, end] = seg.segment;
      const cat = seg.category;
      const color = CATEGORY_COLORS[cat] || '#ffffff';

      const leftPct = (start / duration) * 100;
      const widthPct = ((end - start) / duration) * 100;

      const segEl = document.createElement('div');
      Object.assign(segEl.style, {
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        height: '100%',
        backgroundColor: color,
        opacity: '0.7',
        borderRadius: '1px'
      });
      segEl.title = `${CATEGORY_LABELS[cat] || cat} (${formatTime(start)} - ${formatTime(end)})`;
      previewBar.appendChild(segEl);
    }

    progressBar.style.position = progressBar.style.position || 'relative';
    progressBar.appendChild(previewBar);
  }

  // ── Utility: format seconds → MM:SS ───────────────────────────────────
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── Cleanup on navigation ─────────────────────────────────────────────
  function cleanup() {
    if (skipTimer) {
      clearInterval(skipTimer);
      skipTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (previewBar) {
      previewBar.remove();
      previewBar = null;
    }
    if (notificationEl) {
      notificationEl.remove();
      notificationEl = null;
    }
    segments = [];
    lastSkippedUUID = null;
    videoEl = null;
  }

  // ── Start ─────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
