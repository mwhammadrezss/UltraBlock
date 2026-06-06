/**
 * UltraBlock — popup.js  v2.3
 * FIXED: Real-time counter updates while popup is open
 */
'use strict';

(function () {
  function fmtNum(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n || 0);
  }

  function sendMsg(msg) {
    return new Promise(function (resolve, reject) {
      try {
        chrome.runtime.sendMessage(msg, function (resp) {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(resp);
        });
      } catch (e) { reject(e); }
    });
  }

  var powerToggle = document.getElementById('powerToggle');
  var tabCount    = document.getElementById('tabCount');
  var totalCount  = document.getElementById('totalCount');
  var siteDomain  = document.getElementById('siteDomain');
  var siteBtn     = document.getElementById('siteBtn');

  var currentDomain      = '';
  var currentWhitelisted = false;
  var _pollInterval      = null;

  function renderStats(data) {
    // Animate counter change
    var newTab   = fmtNum(data.tabBlocked || 0);
    var newTotal = fmtNum(data.totalBlocked || 0);

    if (tabCount.textContent !== newTab) {
      tabCount.textContent = newTab;
      tabCount.classList.add('pulse');
      setTimeout(function() { tabCount.classList.remove('pulse'); }, 300);
    }
    if (totalCount.textContent !== newTotal) {
      totalCount.textContent = newTotal;
      totalCount.classList.add('pulse');
      setTimeout(function() { totalCount.classList.remove('pulse'); }, 300);
    }

    currentDomain      = data.domain || '';
    currentWhitelisted = !!data.whitelisted;

    if (currentDomain) {
      siteDomain.textContent = currentDomain;
      siteDomain.classList.remove('empty');
      siteBtn.disabled = false;
    } else {
      siteDomain.textContent = '—';
      siteDomain.classList.add('empty');
      siteBtn.disabled = true;
    }

    renderSiteButton();
  }

  function renderSiteButton() {
    if (currentWhitelisted) {
      siteBtn.textContent = 'Resume';
      siteBtn.className   = 'site-btn resume';
    } else {
      siteBtn.textContent = 'Pause';
      siteBtn.className   = 'site-btn pause';
    }
  }

  function renderProtection(enabled) {
    powerToggle.checked = !!enabled;
  }

  function fetchStats() {
    return sendMsg({ action: 'getStats' }).then(renderStats).catch(function() {});
  }

  // Init
  Promise.all([
    sendMsg({ action: 'getStats' }),
    sendMsg({ action: 'getProtectionStatus' }),
  ]).then(function (results) {
    renderStats(results[0] || {});
    renderProtection((results[1] || {}).enabled !== false);
  }).catch(function () {});

  // Real-time polling while popup is open (every 1s)
  _pollInterval = setInterval(fetchStats, 1000);

  // Power toggle
  powerToggle.addEventListener('change', function () {
    var enabled = powerToggle.checked;
    sendMsg({ action: 'toggleProtection', enabled: enabled }).catch(function () {
      powerToggle.checked = !enabled;
    });
  });

  // Site toggle
  siteBtn.addEventListener('click', function () {
    if (!currentDomain || siteBtn.disabled) return;
    siteBtn.disabled = true;
    var addToWhitelist = !currentWhitelisted;
    sendMsg({
      action: 'toggleSite',
      domain: currentDomain,
      whitelist: addToWhitelist,
    }).then(function (resp) {
      if (resp && resp.success) {
        currentWhitelisted = !!resp.whitelisted;
        renderSiteButton();
      }
      siteBtn.disabled = false;
    }).catch(function () { siteBtn.disabled = false; });
  });

})();
