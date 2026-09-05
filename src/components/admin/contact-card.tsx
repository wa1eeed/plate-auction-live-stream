import Link from 'next/link'
import { ExternalLink, Ghost, Instagram, Mail, Music2, Phone } from 'lucide-react'
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  SOCIAL_URL,
  type SocialHandles,
  type SocialPlatform,
} from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const ICONS: Record<SocialPlatform, React.ElementType> = {
  tiktok: Music2,
  snapchat: Ghost,
  instagram: Instagram,
}

/**
 * وسائل التواصل مع مستخدم — للإدارة وحدها.
 *
 * الجوال **لا يظهر لمستخدم آخر** في أي موضع من السوق؛ هنا يظهر لأن الإدارة
 * تحتاجه لحسم صفقة متعثّرة أو التحقّق من حوالة. وحسابات التواصل تُفتح في نافذة
 * جديدة فلا تُدفع الإدارة خارج لوحتها.
 */
export function ContactCard({
  email,
  phone,
  social,
  className,
}: {
  /*
   * البريد هنا لا في قائمة المستخدمين.
   *
   * لا يُقرَّر به شيء وهو يُمسح بالعين في قائمة، وهو مع ذلك بيانٌ شخصيّ يُعرض
   * على شاشةٍ قد تُشارَك أو تُصوَّر. وموضعه صفحة صاحبه، حيث يُقصَد قصدًا.
   */
  email: string
  phone: string | null
  social: SocialHandles
  className?: string
}) {
  const links = SOCIAL_PLATFORMS.filter((platform) => social[platform])

  return (
    <div className={cn('rounded-2xl border border-ink-600 bg-ink-800 p-4', className)}>
      <h2 className="mb-3 text-sm font-bold">وسائل التواصل</h2>

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`mailto:${email}`}
          dir="ltr"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-3 py-1.5 text-xs font-bold transition-colors hover:border-gold-600/50 hover:text-gold-500"
        >
          <Mail className="size-3.5 shrink-0" />
          <span className="truncate">{email}</span>
        </a>

        {phone ? (
          <a
            href={`tel:${phone.replace(/\s/g, '')}`}
            dir="ltr"
            className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:border-gold-600/50 hover:text-gold-500"
          >
            <Phone className="size-3.5" />
            {phone}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-ink-600 px-3 py-1.5 text-xs text-muted">
            <Phone className="size-3.5" />
            لا جوال مسجَّل
          </span>
        )}

        {links.map((platform) => {
          const Icon = ICONS[platform]
          const handle = social[platform]!
          return (
            <Link
              key={platform}
              href={SOCIAL_URL[platform](handle)}
              target="_blank"
              rel="noopener noreferrer"
              title={SOCIAL_LABELS[platform]}
              /* الاسم وحده لا يقول إلى أين يقود الرابط لقارئ الشاشة */
              aria-label={`${SOCIAL_LABELS[platform]} — @${handle}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-3 py-1.5 text-xs font-semibold transition-colors hover:border-gold-600/50 hover:text-gold-500"
            >
              <Icon className="size-3.5" />
              <span dir="ltr">@{handle}</span>
              <ExternalLink className="size-3 opacity-60" />
            </Link>
          )
        })}
      </div>

      {links.length === 0 && (
        <p className="mt-2 text-[11px] text-muted">
          لم يُسجّل حسابات تواصل — لا يمكن نسبة اللوحة إليه في بثّ مباشر.
        </p>
      )}
    </div>
  )
}

/** حسابات التواصل مضغوطة — لخلية جدول لا تحتمل بطاقة. */
export function SocialLinks({
  social,
  className,
}: {
  social: SocialHandles
  className?: string
}) {
  const links = SOCIAL_PLATFORMS.filter((platform) => social[platform])
  if (links.length === 0) return null

  return (
    <span className={cn('mt-1 flex items-center gap-1.5', className)}>
      {links.map((platform) => {
        const Icon = ICONS[platform]
        const handle = social[platform]!
        return (
          <Link
            key={platform}
            href={SOCIAL_URL[platform](handle)}
            target="_blank"
            rel="noopener noreferrer"
            title={`${SOCIAL_LABELS[platform]} — @${handle}`}
            aria-label={`${SOCIAL_LABELS[platform]} ${handle}`}
            className="text-muted transition-colors hover:text-gold-500"
          >
            <Icon className="size-3.5" />
          </Link>
        )
      })}
    </span>
  )
}
