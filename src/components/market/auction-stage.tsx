'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Crown, Eye, ShieldAlert, ShieldCheck } from 'lucide-react'
import { AuctionCountdown } from './auction-countdown'
import { ConnectionBadge } from './connection-badge'
import { formatAmount } from '@/lib/domain/money'
import type { ListingDetail } from '@/lib/domain/types'
import type { ConnectionStatus } from '@/lib/hooks/use-listing'
import { cn } from '@/lib/utils'

/**
 * مسرح المزاد — لا بطاقة سعر.
 *
 * كان صندوقًا بيج مسطّحًا تتراصّ فيه أربعة أشياء مختلفة المعنى بفواصل شعرية:
 * الوسم، والرقم، والمتصدّر، والعدّاد، و«المزايدة التالية». كلٌّ منها بحجمٍ
 * قريب من جاره، فلا شيء يسبق شيئًا وتُقرأ الكتلة بالبحث لا بالنظر.
 *
 * وهنا ثلاث طبقات صريحة: **شريطٌ حيّ** فوق يقول إن ما تراه يقع الآن، ثمّ
 * **الرقم** وحده في حجمٍ لا ينازعه شيء ومعه من يتصدّر، ثمّ **الزمن** في قاعٍ
 * غائر منفصل. و«المزايدة التالية» حُذفت من هنا: صندوق المزايدة يقولها في
 * موضع الفعل، وذكرها مرّتين يجعل الرقمين يتنافسان على الانتباه.
 */
export function AuctionStage({
  detail,
  status,
  viewers,
}: {
  detail: ListingDetail
  status: ConnectionStatus
  viewers: number
}) {
  const price = detail.highestAmount ?? detail.startingPrice
  const opening = detail.highestAmount === null

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-gold-600/45',
        // سطحٌ متدرّج لا لونٌ واحد: يعطي الكتلة عمقًا بلا طبقةٍ إضافية
        'bg-gradient-to-b from-gold-500/[0.10] via-ink-800 to-ink-800',
      )}
    >
      {/* توهّج ذهبيّ خافت خلف الرقم — يُحسّ ولا يُقرأ */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 start-1/2 size-56 -translate-x-1/2 rounded-full bg-gold-500/15 blur-3xl"
      />

      <header className="relative flex items-center justify-between gap-2 border-b border-gold-600/25 px-4 py-2.5">
        <ConnectionBadge status={status} />
        {viewers > 1 && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Eye className="size-3.5" />
            {viewers} يشاهدون الآن
          </span>
        )}
      </header>

      <div className="relative px-4 py-5 sm:px-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          {opening ? 'السعر الافتتاحي' : 'أعلى مزايدة'}
        </p>

        {/*
          * الرقم يدخل من أسفل عند كل مزايدة تصل.
          *
          * `key` هو المبلغ، فيُعاد تركيب العنصر حين يتغيّر وحده — وحركةٌ عند
          * كل إعادة رسم تجعل الرقم يرتجف بلا سبب في صفحةٍ تُحدَّث كل ثانية.
          */}
        <AnimatePresence mode="wait">
          <motion.p
            key={price}
            data-live-price
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
            className="mt-1 text-[2.5rem] font-extrabold leading-none tracking-tight text-gold-500 tabular-nums sm:text-5xl"
          >
            {formatAmount(price)}
            <span className="ms-2 text-base font-bold">ريال</span>
          </motion.p>
        </AnimatePresence>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {detail.highestBidderName && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
                detail.iAmHighest
                  ? 'bg-success/15 text-success'
                  : 'bg-ink-700/70 text-muted',
              )}
            >
              <Crown className={cn('size-3.5', detail.iAmHighest ? 'text-success' : 'text-gold-500')} />
              {detail.iAmHighest ? 'أنت المتصدّر' : detail.highestBidderName}
            </span>
          )}
          <ReservePill state={detail.reserveState} />
          <span className="text-[11px] text-muted">
            {detail.bidCount > 0 ? `${detail.bidCount} مزايدة` : 'لا مزايدات بعد'}
          </span>
        </div>
      </div>

      {/* قاعٌ غائر للزمن: يُفصل عن الرقم فلا يتنازعان الانتباه */}
      {detail.endsAt && (
        <div className="relative border-t border-gold-600/25 bg-ink-900/45 px-4 py-3 sm:px-5">
          <AuctionCountdown
            endsAt={detail.endsAt}
            serverTime={detail.serverTime}
            durationSeconds={detail.durationSeconds}
            className="border-0 bg-transparent p-0 sm:p-0"
          />
        </div>
      )}
    </section>
  )
}

function ReservePill({ state }: { state: ListingDetail['reserveState'] }) {
  if (state === 'unknown') return null
  const met = state === 'met'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold',
        met ? 'bg-success/15 text-success' : 'bg-gold-500/15 text-gold-400',
      )}
    >
      {met ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
      {met ? 'تجاوز السعر الاحتياطي' : 'لم يبلغ السعر الاحتياطي'}
    </span>
  )
}
