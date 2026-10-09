import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { deleteBanner, deleteStory, updateBanner,
  updateStory,
} from '@/lib/server/home-media-service'
import { getMedia, resetMediaForTests } from '@/lib/server/media'
import { getStore } from '@/lib/store'

const ADMIN = 'adm_test'
const bytes = new Uint8Array([1, 2, 3])

/**
 * **الملفُّ يُرفع من القرص مع صفّه — لا يُترك يتيمًا.**
 *
 * والوسائط تسكن الحجم الدائم، وهو مساحةٌ محدودة تُحاسَب. فبنرٌ يُحذف صفُّه
 * ويبقى ملفُّه يعني أصلًا لا يشير إليه شيء ولا يعرف أحدٌ متى يُمحى — وتتراكم
 * حتى يمتلئ الحجم، فيسقط ما هو أخطر من صورة: كتابةُ الإعدادات نفسها.
 */
describe('تنظيفُ الوسائط عند الحذف', () => {
  const saved = { ...process.env }
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'cleanup-'))
    process.env.MEDIA_DIR = root
    resetMediaForTests()
  })
  afterEach(async () => {
    process.env = { ...saved }
    resetMediaForTests()
    await rm(root, { recursive: true, force: true })
  })

  const exists = async (key: string) => (await getMedia().read(key)) !== null

  it('حذفُ البنر يمحو صورتَه من القرص', async () => {
    const imageKey = 'platform/images/banner-del.png'
    await getMedia().put(imageKey, bytes, 'image/png')
    const row = await getStore().createBanner({
      title: 'للحذف', imageKey, width: 1200, height: 600, alt: 'إعلان',
      linkUrl: null, sortOrder: 0, published: true, startsAt: null, endsAt: null,
    })
    expect(await exists(imageKey)).toBe(true)

    await deleteBanner(row.id, ADMIN)

    expect(await exists(imageKey)).toBe(false)
    expect(await getStore().getBanner(row.id)).toBeNull()
  })

  it('وحذفُ الستوري يمحو الوسيطة **والغلاف** معًا', async () => {
    const mediaKey = 'platform/videos/story-del.mp4'
    const posterKey = 'platform/images/poster-del.png'
    await getMedia().put(mediaKey, bytes, 'video/mp4')
    await getMedia().put(posterKey, bytes, 'image/png')
    const row = await getStore().createStory({
      title: 'للحذف',
      slides: [
        { id: 's1', mediaKey, mediaKind: 'video', posterKey, alt: 'حلقة', durationSeconds: 5 },
      ],
      linkUrl: null, sortOrder: 0, published: true, startsAt: null, endsAt: null,
    })

    await deleteStory(row.id, ADMIN)

    expect(await exists(mediaKey)).toBe(false)
    expect(await exists(posterKey)).toBe(false)
  })

  /*
   * **وشريحةٌ خرجت من الستوري تُمحى، وما بقي يبقى.**
   *
   * ولا يُقاس بشريحةٍ شريحة: المحرّرُ قد يُعيد ترتيبَها أو يستبدل واحدةً في
   * موضعها. فلو قِيس بالموضع لَمُحي ملفٌّ ما زال مستعملًا — وهو فقدٌ لا
   * يُسترجع، إذ لا نسخةَ ثانية منه.
   */
  it('وحذفُ **الشريحة الأولى** يمحو ملفَّها لا ملفَّ التي بعدها', async () => {
    const goes = 'platform/images/slide-goes.png'
    const stays = 'platform/images/slide-stays.png'
    await getMedia().put(stays, bytes, 'image/png')
    await getMedia().put(goes, bytes, 'image/png')
    const row = await getStore().createStory({
      title: 'شريحتان',
      slides: [
        { id: 's1', mediaKey: goes, mediaKind: 'image', posterKey: null, alt: 'تخرج', durationSeconds: 5 },
        { id: 's2', mediaKey: stays, mediaKind: 'image', posterKey: null, alt: 'تبقى', durationSeconds: 5 },
      ],
      linkUrl: null, sortOrder: 0, published: true, startsAt: null, endsAt: null,
    })

    /*
     * تُحذف **الأولى** لا الأخيرة — وهنا يفترق القياسان.
     *
     * فتنظيفٌ بالموضع يرى أنّ الموضع الثاني شغر، فيمحو ملفَّ الشريحة التي
     * كانت فيه — وهي الباقية. ويرى الأوّلَ مشغولًا فيُبقي ملفَّ الخارجة.
     * فيُمحى المستعمَلُ ويبقى اليتيم، مقلوبًا تمامًا.
     */
    await updateStory(
      row.id,
      {
        slides: [
          { id: 's2', mediaKey: stays, mediaKind: 'image', posterKey: null, alt: 'تبقى', durationSeconds: 5 },
        ],
      },
      ADMIN,
    )

    expect(await exists(goes), 'شريحةٌ خرجت وبقي ملفُّها').toBe(false)
    expect(await exists(stays), 'مُحي ملفٌّ ما زال مستعملًا').toBe(true)
  })

  /*
   * والاستبدالُ حذفٌ أيضًا — وإلّا تراكمت النسخُ القديمة بلا صفٍّ يدلّ عليها.
   * ولوحةٌ تُجرَّب فيها عشرُ صورٍ قبل الرضا تترك تسعًا.
   */
  it('واستبدالُ صورة البنر يمحو القديمة ويُبقي الجديدة', async () => {
    const oldKey = 'platform/images/old.png'
    const newKey = 'platform/images/new.png'
    await getMedia().put(oldKey, bytes, 'image/png')
    await getMedia().put(newKey, bytes, 'image/png')
    const row = await getStore().createBanner({
      title: 'للاستبدال', imageKey: oldKey, width: 1200, height: 600, alt: 'إعلان',
      linkUrl: null, sortOrder: 0, published: true, startsAt: null, endsAt: null,
    })

    await updateBanner(row.id, { imageKey: newKey, width: 1200, height: 600 }, ADMIN)

    expect(await exists(oldKey)).toBe(false)
    expect(await exists(newKey)).toBe(true)
  })

  /*
   * وحذفُ صفٍّ يشير إلى ملفٍّ مفقود لا يسقط — فقد يكون مُحي بيدٍ من قبل،
   * أو ضاع مع نشرةٍ قبل أن يُربط الحجم الدائم. والصفُّ يُرفع على أيّ حال.
   */
  it('وصفٌّ بملفٍّ مفقود يُحذف ولا يرمي', async () => {
    const row = await getStore().createBanner({
      title: 'بلا ملفّ', imageKey: 'platform/images/ghost.png', width: 1200, height: 600,
      alt: 'إعلان', linkUrl: null, sortOrder: 0, published: true, startsAt: null, endsAt: null,
    })
    await expect(deleteBanner(row.id, ADMIN)).resolves.toBeUndefined()
    expect(await getStore().getBanner(row.id)).toBeNull()
  })
})
