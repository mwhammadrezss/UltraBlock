/**
 * UltraBlock — Neutered Google Analytics (analytics.js)
 * All tracking functions are stubbed to no-op.
 * Pages that depend on GA loading won't break.
 */
(function() {
  'use strict';
  var noopfn = function() { return null; };
  var noopnull = function() { return null; };
  //
  var Tracker = function() {};
  Tracker.prototype.get = noopfn;
  Tracker.prototype.set = noopfn;
  Tracker.prototype.send = noopfn;
  //
  var p = Tracker.prototype;
  p.get = noopfn;
  p.set = noopfn;
  p.send = noopfn;
  //
  var ga = function() {
    var len = arguments.length;
    if (len === 0) return;
    var args = Array.prototype.slice.call(arguments);
    var callback;
    // Support hitCallback
    if (len > 1) {
      var last = args[len - 1];
      if (typeof last === 'object' && typeof last.hitCallback === 'function') {
        callback = last.hitCallback;
      } else if (typeof last === 'function') {
        callback = last;
      }
    }
    // run callback
    if (callback) {
      try { callback(); } catch (e) {}
    }
    // Check for 'create' command → return tracker stub
    if (args[0] === 'create') {
      return new Tracker();
    }
  };
  ga.create = function() { return new Tracker(); };
  ga.getByName = function() { return new Tracker(); };
  ga.getAll = function() { return [new Tracker()]; };
  ga.remove = noopfn;
  ga.loaded = true;
  ga.q = [];
  //
  window.ga = window.ga || ga;
  window.GoogleAnalyticsObject = 'ga';
  // Trigger any queued commands
  var q = window.ga && window.ga.q;
  if (Array.isArray(q)) {
    for (var i = 0; i < q.length; i++) {
      try { ga.apply(null, q[i]); } catch (e) {}
    }
  }
})();
