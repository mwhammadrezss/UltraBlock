/**
 * UltraBlock — dark-patterns.js v2.3
 * Dark Pattern Neutralizer: Highlights real close buttons, skips fake timers,
 * reveals hidden opt-out options, blocks deceptive UI tricks.
 * Runs in ISOLATED world.
 */
'use strict';

(function UltraDarkPatternNeutralizer() {

  if (window.__ubDarkPatternRan) return;
  window.__ubDarkPatternRan = true;

  // ══════════════════════════════════════════════════════════════
  //  1. FAKE TIMER KILLER (DISABLED - was breaking YouTube internals)
  //     Global setInterval/setTimeout patching interferes with YouTube's
  //     internal 1000ms timers. Removed to prevent player breakage.
  // ══════════════════════════════════════════════════════════════
  // patchTimers() removed — was dead code (empty function)

  // ══════════════════════════════════════════════════════════════
  //  2. HIDDEN CLOSE BUTTON REVEALER
  //     Find tiny/invisible/delayed close buttons and make them prominent
  // ══════════════════════════════════════════════════════════════
  function revealCloseButtons() {
    // Selectors for close/dismiss buttons that are often hidden
    var closeSelectors = [
      '[class*="close"]:not(body)',
      '[class*="dismiss"]:not(body)',
      '[class*="skip"]:not(body)',
      '[aria-label*="close" i]',
      '[aria-label*="dismiss" i]',
      '[aria-label*="skip" i]',
      '[title*="close" i]',
      '[title*="dismiss" i]',
      'button[class*="x-btn"]',
      '.modal-close',
      '.popup-close',
      '.overlay-close',
    ];

    var allClose = document.querySelectorAll(closeSelectors.join(','));
    for (var i = 0; i < allClose.length; i++) {
      var btn = allClose[i];

      // Check if button is suspiciously small or hidden
      var rect = btn.getBoundingClientRect();
      var style = window.getComputedStyle(btn);

      var isTiny = rect.width < 20 || rect.height < 20;
      var isLowOpacity = parseFloat(style.opacity) < 0.5;
      var isOffColor = style.color === style.backgroundColor; // invisible text

      if (isTiny || isLowOpacity || isOffColor) {
        // Make it visible and prominent
        btn.style.setProperty('min-width', '32px', 'important');
        btn.style.setProperty('min-height', '32px', 'important');
        btn.style.setProperty('opacity', '1', 'important');
        btn.style.setProperty('visibility', 'visible', 'important');
        btn.style.setProperty('z-index', '2147483647', 'important');
        btn.style.setProperty('pointer-events', 'auto', 'important');
        // Add a visible outline
        btn.style.setProperty('outline', '2px solid #ff4444', 'important');
        btn.style.setProperty('outline-offset', '2px', 'important');
      }
    }

    // Find countdown-gated buttons (disabled with timer text nearby)
    var disabledBtns = document.querySelectorAll('button[disabled], a[disabled], [aria-disabled="true"]');
    for (var j = 0; j < disabledBtns.length; j++) {
      var dbtn = disabledBtns[j];
      var txt = (dbtn.textContent || '').toLowerCase();
      // If button says "skip in 5s" or "close in 3..." enable it immediately
      if (/skip|close|dismiss|continue|proceed|\d+\s*s/i.test(txt)) {
        dbtn.disabled = false;
        dbtn.removeAttribute('disabled');
        dbtn.removeAttribute('aria-disabled');
        dbtn.style.setProperty('pointer-events', 'auto', 'important');
        dbtn.style.setProperty('opacity', '1', 'important');
        // Remove the countdown text
        dbtn.textContent = dbtn.textContent.replace(/\s*\(?\d+\s*s?\)?\.?\.?\.?\s*/g, '').trim() || 'Skip';
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  3. DECEPTIVE CHECKBOX REVEALER
  //     Find pre-checked opt-in boxes and hidden opt-out options
  // ══════════════════════════════════════════════════════════════
  function revealDeceptiveCheckboxes() {
    // Find pre-checked newsletter/marketing checkboxes and uncheck them
    var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
    for (var i = 0; i < checkboxes.length; i++) {
      var cb = checkboxes[i];
      var label = '';
      // Get associated label
      if (cb.id) {
        var lbl = document.querySelector('label[for="' + cb.id + '"]');
        if (lbl) label = lbl.textContent || '';
      }
      if (!label) label = (cb.parentElement && cb.parentElement.textContent) || '';

      // Uncheck marketing/newsletter/promotional checkboxes
      if (/newsletter|marketing|promotional|offers|partner|third.?party|subscribe|notify me|updates|خبرنامه|اطلاع.?رسانی/i.test(label)) {
        cb.checked = false;
        // Highlight it so user knows we unchecked it
        var container = cb.parentElement;
        if (container) {
          container.style.setProperty('border', '2px solid #ff8800', 'important');
          container.style.setProperty('border-radius', '4px', 'important');
          container.style.setProperty('padding', '2px', 'important');
        }
      }
    }

    // Find hidden "unsubscribe" or "opt-out" links and make them visible
    var links = document.querySelectorAll('a');
    for (var j = 0; j < links.length; j++) {
      var link = links[j];
      var linkText = (link.textContent || '').toLowerCase();
      if (/opt.?out|unsubscribe|no.?thanks|لغو|انصراف/i.test(linkText)) {
        var linkStyle = window.getComputedStyle(link);
        if (parseFloat(linkStyle.opacity) < 0.4 || linkStyle.fontSize.replace('px','') < 9) {
          link.style.setProperty('opacity', '1', 'important');
          link.style.setProperty('font-size', '14px', 'important');
          link.style.setProperty('color', '#4488ff', 'important');
          link.style.setProperty('text-decoration', 'underline', 'important');
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  4. FULL-PAGE OVERLAY CLICK TRAP DETECTOR
  //     Block invisible full-page elements that redirect on click
  // ══════════════════════════════════════════════════════════════
  function killClickTraps() {
    var allEls = document.querySelectorAll('a, div, span');
    for (var i = 0; i < allEls.length; i++) {
      var el = allEls[i];
      var style;
      try { style = window.getComputedStyle(el); } catch (_) { continue; }

      if (style.position !== 'fixed' && style.position !== 'absolute') continue;

      var rect = el.getBoundingClientRect();
      // Full-page or near-full-page invisible overlay
      if (rect.width > window.innerWidth * 0.8 && rect.height > window.innerHeight * 0.8) {
        var isInvisible = parseFloat(style.opacity) < 0.1 || style.background === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)';
        var hasLink = el.tagName === 'A' || el.querySelector('a');
        var highZ = parseInt(style.zIndex) > 100;

        if ((isInvisible || !el.textContent.trim()) && (hasLink || highZ)) {
          el.remove();
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  5. NOTIFICATION PERMISSION BLOCKER
  //     Auto-deny push notification requests
  // ══════════════════════════════════════════════════════════════
  function blockNotificationPrompts() {
    // Hide "Enable notifications" prompts in page
    var notifSelectors = [
      '[class*="notification-prompt"]',
      '[class*="push-prompt"]',
      '[class*="web-push"]',
      '[id*="notification-prompt"]',
      '[id*="push-prompt"]',
      '[class*="subscribe-prompt"]',
    ];
    var notifs = document.querySelectorAll(notifSelectors.join(','));
    for (var i = 0; i < notifs.length; i++) {
      notifs[i].style.setProperty('display', 'none', 'important');
    }
  }

  // ══════════════════════════════════════════════════════════════
  //  MAIN
  // ══════════════════════════════════════════════════════════════
  function processPage() {
    revealCloseButtons();
    revealDeceptiveCheckboxes();
    killClickTraps();
    blockNotificationPrompts();
  }

  // Process page after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPage);
  } else {
    processPage();
  }

  // Re-process on DOM changes (debounced to avoid layout thrashing)
  var _dpTimeout = null;
  var _dpObserver = new MutationObserver(function() {
    if (_dpTimeout) return;
    _dpTimeout = setTimeout(function() {
      _dpTimeout = null;
      processPage();
    }, 300);
  });

  function startObserver() {
    if (document.body) {
      _dpObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);

  // Also run periodically for dynamically loaded content
  var _interval = setInterval(processPage, 3000);
  setTimeout(function() { clearInterval(_interval); }, 60000);

})();
