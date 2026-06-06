# ویژگی‌هایی که UltraBlock نداره — مقایسه با بهترین پروژه‌ها

---

## 📊 جدول خلاصه

| # | ویژگی | منبع | اولویت پیشنهادی | قابل پیاده‌سازی؟ |
|---|--------|------|-----------------|------------------|
| 1 | Scriptlets Engine (موتور تزریق اسکریپت‌های کوچک) | uBlock Origin | 🔴 حیاتی | ✅ بله |
| 2 | Procedural Cosmetic Filters | uBlock Origin | 🔴 حیاتی | ✅ بله |
| 3 | Dynamic Filtering (فایروال دستی) | uBlock Origin | 🟡 بالا | ✅ بله |
| 4 | CNAME Uncloaking | uBlock Origin / AdGuard | 🟡 بالا | ⚠️ محدود (MV3) |
| 5 | Element Picker (انتخاب و بلاک دستی) | uBlock Origin | 🟡 بالا | ✅ بله |
| 6 | Network Logger (مانیتور ریکوئست‌ها) | uBlock Origin | 🟡 بالا | ✅ بله |
| 7 | SponsorBlock Integration (Skip Sponsor) | SponsorBlock | 🟡 بالا | ✅ بله |
| 8 | AdNauseam Click Obfuscation | AdNauseam | 🟡 بالا | ✅ بله |
| 9 | Filter List Auto-Update System | uBlock / AdGuard | 🔴 حیاتی | ✅ بله |
| 10 | Import/Export Custom Filters | uBlock Origin | 🟡 بالا | ✅ بله |
| 11 | Perceptual Ad Blocking (CV/AI) | Princeton Research / AdEclipse | 🔵 نوآوری | ⚠️ سنگین |
| 12 | eBPF Kernel-Level Blocking | Linux Kernel Projects | ❌ نامربوط | ❌ خارج از scope |
| 13 | MITM TLS Interception | AdGuard CoreLibs | ❌ نامربوط | ❌ خارج از scope |
| 14 | Greasemonkey/UserScript Engine | wBlock | 🟢 جالب | ✅ بله |
| 15 | DNS-over-HTTPS Client | AdGuard Home / Pi-hole | 🟢 جالب | ⚠️ محدود |
| 16 | Filter Syntax Compiler (ABP/uBO → DNR) | Brave adblock-rust | 🔴 حیاتی | ✅ بله |
| 17 | Community Reporting System | SponsorBlock | 🟡 بالا | ✅ بله (نیاز به سرور) |
| 18 | Statistics Dashboard (دقیق‌تر) | AdGuard / Pi-hole | 🟡 بالا | ✅ بله |
| 19 | Allowlist Rules با Regex | uBlock / AdGuard | 🟡 بالا | ✅ بله |
| 20 | Multi-language Filter Lists | Hagezi / EasyList | 🔴 حیاتی | ✅ بله |

---

## 🔍 شرح دقیق هر ویژگی

---

### 1️⃣ Scriptlets Engine — موتور تزریق اسکریپت‌های کوچک
**📌 منبع:** uBlock Origin, Brave adblock-rust, AdGuard

**چیه؟**
سیستمی که به جای hardcode کردن stealth.js، یه لایبرری از ۲۰۰+ اسکریپت کوچک (scriptlet) داره که هر کدوم یه کار خاص می‌کنن. filter listها می‌تونن مشخص کنن کدوم scriptlet روی کدوم سایت اجرا بشه.

**مثال:**
```
youtube.com##+js(set-constant, yt.config_.EXPERIMENT_FLAGS.web_player_enable_ads, false)
example.com##+js(abort-on-property-read, FuckAdBlock)
```

**چرا تو نداریش؟**
تو همه anti-detection رو hardcode کردی توی `stealth.js`. اگه scriptlet engine داشتی:
- فیلترلیست‌های uBlock/AdGuard رو مستقیم import می‌کردی
- بدون آپدیت اکستنشن، فقط با آپدیت لیست، باگ‌ها فیکس می‌شد
- community می‌تونست scriptlet بنویسه

**Scriptlet‌های مهم uBlock:**
- `abort-on-property-read` — خنثی کردن adblock detector
- `abort-on-property-write` — جلوگیری از ست شدن flag
- `set-constant` — override کردن یه متغیر با مقدار ثابت
- `json-prune` — حذف کلیدها از JSON response
- `xml-prune` — حذف آگهی از VAST/XML
- `prevent-setTimeout` / `prevent-setInterval` — kill تایمرهای آگهی
- `nowebrtc` — block WebRTC leak
- `nano-setInterval-booster` — سریع‌تر کردن تایمرهای countdown
- `remove-attr` / `remove-class` — حذف attribute از DOM
- `trusted-replace-fetch-response` — دستکاری پاسخ fetch

---

### 2️⃣ Procedural Cosmetic Filters — فیلتر CSS پیشرفته
**📌 منبع:** uBlock Origin

**چیه؟**
فراتر از CSS selector معمولی. فیلترهایی که می‌تونن:
- بر اساس **متن داخل** المنت فیلتر کنن
- بر اساس **CSS property محاسبه‌شده** فیلتر کنن
- بر اساس **ساختار DOM** (والد، فرزند) فیلتر کنن
- بر اساس **shadow DOM** فیلتر کنن

**مثال‌ها:**
```css
example.com##.post:has-text(/sponsored|promoted/i)
example.com##.sidebar > div:matches-css(position: fixed)
example.com##.feed-item:has(> .ad-badge)
example.com##div:upward(.article-container)
example.com##div:nth-ancestor(3)
```

**اپراتورهای موجود در uBlock:**
| اپراتور | کار |
|---------|-----|
| `:has-text()` | فیلتر بر اساس متن |
| `:matches-css()` | فیلتر بر اساس computed style |
| `:has()` | فیلتر اگه child خاصی داشته باشه |
| `:upward()` | انتخاب والد |
| `:nth-ancestor()` | N سطح بالاتر |
| `:min-text-length()` | حداقل طول متن |
| `:watch-attr()` | مانیتور تغییرات attribute |
| `:remove()` | حذف از DOM |
| `:style()` | اعمال CSS custom |
| `:matches-path()` | فیلتر بر اساس URL path |

**چرا مهمه؟** تبلیغات مدرن class‌های random دارن (مثل `div.f7x9k2`). نمی‌شه با static selector بگیریشون. ولی با `:has-text(Sponsored)` هر المنتی که کلمه "Sponsored" داخلشه رو می‌گیری.

---

### 3️⃣ Dynamic Filtering — فایروال دستی real-time
**📌 منبع:** uBlock Origin

**چیه؟**
یه ماتریس (جدول) که کاربر می‌تونه per-site تصمیم بگیره:
- چه domain‌هایی بلاک بشن
- چه نوع resourceهایی بلاک بشن (script, image, frame, ...)
- قوانین global vs per-site

**مثال:**
```
* * 3p-script block     ← همه third-party scriptها بلاک
youtube.com * 3p block  ← همه 3rd-party ریکوئست‌ها بلاک فقط در youtube
```

**تو نداریش چون:**
فقط یه power toggle + whitelist per-site داری. کاربر حرفه‌ای نمی‌تونه بگه "فقط scriptهای third-party رو بلاک کن".

---

### 4️⃣ CNAME Uncloaking — افشای تراکرهای مخفی
**📌 منبع:** uBlock Origin (Firefox), AdGuard Home

**چیه؟**
تراکرهای مدرن دیگه از `tracker.facebook.com` استفاده نمی‌کنن. در عوض:
- `analytics.mysite.com` → CNAME → `at.adtech.com`

یعنی ظاهراً first-party هستن ولی واقعاً third-party ترکرن!

**uBlock در Firefox** از `dns.resolve()` API استفاده می‌کنه تا CNAME واقعی رو ببینه و بلاک کنه.

**محدودیت در MV3 Chrome:** این API وجود نداره. ولی می‌شه با یه لیست known CNAME trackers (از AdGuard) جبران کرد.

---

### 5️⃣ Element Picker — انتخاب و بلاک دستی
**📌 منبع:** uBlock Origin, AdGuard

**چیه؟**
کاربر روی هر المنت صفحه right-click می‌کنه → "Block this element" → یه CSS rule generate می‌شه و ذخیره می‌شه.

**قابلیت‌ها:**
- Point-and-click interface
- Auto-generate بهترین CSS selector
- Preview قبل از اعمال
- ذخیره در custom filters

**تو نداریش.** کاربر هیچ راهی برای بلاک کردن المنت خاص نداره.

---

### 6️⃣ Network Logger — مانیتور ریکوئست‌ها
**📌 منبع:** uBlock Origin

**چیه؟**
یه پنل real-time که نشون می‌ده:
- چه requestهایی بلاک شدن و چرا
- کدوم filter rule باعث بلاک شد
- ریکوئست‌های مجاز
- فیلتر بر اساس domain/type/rule

**چرا مفیده؟** برای debug کردن وقتی سایتی خراب شد یا آگهی miss شد.

---

### 7️⃣ SponsorBlock Integration — Skip Sponsor‌ها
**📌 منبع:** SponsorBlock (ajayyy/SponsorBlock) ⭐ ~12K

**چیه؟**
تبلیغاتی که **خود یوتیوبر** داخل ویدیو حرف می‌زنه (NordVPN, Skillshare, ...) هیچ ad blocker‌ی نمی‌تونه تشخیص بده چون بخشی از فایل ویدیوئه!

**راه‌حل:** Database crowdsourced از timestamp‌های sponsor:
```json
{"videoID": "abc123", "segments": [
  {"start": 45.2, "end": 78.1, "category": "sponsor"},
  {"start": 300, "end": 315, "category": "intro"}
]}
```

**Categoryها:**
| Category | توضیح |
|----------|--------|
| `sponsor` | تبلیغ داخل ویدیو |
| `selfpromo` | تبلیغ خود کانال |
| `interaction` | "لایک و سابسکرایب کنید" |
| `intro` | انیمیشن اینترو |
| `outro` | صفحه پایانی |
| `preview` | پیش‌نمایش |
| `music_offtopic` | موسیقی بی‌ربط |
| `filler` | حرف‌های اضافی |

**تو `inject.js` هوک YouTube داری — اضافه کردن SponsorBlock خیلی ساده‌ست.**

---

### 8️⃣ AdNauseam Click Obfuscation — کلیک جعلی
**📌 منبع:** AdNauseam (dhowe/AdNauseam) ⭐ ~4.5K

**چیه؟**
فراتر از tracker-poison تو! AdNauseam:
1. تبلیغات رو بلاک می‌کنه (ساخته شده روی uBlock)
2. **در پس‌زمینه روی هر تبلیغ کلیک می‌کنه** (بدون نمایش به کاربر)
3. یه "Ad Vault" می‌سازه — گالری تمام تبلیغاتی که باهاشون مواجه شدی

**نتیجه:**
- پروفایل تبلیغاتی کاملاً noise می‌شه
- بودجه تبلیغ‌دهنده هدر می‌ره
- data broker‌ها دیتای بی‌ارزش جمع می‌کنن

**فرق با tracker-poison.js تو:**
تو فقط metadata جعلی inject می‌کنی. AdNauseam واقعاً click simulate می‌کنه و landing page رو background load می‌کنه.

---

### 9️⃣ Filter List Auto-Update System
**📌 منبع:** uBlock Origin, AdGuard, Brave

**چیه؟**
- Subscribe به ۲۰+ لیست (EasyList, EasyPrivacy, Fanboy, Peter Lowe, ...)
- Auto-update هر X ساعت
- لیست‌های community-maintained
- Diff-based update (فقط تغییرات دانلود می‌شه)

**تو چی داری؟**
۳۶۸ rule ثابت! هیچ مکانیزم آپدیت ندارن. باید ۵۰,۰۰۰+ rule داشته باشی.

**لیست‌های مهم:**
| لیست | تعداد rule | هدف |
|------|-----------|-----|
| EasyList | ~90,000 | تبلیغات عمومی |
| EasyPrivacy | ~30,000 | ترکرها |
| uBlock Filters | ~40,000 | تکمیلی |
| Peter Lowe | ~3,000 | دامنه‌های تبلیغاتی |
| Hagezi Multi Pro | ~180,000 | فوق جامع |
| AdGuard Base | ~80,000 | تبلیغات + ترکرها |
| Fanboy's Annoyances | ~50,000 | مزاحمت‌ها |

---

### 🔟 Import/Export Custom Filters
**📌 منبع:** uBlock Origin, AdGuard

**چیه؟**
کاربر بتونه:
- Custom filter بنویسه (ABP syntax)
- Export و backup بگیره
- از URL subscribe کنه (مثل یه لیست خصوصی)
- فیلترهاشو share کنه

---

### 1️⃣1️⃣ Perceptual Ad Blocking — شناسایی بصری
**📌 منبع:** Princeton Research, AdEclipse

**چیه؟**
به جای بررسی کد HTML، **ظاهر المنت** رو بررسی می‌کنه:
- OCR: خوندن کلمه "Sponsored" یا "Ad" از تصویر
- Shape detection: شناسایی بنرهای مستطیلی
- TensorFlow.js: مدل ML سبک برای classify کردن

**مزیت:** anti-adblock نمی‌تونه تشخیص بده چون بلاکر به کد کاری نداره
**عیب:** سنگینه و resource-intensive

---

### 1️⃣2️⃣ Filter Syntax Compiler (ABP → DNR)
**📌 منبع:** Brave adblock-rust

**چیه؟**
یه compiler که فیلتر‌ها رو از syntax ABP/uBlock به فرمت `declarativeNetRequest` تبدیل می‌کنه.

**چرا مهمه؟**
- MV3 فقط DNR قبول می‌کنه
- EasyList و همه لیست‌ها ABP syntaxن
- بدون compiler نمی‌تونی ازشون استفاده کنی

**Brave این کار رو با Rust می‌کنه — ولی JS versionها هم هست.**

---

### 1️⃣3️⃣ Greasemonkey/UserScript Engine
**📌 منبع:** wBlock (Safari)

**چیه؟**
یه engine داخلی که userscript (مثل Tampermonkey) رو بدون نیاز به اکستنشن جداگانه اجرا می‌کنه.

**مزیت:** کاربر می‌تونه custom JS بنویسه برای حل مشکلات خاص هر سایت.

---

### 1️⃣4️⃣ Statistics Dashboard پیشرفته
**📌 منبع:** Pi-hole, AdGuard Home

**چیه؟**
- گراف‌ timeline بلاک‌ها
- Top blocked domains
- Top allowed domains
- Query log با جزئیات
- فیلتر بر اساس client/device
- آمار هفتگی/ماهانه

**تو فقط "This Page" و "All Time" یه عدد ساده داری.**

---

### 1️⃣5️⃣ Multi-language/Regional Filter Lists
**📌 منبع:** Hagezi, EasyList, AdGuard

**لیست‌های منطقه‌ای:**
- EasyList Germany
- EasyList China
- AdGuard Turkish
- Liste FR (فرانسوی)
- IndianList
- **لیست‌های فارسی/ایرانی** (Yektanet, Tapsell, ...)

**تو:** فقط ۱ لیست global داری. باید multi-regional باشی.

---

### 1️⃣6️⃣ Allowlist/Exception Rules با Regex
**📌 منبع:** uBlock Origin, AdGuard

**مثال:**
```
@@||example.com/api/*$script,domain=example.com
@@/^https:\/\/cdn\.example\.\w+\/assets\//
```

**تو:** فقط per-domain whitelist داری. نمی‌تونی بگی "فقط این path رو اجازه بده".

---

### 1️⃣7️⃣ Community Reporting System
**📌 منبع:** SponsorBlock, uBlock (GitHub issues)

**ایده:** کاربرا بتونن:
- Report کنن "آگهی این سایت miss شد"
- Timestamp‌ sponsor YouTube submit کنن
- Vote بدن روی گزارشات بقیه

---

### 1️⃣8️⃣ DNS-over-HTTPS Client (محدود)
**📌 منبع:** AdGuard Home, NextDNS

**ایده برای extension:** استفاده از DoH resolver (مثل `https://dns.adguard.com/dns-query`) برای resolve کردن domain و تشخیص CNAME trackers.

---

## 🎯 رتبه‌بندی پیشنهادی برای پیاده‌سازی

### Phase 1 — ضروری (بدون اینا جدی گرفته نمیشی)
1. ✅ **Filter List Auto-Update** — subscribe به EasyList + آپدیت
2. ✅ **ABP→DNR Compiler** — convert فیلترها به MV3 format
3. ✅ **Scriptlets Engine** — لااقل ۲۰ scriptlet پرکاربرد
4. ✅ **Multi-regional Lists** — EasyList + فارسی + ...

### Phase 2 — حرفه‌ای (از رقبا جلو میفتی)
5. ✅ **Element Picker** — بلاک دستی المنت
6. ✅ **SponsorBlock Integration** — skip sponsor
7. ✅ **Procedural Cosmetic Filters** — `:has-text()`, `:has()`
8. ✅ **Statistics Dashboard** — گراف + top domains

### Phase 3 — نوآوری (یونیک می‌شی)
9. ✅ **AdNauseam-style Click** — ارتقای tracker-poison
10. ✅ **Network Logger** — debug panel
11. ✅ **Dynamic Filtering Matrix**
12. ✅ **Perceptual Detection** (AI-based)

---

---

## 🆕 ویژگی‌های اضافی که از دست رفته بودن

---

### 2️⃣1️⃣ $removeparam — حذف پارامترهای ترکینگ از URL
**📌 منبع:** uBlock Origin, AdGuard

**چیه؟**
قبل از لود شدن صفحه، پارامترهای tracking رو از URL حذف می‌کنه:
```
*$removeparam=fbclid
*$removeparam=gclid
*$removeparam=/^utm_/
*$removeparam=igshid
*$removeparam=mc_cid
*$removeparam=yclid
*$removeparam=_openstat
```

**نتیجه:** URL تمیز، بدون ردیابی، بدون شکستن سایت

**تو نداریش.** tracker-poison.js فقط fingerprint رو noise می‌ده ولی URL tracking params هنوز هستن.

---

### 2️⃣2️⃣ $redirect / Resource Replacement — جایگزینی منابع
**📌 منبع:** uBlock Origin, AdGuard, Brave

**چیه؟**
به جای block کردن یه resource (که ممکنه سایت بشکنه)، با یه **نسخه خنثی‌شده** جایگزین می‌کنه:

```
||googletagmanager.com/gtag/js$redirect=googletagmanager_gtm.js
||google-analytics.com/analytics.js$redirect=google-analytics_analytics.js
||facebook.net/en_US/fbevents.js$redirect=facebook_sdk.js
```

**نسخه خنثی‌شده (neutered):** ظاهراً لود می‌شه و function‌ها وجود دارن، ولی هیچ data ارسال نمی‌شه.

**uBlock Origin ۱۰۰+ redirect resource داره:**
- `noop.js` — اسکریپت خالی
- `noop.txt` — فایل متنی خالی  
- `1x1.gif` — تصویر ۱x۱ شفاف
- `2x2.png` — تصویر ۲x۲ شفاف
- `noop.html` — صفحه HTML خالی
- `noopframe.html` — iframe خالی
- `google-analytics_analytics.js` — GA خنثی
- `googletagmanager_gtm.js` — GTM خنثی
- `googlesyndication_adsbygoogle.js` — AdSense خنثی
- `amazon_apstag.js` — Amazon ads خنثی
- `outbrain-widget.js` — Outbrain خنثی

**فرق با stealth.js تو:** تو فقط `googletag` و `adsbygoogle` رو fake می‌کنی. uBlock برای ۱۰۰+ SDK نسخه خنثی داره.

---

### 2️⃣3️⃣ HTML Filtering — فیلتر محتوای HTML قبل از render
**📌 منبع:** uBlock Origin (Firefox only), AdGuard

**چیه؟**
قبل از اینکه HTML به parser مرورگر برسه، inline scripts و المنت‌ها رو حذف می‌کنه:

```
example.com##^script:has-text(adblock)
example.com##^script:has-text(detector)
```

**محدودیت:** فقط Firefox (Chrome اجازه نمی‌ده). ولی مفهوم اعمال‌شدنیه با service worker.

---

### 2️⃣4️⃣ Per-Site Switches — تنظیمات اختصاصی هر سایت
**📌 منبع:** uBlock Origin

**سوئیچ‌ها:**
| سوئیچ | کار |
|--------|-----|
| No remote fonts | بلاک فونت‌های external (ضد fingerprint) |
| No large media | بلاک مدیا بزرگتر از Xkb (صرفه‌جویی bandwidth) |
| No scripting | بلاک کامل JS (حالت امن) |
| No cosmetic filtering | غیرفعال فیلتر ظاهری (debug) |
| No popups | بلاک popup‌ها |

**تو:** فقط power on/off و whitelist داری. هیچ granularity نداری.

---

### 2️⃣5️⃣ Strict Blocking Page — صفحه هشدار دامنه خطرناک
**📌 منبع:** uBlock Origin

**چیه؟**
وقتی user می‌خواد بره به دامنه خطرناک (malware/phishing)، به جای بلاک سایلنت، یه **صفحه هشدار** نشون می‌ده با گزینه "Proceed anyway".

**تو:** malware domains رو سایلنت بلاک می‌کنی. user نمی‌فهمه چرا سایت لود نشد.

---

### 2️⃣6️⃣ AdGuard Extra — Anti-Circumvention Engine
**📌 منبع:** AdGuardTeam/AdGuardExtra

**چیه؟**
یه engine جداگانه فقط برای **مبارزه با anti-adblock‌های پیشرفته‌ای** که rule‌های معمولی حریفشون نمیشن:

**تکنیک‌ها:**
- مانیتور کردن `MutationObserver` خود سایت (یعنی ناظر ناظرها!)
- رهگیری و دستکاری obfuscated scripts
- حل CAPTCHA-style ad verification
- مقابله با inline script‌هایی که checksum خودشون رو verify می‌کنن
- جلوگیری از re-injection تبلیغات بعد از حذف

**تو `stealth.js` بخشی از اینا رو داری ولی:**
- مانیتور MutationObserver سایت نداری
- Obfuscated script detection نداری
- Self-verification bypass نداری

---

### 2️⃣7️⃣ M3U/VAST/XML Pruning — حذف آگهی از فرمت‌های ویدیو
**📌 منبع:** uBlock Origin (scriptlet `xml-prune`), AdGuard (`m3u-prune`)

**چیه؟**
- **VAST** (Video Ad Serving Template): فرمت XML استاندارد برای serve کردن آگهی ویدیویی. با `xml-prune` می‌شه قسمت‌هایی از XML response رو حذف کرد.
- **M3U8** playlists: `m3u-prune` می‌تونه segment‌های آگهی رو حذف کنه.

**تو `inject.js`:** فقط Twitch M3U8 رو handle می‌کنی. VAST/VPAID support نداری.

---

### 2️⃣8️⃣ ABP Snippet Syntax Compatibility — سازگاری با syntax فیلترها
**📌 منبع:** uBlock, AdGuard, Brave, Ghostery

**syntaxهای موجود:**
| Syntax | مثال |
|--------|------|
| ABP (AdBlock Plus) | `||ads.example.com^` |
| uBlock Extended | `example.com##+js(abort-on-property-read, adDetect)` |
| AdGuard Extended | `example.com#%#//scriptlet('set-constant', 'adBlockDetected', 'false')` |
| Procedural | `example.com##.container:has-text(Ad)` |

**تو:** هیچ filter parser نداری. همه چی hardcode شده.

---

### 2️⃣9️⃣ WebRTC Leak Protection
**📌 منبع:** uBlock Origin (`nowebrtc` scriptlet)

**چیه؟**
WebRTC می‌تونه IP واقعی user رو حتی پشت VPN لو بده. 

**uBlock:** با scriptlet `nowebrtc` یا per-site switch، WebRTC رو disable می‌کنه.
**تو:** هیچ WebRTC protection نداری.

---

### 3️⃣0️⃣ Crowdsourced Filter Lists + Community Ecosystem
**📌 منبع:** uBlock (uAssets), EasyList, Hagezi, StevenBlack

**چیه؟**
- GitHub Issues برای report آگهی‌های miss شده
- Pull request برای اضافه کردن rule
- Auto-generate لیست‌ها از multiple sources
- Versioning و changelog

**تو:** هیچ community workflow نداری. یه نفره‌ای.

---

### 3️⃣1️⃣ AdNauseam Ad Vault — گالری تبلیغات
**📌 منبع:** AdNauseam

**چیه؟**
همه تبلیغاتی که بلاک/کلیک شدن رو ذخیره و visualize می‌کنه:
- تصویر thumbnail هر آگهی
- لینک مقصد
- تاریخ مواجهه
- domain مبدأ
- یه visualization از نوع "data art"

---

### 3️⃣2️⃣ Pi-hole Group Management — مدیریت دستگاه‌ها
**📌 منبع:** Pi-hole

**چیه؟**
مدیریت لیست‌ها per-device:
- بچه‌ها: بلاک porn + social media + gaming
- والدین: فقط بلاک ads
- IoT: بلاک telemetry
- Guest: بلاک همه چیز

**نامربوط به browser extension ولی ایده‌اش جالبه:** اگه multi-profile support داشته باشی (Work/Personal/Kids) → هر کدوم لیست خودشو داره.

---

### 3️⃣3️⃣ Brave adblock-rust Resource Assembler
**📌 منبع:** brave/adblock-rust

**چیه؟**
یه پکیج که:
1. فرمت scriptletهای uBlock Origin رو parse می‌کنه
2. اونا رو compile می‌کنه به فرمت قابل inject
3. در runtime تزریق می‌کنه

**ایده برای تو:** به جای hardcode، یه mini-compiler بنویسی که scriptlet‌های uBlock رو بخونه و inject کنه.

---

### 3️⃣4️⃣ Privaxy System-Wide MITM (Rust)
**📌 منبع:** Barre/privaxy

**چیه؟**
- نصب certificate محلی
- پروکسی HTTPS بین app و اینترنت
- فیلتر **تمام** ترافیک (نه فقط مرورگر)
- Block توی Discord, Spotify, games, ...

**نامربوط مستقیماً** (خارج از scope اکستنشن) ولی الهام‌بخشه برای نسخه desktop.

---

### 3️⃣5️⃣ eBPF/XDP Kernel-Level Filtering
**📌 منبع:** Linux kernel projects

**چیه؟**
Drop کردن packet قبل از رسیدن به TCP stack:
- صفر latency
- صفر CPU overhead
- فقط Linux

**کاملاً خارج از scope اکستنشن.** ولی اگه روزی Pi-hole-like بسازی، eBPF بهترین لایه‌ست.

---

## 🎯 لیست کامل نهایی — به ترتیب اولویت

### 🔴 Phase 1 — بدون اینا اکستنشن جدی نیست (MUST HAVE)
| # | ویژگی | منبع |
|---|--------|------|
| 1 | Auto-Update Filter Lists (EasyList, EasyPrivacy, ...) | uBlock, AdGuard |
| 2 | ABP/uBlock Filter Syntax Parser + DNR Compiler | Brave adblock-rust |
| 3 | Scriptlets Engine (۲۰+ core scriptlet) | uBlock, AdGuard Scriptlets |
| 4 | $redirect / Resource Replacement (neutered scripts) | uBlock, AdGuard |
| 5 | $removeparam (حذف tracking params از URL) | uBlock, AdGuard |
| 6 | Multi-regional Filter Lists (فارسی, عربی, ...) | Hagezi, EasyList |

### 🟠 Phase 2 — حرفه‌ای (از رقبا جلو میفتی)
| # | ویژگی | منبع |
|---|--------|------|
| 7 | Element Picker (بلاک دستی) | uBlock |
| 8 | Procedural Cosmetic Filters (`:has-text()`, `:has()`) | uBlock |
| 9 | SponsorBlock Integration | SponsorBlock |
| 10 | Network Logger / Debug Panel | uBlock |
| 11 | Per-Site Switches (no fonts, no large media, no scripts) | uBlock |
| 12 | Dynamic Filtering Matrix (فایروال 3rd-party) | uBlock |
| 13 | Import/Export Custom Filters | uBlock, AdGuard |
| 14 | Strict Blocking Page (صفحه هشدار malware) | uBlock |
| 15 | Statistics Dashboard (گراف, top domains) | Pi-hole, AdGuard |

### 🟡 Phase 3 — نوآوری (یونیک + جذاب)
| # | ویژگی | منبع |
|---|--------|------|
| 16 | AdNauseam-style Click Obfuscation (ارتقای tracker-poison) | AdNauseam |
| 17 | Ad Vault (گالری تبلیغات بلاک‌شده) | AdNauseam |
| 18 | VAST/VPAID XML Pruning (آگهی ویدیویی) | uBlock scriptlets |
| 19 | WebRTC Leak Protection | uBlock |
| 20 | Anti-Circumvention Engine (مانیتور ناظرها) | AdGuard Extra |
| 21 | Multi-Profile (Work/Personal/Kids) | Pi-hole Groups |
| 22 | Community Reporting System | SponsorBlock |
| 23 | Perceptual Ad Blocking (AI/CV) | Princeton, AdEclipse |
| 24 | UserScript Engine (Greasemonkey compatibility) | wBlock |

---

## 📝 نتیجه‌گیری

**بزرگ‌ترین gap تو نسبت به uBlock Origin:**
1. فقط ۳۶۸ rule ثابت (باید ۵۰K+ باشه)
2. بدون مکانیزم آپدیت لیست
3. بدون scriptlet engine (همه چی hardcode)
4. بدون element picker
5. بدون procedural filters

**مزیت‌هایی که داری و بقیه ندارن:**
- ✅ Tracker Poisoning (فقط AdNauseam مشابهشو داره)
- ✅ Dopamine Detox (هیچ‌کس نداره)
- ✅ Cookie Negotiator (AdGuard داره ولی ساده‌تر)
- ✅ Dark Pattern Neutralizer (هیچ‌کس نداره)
- ✅ Video Patch Overlay (یونیک)
- ✅ Retro Mode (reader view بهتر)
