import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppReleases } from '@/lib/domain/types'
import { DEMO_ADMIN } from '@/lib/config'
import { getStore } from '@/lib/store'

/**
 * **بابُ تبليغ الإصدارات — مسارٌ يكتب، فيُسأل عن إذنه أوّلًا.**
 *
 * ولا يُنادى من داخل الخادم كمسح المزادات، بل من سير بناءٍ في السحابة عبر
 * الشبكة العامّة. فما يحرسه سرٌّ خاصٌّ به، ويُغلق إن لم يُضبط.
 */

/* الجلسةُ تُزوّر هنا لا تُنشأ: ما يُختبر أثرُ المسار لا توقيعُ الكوكي */
const session = vi.hoisted(() => ({ adminId: null as string | null }))
vi.mock('@/lib/server/admin-session', () => ({
  readAdminSession: async () =>
    session.adminId ? { adminId: session.adminId, email: 'a@b.c' } : null,
}))

/*
 * وسرُّ الترويسة لاتينيٌّ بالضرورة: ترويساتُ HTTP بايتاتٌ من 255 فما دون،
 * فسرٌّ بحروفٍ عربيّةٍ لا يُرسل أصلًا — يسقط عند بناء الطلب لا عند فحصه.
 */
const SECRET = 'test-release-secret-9f3a'

async function seedChannel(patch: Partial<Pick<AppReleases, 'ios' | 'android'>>) {
  await getStore().updateAppReleases(patch, null)
}

async function reset() {
  await getStore().updateAppReleases(
    { ios: { testing: null, production: null }, android: { testing: null, production: null } },
    null,
  )
}

/** يُعاد تحميل الوحدةُ لأنّ السرَّ يُقرأ مرّةً عند تحميلها. */
async function loadInternalRoute(secret: string | undefined) {
  vi.resetModules()
  if (secret === undefined) delete process.env.RELEASE_REPORT_SECRET
  else process.env.RELEASE_REPORT_SECRET = secret
  return (await import('@/app/api/internal/app-release/route')).POST
}

const report = (body: unknown, header?: string) =>
  new Request('http://localhost/api/internal/app-release', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(header === undefined ? {} : { 'x-release-report': header }),
    },
    body: JSON.stringify(body),
  })

const upload = {
  platform: 'ios',
  channel: 'testing',
  version: '1.0.6',
  build: '42',
  commit: 'abcdef1234567',
}

beforeEach(reset)
afterEach(() => {
  delete process.env.RELEASE_REPORT_SECRET
  session.adminId = null
})

describe('تبليغُ السير بالإصدار', () => {
  /*
   * **ومسارٌ من الشبكة بسرٍّ افتراضيٍّ معروفٍ بابٌ مفتوح.**
   *
   * والمسحُ يسقط إلى `development-only-insecure-secret` لأنّ من ينادِيه
   * عمليّةُ الخادم نفسُها على الحلقة المحلّية. وهذا يُنادى من جيت هب — فلو
   * سقط إلى مثله لكتب أيُّ أحدٍ أرقامَ إصدارات المنصّة. فيُغلق.
   */
  it('بلا سرٍّ مضبوط: مغلقٌ لا مفتوحٌ بافتراضيّ', async () => {
    const POST = await loadInternalRoute(undefined)
    const response = await POST(report(upload, 'development-only-insecure-secret'))
    expect(response.status).toBe(503)
    expect((await response.json()).error.code).toBe('RELEASE_REPORT_DISABLED')
    expect((await getStore().getAppReleases()).ios.testing).toBeNull()
  })

  it('سرٌّ خاطئ أو غائب: 403 ولا يُكتب شيء', async () => {
    const POST = await loadInternalRoute(SECRET)
    for (const header of ['wrong-secret', undefined]) {
      const response = await POST(report(upload, header))
      expect(response.status).toBe(403)
    }
    expect((await getStore().getAppReleases()).ios.testing).toBeNull()
  })

  it('بالسرّ يُسجَّل الرقمُ والبناءُ والدفعة', async () => {
    const POST = await loadInternalRoute(SECRET)
    const response = await POST(report(upload, SECRET))
    expect(response.status).toBe(200)

    const stored = (await getStore().getAppReleases()).ios.testing
    expect(stored?.version).toBe('1.0.6')
    expect(stored?.build).toBe('42')
    expect(stored?.commit).toBe('abcdef1234567')
    /* اللحظةُ من الخادم لا من الطالب: سيرٌ بساعةٍ مغلوطةٍ لا يُزيّف تاريخًا */
    expect(Date.now() - new Date(stored!.at).getTime()).toBeLessThan(5_000)
  })

  it('ولا يمسّ المنصّةَ الأخرى ولا القناةَ الأخرى', async () => {
    const POST = await loadInternalRoute(SECRET)
    await seedChannel({
      android: {
        testing: { version: '2.0.0', build: '9', at: '2026-01-01T00:00:00.000Z', commit: null },
        production: null,
      },
    })
    await POST(report(upload, SECRET))

    const all = await getStore().getAppReleases()
    expect(all.android.testing?.version).toBe('2.0.0')
    expect(all.ios.production).toBeNull()
  })

  /*
   * **وإعادةُ بناءٍ على وسمٍ قديمٍ لا تُنزل الرقمَ المعروض.**
   *
   * ويُعاد السيرُ على وسمٍ قديم: لتجربةِ تغييرٍ فيه، أو لبناءٍ سقط فأُعيد.
   * فيبلّغ `1.0.3` بعد `1.0.6` — فتقول اللوحةُ إنّ عند المختبِرين نسخةً
   * تركوها منذ أسبوع، فيُبنى ما هو مبنيٌّ ويُرفع ما هو مرفوع.
   */
  it('أقدمُ من المسجَّل: 409 ويبقى المسجَّل', async () => {
    const POST = await loadInternalRoute(SECRET)
    await POST(report(upload, SECRET))

    const response = await POST(report({ ...upload, version: '1.0.3', build: '99' }, SECRET))
    expect(response.status).toBe(409)
    expect((await response.json()).error.code).toBe('RELEASE_OLDER')

    const stored = (await getStore().getAppReleases()).ios.testing
    expect(stored?.version, 'نُزّل الرقمُ المعروض إلى أقدمَ منه').toBe('1.0.6')
    expect(stored?.build).toBe('42')
  })

  it('و`force` يكتبها — لمن أراد التنزيل عن قصد', async () => {
    const POST = await loadInternalRoute(SECRET)
    await POST(report(upload, SECRET))
    const response = await POST(report({ ...upload, version: '1.0.3', force: true }, SECRET))
    expect(response.status).toBe(200)
    expect((await getStore().getAppReleases()).ios.testing?.version).toBe('1.0.3')
  })

  it('ونسخةٌ مساويةٌ ببناءٍ أحدث تُقبل — فهي ما يصل المختبِرين', async () => {
    const POST = await loadInternalRoute(SECRET)
    await POST(report(upload, SECRET))
    const response = await POST(report({ ...upload, build: '43' }, SECRET))
    expect(response.status).toBe(200)
    expect((await getStore().getAppReleases()).ios.testing?.build).toBe('43')
  })

  it('رقمٌ غير مقروء يُردّ قبل أن يُكتب', async () => {
    const POST = await loadInternalRoute(SECRET)
    const response = await POST(report({ ...upload, version: 'latest' }, SECRET))
    expect(response.status).toBe(422)
    expect((await getStore().getAppReleases()).ios.testing).toBeNull()
  })
})

describe('إثباتُ النشر من اللوحة', () => {
  async function loadAdminRoute() {
    vi.resetModules()
    return (await import('@/app/api/admin/settings/app-releases/route')).PATCH
  }

  const patch = (body: unknown) =>
    new Request('http://localhost/api/admin/settings/app-releases', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('بلا جلسةِ إدارةٍ: لا يُكتب', async () => {
    session.adminId = null
    const PATCH = await loadAdminRoute()
    const response = await PATCH(patch({ platform: 'android', channel: 'production', release: { version: '1.0.6' } }))
    expect(response.status).toBe(401)
    expect((await getStore().getAppReleases()).android.production).toBeNull()
  })

  it('يُثبت نسخةَ الإنتاج ويُنسب الإثباتُ إلى من أثبته', async () => {
    const store = getStore()
    const admin = (await store.findAdminByEmail(DEMO_ADMIN.email))!
    session.adminId = admin.id

    const PATCH = await loadAdminRoute()
    const response = await PATCH(
      patch({ platform: 'android', channel: 'production', release: { version: '1.0.6', build: '42' } }),
    )
    expect(response.status).toBe(200)

    const all = await store.getAppReleases()
    expect(all.android.production?.version).toBe('1.0.6')
    expect(all.updatedByAdminId).toBe(admin.id)
  })

  it('و`null` يمحو ما أُثبت خطأً', async () => {
    const store = getStore()
    session.adminId = (await store.findAdminByEmail(DEMO_ADMIN.email))!.id
    await seedChannel({
      android: {
        testing: { version: '1.0.7', build: '43', at: '2026-10-01T00:00:00.000Z', commit: null },
        production: { version: '1.0.6', build: '42', at: '2026-10-01T00:00:00.000Z', commit: null },
      },
    })

    const PATCH = await loadAdminRoute()
    const response = await PATCH(patch({ platform: 'android', channel: 'production', release: null }))
    expect(response.status).toBe(200)

    const all = await store.getAppReleases()
    expect(all.android.production).toBeNull()
    expect(all.android.testing?.version, 'مُحيت القناةُ الأخرى معها').toBe('1.0.7')
  })
})
