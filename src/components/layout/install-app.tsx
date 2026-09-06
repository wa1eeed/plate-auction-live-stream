'use client'

import { useEffect, useState } from 'react'
import { Download, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** حدثٌ يخصّ المتصفّحات القائمة على Chromium — ليس في تعريفات TypeScript. */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * تثبيت المنصّة تطبيقًا — سطرٌ في الدُرج لا لافتةٌ تعترض.
 *
 * والدعوة إلى التثبيت تُعرض حيث يُبحث عنها لا حيث تُزاحم: لافتةٌ تهبط على
 * صفحة المزاد تحجب سعرًا وعدّادًا في اللحظة التي فُتحت الصفحة لأجلهما.
 *
 * وثلاث حالات لا واحدة:
 * - **مثبَّتٌ أصلًا** — لا يُعرض شيء. والكشف بـ`display-mode: standalone`
 *   وبـ`navigator.standalone` لسفاري القديم.
 * - **متصفّحٌ يعرض التثبيت** (Chromium) — زرٌّ يفتح حوار النظام. والحدث
 *   يقع مرّةً واحدة وقد يسبق تركيب المكوّن، فيُلتقط ويُحفظ.
 * - **سفاري على iOS** — لا حدث ولا حوار: التثبيت يدويّ من زرّ المشاركة،
 *   فتُكتب الخطوتان بدل زرٍّ لا يفعل شيئًا.
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(true)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    setInstalled(standalone)

    const ua = navigator.userAgent
    // iPadOS يتنكّر في هيئة Mac، فيُميَّز بوجود اللمس
    const isApple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    setIos(isApple && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua))

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  if (prompt) {
    return (
      <Button
        variant="secondary"
        size="lg"
        className="w-full"
        onClick={async () => {
          await prompt.prompt()
          const { outcome } = await prompt.userChoice
          // الحدث يُستهلك بالعرض مرّةً واحدة، فلا يُعاد استعماله
          setPrompt(null)
          if (outcome === 'accepted') setInstalled(true)
        }}
      >
        <Download className="size-4" />
        ثبّت التطبيق على جهازك
      </Button>
    )
  }

  if (!ios) return null

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-[11px] leading-relaxed text-muted">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-paper">
        <Download className="size-3.5" />
        ثبّته على شاشتك الرئيسية
      </p>
      <p className="flex flex-wrap items-center gap-1">
        من سفاري: اضغط
        <Share className="size-3.5 shrink-0 text-gold-500" />
        <b className="text-paper">مشاركة</b>
        ثمّ
        <SquarePlus className="size-3.5 shrink-0 text-gold-500" />
        <b className="text-paper">إضافة إلى الشاشة الرئيسية</b>
      </p>
    </div>
  )
}
