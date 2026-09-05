import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { emptyDatabase, MemoryStore, type MemoryDatabase } from '@/lib/store/memory-store'
import { seedDatabase } from '@/lib/store/seed'
import {
  applySettingsFile,
  settingsPersisted,
  writeSettingsFile,
} from '@/lib/store/settings-file'

let dir: string
let db: MemoryDatabase

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'plate-settings-'))
  process.env.PLATFORM_DATA_DIR = dir
  db = emptyDatabase()
  seedDatabase(db)
})

afterEach(() => {
  delete process.env.PLATFORM_DATA_DIR
  rmSync(dir, { recursive: true, force: true })
})

describe('ثبات الإعدادات بين النشرات', () => {
  it('بلا مجلّد مضبوط لا يُكتب شيء', () => {
    delete process.env.PLATFORM_DATA_DIR
    expect(settingsPersisted()).toBe(false)
    writeSettingsFile(db)
    expect(existsSync(join(dir, 'settings.json'))).toBe(false)
  })

  it('ما تضبطه الإدارة يعود بعد إعادة الإقلاع', async () => {
    const store = new MemoryStore(db).onSettingsChange(writeSettingsFile)
    await store.updateBrandSettings({ name: 'سوق نجد', primaryColor: '#123456' })
    await store.updatePageSettings({ about: { ...db.pageSettings.about, title: 'عنّا' } })
    await store.updateCommissionSettings({ vatEnabled: true, vatPercent: 15 })

    // نشرةٌ جديدة: قاعدةٌ من البذرة ثمّ المحفوظ فوقها
    const fresh = emptyDatabase()
    seedDatabase(fresh)
    expect(fresh.brandSettings.name).not.toBe('سوق نجد')
    expect(applySettingsFile(fresh)).toBe(true)

    expect(fresh.brandSettings.name).toBe('سوق نجد')
    expect(fresh.brandSettings.primaryColor).toBe('#123456')
    expect(fresh.pageSettings.about.title).toBe('عنّا')
    expect(fresh.commissionSettings.vatEnabled).toBe(true)
  })

  it('والأسئلة الشائعة معها — تُحرَّر من الإدارة كالإعدادات', async () => {
    const store = new MemoryStore(db).onSettingsChange(writeSettingsFile)
    await store.createFaq({
      question: 'هل يبقى ضبطي؟',
      answer: 'نعم، ما دام المجلّد دائمًا.',
      category: 'general',
      sortOrder: 99,
      published: true,
      showOnSaleTypes: [],
    })

    const fresh = emptyDatabase()
    seedDatabase(fresh)
    applySettingsFile(fresh)
    expect(fresh.faq.some((item) => item.question === 'هل يبقى ضبطي؟')).toBe(true)
  })

  /*
   * بيانات التشغيل لا تُحفظ.
   *
   * الملفّ ملفُّ إعدادات لا قاعدة بيانات: حفظُ المستخدمين والإعلانات فيه
   * يجعله نصفَ قاعدة — يحمل الحالة ولا يحمل تسلسلها ولا يُقفل عند الكتابة
   * المتزامنة.
   */
  it('المستخدمون والإعلانات تبقى من البذرة', async () => {
    const store = new MemoryStore(db).onSettingsChange(writeSettingsFile)
    await store.updateBrandSettings({ name: 'أيّ اسم' })
    const saved = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
    expect(Object.keys(saved)).not.toContain('users')
    expect(Object.keys(saved)).not.toContain('listings')
    expect(Object.keys(saved)).not.toContain('orders')
  })

  it('ملفٌّ تالف يُتجاهل ولا يُسقط الإقلاع', () => {
    writeFileSync(join(dir, 'settings.json'), '{ ليس جيسون', 'utf8')
    const fresh = emptyDatabase()
    seedDatabase(fresh)
    expect(() => applySettingsFile(fresh)).not.toThrow()
    expect(applySettingsFile(fresh)).toBe(false)
    // ويبقى على بذرته فتعمل المنصّة بافتراضيّاتها
    expect(fresh.brandSettings.name.length).toBeGreaterThan(0)
  })

  /*
   * حقلٌ أُضيف بعد الحفظ يأخذ افتراضيَّه.
   *
   * الملفّ يُكتب بنسخةٍ ويُقرأ بأخرى، فلو حلّ محلّ الشريحة كاملةً لخرجت
   * الحقول الجديدة `undefined` وسقطت الصفحات التي تقرؤها.
   */
  it('نسخةٌ أقدم من الملفّ لا تُفرِغ حقلًا جديدًا', () => {
    writeFileSync(
      join(dir, 'settings.json'),
      JSON.stringify({ version: 1, brandSettings: { name: 'قديم' } }),
      'utf8',
    )
    const fresh = emptyDatabase()
    seedDatabase(fresh)
    applySettingsFile(fresh)
    expect(fresh.brandSettings.name).toBe('قديم')
    expect(fresh.brandSettings.primaryColor).toMatch(/^#/)
    expect(fresh.brandSettings.metaTitle.length).toBeGreaterThan(0)
  })
})
