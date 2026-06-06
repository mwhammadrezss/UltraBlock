/**
 * UltraBlock Scriptlet: xml-prune
 * Removes specified elements from XML/VAST responses.
 * Useful for stripping video ad segments from VAST/VPAID responses.
 * Usage: ##+js(xml-prune, selector, [optionalUrlMatch])
 */
'use strict';
(function() {
  var selector = args[0] || '';
  var urlMatch = args[1] || '';

  if (!selector) return;

  // Intercept XHR responses that return XML
  var origXHROpen = XMLHttpRequest.prototype.open;
  var origXHRGetter = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, 'responseText');

  XMLHttpRequest.prototype.open = function(method, url) {
    this._ubXmlUrl = url;
    return origXHROpen.apply(this, arguments);
  };

  if (origXHRGetter && origXHRGetter.get) {
    Object.defineProperty(XMLHttpRequest.prototype, 'responseText', {
      get: function() {
        var text = origXHRGetter.get.call(this);
        if (!text) return text;
        if (urlMatch && this._ubXmlUrl && this._ubXmlUrl.indexOf(urlMatch) === -1) return text;

        // Check if it's XML
        if (text.indexOf('<?xml') === -1 && text.indexOf('<VAST') === -1 && text.indexOf('<vast') === -1) return text;

        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(text, 'text/xml');
          var nodes = doc.querySelectorAll(selector);
          if (nodes.length > 0) {
            for (var i = nodes.length - 1; i >= 0; i--) {
              nodes[i].parentNode.removeChild(nodes[i]);
            }
            var serializer = new XMLSerializer();
            return serializer.serializeToString(doc);
          }
        } catch (e) {}
        return text;
      },
      configurable: true
    });
  }

  // Also intercept fetch for VAST/XML
  var origFetch = window.fetch;
  window.fetch = function() {
    var fetchUrl = '';
    if (typeof arguments[0] === 'string') fetchUrl = arguments[0];
    else if (arguments[0] && arguments[0].url) fetchUrl = arguments[0].url;

    if (urlMatch && fetchUrl.indexOf(urlMatch) === -1) {
      return origFetch.apply(window, arguments);
    }

    return origFetch.apply(window, arguments).then(function(response) {
      var ct = response.headers.get('content-type') || '';
      if (ct.indexOf('xml') === -1 && ct.indexOf('text') === -1) return response;

      return response.text().then(function(text) {
        if (text.indexOf('<?xml') === -1 && text.indexOf('<VAST') === -1) {
          return new Response(text, { status: response.status, headers: response.headers });
        }
        try {
          var parser = new DOMParser();
          var doc = parser.parseFromString(text, 'text/xml');
          var nodes = doc.querySelectorAll(selector);
          for (var i = nodes.length - 1; i >= 0; i--) {
            nodes[i].parentNode.removeChild(nodes[i]);
          }
          var serializer = new XMLSerializer();
          text = serializer.serializeToString(doc);
        } catch (e) {}
        return new Response(text, { status: response.status, headers: response.headers });
      });
    });
  };
})();
