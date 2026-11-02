import { loginSchema } from '@/lib/domain/schemas'
import { fail, handleError, ok, readJson } from '@/lib/server/api'
import { hashPassword, verifyPassword } from '@/lib/server/crypto'
import { DEMO_USERS, DEMO_USER_PASSWORD, demoPasswordFromEnv } from '@/lib/config'
import { clientIp } from '@/lib/server/client-ip'
import { rateLimit } from '@/lib/server/rate-limit'
import { setUserSession } from '@/lib/server/session'
import { DISABLED_ACCOUNT_MESSAGE } from '@/lib/server/account-service'
import { getStore } from '@/lib/store'

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await readJson(request))
    /*
     * حدّان لا حدٌّ واحد: بالعنوان **وبالبريد**.
     *
     * والحدُّ بالبريد وحده لا يحرس شيئًا أمام قائمة: ألفُ بريدٍ مختلف = ألفُ
     * نافذةٍ كاملة، ولا يصطدم المهاجم بشيء. والحدُّ بالعنوان هو الذي يوقفه.
     *
     * والسقف فسيحٌ عمدًا: شبكات الجوّال تشترك في العناوين (CGNAT)، فمكتبٌ أو
     * حيٌّ كامل قد يخرج من عنوانٍ واحد. والمقصود إيقاف الآلة لا الناس.
     *
     * ويشتدّ مع كلاودفلير لا به يبدأ: `cf-connecting-ip` أدقّ من
     * `x-forwarded-for`، والحدّ قائمٌ قبله وبعده — انظر `client-ip.ts`.
     */
    if (!rateLimit(`login-ip:${clientIp(request.headers)}`, 30, 60_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد قليل', 429, 'RATE_LIMITED')
    }
    if (!rateLimit(`login:${body.email}`, 8, 60_000).allowed) {
      return fail('محاولات كثيرة، حاول بعد دقيقة', 429, 'RATE_LIMITED')
    }

    const store = getStore()
    /*
     * **حساباتُ العرض تتبع البيئةَ لا القاعدة** — كما يفعل حسابُ الإدارة.
     *
     * فكلمتُها كانت مكتوبةً في مستودعٍ عامّ، ونُزعت منه إلى
     * `DEMO_USER_PASSWORD`. لكنّ النزعَ يحرس النشراتِ القادمةَ وحدها:
     * البذرةُ لا تُزرع إلّا على قاعدةٍ فارغة، فالحساباتُ المزروعةُ تبقى
     * بكلمتها القديمة المنشورة إلى الأبد.
     *
     * فتُحاذى هنا: من بدّلها في متغيّرات النشر بدّلها في القاعدة بأوّل
     * محاولةِ دخول.
     *
     * **ولا تُنشأ إن لم تكن** — تحديثٌ محض. فحساباتُ العرض بياناتُ عرضٍ لا
     * بنيةٌ لازمة، وزرعُها في قاعدةٍ نظيفةٍ لأنّ أحدًا كتب بريدَها في نموذج
     * دخولٍ عبثٌ وخطر.
     *
     * **وبلا ضبطِ المتغيّر لا يُمسّ شيء**: الافتراضُ عشوائيٌّ يُولَّد في كلّ
     * إقلاع، فلو حوذيت به لدُهست كلمةٌ غيّرها صاحبُها بقيمةٍ لا يعرفها أحد.
     */
    if (
      demoPasswordFromEnv &&
      store.kind === 'postgres' &&
      'alignDemoPassword' in store &&
      DEMO_USERS.some((u) => u.email === body.email.trim().toLowerCase())
    ) {
      await (
        store as { alignDemoPassword: (email: string, hash: string) => Promise<boolean> }
      ).alignDemoPassword(body.email, hashPassword(DEMO_USER_PASSWORD))
    }

    const account = await store.findUserByEmail(body.email)
    if (!account || !verifyPassword(body.password, account.passwordHash)) {
      return fail('البريد الإلكتروني أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS')
    }
    /*
     * **بعد التحقّق من كلمة المرور لا قبله.**
     *
     * ولو رُدّ المعطَّلُ قبل الفحص لَصار المسارُ كاشفًا: يُجرَّب بريدٌ بكلمةٍ
     * خاطئة، فإن قيل «معطَّل» عُرف أنّ الحساب قائم. فيُقال ذلك لمن أثبت
     * أنّه صاحبُه.
     */
    if (account.disabledAt) {
      return fail(DISABLED_ACCOUNT_MESSAGE, 403, 'ACCOUNT_DISABLED')
    }
    await setUserSession({ userId: account.id, email: account.email })
    return ok({ user: { id: account.id, displayName: account.displayName } })
  } catch (error) {
    return handleError(error)
  }
}
