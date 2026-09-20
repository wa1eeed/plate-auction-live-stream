#!/usr/bin/env bash
#
# استعادةُ نسخةٍ في قاعدةٍ **جانبية** — والتحقّق من أنّ ما فيها هو ما كان.
#
#   ./scripts/db-restore.sh <ملفّ النسخة> <قاعدة الاختبار>
#
# القاعدة الجانبية تُحذف وتُنشأ من جديد. ولذلك حارسان:
#   ١) اسمُها يُمرَّر صراحةً — لا افتراضيّ يُصيب الحيّة بسهوٍ في سطر.
#   ٢) لا تُقبل قاعدةٌ يشير إليها `DATABASE_URL` — وهي الحيّة.
#
# والاستعادةُ ليست هدفَ هذا الملفّ، بل **إثباتُ أنّ النسخة تُستعاد**. نسخةٌ
# لم تُستعَد قطّ ليست نسخة، بل ظنٌّ بها.

set -euo pipefail

FILE="${1:-}"
TARGET="${2:-}"

if [ -z "$FILE" ] || [ -z "$TARGET" ]; then
  echo "الاستعمال: ./scripts/db-restore.sh <ملفّ النسخة> <اسم قاعدة الاختبار>" >&2
  echo "مثال:     ./scripts/db-restore.sh backups/plate-2026-09-20_120000.dump plate_restore_check" >&2
  exit 1
fi

[ -f "$FILE" ] || { echo "✗ لا ملفّ: $FILE" >&2; exit 1; }

# ---- حارسان، والثاني هو الذي يُعتمد عليه
#
# الأوّل يطابق الاسم بالاسم. والثاني — الأهمّ — **يسأل القاعدة نفسها**: إن
# كان فيها مستخدمٌ أو لوحة فليست جانبية، وسواءٌ وافق اسمُها أم خالف.
#
# ولماذا لا يكفي الأوّل؟ لأنّه كُتب أوّلَ مرّة بـ`sed` وتعبيرٍ لا يفهمه
# `sed` على macOS، فرجع الاسم فارغًا ومرّ الحارس صامتًا — ودُمّرت قاعدةٌ في
# التجربة ولم ينجُ ما فيها إلّا لأنّ النسخة كانت مطابقة. فحارسٌ يعتمد على
# تحليل نصٍّ يسقط بلا ضجّة؛ وحارسٌ يسأل الحقيقة لا يسقط.

# استخراجٌ بتوسيع الصدفة وحده — لا لهجة regex تختلف بين نظامٍ ونظام
LIVE_DB="${DATABASE_URL:-}"
LIVE_DB="${LIVE_DB##*/}"      # ما بعد آخر شرطة
LIVE_DB="${LIVE_DB%%\?*}"     # بلا سلسلة الاستعلام

if [ -n "$LIVE_DB" ] && [ "$TARGET" = "$LIVE_DB" ]; then
  echo "✗ «$TARGET» هي القاعدة التي يشير إليها DATABASE_URL." >&2
  echo "  الاستعادة تحذفها وتُنشئها من جديد. اختر اسمًا آخر." >&2
  exit 1
fi

# الحارس الثاني: أفيها بيانات؟ فإن كانت فهي ليست قاعدة اختبار.
if psql -lqtA 2>/dev/null | cut -d'|' -f1 | grep -qx "$TARGET"; then
  ROWS="$(psql -d "$TARGET" -tAc \
    "select coalesce((select count(*) from users),0) + coalesce((select count(*) from listings),0)" \
    2>/dev/null || echo 0)"
  if [ "${ROWS:-0}" -gt 0 ] && [ "${FORCE:-}" != "1" ]; then
    echo "✗ «$TARGET» موجودةٌ وفيها بيانات ($ROWS صفًّا في users+listings)." >&2
    echo "  الاستعادة تحذفها بالكامل. إن كنت متأكّدًا:  FORCE=1 $0 $*" >&2
    exit 1
  fi
fi

echo "▸ استعادةٌ في «$TARGET» — تُحذف إن وُجدت ثمّ تُنشأ"
dropdb --if-exists "$TARGET"
createdb "$TARGET"

# لا `--exit-on-error`: تحذيراتُ الامتدادات والملكيّة شائعةٌ وغير قاتلة،
# والحكم يقع على **ما وصل فعلًا** بالعدّ أدناه لا على صمت الأداة.
pg_restore --no-owner --no-privileges --dbname="$TARGET" "$FILE" 2>/dev/null || true

echo
echo "▸ ما وصل إلى القاعدة المستعادة:"
psql -d "$TARGET" -tAF' ' -c "
  select 'جداول' , count(*) from information_schema.tables where table_schema='public'
  union all select 'مستخدمون', count(*) from users
  union all select 'لوحات'   , count(*) from listings
  union all select 'مزايدات' , count(*) from bids
  union all select 'صفقات'   , count(*) from orders
  union all select 'محافظ'   , count(*) from wallets
  union all select 'قيود'    , count(*) from ledger
" | sed 's/^/  /'

echo
if [ -n "${DATABASE_URL:-}" ]; then
  echo "▸ وللمقارنة — ما في القاعدة الحيّة الآن:"
  psql "$DATABASE_URL" -tAF' ' -c "
    select 'مستخدمون', count(*) from users
    union all select 'لوحات'  , count(*) from listings
    union all select 'مزايدات', count(*) from bids
    union all select 'صفقات'  , count(*) from orders
  " | sed 's/^/  /'
  echo
  echo "الحكم: تطابقُ الأعداد يعني نسخةً تُستعاد. واختلافُها يعني نسخةً ناقصة —"
  echo "وأنّ ما تظنّه حمايةً ليس كذلك."
fi

echo
echo "وبعد الفحص:  dropdb $TARGET"
