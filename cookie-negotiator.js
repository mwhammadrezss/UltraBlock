/**
 * UltraBlock — cookie-negotiator.js v2.3
 * AI Cookie Negotiator: Auto-rejects tracking cookies, keeps only essential ones.
 * Clicks "Manage/Customize" → deactivates all tracking → submits.
 * Runs in ISOLATED world.
 */
'use strict';

(function UltraCookieNegotiator() {

  // Skip if already handled
  if (window.__ubCookieNegotiatorRan) return;
  window.__ubCookieNegotiatorRan = true;

  var MAX_ATTEMPTS = 15;
  var ATTEMPT_DELAY = 800;
  var _attempts = 0;
  var _done = false;

  // ── Known consent platforms and their reject/manage patterns ──────────────
  var CONSENT_PLATFORMS = {
    // OneTrust
    onetrust: {
      detect: '#onetrust-banner-sdk, #onetrust-consent-sdk',
      rejectBtn: '#onetrust-reject-all-handler, .ot-pc-refuse-all-handler',
      manageBtn: '#onetrust-pc-btn-handler, .ot-sdk-show-settings',
      toggleOff: '.ot-switch-nob input[type="checkbox"]:checked:not([disabled])',
      saveBtn: '.save-preference-btn-handler, #accept-recommended-btn-handler',
      essentialKeep: '.ot-always-active',
    },
    // Cookiebot
    cookiebot: {
      detect: '#CybotCookiebotDialog, #CybotCookiebotDialogBody',
      rejectBtn: '#CybotCookiebotDialogBodyButtonDecline, #CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
      manageBtn: '#CybotCookiebotDialogBodyLevelButtonCustomize',
      toggleOff: '#CybotCookiebotDialogBodyLevelButtonPreferences, #CybotCookiebotDialogBodyLevelButtonStatistics, #CybotCookiebotDialogBodyLevelButtonMarketing',
      saveBtn: '#CybotCookiebotDialogBodyLevelButtonAccept, #CybotCookiebotDialogBodyButtonAcceptSelected',
    },
    // TrustArc / TRUSTe
    trustarc: {
      detect: '#truste-consent-track, .truste_box_overlay',
      rejectBtn: '.truste-consent-required',
      manageBtn: '#truste-show-consent',
      toggleOff: null,
      saveBtn: '.truste-consent-close',
    },
    // Quantcast / TCF2
    quantcast: {
      detect: '#qc-cmp2-container, .qc-cmp2-container',
      rejectBtn: '[mode="secondary"]:not([class*="manage"]), button[class*="reject"]',
      manageBtn: '[mode="link"], [class*="manage"]',
      toggleOff: 'input[type="checkbox"]:checked',
      saveBtn: '[mode="primary"], button[class*="save"]',
    },
    // SourcePoint (used by Guardian, Bloomberg, etc.)
    sourcepoint: {
      detect: 'iframe[title*="SP Consent"], [id*="sp_message"], .sp_choice_type_11',
      rejectBtn: '.sp_choice_type_12, [class*="sp_choice_type_REJECT"], button[title="Reject"]',
      manageBtn: '.sp_choice_type_12, .sp_choice_type_13, [class*="sp_choice_type_SAVE"]',
      toggleOff: null,
      saveBtn: '.sp_choice_type_SAVE_AND_EXIT, [class*="sp_choice_type_11"]',
    },
    // Generic (most common patterns)
    generic: {
      detect: '[class*="cookie-banner"], [class*="cookie-consent"], [class*="consent-banner"], [id*="cookie-banner"], [id*="cookie-consent"], [id*="consent-banner"], [class*="gdpr"], [id*="gdpr"]',
      rejectBtn: null,
      manageBtn: null,
      toggleOff: null,
      saveBtn: null,
    },
  };

  // ── Button text patterns for different actions ───────────────────────────
  var REJECT_TEXTS = /^(reject all|decline all|deny all|refuse all|ablehnen|alle ablehnen|tout refuser|refuser tout|rechazar todo|reject|decline|deny|refuse|رد همه|نپذیرفتن)$/i;
  var MANAGE_TEXTS = /^(manage|customize|settings|preferences|more options|cookie settings|manage cookies|manage preferences|تنظیمات|پیشرفته|إعدادات)$/i;
  var NECESSARY_ONLY_TEXTS = /^(only necessary|necessary only|essential only|only essential|فقط ضروری|strictly necessary)$/i;
  var SAVE_TEXTS = /^(save|confirm|save settings|save preferences|confirm choices|ذخیره|تایید)$/i;

  // ══════════════════════════════════════════════════════════════
  //  STRATEGY 1: Quick Reject — Try "Reject All" or "Only Necessary" button
  // ══════════════════════════════════════════════════════════════
  function tryQuickReject() {
    // Try platform-specific reject buttons first
    for (var platform in CONSENT_PLATFORMS) {
      var p = CONSENT_PLATFORMS[platform];
      if (!p.detect || !document.querySelector(p.detect)) continue;

      if (p.rejectBtn) {
        var btn = document.querySelector(p.rejectBtn);
        if (btn && isVisible(btn)) {
          btn.click();
          return true;
        }
      }
    }

    // Try generic text-based reject buttons
    var allButtons = document.querySelectorAll('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"]');
    for (var i = 0; i < allButtons.length; i++) {
      var txt = getButtonText(allButtons[i]);
      if ((REJECT_TEXTS.test(txt) || NECESSARY_ONLY_TEXTS.test(txt)) && isVisible(allButtons[i]) && isInConsentContext(allButtons[i])) {
        allButtons[i].click();
        return true;
      }
    }
    return false;
  }

  // ══════════════════════════════════════════════════════════════
  //  STRATEGY 2: Deep Negotiate — Open settings, deactivate all, save
  // ══════════════════════════════════════════════════════════════
  function tryDeepNegotiate() {
    // Find and click "Manage/Customize" button
    for (var platform in CONSENT_PLATFORMS) {
      var p = CONSENT_PLATFORMS[platform];
      if (!p.detect || !document.querySelector(p.detect)) continue;

      if (p.manageBtn) {
        var manageBtn = document.querySelector(p.manageBtn);
        if (manageBtn && isVisible(manageBtn)) {
          manageBtn.click();
          // Wait for settings panel to open, then deactivate
          setTimeout(function() { deactivateAndSave(platform); }, 600);
          return true;
        }
      }
    }

    // Generic: find manage button by text
    var allButtons = document.querySelectorAll('button, a[role="button"], [role="button"], a');
    for (var i = 0; i < allButtons.length; i++) {
      var txt = getButtonText(allButtons[i]);
      if (MANAGE_TEXTS.test(txt) && isVisible(allButtons[i]) && isInConsentContext(allButtons[i])) {
        allButtons[i].click();
        setTimeout(function() { deactivateAndSave('generic'); }, 600);
        return true;
      }
    }
    return false;
  }

  function deactivateAndSave(platform) {
    // Uncheck all non-essential checkboxes/toggles
    var checkboxes = document.querySelectorAll(
      'input[type="checkbox"]:checked:not([disabled]), ' +
      '[role="switch"][aria-checked="true"]:not([aria-disabled="true"]), ' +
      '.toggle-switch.active:not(.disabled), ' +
      '[class*="toggle"][class*="active"]:not([class*="disabled"]):not([class*="essential"]):not([class*="necessary"])'
    );

    for (var i = 0; i < checkboxes.length; i++) {
      var cb = checkboxes[i];
      // Skip "essential" / "necessary" / "strictly necessary" checkboxes
      var label = getAssociatedLabel(cb);
      if (/essential|necessary|erforderlich|nécessaire|necesarias|ضروری/i.test(label)) continue;
      if (cb.disabled) continue;

      try { cb.click(); } catch (_) {}
    }

    // Also try unchecking via platform-specific selectors
    var p = CONSENT_PLATFORMS[platform];
    if (p && p.toggleOff) {
      var toggles = document.querySelectorAll(p.toggleOff);
      for (var j = 0; j < toggles.length; j++) {
        var label2 = getAssociatedLabel(toggles[j]);
        if (/essential|necessary|erforderlich|nécessaire|necesarias|ضروری/i.test(label2)) continue;
        try { toggles[j].click(); } catch (_) {}
      }
    }

    // Now click Save/Confirm
    setTimeout(function() {
      // Platform-specific save
      if (p && p.saveBtn) {
        var saveBtn = document.querySelector(p.saveBtn);
        if (saveBtn && isVisible(saveBtn)) { saveBtn.click(); return; }
      }

      // Generic save by text
      var allButtons = document.querySelectorAll('button, a[role="button"], [role="button"], input[type="submit"]');
      for (var k = 0; k < allButtons.length; k++) {
        var txt = getButtonText(allButtons[k]);
        if (SAVE_TEXTS.test(txt) && isVisible(allButtons[k])) {
          allButtons[k].click();
          return;
        }
      }
    }, 400);
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════
  function isVisible(el) {
    if (!el) return false;
    try {
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      var style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      return true;
    } catch (_) { return false; }
  }

  function getButtonText(el) {
    return (el.textContent || el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
  }

  function isInConsentContext(el) {
    // Check if button is inside a cookie/consent container
    var parent = el;
    for (var i = 0; i < 10 && parent; i++) {
      var cls = (parent.className || '') + ' ' + (parent.id || '');
      if (/cookie|consent|gdpr|privacy|banner|notice|onetrust|cookiebot|truste|quantcast/i.test(cls)) return true;
      parent = parent.parentElement;
    }
    return false;
  }

  function getAssociatedLabel(input) {
    // Get label text for a checkbox/toggle
    var id = input.id;
    if (id) {
      var label = document.querySelector('label[for="' + id + '"]');
      if (label) return label.textContent || '';
    }
    // Check parent/sibling text
    var parent = input.parentElement;
    if (parent) return parent.textContent || '';
    return '';
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN LOOP
  // ══════════════════════════════════════════════════════════════
  function run() {
    if (_done || _attempts >= MAX_ATTEMPTS) return;
    _attempts++;

    // First try quick reject
    if (tryQuickReject()) {
      _done = true;
      return;
    }

    // Then try deep negotiate
    if (tryDeepNegotiate()) {
      _done = true;
      return;
    }

    // Retry after delay (banners often appear with delay)
    if (_attempts < MAX_ATTEMPTS) {
      setTimeout(run, ATTEMPT_DELAY);
    }
  }

  // Start after a short delay (let banner render)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(run, 500); });
  } else {
    setTimeout(run, 500);
  }

  // Also watch for dynamically injected banners
  var _observer = new MutationObserver(function() {
    if (!_done && _attempts < MAX_ATTEMPTS) {
      setTimeout(run, 300);
    }
  });
  if (document.body) {
    _observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      _observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Handle SourcePoint iframe-based consent (Guardian, etc.)
  function handleSourcePointIframe() {
    var spFrames = document.querySelectorAll('iframe[title*="SP Consent"], iframe[title*="privacy"]');
    spFrames.forEach(function(frame) {
      try {
        var frameDoc = frame.contentDocument || frame.contentWindow.document;
        if (!frameDoc) return;
        // Try to find reject button inside the iframe
        var rejectBtns = frameDoc.querySelectorAll('button[title*="Reject"], button[title*="refuse"], [class*="sp_choice_type_12"]');
        for (var i = 0; i < rejectBtns.length; i++) {
          if (rejectBtns[i].offsetWidth > 0) {
            rejectBtns[i].click();
            _done = true;
            return;
          }
        }
      } catch(e) {
        // Cross-origin iframe — can't access. Remove the overlay instead.
        var overlay = document.querySelector('[id*="sp_message_container"], .sp_message_open');
        if (overlay) overlay.remove();
        // Remove body classes that block scroll
        document.body.classList.remove('sp_message_open');
        document.documentElement.style.removeProperty('overflow');
        document.body.style.removeProperty('overflow');
      }
    });
  }
  
  // Try SP handling after initial run
  setTimeout(handleSourcePointIframe, 2000);
  setTimeout(handleSourcePointIframe, 5000);

  // Stop observer after 30 seconds
  setTimeout(function() { _observer.disconnect(); }, 30000);

})();
