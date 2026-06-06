/**
 * UltraBlock Scriptlet: remove-cookie
 * Removes cookies matching a specified name pattern.
 * Usage: ##+js(remove-cookie, namePattern)
 */
'use strict';
(function() {
  var namePattern = args[0] || '';
  if (!namePattern) return;

  var re = null;
  if (namePattern[0] === '/' && namePattern[namePattern.length - 1] === '/') {
    try { re = new RegExp(namePattern.slice(1, -1)); } catch (e) {}
  }

  var removeCookies = function() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      var eqIdx = cookie.indexOf('=');
      var name = eqIdx !== -1 ? cookie.substring(0, eqIdx).trim() : cookie.trim();
      if (!name) continue;

      var matches = re ? re.test(name) : name.indexOf(namePattern) !== -1;
      if (matches) {
        // Delete by setting expired
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname;
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.' + location.hostname;
      }
    }
  };

  removeCookies();
  // Run periodically to catch cookies set after page load
  setInterval(removeCookies, 5000);
})();
