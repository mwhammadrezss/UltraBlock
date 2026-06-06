/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — dynamic-filtering.js  v1.0
 *   Dynamic Filtering Matrix (Firewall)
 *
 *   Per-site/global rules for blocking request types:
 *   - 3rd-party scripts, frames, images, etc.
 *   - Specific domain blocking
 *   - Granular control similar to uBlock's dynamic filtering
 *
 *   Rule format:
 *     { from: "youtube.com", to: "*", type: "3p-script", action: "block" }
 *     { from: "*", to: "facebook.net", type: "*", action: "block" }
 *
 *   Actions: "allow", "block", "noop" (inherit default)
 *   Types: "3p", "3p-script", "3p-frame", "1p-script", "image", "inline-script"
 *
 *   Storage key: 'ub_dynamic_rules'
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBDynamicFiltering = (function() {

  // ─── Constants ──────────────────────────────────────────────────────
  var STORAGE_KEY = 'ub_dynamic_rules';
  var DNR_DYNAMIC_BASE = 300000; // Rule ID base for dynamic filtering rules

  // ─── State ──────────────────────────────────────────────────────────
  var _rules = [];

  // ─── Type mapping ──────────────────────────────────────────────────
  var TYPE_MAP = {
    '3p-script': { resourceTypes: ['script'], domainType: 'thirdParty' },
    '3p-frame': { resourceTypes: ['sub_frame'], domainType: 'thirdParty' },
    '3p-image': { resourceTypes: ['image'], domainType: 'thirdParty' },
    '3p': { resourceTypes: ['script', 'sub_frame', 'image', 'stylesheet', 'font', 'xmlhttprequest', 'media', 'object', 'other'], domainType: 'thirdParty' },
    'image': { resourceTypes: ['image'] },
    'script': { resourceTypes: ['script'] },
    'frame': { resourceTypes: ['sub_frame'] },
    'media': { resourceTypes: ['media'] },
    'font': { resourceTypes: ['font'] },
    'xhr': { resourceTypes: ['xmlhttprequest'] },
    'css': { resourceTypes: ['stylesheet'] }
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════

  function init() {
    return chrome.storage.local.get([STORAGE_KEY]).then(function(data) {
      _rules = data[STORAGE_KEY] || [];
      return applyRulesToDNR();
    });
  }

  /**
   * Add or update a dynamic filtering rule
   */
  function setRule(from, to, type, action) {
    // Remove existing rule with same from/to/type
    _rules = _rules.filter(function(r) {
      return !(r.from === from && r.to === to && r.type === type);
    });

    if (action !== 'noop') {
      _rules.push({ from: from, to: to, type: type, action: action });
    }

    return _save().then(function() {
      return applyRulesToDNR();
    });
  }

  /**
   * Remove a rule
   */
  function removeRule(from, to, type) {
    _rules = _rules.filter(function(r) {
      return !(r.from === from && r.to === to && r.type === type);
    });
    return _save().then(function() {
      return applyRulesToDNR();
    });
  }

  /**
   * Get all rules
   */
  function getRules() {
    return _rules.slice();
  }

  /**
   * Get rules applicable to a specific site
   */
  function getRulesForSite(hostname) {
    return _rules.filter(function(r) {
      return r.from === '*' || r.from === hostname ||
             hostname.endsWith('.' + r.from);
    });
  }

  /**
   * Clear all dynamic filtering rules
   */
  function clearAll() {
    _rules = [];
    return _save().then(function() {
      return applyRulesToDNR();
    });
  }

  /**
   * Check if a request would be blocked by dynamic filtering
   */
  function wouldBlock(fromDomain, toDomain, resourceType, isThirdParty) {
    for (var i = 0; i < _rules.length; i++) {
      var rule = _rules[i];

      // Check 'from' match
      if (rule.from !== '*' && !domainMatches(fromDomain, rule.from)) continue;

      // Check 'to' match
      if (rule.to !== '*' && !domainMatches(toDomain, rule.to)) continue;

      // Check type match
      if (rule.type !== '*') {
        var typeInfo = TYPE_MAP[rule.type];
        if (!typeInfo) continue;
        if (typeInfo.resourceTypes && typeInfo.resourceTypes.indexOf(resourceType) === -1) continue;
        if (typeInfo.domainType === 'thirdParty' && !isThirdParty) continue;
      }

      return rule.action === 'block';
    }

    return false; // No matching rule = allow
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  DNR CONVERSION
  // ═══════════════════════════════════════════════════════════════════════

  function applyRulesToDNR() {
    var dnrRules = [];
    var ruleId = DNR_DYNAMIC_BASE;

    for (var i = 0; i < _rules.length; i++) {
      var rule = _rules[i];
      var dnrRule = convertToDNR(rule, ruleId++);
      if (dnrRule) dnrRules.push(dnrRule);
    }

    // Remove old dynamic filtering rules and add new ones
    return chrome.declarativeNetRequest.getDynamicRules().then(function(existing) {
      var idsToRemove = [];
      for (var j = 0; j < existing.length; j++) {
        if (existing[j].id >= DNR_DYNAMIC_BASE && existing[j].id < DNR_DYNAMIC_BASE + 10000) {
          idsToRemove.push(existing[j].id);
        }
      }
      return chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: idsToRemove,
        addRules: dnrRules
      });
    });
  }

  function convertToDNR(rule, id) {
    var condition = {};
    var typeInfo = TYPE_MAP[rule.type];

    // Resource types
    if (typeInfo && typeInfo.resourceTypes) {
      condition.resourceTypes = typeInfo.resourceTypes;
    }

    // Domain type (1p/3p)
    if (typeInfo && typeInfo.domainType) {
      condition.domainType = typeInfo.domainType;
    }

    // From (initiator) domain
    if (rule.from && rule.from !== '*') {
      condition.initiatorDomains = [rule.from];
    }

    // To (request) domain
    if (rule.to && rule.to !== '*') {
      condition.requestDomains = [rule.to];
    }

    // Need at least one condition
    if (Object.keys(condition).length === 0) {
      condition.urlFilter = '*';
    }

    return {
      id: id,
      priority: rule.action === 'allow' ? 200 : 150, // Higher than filter lists
      action: { type: rule.action === 'allow' ? 'allow' : 'block' },
      condition: condition
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INTERNAL
  // ═══════════════════════════════════════════════════════════════════════

  function _save() {
    var obj = {};
    obj[STORAGE_KEY] = _rules;
    return chrome.storage.local.set(obj);
  }

  function domainMatches(hostname, pattern) {
    if (pattern === '*') return true;
    if (hostname === pattern) return true;
    if (hostname.endsWith('.' + pattern)) return true;
    return false;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  return {
    init: init,
    setRule: setRule,
    removeRule: removeRule,
    getRules: getRules,
    getRulesForSite: getRulesForSite,
    clearAll: clearAll,
    wouldBlock: wouldBlock,
    applyRulesToDNR: applyRulesToDNR
  };

})();
