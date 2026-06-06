# UltraBlock — Architecture Document
**v2.4.0 | Chrome Extension (Manifest V3)**

---

## 🗂️ ساختار فایل‌ها

```
UltraBlock/
├── manifest.json               ← تنظیمات اصلی اکستنشن
├── icons/                      ← آیکون‌های 16/32/48/128px
├── rules/                      ← قوانین بلاک DNS/Network (declarativeNetRequest)
│   ├── ad_networks.json        ← 168 قانون بلاک
│   ├── trackers.json           ← 100 قانون بلاک
│   ├── malware.json            ← 40 قانون بلاک
│   └── annoyances.json         ← 60 قانون بلاک
└── src/
    ├── background/
    │   └── background.js       ← Service Worker مرکزی
    ├── content/
    │   ├── stealth.js          ← ضد شناسایی (MAIN world)
    │   ├── inject.js           ← YouTube/Twitch هوک (MAIN world)
    │   ├── tracker-poison.js   ← مسموم‌سازی تراکرها (MAIN world)
    │   ├── content.js          ← پاک‌سازی DOM (ISOLATED world)
    │   ├── youtube.js          ← کیلر آگهی YouTube
    │   ├── video-patch.js      ← پچ ویدیو YouTube/Twitch
    │   ├── cookie-negotiator.js← رد خودکار کوکی‌ها
    │   ├── dark-patterns.js    ← خنثی‌سازی دارک پترن
    │   ├── dopamine-detox.js   ← محدودیت اسکرول و شورتز
    │   └── retro-mode.js       ← حالت خواندن مینیمال
    ├── popup/
    │   ├── popup.html          ← رابط کاربری
    │   └── popup.js            ← منطق popup
    └── styles/
        └── cosmetic.css        ← استایل‌های مخفی‌سازی
```

---

## 🏗️ معماری کلی — چهار لایه

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1 — Network (declarativeNetRequest)                       │
│  بلاک در سطح شبکه، قبل از اینکه request به صفحه برسه           │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2 — MAIN World Scripts (stealth / inject / poison)        │
│  اجرا در دنیای JS صفحه، قبل از هر script دیگه‌ای               │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3 — ISOLATED World Scripts (content / youtube / …)        │
│  پاک‌سازی DOM، مخفی‌سازی المنت‌ها، هندل کردن رابط کاربری      │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 4 — Background Service Worker                             │
│  مدیریت state، badge، whitelist، پیام‌رسانی                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📋 تحلیل هر ماژول

---

### ① background.js — مغز اکستنشن

**نوع:** MV3 Service Worker

**کارها:**
- نگه‌داری آمار بلاک (per tab + کل) با persistence در `chrome.storage`
- Badge counter روی آیکون اکستنشن
- مدیریت whitelist سایت‌ها از طریق dynamic DNR rules
- پیام‌رسانی با content scriptها
- اعمال CSP removal rule برای باز کردن قفل header‌ها
- پشتیبانی از keyboard command (Ctrl+Shift+E)

**نقاط ضعف:**
- Service Worker در MV3 می‌تونه بمیره — state با `chrome.storage.session` ذخیره می‌شه
- Polling هر ۵ ثانیه از `getMatchedRules` برای count (fallback)
- `onRuleMatchedDebug` فقط در Dev mode کار می‌کنه نه Production

---

### ② rules/ — لایه اول دفاع (Network-level)

| فایل | تعداد قانون | هدف |
|------|-------------|-----|
| `ad_networks.json` | 168 | شبکه‌های تبلیغاتی (Google Ads, Amazon, Taboola, ...) |
| `trackers.json` | 100 | ترکرهای آماری (GA, GTM, Facebook Pixel, ...) |
| `malware.json` | 40 | دامنه‌های مخرب (Coinhive, crypto miners, ...) |
| `annoyances.json` | 60 | مزاحمت‌ها (Cookiebot, OneTrust, ...) |

**نوع action:** همه `"block"` (بلاک کامل request)

**محدودیت MV3:** حداکثر ۳۰,۰۰۰ قانون static + ۵,۰۰۰ dynamic — فعلاً خیلی زیر سقف هستیم (۳۶۸ قانون)

---

### ③ stealth.js — سپر ضد شناسایی

**نوع:** MAIN World, document_start, all_frames

**کارها:**
1. **Fake Ad SDKs** — جعل `googletag`, `adsbygoogle`, `pbjs`, `apstag` تا سایت فکر کنه SDK لود شده
2. **DOM Dimension Spoofing** — override کردن `offsetHeight`, `offsetWidth`, `getBoundingClientRect`, `clientHeight/Width` برای المنت‌های مخفی‌شده (تا بررسی ابعاد صفر نشون نده)
3. **getComputedStyle Spoofing** — برای المنت‌های hidden، `visibility: visible` و `display: block` برمی‌گردونه
4. **Anti-AAB** — خنثی‌سازی FuckAdBlock, BlockAdBlock و ۱۴ نوع detector مشابه
5. **Fetch/XHR Probe Interceptor** — درخواست‌های probe (مثل `bait.js`, `pagefair.com`) رو fake response می‌ده
6. **Shadow DOM** — تمام shadow rootها رو `mode: open` می‌کنه
7. **querySelector Spoofing** — برای query‌های مشکوک، المنت‌های hidden رو از نتیجه حذف می‌کنه
8. **Performance.now Noise** — نویز ۰.۱ms به timer اضافه می‌کنه (ضد timing fingerprint)
9. **Navigator.brave Spoofing** — پنهان کردن Brave browser

---

### ④ inject.js — هوک‌های عمیق YouTube/Twitch

**نوع:** MAIN World, document_start, all_frames

**کارها:**

**YouTube:**
- Hook کردن `fetch` + `XHR` برای endpoint `/youtubei/v1/player`
- حذف surgical کلیدهای JSON آگهی از response (مثل `adPlacements`, `playerAds`, ...)
- Override `ytInitialPlayerResponse` با Proxy تا قبل از parse شدن پاک بشه
- **Time-Warp Engine** — وقتی آگهی detect شد:
  - سرعت ویدیو رو `16x` می‌کنه
  - صدا رو mute می‌کنه
  - دکمه Skip رو کلیک می‌کنه
  - بعد از تموم شدن آگهی صدا و سرعت رو برمی‌گردونه

**Twitch:**
- Hook کردن `fetch` برای فایل‌های `.m3u8`
- حذف tag‌های آگهی از playlist (`EXT-X-CUE-OUT`, `ADVERTISEMENT`, ...)
- Speed-up ویدیو آگهی Twitch

**Popup Killer (همه سایت‌ها):**
- Block کردن `window.open` برای دامنه‌های آگهی شناخته‌شده
- حذف invisible overlay‌های full-page (click hijacking)
- Block کردن click روی لینک‌های آگهی

---

### ⑤ tracker-poison.js — مسموم‌سازی تراکرها

**نوع:** MAIN World, document_start

**ایده:** به جای block کردن (که anti-adblock تریگر می‌شه)، اطلاعات جعلی ارسال می‌کنه

**کارها:**
1. **Google Analytics Poisoning** — inject کردن fake user properties (سن، جنسیت، علایق اشتباه) به dataLayer
2. **Facebook Pixel Poisoning** — ارسال advanced matching اشتباه (ایمیل، کشور، سن، شهر جعلی)
3. **Beacon Poisoning** — دستکاری `sendBeacon` payload با اطلاعات جعلی
4. **Fingerprint Randomization:**
   - Screen size جعلی
   - `hardwareConcurrency` جعلی
   - `deviceMemory` جعلی
   - Canvas fingerprint noise (۳-۵ پیکسل تصادفی)
   - WebGL renderer/vendor جعلی

---

### ⑥ content.js — پاک‌سازی DOM

**نوع:** ISOLATED World, document_start, all_frames

**کارها:**
- **AD_SELECTORS** (~۸۰ selector): stealthHide کردن المنت‌های آگهی واقعی (visibility:hidden)
- **OVERLAY_SELECTORS** (~۳۰ selector): hardRemove کردن دیوارهای anti-adblock
- **killFloatingAds()**: detect و مخفی‌کردن floating/sticky آگهی‌های corner
- **siteSpecificPatches()**: پچ‌های خاص برای Forbes, Fandom, Reddit, Yahoo, MSN, YouTube, Twitch
- **Scroll Restore**: آزاد کردن body scroll بعد از حذف overlay
- **MutationObserver**: handle کردن SPAها با batched rAF

---

### ⑦ youtube.js — کیلر آگهی YouTube

**نوع:** ISOLATED World, فقط youtube.com

**کارها:**
- Auto-click کردن دکمه Skip Ad
- Inject کردن CSS که المنت‌های آگهی YouTube رو hide می‌کنه
- MutationObserver برای detect آگهی‌های تازه inject شده

---

### ⑧ video-patch.js — پچ ویدیو (YouTube + Twitch)

**نوع:** ISOLATED World

**کارها:**
- وقتی آگهی ویدیویی detect شد، یه **overlay dashboard** روی player نشون می‌ده شامل:
  - ساعت real-time
  - تعداد کل آگهی‌های بلاک شده
  - زمان ذخیره شده
  - مدت session
- Audio مخفی می‌کنه تا آگهی شنیده نشه

---

### ⑨ cookie-negotiator.js — مذاکره با کوکی‌ها

**نوع:** ISOLATED World

**کارها:**
- پشتیبانی از ۶ platform کوکی: OneTrust, Cookiebot, TrustArc, Quantcast, SourcePoint, Generic
- **Strategy 1 (Quick Reject):** پیدا کردن و کلیک دکمه "Reject All" یا "Only Necessary"
- **Strategy 2 (Deep Negotiate):** باز کردن تنظیمات ← uncheck همه checkboxها ← ذخیره
- پشتیبانی از iframe-based consent (Guardian, Bloomberg)
- تلاش تا ۱۵ بار با delay

---

### ⑩ dark-patterns.js — خنثی‌سازی دارک پترن

**نوع:** ISOLATED World

**کارها:**
- **Hidden Close Button Revealer:** دکمه‌های بستن کوچک/نامرئی رو visible و outline‌دار می‌کنه
- **Countdown Unlocker:** دکمه‌های disabled با تایمر رو فوری فعال می‌کنه
- **Deceptive Checkbox Uncheck:** checkboxهای pre-checked خبرنامه/بازاریابی رو uncheck می‌کنه
- **Click Trap Killer:** overlay‌های invisible full-page رو حذف می‌کنه
- **Notification Blocker:** prompt‌های push notification رو مخفی می‌کنه

---

### ⑪ dopamine-detox.js — کنترل مصرف

**نوع:** ISOLATED World, سایت‌های اجتماعی

**کارها:**
- **Infinite Scroll Limiter:** بعد از N viewport اسکرول، صفحه‌رو قفل و banner نشون می‌ده
- **Shorts/Reels Hider:** مخفی‌کردن YouTube Shorts, Instagram Reels
- **Recommended Hider:** مخفی‌کردن بخش‌های "پیشنهادی"
- **Grayscale Badges:** notification بج‌ها رو خاکستری می‌کنه
- **Autoplay Muter:** ویدیوهای autoplay رو mute می‌کنه

---

### ⑫ retro-mode.js — حالت خواندن

**نوع:** ISOLATED World, Ctrl+Shift+E

**کارها:**
- حذف همه stylesheet‌ها و inline style‌ها
- inject کردن CSS مینیمال (max-width 720px، فونت serif)
- مخفی‌کردن header, footer, nav, sidebar, modal, popup, iframe, تبلیغات
- خنثی‌سازی GA, GTM, Facebook Pixel, Mixpanel
- حذف iframeها (به جز YouTube embed)

---

### ⑬ popup.html / popup.js — رابط کاربری

**کارها:**
- نمایش آمار real-time (این صفحه + کل)
- Power toggle (فعال/غیرفعال کردن همه rule‌ها)
- Pause/Resume برای سایت فعلی (whitelist)
- نمایش domain جاری
- polling هر ۱ ثانیه برای آپدیت counter

---

## 🔍 جریان داده

```
User visits page
       │
       ▼
[Layer 1] declarativeNetRequest → Block known ad domains (168+100+40+60 rules)
       │
       ▼
[Layer 2] stealth.js (MAIN) → Fake SDKs, Spoof dimensions, Kill detectors
[Layer 2] tracker-poison.js → Randomize fingerprint, Poison GA/FB
[Layer 2] inject.js → Hook fetch/XHR for YT/Twitch
       │
       ▼
[Layer 3] content.js → Hide ad elements, Remove overlays
[Layer 3] youtube.js → Hide YT ad elements, Click skip
[Layer 3] cookie-negotiator.js → Auto-reject cookies
[Layer 3] dark-patterns.js → Fix hidden buttons, uncheck checkboxes
[Layer 3] dopamine-detox.js → Limit scroll, hide shorts
       │
       ▼
[Layer 4] background.js → Count blocks → Update badge → Persist stats
```

---

## ⚠️ نقاط ضعف فعلی

| # | مشکل | تأثیر | اولویت |
|---|------|--------|--------|
| 1 | فقط ۳۶۸ rule در DNR (خیلی کم) | آگهی‌های زیادی miss می‌شن | 🔴 بالا |
| 2 | `onRuleMatchedDebug` فقط در Dev mode | counter در production کار نمی‌کنه | 🔴 بالا |
| 3 | بدون update خودکار rule‌ها | با گذر زمان لیست‌ها کهنه می‌شن | 🟡 متوسط |
| 4 | dopamine-detox فقط با storage toggle | بدون UI برای تنظیم | 🟡 متوسط |
| 5 | video-patch.js روی YouTube بعضاً conflict می‌کنه با inject.js | unmute bug احتمالی | 🟡 متوسط |
| 6 | tracker-poison.js روی همه frame‌ها نمی‌دونه کدوم site | false positive | 🟢 پایین |
| 7 | بدون تست خودکار (unit/e2e) | regression risk | 🟢 پایین |
| 8 | popup فقط ۲ stat نشون می‌ده | UX محدود | 🟢 پایین |
