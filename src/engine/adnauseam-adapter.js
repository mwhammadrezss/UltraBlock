/**
 * UltraBlock — AdNauseam Adapter (Lightweight Click Obfuscation)
 * Concept: Detect ads → fake-click them → store in vault → drain ad budgets
 * This is a standalone adapter, NOT dependent on the full uBlock/AdNauseam tree.
 */
'use strict';

var UBAdNauseam = (function () {
  var _enabled = false;
  var _vault = [];        // Collected ads
  var _totalClicked = 0;
  var _totalFound = 0;
  var _estimatedDrain = 0; // Estimated budget drained in cents

  // Ad selectors for detection
  var AD_SELECTORS = [
    'a[href*="doubleclick.net"]',
    'a[href*="googleadservices.com"]',
    'a[href*="googlesyndication.com"]',
    'a[href*="adclick"]',
    'a[href*="click."]',
    'ins.adsbygoogle',
    '[data-ad-slot]',
    '[data-ad-client]',
    '.ad-container a',
    '.advertisement a',
    '[id*="google_ads"] a',
    'iframe[src*="doubleclick"]',
    'iframe[src*="googlesyndication"]',
  ];

  // Average CPC estimates by category (in cents)
  var CPC_ESTIMATES = {
    google: 85,    // avg Google Ads CPC ~$0.85
    facebook: 65,  
    generic: 40,
    display: 15,
  };

  function init() {
    return chrome.storage.local.get(['adnauseam_enabled', 'adnauseam_vault', 'adnauseam_stats']).then(function (data) {
      _enabled = !!data.adnauseam_enabled;
      _vault = data.adnauseam_vault || [];
      var stats = data.adnauseam_stats || {};
      _totalClicked = stats.totalClicked || 0;
      _totalFound = stats.totalFound || 0;
      _estimatedDrain = stats.estimatedDrain || 0;
      console.log('[UltraBlock/AdNauseam] Init: enabled=' + _enabled + ', vault=' + _vault.length + ' ads');
    }).catch(function () {});
  }

  function enable() {
    _enabled = true;
    chrome.storage.local.set({ adnauseam_enabled: true }).catch(function () {});
    console.log('[UltraBlock/AdNauseam] Enabled');
  }

  function disable() {
    _enabled = false;
    chrome.storage.local.set({ adnauseam_enabled: false }).catch(function () {});
    console.log('[UltraBlock/AdNauseam] Disabled');
  }

  function isEnabled() { return _enabled; }

  function getVault() {
    return {
      ads: _vault.slice(-200), // Last 200 ads
      stats: {
        totalFound: _totalFound,
        totalClicked: _totalClicked,
        estimatedDrain: _estimatedDrain,
        vaultSize: _vault.length,
      }
    };
  }

  function clearVault() {
    _vault = [];
    _totalClicked = 0;
    _totalFound = 0;
    _estimatedDrain = 0;
    chrome.storage.local.set({
      adnauseam_vault: [],
      adnauseam_stats: { totalClicked: 0, totalFound: 0, estimatedDrain: 0 }
    }).catch(function () {});
  }

  // Called from content script when ad is detected
  function reportAd(adInfo) {
    if (!_enabled) return;
    _totalFound++;

    var ad = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 6),
      url: adInfo.url || '',
      title: adInfo.title || 'Unknown Ad',
      domain: adInfo.domain || '',
      page: adInfo.page || '',
      found: Date.now(),
      clicked: false,
      clickedAt: null,
      category: categorizeAd(adInfo.url || ''),
    };

    _vault.push(ad);

    // Auto-click if enabled
    simulateClick(ad);

    // Persist (debounced)
    _saveDebounced();
  }

  function categorizeAd(url) {
    if (url.indexOf('google') !== -1 || url.indexOf('doubleclick') !== -1) return 'google';
    if (url.indexOf('facebook') !== -1 || url.indexOf('fb.com') !== -1) return 'facebook';
    if (url.indexOf('display') !== -1 || url.indexOf('banner') !== -1) return 'display';
    return 'generic';
  }

  function simulateClick(ad) {
    if (!_enabled) return;

    // Simulate the click via a hidden fetch (no navigation)
    // This drains the advertiser's budget without user seeing anything
    if (ad.url && ad.url.indexOf('http') === 0) {
      // Use a randomized delay to appear more human-like
      var delay = 500 + Math.random() * 3000;
      setTimeout(function () {
        fetch(ad.url, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'follow',
          headers: {
            'User-Agent': navigator.userAgent,
          }
        }).then(function () {
          ad.clicked = true;
          ad.clickedAt = Date.now();
          _totalClicked++;
          _estimatedDrain += CPC_ESTIMATES[ad.category] || CPC_ESTIMATES.generic;
          _saveDebounced();
        }).catch(function () {
          // Click failed silently — that's fine
          ad.clicked = true;
          ad.clickedAt = Date.now();
          _totalClicked++;
          _estimatedDrain += Math.floor((CPC_ESTIMATES[ad.category] || CPC_ESTIMATES.generic) * 0.3);
          _saveDebounced();
        });
      }, delay);
    }
  }

  var _saveTimer = null;
  function _saveDebounced() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(function () {
      _saveTimer = null;
      // Keep vault trimmed to last 1000 ads
      if (_vault.length > 1000) _vault = _vault.slice(-1000);
      chrome.storage.local.set({
        adnauseam_vault: _vault,
        adnauseam_stats: {
          totalClicked: _totalClicked,
          totalFound: _totalFound,
          estimatedDrain: _estimatedDrain,
        }
      }).catch(function () {});
    }, 3000);
  }

  function getSelectors() { return AD_SELECTORS; }

  return {
    init: init,
    enable: enable,
    disable: disable,
    isEnabled: isEnabled,
    getVault: getVault,
    clearVault: clearVault,
    reportAd: reportAd,
    getSelectors: getSelectors,
  };
})();
