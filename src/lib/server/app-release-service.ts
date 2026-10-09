import type { AppPlatform, AppRelease, AppReleaseChannel, AppReleases } from '@/lib/domain/types'

/**
 * **ما نُشر من التطبيق — بقناتيه ومنصّتيه، ومن أين عُرف.**
 *
 * ومن يشغّل المنصّة يسأل سؤالين لا ثالثَ لهما: ما الذي عند الناس الآن، وما
 * الذي عند المختبِرين؟ وبلا جوابٍ هنا يفتح لوحتَي أبل وجوجل ويقارن.
 *
 * ولا مصدرَ واحدًا يجيب عنهما:
 *
 *  - **إنتاجُ أبل** يُقرأ من واجهة متجرها العلنيّة — نسخةً وتاريخًا، بلا
 *    مفتاحٍ ولا حساب. وهي الحقيقةُ نفسُها: ما تقوله أبل عن متجرها.
 *  - **اختبارُ أبل (TestFlight)** لا واجهةَ علنيّةَ له، ومفتاحُ App Store
 *    Connect الذي يملكه سيرُ البناء ليس عند الخادم — فما رُفع يُسجَّل عند
 *    الرفع.
 *  - **جوجل** لا واجهةَ علنيّة لها أصلًا: صفحةُ التطبيق لم تعد تذكر رقم
 *    النسخة. فالمسجَّلُ من السير هو الاختبار، والإنتاجُ يُثبته الأدمن حين
 *    يرفع المسارَ إلى الإنتاج في لوحة Play.
 *
 * فـ**يُسمّى المصدرُ مع كلّ رقم**. ورقمٌ بلا مصدرٍ يُقرأ كأنّه من المتجر،
 * فيُطمأنّ إلى ما لم يُنشر بعد — وهذا أسوأ من لا رقم.
 */

/** معرّفُ الحزمة — واحدٌ في المتجرين، وهو نفسُه في `capacitor.config.ts`. */
export const APP_BUNDLE_ID = 'sa.nx.mazad'

/**
 * واجهةُ البحث في متجر أبل.
 *
 * و`country` يلزم: الافتراضُ واجهةُ المتجر الأمريكيّة، وتطبيقٌ منشورٌ في
 * السعوديّة وحدها يخرج منها بلا نتيجة — فيُقرأ «لم يُنشر» وهو منشور.
 */
const LOOKUP_COUNTRY = process.env.APPSTORE_COUNTRY ?? 'sa'
const LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${APP_BUNDLE_ID}&country=${LOOKUP_COUNTRY}`

/**
 * مهلةٌ قصيرةٌ وقاطعة.
 *
 * وصفحةُ الإعدادات تُصيَّر على الخادم، فسؤالُ متجرٍ بعيدٍ بلا مهلةٍ يعني
 * صفحةً تُعلَّق حين يتعطّل طرفٌ ثالث. وقد وقع مثلُه في فحص التخزين.
 */
const LOOKUP_TIMEOUT_MS = 4_000

/**
 * ذاكرةٌ في العملية لا في طبقة `fetch`.
 *
 * وكلُّ صفحات اللوحة `force-dynamic`، فتخزينُ `fetch` معطَّلٌ فيها بحكم
 * الإعداد — ولو ضُبط لتعارض. وردُّ أبل يتغيّر مرّةً في الإصدار لا مرّةً في
 * الثانية، فعشرُ دقائقَ لا تُخفي شيئًا وتكفي ألفَ تحديثِ صفحة.
 *
 * والفشلُ يُخزَّن أيضًا لمدّةٍ أقصر: شبكةٌ متقطّعةٌ لا تُحوَّل إلى أربع
 * ثوانٍ تُنتظر في كلّ مرّة.
 */
const CACHE_TTL_MS = 10 * 60 * 1_000
const FAILURE_TTL_MS = 60 * 1_000

export type AppStoreRelease = { version: string; at: string }

type CacheEntry = { at: number; value: AppStoreRelease | null; ok: boolean }
let cache: CacheEntry | null = null

export function resetAppStoreCacheForTests(): void {
  cache = null
}

/**
 * نسخةُ الإنتاج في متجر أبل وتاريخُها — أو `null` إن تعذّر أو لم يُنشر.
 *
 * ولا تُفرَّق هنا «لم يُنشر» من «تعذّر السؤال»: الأولى `ok` بلا قيمة،
 * والثانية `ok: false` — ويَقرؤهما العرضُ فيقول أيَّهما وقع.
 */
export async function fetchAppStoreRelease(): Promise<{ ok: boolean; release: AppStoreRelease | null }> {
  const now = Date.now()
  if (cache && now - cache.at < (cache.ok ? CACHE_TTL_MS : FAILURE_TTL_MS)) {
    return { ok: cache.ok, release: cache.value }
  }

  try {
    const response = await fetch(LOOKUP_URL, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
      headers: { accept: 'application/json' },
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`lookup ${response.status}`)

    /*
     * وأبل تردّ `text/javascript` لا `application/json` — فالقراءةُ نصًّا
     * ثمّ تحليلًا. و`response.json()` تعمل معها اليوم ولا عهدَ لها بذلك.
     */
    const body = JSON.parse(await response.text()) as {
      results?: { version?: unknown; currentVersionReleaseDate?: unknown }[]
    }
    const first = body.results?.[0]
    const version = typeof first?.version === 'string' ? first.version : null
    const at =
      typeof first?.currentVersionReleaseDate === 'string' ? first.currentVersionReleaseDate : null

    const release = version && at ? { version, at } : null
    cache = { at: now, value: release, ok: true }
    return { ok: true, release }
  } catch {
    cache = { at: now, value: null, ok: false }
    return { ok: false, release: null }
  }
}

/* ------------------------------------------------------------ العرض */

/** من أين عُرف الرقم — ويُكتب بجانبه دائمًا. */
export type ReleaseSource = 'store' | 'upload' | 'manual'

export type ReleaseView = AppRelease & { source: ReleaseSource }

export type PlatformReleaseView = {
  platform: AppPlatform
  production: ReleaseView | null
  testing: ReleaseView | null
  /** سُئل المتجرُ فلم يُجب — فما يُعرض من السجلّ وحده */
  storeUnreachable: boolean
  /** في الاختبار نسخةٌ أحدثُ من الإنتاج — فهي تنتظر رفعًا للمسار */
  awaitingPromotion: boolean
}

/**
 * **مقارنةُ نسختين بالدلالة لا بالحروف.**
 *
 * و`'1.0.10' > '1.0.9'` خطأٌ نصًّا وصحيحٌ عددًا — والنصّ يقارن `'1'` بـ`'9'`
 * فيقول إنّ العاشرة أقدم. فتُقسَّم المقاطعُ وتُقارن أعدادًا.
 *
 * وما لا يُقرأ عددًا يُعدّ صفرًا: لاحقةٌ كـ`1.2.0-rc1` لا تُسقط المقارنة.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) => value.split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0)
  const left = parts(a)
  const right = parts(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

const withSource = (release: AppRelease | null, source: ReleaseSource): ReleaseView | null =>
  release ? { ...release, source } : null

/**
 * الصورةُ التي تُعرض — سجلُّ المنصّة وردُّ المتجر مجموعين.
 *
 * ونسخةُ أبل من متجرها **تسبق المسجَّل**: ما يقوله المتجر هو ما عند الناس،
 * وما سُجّل عند الرفع تخمينٌ شاخ. والمسجَّلُ يبقى احتياطًا لحين لا يُجاب.
 */
export function buildReleaseViews(
  releases: AppReleases,
  store: { ok: boolean; release: AppStoreRelease | null },
): PlatformReleaseView[] {
  const iosStore: ReleaseView | null = store.release
    ? { version: store.release.version, build: null, at: store.release.at, commit: null, source: 'store' }
    : null

  const iosProduction = iosStore ?? withSource(releases.ios.production, 'manual')
  const iosTesting = withSource(releases.ios.testing, 'upload')
  const androidProduction = withSource(releases.android.production, 'manual')
  const androidTesting = withSource(releases.android.testing, 'upload')

  const awaiting = (testing: ReleaseView | null, production: ReleaseView | null) =>
    testing !== null && (production === null || compareVersions(testing.version, production.version) > 0)

  return [
    {
      platform: 'ios',
      production: iosProduction,
      testing: iosTesting,
      storeUnreachable: !store.ok,
      awaitingPromotion: awaiting(iosTesting, iosProduction),
    },
    {
      platform: 'android',
      production: androidProduction,
      testing: androidTesting,
      /* ولا متجرَ يُسأل أصلًا — فلا يقال «تعذّر» عمّا لم يُحاول */
      storeUnreachable: false,
      awaitingPromotion: awaiting(androidTesting, androidProduction),
    },
  ]
}

/** إسنادُ قناةٍ واحدةٍ في الشريحة بلا مسّ أختها. */
export function patchChannel(
  releases: AppReleases,
  platform: AppPlatform,
  channel: AppReleaseChannel,
  release: AppRelease | null,
): Partial<Pick<AppReleases, AppPlatform>> {
  return { [platform]: { ...releases[platform], [channel]: release } } as Partial<
    Pick<AppReleases, AppPlatform>
  >
}
