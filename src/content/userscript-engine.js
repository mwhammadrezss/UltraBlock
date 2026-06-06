/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — UserScript Engine (Greasemonkey/Tampermonkey Compatible)
 *  Executes user-provided scripts with GM_* API support.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  const SCRIPTS_KEY = 'ub_userscripts';
  const GM_VALUES_KEY = 'ub_gm_values';

  let installedScripts = [];
  let currentUrl = window.location.href;
  let currentHost = window.location.hostname;

  // ── Init ──────────────────────────────────────────────────────────────
  function init() {
    chrome.storage.local.get([SCRIPTS_KEY], result => {
      installedScripts = result[SCRIPTS_KEY] || [];
      runMatchingScripts();
    });
    setupMessageListener();
  }

  // ── Match scripts to current page ─────────────────────────────────────
  function runMatchingScripts() {
    for (const script of installedScripts) {
      if (!script.enabled) continue;
      if (matchesUrl(script)) {
        injectScript(script);
      }
    }
  }

  // ── URL matching (supports @match and @include patterns) ──────────────
  function matchesUrl(script) {
    const patterns = [...(script.match || []), ...(script.include || [])];
    const excludes = script.exclude || [];

    // Check excludes first
    for (const pattern of excludes) {
      if (testPattern(pattern, currentUrl)) return false;
    }

    // If no patterns specified, match all
    if (patterns.length === 0) return true;

    for (const pattern of patterns) {
      if (testPattern(pattern, currentUrl)) return true;
    }
    return false;
  }

  function testPattern(pattern, url) {
    // Handle @match format: *://*.example.com/*
    if (pattern.includes('://')) {
      const regex = matchPatternToRegex(pattern);
      return regex.test(url);
    }
    // Handle @include format (glob): *example.com*
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                           .replace(/\*/g, '.*')
                           .replace(/\?/g, '.');
    return new RegExp('^' + escaped + '$').test(url);
  }

  function matchPatternToRegex(pattern) {
    // Convert Chrome match pattern to regex
    let regex = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special chars
      .replace(/\\\*/g, '.*')                  // * → .*
      .replace(/\\\*:\/\//g, '(https?|file):\\/\\/'); // *:// → protocol
    // Handle *.domain → optional subdomain
    regex = regex.replace(/\.\*\\\./g, '([^/]*\\.)?');
    return new RegExp('^' + regex + '$');
  }

  // ── Inject script with GM_* API ──────────────────────────────────────
  function injectScript(script) {
    const runAt = script.runAt || 'document-idle';

    const executor = () => {
      try {
        // Build GM_* API for this script
        const gmApi = buildGMApi(script);
        const wrappedCode = wrapWithGMApi(script.code, gmApi, script);

        // Execute in page context via script element
        const scriptEl = document.createElement('script');
        scriptEl.textContent = wrappedCode;
        (document.head || document.documentElement).appendChild(scriptEl);
        scriptEl.remove();
      } catch (e) {
        console.error(`[UltraBlock/UserScript] Error in "${script.name}":`, e);
      }
    };

    if (runAt === 'document-start') {
      executor();
    } else if (runAt === 'document-end') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', executor);
      } else {
        executor();
      }
    } else { // document-idle
      if (document.readyState === 'complete') {
        executor();
      } else {
        window.addEventListener('load', executor);
      }
    }
  }

  // ── Build GM_* API ────────────────────────────────────────────────────
  function buildGMApi(script) {
    const scriptId = script.id || script.name;

    return {
      GM_info: {
        script: {
          name: script.name,
          version: script.version || '1.0',
          description: script.description || '',
          author: script.author || ''
        },
        scriptHandler: 'UltraBlock',
        version: '2.4.0'
      },

      // Storage
      GM_getValue: `function(key, defaultValue) {
        try {
          const data = JSON.parse(localStorage.getItem('_ub_gm_${scriptId}') || '{}');
          return key in data ? data[key] : defaultValue;
        } catch(e) { return defaultValue; }
      }`,

      GM_setValue: `function(key, value) {
        try {
          const data = JSON.parse(localStorage.getItem('_ub_gm_${scriptId}') || '{}');
          data[key] = value;
          localStorage.setItem('_ub_gm_${scriptId}', JSON.stringify(data));
        } catch(e) {}
      }`,

      GM_deleteValue: `function(key) {
        try {
          const data = JSON.parse(localStorage.getItem('_ub_gm_${scriptId}') || '{}');
          delete data[key];
          localStorage.setItem('_ub_gm_${scriptId}', JSON.stringify(data));
        } catch(e) {}
      }`,

      GM_listValues: `function() {
        try {
          return Object.keys(JSON.parse(localStorage.getItem('_ub_gm_${scriptId}') || '{}'));
        } catch(e) { return []; }
      }`,

      // Logging
      GM_log: `function() { console.log('[UserScript/${script.name}]', ...arguments); }`,

      // DOM
      GM_addStyle: `function(css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
      }`,

      // Clipboard
      GM_setClipboard: `function(text) {
        navigator.clipboard.writeText(text).catch(function(){});
      }`,

      // Notification (simplified)
      GM_notification: `function(opts) {
        if (typeof opts === 'string') opts = { text: opts };
        const n = document.createElement('div');
        n.style.cssText = 'position:fixed;top:10px;right:10px;z-index:999999;background:#1c2128;color:#e6edf3;padding:12px 18px;border-radius:8px;border:1px solid #30363d;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
        n.textContent = opts.text || opts.title || '';
        document.body.appendChild(n);
        setTimeout(function() { n.remove(); }, opts.timeout || 4000);
      }`,

      // XHR (simplified — same-origin only in content script context)
      GM_xmlhttpRequest: `function(opts) {
        fetch(opts.url, {
          method: opts.method || 'GET',
          headers: opts.headers || {},
          body: opts.data || null
        }).then(function(r) { return r.text(); })
          .then(function(text) { if (opts.onload) opts.onload({ responseText: text, status: 200 }); })
          .catch(function(e) { if (opts.onerror) opts.onerror(e); });
      }`,

      // Open in new tab
      GM_openInTab: `function(url, opts) { window.open(url, '_blank'); }`,

      // Unsafewindow
      unsafeWindow: 'window'
    };
  }

  function wrapWithGMApi(code, api, script) {
    const apiDefs = [];
    for (const [name, impl] of Object.entries(api)) {
      if (name === 'GM_info') {
        apiDefs.push(`var GM_info = ${JSON.stringify(impl)};`);
      } else if (name === 'unsafeWindow') {
        apiDefs.push(`var unsafeWindow = ${impl};`);
      } else {
        apiDefs.push(`var ${name} = ${impl};`);
      }
    }

    // Also provide GM.* promise-based API
    const gmAsync = `
      var GM = {
        info: GM_info,
        getValue: function(k,d) { return Promise.resolve(GM_getValue(k,d)); },
        setValue: function(k,v) { GM_setValue(k,v); return Promise.resolve(); },
        deleteValue: function(k) { GM_deleteValue(k); return Promise.resolve(); },
        listValues: function() { return Promise.resolve(GM_listValues()); },
        setClipboard: function(t) { GM_setClipboard(t); return Promise.resolve(); },
        notification: function(o) { GM_notification(o); return Promise.resolve(); },
        xmlHttpRequest: function(o) { return new Promise(function(res,rej){ o.onload=res; o.onerror=rej; GM_xmlhttpRequest(o); }); },
        openInTab: function(u,o) { GM_openInTab(u,o); return Promise.resolve(); }
      };
    `;

    return `(function() {\n${apiDefs.join('\n')}\n${gmAsync}\n\n// --- UserScript: ${script.name} ---\n${code}\n})();`;
  }

  // ── Parse userscript metadata block ───────────────────────────────────
  function parseMetadata(code) {
    const meta = {
      name: 'Untitled Script',
      version: '1.0',
      description: '',
      author: '',
      match: [],
      include: [],
      exclude: [],
      runAt: 'document-idle',
      grant: [],
      enabled: true
    };

    const metaBlock = code.match(/\/\/\s*==UserScript==\s*\n([\s\S]*?)\/\/\s*==\/UserScript==/);
    if (!metaBlock) return meta;

    const lines = metaBlock[1].split('\n');
    for (const line of lines) {
      const m = line.match(/\/\/\s*@(\S+)\s+(.*)/);
      if (!m) continue;
      const [, key, value] = m;
      const v = value.trim();

      switch (key) {
        case 'name': meta.name = v; break;
        case 'version': meta.version = v; break;
        case 'description': meta.description = v; break;
        case 'author': meta.author = v; break;
        case 'match': meta.match.push(v); break;
        case 'include': meta.include.push(v); break;
        case 'exclude': meta.exclude.push(v); break;
        case 'run-at': meta.runAt = v.replace('document_', 'document-'); break;
        case 'grant': meta.grant.push(v); break;
      }
    }

    return meta;
  }

  // ── Message listener ──────────────────────────────────────────────────
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'getUserScripts') {
        sendResponse({ scripts: installedScripts.map(s => ({ ...s, code: undefined })) });
        return false;
      }

      if (msg.action === 'installUserScript') {
        const code = msg.code;
        const meta = parseMetadata(code);
        const script = {
          ...meta,
          id: 'us_' + Date.now(),
          code: code,
          installedAt: Date.now()
        };
        installedScripts.push(script);
        chrome.storage.local.set({ [SCRIPTS_KEY]: installedScripts });
        sendResponse({ success: true, script: { ...script, code: undefined } });
        return false;
      }

      if (msg.action === 'removeUserScript') {
        installedScripts = installedScripts.filter(s => s.id !== msg.scriptId);
        chrome.storage.local.set({ [SCRIPTS_KEY]: installedScripts });
        sendResponse({ success: true });
        return false;
      }

      if (msg.action === 'toggleUserScript') {
        const s = installedScripts.find(s => s.id === msg.scriptId);
        if (s) s.enabled = msg.enabled !== undefined ? msg.enabled : !s.enabled;
        chrome.storage.local.set({ [SCRIPTS_KEY]: installedScripts });
        sendResponse({ success: true });
        return false;
      }

      return false;
    });
  }

  // ── Start ─────────────────────────────────────────────────────────────
  init();

})();
