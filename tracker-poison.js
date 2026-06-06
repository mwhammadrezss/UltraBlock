/**
 * UltraBlock — tracker-poison.js v2.3
 * Active Tracker Poisoning: Instead of blocking trackers (which triggers
 * anti-adblock walls), we ALLOW tracking scripts to run but feed them
 * completely fake, random, inconsistent data.
 * 
 * Result: Sites don't detect blocking, but ad profiles become useless.
 * Runs in MAIN world (needs access to real window context).
 */
(function UltraTrackerPoison() {
  'use strict';

  if (window.__ubTrackerPoisonRan) return;
  window.__ubTrackerPoisonRan = true;

  // ══════════════════════════════════════════════════════════════
  //  FAKE IDENTITY GENERATOR
  // ══════════════════════════════════════════════════════════════
  var COUNTRIES = ['US','DE','JP','BR','IN','NG','KR','FR','AU','MX','CA','GB','IT','ES','NL','SE','PL','AR','TH','EG'];
  var LANGUAGES = ['en','de','ja','pt','hi','fr','ko','it','es','nl','sv','pl','ar','th','zh'];
  var GENDERS = ['male','female','other','prefer_not_to_say'];
  var AGES = [14,18,22,25,30,35,42,50,55,60,67,72,80];
  var INTERESTS = ['cooking','gaming','politics','fitness','travel','crypto','fashion','music','sports','tech','art','gardening','pets','diy','anime','cars','finance','meditation','photography','science'];
  var REFERRERS = ['https://www.google.com/','https://t.co/abc','https://www.facebook.com/','https://www.reddit.com/','https://news.ycombinator.com/','','https://duckduckgo.com/','https://www.bing.com/'];
  var SCREEN_SIZES = [[1920,1080],[1366,768],[1440,900],[2560,1440],[1280,720],[3840,2160],[1680,1050]];
  var PLATFORMS = ['Win32','MacIntel','Linux x86_64','iPhone','Android'];

  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function randomHex(len) { var s = ''; for (var i = 0; i < len; i++) s += Math.floor(Math.random()*16).toString(16); return s; }

  // Generate a completely fake user profile (changes on every page load)
  var FAKE_PROFILE = {
    country: randomItem(COUNTRIES),
    language: randomItem(LANGUAGES),
    gender: randomItem(GENDERS),
    age: randomItem(AGES),
    interests: [randomItem(INTERESTS), randomItem(INTERESTS), randomItem(INTERESTS)],
    screen: randomItem(SCREEN_SIZES),
    platform: randomItem(PLATFORMS),
    referrer: randomItem(REFERRERS),
    sessionId: randomHex(32),
    clientId: randomHex(16) + '.' + randomHex(16),
    fbp: 'fb.1.' + Date.now() + '.' + randomInt(1000000000, 9999999999),
    fbclid: randomHex(40),
  };

  // ══════════════════════════════════════════════════════════════
  //  1. GOOGLE ANALYTICS POISONING
  //     Intercept GA data layer and inject fake properties
  // ══════════════════════════════════════════════════════════════
  function poisonGoogleAnalytics() {
    // Fake dataLayer events
    if (!window.dataLayer) window.dataLayer = [];
    var _origPush = window.dataLayer.push;

    window.dataLayer.push = function() {
      // Modify each event with fake data
      for (var i = 0; i < arguments.length; i++) {
        var item = arguments[i];
        if (typeof item === 'object' && item !== null) {
          // Inject fake user properties
          item.user_properties = item.user_properties || {};
          item.user_properties.age_group = { value: FAKE_PROFILE.age < 25 ? '18-24' : FAKE_PROFILE.age < 35 ? '25-34' : '55-64' };
          item.user_properties.gender = { value: FAKE_PROFILE.gender };
          item.user_properties.interests = { value: FAKE_PROFILE.interests.join(',') };

          // Fake geographic data
          if (item.event === 'page_view' || !item.event) {
            item.geo = { country: FAKE_PROFILE.country, region: 'XX' };
            item.page_referrer = FAKE_PROFILE.referrer;
          }
        }
      }
      return _origPush.apply(window.dataLayer, arguments);
    };

    // Fake ga() tracker
    if (window.ga) {
      var _origGa = window.ga;
      window.ga = function() {
        var args = Array.prototype.slice.call(arguments);
        // Modify 'set' commands
        if (args[0] === 'set') {
          // Intercept and replace with fake data
          if (args[1] === 'userId') args[2] = FAKE_PROFILE.clientId;
          if (args[1] === 'dimension1') args[2] = FAKE_PROFILE.gender;
        }
        return _origGa.apply(window, args);
      };
    }

    // Fake _gaq (legacy GA)
    if (window._gaq) {
      window._gaq.push(['_setCustomVar', 1, 'UserType', randomItem(['new','returning','premium','free']), 2]);
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  2. FACEBOOK PIXEL POISONING
  //     Send fake user data and events to FB pixel
  // ══════════════════════════════════════════════════════════════
  function poisonFacebookPixel() {
    if (!window.fbq) return;

    var _origFbq = window.fbq;
    window.fbq = function() {
      var args = Array.prototype.slice.call(arguments);
      // Inject fake advanced matching data
      if (args[0] === 'init') {
        if (!args[2]) args[2] = {};
        args[2].em = randomHex(8) + '@' + randomItem(['gmail.com','outlook.com','yahoo.co.jp','mail.ru']);
        args[2].fn = randomItem(['john','maria','yuki','carlos','priya','olga','kim','ahmed']);
        args[2].ct = randomItem(['tokyo','berlin','lagos','mumbai','sao_paulo','cairo','seoul']);
        args[2].country = FAKE_PROFILE.country.toLowerCase();
        args[2].ge = FAKE_PROFILE.gender[0];
        args[2].db = String(2024 - FAKE_PROFILE.age) + '0101';
      }
      // Modify events with fake properties
      if (args[0] === 'track' || args[0] === 'trackCustom') {
        if (!args[2]) args[2] = {};
        args[2].content_category = randomItem(INTERESTS);
        args[2].value = randomInt(1, 500);
        args[2].currency = randomItem(['USD','EUR','JPY','BRL','INR']);
      }
      return _origFbq.apply(window, args);
    };

    // Spoof _fbp cookie
    try {
      document.cookie = '_fbp=' + FAKE_PROFILE.fbp + '; path=/; max-age=7776000';
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════
  //  3. GENERIC TRACKER XHR/FETCH POISONING
  //     Intercept tracking beacons and modify their payloads
  // ══════════════════════════════════════════════════════════════
  function poisonBeacons() {
    // Hook sendBeacon — handle all data types
    var _origBeacon = navigator.sendBeacon;
    if (_origBeacon) {
      navigator.sendBeacon = function(url, data) {
        if (isTrackingUrl(url)) {
          try {
            if (typeof data === 'string') {
              var params = new URLSearchParams(data);
              params.set('uid', FAKE_PROFILE.clientId);
              params.set('age', String(FAKE_PROFILE.age));
              params.set('gender', FAKE_PROFILE.gender);
              params.set('geo', FAKE_PROFILE.country);
              data = params.toString();
            } else if (data instanceof URLSearchParams) {
              data.set('uid', FAKE_PROFILE.clientId);
              data.set('age', String(FAKE_PROFILE.age));
              data.set('gender', FAKE_PROFILE.gender);
            } else if (data instanceof FormData) {
              data.set('uid', FAKE_PROFILE.clientId);
              data.set('age', String(FAKE_PROFILE.age));
              data.set('gender', FAKE_PROFILE.gender);
            } else if (data instanceof Blob && data.type && data.type.indexOf('form') !== -1) {
              // For url-encoded blobs, reconstruct with fake data
              // (leave binary blobs untouched)
              data = new Blob([FAKE_PROFILE.clientId], { type: data.type });
            }
          } catch (_) {}
        }
        return _origBeacon.call(navigator, url, data);
      };
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  4. FINGERPRINT RANDOMIZATION
  //     Randomize browser fingerprint properties
  // ══════════════════════════════════════════════════════════════
  function randomizeFingerprint() {
    var screen = FAKE_PROFILE.screen;

    // Generate stable values ONCE (same for entire session)
    var _fakeColorDepth = randomItem([24, 32]);
    var _fakeHwConcurrency = randomItem([2, 4, 8, 12, 16]);
    var _fakeDeviceMemory = randomItem([2, 4, 8, 16]);

    // Fake screen dimensions
    try {
      Object.defineProperty(window.screen, 'width',  { get: function() { return screen[0]; }, configurable: true });
      Object.defineProperty(window.screen, 'height', { get: function() { return screen[1]; }, configurable: true });
      Object.defineProperty(window.screen, 'availWidth',  { get: function() { return screen[0]; }, configurable: true });
      Object.defineProperty(window.screen, 'availHeight', { get: function() { return screen[1] - 40; }, configurable: true });
      Object.defineProperty(window.screen, 'colorDepth',  { get: function() { return _fakeColorDepth; }, configurable: true });
    } catch (_) {}

    // Fake hardware concurrency (stable per session)
    try {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: function() { return _fakeHwConcurrency; }, configurable: true });
    } catch (_) {}

    // Fake device memory (stable per session)
    try {
      Object.defineProperty(navigator, 'deviceMemory', { get: function() { return _fakeDeviceMemory; }, configurable: true });
    } catch (_) {}

    // Add slight noise to canvas fingerprint (multiple pixels)
    try {
      var _origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
        if (this.width > 0 && this.height > 0 && this.width < 500 && this.height < 200) {
          try {
            var tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.width;
            tempCanvas.height = this.height;
            var tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.drawImage(this, 0, 0);
              // Modify 3-5 random pixels for effective fingerprint noise
              var numPixels = 3 + Math.floor(Math.random() * 3);
              for (var px = 0; px < numPixels; px++) {
                var rx = Math.floor(Math.random() * this.width);
                var ry = Math.floor(Math.random() * this.height);
                var imgData = tempCtx.getImageData(rx, ry, 1, 1);
                imgData.data[0] = (imgData.data[0] + randomInt(-2, 2)) & 0xFF;
                imgData.data[1] = (imgData.data[1] + randomInt(-1, 1)) & 0xFF;
                imgData.data[2] = (imgData.data[2] + randomInt(-1, 1)) & 0xFF;
                tempCtx.putImageData(imgData, rx, ry);
              }
              return _origToDataURL.call(tempCanvas, type, quality);
            }
          } catch (_) {}
        }
        return _origToDataURL.apply(this, arguments);
      };
    } catch (_) {}

    // WebGL fingerprint noise (stable per session)
    var _fakeRenderer = randomItem(['ANGLE (NVIDIA GeForce GTX 1660)', 'ANGLE (Intel HD 630)', 'ANGLE (AMD Radeon RX 580)', 'Mali-G78']);
    var _fakeVendor = randomItem(['Google Inc. (NVIDIA)', 'Google Inc. (Intel)', 'Google Inc. (AMD)', 'ARM']);
    try {
      var _origGetParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 0x1F01) return _fakeRenderer;
        if (param === 0x1F00) return _fakeVendor;
        return _origGetParameter.apply(this, arguments);
      };
    } catch (_) {}
    // WebGL2 patch (BUG-12 fix)
    try {
      var _origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 0x1F01) return _fakeRenderer;
        if (param === 0x1F00) return _fakeVendor;
        return _origGetParameter2.apply(this, arguments);
      };
    } catch (_) {}
  }

  // ══════════════════════════════════════════════════════════════
  //  HELPER: Detect tracking URLs
  // ══════════════════════════════════════════════════════════════
  function isTrackingUrl(url) {
    if (!url) return false;
    return /google-analytics|googletagmanager|facebook\.com\/tr|connect\.facebook|analytics|pixel|tracking|telemetry|hotjar|mixpanel|segment\.io|amplitude/i.test(url);
  }

  // ══════════════════════════════════════════════════════════════
  //  INIT — Run all poisoning modules
  // ══════════════════════════════════════════════════════════════
  poisonGoogleAnalytics();
  poisonFacebookPixel();
  poisonBeacons();
  randomizeFingerprint();

  // Re-poison after dynamic script loading
  var _poisonObserver = new MutationObserver(function(mutations) {
    for (var i = 0; i < mutations.length; i++) {
      var nodes = mutations[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        if (nodes[j].tagName === 'SCRIPT') {
          setTimeout(function() {
            poisonGoogleAnalytics();
            poisonFacebookPixel();
          }, 100);
          return;
        }
      }
    }
  });

  if (document.body) {
    _poisonObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      _poisonObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

})();
