import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * تنسيق الوقت المتبقي بما يناسب مداه.
 * مزادات السوق قد تمتد أيامًا، فلا يكفي `m:ss`:
 *   ≥ يوم   → «3 أيام 5 س»
 *   ≥ ساعة  → «5:23:10»
 *   ≥ دقيقة → «23:10»
 *   أقل     → «45 ث»
 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')

  if (days > 0) {
    const dayLabel = days === 1 ? 'يوم' : days === 2 ? 'يومان' : days <= 10 ? 'أيام' : 'يومًا'
    const dayPart = days === 2 ? dayLabel : `${days} ${dayLabel}`
    return hours > 0 ? `${dayPart} و${hours} س` : dayPart
  }
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  if (minutes > 0) return `${minutes}:${pad(seconds)}`
  return `${seconds} ث`
}

/**
 * كل التواريخ بتوقيت السعودية بمرجع واحد للبائع والمشتري أيًّا كان جهازهما،
 * وبهذا يتطابق ناتج الخادم مع ناتج العميل فلا يحدث اختلاف في الترطيب.
 */
const TIME_ZONE = 'Asia/Riyadh'
/*
 * التقويم ميلاديّ مثبَّتًا — `-ca-gregory` ليست زيادة.
 *
 * تقويم `ar-SA` الافتراضيّ في CLDR هو أمّ القرى، وكلّ محرّك يحسم ذلك ببيانات
 * ICU التي بُني بها: هذا المتصفّح يردّه ميلاديًّا وسفاري على iOS يردّه هجريًّا.
 * فما يُقرأ «05/09/2026» على جهاز يصير «١٤٤٨/٠٣/٢٣» على آخر، والمهل والعدادات
 * والفواتير تُقرأ كلّها بتقويمٍ لم تُكتب به.
 *
 * وأسوأ منه أنّ الخادم يرسم بتقويمه والعميل يعيد الرسم بتقويمه، فيختلف النصّان
 * لطابعٍ واحد ويسقط الترطيب. والمنطقة الزمنية كانت مثبّتةً لهذا السبب نفسه،
 * وبقي التقويم متروكًا.
 */
const LOCALE = 'ar-SA-u-nu-latn-ca-gregory'

/**
 * الساعة باثنتي عشرة بعلامة صباحٍ ومساء: `06:40 م`.
 *
 * وهي الصيغة التي تُقرأ بها الساعة محليًّا — و«18:40» تُترجَم في الذهن قبل أن
 * تُفهم. والخانتان تبقيان مع ذلك: `6:40` و`06:40` يختلف عرضهما، فتهتزّ أعمدة
 * الجداول سطرًا بعد سطر.
 */
const clockFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

/**
 * التاريخ رقميًا بالشرطة المائلة: `04/09/2026`.
 *
 * لا اسم شهر: «4 سبتمبر» يطول ويختلف عرضه من شهر لآخر فتهتزّ أعمدة الجداول،
 * ولا يُقارن بلمحة. والصيغة يوم/شهر/سنة كما تُقرأ وتُكتب محليًا.
 */
const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

export function formatClock(iso: string | null): string {
  if (!iso) return '—'
  return clockFormat.format(new Date(iso))
}

/**
 * ختم زمني كامل: `04/09/2026 · 11:55`.
 *
 * **كامل دائمًا** ولا يختصر إلى «اليوم» أو «أمس». الاختصار يقصر النصّ ويطيل
 * المهمّة: من يراجع كشف حساب أو سجلّ تدقيق يقارن أسطرًا بعضها ببعض، و«أمس»
 * سطرًا و«12/08/2026» سطرًا آخر لا يُقارنان بلمحة. والتاريخ الصريح يُنسخ
 * ويُقتبس في مراسلة كما هو.
 *
 * `nowIso` يبقى في التوقيع لتوافق النداءات القائمة ولا أثر له في الناتج.
 */
export function formatTimestamp(iso: string | null, _nowIso?: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return `${dayFormat.format(date)} · ${clockFormat.format(date)}`
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * تصريف المعدود بالعربية.
 *
 * العربية ستّ صيغ لا اثنتان، والواجهة كانت تكتب «3 صفقة» بالمفرد دائمًا في
 * سطر و«2 لوحات» بالجمع في سطر آخر من الملفّ نفسه — فيقرأ صاحب الحساب لغةً
 * مكسورة في أوّل ما يفتحه.
 *
 * والتصنيف من `Intl.PluralRules('ar')` لا من شروط مكتوبة بيدنا: هو مرجع
 * يونيكود نفسه، ويعرف أنّ 11–99 مفردٌ منصوب و100 فصاعدًا مفردٌ مجرور.
 *
 * @example arabicCount(2, { one: 'صفقة', two: 'صفقتان', few: 'صفقات', many: 'صفقة' })
 *          // «صفقتان» — بلا رقم، فالمثنّى يُغني عنه
 */
export function arabicCount(
  count: number,
  forms: { zero?: string; one: string; two: string; few: string; many: string; other?: string },
): string {
  const category = new Intl.PluralRules('ar').select(count)

  // المفرد والمثنّى يُغنيان عن الرقم — «صفقتان» لا «2 صفقتان»
  if (category === 'one') return forms.one
  if (category === 'two') return forms.two
  if (category === 'zero') return forms.zero ?? `لا ${forms.many}`

  const noun =
    category === 'few' ? forms.few : category === 'many' ? forms.many : (forms.other ?? forms.many)
  return `${count} ${noun}`
}
