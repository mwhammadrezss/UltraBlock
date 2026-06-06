/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — scriptlet-engine.js  v1.0
 *   Runtime Scriptlet Injection Engine
 *
 *   Reads scriptlet directives from filter rules and injects
 *   the matching scriptlet code into target pages.
 *
 *   Scriptlet syntax (from filter lists):
 *     example.com##+js(scriptlet-name, arg1, arg2)
 *     example.com#@#+js(scriptlet-name) ← exception
 *
 *   This engine:
 *   1. Parses scriptlet rules from compiled filter lists
 *   2. Matches rules against the current page domain
 *   3. Injects the corresponding scriptlet code via chrome.scripting
 *
 *   Called from background.js service worker.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

var UBScriptletEngine = (function() {

  // ─── Registry of all available scriptlets ───────────────────────────────
  // Maps scriptlet name → function body (as string for injection)
  var _scriptletRegistry = {};

  // ─── Parsed scriptlet rules ────────────────────────────────────────────
  // Array of { domains: [...], excludedDomains: [...], name: string, args: [...] }
  var _scriptletRules = [];

  // ─── Storage key for extracted scriptlet rules ─────────────────────────
  var STORAGE_KEY = 'ub_scriptlet_rules';


  // ═══════════════════════════════════════════════════════════════════════
  //  SCRIPTLET REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Register a scriptlet by name and code
   * @param {string} name - e.g. 'abort-on-property-read'
   * @param {string} code - function body as string
   * @param {string[]} [aliases] - alternative names
   */
  function registerScriptlet(name, code, aliases) {
    _scriptletRegistry[name] = code;
    if (aliases) {
      for (var i = 0; i < aliases.length; i++) {
        _scriptletRegistry[aliases[i]] = code;
      }
    }
  }

  /**
   * Get all registered scriptlet names
   */
  function getRegisteredNames() {
    return Object.keys(_scriptletRegistry);
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  RULE PARSING (from filter text)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Extract scriptlet rules from raw filter text
   * Lines matching: domain##+js(name, args...)
   */
  function parseRulesFromText(filterText) {
    var lines = filterText.split('\n');
    var rules = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;

      // Match: domains##+js(scriptlet-name, arg1, arg2, ...)
      var jsIdx = line.indexOf('##+js(');
      var exIdx = line.indexOf('#@#+js(');

      if (jsIdx === -1 && exIdx === -1) continue;

      var isException = exIdx !== -1;
      var splitIdx = isException ? exIdx : jsIdx;
      var prefix = isException ? '#@#+js(' : '##+js(';

      var domainPart = line.substring(0, splitIdx);
      var scriptletPart = line.substring(splitIdx + prefix.length);

      // Remove trailing )
      if (scriptletPart[scriptletPart.length - 1] === ')') {
        scriptletPart = scriptletPart.slice(0, -1);
      }

      // Parse args (comma-separated, respecting quotes)
      var args = _parseArgs(scriptletPart);
      if (args.length === 0) continue;

      var scriptletName = args[0].trim();
      // Remove .js suffix if present
      if (scriptletName.slice(-3) === '.js') {
        scriptletName = scriptletName.slice(0, -3);
      }

      var scriptletArgs = args.slice(1).map(function(a) { return a.trim(); });

      // Parse domains
      var domains = [];
      var excludedDomains = [];

      if (domainPart && domainPart !== '*') {
        var domParts = domainPart.split(',');
        for (var j = 0; j < domParts.length; j++) {
          var d = domParts[j].trim();
          if (!d) continue;
          if (d[0] === '~') {
            excludedDomains.push(d.substring(1));
          } else {
            domains.push(d);
          }
        }
      }

      if (!isException) {
        rules.push({
          domains: domains,
          excludedDomains: excludedDomains,
          name: scriptletName,
          args: scriptletArgs
        });
      }
    }

    return rules;
  }

  /**
   * Load and store scriptlet rules from filter text
   */
  function compileScriptletRules(filterText) {
    _scriptletRules = parseRulesFromText(filterText);
    console.log('[UltraBlock/ScriptletEngine] Compiled ' + _scriptletRules.length + ' scriptlet rules');

    // Store for persistence
    chrome.storage.local.set({ ub_scriptlet_rules: _scriptletRules }).catch(function() {});
    return _scriptletRules.length;
  }

  /**
   * Load stored rules (for SW restart)
   */
  function loadStoredRules() {
    return chrome.storage.local.get([STORAGE_KEY]).then(function(data) {
      _scriptletRules = data[STORAGE_KEY] || [];
      return _scriptletRules.length;
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INJECTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get scriptlet code to inject for a given hostname
   * Returns a single string of all applicable scriptlet code
   */
  function getScriptletCodeForHost(hostname) {
    var applicableRules = _getMatchingRules(hostname);
    if (applicableRules.length === 0) return '';

    var codeBlocks = [];
    for (var i = 0; i < applicableRules.length; i++) {
      var rule = applicableRules[i];
      var code = _scriptletRegistry[rule.name];
      if (!code) continue;

      // Wrap with args
      var wrappedCode = _wrapScriptlet(code, rule.args);
      codeBlocks.push(wrappedCode);
    }

    return codeBlocks.join('\n');
  }

  /**
   * Inject scriptlets into a tab for its hostname
   * Called from webNavigation.onCommitted
   */
  function injectForTab(tabId, hostname, frameId) {
    var code = getScriptletCodeForHost(hostname);
    if (!code) return Promise.resolve();

    return chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [frameId || 0] },
      func: _executeScriptletCode,
      args: [code],
      world: 'MAIN',
      injectImmediately: true
    }).catch(function(e) {
      // Silently fail for restricted pages
      if (e.message && e.message.indexOf('Cannot access') === -1) {
        console.warn('[UltraBlock/ScriptletEngine] Inject error:', e.message);
      }
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  function _getMatchingRules(hostname) {
    var matched = [];
    for (var i = 0; i < _scriptletRules.length; i++) {
      var rule = _scriptletRules[i];

      // Check excluded domains first
      if (rule.excludedDomains.length > 0) {
        var excluded = false;
        for (var j = 0; j < rule.excludedDomains.length; j++) {
          if (_domainMatches(hostname, rule.excludedDomains[j])) {
            excluded = true;
            break;
          }
        }
        if (excluded) continue;
      }

      // Check included domains
      if (rule.domains.length === 0) {
        // No domain restriction = apply everywhere
        matched.push(rule);
      } else {
        for (var k = 0; k < rule.domains.length; k++) {
          if (_domainMatches(hostname, rule.domains[k])) {
            matched.push(rule);
            break;
          }
        }
      }
    }
    return matched;
  }

  function _domainMatches(hostname, pattern) {
    if (pattern === '*') return true;
    if (hostname === pattern) return true;
    // Check subdomain match: hostname ends with .pattern
    if (hostname.length > pattern.length &&
        hostname[hostname.length - pattern.length - 1] === '.' &&
        hostname.slice(-pattern.length) === pattern) {
      return true;
    }
    return false;
  }

  function _wrapScriptlet(code, args) {
    // Convert args to JSON-safe string representation
    var argsStr = JSON.stringify(args);
    return '(function() {\n' +
           '  var args = ' + argsStr + ';\n' +
           '  ' + code + '\n' +
           '})();';
  }

  /**
   * This function is injected into the page context
   */
  function _executeScriptletCode(code) {
    try {
      var script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (e) {}
  }

  function _parseArgs(str) {
    var args = [];
    var current = '';
    var inQuote = false;
    var quoteChar = '';

    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      if (inQuote) {
        if (ch === quoteChar) {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === ',') {
        args.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    if (current) args.push(current);
    return args;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ═══════════════════════════════════════════════════════════════════════
  return {
    registerScriptlet: registerScriptlet,
    getRegisteredNames: getRegisteredNames,
    parseRulesFromText: parseRulesFromText,
    compileScriptletRules: compileScriptletRules,
    loadStoredRules: loadStoredRules,
    getScriptletCodeForHost: getScriptletCodeForHost,
    injectForTab: injectForTab
  };

})();
