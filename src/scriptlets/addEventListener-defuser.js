/**
 * UltraBlock Scriptlet: addEventListener-defuser
 * Prevents addEventListener calls matching specified event type and handler pattern.
 * Usage: ##+js(addEventListener-defuser, type, pattern)
 */
'use strict';
(function() {
  var targetType = args[0] || '';
  var handlerPattern = args[1] || '';

  var origAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, handler, options) {
    var shouldBlock = false;

    if (targetType && type === targetType) {
      if (!handlerPattern) {
        shouldBlock = true;
      } else if (handler && typeof handler === 'function') {
        var handlerStr = handler.toString();
        if (handlerPattern[0] === '/' && handlerPattern[handlerPattern.length - 1] === '/') {
          try {
            var re = new RegExp(handlerPattern.slice(1, -1));
            shouldBlock = re.test(handlerStr);
          } catch (e) {}
        } else {
          shouldBlock = handlerStr.indexOf(handlerPattern) !== -1;
        }
      }
    } else if (!targetType) {
      // No type specified, match all
      if (handler && typeof handler === 'function' && handlerPattern) {
        var hStr = handler.toString();
        shouldBlock = hStr.indexOf(handlerPattern) !== -1;
      }
    }

    if (shouldBlock) return;
    return origAdd.apply(this, arguments);
  };
})();
