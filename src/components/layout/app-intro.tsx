'use client'

import { useEffect, useState } from 'react'
import { Gavel, Handshake, RectangleHorizontal, ShieldCheck, Tag, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OnboardingIcon, OnboardingSettings } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const ICONS: Record<OnboardingIcon, typeof Gavel> = {
  gavel: Gavel,
  tag: Tag,
  handshake: Handshake,
  shield: ShieldCheck,
  wallet: Wallet,
  plate: RectangleHorizontal,
}

/** ما دون هذا يُرى وميضًا لا شاشة، وما فوقه انتظارٌ بلا سبب. */
const MIN_SPLASH_MS = 450
const MAX_SPLASH_MS = 2_500

/** مفتاحُ الجهاز — ومعه رقمُ نسخةٍ ليُعاد العرض إن أُعيدت صياغةُ المقدّمة. */
const SEEN_KEY = 'app-intro-seen-v1'

/**
 * **مقدّمةُ التطبيق — شاشةُ هويّةٍ ثمّ تعريف، وكلتاهما من اللوحة.**
 *
 * وسبلاشُ النظام يُعرض قبل أن يعمل أيُّ كودِ ويب، فهو مخبوزٌ في ملفّ التطبيق
 * ولا سبيل إلى ضبطه من لوحة. وهذه تخلفه فور إخفائه: يرى صاحبُ الجهاز لحظةً
 * واحدةً متّصلة — ومضبوطُها هنا.
 *
 * **ولا تُعرض على الويب**: من فتح الموقع في متصفّحه جاء ليرى لوحاتٍ لا
 * ليُعرَّف بتطبيق. فتُقصر على الغلاف الأصيل وعلى المثبَّت على الشاشة.
 *
 * **والانتظارُ بالجاهزية لا بمؤقّت** — كما يُخفى سبلاشُ النظام تمامًا:
 * تُرفع عند تمام الحقن، وأدنى مدّةٍ تمنع الوميض، وسقفٌ يمنع التعلّق لو
 * تأخّرت العلامةُ لسببٍ ما.
 */
export function AppIntro({
  settings,
  brandName,
  logoUrl,
}: {
  settings: OnboardingSettings
  brandName: string
  logoUrl: string | null
}) {
  /** `null` قبل القياس — فلا يُرسم شيءٌ على الخادم ولا في أوّل إطار */
  const [phase, setPhase] = useState<'splash' | 'slides' | 'done' | null>(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    /*
     * القياسُ متزامن: `Capacitor` موجودٌ في الغلاف، و`standalone` لمن ثبّت
     * الاختصار. ولا يُعوَّل على `data-native` — تضعها `NativeShell` في أثرٍ
     * قد يقع بعد هذا.
     */
    const native = Boolean(
      (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
        ?.isNativePlatform?.(),
    )
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches ?? false
    if (!native && !standalone) {
      setPhase('done')
      return
    }

    setPhase('splash')

    let seen = true
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === '1'
    } catch {
      /* نافذةٌ خاصّة أو تخزينٌ محجوب — تُعرض المقدّمة ولا يُكسر شيء */
      seen = false
    }
    const showSlides = settings.enabled && settings.slides.length > 0 && !seen

    const started = Date.now()
    let done = false
    const finish = () => {
      if (done) return
      done = true
      const waited = Date.now() - started
      const rest = Math.max(0, MIN_SPLASH_MS - waited)
      window.setTimeout(() => setPhase(showSlides ? 'slides' : 'done'), rest)
    }

    /* علامةُ تمام الحقن — يضعها `route-progress.tsx` في أثرٍ بعد التركيب */
    if (document.documentElement.dataset.routeProgress === 'ready') finish()
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.routeProgress === 'ready') finish()
    })
    observer.observe(document.documentElement, { attributes: true })
    const cap = window.setTimeout(finish, MAX_SPLASH_MS)

    return () => {
      observer.disconnect()
      window.clearTimeout(cap)
    }
  }, [settings])

  const close = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* لا تخزين — تُعرض مرّةً أخرى، وهو أهونُ من أن تُكسر */
    }
    setPhase('done')
  }

  if (phase === null || phase === 'done') return null

  if (phase === 'splash') {
    return (
      <div
        data-app-intro="splash"
        className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4 bg-ink-950 px-8"
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={brandName} className="max-h-24 w-auto max-w-[70%] object-contain" />
        ) : (
          <p className="text-2xl font-extrabold text-paper">{brandName}</p>
        )}
        {settings.splashTagline && (
          <p className="text-center text-sm text-muted">{settings.splashTagline}</p>
        )}
      </div>
    )
  }

  const slide = settings.slides[Math.min(index, settings.slides.length - 1)]
  const Icon = ICONS[slide.icon] ?? Gavel
  const last = index >= settings.slides.length - 1

  return (
    <div
      data-app-intro="slides"
      role="dialog"
      aria-modal="true"
      aria-label="تعريفٌ بالمنصّة"
      className="fixed inset-0 z-[70] flex flex-col bg-ink-950 px-6"
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="flex justify-start pt-4">
        <button type="button" onClick={close} className="text-sm text-muted hover:text-paper">
          تخطٍّ
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <span className="grid size-20 place-items-center rounded-3xl bg-gold-500/12 text-gold-500">
          <Icon className="size-9" />
        </span>
        <h2 className="text-2xl font-extrabold text-paper">{slide.title}</h2>
        <p className="max-w-sm text-sm leading-relaxed text-muted">{slide.body}</p>
      </div>

      <div className="space-y-4 pb-6">
        {/* النقاطُ تقول كم بقي — وبغيرها لا يُعرف أطويلةٌ المقدّمة أم شريحتان */}
        <ol aria-hidden className="flex justify-center gap-1.5">
          {settings.slides.map((row, position) => (
            <li
              key={row.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                position === index ? 'w-6 bg-gold-500' : 'w-1.5 bg-ink-600',
              )}
            />
          ))}
        </ol>
        <Button
          size="lg"
          className="w-full"
          onClick={() => (last ? close() : setIndex((current) => current + 1))}
        >
          {last ? 'ابدأ' : 'التالي'}
        </Button>
      </div>
    </div>
  )
}
