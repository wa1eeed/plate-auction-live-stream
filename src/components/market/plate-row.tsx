import Link from 'next/link'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import type { Plate } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/** صف موحّد يعرض اللوحة مع محتوى جانبي — يُستخدم في كل صفحات الحساب. */
export function PlateRow({
  plate,
  href,
  children,
  aside,
  className,
  rowId,
  footer,
}: {
  plate: Plate
  href?: string
  children: React.ReactNode
  aside?: React.ReactNode
  className?: string
  /** مُعرّف الصفّ — يُميّزه عن عناصر القوائم الأخرى في الصفحة */
  rowId?: string
  /**
   * محتوى بعرض الصفّ كاملًا تحت اللوحة.
   *
   * ما لا يتّسع له عمودُ اللوحة موضعه هنا: عمود بجانب لوحة عرضها 150 بكسل
   * ينضغط على الجوال إلى كلمة في السطر.
   */
  footer?: React.ReactNode
}) {
  const body = (
    <>
      <SaudiLicensePlate
        plateType={plate.plateType}
        arabicLetters={plate.arabicLetters}
        latinLetters={plate.latinLetters}
        plateNumbers={plate.plateNumbers}
        emblem={plate.emblem}
        customEmblemUrl={plate.customEmblemUrl}
        size="thumbnail"
        showReflection={false}
        className="w-[150px] shrink-0 sm:w-[190px]"
      />
      {/* أدنى عرض يجبره على الالتفاف تحت اللوحة بدل الانضغاط بجانبها */}
      <div className="min-w-[13rem] flex-1 space-y-1.5">{children}</div>
      {aside && <div className="shrink-0 text-end">{aside}</div>}
    </>
  )

  return (
    <li
      data-row={rowId}
      className={cn(
        'rounded-2xl border border-ink-600 bg-ink-800 transition-colors',
        href && 'hover:border-gold-600/50',
        className,
      )}
    >
      {href ? (
        <Link href={href} className="flex flex-wrap items-center gap-4 p-4">
          {body}
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-4 p-4">{body}</div>
      )}
      {footer && <div className="space-y-3 px-4 pb-4">{footer}</div>}
    </li>
  )
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 p-14 text-center">
      <p className="text-base font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{hint}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
