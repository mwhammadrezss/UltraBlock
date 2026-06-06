/**
 * UltraBlock Scriptlet: no-floc
 * Disables Google's FLoC / Topics API.
 * Usage: ##+js(no-floc)
 */
'use strict';
(function() {
  // Disable FLoC (Federated Learning of Cohorts)
  if (document.interestCohort) {
    document.interestCohort = function() {
      return Promise.reject(new DOMException('FLoC blocked by UltraBlock'));
    };
  }

  // Disable Topics API
  if (document.browsingTopics) {
    document.browsingTopics = function() {
      return Promise.resolve([]);
    };
  }

  // Set Permissions-Policy header equivalent via meta
  var meta = document.createElement('meta');
  meta.httpEquiv = 'Permissions-Policy';
  meta.content = 'interest-cohort=(), browsing-topics=()';
  if (document.head) {
    document.head.appendChild(meta);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(meta);
    });
  }
})();
