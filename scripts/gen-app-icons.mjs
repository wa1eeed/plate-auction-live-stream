import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * أيقونات التطبيق وشاشة إقلاعه — تُولَّد من هويّة المنصّة لا تُرسم بيدٍ.
 *
 *   node scripts/gen-app-icons.mjs
 *
 * ولماذا نصٌّ لا ملفّاتٌ تُحفظ مرّة؟ لأنّ الهويّة تتغيّر — لونًا أو رمزًا —
 * فتتبعها عشرون صورةً في مقاسات. وما يُولَّد من مصدرٍ واحد لا يتناقض بعضُه
 * مع بعض، وما يُرسم مرّةً يتخلّف عن الهويّة بلا أن ينتبه أحد.
 *
 * والتصيير بالمتصفّح لا بمكتبة رسوم: هو مثبَّتٌ أصلًا لاختبارات المنصّة،
 * وسلوكُه مع SVG هو سلوك ما يراه المستخدم.
 */

const GOLD = '#D6A84B'
const INK = '#080B10'
const SPLASH_BG = '#f4f6fa' // يطابق `backgroundColor` في capacitor.config.ts

/** مطرقة المزاد — الرمز نفسه في `public/app-icon.svg`، في مربّع 24. */
const GLYPH = `<g fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m14.5 12.5-8 8a2.119 2.119 0 1 1-3-3l8-8"/>
    <path d="m16 16 6-6"/><path d="m8 8 6-6"/>
    <path d="m9 7 8 8"/><path d="m21 11-8-8"/>
  </g>`

const full = (size, radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" rx="${radius}" fill="${GOLD}"/>
  <g transform="translate(256 256) scale(11) translate(-12 -12)">${GLYPH}</g>
</svg>`

/**
 * الطبقة الأمامية لأندرويد: الرمز على شفافيةٍ داخل **منطقة الأمان**.
 *
 * النظام يقصّ الأيقونة التكيّفية بأشكالٍ مختلفة، والمضمون منها 66 من 108.
 * والرمز يُقاس في مربّع 24 ⇒ المقياس 66/24 = 2.75، ويُنقص إلى 2.4 ليتّسع
 * لعرض القلم فلا يُقصّ طرفُ المطرقة على جهازٍ يقصّ دائرة.
 */
const foreground = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="${size}" height="${size}">
  <g transform="translate(54 54) scale(2.4) translate(-12 -12)">${GLYPH}</g>
</svg>`

const splash = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="${size}" height="${size}">
  <rect width="1024" height="1024" fill="${SPLASH_BG}"/>
  <g transform="translate(512 512)">
    <rect x="-140" y="-140" width="280" height="280" rx="62" fill="${GOLD}"/>
    <g transform="scale(6) translate(-12 -12)">${GLYPH}</g>
  </g>
</svg>`

const browser = await chromium.launch()
const page = await browser.newPage()
let count = 0

async function render(svg, size, out, height = size) {
  mkdirSync(dirname(out), { recursive: true })
  await page.setViewportSize({ width: size, height })
  await page.setContent(
    `<style>*{margin:0;padding:0}html,body{width:${size}px;height:${height}px;overflow:hidden}</style>${svg}`,
  )
  await page.screenshot({ path: out, omitBackground: true })
  count += 1
}

/*
 * iOS: صورةٌ واحدة 1024 **مربّعةٌ صلبة** (rx=0) وبلا قناة ألفا.
 * النظام يقصّ الزوايا بنفسه، وأبل ترفض أيقونةً فيها شفافية.
 */
await render(full(1024, 0), 1024, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')

const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, px] of Object.entries(DENSITIES)) {
  const dir = `android/app/src/main/res/mipmap-${density}`
  await render(full(px, 96), px, `${dir}/ic_launcher.png`)
  await render(full(px, 256), px, `${dir}/ic_launcher_round.png`)
  /* الأمامية بمقاس 108dp لا 48dp — وهو ما يشترطه النظام للأيقونة التكيّفية */
  const fgPx = Math.round((px * 108) / 48)
  await render(foreground(fgPx), fgPx, `${dir}/ic_launcher_foreground.png`)
}

await render(splash(2732), 2732, 'ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png')
const source = readFileSync('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png')
for (const name of ['splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  writeFileSync(`ios/App/App/Assets.xcassets/Splash.imageset/${name}`, source)
  count += 1
}
await render(splash(1920), 1920, 'android/app/src/main/res/drawable/splash.png')

/*
 * ---- أصول المتجرين
 *
 * أيقونة 512 لـPlay: تُرفع في اللوحة ولا تُؤخذ من الحزمة.
 * والرسم الدعائيّ 1024×500: **يرفض Play الإصدار بدونه**، ويُعرض أعلى صفحة
 * التطبيق — فيحمل الاسم والوعد لا الأيقونة وحدها.
 */
await render(full(512, 112), 512, 'store-assets/play-icon-512.png')

/*
 * والرسم الدعائيّ بـHTML لا SVG.
 *
 * فـ`text-anchor` في SVG يُقاس في اتّجاه الكتابة: مع `direction="rtl"` تصير
 * «end» يسارًا لا يمينًا — فيُحاذى النصّ عكسَ المراد ويركب على الأيقونة.
 * وجُرّب فوقع. وHTML يعرف `dir="rtl"` ويصفّ بالسطر كما يُقرأ.
 */
const feature = `<div style="
    width:1024px;height:500px;background:#0E1116;display:flex;align-items:center;
    justify-content:center;gap:56px;direction:rtl;
    font-family:'Tajawal','SF Arabic','Geeza Pro',system-ui,sans-serif;
    background-image:repeating-linear-gradient(to bottom,#1B212B 0 2px,transparent 2px 62px);">
  <div style="flex:0 0 auto;width:208px;height:208px;border-radius:46px;background:${GOLD};
              display:flex;align-items:center;justify-content:center;">
    <svg viewBox="0 0 24 24" width="118" height="118">${GLYPH}</svg>
  </div>
  <div style="text-align:right;">
    <div style="font-size:76px;font-weight:800;color:#fff;line-height:1.1;">سوق اللوحات</div>
    <div style="font-size:36px;font-weight:600;color:${GOLD};margin-top:14px;">مزادات لوحات المركبات — بضمان المنصّة</div>
    <div style="font-size:28px;color:#96A0B0;margin-top:12px;">مالك محفوظ حتى تنتقل اللوحة باسمك</div>
  </div>
</div>`
await render(feature, 1024, 'store-assets/play-feature-1024x500.png', 500)

await browser.close()
console.log(`✓ وُلِّد ${count} ملفًّا من public/app-icon.svg`)
