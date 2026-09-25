import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/storage/route'
import { resetMediaForTests } from '@/lib/server/media'

/**
 * **فحصٌ يقيس ما لا يُقاس من بعيد.**
 *
 * رفعُ الوسائط خلف جلسةِ إدارة، فمن يشخّص من خارج الخادم لا يبلغ مسار
 * الكتابة أصلًا — فلا يُعرف أفي الشبكة العلّةُ أم في القرص. وقد كلّف ذلك
 * يومًا: العطلُ كان في مهلة البوّابة، وطُورد في الكود وفي مخزنٍ خارجيّ.
 */
describe('فحصُ التخزين', () => {
  const saved = { ...process.env }
  let root = ''

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'health-'))
    process.env.MEDIA_DIR = root
    resetMediaForTests()
  })
  afterEach(async () => {
    process.env = { ...saved }
    resetMediaForTests()
    await rm(root, { recursive: true, force: true })
  })

  it('يكتب ويقرأ ويمحو — ويردّ 200', async () => {
    const response = await GET()
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.write).toBe(true)
    expect(body.readBack).toBe(true)
  })

  it('ولا يترك أثرًا بعده', async () => {
    await GET()
    const { getMedia } = await import('@/lib/server/media')
    expect(await getMedia().read('platform/files/health-probe.txt')).toBeNull()
  })

  /*
   * **الحارس الذي يجعل العطل يُنطق.**
   *
   * ولو ردّ 200 على قرصٍ لا يُكتب فيه لكان أسوأ من لا فحص: يُطمئن كاذبًا،
   * فيُطارَد العطل في الشبكة وهو في الصلاحيات.
   */
  it('وقرصٌ لا يُكتب فيه يردّ 503 برمز العطل — لا 200', async () => {
    /*
     * مجلَّدٌ أبوه ملفّ — فـ`ENOTDIR` في كلّ نظام بوسيكس، حالًا وبلا انتظار.
     *
     * وكان المسار `/proc/…`: على ماك لا وجود لـ`/proc` فيفشل سريعًا، وعلى
     * لينكس في التكامل المستمرّ **عُلِّقت الكتابة** فانتهت مهلةُ الاختبار
     * ولم يُقَس شيء. فبقيت البوّابة حمراء ثلاث دفعات.
     */
    const file = join(root, 'ملفّ-لا-مجلَّد')
    await writeFile(file, 'x')
    process.env.MEDIA_DIR = join(file, 'تحته')
    resetMediaForTests()

    const response = await GET()
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(503)
    expect(body.write).toBe(false)
    expect(String(body.code)).toMatch(/EACCES|ENOENT|ENOTDIR|EROFS|UNKNOWN/)
  })

  it('ولا يُفشي مسارًا ولا سرًّا', async () => {
    const body = JSON.stringify(await (await GET()).json())
    expect(body).not.toContain(root)
    expect(body).not.toContain('SESSION')
  })

  /*
   * **ولا يُفشي المسار في العطل خاصّة** — وهناك كان يُفشيه.
   *
   * فنصُّ خطأ العقدة يحمل المسار كاملًا: `ENOENT: … open '/app/data/…'`.
   * وكان يُرسل في `message` على بابٍ بلا جلسة، فيقرأ المتطفّل بنية الخادم
   * من فحصِ صحّةٍ مفتوح. والحالةُ السويّة لا تكشف شيئًا، فلا يُمسك إلّا
   * بقياس العطل نفسه.
   */
  it('ولا في العطل — لا مسارَ ولا نصَّ خطأ', async () => {
    const file = join(root, 'ملفّ-لا-مجلَّد')
    await writeFile(file, 'x')
    process.env.MEDIA_DIR = join(file, 'تحته')
    resetMediaForTests()

    const body = (await (await GET()).json()) as Record<string, unknown>
    expect(body.write).toBe(false)
    expect(JSON.stringify(body)).not.toContain(root)
    expect(body.message, 'نصُّ الخطأ يحمل المسار — لا يُرسل').toBeUndefined()
  })
})
