'use client'

import Link from 'next/link'
import { CheckCircle2, ExternalLink, LayoutList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { formatTimestamp } from '@/lib/utils'
import type { Listing } from '@/lib/domain/types'

/**
 * ما يقع بعد النشر، بحسب طريقة البيع.
 *
 * البائع ضغط «حفظ ونشر» فوقعت اللوحة في السوق — والسؤال الذي يليه واحد: وماذا
 * الآن؟ فيُقال له ما ينتظره لا أنّ العملية نجحت وحدها.
 */
function nextStep(listing: Listing): string {
  if (listing.saleType === 'auction') {
    return listing.endsAt
      ? `المزاد شغّال الآن وينتهي ${formatTimestamp(listing.endsAt)}. يصلك إشعار مع كل مزايدة.`
      : 'المزاد شغّال الآن، ويصلك إشعار مع كل مزايدة.'
  }
  if (listing.saleType === 'fixed') {
    return 'لوحتك معروضة للبيع المباشر، ويصلك إشعار لحظة شرائها.'
  }
  return 'لوحتك مفتوحة لاستقبال العروض، ويصلك إشعار مع كل عرض يردك.'
}

/**
 * بشارة النشر.
 *
 * كان النشر يمرّ بإشعارٍ عابر ثمّ قفزة إلى قائمة اللوحات — فلا يرى البائع
 * لوحته في السوق ولا يعرف أين صارت. وهذه الوقفة تُريه إيّاها وتفتح له بابين:
 * أن يراها كما يراها المشترون، أو يعود إلى إدارة لوحاته.
 *
 * ولا إغلاق في فراغ: من أغلقها بلا اختيار يمضي إلى إدارة لوحاته، فلا يبقى
 * واقفًا في نموذجٍ فرغ منه.
 */
export function ListingPublishedDialog({
  listing,
  onDismiss,
}: {
  /** اللوحة كما عادت من الخادم بعد النشر — و`null` تُبقي النافذة مغلقة */
  listing: Listing | null
  onDismiss: () => void
}) {
  return (
    <Dialog open={listing !== null} onOpenChange={(open) => !open && onDismiss()}>
      {listing && (
        <DialogContent className="w-[min(96vw,32rem)] gap-0 overflow-hidden p-0">
          {/*
            * صدرٌ ملوّن ثمّ متن هادئ.
            *
            * علامة النجاح تُقرأ قبل الحروف: هالةٌ ذهبية حول علامة صحّ في رأس
            * النافذة، ثمّ يهدأ اللون في المتن فلا يزاحم اللوحةَ نفسها.
            */}
          <div className="relative isolate overflow-hidden border-b border-ink-600 bg-gold-500/10 px-6 pb-5 pt-7 text-center">
            <span
              aria-hidden
              className="absolute inset-x-0 -top-24 -z-10 mx-auto h-48 w-48 rounded-full bg-gold-500/20 blur-3xl"
            />
            <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-500 ring-1 ring-gold-500/30">
              <CheckCircle2 className="size-7" />
            </span>
            <DialogTitle className="text-xl">نُشرت لوحتك في السوق</DialogTitle>
            <DialogDescription className="mx-auto mt-1.5 max-w-sm leading-relaxed">
              {nextStep(listing)}
            </DialogDescription>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            {/*
              * اللوحة بعرضٍ ثابت ونسبتها هي التي تحكم ارتفاعها.
              *
              * كما تُعرض في السوق وفي صفحة اللوحة: الاعتيادية ترتفع والطويلة
              * تمتدّ. والحصر في ارتفاعٍ واحد يصلح لرأس النموذج حيث تتبدّل
              * الإصدارات ولا يُراد للصفحة أن تقفز — أمّا هنا فلوحةٌ واحدة
              * تُرى مرّة، فتُعرض بمقاسها لا بمقاس صندوقها.
              */}
            <div className="mx-auto w-full max-w-[380px]">
              <SaudiLicensePlate
                plateType={listing.plateType}
                plateFormat={listing.plateFormat}
                arabicLetters={listing.arabicLetters}
                latinLetters={listing.latinLetters}
                plateNumbers={listing.plateNumbers}
                emblem={listing.emblem}
                customEmblemUrl={listing.customEmblemUrl}
                size="fullscreen"
              />
            </div>

            <p className="text-center text-xs text-muted">
              رقم الإعلان <span className="font-bold text-paper">{listing.reference}</span>
            </p>

            {/*
              * الزرّان في عمود على الجوال وصفٍّ على الشاشة.
              *
              * و«شاهدها في السوق» يفتح لسانًا جديدًا: البائع لا يزال في مسار
              * الإضافة، فلا يُخرَج منه ليعود بزرّ الرجوع.
              */}
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              <Button asChild size="lg" className="flex-1">
                <a href={`/market/${listing.id}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  شاهد لوحتك في السوق
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="flex-1">
                <Link href="/account/listings" onClick={onDismiss}>
                  <LayoutList className="size-4" />
                  إدارة لوحاتي
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
