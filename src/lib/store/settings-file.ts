import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { MemoryDatabase } from './memory-store'

/**
 * ما تضبطه الإدارة يبقى بعد إعادة النشر.
 *
 * المخزن في الذاكرة، فكلّ نشرةٍ جديدة تبدأ من البذرة: يُبدَّل اسم المنصّة
 * ولونها وشعارها، وتُكتب صفحاتها، وتُضبط عمولتها وبوابات دفعها — ثمّ يعود
 * ذلك كلّه افتراضيًّا لأنّ العملية أُعيد تشغيلها. وهو ما لا يُكتشف إلّا بعد
 * النشر، فيُظنّ الحفظُ نفسه معطّلًا.
 *
 * والمحفوظ هنا **ما تضبطه الإدارة وحده**: الهويّة والصفحات والأسئلة وقواعد
 * التداول والعمولة والدفع والضريبة. أمّا المستخدمون والإعلانات والصفقات
 * فبيانات تشغيل تُولَد من البذرة، وحفظها في ملفٍّ يجعله قاعدة بيانات ناقصة
 * لا ملفَّ إعدادات — وذلك عملٌ آخر بأدواته.
 *
 * والكتابة ذرّية: يُكتب ملفٌّ مؤقّت ثمّ يُنقل مكانه، فانقطاعٌ في أثناء الكتابة
 * لا يترك ملفًّا نصفَ مكتوب يُسقط الإقلاع التالي.
 */

/** الشرائح المحفوظة — مفاتيحها أسماء الحقول في قاعدة الذاكرة نفسها. */
const SLICES = [
  'brandSettings',
  'pageSettings',
  'auctionSettings',
  'commissionSettings',
  'paymentSettings',
  'taxSettings',
  'faq',
] as const

type Slice = (typeof SLICES)[number]
type Snapshot = Partial<Pick<MemoryDatabase, Slice>> & { version?: number }

const VERSION = 1

/**
 * موضع الملفّ — يُضبط بـ`PLATFORM_DATA_DIR`.
 *
 * وبلا ضبطٍ لا حفظ: في التطوير والاختبار لا نريد ملفًّا يعيش بين التشغيلات
 * فيُفسد بذرةً يُعتمد عليها، ولا نريد كتابةً في مسارٍ لم يختره أحد. ومن أراد
 * الثبات على الخادم يضبط المتغيّر ويربط به مجلّدًا دائمًا.
 */
function dataDir(): string | null {
  const dir = process.env.PLATFORM_DATA_DIR?.trim()
  return dir ? dir : null
}

function filePath(dir: string): string {
  return join(dir, 'settings.json')
}

/** يقرأ المحفوظ إن وُجد — وأيّ خللٍ فيه يُتجاهل ولا يُسقط الإقلاع. */
export function readSettingsFile(): Snapshot | null {
  const dir = dataDir()
  if (!dir) return null
  try {
    const path = filePath(dir)
    if (!existsSync(path)) return null
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Snapshot
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    // ملفٌّ تالف أو غير مقروء: تُستعمل البذرة، ويُكتب فوقه عند أوّل حفظ
    return null
  }
}

/**
 * يُلبس قاعدةَ البذرة ما حُفظ سابقًا.
 *
 * والدمج بالشريحة لا بالحقل: شريحةٌ محفوظة تحلّ محلّ نظيرتها كاملةً. ولو
 * دُمجت حقلًا حقلًا لبقيت حقولٌ حُذفت من الإعدادات حيّةً في الملفّ إلى الأبد.
 * وما لم يُحفظ يبقى على بذرته — فحقلٌ جديد في نسخةٍ جديدة يأخذ افتراضيَّه.
 */
export function applySettingsFile(db: MemoryDatabase): boolean {
  const snapshot = readSettingsFile()
  if (!snapshot) return false

  let applied = false
  for (const slice of SLICES) {
    const value = snapshot[slice]
    if (value === undefined || value === null) continue
    // الأسئلة مصفوفة والبقيّة كائنات — يُحرس النوع فلا يُكتب شكلٌ غير متوقّع
    const wanted = slice === 'faq' ? Array.isArray(value) : typeof value === 'object'
    if (!wanted) continue
    if (slice === 'faq') {
      db.faq = value as MemoryDatabase['faq']
    } else {
      Object.assign(db[slice] as object, value as object)
    }
    applied = true
  }
  return applied
}

/** يكتب الشرائح المضبوطة. يفشل بصمت: تعذّر الحفظ لا يُسقط طلبًا نجح. */
export function writeSettingsFile(db: MemoryDatabase): void {
  const dir = dataDir()
  if (!dir) return
  try {
    const path = filePath(dir)
    mkdirSync(dirname(path), { recursive: true })
    const snapshot: Snapshot = { version: VERSION }
    for (const slice of SLICES) snapshot[slice] = db[slice] as never
    const temporary = `${path}.tmp`
    writeFileSync(temporary, JSON.stringify(snapshot), 'utf8')
    renameSync(temporary, path)
  } catch {
    // قرصٌ ممتلئ أو مسارٌ بلا صلاحية — يبقى الضبط في الذاكرة لهذه النشرة
  }
}

/** هل الحفظ مُفعَّل؟ — تُقرأ في الإدارة ليُقال لمن يضبط أيبقى ضبطه أم لا. */
export function settingsPersisted(): boolean {
  return dataDir() !== null
}
