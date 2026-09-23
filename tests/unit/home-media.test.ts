import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryStore } from '@/lib/store/memory-store'
import { isLive, type LiveWindow } from '@/lib/domain/types'

const AT = Date.parse('2026-09-24T12:00:00.000Z')
const hours = (n: number) => new Date(AT + n * 3_600_000).toISOString()

const banner = (over: Partial<Parameters<MemoryStore['createBanner']>[0]> = {}) => ({
  title: 'إعلان',
  imageKey: 'platform/images/a.png',
  width: 1200,
  height: 600,
  alt: 'إعلان ترويجيّ',
  linkUrl: null,
  sortOrder: 0,
  published: true,
  startsAt: null,
  endsAt: null,
  ...over,
})

describe('نافذة الظهور', () => {
  const window = (over: Partial<LiveWindow>): LiveWindow => ({
    published: true,
    startsAt: null,
    endsAt: null,
    ...over,
  })

  it('المنشورُ بلا حدّين يُعرض دائمًا', () => {
    expect(isLive(window({}), AT)).toBe(true)
  })

  it('وغيرُ المنشور لا يُعرض ولو كانت مدّته قائمة', () => {
    expect(isLive(window({ published: false }), AT)).toBe(false)
    expect(isLive(window({ published: false, endsAt: hours(10) }), AT)).toBe(false)
  })

  it('ما لم يبدأ بعد لا يُعرض، وما انتهى لا يُعرض', () => {
    expect(isLive(window({ startsAt: hours(1) }), AT)).toBe(false)
    expect(isLive(window({ endsAt: hours(-1) }), AT)).toBe(false)
  })

  /*
   * الحدّان يُقاسان عند حافّتهما بالضبط.
   *
   * وهو موضعُ الغلط المعتاد: `>=` مكان `>` تُبقي إعلانًا منتهيًا ظاهرًا
   * ثانيةً كاملة، أو تُخفي إعلانًا بدأ لتوّه.
   */
  it('عند الحافّة: لحظةُ البدء تُعرض، ولحظةُ الانتهاء لا', () => {
    expect(isLive(window({ startsAt: new Date(AT).toISOString() }), AT)).toBe(true)
    expect(isLive(window({ endsAt: new Date(AT).toISOString() }), AT)).toBe(false)
    expect(isLive(window({ endsAt: new Date(AT + 1).toISOString() }), AT)).toBe(true)
  })
})

describe('البنرات في المخزَن', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  it('القائمة بلا `liveAt` تعرض كلَّ شيء — وهي قائمة الإدارة', async () => {
    await store.createBanner(banner({ published: false }))
    await store.createBanner(banner({ endsAt: hours(-1) }))
    expect(await store.listBanners()).toHaveLength(2)
  })

  it('وبـ`liveAt` لا يغادر الخادمَ إلّا ما يُعرض', async () => {
    const shown = await store.createBanner(banner({ title: 'قائم' }))
    await store.createBanner(banner({ title: 'مسودّة', published: false }))
    await store.createBanner(banner({ title: 'انتهى', endsAt: hours(-1) }))
    await store.createBanner(banner({ title: 'لم يبدأ', startsAt: hours(3) }))

    const live = await store.listBanners({ liveAt: AT })
    expect(live.map((row) => row.id)).toEqual([shown.id])
  })

  it('`sortOrder` يحكم أوّلًا', async () => {
    const last = await store.createBanner(banner({ title: 'أ', sortOrder: 2 }))
    const first = await store.createBanner(banner({ title: 'ب', sortOrder: 0 }))
    const middle = await store.createBanner(banner({ title: 'ج', sortOrder: 1 }))

    expect((await store.listBanners({ liveAt: AT })).map((row) => row.id)).toEqual([
      first.id,
      middle.id,
      last.id,
    ])
  })

  it('وعند تساويه: الأحدث أوّلًا', async () => {
    const older = await store.createBanner(banner({ title: 'قديم' }))
    await new Promise((resolve) => setTimeout(resolve, 5))
    const newer = await store.createBanner(banner({ title: 'جديد' }))

    expect((await store.listBanners({ liveAt: AT })).map((row) => row.id)).toEqual([
      newer.id,
      older.id,
    ])
  })

  /*
   * **الحسم عند تساوي الترتيب واللحظة معًا.**
   *
   * عشرةُ بنراتٍ تُدخَل في الطلب نفسه تحمل `createdAt` واحدًا بدقّة الملّي،
   * فبلا مكسِّرٍ ثالثٍ يسقط الحسم إلى استقرار الفرز في الذاكرة وإلى خطّة
   * التنفيذ في بوستجرس — فيختلف ترتيب الصفحة بين طلبين بلا سببٍ يُرى.
   */
  it('وعند تساويهما معًا يحسم المعرّف — فالترتيب لا يتبدّل بين طلبين', async () => {
    const created = await Promise.all(
      ['أ', 'ب', 'ج', 'د', 'هـ'].map((title) => store.createBanner(banner({ title }))),
    )
    const sameMillisecond = new Set(created.map((row) => row.createdAt)).size === 1

    const first = (await store.listBanners({ liveAt: AT })).map((row) => row.id)
    const second = (await store.listBanners({ liveAt: AT })).map((row) => row.id)

    expect(first).toEqual(second)
    // وإن وقعت كلُّها في ملّيّ واحدٍ فعلًا، فالمعرّف وحده هو ما رتّبها
    if (sameMillisecond) expect(first).toEqual([...first].sort())
  })

  it('التعديل يمسّ ما مُرّر وحده، والمعرّف لا يُبدَّل', async () => {
    const row = await store.createBanner(banner())
    const patched = await store.updateBanner(row.id, { published: false })

    expect(patched.id).toBe(row.id)
    expect(patched.published).toBe(false)
    expect(patched.imageKey).toBe(row.imageKey)
    expect(patched.updatedAt >= row.updatedAt).toBe(true)
  })

  it('والحذف يرفعه من القائمة', async () => {
    const row = await store.createBanner(banner())
    await store.deleteBanner(row.id)
    expect(await store.getBanner(row.id)).toBeNull()
    expect(await store.listBanners()).toHaveLength(0)
  })

  it('تعديلُ ما لا وجود له يرمي — لا يُنشئ صفًّا جديدًا صامتًا', async () => {
    await expect(store.updateBanner('bnr_missing', { published: true })).rejects.toThrow()
  })
})

describe('الستوريز في المخزَن', () => {
  it('تُرشَّح بالنافذة نفسها، والفدّيو يحمل غلافه', async () => {
    const store = new MemoryStore()
    const video = await store.createStory({
      title: 'جولة',
      mediaKey: 'platform/videos/a.mp4',
      mediaKind: 'video',
      posterKey: 'platform/images/a.png',
      alt: 'جولة في المنصّة',
      linkUrl: null,
      durationSeconds: 6,
      sortOrder: 0,
      published: true,
      startsAt: null,
      endsAt: null,
    })
    await store.createStory({
      title: 'منتهٍ',
      mediaKey: 'platform/images/b.png',
      mediaKind: 'image',
      posterKey: null,
      alt: 'ب',
      linkUrl: null,
      durationSeconds: 6,
      sortOrder: 0,
      published: true,
      startsAt: null,
      endsAt: hours(-1),
    })

    const live = await store.listStories({ liveAt: AT })
    expect(live).toHaveLength(1)
    expect(live[0]!.id).toBe(video.id)
    expect(live[0]!.posterKey).toBe('platform/images/a.png')
  })
})
