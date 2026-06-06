/**
 * UltraBlock — Neutered Amazon Publisher Services (apstag.js)
 */
(function() {
  'use strict';
  var noopfn = function() {};
  var cbfn = function() {
    var args = Array.prototype.slice.call(arguments);
    var cb = args[args.length - 1];
    if (typeof cb === 'function') { cb([]); }
  };
  window.apstag = {
    init: noopfn,
    fetchBids: cbfn,
    setDisplayBids: noopfn,
    targetingKeys: noopfn,
    debug: noopfn,
    enableDebug: noopfn,
    disableDebug: noopfn,
    punt: noopfn,
    renderImp: noopfn,
    _Q: [],
    _getSlotIdToNameMapping: function() { return {}; },
    thirdPartyData: {}
  };
})();
