/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — filter-compiler.js  v1.0
 *   ABP/uBlock Filter Syntax → declarativeNetRequest Compiler
 *
 *   Parses filter list text in AdBlock Plus / uBlock Origin
 *   syntax and converts it to Chrome declarativeNetRequest
 *   dynamic rules.
 *
 *   Supported syntax:
 *     ||domain.com^                    → block rule
 *     ||domain.com^$third-party        → block with domainType
 *     @@||domain.com^                  → allow rule
 *     *$removeparam=utm_source         → redirect (strip param)
 *     /regex/$options                  → regexFilter
 *     $script,$image,$stylesheet, etc  → resourceTypes
 *     $domain=x.com|~y.com            → initiatorDomains
 *     ||domain.com^$redirect=noop.js   → redirect to resource
 *
 *   Chrome limits:
 *     - MAX_NUMBER_OF_DYNAMIC_RULES = 30000
 *     - Dynamic rules share space with session rules
 *
 *   Storage key: 'ub_compiled_rules_count'
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBFilterCompiler = (function() {

  // ─── Constants ──────────────────────────────────────────────────────────
  var MAX_DYNAMIC_RULES = 28000; // leave headroom below 30000
  var RULE_ID_BASE      = 100000; // start IDs high to avoid collision with static rules
  var REMOVEPARAM_BASE  = 200000;

  // ─── Resource type mapping (ABP option → DNR resourceType) ─────────────
  var RESOURCE_TYPE_MAP = {
    'script':         'script',
    'image':          'image',
    'stylesheet':     'stylesheet',
    'css':            'stylesheet',
    'object':         'object',
    'xmlhttprequest': 'xmlhttprequest',
    'xhr':            'xmlhttprequest',
    'sub_frame':      'sub_frame',
    'subdocument':    'sub_frame',
    'font':           'font',
    'media':          'media',
    'websocket':      'websocket',
    'ping':           'ping',
    'other':          'other',
    'main_frame':     'main_frame',
    'document':       'main_frame',
    'popup':          'main_frame'
  };

  // All valid DNR resource types
  var ALL_RESOURCE_TYPES = [
    'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
    'font', 'object', 'xmlhttprequest', 'ping', 'media',
    'websocket', 'webtransport', 'webbundle', 'other'
  ];

  // ─── Common tracking parameters to strip ───────────────────────────────
  var DEFAULT_REMOVEPARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'utm_name', 'utm_cid', 'utm_reader', 'utm_viz_id', 'utm_pubreferrer',
    'utm_swu', 'utm_referrer',
    'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
    'msclkid', 'twclid', 'igshid', 'igsh',
    'mc_cid', 'mc_eid',
    'yclid', '_openstat',
    'hsa_cam', 'hsa_grp', 'hsa_mt', 'hsa_src', 'hsa_ad', 'hsa_acc',
    'hsa_net', 'hsa_ver', 'hsa_la', 'hsa_ol', 'hsa_kw',
    '_hsenc', '_hsmi', '__hstc', '__hsfp', 'hsCtaTracking',
    'ref_src', 'ref_url',
    'vero_id', 'vero_conv',
    'wickedid',
    'oly_anon_id', 'oly_enc_id',
    'rb_clickid', 's_cid',
    'ml_subscriber', 'ml_subscriber_hash',
    'trk_contact', 'trk_msg', 'trk_module', 'trk_sid',
    'at_medium', 'at_campaign',
    'si', 'feature' // Spotify, YouTube share params
  ];


  // ═══════════════════════════════════════════════════════════════════════
  //  MAIN COMPILE FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Compile raw filter text into DNR rules and apply them.
   * @param {string} filterText - concatenated filter list text
   * @returns {Promise<{ruleCount: number, errors: number}>}
   */
  function compileAndApply(filterText) {
    console.log('[UltraBlock/Compiler] Starting compilation...');
    var startTime = Date.now();

    var rules = compile(filterText);

    // Add default removeparam rules
    var removeparamRules = _buildRemoveparamRules();
    rules = rules.concat(removeparamRules);

    // Enforce limit
    if (rules.length > MAX_DYNAMIC_RULES) {
      console.warn('[UltraBlock/Compiler] Truncating rules: ' + rules.length + ' → ' + MAX_DYNAMIC_RULES);
      // Sort by priority (higher priority first), then truncate
      rules.sort(function(a, b) { return (b.priority || 1) - (a.priority || 1); });
      rules = rules.slice(0, MAX_DYNAMIC_RULES);
    }

    // Assign unique IDs
    for (var i = 0; i < rules.length; i++) {
      rules[i].id = RULE_ID_BASE + i;
    }

    var elapsed = Date.now() - startTime;
    console.log('[UltraBlock/Compiler] Compiled ' + rules.length + ' rules in ' + elapsed + 'ms');

    // Apply to Chrome DNR
    return _applyRules(rules).then(function() {
      // Store count for UI
      chrome.storage.local.set({ ub_compiled_rules_count: rules.length }).catch(function() {});
      return { ruleCount: rules.length, elapsed: elapsed };
    });
  }

  /**
   * Parse filter text into array of DNR rule objects (without IDs)
   */
  function compile(filterText) {
    var lines = filterText.split('\n');
    var rules = [];
    var errors = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();

      // Skip empty, comments, metadata
      if (!line) continue;
      if (line[0] === '!' || line[0] === '[' || line[0] === '#') continue;
      if (line.indexOf('!#') === 0) continue;

      // Skip cosmetic/scriptlet filters (handled elsewhere)
      if (line.indexOf('##') !== -1 || line.indexOf('#@#') !== -1) continue;
      if (line.indexOf('##+js(') !== -1 || line.indexOf('#@#+js(') !== -1) continue;
      if (line.indexOf('#%#') !== -1) continue;

      try {
        var rule = _parseLine(line);
        if (rule) {
          rules.push(rule);
        }
      } catch (e) {
        errors++;
      }

      // Safety: stop if we've hit the limit
      if (rules.length >= MAX_DYNAMIC_RULES) break;
    }

    if (errors > 0) {
      console.log('[UltraBlock/Compiler] Skipped ' + errors + ' unparseable lines');
    }

    return rules;
  }

  /**
   * Get the count of currently applied dynamic filter rules
   */
  function getRuleCount() {
    return chrome.storage.local.get(['ub_compiled_rules_count']).then(function(data) {
      return data.ub_compiled_rules_count || 0;
    });
  }

  /**
   * Remove all compiled dynamic rules (reset)
   */
  function clearCompiledRules() {
    return chrome.declarativeNetRequest.getDynamicRules().then(function(existingRules) {
      var idsToRemove = [];
      for (var i = 0; i < existingRules.length; i++) {
        var id = existingRules[i].id;
        if (id >= RULE_ID_BASE) {
          idsToRemove.push(id);
        }
      }
      if (idsToRemove.length === 0) return;
      return chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: idsToRemove,
        addRules: []
      });
    }).then(function() {
      chrome.storage.local.set({ ub_compiled_rules_count: 0 }).catch(function() {});
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  LINE PARSER
  // ═══════════════════════════════════════════════════════════════════════

  function _parseLine(line) {
    var isException = false;
    var raw = line;

    // Exception rules: @@
    if (line.indexOf('@@') === 0) {
      isException = true;
      line = line.substring(2);
    }

    // Split filter pattern from options
    var optionStr = '';
    var dollarIdx = _findOptionsSeparator(line);
    if (dollarIdx !== -1) {
      optionStr = line.substring(dollarIdx + 1);
      line = line.substring(0, dollarIdx);
    }

    // Parse options
    var options = _parseOptions(optionStr);

    // Skip unsupported option combinations
    if (options._unsupported) return null;

    // Handle $removeparam
    if (options.removeparam) {
      return _buildSingleRemoveparam(line, options, isException);
    }

    // Build the condition
    var condition = {};

    // Determine the URL filter or regex
    if (line.indexOf('/') === 0 && line.lastIndexOf('/') > 0) {
      // Regex filter: /pattern/
      var regexEnd = line.lastIndexOf('/');
      var regexBody = line.substring(1, regexEnd);
      if (regexBody) {
        condition.regexFilter = regexBody;
        condition.isUrlFilterCaseSensitive = false;
      } else {
        return null;
      }
    } else {
      // Convert ABP pattern to urlFilter
      var urlFilter = _patternToUrlFilter(line);
      if (!urlFilter) return null;
      condition.urlFilter = urlFilter;
    }

    // Resource types
    if (options.types && options.types.length > 0) {
      condition.resourceTypes = options.types;
    } else if (options.excludedTypes && options.excludedTypes.length > 0) {
      // Compute included types as ALL minus excluded
      condition.resourceTypes = ALL_RESOURCE_TYPES.filter(function(t) {
        return options.excludedTypes.indexOf(t) === -1;
      });
    }

    // Domain type (third-party / first-party)
    if (options.thirdParty === true) {
      condition.domainType = 'thirdParty';
    } else if (options.thirdParty === false) {
      condition.domainType = 'firstParty';
    }

    // Initiator domains ($domain=)
    if (options.domains && options.domains.length > 0) {
      condition.initiatorDomains = options.domains;
    }
    if (options.excludedDomains && options.excludedDomains.length > 0) {
      condition.excludedInitiatorDomains = options.excludedDomains;
    }

    // Request domains
    if (options.to && options.to.length > 0) {
      condition.requestDomains = options.to;
    }

    // Build the rule
    var rule = {
      priority: isException ? 100 : (options.important ? 50 : 1),
      condition: condition,
      action: {}
    };

    if (isException) {
      rule.action.type = 'allow';
    } else if (options.redirect) {
      // $redirect — will be handled by redirect engine
      rule.action.type = 'redirect';
      rule.action.redirect = { extensionPath: '/src/redirects/' + options.redirect };
    } else {
      rule.action.type = 'block';
    }

    return rule;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  OPTIONS PARSER
  // ═══════════════════════════════════════════════════════════════════════

  function _parseOptions(optionStr) {
    var result = {
      types: [],
      excludedTypes: [],
      thirdParty: null,
      important: false,
      domains: [],
      excludedDomains: [],
      to: [],
      redirect: null,
      removeparam: null,
      _unsupported: false
    };

    if (!optionStr) return result;

    var parts = optionStr.split(',');
    for (var i = 0; i < parts.length; i++) {
      var opt = parts[i].trim();
      if (!opt) continue;

      var negated = false;
      if (opt[0] === '~') {
        negated = true;
        opt = opt.substring(1);
      }

      // Check for value options (key=value)
      var eqIdx = opt.indexOf('=');
      var key = eqIdx !== -1 ? opt.substring(0, eqIdx) : opt;
      var value = eqIdx !== -1 ? opt.substring(eqIdx + 1) : '';

      switch (key) {
        case 'third-party':
        case '3p':
          result.thirdParty = !negated;
          break;
        case 'first-party':
        case '1p':
          result.thirdParty = negated ? true : false;
          break;
        case 'important':
          result.important = true;
          break;
        case 'domain':
        case 'from':
          _parseDomainList(value, result.domains, result.excludedDomains);
          break;
        case 'to':
          _parseDomainList(value, result.to, []);
          break;
        case 'redirect':
        case 'redirect-rule':
        case 'rewrite':
          result.redirect = value;
          break;
        case 'removeparam':
        case 'queryprune':
          result.removeparam = value || '*';
          break;
        case 'csp':
        case 'permissions':
        case 'header':
          // These need special handling, skip for now
          result._unsupported = true;
          break;
        case 'match-case':
          // handled in condition
          break;
        case 'badfilter':
          result._unsupported = true;
          break;
        case 'all':
          // $all means all resource types
          result.types = ALL_RESOURCE_TYPES.slice();
          break;
        default:
          // Check if it's a resource type
          var mappedType = RESOURCE_TYPE_MAP[key];
          if (mappedType) {
            if (negated) {
              result.excludedTypes.push(mappedType);
            } else {
              result.types.push(mappedType);
            }
          }
          break;
      }
    }

    return result;
  }

  function _parseDomainList(value, includedArr, excludedArr) {
    if (!value) return;
    var domains = value.split('|');
    for (var i = 0; i < domains.length; i++) {
      var d = domains[i].trim();
      if (!d) continue;
      if (d[0] === '~') {
        excludedArr.push(d.substring(1));
      } else {
        includedArr.push(d);
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  PATTERN CONVERSION
  // ═══════════════════════════════════════════════════════════════════════

  function _patternToUrlFilter(pattern) {
    if (!pattern || pattern === '*') return null; // too broad

    // The DNR urlFilter supports:
    //   * → wildcard
    //   ^ → separator (any of :/?#[] or end)
    //   || → domain anchor
    //   | → start/end anchor

    // Already valid as-is for DNR (|| ^ * | are all supported)
    // Just do minimal cleanup
    var filter = pattern;

    // Remove trailing * (redundant)
    while (filter.length > 1 && filter[filter.length - 1] === '*') {
      filter = filter.slice(0, -1);
    }

    // Remove leading * (redundant unless anchored)
    if (filter[0] === '*') {
      filter = filter.substring(1);
    }

    // Reject if empty or only wildcards/separators
    if (!filter || filter === '^' || filter === '|') return null;

    // Reject patterns that are too short (would match too broadly)
    var significantChars = filter.replace(/[*^|]/g, '');
    if (significantChars.length < 3) return null;

    return filter;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  $removeparam RULES
  // ═══════════════════════════════════════════════════════════════════════

  function _buildRemoveparamRules() {
    var rules = [];
    for (var i = 0; i < DEFAULT_REMOVEPARAMS.length; i++) {
      var param = DEFAULT_REMOVEPARAMS[i];
      rules.push({
        priority: 1,
        action: {
          type: 'redirect',
          redirect: {
            transform: {
              queryTransform: {
                removeParams: [param]
              }
            }
          }
        },
        condition: {
          urlFilter: '*' + param + '=*',
          resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
        }
      });
    }
    return rules;
  }

  function _buildSingleRemoveparam(pattern, options, isException) {
    if (isException) return null; // @@$removeparam not easily supported in DNR

    var param = options.removeparam;
    if (!param || param === '*') return null; // too broad

    var rule = {
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          transform: {
            queryTransform: {
              removeParams: [param]
            }
          }
        }
      },
      condition: {
        resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest']
      }
    };

    // Apply pattern as URL filter if present
    if (pattern && pattern !== '*' && pattern !== '') {
      var urlFilter = _patternToUrlFilter(pattern);
      if (urlFilter) {
        rule.condition.urlFilter = urlFilter;
      }
    }

    // Apply domain restriction
    if (options.domains && options.domains.length > 0) {
      rule.condition.initiatorDomains = options.domains;
    }

    return rule;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  APPLY RULES TO CHROME DNR
  // ═══════════════════════════════════════════════════════════════════════

  function _applyRules(newRules) {
    return chrome.declarativeNetRequest.getDynamicRules().then(function(existingRules) {
      // Find all rule IDs in our range to remove
      var idsToRemove = [];
      for (var i = 0; i < existingRules.length; i++) {
        var id = existingRules[i].id;
        if (id >= RULE_ID_BASE) {
          idsToRemove.push(id);
        }
      }

      // Chrome has a limit on how many rules can be added in one call
      // Split into batches if needed
      var BATCH_SIZE = 5000;
      var batches = [];
      for (var j = 0; j < newRules.length; j += BATCH_SIZE) {
        batches.push(newRules.slice(j, j + BATCH_SIZE));
      }

      // First remove all old rules
      var chain = chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: idsToRemove,
        addRules: batches[0] || []
      });

      // Then add remaining batches
      for (var k = 1; k < batches.length; k++) {
        (function(batch) {
          chain = chain.then(function() {
            return chrome.declarativeNetRequest.updateDynamicRules({
              removeRuleIds: [],
              addRules: batch
            });
          });
        })(batches[k]);
      }

      return chain;
    }).catch(function(e) {
      console.error('[UltraBlock/Compiler] Failed to apply rules:', e);
      throw e;
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  UTILITY
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Find the $ that separates pattern from options.
   * Must handle cases where $ appears in regex or URL patterns.
   */
  function _findOptionsSeparator(line) {
    // If it's a regex pattern, the separator is after the closing /
    if (line[0] === '/' && line.indexOf('/', 1) > 0) {
      var regexEnd = line.lastIndexOf('/');
      var afterRegex = line.indexOf('$', regexEnd);
      return afterRegex;
    }

    // For normal patterns, find last $ that isn't escaped
    // Heuristic: use last $ sign (ABP convention)
    var idx = line.lastIndexOf('$');
    if (idx <= 0) return -1;

    // Verify it's not part of a URL (e.g., "$" in query strings)
    // If everything after $ looks like valid options, use it
    var after = line.substring(idx + 1);
    if (_looksLikeOptions(after)) {
      return idx;
    }

    return -1;
  }

  function _looksLikeOptions(str) {
    if (!str) return false;
    // Options are comma-separated keywords, possibly with = values
    // Quick check: does it contain at least one known keyword?
    var knownOptions = [
      'third-party', '3p', 'first-party', '1p', 'important',
      'domain', 'from', 'to', 'redirect', 'removeparam', 'queryprune',
      'script', 'image', 'stylesheet', 'css', 'xmlhttprequest', 'xhr',
      'sub_frame', 'subdocument', 'font', 'media', 'websocket', 'ping',
      'object', 'other', 'document', 'popup', 'all', 'match-case',
      'badfilter', 'csp', 'redirect-rule', 'rewrite', 'main_frame',
      'header', 'permissions'
    ];
    var parts = str.split(',');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim().replace(/^~/, '');
      var k = p.split('=')[0];
      if (knownOptions.indexOf(k) !== -1) return true;
    }
    return false;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  return {
    compile: compile,
    compileAndApply: compileAndApply,
    clearCompiledRules: clearCompiledRules,
    getRuleCount: getRuleCount,
    MAX_DYNAMIC_RULES: MAX_DYNAMIC_RULES,
    DEFAULT_REMOVEPARAMS: DEFAULT_REMOVEPARAMS
  };

})();
