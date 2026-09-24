import { mkdtemp, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { confirmUpload, signUpload } from '@/lib/server/home-media-service'
import { getMedia, resetMediaForTests } from '@/lib/server/media'
import { stagingKey } from '@/lib/server/media/keys'

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures/media', name)))

/**
 * **الرفع المباشر — والحراسةُ كلُّها بعد الرفع لا قبله.**
 *
 * البايتات لا تمرّ بالخادم، فلا يُحكم عليها وقت الكتابة. والثمنُ يُدفع في
 * `confirmUpload`: يُقرأ رأسُ الملفّ من المخزن، ويُحكم عليه، ثمّ يُنقل إلى
 * موضعه. وما لم يُصدَّق **يُمحى من الحجر** ولا يُترك.
 *
 * ويُقاس هنا على محرّك القرص لا على محاكاة: `head` و`readRange` و`move`
 * مكتوبةٌ له فعلًا، فما يُقاس هو المنطق نفسه لا وصفُه.
 */
describe('الرفع المباشر: التوقيع والتصديق', () => {
  const saved = { ...process.env }
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'direct-'))
    process.env.MEDIA_DIR = root
    for (const key of ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
      delete process.env[key]
    }
    resetMediaForTests()
  })
  afterEach(async () => {
    process.env = { ...saved }
    resetMediaForTests()
    await rm(root, { recursive: true, force: true })
  })

  /** يضع ملفًّا في الحجر كما يفعل المتصفّح بالرابط الموقَّع. */
  async function stage(name: string, mime: 'image/png' | 'image/jpeg' | 'video/mp4') {
    const key = stagingKey(mime)
    await getMedia().put(key, fixture(name), mime)
    return key
  }

  /* ------------------------------------------------------------- التوقيع */

  it('محرّكٌ لا يوقّع يردّ `null` — فيرجع العميل إلى الرفع عبر الخادم', async () => {
    const signed = await signUpload({ purpose: 'banner', declaredMime: 'image/png', declaredSize: 1024 })
    expect(signed).toBeNull()
  })

  it('ولا يُوقَّع لنوعٍ غير مدعوم ولا لحجمٍ فوق الحدّ', async () => {
    await expect(
      signUpload({ purpose: 'story', declaredMime: 'image/heic', declaredSize: 1024 }),
    ).rejects.toThrow(/صيغة/)
    await expect(
      signUpload({ purpose: 'story', declaredMime: 'image/png', declaredSize: 99 * 1024 * 1024 }),
    ).rejects.toThrow(/الحدّ/)
    await expect(
      signUpload({ purpose: 'story', declaredMime: 'image/png', declaredSize: 0 }),
    ).rejects.toThrow(/فارغ/)
  })

  /* ------------------------------------------------------------ التصديق */

  it('ما صحّ يُنقل من الحجر إلى موضعه — ولا يبقى له أثرٌ في الحجر', async () => {
    const key = await stage('banner-2x1.png', 'image/png')
    const result = await confirmUpload({ key, purpose: 'banner' })

    expect(result.key).toMatch(/^platform\/images\//)
    expect(result.width).toBeGreaterThan(0)
    /* والحجرُ خلا */
    expect(await getMedia().read(key)).toBeNull()
    /* والموضعُ الجديد فيه البايتات نفسها */
    expect((await getMedia().read(result.key))?.bytes).toEqual(fixture('banner-2x1.png'))
  })

  /*
   * **الحارس الذي يمنع تراكم ما لم يُصدَّق.**
   *
   * ولو سقط لبقي كلُّ ملفٍّ مرفوضٍ في الحاوية إلى أن تكنسه دورةُ الحياة —
   * وهي شبكةُ أمانٍ لما انقطع اتّصالُه، لا بديلٌ عن التنظيف.
   */
  it('وما رُدّ يُمحى من الحجر — لا يُترك لدورة الحياة', async () => {
    const key = await stage('square.png', 'image/png')
    await expect(confirmUpload({ key, purpose: 'banner' })).rejects.toThrow()
    expect(await getMedia().read(key)).toBeNull()
  })

  it('ونسبةُ البنر تُفرض بعد الرفع كما كانت تُفرض قبله', async () => {
    const key = await stage('square.png', 'image/png')
    await expect(confirmUpload({ key, purpose: 'banner' })).rejects.toThrow(/نسبة|مقاس|عرض|١|2/)
  })

  /*
   * **الحارس الذي يمنع أن يُستعمل التصديق مفتاحًا لتحريك ما ليس في الحجر.**
   *
   * ولو سقط لَأمكن أن يُمرَّر `users-files/<غيري>/proof.pdf` فيُنقل إلى
   * `platform/` — أي إلى حاويةٍ يقدّمها نطاقٌ عامّ. وذلك تسريبٌ بمسارٍ
   * مأذونٍ له، لا باختراق.
   */
  it('ولا يُصدَّق إلّا مفتاحُ حجْر — ووثيقةُ مستخدمٍ **قائمة** لا تُنقل ولا تُمحى', async () => {
    /*
     * الملفّ يُكتب فعلًا — وإلّا كان الفحص أجوف.
     *
     * فمفتاحٌ لا ملفَّ له يُردّ على أيّ حال بـ«لم يصل الملفّ»، فيمرّ الفحصُ
     * ولو سقط الحارس. والخطرُ الحقيقيّ أن يُمرَّر مفتاحُ **وثيقةٍ قائمة**
     * لمستخدم، فتُنقل إلى `platform/` — أي إلى حاويةٍ يقدّمها نطاقٌ عامّ.
     * تسريبٌ بمسارٍ مأذونٍ له، لا باختراق.
     */
    const victim = 'users-files/usr_victim/proof.png'
    await getMedia().put(victim, fixture('banner-2x1.png'), 'image/png')

    await expect(confirmUpload({ key: victim, purpose: 'story' })).rejects.toThrow(/مفتاح/)

    /* ولم تُنقل… */
    expect((await getMedia().read(victim))?.bytes).toEqual(fixture('banner-2x1.png'))
    /* …ولم يُخلَق لها موضعٌ عامّ */
    const listed = await getMedia().read('platform/images/proof.png')
    expect(listed).toBeNull()
  })

  it('والمفتاحُ العامُّ القائم كذلك — لا يُعاد تصديقُه فيُضاعَف', async () => {
    const existing = 'platform/images/already.png'
    await getMedia().put(existing, fixture('banner-2x1.png'), 'image/png')
    await expect(confirmUpload({ key: existing, purpose: 'banner' })).rejects.toThrow(/مفتاح/)
    expect(await getMedia().read(existing)).not.toBeNull()
  })

  it('ومفتاحٌ يخرج عن البادئات يُردّ', async () => {
    for (const bad of ['../escape.png', 'staging/../platform/x.png', '/etc/passwd']) {
      await expect(confirmUpload({ key: bad, purpose: 'story' }), bad).rejects.toThrow(/مفتاح/)
    }
  })

  it('ومفتاحٌ لا ملفَّ له يُردّ ولا يُخترع له موضع', async () => {
    await expect(
      confirmUpload({ key: stagingKey('image/png'), purpose: 'story' }),
    ).rejects.toThrow(/لم يصل|فارغ/)
  })

  /*
   * النوعُ يُقاس بالبايتات لا بامتداد المفتاح — وهو الحارس الذي يمنع أن
   * يُرفع HTML إلى مفتاحٍ ينتهي بـ`.png` ثمّ يُقدَّم من نطاقٍ يُوثق به.
   */
  it('وبايتاتٌ لا تطابق امتدادَ المفتاح تُردّ وتُمحى', async () => {
    const key = stagingKey('image/png')
    await getMedia().put(key, new TextEncoder().encode('<html>hi</html>'), 'image/png')
    await expect(confirmUpload({ key, purpose: 'story' })).rejects.toThrow(/صورة/)
    expect(await getMedia().read(key)).toBeNull()
  })
})
