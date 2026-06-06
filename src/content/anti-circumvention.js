/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Anti-Circumvention Engine
 *  Detects and neutralizes anti-adblock scripts that try to
 *  detect/bypass our blocking. Inspired by AdGuard Extra.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  // ── 1. MutationObserver Surveillance ──────────────────────────────────
  // Anti-adblock scripts often use MutationObserver to detect when their
  // ads are removed. We intercept their observers.

  const realMutationObserver = window.MutationObserver;
  const trackedObservers = new WeakSet();

  // Patterns that anti-adblock observers look for
  const SUSPICIOUS_SELECTORS = [
    'ins.adsbygoogle', '.ad-slot', '#ad-container', '.adunit',
    '[id*="google_ads"]', '[class*="adblock"]', '#overlay-ad',
    '.ad-wrapper', '#anti-adblock', '.adbdetect'
  ];

  const PatchedMutationObserver = function(callback) {
    // Wrap the callback to filter out ad-reinsertion attempts
    const wrappedCallback = function(mutations, observer) {
      const filteredMutations = mutations.filter(mutation => {
        // If an anti-adblock script is trying to re-add ad elements, suppress it
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && isAdReinsertion(node)) {
              // Silently remove the re-inserted ad
              try { node.remove(); } catch (e) {}
              return false;
            }
          }
        }
        return true;
      });

      if (filteredMutations.length > 0) {
        callback.call(this, filteredMutations, observer);
      }
    };

    const obs = new realMutationObserver(wrappedCallback);
    trackedObservers.add(obs);
    return obs;
  };

  PatchedMutationObserver.prototype = realMutationObserver.prototype;
  Object.defineProperty(window, 'MutationObserver', {
    value: PatchedMutationObserver,
    writable: false,
    configurable: true
  });

  function isAdReinsertion(node) {
    if (!node || !node.matches) return false;
    const html = node.outerHTML || '';
    // Detect ad iframes being re-inserted
    if (node.tagName === 'IFRAME' && /ad|banner|sponsor/i.test(html)) return true;
    // Detect common ad containers
    try {
      return SUSPICIOUS_SELECTORS.some(sel => node.matches(sel) || node.querySelector(sel));
    } catch (e) { return false; }
  }

  // ── 2. Anti-Adblock Detection Neutralizer ─────────────────────────────
  // Fake the presence of ad elements so detectors think ads loaded

  function fakeAdPresence() {
    // Create a hidden bait element that adblock detectors look for
    const bait = document.createElement('div');
    bait.className = 'ad ads adsbox doubleclick ad-placement carbon-ads';
    bait.id = 'carbonads';
    bait.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;height:1px!important;width:1px!important;opacity:0.01!important;pointer-events:none!important;';
    bait.innerHTML = '<ins class="adsbygoogle" style="display:block;height:1px;width:1px;"></ins>';

    // Insert after DOM is ready
    const insert = () => {
      if (document.body) {
        document.body.appendChild(bait);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert);
    } else {
      insert();
    }
  }

  // ── 3. Overlay/Modal Killer ───────────────────────────────────────────
  // Remove anti-adblock overlays and modals that block content

  function setupOverlayKiller() {
    const observer = new realMutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          checkAndRemoveOverlay(node);
        }
      }
    });

    const startObserving = () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserving);
    } else {
      startObserving();
    }
  }

  function checkAndRemoveOverlay(node) {
    if (!node || !node.style) return;

    const style = window.getComputedStyle(node);
    const text = (node.textContent || '').toLowerCase();

    // Detect anti-adblock modals
    const isOverlay = (
      (style.position === 'fixed' || style.position === 'absolute') &&
      (parseInt(style.zIndex) > 9000 || style.zIndex === 'auto') &&
      (
        text.includes('adblock') || text.includes('ad blocker') ||
        text.includes('ad-block') || text.includes('adblocker') ||
        text.includes('whitelist') || text.includes('disable your ad') ||
        text.includes('turn off') || text.includes('blocker detected') ||
        text.includes('اد بلاک')  // Farsi support
      )
    );

    if (isOverlay) {
      node.remove();
      // Also restore scrolling on body
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      console.log('[UltraBlock/Anti-Circumvention] Removed anti-adblock overlay');
    }
  }

  // ── 4. Scroll Lock Preventer ──────────────────────────────────────────
  // Anti-adblock scripts often lock scrolling. Prevent that.

  const originalOverflowDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype.style.__proto__, 'overflow'
  );

  // Monitor body overflow changes
  let overflowWatcher = null;
  function watchOverflow() {
    overflowWatcher = new realMutationObserver(mutations => {
      for (const m of mutations) {
        if (m.attributeName === 'style' || m.attributeName === 'class') {
          const target = m.target;
          if (target === document.body || target === document.documentElement) {
            const style = target.getAttribute('style') || '';
            if (style.includes('overflow') && style.includes('hidden')) {
              // Check if this is likely an anti-adblock lock
              const hasOverlay = document.querySelector(
                '[class*="adblock"],[class*="overlay"][style*="z-index"]'
              );
              if (hasOverlay) {
                target.style.overflow = '';
                target.style.overflowY = '';
              }
            }
          }
        }
      }
    });

    const startWatch = () => {
      if (document.body) {
        overflowWatcher.observe(document.body, { attributes: true });
        overflowWatcher.observe(document.documentElement, { attributes: true });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startWatch);
    } else {
      startWatch();
    }
  }

  // ── 5. setTimeout/setInterval Neutralizer ─────────────────────────────
  // Some anti-adblock scripts use timers to re-check. We can detect and
  // neutralize the most aggressive ones.

  const originalSetTimeout = window.setTimeout;
  const originalSetInterval = window.setInterval;

  // Patterns in timer callbacks that indicate anti-adblock checks
  const ADBLOCK_CHECK_PATTERNS = [
    /adblock/i, /blockAdBlock/i, /FuckAdBlock/i, /sniffAdBlock/i,
    /detectAdBlock/i, /adBlockDetected/i, /isAdBlockActive/i,
    /adsBlocked/i, /canRunAds/i, /adBlockEnabled/i
  ];

  window.setTimeout = function(fn, delay, ...args) {
    if (typeof fn === 'function' && isAdblockChecker(fn)) {
      // Replace with no-op — the check will never fire
      return originalSetTimeout.call(window, function() {}, delay);
    }
    return originalSetTimeout.call(window, fn, delay, ...args);
  };

  window.setInterval = function(fn, delay, ...args) {
    if (typeof fn === 'function' && isAdblockChecker(fn)) {
      return originalSetInterval.call(window, function() {}, delay);
    }
    return originalSetInterval.call(window, fn, delay, ...args);
  };

  function isAdblockChecker(fn) {
    try {
      const code = fn.toString();
      return ADBLOCK_CHECK_PATTERNS.some(pattern => pattern.test(code));
    } catch (e) {
      return false;
    }
  }

  // ── 6. Global Flag Spoofing ───────────────────────────────────────────
  // Many scripts set global variables to indicate adblock status

  const SPOOF_GLOBALS = {
    // Common adblock detection variables — set to "ads are loading fine"
    canRunAds: true,
    isAdBlockActive: false,
    adBlockDetected: false,
    adBlockEnabled: false,
    adsBlocked: false,
    adblockDetect: false,
    isAdsDisplayed: true,
    fuckAdBlock: undefined, // Will be overridden below
    blockAdBlock: undefined,
    sniffAdBlock: undefined
  };

  for (const [key, value] of Object.entries(SPOOF_GLOBALS)) {
    try {
      Object.defineProperty(window, key, {
        get: () => value,
        set: () => true, // Silently ignore writes
        configurable: false
      });
    } catch (e) {
      // Property may already be defined
    }
  }

  // FuckAdBlock / BlockAdBlock class spoofing
  const FakeAdBlockDetector = function() {};
  FakeAdBlockDetector.prototype = {
    check: function() { return this; },
    emitEvent: function() { return this; },
    on: function(event, fn) {
      // Only fire "notDetected" callbacks
      if (event === 'notDetected' || event === 'adNotBlocked') {
        try { fn(); } catch (e) {}
      }
      return this;
    },
    onDetected: function() { return this; },
    onNotDetected: function(fn) { try { fn(); } catch (e) {} return this; },
    setOption: function() { return this; }
  };

  try {
    Object.defineProperty(window, 'fuckAdBlock', { value: new FakeAdBlockDetector(), writable: false });
    Object.defineProperty(window, 'blockAdBlock', { value: new FakeAdBlockDetector(), writable: false });
    Object.defineProperty(window, 'sniffAdBlock', { value: new FakeAdBlockDetector(), writable: false });
  } catch (e) {}

  // ── Start all systems ─────────────────────────────────────────────────
  fakeAdPresence();
  setupOverlayKiller();
  watchOverflow();

  console.log('[UltraBlock] Anti-circumvention engine active');

})();
