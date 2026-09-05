import Link from 'next/link'
import { Gavel } from 'lucide-react'
import { assetUrl, getBrand } from '@/lib/server/brand-service'
import { cn } from '@/lib/utils'

/**
 * شعار المنصّة واسمها — من اللوحة لا من الكود.
 *
 * والشعار المرفوع **لا يُحبس في مربّع**: كان يُقصّ داخل إطارٍ ذهبيّ مربّع
 * بـ`object-cover`، فشعارٌ عريض يُقصّ طرفاه وشعارٌ فيه اسمٌ يُقرأ نصفه. وذلك
 * الإطار زينةٌ لبديلٍ لا شعار له — أمّا الشعار نفسه فيُعرض كما رُفع: بارتفاعٍ
 * محدود ونسبةٍ محفوظة، وبلا أرضيّة ولا حدّ يزاحمه.
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

  const showLogo = brand.brandDisplay !== 'nameOnly'
  const showName = brand.brandDisplay !== 'logoOnly' || !logo

  return (
    <Link href={href} className={cn('flex shrink-0 items-center gap-2.5 font-extrabold', className)}>
      {showLogo &&
        (logo ? (
          /*
            * `h-9 w-auto`: الارتفاع يوحّد الصفّ والعرض يتبع نسبة الصورة.
            * eslint-disable-next-line @next/next/no-img-element -- مصدره السجلّ لا الملفّات
            */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-9 w-auto max-w-[10rem] object-contain" />
        ) : (
          // البديل وحده يحتاج إطارًا: أيقونةٌ بلا صندوق لا تُقرأ شعارًا
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-ink-950 shadow-[var(--shadow-gold)] transition-transform duration-[var(--duration-base)] ease-[var(--ease-spring)] group-hover:-rotate-6">
            <Gavel className="size-4.5" />
          </span>
        ))}

      {showName && <span className={nameClassName}>{brand.shortName}</span>}
    </Link>
  )
}
