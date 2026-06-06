/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — background.js  v2.4  (MV3 Service Worker)
 *   FIXED: Badge counter now survives SW restarts
 *   NEW: Filter list auto-update + ABP→DNR compilation
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

// ── Import filter system modules ────────────────────────────────────────
importScripts(
  '../filterlist/list-manager.js',
  '../filterlist/filter-compiler.js',
  '../engine/scriptlet-engine.js',
  '../engine/scriptlet-registry.js',
  '../engine/network-logger.js',
  '../engine/dynamic-filtering.js',
  '../engine/redirect-adapter.js',
  '../engine/adnauseam-adapter.js',
  '../engine/doh-cname-resolver.js',
  '../engine/community-reports.js'
);

// ══════════════════════════════════════════════════════════════════════════
//  1. STATE
// ══════════════════════════════════════════════════════════════════════════
var totalBlockedAllTime = 0;
var tabStats = new Map();

var CSP_RULE_ID          = 60000;
var WHITELIST_RULE_BASE  = 50000;
var WHITELIST_RULE_RANGE = 9000;
var POLL_ALARM           = 'ub-poll';
var _lastPollTime        = 0;  // Will be restored from session storage

// ── Persistence helpers ─────────────────────────────────────────────────
function loadState() {
  return Promise.all([
    chrome.storage.session.get(['tabStats', 'lastPollTime']),
    chrome.storage.local.get(['totalBlocked'])
  ]).then(function(results) {
    var sessionData = results[0] || {};
    var localData   = results[1] || {};

    // Restore tabStats
    if (sessionData.tabStats) {
      for (var key in sessionData.tabStats) {
        tabStats.set(Number(key), sessionData.tabStats[key]);
      }
    }

    // Restore _lastPollTime — critical for accurate counting after SW restart
    _lastPollTime = sessionData.lastPollTime || Date.now();

    // Restore total
    totalBlockedAllTime = localData.totalBlocked || 0;
  }).catch(function() {
    _lastPollTime = Date.now();
  });
}

function saveTabStatsCache() {
  var obj = {};
  tabStats.forEach(function(val, key) { obj[key] = val; });
  chrome.storage.session.set({ tabStats: obj, lastPollTime: _lastPollTime }).catch(function() {});
}

function saveTotalBlocked() {
  chrome.storage.local.set({ totalBlocked: totalBlockedAllTime }).catch(function() {});
}


// ══════════════════════════════════════════════════════════════════════════
//  2. INSTALL / STARTUP
// ══════════════════════════════════════════════════════════════════════════
chrome.runtime.onInstalled.addListener(function(details) {
  loadState().then(function() {
    installCSPRule();
    restoreWhitelistRules();
    restorePerSiteRules();
    registerPollAlarm();
    setupRealTimeListener();
    refreshAllBadges();
    initFilterSystem(details.reason === 'install');
    buildMalwareDomainList();
  });
  chrome.action.setBadgeBackgroundColor({ color: '#1E82FF' }).catch(function() {});
  console.log('[UltraBlock] Installed/Updated:', details.reason);
});

chrome.runtime.onStartup.addListener(function() {
  loadState().then(function() {
    installCSPRule();
    restoreWhitelistRules();
    restorePerSiteRules();
    registerPollAlarm();
    setupRealTimeListener();
    refreshAllBadges();
    initFilterSystem(false);
    buildMalwareDomainList();
  });
});


// ══════════════════════════════════════════════════════════════════════════
//  2b. FILTER LIST SYSTEM INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════
function initFilterSystem(isFirstInstall) {
  // Load stored scriptlet rules immediately (fast path for SW restart)
  if (typeof UBScriptletEngine !== 'undefined') {
    UBScriptletEngine.loadStoredRules().then(function(count) {
      if (count > 0) console.log('[UltraBlock] Restored ' + count + ' scriptlet rules from storage');
    });
  }

  // Initialize dynamic filtering
  if (typeof UBDynamicFiltering !== 'undefined') {
    UBDynamicFiltering.init().then(function() {
      console.log('[UltraBlock] Dynamic filtering initialized');
    });
  }

  // Initialize redirect engine
  if (typeof UBRedirectEngine !== 'undefined') {
    UBRedirectEngine.init();
  }

  // Initialize AdNauseam adapter (off by default, user opts in)
  if (typeof UBAdNauseam !== 'undefined') {
    UBAdNauseam.init();
  }

  // Initialize DoH CNAME resolver
  if (typeof UBCnameResolver !== 'undefined') {
    UBCnameResolver.init();
  }

  // Initialize Community Reports
  if (typeof UBCommunityReports !== 'undefined') {
    UBCommunityReports.init();
  }

  UBListManager.init().then(function() {
    console.log('[UltraBlock] Filter list manager initialized');

    // Register recompile callback when lists update
    UBListManager.onUpdate(function() {
      recompileFilters();
    });

    if (isFirstInstall) {
      // First install: fetch all lists immediately
      console.log('[UltraBlock] First install — fetching all filter lists...');
      UBListManager.updateAllLists();
    } else {
      // Normal startup: check if lists need update (stale > 4h)
      var meta = UBListManager.getListsMeta();
      var now = Date.now();
      var staleThreshold = 4 * 60 * 60 * 1000; // 4 hours
      var needsUpdate = meta.some(function(m) {
        return m.enabled && (now - m.lastUpdated) > staleThreshold;
      });
      if (needsUpdate) {
        UBListManager.updateAllLists();
      } else {
        // Lists are fresh, just recompile from stored text
        recompileFilters();
      }
    }
  }).catch(function(e) {
    console.error('[UltraBlock] Filter system init failed:', e);
  });
}

function recompileFilters() {
  UBListManager.getAllEnabledTexts().then(function(text) {
    if (!text) {
      console.log('[UltraBlock] No filter text to compile');
      return;
    }
    // Compile network rules
    var rulePromise = UBFilterCompiler.compileAndApply(text);
    // Compile scriptlet rules
    UBScriptletEngine.compileScriptletRules(text);
    return rulePromise;
  }).then(function(result) {
    if (result) {
      console.log('[UltraBlock] Filters compiled: ' + result.ruleCount + ' rules');
    }
  }).catch(function(e) {
    console.error('[UltraBlock] Filter compilation error:', e);
  });
}

// ── Scriptlet injection on navigation ──────────────────────────────────
chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId !== 0) return;
  var hostname = '';
  try { hostname = new URL(details.url).hostname; } catch (_) {}
  if (!hostname) return;
  // Skip chrome://, edge://, about: pages
  if (details.url.indexOf('chrome') === 0 || details.url.indexOf('about:') === 0) return;
  if (typeof UBScriptletEngine !== 'undefined') {
    UBScriptletEngine.injectForTab(details.tabId, hostname, details.frameId);
  }
});


// ══════════════════════════════════════════════════════════════════════════
//  3. CSP REMOVAL DYNAMIC RULE
// ══════════════════════════════════════════════════════════════════════════
function installCSPRule() {
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CSP_RULE_ID],
    addRules: [{
      id: CSP_RULE_ID,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        responseHeaders: [
          { header: 'content-security-policy',             operation: 'remove' },
          { header: 'content-security-policy-report-only', operation: 'remove' },
          { header: 'x-frame-options',                     operation: 'remove' },
        ],
      },
      condition: { resourceTypes: ['main_frame', 'sub_frame'] },
    }],
  }).catch(function(e) {
    if (e.message && e.message.indexOf('Invalid rule') === -1) {
      console.warn('[UltraBlock] CSP rule error:', e.message);
    }
  });
}


// ══════════════════════════════════════════════════════════════════════════
//  4. BADGE HELPERS
// ══════════════════════════════════════════════════════════════════════════
function updateBadge(tabId) {
  var stat = tabStats.get(tabId);
  if (!stat) return;
  var count = stat.blocked;
  var text  = count === 0 ? '' : count >= 1000 ? '999+' : String(count);
  chrome.action.setBadgeText({ text: text, tabId: tabId }).catch(function() {});
  chrome.action.setBadgeBackgroundColor({ color: '#1E82FF', tabId: tabId }).catch(function() {});
}

function clearBadge(tabId) {
  chrome.action.setBadgeText({ text: '', tabId: tabId }).catch(function() {});
}

function refreshAllBadges() {
  chrome.tabs.query({ active: true }).then(function(tabs) {
    for (var i = 0; i < tabs.length; i++) {
      updateBadge(tabs[i].id);
    }
  }).catch(function() {});
}


// ══════════════════════════════════════════════════════════════════════════
//  5. REAL-TIME LISTENER (declarativeNetRequestFeedback)
//     Uses onRuleMatchedDebug for instant counting when available.
//     Falls back to alarm polling.
// ══════════════════════════════════════════════════════════════════════════
var _realTimeListenerInstalled = false;
function setupRealTimeListener() {
  if (_realTimeListenerInstalled) return;
  _realTimeListenerInstalled = true;
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    try {
      chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(function(info) {
        var tabId = info.request && info.request.tabId;
        if (!tabId || tabId < 0) return;

        if (!tabStats.has(tabId)) tabStats.set(tabId, { blocked: 0, domain: '' });
        tabStats.get(tabId).blocked++;
        totalBlockedAllTime++;

        updateBadge(tabId);
        debouncedSave();

        // Enhanced statistics: record per-domain and per-category
        var reqUrl = info.request && info.request.url;
        var ruleId = info.rule && info.rule.ruleId;
        if (reqUrl && ruleId) {
          recordBlockWithMetadata(tabId, reqUrl, ruleId);
        }
      });
      console.log('[UltraBlock] Real-time listener active (onRuleMatchedDebug)');
    } catch (e) {
      console.log('[UltraBlock] onRuleMatchedDebug not available, using polling');
    }
  }
}

var _saveTimer = null;
function debouncedSave() {
  if (_saveTimer) return;
  _saveTimer = setTimeout(function() {
    _saveTimer = null;
    saveTabStatsCache();
    saveTotalBlocked();
  }, 2000);
}


// ══════════════════════════════════════════════════════════════════════════
//  6. STATS POLLING via chrome.alarms (fallback + supplement)
// ══════════════════════════════════════════════════════════════════════════
function registerPollAlarm() {
  chrome.alarms.get(POLL_ALARM, function(existing) {
    if (!existing) {
      chrome.alarms.create(POLL_ALARM, { periodInMinutes: 0.083 }); // ~5s
    }
  });
}

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === POLL_ALARM) {
    pollMatchedRules();
    return;
  }
  // Delegate to filter list manager
  if (UBListManager && UBListManager.handleAlarm(alarm.name)) {
    return;
  }
});

function pollMatchedRules() {
  var now = Date.now();
  var since = _lastPollTime || (now - 6000); // fallback: last 6 seconds

  chrome.declarativeNetRequest.getMatchedRules({
    minTimeStamp: since,
  }).then(function(result) {
    _lastPollTime = now;
    var matches = result.rulesMatchedInfo || [];
    if (matches.length === 0) {
      saveTabStatsCache(); // persist _lastPollTime even when no matches
      return;
    }

    // Deduplicate: if onRuleMatchedDebug is active, these may overlap
    // Use a simple approach: only count if onRuleMatchedDebug is NOT available
    var hasRealTime = !!chrome.declarativeNetRequest.onRuleMatchedDebug;

    if (!hasRealTime) {
      var byTab = {};
      for (var i = 0; i < matches.length; i++) {
        var tid = matches[i].request && matches[i].request.tabId;
        if (tid && tid > 0) byTab[tid] = (byTab[tid] || 0) + 1;
      }

      var newTotal = 0;
      var tids = Object.keys(byTab);
      for (var j = 0; j < tids.length; j++) {
        var id    = Number(tids[j]);
        var count = byTab[tids[j]];
        if (!tabStats.has(id)) tabStats.set(id, { blocked: 0, domain: '' });
        tabStats.get(id).blocked += count;
        newTotal += count;
        updateBadge(id);
      }

      if (newTotal > 0) {
        totalBlockedAllTime += newTotal;
        saveTotalBlocked();
      }
    }

    saveTabStatsCache();
  }).catch(function() {});
}


// ══════════════════════════════════════════════════════════════════════════
//  7. TAB TRACKING
// ══════════════════════════════════════════════════════════════════════════
chrome.tabs.onActivated.addListener(function(info) {
  var tabId = info.tabId;
  if (!tabStats.has(tabId)) tabStats.set(tabId, { blocked: 0, domain: '' });
  updateBadge(tabId);
});

chrome.tabs.onRemoved.addListener(function(tabId) {
  tabStats.delete(tabId);
  saveTabStatsCache();
});

chrome.webNavigation.onCommitted.addListener(function(details) {
  if (details.frameId !== 0) return;
  var tabId  = details.tabId;
  var domain = '';
  try { domain = new URL(details.url).hostname; } catch (_) {}

  if (!tabStats.has(tabId)) {
    tabStats.set(tabId, { blocked: 0, domain: domain });
  } else {
    tabStats.get(tabId).domain  = domain;
    tabStats.get(tabId).blocked = 0;
  }
  clearBadge(tabId);
  saveTabStatsCache();
});


// ══════════════════════════════════════════════════════════════════════════
//  8. WHITELIST HELPERS
// ══════════════════════════════════════════════════════════════════════════
function domainToRuleId(domain) {
  var hash = 5381;
  for (var i = 0; i < domain.length; i++) {
    hash = ((hash << 5) + hash + domain.charCodeAt(i)) | 0;
  }
  return WHITELIST_RULE_BASE + (Math.abs(hash) % WHITELIST_RULE_RANGE);
}

function addAllowRule(domain) {
  var id = domainToRuleId(domain);
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [{
      id: id,
      priority: 1000,
      action: { type: 'allow' },
      condition: { requestDomains: [domain], initiatorDomains: [domain] },
    }],
  });
}

function removeAllowRule(domain) {
  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [domainToRuleId(domain)],
    addRules: [],
  });
}

function restoreWhitelistRules() {
  return chrome.storage.local.get(['whitelist']).then(function(data) {
    var wl = data.whitelist || [];
    return Promise.all(wl.map(function(domain) {
      return addAllowRule(domain).catch(function() {});
    }));
  });
}


// ══════════════════════════════════════════════════════════════════════════
//  9. MESSAGE HANDLER
// ══════════════════════════════════════════════════════════════════════════
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // ── incrementBlock (from content.js cosmetic blocks) ──────────────────
  if (msg.action === 'incrementBlock') {
    var tabId = (sender.tab && sender.tab.id) || msg.tabId;
    var count = msg.count || 1;
    if (tabId && tabId > 0) {
      if (!tabStats.has(tabId)) tabStats.set(tabId, { blocked: 0, domain: '' });
      tabStats.get(tabId).blocked += count;
      totalBlockedAllTime += count;
      updateBadge(tabId);
      debouncedSave();
    }
    return false;
  }

  // ── getStats ──────────────────────────────────────────────────────────
  if (msg.action === 'getStats') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
      var tab    = tabs && tabs[0];
      var tabId  = tab && tab.id;
      var stat   = (tabId != null && tabStats.get(tabId)) || { blocked: 0, domain: '' };
      var domain = stat.domain;
      if (!domain && tab && tab.url) {
        try { domain = new URL(tab.url).hostname; } catch (_) {}
      }
      return chrome.storage.local.get(['totalBlocked', 'whitelist']).then(function(data) {
        var wl = data.whitelist || [];
        sendResponse({
          tabBlocked:   stat.blocked,
          totalBlocked: data.totalBlocked || totalBlockedAllTime,
          domain:       domain,
          whitelisted:  wl.indexOf(domain) !== -1,
          whitelist:    wl,
        });
      });
    }).catch(function(e) {
      sendResponse({ tabBlocked: 0, totalBlocked: totalBlockedAllTime, domain: '', whitelisted: false, whitelist: [], error: e.message });
    });
    return true;
  }

  // ── toggleSite ────────────────────────────────────────────────────────
  if (msg.action === 'toggleSite') {
    var domain = msg.domain;
    var enable = msg.whitelist;
    chrome.storage.local.get(['whitelist']).then(function(data) {
      var wl = data.whitelist || [];
      if (enable) {
        if (wl.indexOf(domain) === -1) wl.push(domain);
        return addAllowRule(domain).then(function() {
          return chrome.storage.local.set({ whitelist: wl });
        }).then(function() { sendResponse({ success: true, whitelisted: true }); });
      } else {
        wl = wl.filter(function(d) { return d !== domain; });
        return removeAllowRule(domain).then(function() {
          return chrome.storage.local.set({ whitelist: wl });
        }).then(function() { sendResponse({ success: true, whitelisted: false }); });
      }
    }).catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── toggleProtection ──────────────────────────────────────────────────
  if (msg.action === 'toggleProtection') {
    var rulesets = ['ad_networks', 'trackers', 'malware', 'annoyances'];
    var opts = msg.enabled
      ? { enableRulesetIds: rulesets, disableRulesetIds: [] }
      : { enableRulesetIds: [], disableRulesetIds: rulesets };
    chrome.declarativeNetRequest.updateEnabledRulesets(opts).then(function() {
      sendResponse({ success: true });
    }).catch(function(e) { sendResponse({ success: false, error: e.message }); });
    return true;
  }

  // ── resetStats ────────────────────────────────────────────────────────
  if (msg.action === 'resetStats') {
    totalBlockedAllTime = 0;
    tabStats.clear();
    chrome.storage.local.set({ totalBlocked: 0 }).catch(function() {});
    chrome.storage.session.set({ tabStats: {}, lastPollTime: Date.now() }).catch(function() {});
    refreshAllBadges();
    sendResponse({ success: true });
    return false;
  }

  // ── getProtectionStatus ───────────────────────────────────────────────
  if (msg.action === 'getProtectionStatus') {
    chrome.declarativeNetRequest.getEnabledRulesets().then(function(rulesets) {
      sendResponse({ enabled: rulesets.length > 0 });
    }).catch(function() { sendResponse({ enabled: true }); });
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  FILTER LIST MANAGEMENT MESSAGES
  // ══════════════════════════════════════════════════════════════════════

  // ── getFilterLists — return metadata for all lists ──────────────────
  if (msg.action === 'getFilterLists') {
    var meta = UBListManager ? UBListManager.getListsMeta() : [];
    UBFilterCompiler.getRuleCount().then(function(count) {
      sendResponse({ lists: meta, compiledRuleCount: count });
    }).catch(function() {
      sendResponse({ lists: meta, compiledRuleCount: 0 });
    });
    return true;
  }

  // ── setFilterListEnabled — enable/disable a list ────────────────────
  if (msg.action === 'setFilterListEnabled') {
    if (!UBListManager) { sendResponse({ success: false }); return false; }
    UBListManager.setListEnabled(msg.listId, msg.enabled).then(function(ok) {
      sendResponse({ success: ok });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── updateFilterLists — force update all lists now ──────────────────
  if (msg.action === 'updateFilterLists') {
    if (!UBListManager) { sendResponse({ success: false }); return false; }
    UBListManager.updateAllLists().then(function(result) {
      sendResponse({ success: true, result: result });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── addCustomFilterList — subscribe to a custom URL ─────────────────
  if (msg.action === 'addCustomFilterList') {
    if (!UBListManager) { sendResponse({ success: false }); return false; }
    UBListManager.addCustomList(msg.url, msg.title).then(function(result) {
      sendResponse(result);
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── removeCustomFilterList — unsubscribe from a list ────────────────
  if (msg.action === 'removeCustomFilterList') {
    if (!UBListManager) { sendResponse({ success: false }); return false; }
    UBListManager.removeCustomList(msg.listId).then(function(ok) {
      sendResponse({ success: ok });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── recompileFilters — force recompilation ──────────────────────────
  if (msg.action === 'recompileFilters') {
    recompileFilters();
    sendResponse({ success: true });
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ELEMENT PICKER
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'activateElementPicker') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'activateElementPicker' });
      }
    });
    sendResponse({ success: true });
    return false;
  }

  if (msg.action === 'addCustomFilter') {
    // Store user-created cosmetic filter
    chrome.storage.local.get(['ub_custom_filters']).then(function(data) {
      var filters = data.ub_custom_filters || [];
      filters.push({
        filter: msg.filter,
        selector: msg.selector,
        hostname: msg.hostname,
        created: Date.now()
      });
      return chrome.storage.local.set({ ub_custom_filters: filters });
    }).then(function() {
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'getCustomFilters') {
    chrome.storage.local.get(['ub_custom_filters']).then(function(data) {
      sendResponse({ filters: data.ub_custom_filters || [] });
    });
    return true;
  }

  if (msg.action === 'removeCustomFilter') {
    chrome.storage.local.get(['ub_custom_filters']).then(function(data) {
      var filters = (data.ub_custom_filters || []).filter(function(f) {
        return f.filter !== msg.filter;
      });
      return chrome.storage.local.set({ ub_custom_filters: filters });
    }).then(function() {
      sendResponse({ success: true });
    });
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  NETWORK LOGGER
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'enableNetworkLogger') {
    UBNetworkLogger.enable();
    sendResponse({ success: true });
    return false;
  }

  if (msg.action === 'disableNetworkLogger') {
    UBNetworkLogger.disable();
    sendResponse({ success: true });
    return false;
  }

  if (msg.action === 'getNetworkLog') {
    sendResponse({
      enabled: UBNetworkLogger.isEnabled(),
      entries: UBNetworkLogger.getEntries(msg.filter),
      stats: UBNetworkLogger.getStats()
    });
    return false;
  }

  if (msg.action === 'clearNetworkLog') {
    UBNetworkLogger.clear();
    sendResponse({ success: true });
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  REDIRECT ENGINE
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'getRedirectResources') {
    var resources = (typeof UBRedirectEngine !== 'undefined') ? UBRedirectEngine.getAllResources() : [];
    sendResponse({ resources: resources });
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ADNAUSEAM (Click Obfuscation)
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'toggleAdNauseam') {
    if (typeof UBAdNauseam === 'undefined') { sendResponse({ success: false }); return false; }
    if (msg.enabled) { UBAdNauseam.enable(); } else { UBAdNauseam.disable(); }
    sendResponse({ success: true, enabled: UBAdNauseam.isEnabled() });
    return false;
  }

  if (msg.action === 'getAdNauseamStatus') {
    if (typeof UBAdNauseam === 'undefined') { sendResponse({ enabled: false }); return false; }
    sendResponse({ enabled: UBAdNauseam.isEnabled() });
    return false;
  }

  if (msg.action === 'getAdVault') {
    if (typeof UBAdNauseam === 'undefined') { sendResponse({ ads: [], stats: {} }); return false; }
    sendResponse(UBAdNauseam.getVault());
    return false;
  }

  if (msg.action === 'clearAdVault') {
    if (typeof UBAdNauseam !== 'undefined') UBAdNauseam.clearVault();
    sendResponse({ success: true });
    return false;
  }

  if (msg.action === 'reportAd') {
    if (typeof UBAdNauseam !== 'undefined') UBAdNauseam.reportAd(msg.ad);
    sendResponse({ success: true });
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LOGGER UI DATA
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'getLoggerUI') {
    var logData = {
      enabled: (typeof UBNetworkLogger !== 'undefined') ? UBNetworkLogger.isEnabled() : false,
      entries: (typeof UBNetworkLogger !== 'undefined') ? UBNetworkLogger.getEntries(msg.filter) : [],
      stats: (typeof UBNetworkLogger !== 'undefined') ? UBNetworkLogger.getStats() : {},
    };
    sendResponse(logData);
    return false;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  DYNAMIC FILTERING
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'getDynamicRules') {
    var siteRules = msg.hostname
      ? UBDynamicFiltering.getRulesForSite(msg.hostname)
      : UBDynamicFiltering.getRules();
    sendResponse({ rules: siteRules });
    return false;
  }

  if (msg.action === 'setDynamicRule') {
    UBDynamicFiltering.setRule(msg.from, msg.to, msg.type, msg.ruleAction).then(function() {
      sendResponse({ success: true });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  if (msg.action === 'removeDynamicRule') {
    UBDynamicFiltering.removeRule(msg.from, msg.to, msg.type).then(function() {
      sendResponse({ success: true });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  if (msg.action === 'clearDynamicRules') {
    UBDynamicFiltering.clearAll().then(function() {
      sendResponse({ success: true });
    });
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PHASE 3: NEW MESSAGE HANDLERS
  // ══════════════════════════════════════════════════════════════════════

  // ── WebRTC toggle ─────────────────────────────────────────────────────
  if (msg.action === 'toggleWebRTC') {
    var newState = msg.enabled !== undefined ? msg.enabled : true;
    chrome.storage.local.set({ webrtc_protection: newState }).then(function() {
      sendResponse({ enabled: newState, needsReload: true });
    });
    return true;
  }

  if (msg.action === 'getWebRTCStatus') {
    chrome.storage.local.get(['webrtc_protection']).then(function(data) {
      sendResponse({ enabled: data.webrtc_protection !== false });
    });
    return true;
  }

  // ── SponsorBlock ──────────────────────────────────────────────────────
  if (msg.action === 'getSponsorBlockStatus') {
    chrome.storage.local.get(['sponsorblock_config']).then(function(data) {
      var cfg = data.sponsorblock_config || { enabled: true };
      sendResponse(cfg);
    });
    return true;
  }

  if (msg.action === 'toggleSponsorBlock') {
    chrome.storage.local.get(['sponsorblock_config']).then(function(data) {
      var cfg = data.sponsorblock_config || { enabled: true };
      cfg.enabled = msg.enabled !== undefined ? msg.enabled : !cfg.enabled;
      chrome.storage.local.set({ sponsorblock_config: cfg });
      sendResponse({ enabled: cfg.enabled });
    });
    return true;
  }

  // ── Strict Blocking — allow blocked site temporarily ──────────────────
  if (msg.action === 'allowBlockedSite') {
    chrome.storage.session.get(['tempAllowlist']).then(function(data) {
      var list = data.tempAllowlist || [];
      if (list.indexOf(msg.domain) === -1) list.push(msg.domain);
      chrome.storage.session.set({ tempAllowlist: list });
      sendResponse({ success: true });
    });
    return true;
  }

  // ── Profile switching ─────────────────────────────────────────────────
  if (msg.action === 'switchProfile') {
    chrome.storage.local.set({ ub_active_profile: msg.profileId }).then(function() {
      var rules = msg.rules || {};
      var enableIds = [];
      var disableIds = [];
      if (rules.ads) enableIds.push('ad_networks'); else disableIds.push('ad_networks');
      if (rules.trackers) enableIds.push('trackers'); else disableIds.push('trackers');
      if (rules.malware) enableIds.push('malware'); else disableIds.push('malware');
      if (rules.annoyances) enableIds.push('annoyances'); else disableIds.push('annoyances');
      if (rules.trackers) enableIds.push('cname_trackers'); else disableIds.push('cname_trackers');

      return chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: enableIds,
        disableRulesetIds: disableIds
      }).then(function() {
        // Store active profile rules so content scripts can read them
        return chrome.storage.local.set({ ub_active_rules: rules });
      }).then(function() {
        // Notify all tabs to re-read profile settings
        return chrome.tabs.query({});
      }).then(function(tabs) {
        for (var i = 0; i < tabs.length; i++) {
          chrome.tabs.sendMessage(tabs[i].id, {
            action: 'profileChanged',
            profileId: msg.profileId,
            rules: rules
          }).catch(function() {});
        }
        sendResponse({ success: true });
      });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── Per-site switches updated ─────────────────────────────────────────
  if (msg.action === 'perSiteSwitchesUpdated') {
    applyPerSiteDNRRules(msg.domain, msg.switches).then(function() {
      sendResponse({ success: true });
    }).catch(function(e) {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // ── Statistics recording ──────────────────────────────────────────────
  if (msg.action === 'recordStat') {
    chrome.storage.local.get(['ub_statistics', 'ub_hourly_stats']).then(function(data) {
      var stats = data.ub_statistics || { totalBlocked: 0, totalTrackers: 0, totalCookies: 0, bytesBlocked: 0, domains: {}, allowedDomains: {}, categories: {}, daily: {} };
      var hourly = data.ub_hourly_stats || {};

      var now = new Date();
      var dateKey = now.getFullYear() + '-' + pad2(now.getMonth()+1) + '-' + pad2(now.getDate());
      var hourKey = dateKey + '_' + pad2(now.getHours());

      stats.totalBlocked += (msg.count || 1);
      if (msg.category === 'tracker') stats.totalTrackers += 1;
      if (msg.category === 'cookie') stats.totalCookies += 1;
      if (msg.domain) stats.domains[msg.domain] = (stats.domains[msg.domain] || 0) + 1;
      if (msg.category) stats.categories[msg.category] = (stats.categories[msg.category] || 0) + 1;

      if (!stats.daily[dateKey]) stats.daily[dateKey] = { blocked: 0, trackers: 0, cookies: 0 };
      stats.daily[dateKey].blocked += (msg.count || 1);

      hourly[hourKey] = (hourly[hourKey] || 0) + (msg.count || 1);

      chrome.storage.local.set({ ub_statistics: stats, ub_hourly_stats: hourly });
      sendResponse({ success: true });
    });
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  CNAME DoH RESOLUTION
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'checkCNAME') {
    if (typeof UBCnameResolver !== 'undefined') {
      UBCnameResolver.checkHostname(msg.hostname).then(function(result) {
        sendResponse(result);
      }).catch(function() {
        sendResponse({ isTracker: false, cname: null, trackerDomain: null });
      });
    } else {
      sendResponse({ isTracker: false, cname: null, trackerDomain: null });
    }
    return true;
  }

  if (msg.action === 'checkCNAMEBatch') {
    if (typeof UBCnameResolver !== 'undefined') {
      UBCnameResolver.checkBatch(msg.hostnames || []).then(function(results) {
        sendResponse({ results: results });
      }).catch(function() {
        sendResponse({ results: {} });
      });
    } else {
      sendResponse({ results: {} });
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════
  //  COMMUNITY REPORTS
  // ══════════════════════════════════════════════════════════════════════

  if (msg.action === 'submitReport') {
    if (typeof UBCommunityReports !== 'undefined') {
      UBCommunityReports.submitReport(msg.report).then(function(result) {
        sendResponse(result);
      }).catch(function(e) {
        sendResponse({ success: false, error: e.message });
      });
    } else {
      sendResponse({ success: false, error: 'module not loaded' });
    }
    return true;
  }

  if (msg.action === 'getReports') {
    if (typeof UBCommunityReports !== 'undefined') {
      var reports = UBCommunityReports.getReports(msg.filter || null);
      sendResponse({ reports: reports });
    } else {
      sendResponse({ reports: [] });
    }
    return false;
  }

  if (msg.action === 'deleteReport') {
    if (typeof UBCommunityReports !== 'undefined') {
      UBCommunityReports.deleteReport(msg.id).then(function() {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  if (msg.action === 'submitAllReports') {
    if (typeof UBCommunityReports !== 'undefined') {
      UBCommunityReports.submitAllPending().then(function(result) {
        sendResponse(result);
      });
    } else {
      sendResponse({ submitted: 0 });
    }
    return true;
  }

  if (msg.action === 'getReportSettings') {
    if (typeof UBCommunityReports !== 'undefined') {
      sendResponse(UBCommunityReports.getSettings());
    } else {
      sendResponse({});
    }
    return false;
  }

  if (msg.action === 'updateReportSettings') {
    if (typeof UBCommunityReports !== 'undefined') {
      UBCommunityReports.updateSettings(msg.settings).then(function() {
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  return false;
});

function pad2(n) { return n.toString().padStart(2, '0'); }


// ══════════════════════════════════════════════════════════════════════════
//  9b. PER-SITE SWITCHES DNR ENFORCEMENT
//      Generates dynamic DNR rules for per-site toggles (no-fonts, no-large-media, etc.)
// ══════════════════════════════════════════════════════════════════════════
var PERSITE_RULE_BASE = 62000;
var PERSITE_RULE_RANGE = 500;

function persiteRuleId(domain, offset) {
  var hash = 5381;
  for (var i = 0; i < domain.length; i++) {
    hash = ((hash << 5) + hash + domain.charCodeAt(i)) | 0;
  }
  return PERSITE_RULE_BASE + (Math.abs(hash) % PERSITE_RULE_RANGE) * 6 + offset;
}

function applyPerSiteDNRRules(domain, switches) {
  if (!domain) return Promise.resolve();

  var removeIds = [];
  var addRules = [];

  // Generate up to 6 rules per domain
  for (var i = 0; i < 6; i++) {
    removeIds.push(persiteRuleId(domain, i));
  }

  var ruleIdx = 0;

  // Block remote fonts
  if (switches.noFonts) {
    addRules.push({
      id: persiteRuleId(domain, ruleIdx++),
      priority: 100,
      action: { type: 'block' },
      condition: {
        initiatorDomains: [domain],
        resourceTypes: ['font'],
        excludedInitiatorDomains: []
      }
    });
  }

  // Block large media (use modifyHeaders to intercept — simplified: block media)
  if (switches.noLargeMedia) {
    addRules.push({
      id: persiteRuleId(domain, ruleIdx++),
      priority: 100,
      action: { type: 'block' },
      condition: {
        initiatorDomains: [domain],
        resourceTypes: ['media'],
        excludedInitiatorDomains: []
      }
    });
  }

  // Block 3rd-party scripts
  if (switches.no3pScripts) {
    addRules.push({
      id: persiteRuleId(domain, ruleIdx++),
      priority: 100,
      action: { type: 'block' },
      condition: {
        initiatorDomains: [domain],
        excludedRequestDomains: [domain],
        resourceTypes: ['script']
      }
    });
  }

  // Block 3rd-party frames
  if (switches.no3pFrames) {
    addRules.push({
      id: persiteRuleId(domain, ruleIdx++),
      priority: 100,
      action: { type: 'block' },
      condition: {
        initiatorDomains: [domain],
        excludedRequestDomains: [domain],
        resourceTypes: ['sub_frame']
      }
    });
  }

  // Block popups (new windows from this domain)
  if (switches.noPopups === false) {
    // Popups are blocked by default; only add rule to ALLOW if user disables
    addRules.push({
      id: persiteRuleId(domain, ruleIdx++),
      priority: 50,
      action: { type: 'allow' },
      condition: {
        initiatorDomains: [domain],
        resourceTypes: ['main_frame']
      }
    });
  }

  return chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: addRules
  }).catch(function(e) {
    console.warn('[UltraBlock] Per-site DNR error:', e.message);
  });
}

// Restore per-site rules on startup
function restorePerSiteRules() {
  chrome.storage.local.get(['persite_switches']).then(function(data) {
    var allSites = data.persite_switches || {};
    var domains = Object.keys(allSites);
    var chain = Promise.resolve();
    domains.forEach(function(domain) {
      chain = chain.then(function() {
        return applyPerSiteDNRRules(domain, allSites[domain]);
      });
    });
  }).catch(function() {});
}


// ══════════════════════════════════════════════════════════════════════════
//  9c. MALWARE REDIRECT TO BLOCKED PAGE
//      Redirects malware-blocked navigations to the warning page.
// ══════════════════════════════════════════════════════════════════════════
var MALWARE_REDIRECT_RULE_ID = 61000;

function installMalwareRedirectRule() {
  // Use the malware ruleset IDs to detect when a main_frame is blocked.
  // MV3 doesn't support redirect from static rulesets, so we use a dynamic
  // rule that matches known malware domains and redirects to blocked.html.
  chrome.storage.local.get(['ub_malware_domains']).then(function(data) {
    var domains = data.ub_malware_domains || [];
    if (domains.length === 0) return;

    // Take first 100 domains (DNR limit consideration)
    var topDomains = domains.slice(0, 100);

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [MALWARE_REDIRECT_RULE_ID],
      addRules: [{
        id: MALWARE_REDIRECT_RULE_ID,
        priority: 2000,
        action: {
          type: 'redirect',
          redirect: {
            regexSubstitution: chrome.runtime.getURL('src/pages/blocked.html') +
              '?domain=\\0&category=malware&source=UltraBlock+Threat+List'
          }
        },
        condition: {
          requestDomains: topDomains,
          resourceTypes: ['main_frame']
        }
      }]
    }).catch(function(e) {
      console.warn('[UltraBlock] Malware redirect rule error:', e.message);
    });
  });
}

// Also intercept via webNavigation for broader coverage
chrome.webNavigation.onBeforeNavigate.addListener(function(details) {
  if (details.frameId !== 0) return;
  var hostname = '';
  try { hostname = new URL(details.url).hostname; } catch (_) { return; }

  // Check temp allowlist first
  chrome.storage.session.get(['tempAllowlist']).then(function(data) {
    var allowed = data.tempAllowlist || [];
    if (allowed.indexOf(hostname) !== -1) return;

    // Check against malware domain list
    chrome.storage.local.get(['ub_malware_domains']).then(function(mdata) {
      var malwareDomains = mdata.ub_malware_domains || [];
      if (malwareDomains.indexOf(hostname) !== -1) {
        var blockedUrl = chrome.runtime.getURL('src/pages/blocked.html') +
          '?domain=' + encodeURIComponent(hostname) +
          '&url=' + encodeURIComponent(details.url) +
          '&category=malware&source=UltraBlock+Threat+List';
        chrome.tabs.update(details.tabId, { url: blockedUrl }).catch(function() {});
      }
    });
  });
});

// Build malware domain list from the static rules file on install/update
function buildMalwareDomainList() {
  // Read from the malware rules and extract domains for redirect
  fetch(chrome.runtime.getURL('rules/malware.json'))
    .then(function(r) { return r.json(); })
    .then(function(rules) {
      var domains = [];
      rules.forEach(function(rule) {
        if (rule.condition && rule.condition.requestDomains) {
          domains = domains.concat(rule.condition.requestDomains);
        }
        if (rule.condition && rule.condition.urlFilter) {
          // Extract domain from urlFilter like ||malware.com^
          var match = (rule.condition.urlFilter || '').match(/^\|\|([a-zA-Z0-9.-]+)/);
          if (match) domains.push(match[1]);
        }
      });
      // Deduplicate
      domains = Array.from(new Set(domains));
      chrome.storage.local.set({ ub_malware_domains: domains });
      console.log('[UltraBlock] Built malware domain list: ' + domains.length + ' domains');
    })
    .catch(function(e) {
      console.warn('[UltraBlock] Failed to build malware list:', e);
    });
}


// ══════════════════════════════════════════════════════════════════════════
//  9d. ENHANCED STATISTICS — Collect per-domain/category from onRuleMatchedDebug
// ══════════════════════════════════════════════════════════════════════════
var _statsBatchDomains = {};
var _statsBatchCategories = {};
var _statsFlushTimer = null;

function recordBlockWithMetadata(tabId, url, ruleId) {
  var hostname = '';
  try { hostname = new URL(url).hostname; } catch (_) {}
  if (!hostname) return;

  // Determine category from rule ID ranges
  var category = 'ads';
  if (ruleId >= 1 && ruleId < 10000) category = 'ads';
  else if (ruleId >= 10000 && ruleId < 30000) category = 'trackers';
  else if (ruleId >= 30000 && ruleId < 50000) category = 'malware';
  else if (ruleId >= 50000 && ruleId < 60000) category = 'annoyances';
  else if (ruleId >= 70000 && ruleId < 80000) category = 'cname';

  _statsBatchDomains[hostname] = (_statsBatchDomains[hostname] || 0) + 1;
  _statsBatchCategories[category] = (_statsBatchCategories[category] || 0) + 1;

  if (!_statsFlushTimer) {
    _statsFlushTimer = setTimeout(flushStatsBatch, 5000);
  }
}

function flushStatsBatch() {
  _statsFlushTimer = null;
  var domains = _statsBatchDomains;
  var cats = _statsBatchCategories;
  _statsBatchDomains = {};
  _statsBatchCategories = {};

  if (Object.keys(domains).length === 0) return;

  chrome.storage.local.get(['ub_statistics', 'ub_hourly_stats']).then(function(data) {
    var stats = data.ub_statistics || {
      totalBlocked: 0, totalTrackers: 0, totalCookies: 0,
      bytesBlocked: 0, domains: {}, allowedDomains: {}, categories: {}, daily: {}
    };
    var hourly = data.ub_hourly_stats || {};
    var now = new Date();
    var dateKey = now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
    var hourKey = dateKey + '_' + pad2(now.getHours());

    var totalNew = 0;
    for (var d in domains) {
      stats.domains[d] = (stats.domains[d] || 0) + domains[d];
      totalNew += domains[d];
    }
    for (var c in cats) {
      stats.categories[c] = (stats.categories[c] || 0) + cats[c];
    }

    stats.totalBlocked += totalNew;
    if (cats.trackers) stats.totalTrackers += cats.trackers;

    if (!stats.daily[dateKey]) stats.daily[dateKey] = { blocked: 0, trackers: 0, cookies: 0 };
    stats.daily[dateKey].blocked += totalNew;
    if (cats.trackers) stats.daily[dateKey].trackers += cats.trackers;

    hourly[hourKey] = (hourly[hourKey] || 0) + totalNew;

    // Prune old hourly data (keep 7 days)
    var cutoff = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    var cutoffKey = cutoff.getFullYear() + '-' + pad2(cutoff.getMonth() + 1) + '-' + pad2(cutoff.getDate());
    for (var k in hourly) {
      if (k < cutoffKey) delete hourly[k];
    }

    chrome.storage.local.set({ ub_statistics: stats, ub_hourly_stats: hourly });
  }).catch(function() {});
}


// ══════════════════════════════════════════════════════════════════════════
//  10. KEYBOARD COMMANDS
//      toggle-retro: Ctrl+Shift+E — send message to active tab
// ══════════════════════════════════════════════════════════════════════════
if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener(function(command) {
    if (command === 'toggle-retro') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(function(tabs) {
        if (tabs && tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleRetroMode' }).catch(function() {});
        }
      }).catch(function() {});
    }
  });
}
