# Phase 2 Manifest — Wiring & Integration

**Date:** 2026-06-06  
**Status:** ✅ Complete

---

## Summary

Wired all Phase 1 engine imports into the working extension. Created UI pages and adapters.

---

## Files Modified

| File | Changes |
|------|---------|
| `manifest.json` | Added `src/redirects/ublock/*` to web_accessible_resources; added `epicker-full.js` and `adnauseam-detector.js` to content scripts |
| `src/background/background.js` | Added importScripts for `redirect-adapter.js` and `adnauseam-adapter.js`; added init calls; added 7 new message handlers |
| `src/popup/popup.html` | Added tools section (Logger, Picker, Vault buttons) + filter info bar; updated version to 2.4.0 |
| `src/popup/popup.js` | Added click handlers for tool buttons; added filter list info fetch |

## Files Created

| File | Purpose | Size |
|------|---------|------|
| `src/engine/adnauseam-adapter.js` | Lightweight click obfuscation engine (detect → click → store) | ~5K |
| `src/engine/redirect-adapter.js` | Redirect resource registry (maps filter names → resource paths) | ~4K |
| `src/content/adnauseam-detector.js` | Content script that scans pages for ad links and reports to background | ~2K |
| `src/pages/logger.html` | Full network logger UI (real-time, filterable, color-coded) | ~8K |
| `src/pages/adnauseam.html` | Ad Vault viewer (grid of collected ads, stats, drain estimate) | ~7K |

---

## New Message Handlers in background.js

| Action | Description |
|--------|-------------|
| `getRedirectResources` | Returns list of all available redirect resources |
| `toggleAdNauseam` | Enable/disable click obfuscation |
| `getAdNauseamStatus` | Check if AdNauseam is enabled |
| `getAdVault` | Return collected ads + stats |
| `clearAdVault` | Wipe all collected ads |
| `reportAd` | Content script reports a detected ad |
| `getLoggerUI` | Return logger entries for the UI page |

---

## Architecture Notes

- **AdNauseam Adapter** is standalone — no dependency on the uBlock object tree. It uses a simple detect→click→store pattern with debounced persistence to `chrome.storage.local`.
- **Redirect Adapter** maps resource aliases (used in filter rules like `$redirect=noop.js`) to actual file paths in `src/redirects/` and `src/redirects/ublock/`.
- **Logger page** polls the background every 1.5s and renders entries in a table with color coding.
- **Ad Vault page** refreshes every 3s, shows ads newest-first in a card grid.
- All new features are **opt-in** — AdNauseam is disabled by default, Logger must be explicitly enabled.
