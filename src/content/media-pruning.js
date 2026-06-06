/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — VAST/VPAID/M3U8 Ad Pruning
 *  Intercepts video ad manifests and removes ad segments/nodes
 *  before they reach the video player.
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {

  // ── Configuration ─────────────────────────────────────────────────────
  const VAST_INDICATORS = [
    '<VAST', '<vast', 'VAST version', '<Ad ', '<Ad>', '<InLine>', '<Wrapper>',
    '<VPAID', 'vpaid', '<AdParameters'
  ];

  const M3U_AD_TAGS = [
    '#EXT-X-DATERANGE', '#EXT-X-CUE-OUT', '#EXT-X-CUE-IN',
    '#EXT-X-SCTE35', '#EXT-X-AD', '#EXT-X-DISCONTINUITY'
  ];

  // Twitch-specific ad indicators in M3U8
  const TWITCH_AD_PATTERNS = [
    /stitched-ad/i,
    /ads\./i,
    /advertising/i,
    /#EXT-X-TWITCH-AD-URL/i,
    /#EXT-X-TWITCH-PREFETCH/i
  ];

  // ── VAST XML Pruning ──────────────────────────────────────────────────

  /**
   * Remove ad elements from VAST XML, returning an empty VAST response.
   * This effectively tells the player "no ads available".
   */
  function pruneVAST(xmlText) {
    // If it looks like VAST, replace with empty VAST response
    if (isVAST(xmlText)) {
      // Return minimal valid VAST with no ads
      return '<?xml version="1.0" encoding="UTF-8"?><VAST version="3.0"></VAST>';
    }
    return xmlText;
  }

  function isVAST(text) {
    if (!text || typeof text !== 'string') return false;
    const sample = text.substring(0, 1000);
    return VAST_INDICATORS.some(tag => sample.includes(tag));
  }

  // ── VMAP Pruning ──────────────────────────────────────────────────────

  /**
   * VMAP wraps multiple VAST ad breaks. Remove all ad breaks.
   */
  function pruneVMAP(xmlText) {
    if (xmlText.includes('<vmap:VMAP') || xmlText.includes('<VMAP')) {
      return '<?xml version="1.0" encoding="UTF-8"?><vmap:VMAP xmlns:vmap="http://www.iab.net/videosuite/vmap" version="1.0"></vmap:VMAP>';
    }
    return xmlText;
  }

  // ── M3U8 Pruning ─────────────────────────────────────────────────────

  /**
   * Remove ad segments from HLS M3U8 playlists.
   * Handles both Twitch-style stitched ads and generic HLS ad markers.
   */
  function pruneM3U8(m3uText) {
    if (!m3uText || !m3uText.includes('#EXTM3U')) return m3uText;

    const lines = m3uText.split('\n');
    const result = [];
    let inAdSection = false;
    let skipNext = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for ad section start
      if (isAdTag(line)) {
        // CUE-OUT marks beginning of ad break
        if (line.includes('CUE-OUT') || line.includes('SCTE35')) {
          inAdSection = true;
          continue;
        }
        // CUE-IN marks end of ad break
        if (line.includes('CUE-IN')) {
          inAdSection = false;
          continue;
        }
        // Skip other ad tags entirely
        continue;
      }

      // Check Twitch-specific ad patterns
      if (isTwitchAd(line)) {
        skipNext = true;
        continue;
      }

      if (skipNext) {
        // Skip the segment URL that follows an ad tag
        if (!line.startsWith('#')) {
          skipNext = false;
          continue;
        }
      }

      // Skip lines inside ad section
      if (inAdSection) {
        // Keep #EXT-X-DISCONTINUITY as it may be needed for proper playback
        if (line.includes('#EXT-X-ENDLIST')) {
          inAdSection = false;
          result.push(line);
        }
        continue;
      }

      result.push(line);
    }

    return result.join('\n');
  }

  function isAdTag(line) {
    return M3U_AD_TAGS.some(tag => line.includes(tag));
  }

  function isTwitchAd(line) {
    return TWITCH_AD_PATTERNS.some(pattern => pattern.test(line));
  }

  // ── Response Interception: Fetch ──────────────────────────────────────

  const originalFetch = window.fetch;

  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      // Only intercept successful responses
      if (!response.ok) return response;

      const url = (typeof args[0] === 'string') ? args[0] :
                  (args[0] instanceof Request) ? args[0].url : '';

      // Check if this might be a video ad manifest
      if (shouldIntercept(url, response)) {
        return response.clone().text().then(text => {
          let modified = text;

          if (isVAST(text)) {
            modified = pruneVAST(text);
          } else if (text.includes('<vmap:VMAP') || text.includes('<VMAP')) {
            modified = pruneVMAP(text);
          } else if (text.includes('#EXTM3U')) {
            modified = pruneM3U8(text);
          }

          if (modified !== text) {
            // Return a new response with pruned content
            return new Response(modified, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
          return response;
        }).catch(() => response);
      }

      return response;
    });
  };

  // ── Response Interception: XMLHttpRequest ─────────────────────────────

  const XHRProto = XMLHttpRequest.prototype;
  const originalOpen = XHRProto.open;
  const originalSend = XHRProto.send;

  XHRProto.open = function(method, url, ...rest) {
    this._ubUrl = url;
    return originalOpen.call(this, method, url, ...rest);
  };

  XHRProto.send = function(...args) {
    const url = this._ubUrl || '';

    if (shouldInterceptXHR(url)) {
      // Override responseText via property descriptor after load
      this.addEventListener('readystatechange', function() {
        if (this.readyState === 4 && this.status === 200) {
          try {
            let text = this.responseText;
            let modified = text;

            if (isVAST(text)) {
              modified = pruneVAST(text);
            } else if (text.includes('<vmap:VMAP') || text.includes('<VMAP')) {
              modified = pruneVMAP(text);
            } else if (text.includes('#EXTM3U')) {
              modified = pruneM3U8(text);
            }

            if (modified !== text) {
              Object.defineProperty(this, 'responseText', { value: modified, writable: false });
              Object.defineProperty(this, 'response', { value: modified, writable: false });
            }
          } catch (e) {
            // Silently fail — don't break the page
          }
        }
      });
    }

    return originalSend.apply(this, args);
  };

  // ── URL matching helpers ──────────────────────────────────────────────

  function shouldIntercept(url, response) {
    if (!url) return false;
    const lower = url.toLowerCase();
    // VAST/VMAP endpoints
    if (lower.includes('vast') || lower.includes('vmap') || lower.includes('vpaid')) return true;
    if (lower.includes('ad.doubleclick') || lower.includes('pubads.g.doubleclick')) return true;
    if (lower.includes('imasdk.googleapis.com')) return true;
    // M3U8 playlists
    if (lower.includes('.m3u8') || lower.includes('.m3u')) return true;
    // Content-type hints
    const ct = response.headers ? response.headers.get('content-type') || '' : '';
    if (ct.includes('mpegurl') || ct.includes('xml') && lower.includes('ad')) return true;
    return false;
  }

  function shouldInterceptXHR(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.includes('vast') || lower.includes('vmap') || lower.includes('vpaid')) return true;
    if (lower.includes('ad.doubleclick') || lower.includes('pubads.g.doubleclick')) return true;
    if (lower.includes('imasdk.googleapis.com')) return true;
    if (lower.includes('.m3u8') || lower.includes('.m3u')) return true;
    return false;
  }

  console.log('[UltraBlock] VAST/M3U8 media pruning active');

})();
