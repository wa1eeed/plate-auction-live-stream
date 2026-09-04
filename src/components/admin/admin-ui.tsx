import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAmount } from '@/lib/domain/money'
import type { Halalas } from '@/lib/domain/money'

/** ترويسة صفحة إدارية: عنوان وشرح موجز وإجراء اختياري. */
export function AdminHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </header>
  )
}

/** نغمات المؤشّر — نقطة واحدة تحكم اللون والحدّ والخلفية معًا. */
const METRIC_TONE = {
  default: { value: '', icon: 'border-ink-600 bg-ink-900 text-muted', bar: 'bg-ink-500' },
  gold: { value: 'text-gold-500', icon: 'border-gold-600/40 bg-gold-500/10 text-gold-500', bar: 'bg-gold-500' },
  success: { value: 'text-success', icon: 'border-success/35 bg-success/10 text-success', bar: 'bg-success' },
  danger: { value: 'text-danger', icon: 'border-danger/40 bg-danger/10 text-danger', bar: 'bg-danger' },
} as const

export type MetricTone = keyof typeof METRIC_TONE

/**
 * عنوان مجموعة مؤشّرات.
 *
 * شريط لوني رفيع يسبق العنوان: ثلاث مجموعات متتابعة بعناوين رمادية متطابقة
 * تُقرأ كقائمة واحدة طويلة، والشريط يفصلها بلمحة بصر.
 */
export function MetricGroup({
  title,
  tone = 'default',
  children,
}: {
  title: string
  tone?: MetricTone
  children: React.ReactNode
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-muted">
        <span className={cn('h-3.5 w-1 rounded-full', METRIC_TONE[tone].bar)} />
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * بطاقة مؤشّر واحد.
 *
 * `share` نسبة المؤشّر من كلٍّ (0–1) تُرسم شريطًا تحت الرقم: «25,000 محجوزة»
 * وحدها لا تقول شيئًا، وكونها سُبع أرصدة المحافظ يقول الكثير.
 *
 * `attention` وسم «يستحقّ نظرة»: نقطة نابضة وحدّ ملوّن، لا لون رقم فقط —
 * أربع بطاقات ملوّنة في صفّ تُلغي بعضها.
 */
export function MetricCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
  icon: Icon,
  share,
  attention = false,
}: {
  label: string
  value: string
  hint?: string
  tone?: MetricTone
  href?: string
  icon?: React.ElementType
  /** نسبة من كلٍّ بين 0 و1 — تُرسم شريطًا تحت الرقم */
  share?: number
  attention?: boolean
}) {
  const palette = METRIC_TONE[tone]
  const ratio = share === undefined ? null : Math.max(0, Math.min(1, share))

  const body = (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-2xl border bg-ink-800 p-4 transition-all',
        attention ? 'border-current/40 shadow-[0_0_0_1px_currentColor]' : 'border-ink-600',
        attention && palette.value,
        href && 'hover:-translate-y-0.5 hover:border-gold-600/60 hover:shadow-raised',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-lg border',
              palette.icon,
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>

      <p className={cn('mt-1.5 flex items-center gap-2 text-2xl font-extrabold tabular-nums', palette.value)}>
        {value}
        {attention && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
        )}
      </p>

      {ratio !== null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-600">
          <div
            className={cn('h-full rounded-full transition-[width] duration-500', palette.bar)}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}

      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}

      {href && (
        <ArrowLeft className="absolute bottom-3 start-3 size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  )
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

/** مبلغ بالريال بتنسيق موحّد. */
export function Money({ value, className }: { value: Halalas; className?: string }) {
  return (
    <span className={cn('tabular-nums font-bold', className)}>
      {formatAmount(value)}
      <span className="ms-1 text-[0.75em] font-normal text-muted">ريال</span>
    </span>
  )
}

/**
 * وصف عمود واحد — يُعلَن **مرّة** فيسري على العنوان والخلايا معًا.
 *
 * قبل هذا كان العنوان يحمل محاذاته والخلية محاذاتها، فتنزاح الأرقام عن
 * عناوينها كلّما نسي أحدهما. والعرض هنا لا في `className` كي يثبت العمود بدل
 * أن يتمدّد على حساب جاره.
 */
export type AdminColumn = {
  label?: React.ReactNode
  /** منطقية لا فيزيائية: `start` أوّل السطر في اتجاه القراءة */
  align?: 'start' | 'end' | 'center'
  /** أرقام: محاذاة النهاية وأرقام متساوية العرض */
  numeric?: boolean
  /** عرض ثابت أو نسبي للعمود (`col`) */
  width?: string
  /** أقلّ عرض يمنع انكماش العمود تحت محتواه */
  minWidth?: string
}

const alignOf = (column?: AdminColumn) =>
  column?.align ?? (column?.numeric ? 'end' : 'start')

/**
 * جدول إداري متجاوب.
 *
 * على الشاشات الضيّقة يمرّر أفقيًا داخل حاويته وحدها، فلا تُدفع الصفحة كلّها
 * إلى تمرير أفقي — وهو أسوأ ما يصيب جدولًا على الجوال.
 */
export function AdminTable({
  columns,
  head,
  children,
  empty,
  minWidth = '46rem',
}: {
  /** الطريقة المفضّلة: تُبنى منها الترويسة والمحاذاة والأعراض */
  columns?: AdminColumn[]
  /** ترويسة يدوية — للجداول التي لم تُهاجر بعد */
  head?: React.ReactNode
  children: React.ReactNode
  empty?: string
  minWidth?: string
}) {
  const rows = Array.isArray(children) ? children : [children]
  const isEmpty = rows.flat().filter(Boolean).length === 0

  if (isEmpty && empty) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-10 text-center text-sm text-muted">
        {empty}
      </div>
    )
  }

  /*
   * تسميات الأعمدة تُمرَّر متغيّراتِ CSS لا خصائصَ React.
   *
   * جداول الإدارة السبعة تمرّر أفقيًّا ثلاثة أضعاف عرض الجوال، فتنقلب بطاقات
   * تحت `sm` — وذلك يحتاج أن تحمل كل خليّة اسم عمودها. والسياق لا يعبر حدّ
   * الخادم/العميل، وتعديل سبع صفحات خليّةً خليّة عبثٌ يتقادم. فالاسم يصل
   * بـ`--col-N` ويلتقطه `::before` بترتيب الخليّة.
   */
  const labelVars = Object.fromEntries(
    (columns ?? []).map((column, index) => [
      `--col-${index + 1}`,
      typeof column.label === 'string' && column.label ? `"${column.label}"` : '""',
    ]),
  ) as React.CSSProperties

  return (
    <div
      style={labelVars}
      className="admin-table overflow-x-auto rounded-2xl border border-ink-600 bg-ink-800"
    >
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        {columns && (
          <colgroup>
            {columns.map((column, index) => (
              <col
                key={index}
                style={{ width: column.width, minWidth: column.minWidth }}
              />
            ))}
          </colgroup>
        )}
        <thead>
          <tr className="border-b border-ink-600 bg-ink-900/60">
            {columns
              ? columns.map((column, index) => (
                  <Th key={index} align={alignOf(column)}>
                    {column.label}
                  </Th>
                ))
              : head}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Th({
  children,
  className,
  align = 'start',
}: {
  children?: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <th
      data-align={align}
      scope="col"
      className={cn('whitespace-nowrap px-3 py-2.5 text-xs font-bold text-muted', className)}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  align = 'start',
  numeric,
  dir,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'center'
  numeric?: boolean
  /** لخلايا تحمل نصًّا لاتينيًا (رقم مرجعي، بريد) داخل جدول عربي */
  dir?: 'ltr' | 'rtl'
}) {
  return (
    <td
      dir={dir}
      data-align={numeric ? 'end' : align}
      className={cn('px-3 py-3 align-middle', numeric && 'tabular-nums', className)}
    >
      {children}
    </td>
  )
}

export function Tr({
  children,
  className,
  ...props
}: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b border-ink-600/60 last:border-0 hover:bg-ink-900/40', className)}
      {...props}
    >
      {children}
    </tr>
  )
}
