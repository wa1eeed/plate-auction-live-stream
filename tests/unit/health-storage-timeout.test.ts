import { describe, expect, it, vi } from 'vitest'

/**
 * **فحصُ صحّةٍ يعلّق ليس فحصًا.**
 *
 * وكتابةُ القرص ليست دائمًا سريعةَ الفشل: حجمٌ عبر الشبكة ينقطع، أو قرصٌ
 * يتوقّف، فتبقى `writeFile` معلَّقةً بلا ردّ. فيصمت المسارُ في اللحظة التي
 * يُسأل فيها لأنّ التخزين تعطّل — وهي اللحظةُ التي بُني لها.
 *
 * وليس فرضًا: عُلِّق فعلًا في التكامل المستمرّ بمسارٍ تحت `/proc`، فبقيت
 * البوّابة حمراء ثلاث دفعات ولم يُعرف السبب من ردٍّ لم يأتِ.
 *
 * ويُحاكى هنا محرّكٌ لا تنتهي كتابتُه أبدًا — ولا سبيل إلى ذلك بقرصٍ حقيقيّ.
 */
vi.mock('@/lib/server/media', () => ({
  getMedia: () => ({
    kind: 'disk',
    put: () => new Promise(() => {}),
    read: async () => null,
    remove: async () => {},
    publicUrl: (key: string) => `/api/media/${key}`,
  }),
  resetMediaForTests: () => {},
}))

describe('فحصُ التخزين المعلَّق', () => {
  it('يردّ 503 برمز TIMEOUT ولا ينتظر إلى الأبد', async () => {
    const { GET } = await import('@/app/api/health/storage/route')

    const started = Date.now()
    const response = await GET()
    const body = (await response.json()) as Record<string, unknown>
    const took = Date.now() - started

    expect(response.status).toBe(503)
    expect(body.write).toBe(false)
    expect(body.code).toBe('TIMEOUT')
    // وردٌّ بعد دقيقةٍ لا ينفع من ينتظره: المهلةُ ثلاثٌ، والهامشُ لبطء الآلة
    expect(took).toBeLessThan(6_000)
  }, 15_000)
})
