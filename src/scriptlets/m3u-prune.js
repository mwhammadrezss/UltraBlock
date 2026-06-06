/**
 * UltraBlock Scriptlet: m3u-prune
 * Removes ad segments from M3U8/HLS playlists.
 * Usage: ##+js(m3u-prune, adMarker, [urlMatch])
 */
'use strict';
(function() {
  var adMarker = args[0] || 'EXT-X-DATERANGE';
  var urlMatch = args[1] || '';

  var pruneM3U = function(text) {
    if (!text || text.indexOf('#EXTM3U') === -1) return text;

    var lines = text.split('\n');
    var out = [];
    var skipNext = false;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // Skip ad-related lines
      if (line.indexOf(adMarker) !== -1) {
        skipNext = true;
        continue;
      }
      if (line.indexOf('#EXT-X-SCTE35') !== -1) {
        skipNext = true;
        continue;
      }
      if (line.indexOf('stitched-ad') !== -1 || line.indexOf('/ad/') !== -1 ||
          line.indexOf('_ad_') !== -1 || line.indexOf('/ads/') !== -1) {
        continue;
      }

      if (skipNext && line[0] !== '#') {
        skipNext = false;
        continue;
      }
      skipNext = false;
      out.push(line);
    }
    return out.join('\n');
  };

  // Intercept fetch
  var origFetch = window.fetch;
  window.fetch = function() {
    var fetchUrl = '';
    if (typeof arguments[0] === 'string') fetchUrl = arguments[0];
    else if (arguments[0] && arguments[0].url) fetchUrl = arguments[0].url;

    var isM3U = fetchUrl.indexOf('.m3u8') !== -1 || fetchUrl.indexOf('hls') !== -1;
    if (urlMatch) isM3U = isM3U && fetchUrl.indexOf(urlMatch) !== -1;

    if (!isM3U) return origFetch.apply(window, arguments);

    return origFetch.apply(window, arguments).then(function(response) {
      return response.text().then(function(text) {
        var pruned = pruneM3U(text);
        return new Response(pruned, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      });
    });
  };

  // Intercept XHR
  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

  XMLHttpRequest.prototype.open = function(method, url) {
    this._ubM3uUrl = url;
    return origXHROpen.apply(this, arguments);
  };

  if (origXHRGetter && origXHRGetter.get) {
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
      get: function() {
        var text = origXHRGetter.get.call(this);
        if (!text || !this._ubM3uUrl) return text;
        var isTarget = this._ubM3uUrl.indexOf('.m3u8') !== -1;
        if (urlMatch) isTarget = isTarget && this._ubM3uUrl.indexOf(urlMatch) !== -1;
        if (isTarget) return pruneM3U(text);
        return text;
      },
      configurable: true
    });
  }
})();
