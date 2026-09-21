# قائمة فحص الإصدار — App Store و Google Play

> تُقرأ قبل كلّ رفع. وما لم يُعلَّم لم يُفحَص — لا «غالبًا يعمل».

## ١. قبل البناء

- [ ] `NEXT_PUBLIC_APP_URL` في بيئة الخادم = النطاق الحقيقي بـ`https`
- [ ] `capacitor.config.ts` يقرأ النطاق نفسه (`server.url`)
- [ ] `pnpm cap:sync` بعد كلّ تغيير في الإعداد أو الإضافات
- [ ] رقم النسخة ورقم البناء زِيدَا في `ios/App/App/Info.plist` و
      `android/app/build.gradle`
- [ ] البوّابة خضراء: `tsc` · `lint` · `pnpm test` · `pnpm exec playwright test`

## ٢. الخادم — قبل أن يصل التطبيق المتجر

- [ ] `VAPID_*` مضبوطة، ولوحة الإدارة لا تقول «دفع الويب معطّل»
- [ ] `FCM_*` مضبوطة، ولا تقول «دفع التطبيق معطّل»
- [ ] `APPLE_TEAM_ID` مضبوط، و`/.well-known/apple-app-site-association`
      يردّ **200** بنوع `application/json` **وبلا إعادة توجيه**
- [ ] `ANDROID_CERT_FINGERPRINTS` من **لوحة Play** لا من المفتاح المحلّيّ،
      و`/.well-known/assetlinks.json` يردّ 200
- [ ] `PLATFORM_DATA_DIR` مربوطٌ بحجمٍ مسمًّى دائم

```bash
curl -sI https://mazad.nx.sa/.well-known/apple-app-site-association | head -3
curl -s  https://mazad.nx.sa/.well-known/assetlinks.json | head -5
```

## ٣. iOS

- [ ] معرّف الحزمة `sa.nx.mazad` يطابق `capacitor.config.ts` و Firebase
- [ ] القدرات: **Push Notifications** · **Associated Domains**
      (`applinks:mazad.nx.sa`)
- [ ] مفتاح APNs مرفوعٌ في مشروع Firebase — **بدونه لا يصل iOS شيء ولو نجح
      الإرسال**
- [x] أيقونة التطبيق وشاشة الإقلاع — تُولَّد بـ`node scripts/gen-app-icons.mjs`
- [x] `PrivacyInfo.xcprivacy` موجودٌ **ومسجَّلٌ في مرحلة الموارد** في `project.pbxproj`
- [ ] `GoogleService-Info.plist` في `ios/App/App/`
- [ ] الأذونات المعلنة: الإشعارات وحدها — لا كاميرا ولا موقع ولا ميكروفون
- [ ] نصّ الخصوصية في App Store Connect يطابق `PrivacyInfo.xcprivacy` **و**`/privacy`
- [ ] رابط سياسة الخصوصية: `https://mazad.nx.sa/privacy`
- [ ] Archive → Validate → Distribute

## ٤. أندرويد

- [ ] `applicationId` = `sa.nx.mazad`
- [ ] `google-services.json` في `android/app/`
- [ ] `minSdk` و`targetSdk` يوافقان متطلّبات Play الحالية
- [ ] الأذونات: `INTERNET` و`POST_NOTIFICATIONS` وحدهما
- [ ] رابط التطبيق مُتحقَّقٌ منه في Play Console
- [ ] AAB موقَّعٌ ومرفوع
- [ ] نموذج «أمان البيانات» في Play يطابق `/privacy` — وخلافُه سببُ ردّ

## ٥. المتجرَين

- [ ] الوصف يصف **منتجًا** لا موقعًا: «سوق مزاداتٍ لحظيّ للوحات المركبات»
- [ ] لقطات شاشةٍ لكلّ مقاس مطلوب، بالعربية
- [ ] رابط سياسة الخصوصية والشروط (`/terms`) يعمل
- [ ] حسابٌ تجريبيّ للمراجع مع بيانات دخول — ومزادٌ حيّ يراه
- [ ] تصنيف المحتوى، وبيان «لا إعلانات»

## ٦. بعد الإطلاق

- [ ] أوّل إشعارٍ حقيقيّ وصل جهازًا على كلّ منصّة
- [ ] الضغط عليه فتح **الشاشة الصحيحة** لا الصفحة الأولى
- [ ] رابط `https://mazad.nx.sa/market/<id>` فتح التطبيق لا المتصفّح
- [ ] لوحة «التطبيق» تعرض أجهزةً مسجّلة بمنصّاتها
