/**
 * UltraBlock Scriptlet: prevent-xhr
 * Prevents XMLHttpRequest calls matching specified patterns.
 * Usage: ##+js(prevent-xhr, propsToMatch, responseBody)
 */
'use strict';
(function() {
  var propsToMatch = args[0] || '';
  var responseBody = args[1] || '';

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this._ubMethod = method;
    this._ubUrl = url;
    this._ubBlocked = false;

    if (propsToMatch) {
      var needles = propsToMatch.split(/\s+/);
      for (var i = 0; i < needles.length; i++) {
        var parts = needles[i].split(':');
        var key = parts[0];
        var val = parts.slice(1).join(':');
        if (key === 'url' && url.indexOf(val) !== -1) { this._ubBlocked = true; break; }
        if (key === 'method' && method.toUpperCase() === val.toUpperCase()) { this._ubBlocked = true; break; }
        if (!val && url.indexOf(key) !== -1) { this._ubBlocked = true; break; }
      }
    } else {
      this._ubBlocked = true;
    }

    if (!this._ubBlocked) {
      return origOpen.apply(this, arguments);
    }
  };

  XMLHttpRequest.prototype.send = function() {
    if (this._ubBlocked) {
      // Simulate successful empty response
      Object.defineProperty(this, 'readyState', { value: 4, writable: false });
      Object.defineProperty(this, 'status', { value: 200, writable: false });
      Object.defineProperty(this, 'statusText', { value: 'OK', writable: false });
      Object.defineProperty(this, 'responseText', { value: responseBody, writable: false });
      Object.defineProperty(this, 'response', { value: responseBody, writable: false });

      var self = this;
      setTimeout(function() {
        if (typeof self.onreadystatechange === 'function') {
          self.onreadystatechange();
        }
        if (typeof self.onload === 'function') {
          self.onload();
        }
        self.dispatchEvent(new Event('readystatechange'));
        self.dispatchEvent(new Event('load'));
        self.dispatchEvent(new Event('loadend'));
      }, 1);
      return;
    }
    return origSend.apply(this, arguments);
  };
})();
