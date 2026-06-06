/**
 * UltraBlock — Neutered Google Tag Manager (gtm.js)
 * Stubs dataLayer push and GTM container loading.
 */
(function() {
  'use strict';
  var noopfn = function() {};
  //
  var dataLayer = window.dataLayer = window.dataLayer || [];
  // Preserve existing push but neuter GTM processing
  if (typeof dataLayer.push !== 'function' || !dataLayer._ubPatched) {
    var origPush = dataLayer.push;
    dataLayer.push = function() {
      // Accept the push (so page code doesn't error) but don't process
      if (typeof origPush === 'function') {
        return origPush.apply(dataLayer, arguments);
      }
      return Array.prototype.push.apply(dataLayer, arguments);
    };
    dataLayer._ubPatched = true;
  }
  //
  // Stub google_tag_manager
  window.google_tag_manager = window.google_tag_manager || {};
  window.google_tag_manager['dataLayer'] = {
    reset: noopfn,
    set: noopfn,
    get: function() { return ''; }
  };
  //
  // gtag() function stub
  window.gtag = window.gtag || function() {
    dataLayer.push(arguments);
  };
})();
