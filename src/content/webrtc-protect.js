/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — WebRTC Leak Protection
 *  Prevents real IP exposure through WebRTC even behind VPN/proxy.
 *  Controlled via chrome.storage: { webrtc_protection: true/false }
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  const STORAGE_KEY = 'webrtc_protection';
  const PERSITE_KEY = 'webrtc_persite'; // { "example.com": false } = disabled on that site

  // ── Check if protection is enabled ────────────────────────────────────
  function shouldProtect(callback) {
    const hostname = window.location.hostname;
    chrome.storage.local.get([STORAGE_KEY, PERSITE_KEY], result => {
      const globalEnabled = result[STORAGE_KEY] !== false; // Default: enabled
      const perSite = result[PERSITE_KEY] || {};
      // Per-site override
      if (perSite[hostname] === false) {
        callback(false);
      } else {
        callback(globalEnabled);
      }
    });
  }

  // ── Apply WebRTC protection ───────────────────────────────────────────
  function applyProtection() {
    const noop = function() {};

    // Store originals for potential restoration
    const OrigRTCPeerConnection = window.RTCPeerConnection;
    const OrigWebkitRTCPeerConnection = window.webkitRTCPeerConnection;

    /**
     * Proxy RTCPeerConnection to restrict ICE candidates.
     * We don't fully block it (breaks WebRTC-dependent sites),
     * instead we force relay-only mode (TURN) which hides local IPs.
     */
    function PatchedRTCPeerConnection(config, constraints) {
      // Force iceTransportPolicy to 'relay' — only use TURN servers
      // This prevents local/reflexive candidates from being gathered
      if (config) {
        config.iceTransportPolicy = 'relay';
      } else {
        config = { iceTransportPolicy: 'relay' };
      }

      // Remove any stun servers (they reveal public IP)
      if (config.iceServers) {
        config.iceServers = config.iceServers.filter(server => {
          const urls = Array.isArray(server.urls) ? server.urls : [server.urls || server.url];
          // Keep only TURN servers, remove STUN
          return urls.some(u => u && u.toLowerCase().startsWith('turn:'));
        });
      }

      const pc = new OrigRTCPeerConnection(config, constraints);
      return pc;
    }

    // Copy static properties and prototype
    PatchedRTCPeerConnection.prototype = OrigRTCPeerConnection.prototype;
    PatchedRTCPeerConnection.generateCertificate = OrigRTCPeerConnection.generateCertificate;

    // Override
    Object.defineProperty(window, 'RTCPeerConnection', {
      value: PatchedRTCPeerConnection,
      writable: false,
      configurable: true
    });

    // Also patch webkit prefix (older Chrome)
    if (OrigWebkitRTCPeerConnection) {
      Object.defineProperty(window, 'webkitRTCPeerConnection', {
        value: PatchedRTCPeerConnection,
        writable: false,
        configurable: true
      });
    }

    // ── Block navigator.mediaDevices.getUserMedia IP leak vector ──────
    // Some fingerprinting scripts use getUserMedia to trigger ICE gathering
    // We don't block it entirely, just ensure RTCPeerConnection is patched above

    console.log('[UltraBlock] WebRTC leak protection active (relay-only mode)');
  }

  // ── Message listener for toggle ───────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'getWebRTCStatus') {
      chrome.storage.local.get([STORAGE_KEY], result => {
        sendResponse({ enabled: result[STORAGE_KEY] !== false });
      });
      return true;
    }
    if (msg.action === 'toggleWebRTC') {
      const newState = msg.enabled !== undefined ? msg.enabled : true;
      chrome.storage.local.set({ [STORAGE_KEY]: newState }, () => {
        sendResponse({ enabled: newState, needsReload: true });
      });
      return true;
    }
    return false;
  });

  // ── Init ──────────────────────────────────────────────────────────────
  shouldProtect(enabled => {
    if (enabled) applyProtection();
  });

})();
