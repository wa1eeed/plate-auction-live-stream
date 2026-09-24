-- تعطيلُ الحساب بطلب صاحبه — لا حذفُ صفّه.
--
-- آبل تشترط أن يستطيع المستخدم حذف حسابه من داخل التطبيق. ومحوُ الصفّ محوٌ
-- لتاريخٍ ماليّ تقابله صفقاتٌ وقيودُ محفظةٍ وفواتير — فتصير طلباتٌ بلا مشترٍ
-- وقيودٌ بلا صاحب. فيُعطَّل الحساب ويبقى ما يشير إليه سليمًا.
--
-- و`NULL` هو الحال الأصليّ، فكلُّ حسابٍ قائمٍ يبقى عاملًا بلا لمسة.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "disabled_reason" text;
