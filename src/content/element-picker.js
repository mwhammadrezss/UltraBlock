/**
 * ══════════════════════════════════════════════════════════════
 *   UltraBlock — element-picker.js  v1.0
 *   Point-and-Click Element Blocker
 *
 *   Allows users to visually select any element on the page
 *   and create a CSS cosmetic filter to permanently hide it.
 *
 *   Activated via popup or keyboard shortcut.
 *   Creates optimal CSS selectors automatically.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function UltraBlockElementPicker() {

  var _active = false;
  var _highlightEl = null;
  var _hoveredEl = null;
  var _dialogEl = null;
  var _pickedSelector = '';

  // ─── Listen for activation message from background ──────────────────
  chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.action === 'activateElementPicker') {
      activate();
    }
    if (msg.action === 'deactivateElementPicker') {
      deactivate();
    }
  });


  // ═══════════════════════════════════════════════════════════════════════
  //  ACTIVATION / DEACTIVATION
  // ═══════════════════════════════════════════════════════════════════════

  function activate() {
    if (_active) return;
    _active = true;

    // Create highlight overlay
    _highlightEl = document.createElement('div');
    _highlightEl.id = 'ub-picker-highlight';
    _highlightEl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;' +
      'border:2px solid #FF4444;background:rgba(255,68,68,0.15);' +
      'transition:all 0.05s ease;display:none;';
    document.body.appendChild(_highlightEl);

    // Create instruction banner
    var banner = document.createElement('div');
    banner.id = 'ub-picker-banner';
    banner.innerHTML = '🎯 <b>UltraBlock Element Picker</b> — Click an element to block it. Press ESC to cancel.';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;' +
      'background:#1E82FF;color:#fff;padding:10px 20px;font:14px/1.4 -apple-system,sans-serif;' +
      'text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    document.body.appendChild(banner);

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
  }

  function deactivate() {
    if (!_active) return;
    _active = false;
    _hoveredEl = null;

    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';

    var highlight = document.getElementById('ub-picker-highlight');
    if (highlight) highlight.remove();
    var banner = document.getElementById('ub-picker-banner');
    if (banner) banner.remove();
    if (_dialogEl) _dialogEl.remove();
    _highlightEl = null;
    _dialogEl = null;
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  function onMouseMove(e) {
    var target = e.target;
    if (!target || target === _highlightEl || target.id === 'ub-picker-banner' ||
        target.id === 'ub-picker-dialog') return;
    if (target === _hoveredEl) return;

    _hoveredEl = target;
    var rect = target.getBoundingClientRect();
    _highlightEl.style.display = 'block';
    _highlightEl.style.top = rect.top + 'px';
    _highlightEl.style.left = rect.left + 'px';
    _highlightEl.style.width = rect.width + 'px';
    _highlightEl.style.height = rect.height + 'px';
  }

  function onClick(e) {
    if (!_hoveredEl) return;
    // Don't block picker UI elements
    if (e.target.id && e.target.id.indexOf('ub-picker') === 0) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var selector = generateSelector(_hoveredEl);
    _pickedSelector = selector;
    showConfirmDialog(selector, _hoveredEl);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      deactivate();
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  SELECTOR GENERATION
  // ═══════════════════════════════════════════════════════════════════════

  function generateSelector(el) {
    // Try ID first (most specific)
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) {
      return '#' + CSS.escape(el.id);
    }

    // Try class combinations
    if (el.classList.length > 0) {
      var classSelector = el.tagName.toLowerCase();
      for (var i = 0; i < el.classList.length; i++) {
        var cls = el.classList[i];
        // Skip dynamic/random-looking classes
        if (/^[a-z]{1,3}[0-9]{3,}|^_/.test(cls)) continue;
        classSelector += '.' + CSS.escape(cls);
      }
      if (classSelector !== el.tagName.toLowerCase()) {
        var matches = document.querySelectorAll(classSelector);
        if (matches.length === 1) return classSelector;
        if (matches.length < 5) return classSelector;
      }
    }

    // Try with parent context
    var parent = el.parentElement;
    if (parent) {
      var parentSelector = '';
      if (parent.id) {
        parentSelector = '#' + CSS.escape(parent.id);
      } else if (parent.classList.length > 0) {
        parentSelector = parent.tagName.toLowerCase() + '.' + CSS.escape(parent.classList[0]);
      }
      if (parentSelector) {
        var childSelector = el.tagName.toLowerCase();
        if (el.classList.length > 0) childSelector += '.' + CSS.escape(el.classList[0]);
        var full = parentSelector + ' > ' + childSelector;
        if (document.querySelectorAll(full).length <= 3) return full;
      }
    }

    // Fallback: nth-child path
    return getCSSPath(el);
  }

  function getCSSPath(el) {
    var path = [];
    while (el && el !== document.documentElement) {
      var selector = el.tagName.toLowerCase();
      if (el.id) {
        selector = '#' + CSS.escape(el.id);
        path.unshift(selector);
        break;
      }
      var siblings = el.parentElement ? el.parentElement.children : [];
      if (siblings.length > 1) {
        var idx = Array.prototype.indexOf.call(siblings, el) + 1;
        selector += ':nth-child(' + idx + ')';
      }
      path.unshift(selector);
      el = el.parentElement;
    }
    return path.join(' > ');
  }


  // ═══════════════════════════════════════════════════════════════════════
  //  CONFIRM DIALOG
  // ═══════════════════════════════════════════════════════════════════════

  function showConfirmDialog(selector, element) {
    if (_dialogEl) _dialogEl.remove();

    _dialogEl = document.createElement('div');
    _dialogEl.id = 'ub-picker-dialog';
    _dialogEl.innerHTML = [
      '<div style="font-weight:700;margin-bottom:8px;">Block this element?</div>',
      '<div style="background:#222;padding:8px;border-radius:4px;font-family:monospace;font-size:12px;',
      'word-break:break-all;margin-bottom:12px;color:#4FC3F7;">' + escapeHtml(selector) + '</div>',
      '<div style="display:flex;gap:8px;">',
      '  <button id="ub-picker-confirm" style="flex:1;padding:8px;background:#4CAF50;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">✓ Block</button>',
      '  <button id="ub-picker-wider" style="flex:1;padding:8px;background:#FF9800;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">↑ Wider</button>',
      '  <button id="ub-picker-cancel" style="flex:1;padding:8px;background:#666;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;">✗ Cancel</button>',
      '</div>'
    ].join('');

    _dialogEl.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);' +
      'z-index:2147483647;background:#1a1a1a;color:#fff;padding:16px 20px;border-radius:12px;' +
      'width:400px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.5);font:14px/1.4 -apple-system,sans-serif;';

    document.body.appendChild(_dialogEl);

    document.getElementById('ub-picker-confirm').addEventListener('click', function() {
      confirmBlock(selector);
    });
    document.getElementById('ub-picker-wider').addEventListener('click', function() {
      if (element.parentElement && element.parentElement !== document.body) {
        _hoveredEl = element.parentElement;
        element = element.parentElement;
        var newSelector = generateSelector(element);
        _pickedSelector = newSelector;
        // Highlight parent
        var rect = element.getBoundingClientRect();
        _highlightEl.style.top = rect.top + 'px';
        _highlightEl.style.left = rect.left + 'px';
        _highlightEl.style.width = rect.width + 'px';
        _highlightEl.style.height = rect.height + 'px';
        showConfirmDialog(newSelector, element);
      }
    });
    document.getElementById('ub-picker-cancel').addEventListener('click', function() {
      deactivate();
    });
  }

  function confirmBlock(selector) {
    // Hide the element immediately
    try {
      var els = document.querySelectorAll(selector);
      for (var i = 0; i < els.length; i++) {
        els[i].style.setProperty('display', 'none', 'important');
      }
    } catch (e) {}

    // Save to custom filters
    var hostname = location.hostname;
    var filterRule = hostname + '##' + selector;

    chrome.runtime.sendMessage({
      action: 'addCustomFilter',
      filter: filterRule,
      selector: selector,
      hostname: hostname
    });

    deactivate();

    // Show success toast
    showToast('✓ Element blocked: ' + selector);
  }

  function showToast(message) {
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;' +
      'background:#4CAF50;color:#fff;padding:12px 20px;border-radius:8px;' +
      'font:14px/1.4 -apple-system,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);' +
      'animation:ub-toast-in 0.3s ease;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
