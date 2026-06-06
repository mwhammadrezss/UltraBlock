/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Perceptual Ad Detection Engine
 *  Inspired by Princeton citp/ad-blocking & AlexPowell9/Adclipse.
 *  Uses lightweight heuristics (no TensorFlow) to detect ads
 *  visually: text patterns, standard sizes, AdChoices icons,
 *  and behavioral signals (rapid src rotation).
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  // ── Configuration ─────────────────────────────────────────────────────
  var STORAGE_KEY = 'perceptual_detection';
  var SCORE_THRESHOLD = 3;        // Minimum score to classify as ad
  var THROTTLE_MS = 2000;         // Max one scan pass per 2s
  var MAX_ELEMENTS_PER_PASS = 60; // Limit elements scanned per cycle
  var HIDDEN_ATTR = 'data-ub-perceptual';

  // Standard IAB ad unit sizes [width, height] with ±10px tolerance
  var AD_SIZES = [
    [300, 250], [728, 90], [160, 600], [320, 50], [970, 250],
    [300, 600], [336, 280], [250, 250], [468, 60], [120, 600],
    [970, 90], [320, 100], [300, 50], [300, 100], [480, 320]
  ];

  // Text patterns that indicate sponsored/ad content
  var AD_TEXT_PATTERNS = [
    /\bsponsored\b/i, /\badvertisement\b/i, /\b(ad|ads)\b/i,
    /\bpromoted\b/i, /\bpaid\s*(content|post|partnership)\b/i,
    /\badchoices\b/i, /\bad\s*choices\b/i,
    /\bpatrocinado\b/i, /\banzeige\b/i, /\bpubli(cité|cidad)\b/i,
    /افزوده/, /تبلیغ/, /حمایت\s*شده/
  ];

  // Selectors for known AdChoices-style disclosure elements
  var ADCHOICES_SELECTORS = [
    '[href*="adchoices"]', '[href*="aboutads.info"]',
    '[href*="youradchoices"]', '[aria-label*="AdChoices"]',
    '[title*="AdChoices"]', 'img[src*="adchoices"]',
    'img[src*="ad_choices"]', '[class*="adchoice"]'
  ];

  // ── State ─────────────────────────────────────────────────────────────
  var _enabled = true;
  var _lastScanTime = 0;
  var _scanTimer = null;
  var _observer = null;
  var _intersectionObserver = null;
  var _visibleElements = new WeakSet();
  var _processedElements = new WeakSet();
  var _srcChangeCount = new WeakMap(); // element → { count, lastTime }
  var _totalDetected = 0;

  // ══════════════════════════════════════════════════════════════════════
  //  SCORING ENGINE
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Score an element based on multiple perceptual signals.
   * Returns a number; higher = more likely an ad.
   */
  function scoreElement(el) {
    var score = 0;
    var rect = el.getBoundingClientRect();
    var w = Math.round(rect.width);
    var h = Math.round(rect.height);

    // Skip tiny or invisible elements
    if (w < 30 || h < 30) return 0;

    // ── Signal 1: Standard ad dimensions ────────────────────────────────
    for (var i = 0; i < AD_SIZES.length; i++) {
      var adW = AD_SIZES[i][0];
      var adH = AD_SIZES[i][1];
      if (Math.abs(w - adW) <= 10 && Math.abs(h - adH) <= 10) {
        score += 2;
        break;
      }
    }

    // ── Signal 2: Text content matching ─────────────────────────────────
    // Only check direct text (not deep children) to avoid false positives
    var textContent = getShallowText(el);
    if (textContent.length > 0 && textContent.length < 200) {
      for (var j = 0; j < AD_TEXT_PATTERNS.length; j++) {
        if (AD_TEXT_PATTERNS[j].test(textContent)) {
          score += 2;
          break;
        }
      }
    }

    // ── Signal 3: AdChoices icon/link presence ──────────────────────────
    var adchoicesQuery = ADCHOICES_SELECTORS.join(',');
    try {
      if (el.querySelector(adchoicesQuery)) {
        score += 3; // Very strong signal
      }
    } catch (_) {}

    // ── Signal 4: iframe with ad-like attributes ────────────────────────
    if (el.tagName === 'IFRAME') {
      var src = (el.src || '').toLowerCase();
      if (/ad|banner|sponsor|doubleclick|googlesyndication/.test(src)) {
        score += 2;
      }
      // Iframes with standard ad sizes get extra weight
      if (score > 0) score += 1;
    }

    // ── Signal 5: Behavioral — rapid src changes (rotating ads) ─────────
    var srcData = _srcChangeCount.get(el);
    if (srcData && srcData.count >= 3) {
      score += 2;
    }

    // ── Signal 6: Container class/id heuristics ─────────────────────────
    var idClass = ((el.id || '') + ' ' + (el.className || '')).toLowerCase();
    if (/\b(ad[-_]?container|ad[-_]?slot|ad[-_]?wrapper|ad[-_]?unit|banner[-_]?ad|sponsored[-_]?content)\b/.test(idClass)) {
      score += 1;
    }

    return score;
  }

  /**
   * Get text only from direct text nodes (not deep descendants).
   * Prevents scoring huge containers based on unrelated child text.
   */
  function getShallowText(el) {
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) { // TEXT_NODE
        text += node.textContent;
      } else if (node.nodeType === 1 && node.childNodes.length <= 2) {
        // Also check very small child elements (labels, badges)
        text += ' ' + (node.textContent || '').substring(0, 50);
      }
    }
    return text.trim().substring(0, 200);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SCAN & HIDE
  // ══════════════════════════════════════════════════════════════════════

  function runScan() {
    if (!_enabled) return;

    var now = Date.now();
    if (now - _lastScanTime < THROTTLE_MS) return;
    _lastScanTime = now;

    // Select candidate elements: divs, sections, asides, iframes of reasonable size
    var candidates = document.querySelectorAll(
      'div, section, aside, article, iframe, ins'
    );

    var detected = 0;
    var scanned = 0;

    for (var i = 0; i < candidates.length && scanned < MAX_ELEMENTS_PER_PASS; i++) {
      var el = candidates[i];

      // Skip already processed or already hidden
      if (_processedElements.has(el)) continue;
      if (el.hasAttribute(HIDDEN_ATTR)) continue;

      // Only scan visible elements
      if (!_visibleElements.has(el)) continue;

      scanned++;
      var score = scoreElement(el);

      if (score >= SCORE_THRESHOLD) {
        hideElement(el);
        detected++;
        _processedElements.add(el);
      } else if (score <= 0) {
        // Definitely not an ad — don't recheck
        _processedElements.add(el);
      }
      // Elements with 0 < score < threshold get rechecked next pass
    }

    if (detected > 0) {
      _totalDetected += detected;
      try {
        chrome.runtime.sendMessage({ action: 'incrementBlock', count: detected });
      } catch (_) {}
    }
  }

  function hideElement(el) {
    el.setAttribute(HIDDEN_ATTR, 'true');
    el.style.setProperty('display', 'none', 'important');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  OBSERVERS
  // ══════════════════════════════════════════════════════════════════════

  /** IntersectionObserver — track which elements are visible */
  function setupIntersectionObserver() {
    _intersectionObserver = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          _visibleElements.add(entries[i].target);
        } else {
          _visibleElements.delete(entries[i].target);
        }
      }
    }, { rootMargin: '200px' }); // Pre-scan elements 200px before viewport

    // Observe all candidate containers
    var els = document.querySelectorAll('div, section, aside, iframe, ins');
    for (var i = 0; i < els.length; i++) {
      _intersectionObserver.observe(els[i]);
    }
  }

  /** MutationObserver — detect new elements and src changes */
  function setupMutationObserver() {
    _observer = new MutationObserver(function(mutations) {
      var hasNew = false;

      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];

        // Track src attribute changes (behavioral signal)
        if (m.type === 'attributes' && m.attributeName === 'src') {
          var target = m.target;
          var data = _srcChangeCount.get(target) || { count: 0, lastTime: 0 };
          var now = Date.now();
          // Only count rapid changes (within 10s)
          if (now - data.lastTime < 10000) {
            data.count++;
          } else {
            data.count = 1;
          }
          data.lastTime = now;
          _srcChangeCount.set(target, data);
        }

        // New nodes added
        if (m.type === 'childList' && m.addedNodes.length > 0) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType === 1 && _intersectionObserver) {
              _intersectionObserver.observe(node);
              hasNew = true;
            }
          }
        }
      }

      if (hasNew) scheduleScan();
    });

    _observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
  }

  /** Schedule a throttled scan */
  function scheduleScan() {
    if (_scanTimer) return;
    _scanTimer = setTimeout(function() {
      _scanTimer = null;
      runScan();
    }, THROTTLE_MS);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════════════

  function init() {
    chrome.storage.local.get([STORAGE_KEY], function(result) {
      _enabled = result[STORAGE_KEY] !== false; // Default: enabled
      if (!_enabled) return;

      setupIntersectionObserver();
      setupMutationObserver();

      // Initial scan after a short delay (let page settle)
      setTimeout(runScan, 1000);
    });
  }

  // Listen for toggle messages
  try {
    chrome.runtime.onMessage.addListener(function(msg, _sender, sendResponse) {
      if (msg.action === 'togglePerceptualDetection') {
        _enabled = msg.enabled !== undefined ? msg.enabled : !_enabled;
        chrome.storage.local.set({ [STORAGE_KEY]: _enabled });
        sendResponse({ enabled: _enabled });
      }
      if (msg.action === 'getPerceptualStats') {
        sendResponse({ detected: _totalDetected, enabled: _enabled });
      }
    });
  } catch (_) {}

  // Start
  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init, { once: true });
  }

})();
