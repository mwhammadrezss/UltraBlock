/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — procedural-cosmetic.js  v1.0
 *   Procedural Cosmetic Filter Engine
 *
 *   Implements advanced CSS-like selectors that can't be
 *   expressed in pure CSS:
 *     :has-text(pattern)      — match by text content
 *     :has(selector)          — match if has child matching selector
 *     :matches-css(prop:val)  — match by computed CSS property
 *     :upward(n|selector)     — select nth ancestor or closest ancestor
 *     :remove()               — remove from DOM instead of hiding
 *     :style(css)             — apply custom CSS
 *     :min-text-length(n)     — minimum text content length
 *     :watch-attr(attr)       — re-check when attribute changes
 *
 *   Filter syntax:
 *     domain.com##.container:has-text(/sponsored/i)
 *     domain.com##.post:has(> .ad-badge)
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function UltraBlockProceduralCosmetic() {

  // ─── State ──────────────────────────────────────────────────────────
  var _rules = [];
  var _processTimer = null;

  // ─── Load rules from storage ────────────────────────────────────────
  function init() {
    chrome.storage.local.get(['ub_procedural_rules'], function(data) {
      _rules = data.ub_procedural_rules || [];
      if (_rules.length > 0) {
        processAll();
        observeDOM();
      }
    });

    // Listen for rule updates
    chrome.runtime.onMessage.addListener(function(msg) {
      if (msg.action === 'updateProceduralRules') {
        _rules = msg.rules || [];
        processAll();
      }
    });
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  RULE PROCESSING
  // ═══════════════════════════════════════════════════════════════════════

  function processAll() {
    var hostname = location.hostname;

    for (var i = 0; i < _rules.length; i++) {
      var rule = _rules[i];
      // Check if rule applies to this domain
      if (rule.domains && rule.domains.length > 0) {
        var domainMatch = false;
        for (var d = 0; d < rule.domains.length; d++) {
          if (matchesDomain(hostname, rule.domains[d])) {
            domainMatch = true;
            break;
          }
        }
        if (!domainMatch) continue;
      }

      try {
        applyRule(rule);
      } catch (e) {}
    }
  }

  function applyRule(rule) {
    var selector = rule.selector;
    var action = rule.action || 'hide'; // hide, remove, style

    // Parse procedural operators
    var parsed = parseProceduralSelector(selector);
    if (!parsed) return;

    var baseElements = document.querySelectorAll(parsed.base);
    var matchedElements = [];

    for (var i = 0; i < baseElements.length; i++) {
      var el = baseElements[i];
      if (matchesAllOperators(el, parsed.operators)) {
        matchedElements.push(el);
      }
    }

    // Apply action to matched elements
    for (var j = 0; j < matchedElements.length; j++) {
      var target = matchedElements[j];

      // Apply :upward if present
      if (parsed.upward !== null) {
        target = getAncestor(target, parsed.upward);
        if (!target) continue;
      }

      if (action === 'remove' || parsed.remove) {
        target.remove();
      } else if (parsed.style) {
        target.style.cssText += parsed.style;
      } else {
        target.style.setProperty('display', 'none', 'important');
      }
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SELECTOR PARSER
  // ═══════════════════════════════════════════════════════════════════════

  function parseProceduralSelector(selector) {
    var result = {
      base: '',
      operators: [],
      upward: null,
      remove: false,
      style: ''
    };

    // Extract procedural operators
    var remaining = selector;
    var operators = [];

    // :has-text(...)
    remaining = extractOperator(remaining, ':has-text', operators);
    // :has(...)
    remaining = extractOperator(remaining, ':has', operators);
    // :matches-css(...)
    remaining = extractOperator(remaining, ':matches-css', operators);
    // :min-text-length(...)
    remaining = extractOperator(remaining, ':min-text-length', operators);
    // :upward(...)
    var upwardMatch = remaining.match(/:upward\(([^)]+)\)/);
    if (upwardMatch) {
      var upVal = upwardMatch[1].trim();
      result.upward = /^\d+$/.test(upVal) ? parseInt(upVal) : upVal;
      remaining = remaining.replace(upwardMatch[0], '');
    }
    // :nth-ancestor(...)
    var nthMatch = remaining.match(/:nth-ancestor\((\d+)\)/);
    if (nthMatch) {
      result.upward = parseInt(nthMatch[1]);
      remaining = remaining.replace(nthMatch[0], '');
    }
    // :remove()
    if (remaining.indexOf(':remove()') !== -1) {
      result.remove = true;
      remaining = remaining.replace(':remove()', '');
    }
    // :style(...)
    var styleMatch = remaining.match(/:style\(([^)]+)\)/);
    if (styleMatch) {
      result.style = styleMatch[1];
      remaining = remaining.replace(styleMatch[0], '');
    }

    result.base = remaining.trim() || '*';
    result.operators = operators;
    return result;
  }

  function extractOperator(str, opName, operators) {
    var idx = str.indexOf(opName + '(');
    while (idx !== -1) {
      var start = idx + opName.length + 1;
      var depth = 1;
      var end = start;
      while (end < str.length && depth > 0) {
        if (str[end] === '(') depth++;
        if (str[end] === ')') depth--;
        end++;
      }
      var value = str.substring(start, end - 1);
      operators.push({ type: opName.substring(1), value: value });
      str = str.substring(0, idx) + str.substring(end);
      idx = str.indexOf(opName + '(');
    }
    return str;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  OPERATOR MATCHING
  // ═══════════════════════════════════════════════════════════════════════

  function matchesAllOperators(el, operators) {
    for (var i = 0; i < operators.length; i++) {
      if (!matchesOperator(el, operators[i])) return false;
    }
    return true;
  }

  function matchesOperator(el, op) {
    switch (op.type) {
      case 'has-text':
        return matchesHasText(el, op.value);
      case 'has':
        return matchesHas(el, op.value);
      case 'matches-css':
        return matchesCSS(el, op.value);
      case 'min-text-length':
        return (el.textContent || '').length >= parseInt(op.value);
      default:
        return true;
    }
  }

  function matchesHasText(el, pattern) {
    var text = el.textContent || el.innerText || '';
    // Check if it's a regex pattern
    if (pattern[0] === '/' && pattern.lastIndexOf('/') > 0) {
      var lastSlash = pattern.lastIndexOf('/');
      var flags = pattern.slice(lastSlash + 1);
      var reStr = pattern.slice(1, lastSlash);
      try {
        var re = new RegExp(reStr, flags);
        return re.test(text);
      } catch (e) { return false; }
    }
    return text.indexOf(pattern) !== -1;
  }

  function matchesHas(el, selector) {
    try {
      return el.querySelector(selector) !== null;
    } catch (e) { return false; }
  }

  function matchesCSS(el, propValuePair) {
    var parts = propValuePair.split(':');
    if (parts.length < 2) return false;
    var prop = parts[0].trim();
    var expected = parts.slice(1).join(':').trim();
    var computed = window.getComputedStyle(el);
    var actual = computed.getPropertyValue(prop);
    if (!actual) return false;

    // Support regex
    if (expected[0] === '/' && expected.lastIndexOf('/') > 0) {
      var lastSlash = expected.lastIndexOf('/');
      try {
        var re = new RegExp(expected.slice(1, lastSlash), expected.slice(lastSlash + 1));
        return re.test(actual);
      } catch (e) { return false; }
    }
    return actual.trim() === expected;
  }

  function getAncestor(el, upward) {
    if (typeof upward === 'number') {
      var current = el;
      for (var i = 0; i < upward; i++) {
        if (!current.parentElement) return null;
        current = current.parentElement;
      }
      return current;
    }
    // String selector: use closest()
    try {
      return el.closest(upward);
    } catch (e) { return null; }
  }

  function matchesDomain(hostname, pattern) {
    if (pattern === '*') return true;
    if (hostname === pattern) return true;
    if (hostname.endsWith('.' + pattern)) return true;
    return false;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  DOM OBSERVER
  // ═══════════════════════════════════════════════════════════════════════

  function observeDOM() {
    var observer = new MutationObserver(function() {
      if (_processTimer) return;
      _processTimer = setTimeout(function() {
        _processTimer = null;
        processAll();
      }, 250);
    });

    var target = document.body || document.documentElement;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  INLINE RULE PARSING (from page-specific cosmetic filters)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Parse cosmetic filter rules passed from background and apply them.
   * Called by the message handler.
   */
  function applyRulesForHost(rules) {
    _rules = rules;
    processAll();
    observeDOM();
  }

  // Expose for background to call
  window._ubProceduralCosmetic = {
    applyRulesForHost: applyRulesForHost
  };


  // ═══════════════════════════════════════════════════════════════════════
  //  START
  // ═══════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
