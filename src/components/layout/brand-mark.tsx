import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { assetUrl, getBrand } from '@/lib/server/brand-service'
import { cn } from '@/lib/utils'

/**
 * شعار المنصّة واسمها — من اللوحة لا من الكود.
 *
 * يسقط إلى المطرقة الذهبية ما لم يُرفع شعار، فنسخةٌ لم تُضبط بعد لا تظهر
 * بمربّعٍ فارغ. والصورة المرفوعة تُوضع داخل المربّع نفسه بحدّه ودورانه، فلا
 * يختلف مقاسها بين ترويسةٍ وتذييل ولا تُفسد ارتفاع الصفّ.
 */
export async function BrandMark({
  className,
  nameClassName,
  href = '/',
}: {
  className?: string
  nameClassName?: string
  href?: string
}) {
  const brand = await getBrand()
  const logo = assetUrl('logo', brand.logo)

  return (
    <Link href={href} className={cn('flex shrink-0 items-center gap-2.5 font-extrabold', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold-500 text-ink-950 shadow-[var(--shadow-gold)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:-rotate-6">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- مصدره السجلّ لا الملفّات، ولا مقاسات تُولَّد له
          <img src={logo} alt="" className="size-full object-cover" />
        ) : (
          <Gavel className="size-4.5" />
        )}
      </span>
      <span className={nameClassName}>{brand.shortName}</span>
    </Link>
  )
}
