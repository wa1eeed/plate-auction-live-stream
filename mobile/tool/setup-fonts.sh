#!/usr/bin/env bash
# خطُّ اللوحة — Arial Bold، وهو شرطُ حزمة التسليم الصريح.
#
# **ولا يُحفظ في المستودع.** ترخيصُ Monotype للتضمين يُجيز شحنَه داخل حزمة
# التطبيق، لا نشرَه في كودٍ علنيّ — وهما إذنان مختلفان. فيُنسخ هنا قبل
# البناء، ويُضاف إلى الحزمة وقتَه.
set -euo pipefail

dest="$(dirname "$0")/../assets/fonts/plate-arial-bold.ttf"
src="${ARIAL_BOLD_TTF:-/System/Library/Fonts/Supplemental/Arial Bold.ttf}"

if [ -f "$dest" ]; then
  echo "موجودٌ سلفًا: $dest"
  exit 0
fi

if [ ! -f "$src" ]; then
  echo "لم يُوجد Arial Bold في: $src" >&2
  echo "اضبط ARIAL_BOLD_TTF على مسار الملفّ المرخَّص." >&2
  exit 1
fi

mkdir -p "$(dirname "$dest")"
cp "$src" "$dest"
echo "نُسخ: $dest"
