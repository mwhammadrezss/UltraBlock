/**
 * ══════════════════════════════════════════════════════════════
 *  UltraBlock — Statistics Dashboard Controller
 * ══════════════════════════════════════════════════════════════
 */
'use strict';

(function() {
  const STATS_KEY = 'ub_statistics';
  const HOURLY_KEY = 'ub_hourly_stats';

  const CATEGORY_COLORS = {
    ads: '#f85149',
    trackers: '#a371f7',
    malware: '#ff6b6b',
    annoyances: '#f0883e',
    cookies: '#56d364',
    scripts: '#58a6ff',
    other: '#8b949e'
  };

  let statsData = {};

  function init() {
    loadStats();
    document.getElementById('period-select').addEventListener('change', loadStats);
    // Auto-refresh every 10s
    setInterval(loadStats, 10000);
  }

  function loadStats() {
    chrome.storage.local.get([STATS_KEY, HOURLY_KEY, 'totalBlocked'], result => {
      statsData = result[STATS_KEY] || getEmptyStats();
      const hourly = result[HOURLY_KEY] || {};
      const period = document.getElementById('period-select').value;

      renderSummary(statsData, period);
      renderChart(hourly, period);
      renderTopDomains(statsData);
      renderCategories(statsData);
    });
  }

  function getEmptyStats() {
    return {
      totalBlocked: 0,
      totalTrackers: 0,
      totalCookies: 0,
      bytesBlocked: 0,
      domains: {},
      allowedDomains: {},
      categories: {},
      daily: {}
    };
  }

  // ── Summary cards ─────────────────────────────────────────────────────
  function renderSummary(stats, period) {
    const blocked = filterByPeriod(stats.totalBlocked, stats.daily, period, 'blocked');
    const trackers = filterByPeriod(stats.totalTrackers, stats.daily, period, 'trackers');
    const cookies = filterByPeriod(stats.totalCookies, stats.daily, period, 'cookies');
    const bytes = stats.bytesBlocked || 0;

    document.getElementById('total-blocked').textContent = formatNumber(blocked);
    document.getElementById('total-trackers').textContent = formatNumber(trackers);
    document.getElementById('total-cookies').textContent = formatNumber(cookies);
    document.getElementById('data-saved').textContent = formatBytes(bytes);

    // Delta (vs previous period)
    const deltaEl = document.getElementById('delta-blocked');
    if (period === 'today' && stats.daily) {
      const yesterday = getDateKey(-1);
      const yesterdayBlocked = stats.daily[yesterday] ? stats.daily[yesterday].blocked || 0 : 0;
      const todayBlocked = blocked;
      if (yesterdayBlocked > 0) {
        const pct = Math.round(((todayBlocked - yesterdayBlocked) / yesterdayBlocked) * 100);
        deltaEl.textContent = pct >= 0 ? `↑ ${pct}% vs yesterday` : `↓ ${Math.abs(pct)}% vs yesterday`;
        deltaEl.className = pct >= 0 ? 'delta up' : 'delta down';
      } else {
        deltaEl.textContent = '';
      }
    } else {
      deltaEl.textContent = '';
    }
  }

  // ── Timeline chart ────────────────────────────────────────────────────
  function renderChart(hourly, period) {
    const chartEl = document.getElementById('timeline-chart');
    const labelsEl = document.getElementById('chart-labels');
    chartEl.innerHTML = '';
    labelsEl.innerHTML = '';

    // Generate last 24 hours of data
    const now = new Date();
    const hours = [];
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 3600000);
      const key = `${h.getFullYear()}-${pad(h.getMonth()+1)}-${pad(h.getDate())}_${pad(h.getHours())}`;
      hours.push({ key, hour: h.getHours(), count: hourly[key] || 0 });
    }

    const max = Math.max(...hours.map(h => h.count), 1);

    hours.forEach((h, i) => {
      const bar = document.createElement('div');
      bar.className = 'chart-bar';
      bar.style.height = `${(h.count / max) * 100}%`;

      const tooltip = document.createElement('div');
      tooltip.className = 'tooltip';
      tooltip.textContent = `${h.hour}:00 — ${h.count} blocked`;
      bar.appendChild(tooltip);

      chartEl.appendChild(bar);
    });

    // Labels (every 4 hours)
    for (let i = 0; i < 24; i += 4) {
      const span = document.createElement('span');
      span.textContent = `${hours[i].hour}:00`;
      labelsEl.appendChild(span);
    }
  }

  // ── Top domains ───────────────────────────────────────────────────────
  function renderTopDomains(stats) {
    const blockedEl = document.getElementById('top-blocked');
    const allowedEl = document.getElementById('top-allowed');

    const blocked = Object.entries(stats.domains || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const allowed = Object.entries(stats.allowedDomains || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    blockedEl.innerHTML = blocked.length === 0
      ? '<p style="color:#484f58;font-size:13px">No data yet</p>'
      : blocked.map(([domain, count]) => `
        <div class="list-item">
          <span class="domain">${truncate(domain, 30)}</span>
          <span class="count">${formatNumber(count)}</span>
        </div>
      `).join('');

    allowedEl.innerHTML = allowed.length === 0
      ? '<p style="color:#484f58;font-size:13px">No data yet</p>'
      : allowed.map(([domain, count]) => `
        <div class="list-item">
          <span class="domain">${truncate(domain, 30)}</span>
          <span class="count">${formatNumber(count)}</span>
        </div>
      `).join('');
  }

  // ── Categories ────────────────────────────────────────────────────────
  function renderCategories(stats) {
    const el = document.getElementById('categories');
    const cats = stats.categories || {};

    if (Object.keys(cats).length === 0) {
      el.innerHTML = '<span style="color:#484f58;font-size:13px">No data yet</span>';
      return;
    }

    el.innerHTML = Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => {
        const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
        return `<span class="cat-chip" style="background:${color}22;color:${color}">${cat}: ${formatNumber(count)}</span>`;
      }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function filterByPeriod(total, daily, period, field) {
    if (!daily || period === 'all') return total || 0;

    const now = new Date();
    let sum = 0;

    if (period === 'today') {
      const key = getDateKey(0);
      sum = daily[key] ? (daily[key][field] || 0) : 0;
    } else if (period === 'week') {
      for (let i = 0; i < 7; i++) {
        const key = getDateKey(-i);
        sum += daily[key] ? (daily[key][field] || 0) : 0;
      }
    } else if (period === 'month') {
      for (let i = 0; i < 30; i++) {
        const key = getDateKey(-i);
        sum += daily[key] ? (daily[key][field] || 0) : 0;
      }
    }
    return sum || total || 0;
  }

  function getDateKey(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  }

  function pad(n) { return n.toString().padStart(2, '0'); }
  function formatNumber(n) { return (n || 0).toLocaleString(); }
  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }
  function truncate(s, n) { return s.length > n ? s.substring(0, n) + '…' : s; }

  init();
})();
