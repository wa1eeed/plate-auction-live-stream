import { statSync } from 'node:fs'
import { getMedia } from '@/lib/server/media'

export const dynamic = 'force-dynamic'

/** مفتاحٌ ثابت — يُكتب ويُقرأ ويُمحى، فلا يتراكم شيء. */
const PROBE_KEY = 'platform/files/health-probe.txt'

/**
 * فحصُ التخزين — **يقيس ما لا يُقاس من خارج الخادم**.
 *
 * ورفعُ الوسائط يفشل أحيانًا بلا أن يُعرف أفي الشبكة العلّةُ أم في القرص:
 * الطلبُ يحتاج جلسةَ إدارة، فلا يستطيع من يشخّص من بعيد أن يبلغ مسار
 * الكتابة أصلًا. فهذا المسار يمرّ به **بلا جلسة وبلا بيانات**: يكتب بضعة
 * بايتات ويقرؤها ويمحوها، ويقول ما وقع.
 *
 * وما يُفشى منه محدودٌ عمدًا: أنجح أم لا، ورمزُ الخطأ (`EACCES`, `ENOSPC`)،
 * وأمربوطٌ المجلَّد بحجمٍ دائم. ولا يُذكر مسارٌ ولا سرٌّ ولا محتوى.
 */
export async function GET() {
  const started = Date.now()
  const media = getMedia()
  const result: Record<string, unknown> = { driver: media.kind }

  /* أحجمٌ دائمٌ هو المجلَّد أم يموت مع الحاوية؟ */
  const dataDir = process.env.PLATFORM_DATA_DIR?.trim()
  if (dataDir) {
    try {
      result.persistentVolume = statSync(dataDir).dev !== statSync('/').dev
    } catch (error) {
      result.persistentVolume = `تعذّر الفحص: ${(error as { code?: string })?.code ?? 'غير معروف'}`
    }
  } else {
    result.persistentVolume = 'PLATFORM_DATA_DIR غير مضبوط'
  }

  try {
    const bytes = new TextEncoder().encode('probe')
    await media.put(PROBE_KEY, bytes, 'text/plain')
    const read = await media.read(PROBE_KEY)
    await media.remove(PROBE_KEY)

    result.write = true
    result.readBack = read?.bytes.byteLength === bytes.byteLength
  } catch (error) {
    const named = error as { code?: string; message?: string }
    result.write = false
    result.code = named?.code ?? 'UNKNOWN'
    result.message = named?.message ?? String(error)
  }

  result.ms = Date.now() - started
  return Response.json(result, {
    status: result.write === true ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
