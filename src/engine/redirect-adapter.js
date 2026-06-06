/**
 * UltraBlock — Redirect Engine Adapter
 * Manages redirect resources (noop scripts, images, frames)
 * Used to replace blocked resources with harmless stubs to prevent site breakage.
 */
'use strict';

var UBRedirectEngine = (function () {
  // Registry of available redirect resources
  var _resources = {};
  var _initialized = false;

  // Map of resource aliases used in filter rules
  var RESOURCE_MAP = {
    // Images
    '1x1.gif':              'src/redirects/1x1.gif',
    '2x2.png':              'src/redirects/2x2.png',
    '1x1-transparent.gif':  'src/redirects/1x1.gif',
    '3x2-transparent.png':  'src/redirects/2x2.png',

    // Scripts
    'noop.js':              'src/redirects/noop.js',
    'noopjs':               'src/redirects/noop.js',
    'noop.txt':             'src/redirects/noop.txt',
    'nooptext':             'src/redirects/noop.txt',

    // Frames
    'noop.html':            'src/redirects/noop.html',
    'noopframe':            'src/redirects/noopframe.html',

    // Service-specific stubs
    'google-analytics_analytics.js':     'src/redirects/google-analytics_analytics.js',
    'googlesyndication_adsbygoogle.js':   'src/redirects/googlesyndication_adsbygoogle.js',
    'googletagmanager_gtm.js':            'src/redirects/googletagmanager_gtm.js',
    'amazon_apstag.js':                   'src/redirects/amazon_apstag.js',
    'outbrain-widget.js':                 'src/redirects/outbrain-widget.js',
    'scorecardresearch_beacon.js':        'src/redirects/scorecardresearch_beacon.js',

    // uBlock redirect resources (from Phase 1 copy)
    'amazon_ads.js':                      'src/redirects/ublock/amazon_ads.js',
    'ampproject_v0.js':                   'src/redirects/ublock/ampproject_v0.js',
    'chartbeat.js':                       'src/redirects/ublock/chartbeat.js',
    'doubleclick_instream_ad_status.js':  'src/redirects/ublock/doubleclick_instream_ad_status.js',
    'empty':                              'src/redirects/ublock/empty',
    'fingerprint2.js':                    'src/redirects/ublock/fingerprint2.js',
    'fingerprint3.js':                    'src/redirects/ublock/fingerprint3.js',
    'google-analytics_cx_api.js':         'src/redirects/ublock/google-analytics_cx_api.js',
    'google-analytics_ga.js':             'src/redirects/ublock/google-analytics_ga.js',
    'google-ima.js':                      'src/redirects/ublock/google-ima.js',
    'googlesyndication_adsbygoogle.js':   'src/redirects/ublock/googlesyndication_adsbygoogle.js',
    'googletagservices_gpt.js':           'src/redirects/ublock/googletagservices_gpt.js',
    'hd-main.js':                         'src/redirects/ublock/hd-main.js',
    'mxpnl_mixpanel.js':                  'src/redirects/ublock/mxpnl_mixpanel.js',
    'noeval-silent.js':                   'src/redirects/ublock/noeval-silent.js',
    'noop-0.1s.mp3':                      'src/redirects/ublock/noop-0.1s.mp3',
    'noop-0.5s.mp3':                      'src/redirects/ublock/noop-0.5s.mp3',
    'noop-1s.mp4':                        'src/redirects/ublock/noop-1s.mp4',
    'nobab.js':                           'src/redirects/ublock/nobab.js',
    'nobab2.js':                          'src/redirects/ublock/nobab2.js',
    'nofab.js':                           'src/redirects/ublock/nofab.js',
    'popads.js':                          'src/redirects/ublock/popads.js',
    'popads-dummy.js':                    'src/redirects/ublock/popads-dummy.js',
    'prebid-ads.js':                      'src/redirects/ublock/prebid-ads.js',
    'scorecardresearch_beacon.js':        'src/redirects/ublock/scorecardresearch_beacon.js',
    'window.open-defuser.js':             'src/redirects/ublock/window.open-defuser.js',
  };

  function init() {
    _resources = RESOURCE_MAP;
    _initialized = true;
    console.log('[UltraBlock/Redirect] Initialized: ' + Object.keys(_resources).length + ' resources');
    return Promise.resolve();
  }

  function getResourcePath(name) {
    if (!name) return null;
    // Try exact match
    if (_resources[name]) return _resources[name];
    // Try without extension
    var base = name.replace(/\.\w+$/, '');
    if (_resources[base]) return _resources[base];
    return null;
  }

  function getResourceURL(name) {
    var path = getResourcePath(name);
    if (!path) return null;
    return chrome.runtime.getURL(path);
  }

  function getAllResources() {
    return Object.keys(_resources).map(function (name) {
      return { name: name, path: _resources[name] };
    });
  }

  function isInitialized() { return _initialized; }

  return {
    init: init,
    getResourcePath: getResourcePath,
    getResourceURL: getResourceURL,
    getAllResources: getAllResources,
    isInitialized: isInitialized,
  };
})();
