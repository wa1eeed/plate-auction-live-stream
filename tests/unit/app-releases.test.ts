import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildReleaseViews,
  compareVersions,
  fetchAppStoreRelease,
  patchChannel,
  resetAppStoreCacheForTests,
} from '@/lib/server/app-release-service'
import type { AppRelease, AppReleases } from '@/lib/domain/types'

/**
 * **الإصدارُ المنشور — رقمٌ يُقرَّر عليه، فحارسُه آكد.**
 *
 * ومن يقرأ «عند المختبِرين 1.0.6» يقرّر ألّا يبني، أو يقرّر أن يرفع المسار
 * إلى الإنتاج. فرقمٌ خاطئٌ هنا ليس عرضًا مشوَّهًا بل قرارًا مبنيًّا على غير
 * أصل.
 */

const release = (version: string, build: string | null = '12'): AppRelease => ({
  version,
  build,
  at: '2026-10-01T10:00:00.000Z',
  commit: 'abcdef1234567',
})

const releases = (patch: Partial<AppReleases> = {}): AppReleases => ({
  ios: { testing: null, production: null },
  android: { testing: null, production: null },
  updatedAt: '2026-10-01T10:00:00.000Z',
  updatedByAdminId: null,
  ...patch,
})

describe('مقارنةُ النسخ', () => {
  /*
   * والفخُّ معروف: `'1.0.10' < '1.0.9'` نصًّا، فتقول اللوحةُ إنّ العاشرة
   * أقدم من التاسعة — فيُقرأ «الاختبار متأخّرٌ عن الإنتاج» وهو أحدثُ منه.
   */
  it('عددًا لا حرفًا: 1.0.10 أحدثُ من 1.0.9', () => {
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1)
    expect(compareVersions('1.0.9', '1.0.10')).toBe(-1)
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1)
  })

  it('المقاطعُ الناقصةُ أصفار: 1.0 تساوي 1.0.0', () => {
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.1', '1.0')).toBe(1)
  })

  it('لاحقةٌ لا تُسقط المقارنة', () => {
    expect(compareVersions('1.2.0-rc1', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.1-rc1', '1.2.0')).toBe(1)
  })
})

describe('إسنادُ قناةٍ واحدة', () => {
  /*
   * وكتابةُ `{ android: { production: x } }` تمحو `testing` — فيُسجَّل رفعُ
   * الإنتاج فتضيع نسخةُ الاختبار من اللوحة.
   */
  it('لا تمسّ أختَها ولا المنصّةَ الأخرى', () => {
    const before = releases({
      android: { testing: release('1.0.7'), production: release('1.0.6') },
      ios: { testing: release('1.0.7'), production: null },
    })
    const patch = patchChannel(before, 'android', 'production', release('1.0.7'))

    expect(patch.android?.production?.version).toBe('1.0.7')
    expect(patch.android?.testing?.version, 'مُحيت نسخةُ الاختبار').toBe('1.0.7')
    expect(patch.ios, 'مُسّت المنصّةُ الأخرى').toBeUndefined()
  })

  it('`null` يمحو القناةَ وحدها', () => {
    const before = releases({
      android: { testing: release('1.0.7'), production: release('1.0.6') },
    })
    const patch = patchChannel(before, 'android', 'production', null)
    expect(patch.android?.production).toBeNull()
    expect(patch.android?.testing?.version).toBe('1.0.7')
  })
})

describe('صورةُ العرض', () => {
  it('إنتاجُ أبل من متجرها يسبق المسجَّل', () => {
    const views = buildReleaseViews(
      releases({ ios: { testing: null, production: release('1.0.3') } }),
      { ok: true, release: { version: '1.0.6', at: '2026-10-05T08:00:00.000Z' } },
    )
    const ios = views.find((v) => v.platform === 'ios')!
    expect(ios.production?.version).toBe('1.0.6')
    expect(ios.production?.source).toBe('store')
    expect(ios.production?.at).toBe('2026-10-05T08:00:00.000Z')
  })

  it('وبلا ردٍّ من المتجر يُعرض المسجَّلُ موسومًا بيده', () => {
    const views = buildReleaseViews(
      releases({ ios: { testing: null, production: release('1.0.3') } }),
      { ok: false, release: null },
    )
    const ios = views.find((v) => v.platform === 'ios')!
    expect(ios.production?.version).toBe('1.0.3')
    expect(ios.production?.source, 'قُرئ المسجَّلُ كأنّه من المتجر').toBe('manual')
    expect(ios.storeUnreachable).toBe(true)
  })

  it('ولا يقال «تعذّر المتجر» لأندرويد — فلا متجرَ يُسأل', () => {
    const views = buildReleaseViews(releases(), { ok: false, release: null })
    expect(views.find((v) => v.platform === 'android')!.storeUnreachable).toBe(false)
  })

  it('الاختبارُ يُوسَم «من آخر رفعة» لا «من المتجر»', () => {
    const views = buildReleaseViews(
      releases({ android: { testing: release('1.0.7'), production: null } }),
      { ok: true, release: null },
    )
    expect(views.find((v) => v.platform === 'android')!.testing?.source).toBe('upload')
  })

  it('أحدثُ في الاختبار ⇒ ينتظر رفعًا للمسار', () => {
    const views = buildReleaseViews(
      releases({ android: { testing: release('1.0.7'), production: release('1.0.6') } }),
      { ok: true, release: null },
    )
    expect(views.find((v) => v.platform === 'android')!.awaitingPromotion).toBe(true)
  })

  it('ومساواتُهما لا تنتظر شيئًا', () => {
    const views = buildReleaseViews(
      releases({ android: { testing: release('1.0.6'), production: release('1.0.6') } }),
      { ok: true, release: null },
    )
    expect(views.find((v) => v.platform === 'android')!.awaitingPromotion).toBe(false)
  })

  it('اختبارٌ بلا إنتاجٍ ⇒ ينتظر؛ ولا اختبارَ ⇒ لا ينتظر', () => {
    const withTesting = buildReleaseViews(
      releases({ android: { testing: release('0.9.0'), production: null } }),
      { ok: true, release: null },
    )
    expect(withTesting.find((v) => v.platform === 'android')!.awaitingPromotion).toBe(true)

    const empty = buildReleaseViews(releases(), { ok: true, release: null })
    expect(empty.find((v) => v.platform === 'android')!.awaitingPromotion).toBe(false)
  })
})

describe('سؤالُ متجر أبل', () => {
  beforeEach(() => resetAppStoreCacheForTests())
  afterEach(() => vi.unstubAllGlobals())

  const reply = (body: unknown) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))

  it('يقرأ النسخةَ وتاريخَ نشرها', async () => {
    vi.stubGlobal(
      'fetch',
      reply({
        resultCount: 1,
        results: [{ version: '1.0.6', currentVersionReleaseDate: '2026-10-05T08:00:00Z' }],
      }),
    )
    await expect(fetchAppStoreRelease()).resolves.toEqual({
      ok: true,
      release: { version: '1.0.6', at: '2026-10-05T08:00:00Z' },
    })
  })

  it('«لم يُنشر» يُفرَّق من «تعذّر»', async () => {
    vi.stubGlobal('fetch', reply({ resultCount: 0, results: [] }))
    /* سُئل وأُجيب بلا نتيجة — فالسؤالُ نجح والتطبيقُ لم يُنشر */
    await expect(fetchAppStoreRelease()).resolves.toEqual({ ok: true, release: null })

    resetAppStoreCacheForTests()
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('شبكةٌ منقطعة') }))
    await expect(fetchAppStoreRelease()).resolves.toEqual({ ok: false, release: null })
  })

  it('ردٌّ بلا تاريخٍ لا يُعرض نصفَ حقيقة', async () => {
    vi.stubGlobal('fetch', reply({ resultCount: 1, results: [{ version: '1.0.6' }] }))
    await expect(fetchAppStoreRelease()).resolves.toEqual({ ok: true, release: null })
  })

  it('500 من أبل ليس ردًّا', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    await expect(fetchAppStoreRelease()).resolves.toEqual({ ok: false, release: null })
  })

  it('يُسأل مرّةً ويُقرأ من الذاكرة بعدها', async () => {
    const spy = reply({
      resultCount: 1,
      results: [{ version: '1.0.6', currentVersionReleaseDate: '2026-10-05T08:00:00Z' }],
    })
    vi.stubGlobal('fetch', spy)
    await fetchAppStoreRelease()
    await fetchAppStoreRelease()
    await fetchAppStoreRelease()
    expect(spy, 'سُئل المتجرُ في كلّ تحديثِ صفحة').toHaveBeenCalledTimes(1)
  })

  /*
   * **وصفحةٌ تُعلَّق على طرفٍ ثالثٍ ليست صفحة.**
   *
   * وقد وقع مثلُه في فحص التخزين: كتابةٌ لا تنتهي أبقت البوّابة حمراء ثلاث
   * دفعات. والمحاكاةُ هنا خادمٌ يقبل الاتّصال ولا يردّ أبدًا — ولا سبيل إلى
   * ذلك بشبكةٍ حقيقيّة.
   */
  it('خادمٌ لا يردّ: تُقطع المهلةُ ولا تُعلَّق الصفحة', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          }),
      ),
    )
    const started = Date.now()
    await expect(fetchAppStoreRelease()).resolves.toEqual({ ok: false, release: null })
    expect(Date.now() - started, 'المهلةُ أربعٌ لا أكثر').toBeLessThan(8_000)
  }, 15_000)
})
