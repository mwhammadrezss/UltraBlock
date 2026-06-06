/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Community Reporting System
 *  Allows users to report missed ads and broken sites.
 *  Reports are stored locally and can optionally be submitted
 *  to a configured community endpoint.
 *
 *  Inspired by SponsorBlock's crowdsourced model.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBCommunityReports = (function() {

  var REPORTS_KEY = 'ub_community_reports';
  var SETTINGS_KEY = 'ub_report_settings';
  var MAX_LOCAL_REPORTS = 200;

  // Default settings
  var _settings = {
    enabled: true,
    endpoint: '',  // User-configurable API endpoint (empty = local only)
    autoSubmit: false,
    anonymousId: ''
  };

  var _reports = [];

  // ══════════════════════════════════════════════════════════════════════
  //  REPORT TYPES
  // ══════════════════════════════════════════════════════════════════════

  var REPORT_TYPES = {
    MISSED_AD: 'missed_ad',           // Ad was not blocked
    BROKEN_SITE: 'broken_site',       // Site broke due to blocking
    FALSE_POSITIVE: 'false_positive', // Non-ad content was hidden
    SPONSOR_SEGMENT: 'sponsor_segment' // YouTube sponsor timestamp
  };

  // ══════════════════════════════════════════════════════════════════════
  //  CORE API
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Submit a new report.
   * @param {object} report - { type, url, domain, selector?, description?, screenshot?, timestamp? }
   */
  function submitReport(report) {
    if (!_settings.enabled) return Promise.resolve({ success: false, reason: 'disabled' });

    // Validate
    if (!report.type || !report.url) {
      return Promise.resolve({ success: false, reason: 'missing fields' });
    }

    // Enrich report
    var enriched = {
      id: 'rpt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      type: report.type,
      url: report.url,
      domain: report.domain || extractDomain(report.url),
      selector: report.selector || null,
      description: (report.description || '').substring(0, 500),
      timestamp: report.timestamp || Date.now(),
      version: '2.5.0',
      userAgent: navigator.userAgent,
      status: 'pending' // pending → submitted → resolved
    };

    // Add sponsor segment data if applicable
    if (report.type === REPORT_TYPES.SPONSOR_SEGMENT) {
      enriched.videoId = report.videoId || null;
      enriched.startTime = report.startTime || 0;
      enriched.endTime = report.endTime || 0;
      enriched.category = report.category || 'sponsor';
    }

    _reports.push(enriched);

    // Trim old reports
    if (_reports.length > MAX_LOCAL_REPORTS) {
      _reports = _reports.slice(-MAX_LOCAL_REPORTS);
    }

    // Save locally
    return chrome.storage.local.set({ [REPORTS_KEY]: _reports }).then(function() {
      // Auto-submit if configured
      if (_settings.autoSubmit && _settings.endpoint) {
        return submitToEndpoint(enriched).then(function(ok) {
          if (ok) enriched.status = 'submitted';
          return { success: true, id: enriched.id, submitted: ok };
        });
      }
      return { success: true, id: enriched.id, submitted: false };
    });
  }

  /**
   * Get all stored reports, optionally filtered.
   */
  function getReports(filter) {
    if (!filter) return _reports;
    return _reports.filter(function(r) {
      if (filter.type && r.type !== filter.type) return false;
      if (filter.domain && r.domain !== filter.domain) return false;
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
  }

  /**
   * Delete a report by ID.
   */
  function deleteReport(id) {
    _reports = _reports.filter(function(r) { return r.id !== id; });
    return chrome.storage.local.set({ [REPORTS_KEY]: _reports });
  }

  /**
   * Clear all reports.
   */
  function clearReports() {
    _reports = [];
    return chrome.storage.local.set({ [REPORTS_KEY]: [] });
  }

  /**
   * Submit all pending reports to the configured endpoint.
   */
  function submitAllPending() {
    if (!_settings.endpoint) return Promise.resolve({ submitted: 0 });

    var pending = _reports.filter(function(r) { return r.status === 'pending'; });
    if (pending.length === 0) return Promise.resolve({ submitted: 0 });

    var promises = pending.map(function(r) {
      return submitToEndpoint(r).then(function(ok) {
        if (ok) r.status = 'submitted';
        return ok;
      });
    });

    return Promise.all(promises).then(function(results) {
      var count = results.filter(Boolean).length;
      chrome.storage.local.set({ [REPORTS_KEY]: _reports });
      return { submitted: count, total: pending.length };
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  NETWORK
  // ══════════════════════════════════════════════════════════════════════

  function submitToEndpoint(report) {
    if (!_settings.endpoint) return Promise.resolve(false);

    return fetch(_settings.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report: report,
        anonymousId: _settings.anonymousId
      })
    }).then(function(response) {
      return response.ok;
    }).catch(function() {
      return false;
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ══════════════════════════════════════════════════════════════════════

  function updateSettings(newSettings) {
    Object.assign(_settings, newSettings);
    return chrome.storage.local.set({ [SETTINGS_KEY]: _settings });
  }

  function getSettings() {
    return Object.assign({}, _settings);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  HELPERS
  // ══════════════════════════════════════════════════════════════════════

  function extractDomain(url) {
    try { return new URL(url).hostname; } catch (_) { return ''; }
  }

  function generateAnonymousId() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════════════════════════════════

  function init() {
    return chrome.storage.local.get([REPORTS_KEY, SETTINGS_KEY]).then(function(data) {
      _reports = data[REPORTS_KEY] || [];
      if (data[SETTINGS_KEY]) {
        Object.assign(_settings, data[SETTINGS_KEY]);
      }
      // Generate anonymous ID if not present
      if (!_settings.anonymousId) {
        _settings.anonymousId = generateAnonymousId();
        chrome.storage.local.set({ [SETTINGS_KEY]: _settings });
      }
      console.log('[UltraBlock/Community] Reports system ready. Stored: ' + _reports.length);
    }).catch(function() {});
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  return {
    TYPES: REPORT_TYPES,
    init: init,
    submitReport: submitReport,
    getReports: getReports,
    deleteReport: deleteReport,
    clearReports: clearReports,
    submitAllPending: submitAllPending,
    updateSettings: updateSettings,
    getSettings: getSettings
  };

})();
