/**
 * UltraBlock — video-patch.js v2.3
 * Neural Video Patching: When unskippable video ads play,
 * mute audio and overlay a mini personal dashboard (clock, system stats)
 * so the user doesn't waste mental energy on the ad.
 * Runs in ISOLATED world on YouTube/Twitch.
 */
'use strict';

(function UltraVideoPatch() {

  if (window.__ubVideoPatchRan) return;
  window.__ubVideoPatchRan = true;

  var host = location.hostname;
  var isYouTube = host.indexOf('youtube.com') !== -1;
  var isTwitch  = host.indexOf('twitch.tv') !== -1;

  if (!isYouTube && !isTwitch) return;

  var _overlayEl = null;
  var _overlayActive = false;
  var _clockInterval = null;

  // ══════════════════════════════════════════════════════════════
  //  OVERLAY CREATION
  // ══════════════════════════════════════════════════════════════
  function createOverlay() {
    if (_overlayEl) return _overlayEl;

    _overlayEl = document.createElement('div');
    _overlayEl.id = 'ub-video-patch-overlay';
    _overlayEl.innerHTML = [
      '<style>',
      '#ub-video-patch-overlay {',
      '  position: absolute; top: 0; left: 0; right: 0; bottom: 0;',
      '  background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0d1b2a 100%);',
      '  display: flex; flex-direction: column; align-items: center; justify-content: center;',
      '  z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  color: #e2e8f0; gap: 16px; padding: 20px;',
      '  animation: ub-fade-in 0.3s ease;',
      '}',
      '@keyframes ub-fade-in { from { opacity: 0; } to { opacity: 1; } }',
      '#ub-video-patch-overlay .ub-clock {',
      '  font-size: 48px; font-weight: 200; letter-spacing: 2px;',
      '  color: #38bdf8; text-shadow: 0 0 20px rgba(56,189,248,0.3);',
      '}',
      '#ub-video-patch-overlay .ub-date {',
      '  font-size: 16px; color: #64748b; font-weight: 400;',
      '}',
      '#ub-video-patch-overlay .ub-message {',
      '  font-size: 13px; color: #475569; margin-top: 8px;',
      '  display: flex; align-items: center; gap: 8px;',
      '}',
      '#ub-video-patch-overlay .ub-message .dot {',
      '  width: 8px; height: 8px; border-radius: 50%; background: #22c55e;',
      '  animation: ub-pulse 1.5s infinite;',
      '}',
      '@keyframes ub-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }',
      '#ub-video-patch-overlay .ub-stats {',
      '  display: flex; gap: 24px; margin-top: 12px;',
      '}',
      '#ub-video-patch-overlay .ub-stat {',
      '  text-align: center; padding: 12px 16px;',
      '  background: rgba(255,255,255,0.03); border-radius: 8px;',
      '  border: 1px solid rgba(255,255,255,0.06);',
      '}',
      '#ub-video-patch-overlay .ub-stat-value {',
      '  font-size: 20px; font-weight: 600; color: #a78bfa;',
      '}',
      '#ub-video-patch-overlay .ub-stat-label {',
      '  font-size: 10px; color: #64748b; text-transform: uppercase; margin-top: 4px;',
      '}',
      '#ub-video-patch-overlay .ub-tip {',
      '  position: absolute; bottom: 12px; font-size: 11px; color: #334155;',
      '}',
      '</style>',
      '<div class="ub-clock" id="ub-patch-clock">--:--:--</div>',
      '<div class="ub-date" id="ub-patch-date"></div>',
      '<div class="ub-stats">',
      '  <div class="ub-stat"><div class="ub-stat-value" id="ub-patch-blocked">0</div><div class="ub-stat-label">Ads Blocked</div></div>',
      '  <div class="ub-stat"><div class="ub-stat-value" id="ub-patch-time">0s</div><div class="ub-stat-label">Time Saved</div></div>',
      '  <div class="ub-stat"><div class="ub-stat-value" id="ub-patch-session">0m</div><div class="ub-stat-label">Session</div></div>',
      '</div>',
      '<div class="ub-message"><span class="dot"></span> UltraBlock is skipping this ad for you</div>',
      '<div class="ub-tip">Ad will be skipped automatically • Your audio is muted</div>',
    ].join('\n');

    return _overlayEl;
  }

  function updateOverlayClock() {
    var now = new Date();
    var clock = document.getElementById('ub-patch-clock');
    var date  = document.getElementById('ub-patch-date');
    if (clock) clock.textContent = now.toLocaleTimeString();
    if (date)  date.textContent = now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

    // Update session time
    var session = document.getElementById('ub-patch-session');
    if (session && window.__ubSessionStart) {
      var mins = Math.floor((Date.now() - window.__ubSessionStart) / 60000);
      session.textContent = mins + 'm';
    }
  }

  function updateOverlayStats() {
    try {
      chrome.runtime.sendMessage({ action: 'getStats' }, function(resp) {
        if (resp) {
          var blocked = document.getElementById('ub-patch-blocked');
          var timeSaved = document.getElementById('ub-patch-time');
          if (blocked) blocked.textContent = resp.totalBlocked || 0;
          if (timeSaved) timeSaved.textContent = Math.floor((resp.totalBlocked || 0) * 0.5) + 's';
        }
      });
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════
  //  SHOW / HIDE OVERLAY
  // ══════════════════════════════════════════════════════════════
  function showOverlay() {
    if (_overlayActive) return;

    var video = document.querySelector('video');
    if (!video) return;

    // FIX: Target the actual YouTube player container, not arbitrary video parent.
    // Setting position:relative on the wrong element can break YouTube's layout.
    var container = document.getElementById('movie_player') ||
                    document.querySelector('.html5-video-container') ||
                    (video.closest ? video.closest('[class*="player"]') : null) ||
                    video.parentElement;
    if (!container) return;

    // Mute the ad
    video.muted = true;
    video.volume = 0;

    // Only set position:relative if it's static (avoid overriding YouTube's own positioning)
    try {
      var pos = window.getComputedStyle(container).position;
      if (pos === 'static') container.style.position = 'relative';
    } catch (_) {}

    var overlay = createOverlay();
    container.appendChild(overlay);
    _overlayActive = true;

    // Start clock
    updateOverlayClock();
    updateOverlayStats();
    _clockInterval = setInterval(function() {
      updateOverlayClock();
    }, 1000);

    // Track session start
    if (!window.__ubSessionStart) window.__ubSessionStart = Date.now();
  }

  function hideOverlay() {
    if (!_overlayActive) return;
    _overlayActive = false;

    if (_overlayEl && _overlayEl.parentElement) {
      _overlayEl.remove();
    }
    if (_clockInterval) {
      clearInterval(_clockInterval);
      _clockInterval = null;
    }

    // Unmute video
    var video = document.querySelector('video');
    if (video) {
      video.muted = false;
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  AD DETECTION
  // ══════════════════════════════════════════════════════════════
  function isAdPlaying() {
    if (isYouTube) {
      return !!document.querySelector('.ad-showing, .ad-interrupting, .ytp-ad-player-overlay');
    }
    if (isTwitch) {
      return !!document.querySelector('[data-a-target="video-ad-countdown"], [class*="video-ads"]');
    }
    return false;
  }

  function checkAd() {
    if (isAdPlaying()) {
      showOverlay();
    } else {
      hideOverlay();
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════
  setInterval(checkAd, 500);

  // Also observe DOM for ad class changes
  var _observer = new MutationObserver(checkAd);
  function startObserver() {
    var player = document.getElementById('movie_player') || document.querySelector('[class*="player"]') || document.body;
    _observer.observe(player, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true });
  }

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

})();
