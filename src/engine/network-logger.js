/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — network-logger.js  v1.0
 *   Network Request Logger / Debug Panel
 *
 *   Records all blocked/allowed network requests and the rules
 *   that matched them. Provides data for the debug panel in the
 *   popup/devtools.
 *
 *   Runs in the service worker. Stores recent entries in session
 *   storage for the popup to query.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBNetworkLogger = (function() {

  // ─── Config ─────────────────────────────────────────────────────────
  var MAX_ENTRIES = 500;
  var STORAGE_KEY = 'ub_network_log';

  // ─── State ──────────────────────────────────────────────────────────
  var _entries = [];
  var _enabled = false;
  var _listeners = [];


  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  function enable() {
    _enabled = true;
    _entries = [];
    _setupDebugListener();
    console.log('[UltraBlock/Logger] Network logger enabled');
  }

  function disable() {
    _enabled = false;
    _entries = [];
    console.log('[UltraBlock/Logger] Network logger disabled');
  }

  function isEnabled() {
    return _enabled;
  }

  function getEntries(filter) {
    if (!filter) return _entries.slice();

    return _entries.filter(function(entry) {
      if (filter.tabId && entry.tabId !== filter.tabId) return false;
      if (filter.type && entry.type !== filter.type) return false;
      if (filter.blocked !== undefined && entry.blocked !== filter.blocked) return false;
      if (filter.domain && entry.url.indexOf(filter.domain) === -1) return false;
      return true;
    });
  }

  function getStats() {
    var stats = {
      total: _entries.length,
      blocked: 0,
      allowed: 0,
      byType: {},
      topBlocked: {}
    };

    for (var i = 0; i < _entries.length; i++) {
      var e = _entries[i];
      if (e.blocked) stats.blocked++;
      else stats.allowed++;

      stats.byType[e.resourceType] = (stats.byType[e.resourceType] || 0) + 1;

      if (e.blocked) {
        var domain = '';
        try { domain = new URL(e.url).hostname; } catch (_) {}
        if (domain) {
          stats.topBlocked[domain] = (stats.topBlocked[domain] || 0) + 1;
        }
      }
    }

    return stats;
  }

  function clear() {
    _entries = [];
  }

  function onEntry(callback) {
    _listeners.push(callback);
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INTERNAL
  // ═══════════════════════════════════════════════════════════════════════

  function _setupDebugListener() {
    if (!chrome.declarativeNetRequest.onRuleMatchedDebug) return;

    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener(function(info) {
      if (!_enabled) return;

      var entry = {
        timestamp: Date.now(),
        url: info.request.url || '',
        tabId: info.request.tabId || -1,
        resourceType: info.request.type || 'other',
        method: info.request.method || 'GET',
        blocked: true,
        ruleId: info.rule.ruleId,
        rulesetId: info.rule.rulesetId || 'dynamic'
      };

      _addEntry(entry);
    });
  }

  function _addEntry(entry) {
    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) {
      _entries = _entries.slice(-MAX_ENTRIES);
    }

    // Notify listeners
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](entry); } catch (e) {}
    }
  }

  /**
   * Log an allowed request (called from webRequest if needed)
   */
  function logAllowed(url, tabId, resourceType) {
    if (!_enabled) return;
    _addEntry({
      timestamp: Date.now(),
      url: url,
      tabId: tabId,
      resourceType: resourceType || 'other',
      method: 'GET',
      blocked: false,
      ruleId: null,
      rulesetId: null
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  return {
    enable: enable,
    disable: disable,
    isEnabled: isEnabled,
    getEntries: getEntries,
    getStats: getStats,
    clear: clear,
    onEntry: onEntry,
    logAllowed: logAllowed
  };

})();
