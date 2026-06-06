/**
 * UltraBlock Scriptlet: spoof-css
 * Spoofs computed CSS property values for specified elements.
 * Useful to defeat ad-blocker detection via element dimension checks.
 * Usage: ##+js(spoof-css, selector, property, value)
 */
'use strict';
(function() {
  var selector = args[0] || '';
  var propName = args[1] || '';
  var propValue = args[2] || '';

  if (!selector || !propName) return;

  var origGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function(el, pseudoElt) {
    var style = origGetComputedStyle.call(window, el, pseudoElt);
    if (!el || !el.matches) return style;

    try {
      if (el.matches(selector)) {
        var proxy = new Proxy(style, {
          get: function(target, prop) {
            if (prop === propName) return propValue;
            var val = target[prop];
            if (typeof val === 'function') return val.bind(target);
            return val;
          }
        });
        return proxy;
      }
    } catch (e) {}
    return style;
  };
})();
