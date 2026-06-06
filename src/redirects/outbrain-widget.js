/**
 * UltraBlock — Neutered Outbrain Widget
 */
(function() {
  'use strict';
  var noopfn = function() {};
  window.OB_ADV_ID = '';
  window.OBR = window.OBR || {};
  window.OBR.extern = {
    video: { get498: noopfn, setup: noopfn },
    call498: noopfn,
    call498498: noopfn
  };
  window.OB_PROXY = window.OB_PROXY || {};
  window.outbrain = window.outbrain || { ready: true, error: false };
  window.Outbrain = window.Outbrain || { widget: { render: noopfn } };
})();
