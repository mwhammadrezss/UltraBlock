/**
 * UltraBlock — Neutered Google AdSense (adsbygoogle.js)
 * Prevents "adsbygoogle is not defined" errors.
 */
(function() {
  'use strict';
  var adsbygoogle = window.adsbygoogle = window.adsbygoogle || [];
  if (!adsbygoogle._ubPatched) {
    var origPush = adsbygoogle.push;
    adsbygoogle.push = function(params) {
      // Hide unfilled ad slots
      if (params && params.google_ad_client) {
        var slots = document.querySelectorAll('ins.adsbygoogle[data-ad-client]');
        for (var i = 0; i < slots.length; i++) {
          slots[i].style.display = 'none';
          slots[i].style.height = '0';
          slots[i].style.overflow = 'hidden';
        }
      }
      return Array.prototype.push.apply(adsbygoogle, arguments);
    };
    adsbygoogle.loaded = true;
    adsbygoogle._ubPatched = true;
  }
})();
