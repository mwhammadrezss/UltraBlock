/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Custom Filters Page Controller
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {
  const CUSTOM_FILTERS_KEY = 'ub_custom_filters';
  const SUBSCRIPTIONS_KEY = 'ub_filter_subscriptions';

  // ── Tab switching ─────────────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });

  // ── Load existing filters ─────────────────────────────────────────────
  function init() {
    chrome.storage.local.get([CUSTOM_FILTERS_KEY, SUBSCRIPTIONS_KEY], result => {
      const filters = result[CUSTOM_FILTERS_KEY] || '';
      const subs = result[SUBSCRIPTIONS_KEY] || [];

      document.getElementById('filter-editor').value = filters;
      updateCounts(filters);
      renderSubscriptions(subs);
    });
  }

  function updateCounts(text) {
    const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('!'));
    document.getElementById('custom-count').textContent = lines.length;
    document.getElementById('active-count').textContent = lines.length; // Simplified
  }

  // ── Apply filters ─────────────────────────────────────────────────────
  document.getElementById('btn-apply').addEventListener('click', () => {
    const text = document.getElementById('filter-editor').value;
    chrome.storage.local.set({ [CUSTOM_FILTERS_KEY]: text }, () => {
      chrome.runtime.sendMessage({ action: 'recompileFilters' }, response => {
        showStatus('editor-status', 'success', '✓ Filters applied and compiled');
        updateCounts(text);
      });
    });
  });

  // ── Validate syntax ───────────────────────────────────────────────────
  document.getElementById('btn-validate').addEventListener('click', () => {
    const text = document.getElementById('filter-editor').value;
    const lines = text.split('\n');
    const errors = [];

    lines.forEach((line, i) => {
      line = line.trim();
      if (!line || line.startsWith('!') || line.startsWith('[')) return;

      // Basic syntax validation
      if (line.includes('##') || line.includes('#@#') || line.includes('##+js(') ||
          line.startsWith('||') || line.startsWith('@@') || line.startsWith('*') ||
          line.startsWith('/') || line.includes('$')) {
        return; // Looks valid
      }

      // Plain domain is valid too
      if (/^[a-zA-Z0-9.-]+$/.test(line)) return;

      errors.push(`Line ${i + 1}: Unrecognized syntax — "${line.substring(0, 40)}"`);
    });

    if (errors.length === 0) {
      showStatus('editor-status', 'success', '✓ All rules look valid');
    } else {
      showStatus('editor-status', 'error', `⚠️ ${errors.length} issue(s):\n` + errors.slice(0, 5).join('\n'));
    }
  });

  // ── Clear all ─────────────────────────────────────────────────────────
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    if (confirm('Remove all custom filters? This cannot be undone.')) {
      document.getElementById('filter-editor').value = '';
      chrome.storage.local.set({ [CUSTOM_FILTERS_KEY]: '' }, () => {
        chrome.runtime.sendMessage({ action: 'recompileFilters' });
        showStatus('editor-status', 'success', '✓ Custom filters cleared');
        updateCounts('');
      });
    }
  });

  // ── Subscribe to list ─────────────────────────────────────────────────
  document.getElementById('btn-subscribe').addEventListener('click', () => {
    const url = document.getElementById('subscribe-url').value.trim();
    if (!url || !url.startsWith('http')) {
      showStatus('subscribe-status', 'error', '⚠️ Please enter a valid URL');
      return;
    }

    chrome.runtime.sendMessage({
      action: 'addCustomFilterList',
      url: url,
      title: extractListName(url)
    }, response => {
      if (response && response.success) {
        showStatus('subscribe-status', 'success', '✓ Subscribed successfully');
        document.getElementById('subscribe-url').value = '';
        init(); // Refresh
      } else {
        showStatus('subscribe-status', 'error', '⚠️ Failed: ' + (response?.error || 'unknown'));
      }
    });
  });

  function renderSubscriptions(subs) {
    const tbody = document.getElementById('subscriptions-list');
    if (subs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#484f58;text-align:center;padding:20px">No subscriptions yet</td></tr>';
      return;
    }

    tbody.innerHTML = subs.map((sub, i) => `
      <tr>
        <td>${sub.title || 'Untitled'}</td>
        <td class="url" title="${sub.url}">${sub.url}</td>
        <td>${sub.ruleCount || '?'}</td>
        <td>${sub.lastUpdated ? new Date(sub.lastUpdated).toLocaleDateString() : 'Never'}</td>
        <td class="remove-btn" data-index="${i}">Remove</td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        chrome.runtime.sendMessage({
          action: 'removeCustomFilterList',
          listId: subs[idx].id || subs[idx].url
        }, () => init());
      });
    });
  }

  // ── Export ─────────────────────────────────────────────────────────────
  document.getElementById('btn-export').addEventListener('click', () => {
    chrome.storage.local.get([CUSTOM_FILTERS_KEY, SUBSCRIPTIONS_KEY], result => {
      const data = {
        version: '2.4.0',
        exportDate: new Date().toISOString(),
        customFilters: result[CUSTOM_FILTERS_KEY] || '',
        subscriptions: result[SUBSCRIPTIONS_KEY] || []
      };
      downloadFile(JSON.stringify(data, null, 2), 'ultrablock-filters.json', 'application/json');
      showStatus('ie-status', 'success', '✓ Exported successfully');
    });
  });

  document.getElementById('btn-export-txt').addEventListener('click', () => {
    chrome.storage.local.get([CUSTOM_FILTERS_KEY], result => {
      const text = '! UltraBlock Custom Filters\n! Exported: ' + new Date().toISOString() + '\n\n' +
                   (result[CUSTOM_FILTERS_KEY] || '');
      downloadFile(text, 'ultrablock-filters.txt', 'text/plain');
      showStatus('ie-status', 'success', '✓ Exported as text');
    });
  });

  // ── Import ─────────────────────────────────────────────────────────────
  document.getElementById('btn-import').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;

      try {
        // Try JSON first
        const data = JSON.parse(content);
        if (data.customFilters) {
          mergeFilters(data.customFilters);
          showStatus('ie-status', 'success', '✓ Imported from JSON');
        }
      } catch (e) {
        // Plain text import
        mergeFilters(content);
        showStatus('ie-status', 'success', '✓ Imported from text file');
      }
    };
    reader.readAsText(file);
  });

  function mergeFilters(newText) {
    chrome.storage.local.get([CUSTOM_FILTERS_KEY], result => {
      const existing = (result[CUSTOM_FILTERS_KEY] || '').split('\n').filter(Boolean);
      const incoming = newText.split('\n').filter(l => l.trim() && !l.startsWith('!'));
      const merged = [...new Set([...existing, ...incoming])].join('\n');

      chrome.storage.local.set({ [CUSTOM_FILTERS_KEY]: merged }, () => {
        document.getElementById('filter-editor').value = merged;
        updateCounts(merged);
        chrome.runtime.sendMessage({ action: 'recompileFilters' });
      });
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function extractListName(url) {
    try {
      const parts = new URL(url).pathname.split('/');
      return parts[parts.length - 1].replace(/\.(txt|csv|json)$/, '') || 'Custom List';
    } catch (e) { return 'Custom List'; }
  }

  function showStatus(id, type, msg) {
    const el = document.getElementById(id);
    el.className = 'status-msg ' + type;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
  }

  init();
})();
