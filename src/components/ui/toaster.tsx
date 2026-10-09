'use client'

import type { CSSProperties } from 'react'
import { Toaster as SonnerToaster } from 'sonner'
import { CircleAlert, CircleCheck, Info, Loader2, TriangleAlert } from 'lucide-react'

/**
 * **التنبيهات — بطاقةٌ تطفو تحت الترويسة، لا شريطٌ يركبها.**
 *
 * وموضعُها أعلى الشاشة مقصود: «سُجّلت مزايدتك» يُقرأ حيث تنظر العين، لا
 * أسفلَ الشاشة حيث يغطّيه الإبهامُ على الزرّ نفسه الذي أنتجه.
 *
 * **وكانت تركب الترويسة.** فالترويسةُ `sticky top-0` ارتفاعُها `h-16` فوقها
 * `var(--safe-top)`، والتنبيهُ كان يُزاح بالشقّ وحده — فيحطّ على الشعار
 * والقائمة ويحجبهما. ورآه صاحبُ المنصّة «في أعلى الصفحة جدًّا»، وهو كذلك:
 * لا فراغَ فوقه ولا تحته، فيبدو جزءًا من الترويسة لا خبرًا طارئًا عليها.
 * فصارت الإزاحةُ شقًّا وترويسةً وفُرجة — فيطفو تحتها طفوًا بيّنًا.
 *
 * **وما يجعله يُقرأ قبل أن يُقرأ**: شريطٌ لونُه لونُ الخبر على حافّته
 * الأولى، وأيقونةٌ في مربّعٍ بلونه. فيُعرف «تمّ» من «تعذّر» بلمحةٍ قبل
 * الكلمات — وهو ما يصنعه تطبيقٌ حديث.
 *
 * **والأيقوناتُ من مكتبة المنصّة** لا من `sonner`: أيقوناتُها دوائرُ
 * مصمتةٌ بلونٍ واحد، فتبدو من منصّةٍ أخرى بين أيقونات المنصّة كلِّها.
 */

/** ارتفاعُ الترويسة `h-16` وفُرجةٌ تحتها — ومعهما الشقّ في الجوّال. */
const TOP = 'calc(var(--safe-top) + 4.75rem)'
const GUTTER = '0.75rem'

/*
 * **والإزاحةُ لكلّ جهةٍ على حدة — لا قيمةً واحدةً للأربع.**
 *
 * فـ`offset` المفردة تُطبَّق على الجهات كلِّها: فصارت ٧٦ بكسلًا يمينًا
 * ويسارًا كما هي فوقًا. والقائمةُ `position: fixed` بعرضٍ صريح، وفي
 * `dir="rtl"` يغلب `right` — فانزاحت البطاقةُ خمسين بكسلًا خارج الشاشة.
 * قِيس: حافّتُها اليسرى عند `-52`.
 */
const OFFSET = { top: TOP, right: GUTTER, bottom: GUTTER, left: GUTTER }

/*
 * وعرضُ البطاقة يُملى على `sonner` بمتغيّره هو لا بصنفٍ يُفرض.
 *
 * فهو يرسم البطاقةَ بـ`--width` ويحسب تكديسَها عليه — وفرضُ عرضٍ بصنفٍ
 * يُغيّر الرسمَ ولا يُغيّر الحساب، فتُرسم بعرضٍ ويُكدَّس غيرُه.
 *
 * وهذا للشاشة الواسعة: دون ٦٠١ بكسل يتّبع `sonner` فرعًا آخر يملأ فيه
 * البطاقةُ عرضَ القائمة إلّا الهوامش — فالعرضُ على الجوّال من `GUTTER`.
 */
const WIDTH = 'min(26rem, calc(100vw - 1.5rem))'

export function Toaster() {
  return (
    <SonnerToaster
      dir="rtl"
      position="top-center"
      offset={OFFSET}
      mobileOffset={OFFSET}
      style={{ '--width': WIDTH } as CSSProperties}
      /*
       * **ولا زرَّ إغلاق.**
       *
       * فـ`sonner` يعلّقه نصفَ خارجٍ على الزاوية، فيبدو قطعةً ناتئةً من
       * البطاقة لا جزءًا منها — وهو أوّلُ ما يُرى في لقطةٍ فيُستقبح. وأربعُ
       * ثوانٍ تنقضي وحدها، والسحبُ إلى أعلى يُزيلها قبلها.
       */
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
            'group relative overflow-hidden',
            /*
             * **و`!` على الاستدارة — لا ترفًا.**
             *
             * فصفحةُ أنماط `sonner` تُحقن بعد أنماط Tailwind، فتغلب ما
             * يساويها في الأسبقيّة. وقِيس: `border-radius` خرجت ٨ والصنفُ
             * `rounded-2xl` مطبَّقٌ في الـHTML. والأيقونةُ مثلُها أدناه.
             */
            'items-start gap-3 rounded-2xl! p-4 ps-5',
            'border border-ink-600/60 bg-ink-800/92 text-paper backdrop-blur-xl',
            /*
             * ولا شريطَ على الحافّة: جُرّب فنتأ خارج الاستدارة إلى جانب زرّ
             * الإغلاق، فصارت البطاقةُ ذاتَ أطرافٍ ناتئة. واللونُ يكفيه
             * مربّعُ الأيقونة وحلقةٌ رقيقةٌ حول البطاقة.
             */
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
          /*
           * **وألوانُ النوع تُكتب حرفًا لا تُركَّب.**
           *
           * فماسحُ Tailwind يقرأ الملفّات نصًّا ولا ينفّذها: `bg-${tone}`
           * لا يُرى، فلا يُولَّد الصنف ولا يظهر اللون — ويبقى الصنفُ في
           * الـHTML بلا قاعدةٍ تسنده. عطبٌ صامتٌ بلا خطأٍ ولا تحذير.
           */
          success: 'ring-1 ring-success/25 [&_[data-icon]]:bg-success/12 [&_[data-icon]]:text-success',
          error: 'ring-1 ring-danger/25 [&_[data-icon]]:bg-danger/12 [&_[data-icon]]:text-danger',
          warning: 'ring-1 ring-gold-500/25 [&_[data-icon]]:bg-gold-500/15 [&_[data-icon]]:text-gold-500',
          info: 'ring-1 ring-gold-500/20 [&_[data-icon]]:bg-gold-500/12 [&_[data-icon]]:text-gold-400',
          loading: '[&_[data-icon]]:bg-ink-700 [&_[data-icon]]:text-muted',
          actionButton: 'h-8 shrink-0 rounded-lg bg-gold-500 px-3 text-xs font-bold text-ink-950',
          cancelButton: 'h-8 shrink-0 rounded-lg bg-ink-700 px-3 text-xs font-bold text-paper',
        },
      }}
    />
  )
}
