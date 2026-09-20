#!/usr/bin/env bash
#
# نسخةٌ احتياطية من القاعدة — وتحقّقٌ من أنّها تُقرأ.
#
# ولماذا التحقّق جزءٌ من النسخ لا بندٌ منفصل؟ لأنّ `pg_dump` قد ينقطع في
# منتصفه — قرصٌ امتلأ، اتّصالٌ سقط — فيترك ملفًّا **بحجمٍ معقول** لا يُستعاد
# منه شيء. ومن لا يفتح النسخة لا يعلم، ويكتشفها يوم الكارثة وحدها.
#
#   ./scripts/db-backup.sh [مجلّد المخرجات]
#
# يقرأ `DATABASE_URL` من البيئة — ولا يُكتب في هذا الملفّ ولا يُطبع في مخرجاته.

set -euo pipefail

OUT_DIR="${1:-backups}"
URL="${DATABASE_URL:-}"

if [ -z "$URL" ]; then
  echo "✗ DATABASE_URL غير مضبوط." >&2
  echo "  مثال:  DATABASE_URL='postgres://…' ./scripts/db-backup.sh" >&2
  exit 1
fi

command -v pg_dump >/dev/null || { echo "✗ pg_dump غير موجود — ثبّت postgresql-client" >&2; exit 1; }

mkdir -p "$OUT_DIR"
STAMP=$(date +%Y-%m-%d_%H%M%S)
FILE="$OUT_DIR/plate-$STAMP.dump"

echo "▸ نسخٌ إلى $FILE"

# -Fc: صيغةٌ مضغوطة يقرأها pg_restore انتقائيًّا ويتحقّق منها بلا استعادة.
# --no-owner --no-privileges: الاستعادة تقع تحت مستخدمٍ آخر في بيئةٍ أخرى،
#   وملكيّةُ مستخدمٍ لا وجود له هناك تُسقط الاستعادة بلا داعٍ.
pg_dump --format=custom --no-owner --no-privileges --file="$FILE" "$URL"

# ---- التحقّق: تُفتح النسخة ويُقرأ فهرسها. ملفٌّ مبتورٌ يسقط هنا لا يوم الكارثة.
if ! pg_restore --list "$FILE" > /dev/null 2>&1; then
  echo "✗ النسخة لا تُقرأ — حُذفت حتى لا تُحسب نسخةً وهي ليست كذلك." >&2
  rm -f "$FILE"
  exit 1
fi

TABLES=$(pg_restore --list "$FILE" | grep -c 'TABLE DATA' || true)
SIZE=$(du -h "$FILE" | cut -f1)

echo "✓ نسخةٌ سليمة — $SIZE · $TABLES جدولًا فيه بيانات"
echo "  $FILE"
echo
echo "⚠ وهي على السيرفر نفسه. النسخةُ التي لا تخرج ليست نسخة:"
echo "  scp <المستخدم>@<السيرفر>:$(cd "$OUT_DIR" && pwd)/$(basename "$FILE") ."
