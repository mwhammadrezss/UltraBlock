/**
 * UltraBlock Scriptlet: prevent-fetch
 * Prevents fetch() requests matching specified pattern.
 * Usage: ##+js(prevent-fetch, propsToMatch, responseBody)
 */
'use strict';
(function() {
  var propsToMatch = args[0] || '';
  var responseBody = args[1] || '';
  var responseType = args[2] || '';

  if (!propsToMatch && !responseBody) return;

  var origFetch = window.fetch;
  window.fetch = function() {
    var fetchArgs = arguments;
    var url = '';
    var method = 'GET';

    if (typeof fetchArgs[0] === 'string') {
      url = fetchArgs[0];
    } else if (fetchArgs[0] && fetchArgs[0].url) {
      url = fetchArgs[0].url;
      method = fetchArgs[0].method || method;
    }
    if (fetchArgs[1]) {
      method = fetchArgs[1].method || method;
    }

    // Match check
    var shouldBlock = false;
    if (propsToMatch) {
      var needles = propsToMatch.split(/\s+/);
      for (var i = 0; i < needles.length; i++) {
        var parts = needles[i].split(':');
        var key = parts[0];
        var val = parts.slice(1).join(':');
        if (key === 'url' && url.indexOf(val) !== -1) { shouldBlock = true; break; }
        if (key === 'method' && method.toUpperCase() === val.toUpperCase()) { shouldBlock = true; break; }
        if (!val && url.indexOf(key) !== -1) { shouldBlock = true; break; }
      }
    } else {
      shouldBlock = true;
    }

    if (shouldBlock) {
      var body = responseBody || '';
      var status = 200;
      if (responseType) {
        try {
          var opts = JSON.parse(responseType);
          if (opts.status) status = opts.status;
        } catch (e) {}
      }
      return Promise.resolve(new Response(body, {
        status: status,
        statusText: 'OK',
        headers: { 'content-length': body.length }
      }));
    }

    return origFetch.apply(window, fetchArgs);
  };
})();
