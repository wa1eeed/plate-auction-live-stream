# البناء في السحابة — بلا Xcode ولا Android Studio على جهازك

> ثلاثة ملفّات في [`.github/workflows/`](../.github/workflows/) تبني التطبيقين
> على أجهزة GitHub، فيبقى جهازك نظيفًا.

## ١. لماذا سحابةً لا محليًّا

بناءُ iOS **يتطلّب macOS وXcode**، ولا مفرّ من ذلك — لا بديل عن الأداة، وإنّما
عن مكانها. وجهاز `macos-15` في الأكشن يحملهما، و`ubuntu-latest` يحمل Android
SDK وJava.

والمستودع **عامّ**، فدقائق الأكشن مجّانية بلا سقف — بما فيها أجهزة macOS، وهي
التي تُحسب عشرة أضعاف في المستودعات الخاصّة. ولو صار خاصًّا: ٢٠٠٠ دقيقة شهريًّا
تعني نحو ١٥ بناءً لـiOS.

## ٢. تبني قبل أن تشتري حسابًا

| الحال | ماذا يقع |
| --- | --- |
| **بلا أسرار** | يُبنى التطبيقان **بلا توقيع** — يُتحقَّق أنّهما يُترجمان ويُحزَمان |
| **بأسرار التوقيع** | يخرج `.aab` و`.ipa` صالحان للرفع |
| **بأسرار الرفع + وسم `v*`** | يُرفعان إلى Play وTestFlight |

فأوّل ما تفعله: شغّل الاثنين يدويًّا من تبويب **Actions**. إن مرّا، فالمشروع
سليمٌ بنيويًّا — وما بقي حساباتٌ وشهادات.

## ٣. متى يعمل كلٌّ منهما

| الملفّ | متى |
| --- | --- |
| `mobile-android.yml` · `mobile-ios.yml` | يدويًّا، أو بدفع وسمٍ `v1.0.0` |
| `mobile-keystore.yml` | يدويًّا، **مرّةً واحدة** |

ولا يعملان مع كلّ دفعة: بناءُ تطبيقٍ لا يُنشر يستهلك وقتًا ولا يُقرأ أحدٌ
نتيجته. و`ci.yml` هو ما يحرس كلّ دفعة.

## ٤. الأسرار

تُضاف في **Settings ← Secrets and variables ← Actions**. ولا يُكتب شيءٌ منها في
المستودع ولا يُطبع في سجلّ.

### أندرويد

| السرّ | من أين |
| --- | --- |
| `ANDROID_KEYSTORE_PASSWORD` · `ANDROID_KEY_PASSWORD` | تختارهما أنت **قبل** توليد المفتاح |
| `ANDROID_KEY_ALIAS` | اسمٌ تختاره (`mazad`) |
| `KEYSTORE_EXPORT_PASSWORD` | عبارةٌ تفكّ بها الملفّ المعمَّى |
| `ANDROID_KEYSTORE_BASE64` | من مخرجات `mobile-keystore.yml` |
| `PLAY_SERVICE_ACCOUNT_JSON` | حساب خدمةٍ في Google Cloud مربوطٌ بـPlay |

### iOS

| السرّ | من أين |
| --- | --- |
| `APPLE_TEAM_ID` | حساب مطوّر آبل |
| `APPLE_CERT_P12_BASE64` · `APPLE_CERT_PASSWORD` | شهادة توزيعٍ مصدَّرة `.p12` |
| `APPLE_PROVISIONING_PROFILE_BASE64` | ملفّ تعريفٍ للتوزيع |
| `APPSTORE_KEY_ID` · `APPSTORE_ISSUER_ID` · `APPSTORE_KEY_P8_BASE64` | مفتاح App Store Connect API |

**ومفتاح API أسلم من كلمة مرور الحساب**: صلاحيّته محدودة، ويُبطَل وحده دون أن
يُمسّ الحساب.

## ٥. مفتاح أندرويد — مرّةً واحدة ولا تضيّعه

`keytool` يحتاج Java، وهي على جهاز الأكشن لا على جهازك. فشغّل
`mobile-keystore.yml` بعد ضبط الأسرار الثلاثة، وهو:

1. يولّد المفتاح،
2. **يطبع بصمة SHA-256** — وهي علنيّة بطبيعتها، تُنشر في `assetlinks.json`،
3. **يعمّي المفتاح** بـ`openssl` قبل رفعه — لأنّ مخرجات المستودع العامّ
   تُنزَّل بمن له وصول،
4. يرفعه ليومٍ واحد.

ثمّ على جهازك:

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in release.keystore.enc -out release.keystore
base64 -i release.keystore | pbcopy    # ضعه في ANDROID_KEYSTORE_BASE64
```

> **احفظ `release.keystore` في مكانٍ آمن.** لا تقبل Play حزمةً موقّعةً بغيره
> بعد أوّل رفع — فضياعُه يعني تطبيقًا لا يُحدَّث أبدًا.

**وبعد تفعيل «توقيع تطبيق Play»**: خذ البصمة من لوحة Play لا من مفتاحك — جوجل
تُعيد التوقيع بمفتاحها، فبصمتُك المحلّية لا تطابق ما يصل الأجهزة. وهذا أكثر ما
يُعطِّل روابط التطبيق صامتًا.

## ٦. شهادة آبل بلا Xcode

1. ولّد طلب توقيعٍ على جهازك:
   ```bash
   openssl req -new -newkey rsa:2048 -nodes \
     -keyout ios.key -out ios.csr -subj "/emailAddress=you@example.com/CN=Mazad/C=SA"
   ```
2. ارفع `ios.csr` في **Certificates** بحساب المطوّر، ونزّل `.cer`.
3. اجمعهما في `.p12`:
   ```bash
   openssl x509 -in ios.cer -inform DER -out ios.pem -outform PEM
   openssl pkcs12 -export -inkey ios.key -in ios.pem -out ios.p12
   base64 -i ios.p12 | pbcopy    # ضعه في APPLE_CERT_P12_BASE64
   ```
4. أنشئ ملفّ التعريف في **Profiles** ونزّله، ثمّ `base64 -i *.mobileprovision`.

## ٧. الإصدار

```bash
git tag v1.0.0 && git push origin v1.0.0
```

فيُبنى التطبيقان ويُرفعان — إلى **مسودّة** في Play وإلى TestFlight. ولا يُنشر
شيءٌ للعموم بلا فعلٍ منك في اللوحتين.
