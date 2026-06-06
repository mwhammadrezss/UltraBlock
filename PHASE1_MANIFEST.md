# Phase 1 Manifest — Source Code Import

**Date:** 2026-06-06  
**Status:** ✅ Complete

---

## Summary

Copied core implementations from 3 source repositories into UltraBlock's structure.

| Source Repo | Files Copied | Purpose |
|-------------|-------------|---------|
| gorhill/uBlock | 21 files + 50 redirect resources | Scriptlet engine, cosmetic filtering, dynamic filtering, logger, redirect engine, filter compiler, assets |
| dhowe/AdNauseam | 5 files | Click obfuscation, ad vault, text ad detection |
| ajayyy/SponsorBlock | 5 files (.ts) | Full sponsor skip implementation, preview bar, control bar |

---

## Detailed File Mapping

### From uBlock Origin → `src/engine/`

| Source File | Destination | Size | Description |
|------------|-------------|------|-------------|
| `src/js/scriptlet-filtering.js` | `src/engine/scriptlet-filtering.js` | 13.8K | Scriptlet injection orchestrator |
| `src/js/scriptlet-filtering-core.js` | `src/engine/scriptlet-filtering-core.js` | 11.3K | Core scriptlet matching logic |
| `src/js/cosmetic-filtering.js` | `src/engine/cosmetic-filtering.js` | 33.1K | Full procedural cosmetic engine |
| `src/js/static-ext-filtering.js` | `src/engine/static-ext-filtering.js` | 6.0K | Extended static filter processing |
| `src/js/static-ext-filtering-db.js` | `src/engine/static-ext-filtering-db.js` | 8.8K | Extended filter database |
| `src/js/dynamic-net-filtering.js` | `src/engine/dynamic-net-filtering-full.js` | 14.8K | Full dynamic filtering firewall |
| `src/js/logger.js` | `src/engine/logger.js` | 2.7K | Network logger core |
| `src/js/logger-ui.js` | `src/engine/logger-ui.js` | 103K | Logger UI (full) |
| `src/js/redirect-engine.js` | `src/engine/redirect-engine.js` | 16.9K | Resource redirect/replacement engine |
| `src/js/redirect-resources.js` | `src/engine/redirect-resources.js` | 5.7K | Redirect resource registry |
| `src/js/html-filtering.js` | `src/engine/html-filtering.js` | 13.0K | HTML response filtering |
| `src/js/filtering-context.js` | `src/engine/filtering-context.js` | 14.7K | Request context object |
| `src/js/filtering-engines.js` | `src/engine/filtering-engines.js` | 1.8K | Engine orchestrator |
| `src/js/url-net-filtering.js` | `src/engine/url-net-filtering.js` | 10.1K | URL-based network filtering |
| `src/js/httpheader-filtering.js` | `src/engine/httpheader-filtering.js` | 6.1K | HTTP header filtering |

### From uBlock Origin → `src/filterlist/`

| Source File | Destination | Size | Description |
|------------|-------------|------|-------------|
| `src/js/static-filtering-parser.js` | `src/filterlist/static-filtering-parser.js` | 169K | Full ABP/uBO filter syntax parser |
| `src/js/static-net-filtering.js` | `src/filterlist/static-net-filtering.js` | 198K | Static network filter compiler & matcher |
| `src/js/static-filtering-io.js` | `src/filterlist/static-filtering-io.js` | 4.5K | Filter I/O operations |
| `src/js/assets.js` | `src/filterlist/assets.js` | 51.5K | Filter list auto-update system |

### From uBlock Origin → `src/content/`

| Source File | Destination | Description |
|------------|-------------|-------------|
| `src/js/scriptlets/epicker.js` | `src/content/epicker-full.js` | Full element picker implementation |

### From uBlock Origin → `src/scriptlets/`

| Source File | Destination | Description |
|------------|-------------|-------------|
| `src/js/resources/scriptlets.js` | `src/scriptlets/scriptlets-master.js` | Master scriptlet resource (all uBO scriptlets) |

### From uBlock Origin → `src/redirects/ublock/` (50 files)

All web_accessible_resources including:
- `1x1.gif`, `2x2.png`, `3x2.png`, `32x32.png`
- `amazon_apstag.js`, `amazon_ads.js`
- `google-analytics_analytics.js`, `google-analytics_ga.js`
- `googlesyndication_adsbygoogle.js`, `googletagmanager_gtm.js`
- `doubleclick_instream_ad_status.js`
- `scorecardresearch_beacon.js`, `outbrain-widget.js`
- `noop.js`, `noop.html`, `noopframe.html`, `noop.txt`
- `ampproject_v0.js`, `chartbeat.js`, `fingerprintjs2.js`, `fingerprintjs3.js`
- And 30+ more redirect/neutered resources

---

### From AdNauseam → `src/engine/`

| Source File | Destination | Size | Description |
|------------|-------------|------|-------------|
| `src/js/adn/core.js` | `src/engine/adnauseam-core.js` | 68.8K | Click obfuscation engine |
| `src/js/adn/vault.js` | `src/engine/ad-vault.js` | 62.4K | Ad vault / collection system |
| `src/js/adn/adn-utils.js` | `src/engine/adnauseam-utils.js` | 20.8K | Utility functions |
| `src/js/adn/parser.js` | `src/engine/adnauseam-parser.js` | 35.3K | Ad parser / extractor |
| `src/js/adn/textads.js` | `src/engine/adnauseam-textads.js` | 16.4K | Text ad detection |

---

### From SponsorBlock → `src/content/`

| Source File | Destination | Description |
|------------|-------------|-------------|
| `src/content.ts` | `src/content/sponsorblock-full.ts` | Full sponsor segment skip implementation |
| `src/js-components/previewBar.ts` | `src/content/previewBar.ts` | Video timeline preview bar |
| `src/js-components/skipButtonControlBar.ts` | `src/content/skipButtonControlBar.ts` | Skip button UI component |
| `src/config.ts` | `src/content/sponsorblock-config.ts` | Configuration types & defaults |
| `src/messageTypes.ts` | `src/content/sponsorblock-types.ts` | Message type definitions |

---

## Existing Files (Untouched)

These UltraBlock originals were NOT overwritten:
- `src/engine/scriptlet-engine.js` (UltraBlock's own, kept alongside uBO's)
- `src/engine/scriptlet-registry.js`
- `src/engine/dynamic-filtering.js` (UltraBlock's simpler version kept; uBO's saved as `-full`)
- `src/engine/network-logger.js` (UltraBlock's own, kept alongside uBO's)
- `src/content/sponsorblock.js` (UltraBlock's own, full version saved as `-full.ts`)
- `src/content/element-picker.js` (UltraBlock's own, full version saved as `epicker-full.js`)
- `src/filterlist/filter-compiler.js`
- `src/filterlist/list-manager.js`
- All 27 existing scriptlets in `src/scriptlets/`
- All existing redirect resources in `src/redirects/`

---

## Next Steps (Phase 2)

1. Wire the new engines into `background.js` and `manifest.json`
2. Adapt uBlock's module system (µBlock global) to UltraBlock's MV3 service worker
3. Convert SponsorBlock TypeScript to JS or add build step
4. Integrate AdNauseam click obfuscation as opt-in feature
5. Update `web_accessible_resources` in manifest to include ublock redirects
6. Test filter list loading with the new parser + compiler
