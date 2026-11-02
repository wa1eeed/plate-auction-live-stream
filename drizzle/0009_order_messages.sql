/*
 * محادثةُ الصفقة — سطرٌ لكلّ رسالةٍ بين بائعٍ ومشترٍ.
 *
 * وكانت الواجهةُ ترسم المحادثةَ ببياناتٍ ساكنةٍ لأنّ الويبَ ما احتاجها:
 * الطرفانِ يخرجان إلى واتساب فيتفقان هناك. وما خرج من المنصّة لا يُرى حين
 * يُتنازع: يقول هذا وعدتني وينفي ذاك، ولا سجلَّ يُحكَم به.
 *
 * **والوسيطُ مفتاحٌ لا محتوى**: الصورةُ والملفُّ في مخزن الوسائط،
 * وهنا مفتاحُه واسمُه وحجمُه — فقاعدةُ البيانات لا تُثقَل بما لا يُبحث فيه،
 * ونسخُها الاحتياطيّةُ تبقى خفيفةً تُستعاد في دقائق.
 *
 * **والفهرسُ على (الصفقة، الوقت)**: القراءةُ الوحيدةُ لهذا الجدول هي
 * «رسائلُ هذه الصفقة مرتّبةً» — ففهرسٌ مركَّبٌ عليهما يخدمها كاملةً بلا
 * ترتيبٍ في الذاكرة.
 *
 * ولا مفتاحَ أجنبيٌّ هنا، اتّباعًا لما في بقيّة المخطَّط: الربطُ يُحرَس في
 * الخدمة، وجدولٌ بلا قيودٍ يُهاجَر ويُقسَّم بلا ترتيبِ حذفٍ متشابك.
 */
CREATE TABLE IF NOT EXISTS "order_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "order_id" text NOT NULL,
  "sender_id" text NOT NULL,
  "kind" text NOT NULL,
  "body" text,
  "media_key" text,
  "file_name" text,
  "file_size" integer,
  "duration_seconds" integer,
  "created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_messages_order_idx" ON "order_messages" ("order_id", "created_at");
