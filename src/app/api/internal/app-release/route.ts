import { z } from 'zod'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { compareVersions, patchChannel } from '@/lib/server/app-release-service'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * **تبليغُ سير البناء بما رُفع إلى المتجرين.**
 *
 * ورقمُ الإصدار واللحظةُ والبناءُ كلُّها معلومةٌ عند الرفع ولا أحدَ يعلمها
 * بعده: TestFlight لا واجهةَ علنيّةَ له، وPlay لم تعد تذكر رقم النسخة في
 * صفحة التطبيق. فمن يرفع هو من يُسجّل.
 *
 * **وسرٌّ خاصٌّ بهذا الباب لا سرُّ الجلسات.**
 *
 * فهذا مسارٌ يُنادى من الشبكة العامّة، و`SESSION_SECRET` يوقّع الجلسات —
 * فنسخُه إلى أسرار جيت هب يجعل تسرُّبَ سجلٍّ هناك تسرُّبَ انتحالِ أيِّ حساب.
 * ولكلّ سرٍّ مداه.
 *
 * **ويُرفض بلا سرٍّ لا يُفتح.**
 *
 * ومسحُ المزادات يسقط إلى سرٍّ تطويريّ لأنّ من ينادِيه عمليّةُ الخادم نفسُها.
 * وهذا يُنادى من خارج، فسرٌّ افتراضيٌّ معروفٌ فيه يعني أنّ لأيٍّ أن يكتب
 * أرقامَ إصدارات المنصّة. فإن لم يُضبط أُغلق الباب — ولا ميزةَ تُفقد: لا
 * يُسجَّل شيءٌ ويبقى ما في اللوحة على حاله.
 */
const SECRET = process.env.RELEASE_REPORT_SECRET

const bodySchema = z.object({
  platform: z.enum(['ios', 'android']),
  channel: z.enum(['testing', 'production']),
  /* `1.0.6` — بلا `v`، وهي ما يراه الناس في المتجر */
  version: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+){0,3}([.+-][0-9A-Za-z.-]+)?$/, 'رقمُ نسخةٍ غير مقروء'),
  build: z.string().trim().min(1).max(40).nullable().default(null),
  commit: z.string().trim().min(7).max(64).nullable().default(null),
  /* إعادةُ بناءٍ لوسمٍ قديم لا تُنزل الرقمَ المعروض — إلّا بطلبٍ صريح */
  force: z.boolean().default(false),
})

export async function POST(request: Request) {
  try {
    if (!SECRET) {
      return fail('لم يُضبط سرُّ تبليغ الإصدارات', 503, 'RELEASE_REPORT_DISABLED')
    }
    if (request.headers.get('x-release-report') !== SECRET) {
      return fail('غير مصرّح', 403, 'FORBIDDEN')
    }

    const body = bodySchema.parse(await readJson(request))
    const store = getStore()
    const current = await store.getAppReleases()
    const recorded = current[body.platform][body.channel]

    /*
     * **ولا يُنزل المسجَّلُ إلى أقدمَ منه.**
     *
     * وسيرُ البناء يُعاد تشغيلُه على وسمٍ قديم — لتجربةِ تغييرٍ في السير، أو
     * لبناءٍ سقط ثمّ أُعيد — فيبلّغ `1.0.3` بعد أن بُلّغ `1.0.6`. ولو كُتب
     * لقالت اللوحةُ إنّ عند المختبِرين نسخةً تركوها منذ أسبوع.
     *
     * والمساواةُ تُقبل: بناءٌ ثانٍ لوسمٍ واحدٍ يُرفع برقمِ بناءٍ أحدث، وهو
     * ما يصل المختبِرين فعلًا.
     */
    if (recorded && !body.force && compareVersions(body.version, recorded.version) < 0) {
      return fail(
        `المسجَّل ${recorded.version} أحدثُ من ${body.version} — لا يُنزل إلّا بـforce`,
        409,
        'RELEASE_OLDER',
      )
    }

    const next = await store.updateAppReleases(
      patchChannel(current, body.platform, body.channel, {
        version: body.version,
        build: body.build,
        at: new Date().toISOString(),
        commit: body.commit,
      }),
      null,
    )
    return ok({ release: next[body.platform][body.channel] })
  } catch (error) {
    return handleError(error)
  }
}
