/**
 * UltraBlock Scriptlet: abort-current-script
 * Aborts execution of inline script containing specified text.
 * Usage: ##+js(abort-current-script, property, search)
 */
'use strict';
(function() {
  var target = args[0];
  var needle = args[1] || '';
  if (!target) return;

  var magic = String.fromCharCode(Date.now() % 26 + 97) + Math.random().toString(36).slice(2, 8);
  var rid = magic;
  var abortScript = function() {
    var e = new Error(rid);
    e.name = '';
    throw e;
  };

  var makeProxy = function(owner, prop) {
    var desc = Object.getOwnPropertyDescriptor(owner, prop);
    if (!desc || desc.get !== undefined) return;

    var value = owner[prop];
    Object.defineProperty(owner, prop, {
      get: function() {
        abortScript();
        return value;
      },
      set: function(v) {
        value = v;
      },
      configurable: true
    });
  };

  var owner = window;
  var chain = target.split('.');
  for (var i = 0; i < chain.length - 1; i++) {
    if (!owner[chain[i]]) {
      owner[chain[i]] = {};
    }
    owner = owner[chain[i]];
  }
  var prop = chain[chain.length - 1];

  if (needle) {
    // Only abort if script contains needle text
    var origAppendChild = Element.prototype.appendChild;
    Element.prototype.appendChild = function(node) {
      if (node.tagName === 'SCRIPT' && node.textContent &&
          node.textContent.indexOf(needle) !== -1) {
        makeProxy(owner, prop);
      }
      return origAppendChild.apply(this, arguments);
    };
  } else {
    makeProxy(owner, prop);
  }
})();
