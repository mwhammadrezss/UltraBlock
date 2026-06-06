/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — removeparam.js  v1.0
 *   URL Tracking Parameter Cleaner (Content Script)
 *
 *   Strips tracking parameters from URLs using history.replaceState
 *   after page load. This is a supplement to the DNR-based approach
 *   (which handles it at the network level for navigations).
 *
 *   This content script catches:
 *   - Parameters that DNR couldn't strip (XHR responses)
 *   - URL bar cleanup after redirects
 *   - pushState/replaceState URL changes in SPAs
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function UltraBlockRemoveparam() {

  // ─── Tracking parameters to remove ─────────────────────────────────
  var TRACKING_PARAMS = [
    // Google
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'utm_name', 'utm_cid', 'utm_reader', 'utm_viz_id', 'utm_pubreferrer',
    'utm_swu', 'utm_referrer',
    'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
    // Facebook
    'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
    // Microsoft
    'msclkid',
    // Twitter
    'twclid',
    // Instagram
    'igshid', 'igsh',
    // Mailchimp
    'mc_cid', 'mc_eid',
    // Yandex
    'yclid', '_openstat',
    // HubSpot
    '_hsenc', '_hsmi', '__hstc', '__hsfp', 'hsCtaTracking',
    // Adobe
    's_cid',
    // General tracking
    'ref_src', 'ref_url', 'ref',
    'vero_id', 'vero_conv',
    'wickedid',
    'oly_anon_id', 'oly_enc_id',
    'rb_clickid',
    'ml_subscriber', 'ml_subscriber_hash',
    'trk_contact', 'trk_msg', 'trk_module', 'trk_sid',
    'at_medium', 'at_campaign',
    // Social share
    'si', 'feature', // Spotify, YouTube
    // Misc
    'mkt_tok', 'CNDID', '_bta_tid', '_bta_c',
    'trk_sid', 'trk_msg', 'trk_contact'
  ];

  // Convert to Set for O(1) lookup
  var PARAM_SET = {};
  for (var i = 0; i < TRACKING_PARAMS.length; i++) {
    PARAM_SET[TRACKING_PARAMS[i].toLowerCase()] = true;
  }

  // Regex patterns (e.g., utm_* catches all utm variants)
  var REGEX_PATTERNS = [
    /^utm_/i,
    /^hsa_/i,
    /^__utm/i
  ];


  // ═══════════════════════════════════════════════════════════════════════
  //  CORE
  // ═══════════════════════════════════════════════════════════════════════

  function cleanUrl(urlStr) {
    try {
      var url = new URL(urlStr);
      if (!url.search) return null; // No params to clean

      var params = new URLSearchParams(url.search);
      var removed = 0;
      var toRemove = [];

      params.forEach(function(value, key) {
        var keyLower = key.toLowerCase();
        if (PARAM_SET[keyLower]) {
          toRemove.push(key);
          return;
        }
        for (var j = 0; j < REGEX_PATTERNS.length; j++) {
          if (REGEX_PATTERNS[j].test(key)) {
            toRemove.push(key);
            return;
          }
        }
      });

      if (toRemove.length === 0) return null;

      for (var k = 0; k < toRemove.length; k++) {
        params.delete(toRemove[k]);
      }

      url.search = params.toString() ? '?' + params.toString() : '';
      return url.toString();
    } catch (e) {
      return null;
    }
  }

  function cleanCurrentUrl() {
    var cleaned = cleanUrl(location.href);
    if (cleaned && cleaned !== location.href) {
      try {
        history.replaceState(history.state, '', cleaned);
      } catch (e) {}
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SPA NAVIGATION HOOK
  // ═══════════════════════════════════════════════════════════════════════

  // Hook pushState and replaceState to clean URLs in SPAs
  var origPushState = history.pushState;
  var origReplaceState = history.replaceState;

  history.pushState = function() {
    var result = origPushState.apply(history, arguments);
    setTimeout(cleanCurrentUrl, 0);
    return result;
  };

  history.replaceState = function() {
    var result = origReplaceState.apply(history, arguments);
    // Don't recursively clean on our own replaceState calls
    return result;
  };

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', function() {
    setTimeout(cleanCurrentUrl, 0);
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  LINK CLEANING (clean tracking from links on the page)
  // ═══════════════════════════════════════════════════════════════════════

  function cleanLinks() {
    var links = document.querySelectorAll('a[href*="utm_"], a[href*="fbclid"], a[href*="gclid"]');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href');
      if (!href) continue;
      try {
        var fullUrl = new URL(href, location.origin);
        var cleaned = cleanUrl(fullUrl.toString());
        if (cleaned) {
          links[i].setAttribute('href', cleaned);
        }
      } catch (e) {}
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  START
  // ═══════════════════════════════════════════════════════════════════════

  // Clean current URL on page load
  cleanCurrentUrl();

  // Clean links after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanLinks);
  } else {
    cleanLinks();
  }

  // Observe for new links (SPA content loading)
  var _linkCleanTimer = null;
  var observer = new MutationObserver(function() {
    if (_linkCleanTimer) return;
    _linkCleanTimer = setTimeout(function() {
      _linkCleanTimer = null;
      cleanLinks();
    }, 1000);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }

})();
