/**
 * UltraBlock Scriptlet: set-cookie
 * Sets a cookie with specified name and value.
 * Used to bypass cookie consent walls by pre-setting consent cookies.
 * Usage: ##+js(set-cookie, name, value, [path])
 */
'use strict';
(function() {
  var name = args[0] || '';
  var value = args[1] || '';
  var path = args[2] || '/';

  if (!name) return;

  // Validate value (only safe values for untrusted version)
  var safeValues = ['true', 'false', 'yes', 'no', 'ok', 'on', 'off',
                    'allow', 'deny', 'reject', 'accepted', 'declined',
                    '0', '1', '2', '3', 'necessary', 'essential'];
  var valueLower = value.toLowerCase();
  var isSafe = false;
  for (var i = 0; i < safeValues.length; i++) {
    if (valueLower === safeValues[i]) { isSafe = true; break; }
  }
  // Also allow numeric values
  if (!isSafe && /^\d+$/.test(value)) isSafe = true;
  if (!isSafe) return;

  var cookieStr = name + '=' + encodeURIComponent(value) + '; path=' + path + '; max-age=31536000; SameSite=Lax';
  document.cookie = cookieStr;
})();
