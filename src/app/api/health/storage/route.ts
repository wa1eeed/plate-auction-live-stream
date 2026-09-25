import { statSync } from 'node:fs'
import { getMedia } from '@/lib/server/media'

export const dynamic = 'force-dynamic'

/** مفتاحٌ ثابت — يُكتب ويُقرأ ويُمحى، فلا يتراكم شيء. */
const PROBE_KEY = 'platform/files/health-probe.txt'

/** مهلةُ الفحص — بعدها يُقال «معلَّق» ولا يُنتظر أكثر. */
const PROBE_TIMEOUT_MS = 3_000

/**
 * حدٌّ زمنيٌّ للفحص — **وفحصُ صحّةٍ يعلّق ليس فحصًا**.
 *
 * وكتابةُ القرص ليست دائمًا سريعةَ الفشل: حجمٌ عبر الشبكة ينقطع، أو قرصٌ
 * يتوقّف، فتبقى `writeFile` معلَّقةً بلا ردّ — فلا يردّ المسار شيئًا في
 * اللحظة التي يُسأل فيها لأنّ التخزين تعطّل. وهو المقصودُ منه بعينه.
 *
 * وليس فرضًا: عُلِّق فعلًا في التكامل المستمرّ على لينكس بمسارٍ تحت `/proc`،
 * فبقي الاختبار ينتظر حتى انتهت مهلته.
 *
 * والعمليةُ تمضي في الخلفية بعد المهلة — لا سبيل لقطع `writeFile` — لكنّ
 * الردّ لا ينتظرها.
 */
async function withDeadline(work: () => Promise<void>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error('تعذّر الفحص في المهلة'), { code: 'TIMEOUT' })),
          PROBE_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * فحصُ التخزين — **يقيس ما لا يُقاس من خارج الخادم**.
 *
 * ورفعُ الوسائط يفشل أحيانًا بلا أن يُعرف أفي الشبكة العلّةُ أم في القرص:
 * الطلبُ يحتاج جلسةَ إدارة، فلا يستطيع من يشخّص من بعيد أن يبلغ مسار
 * الكتابة أصلًا. فهذا المسار يمرّ به **بلا جلسة وبلا بيانات**: يكتب بضعة
 * بايتات ويقرؤها ويمحوها، ويقول ما وقع.
 *
 * وما يُفشى منه محدودٌ عمدًا: أنجح أم لا، ورمزُ الخطأ (`EACCES`, `ENOSPC`)،
 * وأمربوطٌ المجلَّد بحجمٍ دائم. ولا يُذكر مسارٌ ولا سرٌّ ولا محتوى — ونصُّ
 * الخطأ نفسُه يحمل المسار كاملًا (`ENOENT: … open '/app/data/…'`)، فلا
 * يُرسل. والمسارُ وحده يدلّ المتطفّل على بنية الخادم، والبابُ بلا جلسة.
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
    await withDeadline(async () => {
      await media.put(PROBE_KEY, bytes, 'text/plain')
      const read = await media.read(PROBE_KEY)
      await media.remove(PROBE_KEY)
      result.readBack = read?.bytes.byteLength === bytes.byteLength
    })
    result.write = true
  } catch (error) {
    const named = error as { code?: string }
    result.write = false
    result.code = named?.code ?? 'UNKNOWN'
  }

  result.ms = Date.now() - started
  return Response.json(result, {
    status: result.write === true ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
