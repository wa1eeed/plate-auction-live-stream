# التشغيل والنشر

> ما يلزم لتشغيل المنصّة في بيئة حقيقية، وما يختلف عن مشروع Next عادي.

## 1. الفرق الجوهري

**لا يعمل بـ `next start`.** التطبيق يُشغَّل بخادم مخصّص
([`server.mjs`](../server.mjs)) يستضيف Next وWebSocket في العملية نفسها.

```bash
pnpm build
NODE_ENV=production node server.mjs   # وهو ما يفعله pnpm start
```

يترتّب على هذا:

- **بيئة Node طويلة العمر مطلوبة.** المنصّات عديمة الحالة (serverless / edge)
  لا تصلح: المقابس تعيش في ذاكرة العملية، والمسح الدوري يحتاج مؤقّتًا مستمرًّا.
- **وسيط الشبكة يجب أن يمرّر ترقية WebSocket** على `/ws`.
- **نسخة واحدة** في الوضع الحالي — انظر القسم 6.

## 2. المتطلبات

| | |
| --- | --- |
| Node.js | 20 فأعلى |
| pnpm | 9 فأعلى |
| الذاكرة | ~512MB تكفي وضع الذاكرة الحالي |
| المنافذ | `PORT` (افتراضيًا 3000) |

## 3. متغيّرات البيئة للإنتاج

```bash
SESSION_SECRET=$(openssl rand -base64 48)   # إلزامي
NEXT_PUBLIC_APP_URL=https://example.com     # النطاق الحقيقي
DEMO_MODE=false                             # لا بيانات تجريبية
AUCTION_STORE=memory
PORT=3000
HOST=0.0.0.0
BID_RATE_LIMIT_WINDOW_MS=10000
BID_RATE_LIMIT_MAX=6
```

`SESSION_SECRET` يوقّع الجلسات **ويحمي مسار المسح الداخلي**. في الإنتاج يرمي
التطبيق عند أول عملية توقيع أو تحقّق إن كان مفقودًا أو أقصر من 16 حرفًا، فأول
طلب مصادقة يفشل صراحةً. تحقّق منه قبل توجيه الحركة لا بعده.

## 4. وسيط الشبكة

يجب تمرير ترويسات الترقية على `/ws`، وإلا لم يعمل الاتصال اللحظي (وستسقط
الواجهة إلى الجلب الدوري كل 8 ثوانٍ — تعمل، لكن بتأخير).

### nginx

```nginx
location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;    # أطول من حدّ الصمت (45 ثانية)
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### Caddy

```
example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy يمرّر الترقية تلقائيًا.

**احجب `/api/internal/sweep`** عن الإنترنت العام. هو محمي بالمفتاح، لكن حجبه
على مستوى الشبكة طبقة ثانية بلا تكلفة:

```nginx
location /api/internal/ { deny all; }
```

الخادم يستدعيه عبر `127.0.0.1` فلا يتأثّر بالحجب.

## 5. HTTPS

مطلوب: كوكي الجلسة يحمل `Secure` في الإنتاج فلا يُرسل على HTTP، أي أن تسجيل
الدخول لن يعمل أصلًا بلا HTTPS. صفحة `https` تفتح المقبس على `wss://` تلقائيًا.

## 6. التوسّع الأفقي

الوضع الحالي **نسخة واحدة**. ثلاثة أشياء تعيش في ذاكرة العملية:

| ما | التأثير | العلاج |
| --- | --- | --- |
| `__auctionStore` | البيانات كلها | تنفيذ `AuctionStore` على PostgreSQL ([ADR-0003](adr/0003-store-abstraction.md)) |
| `__plateRealtime` | النشر يصل لمقابس هذه النسخة فقط | ناقل مشترك (Redis pub/sub) داخل `publishRealtime` |
| `__rateBuckets` | الحدّ يتضاعف بعدد النسخ | مخزن مشترك |

كذلك المسح الدوري: مع عدة نسخ سينفّذه كلٌّ منها. `finalizeDueAuctions` تعمل
على حالة الإعلان فلا تُنشئ طلبًا مكرّرًا (تفحص وجود طلب سابق)، لكن الأنظف عند
التوسّع نقله إلى عامل واحد أو قفل موزّع.

## 7. المراقبة

نقاط تستحق التتبّع:

- عدد المقابس المتصلة: `getRealtimeRegistry().sockets.size`.
- استجابة `POST /api/internal/sweep` تعيد `{ finalized: n }` — عدد الإعلانات
  التي أُنهيت في الدورة.
- نسبة حالة `offline` في العميل مؤشّر على وسيط شبكة لا يمرّر الترقية.

## 8. النسخ الاحتياطي

في وضع الذاكرة **لا توجد بيانات دائمة** — إعادة التشغيل تعيد بذرة Demo (أو
قاعدة فارغة عند `DEMO_MODE=false`). النسخ الاحتياطي يبدأ بالانتقال إلى
PostgreSQL.

## 9. قائمة فحص النشر

- [ ] `SESSION_SECRET` عشوائي طويل خاص بالبيئة
- [ ] `DEMO_MODE=false`
- [ ] `NEXT_PUBLIC_APP_URL` = النطاق الحقيقي
- [ ] HTTPS مفروض
- [ ] الوسيط يمرّر ترقية WebSocket على `/ws`
- [ ] `/api/internal/*` محجوب خارجيًا
- [ ] مدير عمليات يعيد التشغيل عند السقوط (systemd / PM2 / حاوية)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` كلها خضراء

راجع أيضًا [قائمة فحص الأمان](security.md#14-قائمة-فحص-قبل-الإنتاج).
