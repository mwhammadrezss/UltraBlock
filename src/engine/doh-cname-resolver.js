/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — DNS-over-HTTPS CNAME Resolver
 *  Resolves CNAME records via DoH to uncloak hidden trackers.
 *  Works within MV3 service worker limitations.
 *
 *  Sources: byu-imaal/dohjs, AdguardTeam/cname-trackers
 *  DoH providers: Cloudflare (1.1.1.1), Google (8.8.8.8)
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBCnameResolver = (function() {

  // ── Configuration ─────────────────────────────────────────────────────
  var DOH_URL = 'https://cloudflare-dns.com/dns-query';
  var CACHE_TTL = 3600000; // 1 hour
  var MAX_CACHE_SIZE = 500;
  var ENABLED_KEY = 'cname_uncloaking';

  // Known CNAME tracker targets (root domains from AdGuard/cname-trackers)
  var KNOWN_TRACKER_TARGETS = [
    '0i0i0i0.com','1p-data.co','2cnt.net','2o7.net','a8.net','aabdmn.com',
    'ab1n.net','actonservice.com','actonsoftware.com','ad-cloud.jp',
    'ad-shield.cc','adobedc.net','adocean.pl','affex.org','affilbox.cz',
    'ahacdn.me','ak-is2.net','amaerodactylon.com','aquaplatform.com',
    'at-o.net','attntags.com','beixisys.com','bmtrck.com','bnc.lt','bp01.net',
    'ca-eulerian.net','clickaine.com','clog.jp','customer.io',
    'dataunlocker.com','dnsdelegation.io','dnse4.com','edgetag.io',
    'eloqua.com','emltrk.com','en25.com','eulerian.net','exacttarget.com',
    'fuseplatform.net','getblue.io','go-mpulse.net','heapanalytics.com',
    'hlserve.com','hubspot.net','igodigital.com','intentiq.com',
    'k-y.io','keyade.com','lagardere-pub.com','liveperson.net',
    'm6r.eu','marketo.net','mboxedge.com','mediarithmics.com',
    'mookie1.com','mparticle.com','mxpnl.com','nanovisor.io','npttech.com',
    'nuggad.net','okt.to','omtrdc.net','online-metrix.net',
    'oracleinfinity.io','pardot.com','pixel.ad','pswec.com','rfihub.com',
    'rlcdn.com','rmtag.com','salesforceliveagent.com','sc-static.net',
    'segment.io','siteimproveanalytics.io','sn-cdn.net','stat-rock.com',
    'tagcommander.com','tealiumiq.com','tracedock.com','tracktor.io',
    'trafficguard.ai','truste.com','usabilla.com','veinteractive.com',
    'visitor-analytics.io','webtrekk.net','wt-eu02.net','wt-safetag.com',
    'xtcore.com','yottaa.com','dnstination.com','contentsquare.net',
    'commandersact.com','criteo.com','dynatrace.com','episerver.net',
    'plausible.io'
  ];

  // Build lookup set for O(1) checks
  var _trackerSet = {};
  KNOWN_TRACKER_TARGETS.forEach(function(d) { _trackerSet[d] = true; });

  // LRU-ish cache: hostname → { cname, time, isTracker }
  var _cache = {};
  var _cacheKeys = [];
  var _enabled = true;

  // ══════════════════════════════════════════════════════════════════════
  //  DoH QUERY
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Resolve CNAME for a hostname using DoH (JSON API).
   * Returns Promise<string|null> — the CNAME target or null.
   */
  function resolveCNAME(hostname) {
    // Check cache first
    var cached = _cache[hostname];
    if (cached && (Date.now() - cached.time) < CACHE_TTL) {
      return Promise.resolve(cached.cname);
    }

    var url = DOH_URL + '?name=' + encodeURIComponent(hostname) + '&type=CNAME';

    return fetch(url, {
      headers: { 'Accept': 'application/dns-json' }
    }).then(function(response) {
      if (!response.ok) return null;
      return response.json();
    }).then(function(data) {
      if (!data || !data.Answer) return null;

      // Find CNAME record (type 5)
      for (var i = 0; i < data.Answer.length; i++) {
        if (data.Answer[i].type === 5) {
          var cname = data.Answer[i].data;
          // Remove trailing dot
          if (cname.endsWith('.')) cname = cname.slice(0, -1);
          cacheResult(hostname, cname);
          return cname;
        }
      }
      cacheResult(hostname, null);
      return null;
    }).catch(function() {
      return null;
    });
  }

  function cacheResult(hostname, cname) {
    if (_cacheKeys.length >= MAX_CACHE_SIZE) {
      var oldest = _cacheKeys.shift();
      delete _cache[oldest];
    }
    _cache[hostname] = { cname: cname, time: Date.now() };
    _cacheKeys.push(hostname);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  TRACKER CHECK
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Check if a hostname is a cloaked tracker.
   * Returns Promise<{ isTracker, cname, trackerDomain }>
   */
  function checkHostname(hostname) {
    // Skip if it's already a known tracker domain
    var rootDomain = getRootDomain(hostname);
    if (_trackerSet[rootDomain]) {
      return Promise.resolve({ isTracker: true, cname: null, trackerDomain: rootDomain });
    }

    return resolveCNAME(hostname).then(function(cname) {
      if (!cname) return { isTracker: false, cname: null, trackerDomain: null };

      var cnameRoot = getRootDomain(cname);
      var isTracker = !!_trackerSet[cnameRoot];

      return { isTracker: isTracker, cname: cname, trackerDomain: isTracker ? cnameRoot : null };
    });
  }

  /**
   * Batch check multiple hostnames. Returns Map of hostname → result.
   */
  function checkBatch(hostnames) {
    var promises = hostnames.map(function(h) {
      return checkHostname(h).then(function(result) {
        return { hostname: h, result: result };
      });
    });
    return Promise.all(promises).then(function(results) {
      var map = {};
      results.forEach(function(r) { map[r.hostname] = r.result; });
      return map;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════════════

  function getRootDomain(hostname) {
    var parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    // Handle known TLDs like co.uk, com.au
    var knownSLDs = ['co.uk','co.jp','com.au','com.br','co.kr','co.nz'];
    var last2 = parts.slice(-2).join('.');
    if (knownSLDs.indexOf(last2) !== -1 && parts.length > 2) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  return {
    checkHostname: checkHostname,
    checkBatch: checkBatch,
    resolveCNAME: resolveCNAME,
    isKnownTracker: function(hostname) {
      return !!_trackerSet[getRootDomain(hostname)];
    },
    getStats: function() {
      return { cacheSize: _cacheKeys.length, knownTrackers: KNOWN_TRACKER_TARGETS.length };
    },
    init: function() {
      return chrome.storage.local.get([ENABLED_KEY]).then(function(data) {
        _enabled = data[ENABLED_KEY] !== false;
        console.log('[UltraBlock/CNAME] DoH resolver ready. Known targets: ' + KNOWN_TRACKER_TARGETS.length);
      }).catch(function() {});
    }
  };

})();
