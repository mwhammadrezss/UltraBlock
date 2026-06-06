/**
 * UltraBlock — stealth.js v2.3
 * Runs in MAIN world at document_start (before any page script)
 * Anti-detection: Makes ad blocking completely invisible
 */
(function UltraBlockStealth() {
  'use strict';

  try {

  var HIDDEN_ATTR = 'data-ub-hidden';
  var WIDTH_ATTR  = 'data-ub-w';
  var HEIGHT_ATTR = 'data-ub-h';

  // ══════════════════════════════════════════════════════════════
  //  1. PROTOTYPE POISONING SHIELD
  // ══════════════════════════════════════════════════════════════
  var _nativeSet = new WeakSet();
  var _origFnToString = Function.prototype.toString;

  try {
    Object.defineProperty(Function.prototype, 'toString', {
      value: function toString() {
        if (_nativeSet.has(this)) {
          return 'function ' + (this.name || '') + '() { [native code] }';
        }
        return _origFnToString.call(this);
      },
      writable: true, configurable: true, enumerable: false
    });
    _nativeSet.add(Function.prototype.toString);
  } catch (_) {}

  function markNative(fn) { _nativeSet.add(fn); return fn; }

  function defWin(prop, value) {
    try {
      Object.defineProperty(window, prop, {
        value: value, writable: true, configurable: true, enumerable: false
      });
    } catch (_) {
      try { window[prop] = value; } catch (_2) {}
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  2. FAKE AD SDK OBJECTS
  // ══════════════════════════════════════════════════════════════

  // googletag
  if (!window.googletag) {
    try {
      var _cmdQueue = [];
      Object.defineProperty(_cmdQueue, 'push', {
        value: markNative(function push(fn) {
          if (typeof fn === 'function') { try { fn(); } catch (_) {} }
        }),
        writable: true, configurable: true, enumerable: false
      });

      var _pubadsObj = {
        enableSingleRequest: markNative(function() {}),
        collapseEmptyDivs: markNative(function() {}),
        disableInitialLoad: markNative(function() {}),
        setTargeting: markNative(function() { return _pubadsObj; }),
        clearTargeting: markNative(function() {}),
        refresh: markNative(function() {}),
        addEventListener: markNative(function() {}),
        removeEventListener: markNative(function() {}),
        getTargetingKeys: markNative(function() { return []; }),
        getTargeting: markNative(function() { return []; }),
        enableLazyLoad: markNative(function() {}),
        setCentering: markNative(function() {}),
        setPrivacySettings: markNative(function() {}),
        updateCorrelator: markNative(function() {}),
        setForceSafeFrame: markNative(function() {}),
        setRequestNonPersonalizedAds: markNative(function() {}),
        getSlots: markNative(function() { return []; }),
      };

      var _slotStub = {
        addService: markNative(function() { return _slotStub; }),
        setTargeting: markNative(function() { return _slotStub; }),
        defineSizeMapping: markNative(function() { return _slotStub; }),
        setCollapseEmptyDiv: markNative(function() { return _slotStub; }),
      };

      var _sizeMappingStub = {
        addSize: markNative(function() { return _sizeMappingStub; }),
        build: markNative(function() { return []; }),
      };

      defWin('googletag', {
        cmd: _cmdQueue,
        apiReady: true,
        pubadsReady: true,
        defineSlot: markNative(function() { return _slotStub; }),
        defineOutOfPageSlot: markNative(function() { return _slotStub; }),
        defineSizeMapping: markNative(function() { return _sizeMappingStub; }),
        companionAds: markNative(function() { return {}; }),
        pubads: markNative(function() { return _pubadsObj; }),
        enableServices: markNative(function() {}),
        display: markNative(function() {}),
        destroySlots: markNative(function() { return true; }),
        sizeMapping: markNative(function() { return _sizeMappingStub; }),
        setAdIframeTitle: markNative(function() {}),
        getVersion: markNative(function() { return '2024010101'; }),
        enums: { OutOfPageFormat: { BOTTOM_ANCHOR: 1, TOP_ANCHOR: 2, INTERSTITIAL: 3, REWARDED: 4 } }
      });
    } catch (_) {}
  }

  // adsbygoogle
  if (!window.adsbygoogle) {
    try {
      var _asgArr = [];
      Object.defineProperty(_asgArr, 'push', {
        value: markNative(function() {}),
        writable: true, configurable: true, enumerable: false
      });
      _asgArr.loaded = true;
      defWin('adsbygoogle', _asgArr);
    } catch (_) {}
  }

  // Google misc
  if (!window._gads) defWin('_gads', []);
  if (!window._googCsa) defWin('_googCsa', markNative(function() {}));
  if (!window.google_ad_modifications) defWin('google_ad_modifications', {});
  if (!window.google_reactive_ads_global_state) {
    defWin('google_reactive_ads_global_state', { num_modular_ads_on_page: 0 });
  }

  // Amazon Publisher Services
  if (!window.apstag) {
    defWin('apstag', {
      init: markNative(function() {}),
      fetchBids: markNative(function(cfg, cb) { if (typeof cb === 'function') cb([]); }),
      setDisplayBids: markNative(function() {}),
      targetingKeys: markNative(function() { return []; }),
    });
  }

  // Prebid.js
  if (!window.pbjs) {
    var _pbjsQue = [];
    Object.defineProperty(_pbjsQue, 'push', {
      value: markNative(function(fn) { try { if (typeof fn === 'function') fn(); } catch (_) {} }),
      writable: true, configurable: true, enumerable: false
    });
    defWin('pbjs', {
      que: _pbjsQue,
      requestBids: markNative(function(cfg) { if (cfg && typeof cfg.bidsBackHandler === 'function') cfg.bidsBackHandler({}); }),
      addAdUnits: markNative(function() {}),
      setConfig: markNative(function() {}),
      getConfig: markNative(function() { return {}; }),
      version: '8.0.0',
    });
  }

  // ══════════════════════════════════════════════════════════════
  //  3. DOM DIMENSION SPOOFING
  // ══════════════════════════════════════════════════════════════
  try {
    var _origGetBCR = Element.prototype.getBoundingClientRect;
    var _descOH = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
    var _descOW = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
    var _descCH = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');
    var _descCW = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth');

    function _sw(el) { return +(el.getAttribute(WIDTH_ATTR) || 300); }
    function _sh(el) { return +(el.getAttribute(HEIGHT_ATTR) || 250); }

    Element.prototype.getBoundingClientRect = markNative(function getBoundingClientRect() {
      if (this.hasAttribute && this.hasAttribute(HIDDEN_ATTR)) {
        var w = _sw(this), h = _sh(this);
        if (typeof DOMRectReadOnly !== 'undefined' && DOMRectReadOnly.fromRect) {
          return DOMRectReadOnly.fromRect({ x: 100, y: 100, width: w, height: h });
        }
        return { top: 100, left: 100, right: 100 + w, bottom: 100 + h,
                 width: w, height: h, x: 100, y: 100, toJSON: function() { return this; } };
      }
      return _origGetBCR.call(this);
    });

    if (_descOH && _descOH.get) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        get: markNative(function() {
          return (this.hasAttribute && this.hasAttribute(HIDDEN_ATTR)) ? _sh(this) : _descOH.get.call(this);
        }), configurable: true, enumerable: true
      });
    }
    if (_descOW && _descOW.get) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
        get: markNative(function() {
          return (this.hasAttribute && this.hasAttribute(HIDDEN_ATTR)) ? _sw(this) : _descOW.get.call(this);
        }), configurable: true, enumerable: true
      });
    }
    if (_descCH && _descCH.get) {
      Object.defineProperty(Element.prototype, 'clientHeight', {
        get: markNative(function() {
          return (this.hasAttribute && this.hasAttribute(HIDDEN_ATTR)) ? _sh(this) : _descCH.get.call(this);
        }), configurable: true, enumerable: true
      });
    }
    if (_descCW && _descCW.get) {
      Object.defineProperty(Element.prototype, 'clientWidth', {
        get: markNative(function() {
          return (this.hasAttribute && this.hasAttribute(HIDDEN_ATTR)) ? _sw(this) : _descCW.get.call(this);
        }), configurable: true, enumerable: true
      });
    }
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  4. getComputedStyle SPOOFING
  // ══════════════════════════════════════════════════════════════
  try {
    var _origGetCS = window.getComputedStyle;
    window.getComputedStyle = markNative(function getComputedStyle(el, pseudo) {
      var style = _origGetCS.call(window, el, pseudo);
      if (el && el.hasAttribute && el.hasAttribute(HIDDEN_ATTR)) {
        return new Proxy(style, {
          get: function(target, prop) {
            if (prop === 'visibility') return 'visible';
            if (prop === 'display') return 'block';
            if (prop === 'opacity') return '1';
            if (prop === 'pointerEvents') return 'auto';
            if (prop === 'height') return (_sh(el)) + 'px';
            if (prop === 'width') return (_sw(el)) + 'px';
            if (prop === 'getPropertyValue') {
              return markNative(function getPropertyValue(p) {
                if (p === 'visibility') return 'visible';
                if (p === 'display') return 'block';
                if (p === 'opacity') return '1';
                if (p === 'pointer-events') return 'auto';
                return target.getPropertyValue(p);
              });
            }
            var val = target[prop];
            return typeof val === 'function' ? val.bind(target) : val;
          }
        });
      }
      return style;
    });
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  5. ANTI-AAB NEUTRALIZER
  // ══════════════════════════════════════════════════════════════
  try {
    function _makeDummyAAB() {
      function DummyAAB() {}
      DummyAAB.prototype = {
        check: function() { return this; },
        onDetected: function() { return this; },
        onNotDetected: function(fn) { try { fn(); } catch (_) {} return this; },
        setOption: function() { return this; },
        setOptions: function() { return this; },
        clearDetected: function() { return this; },
        emitEvent: function() { return this; },
        on: function(e, fn) { if (e === 'notDetected' && typeof fn === 'function') { try { fn(); } catch(_) {} } return this; },
      };
      Object.assign(DummyAAB, DummyAAB.prototype);
      return DummyAAB;
    }

    var _dummyAAB = _makeDummyAAB();
    var _aabNames = [
      'FuckAdBlock', 'fuckAdBlock', 'fuckadblock',
      'BlockAdBlock', 'blockAdBlock', 'blockadblock',
      'AdBlockDetector', 'adBlockDetector',
      'adBlockDetect', 'AdBlockDetect',
      'detectAdBlock', 'DetectAdBlock',
      'noAdBlock', 'sniffAdBlock',
    ];

    for (var _i = 0; _i < _aabNames.length; _i++) {
      if (!window[_aabNames[_i]]) {
        try {
          Object.defineProperty(window, _aabNames[_i], {
            value: _dummyAAB, writable: true, configurable: true, enumerable: false
          });
        } catch (_) { try { window[_aabNames[_i]] = _dummyAAB; } catch (_2) {} }
      }
    }

    defWin('canRunAds', true);
    defWin('canRunAds_2', true);
    defWin('isAdBlockActive', false);
    defWin('adBlockNotDetected', true);
    defWin('adblockEnabled', false);
    defWin('ads_loaded', true);
    defWin('ad_block', false);
    defWin('isAdsLoaded', true);
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  6. FETCH / XHR INTERCEPTOR
  // ══════════════════════════════════════════════════════════════
  try {
    var _PROBES = [
      /pagefair\.com/i, /blockadblock/i, /fuckadblock/i,
      /anti[-_]?adblock/i, /adblock[-_]?detect/i, /adblock[-_]?check/i,
      /adsbygoogle\.js/i, /\/ads\/ad\.js/i, /\/ads\/adframe/i,
      /\/bait\.js/i, /detect[-_]?ads/i, /ad[-_]?recover/i,
      /admiral\.io/i, /sourcepoint/i, /pagead2\.googlesyndication/i,
    ];

    function _isProbe(url) {
      if (!url) return false;
      var s = (typeof url === 'string') ? url : (url && url.url) ? url.url : String(url);
      for (var j = 0; j < _PROBES.length; j++) {
        if (_PROBES[j].test(s)) return true;
      }
      return false;
    }

    var _fakeBody = '/* ad */\nwindow.ad_loaded=true;\nwindow.adsLoaded=true;';

    var _origFetch = window.fetch;
    if (typeof _origFetch === 'function') {
      window.fetch = markNative(function fetch(resource, init) {
        if (_isProbe(resource)) {
          return Promise.resolve(new Response(
            new Blob([_fakeBody], { type: 'text/javascript' }),
            { status: 200, statusText: 'OK', headers: new Headers({ 'Content-Type': 'text/javascript' }) }
          ));
        }
        return _origFetch.apply(this, arguments);
      });
    }

    var _origXHROpen = XMLHttpRequest.prototype.open;
    var _origXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = markNative(function open(method, url) {
      this._ubUrl = url;
      return _origXHROpen.apply(this, arguments);
    });

    XMLHttpRequest.prototype.send = markNative(function send() {
      if (_isProbe(this._ubUrl)) {
        var xhr = this;
        setTimeout(markNative(function() {
          try {
            Object.defineProperty(xhr, 'status', { value: 200, configurable: true });
            Object.defineProperty(xhr, 'readyState', { value: 4, configurable: true });
            Object.defineProperty(xhr, 'responseText', { value: _fakeBody, configurable: true });
            Object.defineProperty(xhr, 'response', { value: _fakeBody, configurable: true });
            if (typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange();
            if (typeof xhr.onload === 'function') xhr.onload({});
          } catch (_) {}
        }), 4);
        return;
      }
      return _origXHRSend.apply(this, arguments);
    });
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  7. SHADOW DOM FORCE-OPEN
  // ══════════════════════════════════════════════════════════════
  try {
    var _origAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = markNative(function attachShadow(init) {
      var safeInit = (init && typeof init === 'object')
        ? Object.assign({}, init, { mode: 'open' })
        : { mode: 'open' };
      return _origAttachShadow.call(this, safeInit);
    });
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  8. PERFORMANCE.NOW NOISE
  // ══════════════════════════════════════════════════════════════
  try {
    var _origPerfNow = performance.now.bind(performance);
    performance.now = markNative(function now() {
      return _origPerfNow() + (Math.random() * 0.1 - 0.05);
    });
  } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  9. NAVIGATOR.BRAVE SPOOFING
  // ══════════════════════════════════════════════════════════════
  try {
    Object.defineProperty(Navigator.prototype, 'brave', {
      get: markNative(function() { return undefined; }),
      configurable: true, enumerable: false
    });
  } catch (_) {}
  try { delete navigator.brave; } catch (_) {}

  // ══════════════════════════════════════════════════════════════
  //  10. querySelector / querySelectorAll OVERRIDE
  //      Filter out hidden ad elements from bait-check queries
  // ══════════════════════════════════════════════════════════════
  try {
    var _baitPatterns = /adsbygoogle|ad[-_]?slot|ad[-_]?unit|ad[-_]?container|ad[-_]?banner|carbonads|carbon-ad|banner[-_]?ad|sponsor|taboola|outbrain|div-gpt-ad|google_ads|adblock|ad[-_]?wrapper|ad[-_]?placeholder|advertisement/i;

    // --- querySelectorAll ---
    var _origDocQSA = Document.prototype.querySelectorAll;
    var _origElQSA  = Element.prototype.querySelectorAll;

    function _filterHiddenQSA(origFn, context, selector) {
      var result = origFn.call(context, selector);
      if (!_baitPatterns.test(selector)) return result;
      var filtered = [];
      for (var i = 0; i < result.length; i++) {
        if (!result[i].hasAttribute || !result[i].hasAttribute(HIDDEN_ATTR)) {
          filtered.push(result[i]);
        }
      }
      // Return array-like with NodeList-compatible iteration
      filtered.item = function(i) { return this[i] || null; };
      Object.defineProperty(filtered, 'length', { value: filtered.length, writable: false });
      try { Object.setPrototypeOf(filtered, NodeList.prototype); } catch(_) {}
      return filtered;
    }

    Document.prototype.querySelectorAll = markNative(function querySelectorAll(selector) {
      return _filterHiddenQSA(_origDocQSA, this, selector);
    });
    Element.prototype.querySelectorAll = markNative(function querySelectorAll(selector) {
      return _filterHiddenQSA(_origElQSA, this, selector);
    });

    // --- querySelector ---
    var _origDocQS = Document.prototype.querySelector;
    var _origElQS  = Element.prototype.querySelector;

    function _filterHiddenQS(origFn, context, selector) {
      var result = origFn.call(context, selector);
      if (!result) return result;
      if (!_baitPatterns.test(selector)) return result;
      if (result.hasAttribute && result.hasAttribute(HIDDEN_ATTR)) return null;
      return result;
    }

    Document.prototype.querySelector = markNative(function querySelector(selector) {
      return _filterHiddenQS(_origDocQS, this, selector);
    });
    Element.prototype.querySelector = markNative(function querySelector(selector) {
      return _filterHiddenQS(_origElQS, this, selector);
    });
  } catch (_) {}

  // Section 11 REMOVED: MutationObserver patching breaks YouTube & SPA frameworks

  //  SIGNAL
  // ══════════════════════════════════════════════════════════════
  defWin('__ubStealthActive', true);
  defWin('__ubFetchHooked', true);
  defWin('__ubXHRHooked', true);

  } catch (e) {
    try { console.warn('[UltraBlock stealth] init error:', e); } catch (_) {}
  }
})();
