/*
 * تحريرُ اللوحات العالقة — صفقةٌ ماتت ولوحتُها بقيت «مباعة».
 *
 * وحالةُ اللوحة تصير `sold` لحظةَ الطلب لا لحظةَ وصول المال. وكان إغلاقُ
 * الصفقة — عدولًا أو تخلّفًا عن السداد أو مصادرةً — يقلب حالَ الصفقة ولا
 * يمسّ اللوحة. فتبقى `sold` بلا صفقةٍ قائمة:
 *
 *   • لا تُعرض في السوق (الفلتر يطلب `active`)،
 *   • ولا تظهر معروضةً في «إدارة لوحاتي»،
 *   • و`canSellerRelist` تستثني `sold` فلا يُعيد صاحبُها عرضَها.
 *
 * لوحةٌ لا تُشترى ولا تُستردّ. وقد أُصلح الكودُ فلا يقع بعد اليوم، وهذا
 * يُحرّر ما وقع قبله.
 *
 * **والشرطُ ضيّقٌ عمدًا**: لا تُحرَّر إلّا لوحةٌ كلُّ صفقاتها ميّتةٌ
 * (`cancelled` أو `defaulted`) — أي لم يصل مالُها قطّ. فلوحةٌ لها صفقةٌ
 * مكتملةٌ أو مستردّةٌ أو حيّةٌ تبقى على حالها، ولوحةٌ بلا صفقةٍ أصلًا لا
 * تُمسّ (`EXISTS` تشترط واحدةً على الأقلّ).
 */
UPDATE "listings" AS l
SET "status" = 'active',
    "sold_to_user_id" = NULL,
    "sold_amount" = 0,
    "ended_at" = NULL,
    "updated_at" = now()
WHERE l."status" = 'sold'
  AND EXISTS (SELECT 1 FROM "orders" o WHERE o."listing_id" = l."id")
  AND NOT EXISTS (
    SELECT 1 FROM "orders" o
    WHERE o."listing_id" = l."id"
      AND o."status" NOT IN ('cancelled', 'defaulted')
  );
