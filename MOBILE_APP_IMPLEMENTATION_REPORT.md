# تقرير تنفيذ تطبيق الجوال

> ما نُفِّذ فعلًا، وما يلزمك أنت، وما **لم** يُتحقَّق منه ولماذا.
> الخطّة وقرارُ المسار في [MOBILE_APP_IMPLEMENTATION_PLAN.md](./MOBILE_APP_IMPLEMENTATION_PLAN.md).

## ١. الخلاصة

تطبيقٌ واحد من قاعدة الكود نفسها، يُخرج iOS وأندرويد عبر Capacitor. الواجهة
هي واجهة الويب الحالية بلا إعادة تصميم، والخادمُ والمحرّكُ واللحظيّةُ كما هي
بلا حرفٍ واحد.

**ولم يُبنَ ملفُّ `.ipa` ولا `.aab` على هذا الجهاز** — انظر القسم ٧.

## ٢. القرار المعماريّ وسببه

الطلب افترض «React + Backend منفصل»، والمشروع **Next.js App Router**: ٤٥
صفحةً كلُّها مكوّنات خادم، و٨٩ ملفًّا يعلن `force-dynamic`، و٤٥ مسار API داخل
التطبيق نفسه، والجلسة تُقرأ خادميًّا في ٨٠ موضعًا بكوكي `httpOnly`.

فلا مبنًى ساكنًا يُحزَم. والمسار المختار: **غلافٌ أصيل يفتح الخادم**
(`server.url`)، بطبقةٍ أصيلة كاملة.

وميزةٌ لا تُشترى بغيرها: الأصل يبقى `https://mazad.nx.sa` فتبقى كوكي الجلسة
`httpOnly` عاملةً. ولو حُزمت الواجهة لصار الأصل `capacitor://` فتصير الكوكي
عابرةَ موقعٍ ولا تُرسَل — فيلزم رمزٌ يُحفظ في الجهاز، وهو سطحُ أمانٍ جديد.

## ٣. الملفّات الجديدة

| الملفّ | ماذا |
| --- | --- |
| `capacitor.config.ts` | إعداد الغلاف: المعرّف، `server.url`، الإقلاع، شريط الحالة |
| `capacitor/www/` | صفحةُ تعذّرٍ ساكنة تُحزَم — تظهر متى انقطع الوصول |
| `ios/` · `android/` | مشروعا Xcode وGradle المولَّدان (٩٥ ملفًّا) |
| `src/lib/device.ts` | المنصّة والنسخة والتثبيت — من المتصفّح لا من `User-Agent` |
| `src/lib/haptics.ts` | الاهتزاز: جسرُ الغلاف، و`navigator.vibrate` بديلًا |
| `src/lib/server/fcm.ts` | إرسال FCM HTTP v1 — أندرويد و iOS بقناةٍ واحدة |
| `src/components/layout/native-shell.tsx` | الإقلاع · الرجوع · الاستئناف · الروابط العميقة · تسجيل الدفع |
| `src/components/layout/push-primer.tsx` | شاشة تمهيدٍ قبل نافذة الإذن |
| `src/app/.well-known/apple-app-site-association/route.ts` | ارتباط النطاق بتطبيق iOS |
| `src/app/.well-known/assetlinks.json/route.ts` | روابط تطبيق أندرويد |
| `src/app/admin/(panel)/mobile/page.tsx` | قسم «التطبيق» في الإدارة |
| `src/components/admin/mobile-settings-form.tsx` | الأجهزة · قوالب الإشعارات · النسخ |
| `src/app/api/admin/settings/mobile/route.ts` | حفظ إعدادات التطبيق |
| `src/lib/server/broadcast-service.ts` | البثّ الإداريّ: الشرائح والحرّاس والتقييد |
| `src/app/api/admin/broadcast/route.ts` | عدّ الشريحة والبثّ |
| `src/components/admin/broadcast-form.tsx` | نموذج البثّ بتأكيده |
| `tests/support/ui.ts` | `stableCount` — قياسٌ بعد الاستقرار لا عند أوّل ظهور |

## ٤. الملفّات المعدَّلة

`src/lib/domain/types.ts` (`UserDevice` · `MobileSettings` · القوالب) ·
`src/lib/store/{memory-store,types,settings-file}.ts` ·
`src/lib/server/push-service.ts` (قناتان + قوالب) ·
`src/app/api/push/route.ts` (منصّة ورمزٌ ونسخة) ·
`src/app/layout.tsx` · `src/components/layout/{push-toggle,notification-bell,service-worker}.tsx` ·
`src/components/market/auction-bid-box.tsx` (اهتزاز) ·
`src/components/admin/admin-nav.tsx` · `playwright.config.ts` · `.env.example`

## ٥. الإضافات (Plugins)

`@capacitor/core` · `app` · `haptics` · `push-notifications` · `share` ·
`splash-screen` · `status-bar`، و`cli` · `ios` · `android` للتطوير.
**ولا إضافةَ كاميرا ولا موقع ولا ميكروفون ولا جهات اتصال** — لا تستعملها
المنصّة، وطلبُ إذنٍ لا يُستعمل سببُ رفضٍ في المراجعة.

## ٦. متغيّرات البيئة المطلوبة

| المتغيّر | لماذا | بدونه |
| --- | --- | --- |
| `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT` | دفع الويب | لا دفعَ في المتصفّح — **ويُقال ذلك في اللوحة** |
| `FCM_PROJECT_ID` · `FCM_CLIENT_EMAIL` · `FCM_PRIVATE_KEY` | دفع التطبيق (والـiOS عبره) | لا دفعَ في التطبيق — ويُقال كذلك |
| `APPLE_TEAM_ID` | ارتباط النطاق بتطبيق iOS | يُردّ ملفّ الارتباط 404، فلا روابط كونية |
| `ANDROID_CERT_FINGERPRINTS` | روابط تطبيق أندرويد | يُردّ 404، فيُعرض مُنتقي «بأيّ تطبيق تفتح؟» |

كلُّها **من البيئة لا من الكود**، ولا يُسجَّل شيء منها في أيّ مخرجات.

## ٧. ما لم يُتحقَّق منه — بصراحة

| البند | الحال | السبب |
| --- | --- | --- |
| بناء `.ipa` | **لم يُجرَّب** | لا Xcode على الجهاز (أدوات سطر الأوامر وحدها) |
| بناء `.aab` | **لم يُجرَّب** | لا Android SDK ولا Java |
| وصول دفعٍ حقيقيّ | **لم يُجرَّب** | يلزم حساب Firebase ومفتاح APNs وجهازٌ حقيقيّ |
| الروابط الكونية | **لم تُجرَّب** | تتحقّق بعد التوقيع والتثبيت على جهاز |

وما يُتحقَّق منه بلا جهاز تحقّقتُ منه: البوّابة كاملةً (`tsc`، `lint`، ٤١٢
اختبار وحدة، ١٣٢ اختبار متصفّح)، وتوليد المشروعين، وصحّة ملفّي الارتباط،
وخدمةُ الدفع بقناتيها.

**ولا يقول هذا التقرير إنّ التطبيق جاهزٌ للمتجر.** جاهزٌ ما كُتب؛ والبناء
والتوقيع والاختبار على جهازٍ حقيقيّ عملٌ يبدأ من القسم التالي.

## ٨. خطواتك التالية

### أ. تهيئة الجهاز — **أو لا تهيئة أصلًا**

أسهل الطريقين: **لا تثبّت شيئًا**. ثلاثة ملفّات أكشن تبني التطبيقين على أجهزة
GitHub — والمستودع عامّ فالدقائق مجّانية بلا سقف، حتى على macOS. التفصيل في
[البناء في السحابة](docs/mobile-ci.md)، وأوّل خطوةٍ فيه تشغيلُ البناءين يدويًّا
**قبل شراء أيّ حساب**: يمرّان بلا توقيع فيُثبتان أنّ المشروع سليمٌ بنيويًّا.

وإن آثرت البناء محليًّا:

```bash
# Xcode من App Store، ثمّ:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
brew install --cask android-studio temurin   # SDK و Java
```

Capacitor يشترط **Node 22 فأحدث**؛ المشروع يعمل على 20، فاستعمل 22 لأوامر
`cap` وحدها:

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.2/bin:$PATH"
pnpm cap:sync
```

### ب. Firebase

1. أنشئ مشروعًا، وأضف تطبيق أندرويد بمعرّف `sa.nx.mazad` → نزّل
   `google-services.json` إلى `android/app/`.
2. أضف تطبيق iOS بالمعرّف نفسه → نزّل `GoogleService-Info.plist` إلى
   `ios/App/App/`.
3. **ارفع مفتاح APNs** (‏`.p8` من حساب مطوّر آبل) في إعدادات المشروع → «التنبيهات
   السحابية». بدونه لا يصل iOS شيءٌ ولو نجح الإرسال.
4. أنشئ حساب خدمة → مفتاح JSON → املأ `FCM_*` في بيئة الخادم.

### ج. آبل

- معرّف التطبيق `sa.nx.mazad` بقدرتَي **Push Notifications** و**Associated
  Domains** (`applinks:mazad.nx.sa`).
- املأ `APPLE_TEAM_ID` في بيئة الخادم، وتحقّق أنّ
  `https://mazad.nx.sa/.well-known/apple-app-site-association` يردّ JSON
  **بلا إعادة توجيه**.

### د. جوجل

- أنشئ مفتاح توقيع، وارفع أوّل حزمة، ثمّ خذ بصمة **توقيع تطبيق Play** من
  اللوحة — لا بصمة مفتاحك المحلّيّ — واملأ `ANDROID_CERT_FINGERPRINTS`.

### هـ. TestFlight

```bash
pnpm cap:ios      # يفتح Xcode
# Signing & Capabilities → فريقك، ثمّ Product → Archive → Distribute
```

### و. اختبار Play الداخليّ

```bash
pnpm cap:android  # يفتح Android Studio
# Build → Generate Signed Bundle → AAB → ارفعه في «الاختبار الداخليّ»
```

## ٩. مخاطرُ باقية

| الخطر | ما يخفّفه |
| --- | --- |
| **App Store 4.2** — رفض الأغلفة الرقيقة | طبقةٌ أصيلة حقيقية: دفع، روابط كونية، اهتزاز، شارة، إقلاع، رجوع، مشاركة. وفي الوصف: «سوق مزاداتٍ لحظيّ» لا «موقعنا في تطبيق» |
| **الاشتراكات في الذاكرة** | تضيع مع كلّ نشرة؛ والصفحة تُعيد إرسالها في كلّ فتح فتُرمَّم. وثباتُها التامّ يأتي بقاعدة بيانات |
| **دفع iOS بلا مفتاح APNs** | ينجح الإرسال ولا يصل شيء — يُتحقّق منه على جهازٍ حقيقيّ قبل الإطلاق |
| **الشارة على iOS لا تُمسح بالقراءة داخل التطبيق** | تُرسَل مع كلّ إشعارٍ بعدد غير المقروء وقتَه، فتصحّ متى وصل التالي. ومسحُها لحظةَ القراءة يحتاج إضافةَ شارةٍ أصيلة — قرارٌ لم يُتَّخذ بعد |
