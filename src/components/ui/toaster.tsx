'use client'

import { Toaster as SonnerToaster } from 'sonner'
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from 'lucide-react'

/**
 * **التنبيهات — بطاقةٌ تُقرأ، لا شريطٌ ضامرٌ أعلى الشاشة.**
 *
 * وموضعُها أعلى الشاشة مقصود: «سُجّلت مزايدتك» يُقرأ حيث تنظر العين، لا
 * أسفلَ الشاشة حيث يغطّيه الإبهامُ على الزرّ نفسه الذي أنتجه.
 *
 * والإزاحة بمقدار الشقّ: بلاها يقع التنبيه **تحت ساعة النظام** فلا يُقرأ.
 *
 * **وما تغيّر**: كان بعرض `sonner` الافتراضيّ — ثلاثمئةٍ وستّة وخمسين بكسلًا
 * على شاشةٍ عرضُها ثلاثُمئةٍ وتسعون، فيبدو بطاقةً صغيرةً تائهة. فصار يملأ
 * الشاشة إلّا هامشًا، بحافّةٍ أوسع وظلٍّ طبقيٍّ يرفعه عن الصفحة، وأيقونةٍ
 * في مربّعٍ ملوّن تقول نوعَ الخبر قبل أن يُقرأ نصُّه.
 *
 * **والأيقوناتُ من مكتبة المنصّة** لا من `sonner`: أيقوناتُها دوائرُ
 * مصمتةٌ بلونٍ واحد، فتبدو من منصّةٍ أخرى بين أيقونات المنصّة كلِّها.
 */
export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      offset="calc(var(--safe-top) + 0.75rem)"
      closeButton
      /* تُزاح المتراكمةُ ولا تُخبّأ — تنبيهٌ يحجب تنبيهًا يُفقد أحدَهما */
      expand
      gap={10}
      visibleToasts={3}
      /* أربعُ ثوانٍ: جملةٌ عربيّةٌ من عشر كلماتٍ تُقرأ في ثلاث */
      duration={4_000}
      icons={{
        success: <CircleCheck className="size-5" />,
        error: <CircleAlert className="size-5" />,
        warning: <TriangleAlert className="size-5" />,
        info: <Info className="size-5" />,
        loading: <Loader2 className="size-5 animate-spin" />,
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast: [
            'group w-[calc(100vw-1.75rem)] max-w-[26rem] items-start gap-3 rounded-[1.25rem] p-4',
            'border border-ink-600/70 bg-ink-800/95 text-paper backdrop-blur-xl',
            /* ظلٌّ طبقيّ: قريبٌ يحدّ الحافّة، وبعيدٌ يرفع البطاقة عن الصفحة */
            'shadow-[0_2px_8px_-2px_rgba(10,16,23,0.12),0_24px_56px_-20px_rgba(10,16,23,0.45)]',
          ].join(' '),
          /*
           * الأيقونةُ في مربّعٍ لا عائمةً — فتُقرأ شارةً لا زخرفة.
           *
           * و`!` لازمة: `sonner` يفرض على `[data-icon]` ستّةَ عشرَ بكسلًا
           * بأسبقيّةٍ تعلو أصنافَ المرافق — قِيس فخرجت ١٦ والصنفُ مطبَّق.
           */
          icon: 'grid size-9! shrink-0 place-items-center rounded-xl m-0! [&>svg]:size-5',
          title: 'text-[0.95rem] font-extrabold leading-snug',
          description: 'mt-0.5 text-[0.8rem] leading-relaxed text-muted',
          success: '[&_[data-icon]]:bg-success/12 [&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:bg-danger/12 [&_[data-icon]]:text-danger',
          warning: '[&_[data-icon]]:bg-gold-500/15 [&_[data-icon]]:text-gold-500',
          info: '[&_[data-icon]]:bg-ink-700 [&_[data-icon]]:text-muted',
          loading: '[&_[data-icon]]:bg-ink-700 [&_[data-icon]]:text-muted',
          actionButton: 'h-8 shrink-0 rounded-lg bg-gold-500 px-3 text-xs font-bold text-ink-950',
          cancelButton: 'h-8 shrink-0 rounded-lg bg-ink-700 px-3 text-xs font-bold text-paper',
          closeButton:
            'border-ink-600 bg-ink-800 text-muted hover:border-ink-500 hover:text-paper',
        },
      }}
    />
  )
}
