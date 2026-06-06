/**
 * UltraBlock Scriptlet: trusted-replace-fetch-response
 * Modifies fetch() response text by replacing matched patterns.
 * Usage: ##+js(trusted-replace-fetch-response, pattern, replacement, propsToMatch)
 */
'use strict';
(function() {
  var pattern = args[0] || '';
  var replacement = args[1] || '';
  var propsToMatch = args[2] || '';

  if (!pattern) return;

  var re = null;
  if (pattern[0] === '/' && pattern.lastIndexOf('/') > 0) {
    var lastSlash = pattern.lastIndexOf('/');
    var flags = pattern.slice(lastSlash + 1);
    try { re = new RegExp(pattern.slice(1, lastSlash), flags || 'g'); } catch (e) {}
  }

  var origFetch = window.fetch;
  window.fetch = function() {
    var fetchUrl = '';
    if (typeof arguments[0] === 'string') fetchUrl = arguments[0];
    else if (arguments[0] && arguments[0].url) fetchUrl = arguments[0].url;

    // Check URL match
    var shouldIntercept = false;
    if (!propsToMatch) {
      shouldIntercept = true;
    } else {
      var needles = propsToMatch.split(/\s+/);
      for (var i = 0; i < needles.length; i++) {
        var parts = needles[i].split(':');
        var key = parts[0];
        var val = parts.slice(1).join(':');
        if (key === 'url' && fetchUrl.indexOf(val) !== -1) { shouldIntercept = true; break; }
        if (!val && fetchUrl.indexOf(key) !== -1) { shouldIntercept = true; break; }
      }
    }

    if (!shouldIntercept) return origFetch.apply(window, arguments);

    return origFetch.apply(window, arguments).then(function(response) {
      return response.text().then(function(text) {
        var modified;
        if (re) {
          modified = text.replace(re, replacement);
        } else {
          modified = text.split(pattern).join(replacement);
        }
        return new Response(modified, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      });
    });
  };
})();
