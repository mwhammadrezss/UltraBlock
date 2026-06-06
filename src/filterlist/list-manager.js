/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — list-manager.js  v1.0
 *   Filter List Subscription & Auto-Update System
 *
 *   Manages external filter list subscriptions:
 *   - Fetches lists from remote URLs
 *   - Stores raw filter text in chrome.storage.local
 *   - Schedules periodic updates via chrome.alarms
 *   - Notifies the compiler when lists change
 *
 *   Storage keys:
 *     'ub_filterlists_meta' → array of {id, url, title, enabled, lastUpdated, entryCount}
 *     'ub_filterlist_<id>'  → raw filter text string
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBListManager = (function() {

  // ─── Constants ──────────────────────────────────────────────────────────
  var UPDATE_ALARM    = 'ub-filterlist-update';
  var UPDATE_INTERVAL = 240; // minutes (4 hours)
  var STORAGE_META_KEY = 'ub_filterlists_meta';
  var STORAGE_PREFIX   = 'ub_filterlist_';
  var MAX_FETCH_TIMEOUT = 30000; // 30s

  // ─── Default filter list catalog ───────────────────────────────────────
  var DEFAULT_LISTS = [
    {
      id: 'easylist',
      title: 'EasyList',
      url: 'https://easylist.to/easylist/easylist.txt',
      enabled: true,
      category: 'ads'
    },
    {
      id: 'easyprivacy',
      title: 'EasyPrivacy',
      url: 'https://easylist.to/easylist/easyprivacy.txt',
      enabled: true,
      category: 'privacy'
    },
    {
      id: 'ublock-filters',
      title: 'uBlock Filters',
      url: 'https://ublockorigin.github.io/uAssets/filters/filters.txt',
      enabled: true,
      category: 'ads'
    },
    {
      id: 'ublock-badware',
      title: 'uBlock Filters — Badware Risks',
      url: 'https://ublockorigin.github.io/uAssets/filters/badware.txt',
      enabled: true,
      category: 'malware'
    },
    {
      id: 'ublock-privacy',
      title: 'uBlock Filters — Privacy',
      url: 'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
      enabled: true,
      category: 'privacy'
    },
    {
      id: 'peter-lowe',
      title: "Peter Lowe's Ad and Tracking Server List",
      url: 'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&mimetype=plaintext',
      enabled: true,
      category: 'ads'
    },
    {
      id: 'fanboy-annoyances',
      title: "Fanboy's Annoyance List",
      url: 'https://easylist.to/easylist/fanboy-annoyance.txt',
      enabled: true,
      category: 'annoyances'
    },
    {
      id: 'adguard-base',
      title: 'AdGuard Base Filter',
      url: 'https://filters.adtidy.org/extension/chromium/filters/2.txt',
      enabled: false,
      category: 'ads'
    },
    {
      id: 'adguard-tracking',
      title: 'AdGuard Tracking Protection',
      url: 'https://filters.adtidy.org/extension/chromium/filters/3.txt',
      enabled: false,
      category: 'privacy'
    },
    {
      id: 'adguard-annoyances',
      title: 'AdGuard Annoyances',
      url: 'https://filters.adtidy.org/extension/chromium/filters/14.txt',
      enabled: false,
      category: 'annoyances'
    },
    // ─── Regional Lists ────────────────────────────────────────────────
    {
      id: 'irfilter-persian',
      title: 'Persian/Farsi Ad Filter (IRFilter)',
      url: 'https://raw.githubusercontent.com/nickspaargaren/pihole-google/master/nickspaargaren-google-ads.txt',
      enabled: true,
      category: 'regional'
    },
    {
      id: 'easylist-germany',
      title: 'EasyList Germany',
      url: 'https://easylist.to/easylistgermany/easylistgermany.txt',
      enabled: false,
      category: 'regional'
    },
    {
      id: 'liste-fr',
      title: 'Liste FR (French)',
      url: 'https://easylist-downloads.adblockplus.org/liste_fr.txt',
      enabled: false,
      category: 'regional'
    },
    {
      id: 'easylist-china',
      title: 'EasyList China',
      url: 'https://easylist-downloads.adblockplus.org/easylistchina.txt',
      enabled: false,
      category: 'regional'
    },
    {
      id: 'indian-list',
      title: 'IndianList',
      url: 'https://easylist-downloads.adblockplus.org/indianlist.txt',
      enabled: false,
      category: 'regional'
    },
    {
      id: 'adguard-turkish',
      title: 'AdGuard Turkish Filter',
      url: 'https://filters.adtidy.org/extension/chromium/filters/13.txt',
      enabled: false,
      category: 'regional'
    },
    {
      id: 'hagezi-multi',
      title: 'Hagezi Multi Pro',
      url: 'https://raw.githubusercontent.com/hagezi/dns-blocklists/main/adblock/pro.txt',
      enabled: false,
      category: 'multipurpose'
    }
  ];


  // ─── Internal state ────────────────────────────────────────────────────
  var _listsMeta = null; // cached meta array
  var _updateInProgress = false;
  var _onUpdateCallbacks = [];


  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Initialize: load stored meta or set defaults, register alarm
   */
  function init() {
    return chrome.storage.local.get([STORAGE_META_KEY]).then(function(data) {
      if (data[STORAGE_META_KEY] && data[STORAGE_META_KEY].length > 0) {
        _listsMeta = data[STORAGE_META_KEY];
        // Merge any new default lists not yet in stored meta
        _mergeNewDefaults();
      } else {
        // First run: initialize from defaults
        _listsMeta = DEFAULT_LISTS.map(function(def) {
          return {
            id: def.id,
            url: def.url,
            title: def.title,
            enabled: def.enabled,
            category: def.category,
            lastUpdated: 0,
            entryCount: 0,
            error: null
          };
        });
        _saveMeta();
      }
      _registerAlarm();
      return _listsMeta;
    });
  }

  /**
   * Fetch and store all enabled lists. Returns promise with results.
   */
  function updateAllLists() {
    if (_updateInProgress) {
      return Promise.resolve({ status: 'already_running' });
    }
    _updateInProgress = true;
    console.log('[UltraBlock/ListManager] Starting update of all enabled lists...');

    var enabledLists = _listsMeta.filter(function(m) { return m.enabled; });
    var promises = enabledLists.map(function(meta) {
      return _fetchAndStore(meta);
    });

    return Promise.allSettled(promises).then(function(results) {
      _updateInProgress = false;
      _saveMeta();

      var successCount = results.filter(function(r) { return r.status === 'fulfilled' && r.value.success; }).length;
      var failCount = enabledLists.length - successCount;

      console.log('[UltraBlock/ListManager] Update complete: ' + successCount + ' OK, ' + failCount + ' failed');

      // Notify compiler to recompile
      _notifyUpdate();

      return { status: 'done', success: successCount, failed: failCount };
    });
  }

  /**
   * Get current list metadata (for popup/options UI)
   */
  function getListsMeta() {
    return _listsMeta ? _listsMeta.slice() : [];
  }

  /**
   * Enable or disable a list by id
   */
  function setListEnabled(listId, enabled) {
    var meta = _findMeta(listId);
    if (!meta) return Promise.resolve(false);
    meta.enabled = !!enabled;
    _saveMeta();
    if (enabled && meta.lastUpdated === 0) {
      // Fetch immediately if never fetched
      return _fetchAndStore(meta).then(function() {
        _saveMeta();
        _notifyUpdate();
        return true;
      });
    }
    _notifyUpdate();
    return Promise.resolve(true);
  }

  /**
   * Add a custom filter list URL
   */
  function addCustomList(url, title) {
    var id = 'custom_' + _hashString(url);
    if (_findMeta(id)) return Promise.resolve({ success: false, error: 'already_exists' });

    var meta = {
      id: id,
      url: url,
      title: title || url,
      enabled: true,
      category: 'custom',
      lastUpdated: 0,
      entryCount: 0,
      error: null
    };
    _listsMeta.push(meta);
    _saveMeta();

    return _fetchAndStore(meta).then(function(result) {
      _saveMeta();
      if (result.success) _notifyUpdate();
      return result;
    });
  }

  /**
   * Remove a custom list
   */
  function removeCustomList(listId) {
    var idx = -1;
    for (var i = 0; i < _listsMeta.length; i++) {
      if (_listsMeta[i].id === listId) { idx = i; break; }
    }
    if (idx === -1) return Promise.resolve(false);
    _listsMeta.splice(idx, 1);
    _saveMeta();

    // Remove stored text
    var removeKey = STORAGE_PREFIX + listId;
    return chrome.storage.local.remove([removeKey]).then(function() {
      _notifyUpdate();
      return true;
    });
  }

  /**
   * Get raw stored filter text for a list
   */
  function getListText(listId) {
    var key = STORAGE_PREFIX + listId;
    return chrome.storage.local.get([key]).then(function(data) {
      return data[key] || '';
    });
  }

  /**
   * Get ALL enabled list texts concatenated (for compiler)
   */
  function getAllEnabledTexts() {
    var enabledIds = _listsMeta
      .filter(function(m) { return m.enabled && m.lastUpdated > 0; })
      .map(function(m) { return STORAGE_PREFIX + m.id; });

    if (enabledIds.length === 0) return Promise.resolve('');

    return chrome.storage.local.get(enabledIds).then(function(data) {
      var texts = [];
      for (var i = 0; i < enabledIds.length; i++) {
        var text = data[enabledIds[i]];
        if (text) texts.push(text);
      }
      return texts.join('\n');
    });
  }

  /**
   * Register a callback for when lists update
   */
  function onUpdate(callback) {
    if (typeof callback === 'function') {
      _onUpdateCallbacks.push(callback);
    }
  }

  /**
   * Handle alarm trigger (called from background.js alarm listener)
   */
  function handleAlarm(alarmName) {
    if (alarmName === UPDATE_ALARM) {
      updateAllLists();
      return true;
    }
    return false;
  }

  /**
   * Force a single list update
   */
  function updateSingleList(listId) {
    var meta = _findMeta(listId);
    if (!meta) return Promise.resolve({ success: false, error: 'not_found' });
    return _fetchAndStore(meta).then(function(result) {
      _saveMeta();
      if (result.success) _notifyUpdate();
      return result;
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  function _findMeta(listId) {
    for (var i = 0; i < _listsMeta.length; i++) {
      if (_listsMeta[i].id === listId) return _listsMeta[i];
    }
    return null;
  }

  function _saveMeta() {
    var obj = {};
    obj[STORAGE_META_KEY] = _listsMeta;
    chrome.storage.local.set(obj).catch(function(e) {
      console.error('[UltraBlock/ListManager] Failed to save meta:', e);
    });
  }

  function _registerAlarm() {
    chrome.alarms.get(UPDATE_ALARM, function(existing) {
      if (!existing) {
        chrome.alarms.create(UPDATE_ALARM, {
          delayInMinutes: 1,     // First check 1 min after startup
          periodInMinutes: UPDATE_INTERVAL
        });
        console.log('[UltraBlock/ListManager] Update alarm registered (every ' + UPDATE_INTERVAL + ' min)');
      }
    });
  }

  function _fetchAndStore(meta) {
    var startTime = Date.now();
    return _fetchWithTimeout(meta.url, MAX_FETCH_TIMEOUT).then(function(text) {
      if (!text || text.length < 10) {
        meta.error = 'Empty response';
        return { success: false, id: meta.id, error: 'empty' };
      }

      // Count actual filter entries (non-comment, non-empty lines)
      var lines = text.split('\n');
      var entryCount = 0;
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line && line[0] !== '!' && line[0] !== '[' && line[0] !== '#') {
          entryCount++;
        }
      }

      meta.lastUpdated = Date.now();
      meta.entryCount = entryCount;
      meta.error = null;

      // Store the raw text
      var obj = {};
      obj[STORAGE_PREFIX + meta.id] = text;
      return chrome.storage.local.set(obj).then(function() {
        var elapsed = Date.now() - startTime;
        console.log('[UltraBlock/ListManager] Updated "' + meta.title + '": ' + entryCount + ' entries (' + elapsed + 'ms)');
        return { success: true, id: meta.id, entryCount: entryCount };
      });
    }).catch(function(err) {
      meta.error = err.message || 'fetch_failed';
      console.warn('[UltraBlock/ListManager] Failed to fetch "' + meta.title + '":', err.message);
      return { success: false, id: meta.id, error: err.message };
    });
  }

  function _fetchWithTimeout(url, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, timeoutMs);

    return fetch(url, {
      signal: controller.signal,
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    }).then(function(response) {
      clearTimeout(timer);
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.text();
    }).catch(function(err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function _notifyUpdate() {
    for (var i = 0; i < _onUpdateCallbacks.length; i++) {
      try {
        _onUpdateCallbacks[i]();
      } catch (e) {
        console.error('[UltraBlock/ListManager] Callback error:', e);
      }
    }
  }

  function _mergeNewDefaults() {
    var existingIds = {};
    for (var i = 0; i < _listsMeta.length; i++) {
      existingIds[_listsMeta[i].id] = true;
    }
    for (var j = 0; j < DEFAULT_LISTS.length; j++) {
      var def = DEFAULT_LISTS[j];
      if (!existingIds[def.id]) {
        _listsMeta.push({
          id: def.id,
          url: def.url,
          title: def.title,
          enabled: def.enabled,
          category: def.category,
          lastUpdated: 0,
          entryCount: 0,
          error: null
        });
      }
    }
  }

  function _hashString(str) {
    var hash = 5381;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0x7FFFFFFF;
    }
    return hash.toString(36);
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  return {
    init: init,
    updateAllLists: updateAllLists,
    updateSingleList: updateSingleList,
    getListsMeta: getListsMeta,
    setListEnabled: setListEnabled,
    addCustomList: addCustomList,
    removeCustomList: removeCustomList,
    getListText: getListText,
    getAllEnabledTexts: getAllEnabledTexts,
    onUpdate: onUpdate,
    handleAlarm: handleAlarm,
    DEFAULT_LISTS: DEFAULT_LISTS
  };

})();
