'use client'

import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/**
 * مشاركة الرابط — بورقة النظام إن وُجدت، وإلّا نسخًا.
 *
 * `navigator.share` يفتح ورقة المشاركة الأصلية على الجوال — واتساب وتويتر
 * وغيرهما — وهي ما يتوقّعه من يشارك من جواله. وعلى الحاسوب لا تُتاح غالبًا،
 * فيُنسخ الرابط ويُقال إنّه نُسخ: زرٌّ لا يقول ما فعل يُضغط مرّتين.
 */
export function ShareButton({
  title,
  copiedMessage = 'نُسخ الرابط',
  className,
}: {
  title: string
  copiedMessage?: string
  className?: string
}) {
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      toast.success(copiedMessage)
    } catch {
      // ألغى المستخدم المشاركة
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/60 px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-gold-600/50 hover:text-paper',
        className,
      )}
    >
      <Share2 className="size-3.5" />
      مشاركة
    </button>
  )
}
