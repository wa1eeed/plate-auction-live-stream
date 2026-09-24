import Link from 'next/link'
import { Flame } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { CompactCountdown } from '@/components/market/auction-countdown'
import { formatAmount } from '@/lib/domain/money'
import type { ListingCard } from '@/lib/domain/types'

/** كم مزادًا يُعرض — صفٌّ يُمسح بنظرة، لا قائمةٌ تُتصفَّح. */
const SHOWN = 6

/**
 * **ما ينتهي قريبًا — أوّل ما يفتح عليه التطبيق.**
 *
 * وصفحةُ الويب تفتح على تعريفٍ بالمنصّة، وهو صوابٌ لزائرٍ لا يعرفها. أمّا من
 * فتح التطبيق فقد عرفها وثبّتها، وإنّما جاء ليرى **ما يفوته**. والمزادُ
 * ينتهي بالساعة، فتأخيرُه خلف بطلٍ تعريفيّ يُضيّع سببَ الفتح.
 *
 * وترتيبُه بالأقرب انتهاءً لا بالأحدث إضافةً: الإلحاح هو الخبر هنا.
 */
export function EndingSoon({
  cards,
  serverTime,
}: {
  cards: ListingCard[]
  serverTime: string
}) {
  const soonest = cards
    .filter((card) => card.endsAt && card.remainingMs > 0)
    .sort((a, b) => a.remainingMs - b.remainingMs)
    .slice(0, SHOWN)

  if (soonest.length === 0) return null

  return (
    <section aria-labelledby="ending-soon" className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 id="ending-soon" className="flex items-center gap-1.5 text-sm font-extrabold">
          <Flame className="size-4 text-gold-500" />
          ينتهي قريبًا
        </h2>
        <Link href="/market?sale=auction" className="text-xs font-bold text-gold-500">
          الكلّ
        </Link>
      </div>

      {/*
        * صفٌّ أفقيٌّ يلتقط الإصبع — ولا يُلفّ في شبكة.
        *
        * والالتقاطُ (`snap`) يجعل البطاقة تستقرّ في موضعها بعد السحب، وهو ما
        * يفرّق الإحساسَ الأصيل عن قائمةِ ويب تنزلق كيفما اتّفق.
        */}
      <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {soonest.map((card) => (
          <li key={card.id} className="w-[13.5rem] shrink-0 snap-start">
            <Link
              href={`/market/${card.id}`}
              className="surface block rounded-2xl p-2.5 transition-colors hover:border-gold-600/50"
            >
              <div className="overflow-hidden rounded-xl">
                <SaudiLicensePlate
                  plateType={card.plate.plateType}
                  plateFormat={card.plate.plateFormat}
                  arabicLetters={card.plate.arabicLetters}
                  latinLetters={card.plate.latinLetters}
                  plateNumbers={card.plate.plateNumbers}
                  emblem={card.plate.emblem}
                  customEmblemUrl={card.plate.customEmblemUrl}
                  size="fill"
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold tabular-nums text-paper">
                  {formatAmount(card.displayPrice)}
                </span>
                <CompactCountdown endsAt={card.endsAt} serverTime={serverTime} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
