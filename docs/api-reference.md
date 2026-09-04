# مرجع الواجهة البرمجية (HTTP)

> كل المسارات تحت `/api`. كلها `dynamic = 'force-dynamic'` بلا تخزين مؤقت.
> الأوامر عبر HTTP؛ الأحداث عبر [WebSocket](realtime-protocol.md).

## الاتفاقيات

**المصادقة** — كوكي جلسة موقّع `pa_session` (HttpOnly، SameSite=Lax،
Secure في الإنتاج، صلاحية 14 يومًا). لا رؤوس `Authorization`.

**النجاح** — `200` مع جسم JSON خاص بالمسار.

**الخطأ** — دائمًا بالشكل نفسه:

```json
{ "error": { "message": "رسالة عربية للمستخدم", "code": "MACHINE_CODE" } }
```

`message` معدّ للعرض مباشرة، و`code` للتفريع البرمجي. لا يُسرَّب أي أثر داخلي
أو تفاصيل تنفيذ في الاستجابة.

**الأخطاء المشتركة**

| الحالة | الرمز | متى |
| --- | --- | --- |
| 401 | `NOT_AUTHENTICATED` | لا جلسة |
| 403 | `FORBIDDEN` | الجلسة صحيحة والصلاحية ناقصة |
| 404 | `LISTING_NOT_FOUND` `OFFER_NOT_FOUND` `ORDER_NOT_FOUND` | غير موجود أو غير منشور |
| 409 | رمز `TradeError` | القاعدة رُفضت (الجدول أدناه) |
| 422 | `VALIDATION_ERROR` | فشل مخطط Zod؛ `message` أول خطأ بالعربية |
| 429 | `RATE_LIMITED` | تجاوز المعدل |

**المبالغ** — تُرسل من العميل **بالريالات كأعداد صحيحة**، وتُعاد في الاستجابات
**بالهللات**. سبب الفصل في [ADR-0002](adr/0002-integer-halalas.md).

**منع التكرار** — `placeBid` و`buyNow` يتطلبان `clientRequestId` (6–64 حرفًا).
تكرار المعرّف نفسه يعيد النتيجة الأولى ولا ينفّذ العملية مرتين.

---

## الحسابات

### `POST /api/auth/register`

| | |
| --- | --- |
| المصادقة | لا |
| المعدل | 5 / دقيقة لكل بريد |

```jsonc
// الطلب
{
  "email": "user@example.com",
  "password": "at-least-8-chars",
  "displayName": "وليد العتيبي",
  "phone": "0500000000",      // اختياري — يُطبَّع إلى +9665XXXXXXXX
  "acceptedTerms": true       // يجب أن تكون true
}
// 200
{ "user": { "id": "usr_...", "displayName": "وليد العتيبي" } }
```

أخطاء: `409 EMAIL_TAKEN` · `422 VALIDATION_ERROR` · `429 RATE_LIMITED`.

### `POST /api/auth/login`

| | |
| --- | --- |
| المصادقة | لا |
| المعدل | 8 / دقيقة لكل بريد |

```jsonc
{ "email": "waleed@demo.sa", "password": "demo1234" }
// 200 — ويُضبط كوكي الجلسة
{ "user": { "id": "usr_...", "displayName": "وليد العتيبي" } }
```

أخطاء: `401 INVALID_CREDENTIALS` (رسالة واحدة للبريد الخاطئ ولكلمة المرور
الخاطئة، فلا يُكشف وجود الحساب) · `429 RATE_LIMITED`.

### `POST /api/auth/logout`

يمسح الكوكي. `200 { "success": true }`.

### `PATCH /api/account/profile`

```jsonc
{ "displayName": "وليد", "phone": "0500000000", "city": "الرياض" }
// 200
{ "user": { /* User */ } }
```

---

## الإعلانات

### `GET /api/listings`

عام. يعيد كل الإعلانات المنشورة كبطاقات سوق.

```jsonc
{ "listings": [ /* ListingCard[] */ ] }
```

يستدعي `finalizeDueAuctions()` أولًا، فالنتيجة محدَّثة زمنيًا دائمًا.
`ListingCard` **لا يحوي** السعر الاحتياطي ولا بيانات التواصل.

### `POST /api/listings`

ينشئ إعلانًا بحالة `draft`. جسم الطلب = `listingInputSchema`:

```jsonc
{
  "plateType": "private",            // private | transport | motorcycle
  "arabicLetters": "كطع",
  "latinLetters": "KTE",             // يجب أن يساوي طول العربية
  "plateNumbers": "4040",            // 1–4 أرقام
  "emblem": "palm-swords-black",
  "customEmblemUrl": null,           // مطلوب إذا كان emblem = custom
  "description": "لوحة مميزة",

  "saleType": "auction",             // auction | fixed | offers
  "price": 0,                        // بالريالات — مطلوب ≥ 1 لـ fixed
  "startingPrice": 150000,           // مطلوب ≥ 1 لـ auction
  "minimumIncrement": 5000,          // مطلوب ≥ 1 لـ auction
  "reservePrice": 200000,            // 0 = بلا احتياطي؛ لا يقل عن الافتتاحي
  "minimumOffer": 0,                 // لـ offers، 0 = بلا حد

  "durationSeconds": 86400,          // 300 … 2,592,000 (5 دقائق … 30 يومًا)
  "extensionTriggerSeconds": 60,     // 0 … 600، و0 يعطّل التمديد
  "extensionDurationSeconds": 60,    // 0 … 600
  "extensionResetsTimer": true,
  "allowCustomBid": true
}
// 200
{ "listing": { /* Listing */ } }
```

الحروف والأرقام تُطبَّع على الخادم (`normalizeArabicLetters`, `normalizePlateNumbers`)
فلا يُعتمد على تطبيع العميل.

### `GET /api/listings/{id}`

عام. تفاصيل الإعلان الكاملة + كشف المزايدات.

```jsonc
{
  "id": "lst_...",
  "reference": "L26-00043",      // رقم الإعلان المقروء
  "plate": { /* Plate */ },
  "saleType": "auction",
  "status": "active",
  "seller": { "id": "usr_...", "displayName": "…", "city": "الرياض", "memberSince": "…" },
  "isMine": false,

  "startingPrice": 15000000,     // هللات
  "minimumIncrement": 500000,
  "nextBidAmount": 18500000,     // المطلوب في المزايدة القادمة
  "highestAmount": 18000000,
  "highestBidderName": "ماجد ا*****",
  "iAmHighest": false,
  "bidCount": 4,
  "reserveState": "not_met",     // unknown | not_met | met — لا الرقم

  "depositAmount": 5000000,      // العربون المطلوب — 0 يعني بلا عربون
  "paymentWindowHours": 48,
  "myDepositStatus": "held",     // للزائر المسجّل فقط
  "myAvailableBalance": 3500000, // ليعرف قبل المحاولة إن كان يكفي

  // عمولة المنصّة على السعر القائم — تُعرض قبل الالتزام لا بعده
  "commission": {
    "buyer":  { "base": 30000, "vat": 4500, "total": 34500 },
    "seller": { "base": 36000, "vat": 5400, "total": 41400 },
    "vatEnabled": true,
    "vatPercent": 15
  },

  "endsAt": "2026-09-01T12:00:00.000Z",
  "remainingMs": 84213000,
  "ledger": [ /* PublicBid[] */ ],
  "myOffers": [ /* عروضي أنا فقط */ ],
  "serverTime": "2026-08-31T12:03:27.000Z"
}
```

`serverTime` هو مرجع العدّاد: يُهيّأ منه في العميل بدل `Date.now()` فيتطابق
التصيير على الخادم والعميل.

`reservePrice` غير موجود في هذه الحمولة إطلاقًا — وهذا مضمون باختبار قائمة
بيضاء للمفاتيح. وكذلك لا رقم جوال ولا بريد: `seller` اسم ومدينة فقط.

`reference` رقم الإعلان المقروء — ثابت لا يتغيّر، ويُبحث به في السوق بكتابة
`L26-00043` أو `l2600043`. أمّا رقم بلا حرف نوع فيبقى بحثًا في **أرقام
اللوحة**: `4040` أرقام لوحة يبحث عنها الزائر. التفصيل في
[الأرقام المرجعية](reference-numbers.md).

`commission` تُحسب على **السعر القائم** لا على سعر الافتتاح، فتتغيّر مع كل
مزايدة: المزايد يريد أن يعرف ما سيدفعه لو رست عليه الآن. وتكون أصفارًا كلّها
إن كانت العمولة معطّلة. التفصيل في
[العمولة والقيمة المضافة](commissions-and-vat.md).

### `PATCH /api/listings/{id}`

للمالك فقط. الجسم نفسه المستخدم في الإنشاء.

أخطاء: `403 FORBIDDEN` · `409 LISTING_CLOSED` · `409 HAS_BIDS` (لا يُعدَّل
إعلان عليه مزايدة مقبولة).

### `POST /api/listings/{id}` — إجراءات المالك

```jsonc
{ "action": "publish" }   // draft → active (المزاد يبدأ عدّاده الآن)
{ "action": "cancel" }    // → cancelled
{ "action": "relist" }    // مغلق → draft بحالة نظيفة
```

أخطاء: `409 ALREADY_PUBLISHED` · `409 LISTING_CLOSED` · `409 LISTING_ACTIVE`.

### `DELETE /api/listings/{id}`

للمالك، وفقط بلا أي مزايدة وغير مُباع.
أخطاء: `409 HAS_BIDS` · `409 LISTING_SOLD`.

---

## التداول

### `POST /api/listings/{id}/bids`

| | |
| --- | --- |
| المصادقة | نعم |
| المعدل | 6 / 10 ثوانٍ لكل مستخدم لكل إعلان (`BID_RATE_LIMIT_*`) |
| الذرّية | قفل `listing:{id}` + منع تكرار |

```jsonc
// الطلب
{ "amount": 190000, "isCustomAmount": false, "clientRequestId": "b-1a2b3c…" }
// 200
{
  "bidId": "bid_...",
  "amount": 19000000,        // هللات
  "endsAt": "…",             // قد يتغيّر إن حدث تمديد
  "extended": true,
  "addedSeconds": 60
}
```

يُنشر `bid_placed` (و`time_extended` عند التمديد) على موضوعَي الإعلان والسوق.

`409` مع أحد رموز `TradeError`:

| الرمز | المعنى |
| --- | --- |
| `NOT_AN_AUCTION` | الإعلان ليس مزادًا |
| `OWN_LISTING` | لا تزايد على إعلانك |
| `AUCTION_NOT_STARTED` | لم يبدأ بعد |
| `LISTING_NOT_ACTIVE` | غير متاح للتداول |
| `AUCTION_ENDED` | انتهى الوقت |
| `AMOUNT_TOO_LOW` | أقل من `nextBidAmount` |
| `ALREADY_HIGHEST` | أنت صاحب أعلى مزايدة |
| `CUSTOM_BID_NOT_ALLOWED` | المزاد يمنع المبلغ المخصص |
| `INVALID_AMOUNT` | غير صالح أو ليس مضاعفًا للزيادة |

### `POST /api/listings/{id}/buy`

شراء مباشر ذرّي — لا تُباع اللوحة لمشتريين متزامنين.

```jsonc
{ "clientRequestId": "buy-…" }
// 200
{ "orderId": "ord_...", "amount": 4500000 }
```

يُغلق الإعلان `sold` وينشئ `Order` بمصدر `fixed`، وينشر `listing_sold`.
`409`: `NOT_FOR_SALE` · `OWN_LISTING` · `LISTING_NOT_ACTIVE` · `INVALID_AMOUNT`.

### `POST /api/listings/{id}/offers`

```jsonc
{ "amount": 120000, "message": "جاهز للتحويل اليوم" }
// 200
{ "offer": { /* Offer */ } }
```

يسحب تلقائيًا عرض المشتري السابق المعلّق على الإعلان نفسه.
`409`: `NOT_ACCEPTING_OFFERS` · `OWN_LISTING` · `LISTING_NOT_ACTIVE` ·
`AMOUNT_TOO_LOW` (أقل من `minimumOffer`).

### `POST /api/offers/{id}` — قرار البائع

```jsonc
{ "decision": "accept" }   // أو "decline"
// 200
{ "offer": { /* Offer */ }, "orderId": "ord_..." }   // orderId = null عند الرفض
```

القبول يُغلق الإعلان، وينشئ `Order` بمصدر `offer`، **ويرفض بقية العروض المعلّقة**.
`403 FORBIDDEN` لغير البائع · `409 OFFER_CLOSED` إن سبق الردّ ·
`409 LISTING_NOT_ACTIVE`.

### `DELETE /api/offers/{id}` — سحب المشتري

`403 FORBIDDEN` لغير صاحب العرض · `409 OFFER_CLOSED` إن لم يعد معلّقًا.

### `PATCH /api/orders/{id}`

```jsonc
{ "status": "cancelled" }
// 200
{ "order": { /* Order */ } }
```

**البائع وحده**، وللإلغاء وحده. و`"completed"` تُرفَض بـ`409 USE_TRANSFER_FLOW`:
الإتمام يقع بتحويل المبلغ بعد نقل الملكية وتحقّق الإدارة، لا بكلمة البائع.
`403 FORBIDDEN` · `409 ORDER_CLOSED`.

---

## السداد

### `POST /api/checkout/{orderId}`

يبدأ سداد صفقة. **مقصور على مشتريها** — مبالغها وعمولتها شأنه وحده.

```jsonc
// الطلب
{ "method": "wallet" }   // أو "tap" أو "bank_transfer"

// الاستجابة
{
  "paymentReference": "P26-00001",
  "redirectUrl": null,    // Tap وحدها: رابط صفحة البوابة
  "settled": true         // المحفظة وحدها تُتمّ الصفقة فورًا
}
```

| الرمز | متى |
| --- | --- |
| `NOT_YOUR_ORDER` | 403 — الصفقة لمشترٍ آخر |
| `ORDER_COMPLETED` | 409 — مسدّدة مسبقًا |
| `ORDER_CANCELLED` | 409 — ملغاة |
| `METHOD_UNAVAILABLE` | 409 — الوسيلة معطّلة أو الرصيد لا يكفي |

المبلغ **لا يُرسَل في الطلب**: يُحسب في الخادم من الصفقة وعربونها وإعدادات
العمولة. مبلغٌ يأتي من العميل مبلغٌ يُتلاعب به.

التفصيل في [مسار السداد](payments.md#85-سداد-الصفقات--صفحة-موحدة).

---

## داخلي

### `POST /api/internal/sweep`

ليس للاستخدام العام. يستدعيه [`server.mjs`](../server.mjs) كل 5 ثوانٍ لإنهاء
المزادات المستحقة.

الحماية: ترويسة `x-internal-sweep` تساوي `SESSION_SECRET` بالضبط، وإلا
`403 FORBIDDEN`.

```jsonc
{ "finalized": 2 }   // عدد الإعلانات التي تغيّرت حالتها
```

---

## مسارات غير برمجية

| المسار | الوصف |
| --- | --- |
| `GET /robots.txt` | يولّده `src/app/robots.ts` |
| `GET /sitemap.xml` | يولّده `src/app/sitemap.ts` — يشمل كل إعلان منشور |
| `GET /ws` | ترقية WebSocket — [البروتوكول](realtime-protocol.md) |

---

## الإدارة

كلّها خلف `requireAdminId()` — كوكي `pa_admin` المستقلّ، وتحقّق من **وجود
الحساب** لا من توقيع الجلسة وحده.

| المسار | الجسم / الوظيفة |
| --- | --- |
| `POST /api/admin/auth/login` | `{ email, password }` — 5 محاولات/دقيقة |
| `POST /api/admin/auth/logout` | خروج الإدارة وحدها؛ جلسة المستخدم تبقى |
| `POST /api/admin/users/{id}/wallet` | `{ type: 'topup' \| 'withdrawal', amount, note }` |
| `POST /api/admin/deposits/{id}` | `{ decision: 'forfeit' \| 'refund' \| 'undo_forfeit', reason }` |
| `PATCH /api/admin/orders/{id}` | `{ status }` — الاكتمال يخصم العربون ويفكّ الباقي ويقتطع العمولة |
| `GET /api/admin/orders/{id}/reaward` | المزايدون التالون بحالة عربون كلٍّ |
| `POST /api/admin/orders/{id}/reaward` | `{ nextBidderId, forfeitCurrentDeposit, reason }` |
| `POST /api/admin/platform-entries/{id}` | تحصيل عمولة مستحقّة |
| `GET PATCH /api/admin/settings/auction` | قواعد المزاد |
| `GET PATCH /api/admin/settings/commission` | العمولة والضريبة |
| `GET PATCH /api/admin/settings/payments` | بوابات الدفع |
| `PATCH /api/admin/payments/{id}` | تأكيد حوالة أو رفضها |
| `DELETE /api/admin/listings/{id}` | إيقاف إعلان — لا حذف |
| `GET POST /api/admin/faq` · `PATCH DELETE /api/admin/faq/{id}` | إدارة الأسئلة |

### رموز قرارات العربون

| الرمز | المعنى |
| --- | --- |
| `NO_ORDER_FOR_DEPOSIT` | مصادرة عربون لم ترسُ اللوحة على صاحبه |
| `FORFEIT_TOO_EARLY` | مهلة السداد ما زالت قائمة |
| `FORFEIT_DISABLED` | `forfeitPercent` صفر في قواعد الإعلان |
| `ORDER_COMPLETED` | الصفقة سُدّدت وأُغلقت |
| `BIDS_STILL_STANDING` | ردّ عربون لمزايد مزايدته قائمة في مزاد جارٍ |
| `NOT_FORFEITED` · `UNDO_WINDOW_CLOSED` | تراجع في غير موضعه أو بعد مهلته |
| `NOT_A_BIDDER` | إعادة إرساء على من ليس في كشف المزايدات |

هذه الرموز يُرجعها **الخادم**، والواجهة لا تشتقّ شروطها بنفسها: صفوف العرابين
تحمل `canForfeit` و`canRefund` و`canUndo` محسوبة من الخدمة نفسها.
