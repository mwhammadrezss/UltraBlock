/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Per-Site Switches Controller
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {
  const STORAGE_KEY = 'persite_switches';
  const DEFAULT_SWITCHES = {
    cosmetic: true,
    scriptlets: true,
    procedural: true,
    noFonts: false,
    noLargeMedia: false,
    no3pScripts: false,
    no3pFrames: false,
    noWebRTC: true,
    noPopups: true,
    removeParams: true,
    cookieNeg: true,
    darkPatterns: true,
    trackerPoison: true
  };

  let currentDomain = '';
  let siteSettings = {};

  // ── Get current tab domain ────────────────────────────────────────────
  function init() {
    const params = new URLSearchParams(window.location.search);
    currentDomain = params.get('domain') || '';

    if (!currentDomain) {
      // Try to get from active tab
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs[0] && tabs[0].url) {
          try {
            currentDomain = new URL(tabs[0].url).hostname;
          } catch (e) { currentDomain = 'unknown'; }
        }
        loadAndRender();
      });
    } else {
      loadAndRender();
    }
  }

  function loadAndRender() {
    document.getElementById('current-domain').textContent = currentDomain;
    document.getElementById('domain-icon').textContent = currentDomain.charAt(0).toUpperCase() || '🌐';
    loadSettings();
  }

  // ── Load per-site settings ────────────────────────────────────────────
  function loadSettings() {
    chrome.storage.local.get([STORAGE_KEY], result => {
      const allSites = result[STORAGE_KEY] || {};
      siteSettings = allSites[currentDomain] || { ...DEFAULT_SWITCHES };
      renderToggles();
    });
  }

  // ── Render toggle states ──────────────────────────────────────────────
  function renderToggles() {
    document.querySelectorAll('.toggle').forEach(el => {
      const key = el.dataset.switch;
      if (siteSettings[key]) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // ── Toggle click handlers ─────────────────────────────────────────────
  document.querySelectorAll('.toggle').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.switch;
      siteSettings[key] = !siteSettings[key];
      el.classList.toggle('active');
    });
  });

  // ── Save ──────────────────────────────────────────────────────────────
  document.getElementById('btn-save').addEventListener('click', () => {
    chrome.storage.local.get([STORAGE_KEY], result => {
      const allSites = result[STORAGE_KEY] || {};
      allSites[currentDomain] = siteSettings;
      chrome.storage.local.set({ [STORAGE_KEY]: allSites }, () => {
        // Notify background to apply changes
        chrome.runtime.sendMessage({
          action: 'perSiteSwitchesUpdated',
          domain: currentDomain,
          switches: siteSettings
        });
        const status = document.getElementById('status');
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 2000);
      });
    });
  });

  // ── Reset ─────────────────────────────────────────────────────────────
  document.getElementById('btn-reset').addEventListener('click', () => {
    siteSettings = { ...DEFAULT_SWITCHES };
    renderToggles();
  });

  init();
})();
