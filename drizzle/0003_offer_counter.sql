-- السومُ المقابل — وبه يصير «على السوم» سومًا.
--
-- وكان البائع يقبل أو يرفض ولا ثالثَ لهما، فيموت العرضُ القريبُ لأنّه دون
-- المطلوب بقليل. فصار له أن يردّ بمبلغٍ آخر فيبقى البابُ مفتوحًا.
--
-- ويُحفظ على العرض نفسه لا في صفٍّ ثانٍ: السومُ جولةٌ بين طرفين على عرضٍ
-- بعينه. و`NULL` هو الحال الأصليّ، فكلُّ عرضٍ قائمٍ يبقى كما هو.
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_amount" bigint;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_message" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "counter_at" timestamp with time zone;
