-- الستوري صار شرائحَ لا شريحة.
--
-- وكان وسيطًا واحدًا، فمن أراد ثلاثَ صورٍ أنشأ ثلاثَ حلقات — فامتلأ الشريط
-- بما هو موضوعٌ واحد. وصار يحمل شرائحَه فتتقدّم واحدةً بعد أخرى.
--
-- والعمودُ `jsonb` لا جدولٌ ثانٍ: الشرائح تُقرأ وتُكتب مع الستوري دائمًا،
-- ولا يُبحث فيها ولا يُنضمّ إليها.
ALTER TABLE "stories" ADD COLUMN IF NOT EXISTS "slides" jsonb NOT NULL DEFAULT '[]'::jsonb;--> statement-breakpoint

-- ويُملأ من الأعمدة المفردة، فلا يضيع ما نُشر قبل الترحيل.
UPDATE "stories"
SET "slides" = jsonb_build_array(
  jsonb_build_object(
    'id', "id" || '-1',
    'mediaKey', "media_key",
    'mediaKind', "media_kind",
    'posterKey', "poster_key",
    'alt', COALESCE("alt", ''),
    'durationSeconds', COALESCE("duration_seconds", 6)
  )
)
WHERE "slides" = '[]'::jsonb AND "media_key" IS NOT NULL;--> statement-breakpoint

-- والمفردةُ تبقى ولا تُقرأ — ليبقى الرجوعُ إلى نشرةٍ سابقة ممكنًا بلا فقد.
-- وتُرفع قيدُ الإلزام عنها فيقبل الجديدُ منها فراغًا.
ALTER TABLE "stories" ALTER COLUMN "media_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "stories" ALTER COLUMN "media_kind" DROP NOT NULL;
