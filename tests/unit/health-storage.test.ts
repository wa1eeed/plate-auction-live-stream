import { mkdtemp, rm } from 'node:fs/promises'
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
    process.env.MEDIA_DIR = '/proc/غير-موجود/لا-يُكتب'
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
})
