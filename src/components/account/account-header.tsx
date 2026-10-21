'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Gavel, HandCoins, LayoutList, ShoppingBag, Store, Wallet } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { User } from '@/lib/domain/types'
import { cn, formatYear } from '@/lib/utils'

/**
 * **رأسُ الملفّ — هويّةٌ ورصيدٌ في بطاقةٍ واحدة.**
 *
 * وكان الاسمُ سطرًا والرصيدُ بطاقةً تحته، فيقرأ صاحبُه اسمَه ثمّ ينزل ليرى
 * ما عنده. وهما سؤالٌ واحدٌ عند فتح الملفّ: «من أنا هنا، وكم أملك؟» —
 * فيُجابان معًا في أوّل ما تقع عليه العين.
 *
 * والبطاقةُ داكنةٌ على صفحةٍ فاتحة عمدًا: تفصل الهويّةَ عمّا تحتها بلا خطٍّ
 * ولا عنوان، وهو ما تفعله التطبيقات الأصيلة في رؤوس ملفّاتها.
 */
export function AccountHeader({
  user,
  wallet,
  topUp,
}: {
  user: User
  wallet: { available: number; balance: number; held: number }
  /** زرُّ الشحن — يُمرَّر من الصفحة لأنّه يحتاج خيارات الدفع من الخادم */
  topUp?: React.ReactNode
}) {
  const initial = user.displayName.trim().charAt(0) || '؟'
  const year = formatYear(user.createdAt)

  return (
    <section className="overflow-hidden rounded-3xl bg-slab p-4 text-slab-fg">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-lg font-extrabold text-gold-500"
        >
          {initial}
        </span>
        <div className="min-w-0">
          {/* نصٌّ لا عنوان — العنوانُ الوحيد في الصفحة يحمله الغلاف. انظر `page.tsx` */}
          <p className="truncate text-lg font-extrabold">{user.displayName}</p>
          {/*
            * رقمُ العضوية وسنةُ الانضمام في سطرٍ واحد.
            *
            * والرقمُ هو ما يُقتبَس في كلّ مراسلةٍ مع الإدارة، فموضعُه تحت
            * الاسم لا في قاعٍ يُبحث عنه.
            */}
          <p className="mt-0.5 truncate text-[11px] text-slab-fg/60">
            {user.reference} · عضو منذ {year}
          </p>
        </div>
      </div>

      {/*
       * شريطُ المحفظة — داخل البطاقة لا تحتها.
       *
       * والشحنُ زرٌّ إلى جانبه لا هدفٌ يُبحث عنه في صفحةٍ أخرى: مَن نظر إلى
       * رصيده فوجده دون ما يريد، أراد شحنَه في اللحظة نفسها.
       *
       * وهو **بجانب** الرابط لا داخله: زرٌّ في جوف رابطٍ لا يصحّ في الترميز،
       * ونقرةٌ واحدة تُشغّلهما معًا — فينتقل المستخدم وتُفتح النافذة.
       */}
      <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-white/8 p-3.5">
        <Link href="/account/wallet" className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-500">
            <Wallet className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] whitespace-nowrap text-slab-fg/60">
              الرصيد المتاح للمزايدة
            </span>
            <span className="block text-xl font-extrabold tabular-nums text-gold-500">
              {formatAmount(wallet.available)}
              <span className="ms-1 text-[11px] font-normal text-slab-fg/60">ر.س</span>
            </span>
            {wallet.held > 0 && (
              <span className="mt-0.5 block text-[11px] text-slab-fg/60">
                محجوز كعرابين <b className="text-slab-fg">{formatAmount(wallet.held)}</b>
              </span>
            )}
          </span>
        </Link>
        {topUp}
      </div>
    </section>
  )
}

export type CounterTone = 'gold' | 'sky' | 'success'

/** أيقونةُ القسم باسمها لا بمكوّنها — انظر التعليق على `SECTION_ICONS`. */
export type CounterIcon = keyof typeof SECTION_ICONS

export type CounterColumn = {
  href: string
  label: string
  total: number
  icon: CounterIcon
  /** لونُ الشارة — يُميّز الأقسامَ بلمحة */
  tone: CounterTone
  /**
   * الصفوفُ تفصيلُ العدد، و`alert` تقول أيُّها **ينتظر تصرّفًا**.
   *
   * و«٥ معروضة» حالٌ صحيّة لا نداء، و«١ بانتظار سدادك» نداء. فلو أُبرز
   * كلاهما لفقد الإبرازُ معناه: بطاقاتٌ كلُّها تقول «انظر إليّ» فلا يُنظر
   * إلى شيء.
   */
  rows: { label: string; count: number; alert?: boolean }[]
}

/**
 * **الأيقونةُ تُختار باسمها لا بتمرير المكوّن.**
 *
 * فالصفحة مكوّنُ خادم وهذه مكوّنُ عميل، وReact لا يُسلسل دالّةً عبر هذا
 * الحدّ — فتمريرُ المكوّن يُسقط الصفحة بخطأ تسلسل. وهو المسلكُ نفسُه في
 * `plate-carousel`.
 */
const SECTION_ICONS = {
  listings: LayoutList,
  purchases: ShoppingBag,
  sales: Store,
  bids: Gavel,
  offers: HandCoins,
} as const

const TONE: Record<CounterTone, string> = {
  gold: 'bg-gold-500/15 text-gold-400',
  sky: 'bg-sky-500/15 text-sky-500',
  success: 'bg-success/15 text-success',
}

/**
 * **أقسامُ الملفّ — بطاقاتٌ تُمرَّر، لا جدولُ أرقامٍ صغير.**
 *
 * وكانت ثلاثةَ أعمدةٍ يفصلها خطّ، وتحت كلٍّ صفّان بخطٍّ من عشر نقاط: يُقرأ
 * جدولًا لا بطاقة، ولا يقول أيُّها يعنيني الآن. وثلاثةٌ وحدها كانت تُعرض
 * والملفُّ فيه أكثر.
 *
 * فصارت بطاقاتٍ تُمرَّر بالإصبع: لكلٍّ شارتُها الملوّنة وعددُها بارزًا
 * وسطرٌ واحدٌ يقول ما ينتظر تصرّفًا. **ومؤشّرٌ تحتها يقول إنّ وراءها
 * مزيدًا** — وشريطٌ يُمرَّر بلا إشارةٍ لا يُمرَّره أحد.
 */
export function AccountCounters({ columns }: { columns: CounterColumn[] }) {
  const trackRef = useRef<HTMLUListElement>(null)
  const [progress, setProgress] = useState({ ratio: 1, offset: 0 })

  const measure = useCallback(() => {
    const node = trackRef.current
    if (!node) return
    const max = node.scrollWidth - node.clientWidth
    /* نسبةُ ما يُرى من الشريط، ومنها عرضُ الإبهام */
    const ratio = node.scrollWidth > 0 ? node.clientWidth / node.scrollWidth : 1
    /* والقيمةُ المطلقة: `scrollLeft` يعدّ بالسالب في RTL */
    setProgress({ ratio, offset: max > 0 ? Math.abs(node.scrollLeft) / max : 0 })
  }, [])

  useEffect(() => {
    const node = trackRef.current
    if (!node) return
    measure()
    node.addEventListener('scroll', measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      node.removeEventListener('scroll', measure)
      observer.disconnect()
    }
  }, [measure, columns.length])

  const scrollable = progress.ratio < 0.999

  return (
    <div>
      <ul
        ref={trackRef}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-4 sm:mx-0 sm:px-0"
      >
        {columns.map((column) => {
          const calling = column.rows.find((row) => row.alert && row.count > 0)
          const resting = column.rows[0]
          const Icon = SECTION_ICONS[column.icon]
          return (
            <li key={column.href} className="w-[7.25rem] shrink-0 snap-start">
              <Link
                href={column.href}
                className={cn(
                  'surface flex h-full flex-col rounded-2xl p-3 transition-colors',
                  'hover:border-ink-500 active:scale-[0.98]',
                  /* ما ينتظر تصرّفًا يُحاط بذهبٍ خافت — يُرى قبل أن يُقرأ */
                  calling && 'border-gold-600/45 bg-gold-500/[0.05]',
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-lg',
                      TONE[column.tone],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <b className="text-xl font-extrabold leading-none tabular-nums text-paper">
                    {column.total}
                  </b>
                </span>

                <span className="mt-2 block truncate text-[11px] font-bold text-paper">
                  {column.label}
                </span>

                {calling ? (
                  <span className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-gold-500">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold-500" />
                    <span className="truncate">
                      {calling.count} {calling.label}
                    </span>
                  </span>
                ) : (
                  <span className="mt-1.5 block truncate text-[10px] text-muted">
                    {resting ? `${resting.count} ${resting.label}` : '—'}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>

      {/*
        * **مؤشّرُ تمريرٍ يتبع الموضع — لا خطٌّ ساكنٌ للزينة.**
        *
        * وشريطٌ يُمرَّر بلا إشارةٍ لا يعلم أحدٌ أنّ وراءه شيئًا. والمؤشّرُ
        * يقول شيئين معًا: أنّ ثَمّ مزيدًا (بعرض إبهامه)، وأين أنت منه
        * (بموضعه). وهو ما تفعله الشرائحُ في أنظمة الهواتف.
        *
        * ويختفي إن كان كلُّ شيءٍ ظاهرًا: إشارةٌ إلى ما لا وجود له تُربك.
        */}
      {scrollable && (
        <div aria-hidden className="mx-auto mt-2 h-1 w-16 overflow-hidden rounded-full bg-ink-600/70">
          <span
            className="block h-full rounded-full bg-gold-500/80 transition-transform duration-150 ease-out"
            style={{
              width: `${Math.max(progress.ratio * 100, 22)}%`,
              /* الإزاحةُ بنسبة ما بقي من الشريط بعد الإبهام */
              transform: `translateX(${
                (1 / Math.max(progress.ratio, 0.22) - 1) * progress.offset * 100
              }%)`,
            }}
          />
        </div>
      )}
    </div>
  )
}
