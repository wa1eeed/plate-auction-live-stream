import { AlertTriangle, ArrowUpLeft, CircleCheck, IdCard, Wallet } from 'lucide-react'
import {
  ABSHER_FEES,
  ABSHER_PLATES_URL,
  BUYER_TRANSFER_STEPS,
  SELLER_TRANSFER_STEPS,
  SELLER_WALLET_PREREQUISITE,
  type TransferStep,
} from '@/lib/domain/absher-transfer'
import type { TransferIdentity } from '@/lib/domain/types'
import { cn } from '@/lib/utils'
import { BuyerIdentityPanel } from './buyer-identity-panel'

/**
 * **دليلُ نقل الملكيّة — خطوةً خطوة، لصاحب الدور.**
 *
 * والمنصّةُ لا تنقل ملكيّةً: النقلُ يقع في أبشر بين الحسابين، وهي تحجز
 * المالَ حتى يقع. فكان ما يصل الطرفين في هذه المرحلة جملةً واحدة — «انقل
 * الملكية عبر أبشر أولًا» — ثمّ يُترك كلٌّ يبحث عن الطريق. **وهذه أطولُ
 * مرحلةٍ في الرحلة وأكثرُها تعثّرًا**، لأنّ الخطوات في نظامٍ آخر لا نملكه.
 *
 * فصارت الخطواتُ مكتوبةً بترتيبها وبصوت صاحبها:
 *
 * - **ودورُ كلٍّ يُفرَّق عن انتظاره**: البائعُ في `escrow_held` يفعل، والمشتري
 *   ينتظر — ويُقال له ما سيُطلب منه **قبل** أن يُطلب، فلا يفاجئه إشعارٌ من
 *   أبشر لا يعرف ما يصنع به.
 * - **والشرطُ قبل الخطوة الأولى**: لوحةٌ راكبةٌ على سيّارة البائع لا يظهر
 *   لها خيارُ نقلٍ مجرّدٍ في أبشر أصلًا، ولا تقول الخدمةُ لماذا. وهو أكثرُ
 *   ما يُعطّل الصفقات، فيُقال أوّلًا لا في ذيل الصفحة.
 * - **والرسومُ معها**: رسومٌ حكوميّةٌ تُدفع في سداد لا تمرّ بالمنصّة — ومن
 *   يكتشفها عند الدفع يظنّها من عندنا.
 */
export function TransferGuide({
  side,
  /** أهو الدورُ عليه الآن؟ وإلّا فهي تهيئةٌ لما سيُطلب منه */
  active,
  /** بياناتُ المشتري — تُعرض للبائع عند خطوتها لا في صفحةٍ أخرى */
  identity,
}: {
  side: 'buyer' | 'seller'
  active: boolean
  identity?: TransferIdentity | null
}) {
  const seller = side === 'seller'
  const steps = seller ? SELLER_TRANSFER_STEPS : BUYER_TRANSFER_STEPS

  return (
    <section
      className={cn(
        'rounded-2xl border p-4',
        active ? 'border-gold-600/50 bg-gold-500/[0.06]' : 'border-ink-600 bg-ink-800',
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <IdCard className={cn('size-4 shrink-0', active ? 'text-gold-500' : 'text-muted')} />
          {seller ? 'كيف تنقل اللوحة في أبشر' : 'كيف تستلم اللوحة في أبشر'}
        </h2>
        {/*
          * ولا يُقال «الدور عليك» لمن ليس عليه الدور.
          *
          * فالمشتري يقرأ خطواتِه وهو ينتظر البائع — وشارةٌ تقول «دورك» على
          * شيءٍ لم يصل بعدُ تدفعه إلى أبشر يبحث عن طلبٍ ليس فيه.
          */}
        <span
          className={cn(
            'rounded-full border px-2.5 py-0.5 text-[11px] font-bold',
            active
              ? 'border-gold-600/45 bg-gold-500/12 text-gold-400'
              : 'border-ink-600 bg-ink-900/60 text-muted',
          )}
        >
          {active ? 'دورك الآن' : seller ? 'بعد وصول المبلغ' : 'بعد أن يُرسل البائع الطلب'}
        </span>
      </header>

      {/*
        * شرطُ البائع قبل خطواته — لا بعدها.
        *
        * فمن قرأ ستَّ خطواتٍ ثمّ فتح أبشر ولم يجد الخيارَ رجع يظنّ العطبَ في
        * المنصّة. وفصلُ اللوحة إجراءٌ ثالثٌ لا يعرفه كثيرون، فيُطوى لمن لا
        * يحتاجه ويُفتح لمن يحتاجه.
        */}
      {seller && (
        <div className="mt-3 rounded-xl border border-danger/35 bg-danger/[0.06] p-3">
          <p className="flex items-start gap-2 text-xs font-bold text-danger">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            {SELLER_WALLET_PREREQUISITE.title}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            {SELLER_WALLET_PREREQUISITE.body}
          </p>
          <details className="group mt-2">
            <summary className="cursor-pointer list-none text-[11px] font-bold text-paper underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
              خطوات فصل اللوحة من السيّارة إلى المحفظة
            </summary>
            <Steps steps={SELLER_WALLET_PREREQUISITE.detachSteps} tone="muted" className="mt-2" />
          </details>
        </div>
      )}

      <Steps steps={steps} tone={active ? 'gold' : 'muted'} className="mt-3" />

      {/*
        * **وبياناتُ المشتري تحت خطوتها مباشرةً.**
        *
        * فالخطوةُ الخامسة تقول «أدخل بيانات المشتري» — ومن قرأها فتح
        * واتساب يبحث عنها. وهي عندنا: قالها المشتري في صفحة صفقته.
        */}
      {seller && <BuyerIdentityPanel identity={identity ?? null} className="mt-3" />}

      {/*
        * الرسومُ حيث تُفعل الخطوة — لا في صفحة أسئلة.
        *
        * فهي حكوميّةٌ تُدفع في سداد ولا تمرّ بالمنصّة، ومن يكتشفها عند الدفع
        * يظنّها عمولةً خفيّةً من عندنا. وتُقال لكلٍّ حصّتُه هو: البائعُ لا
        * يعنيه رسمُ النقل، والمشتري لا يعنيه أنّ البائع فعّل محفظته.
        */}
      <dl className="mt-3 space-y-1.5 border-t border-ink-600/70 pt-3 text-[11px]">
        <p className="flex items-center gap-1.5 font-bold text-muted">
          <Wallet className="size-3.5 shrink-0" />
          رسوم أبشر الحكوميّة — تُدفع في سداد ولا تمرّ بالمنصّة
        </p>
        {!seller && (
          <Fee label="نقل ملكية اللوحة" value={ABSHER_FEES.transfer} note="على المشتري بالعرف" />
        )}
        <Fee
          label="تفعيل محفظة اللوحات"
          value={ABSHER_FEES.walletActivation}
          note="مرّةً واحدة، ويدفعها كلُّ طرفٍ عن نفسه"
        />
      </dl>

      <a
        href={ABSHER_PLATES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors',
          active
            ? 'border-gold-600 bg-gold-500 text-ink-950 hover:bg-gold-400'
            : 'border-ink-600 bg-ink-900/60 text-paper hover:border-gold-600/50',
        )}
      >
        افتح أبشر
        <ArrowUpLeft className="size-4" />
      </a>
    </section>
  )
}

/** قائمةٌ مرقّمةٌ — الرقمُ دائرةٌ لا نقطة، فيُقرأ ترتيبًا لا تعدادًا. */
function Steps({
  steps,
  tone,
  className,
}: {
  steps: readonly TransferStep[]
  tone: 'gold' | 'muted'
  className?: string
}) {
  return (
    <ol className={cn('space-y-2.5', className)}>
      {steps.map((step, index) => (
        <li key={step.title} className="flex items-start gap-2.5">
          <span
            aria-hidden
            className={cn(
              'mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums',
              tone === 'gold' ? 'bg-gold-500 text-ink-950' : 'bg-ink-700 text-muted',
            )}
          >
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold leading-relaxed text-paper">
              {step.title}
            </span>
            {step.detail && (
              <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                {step.detail}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Fee({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-muted">
        {label} <span className="text-[10px] opacity-80">— {note}</span>
      </dt>
      <dd className="flex items-center gap-1 font-bold tabular-nums text-paper">
        <CircleCheck className="size-3 text-success" />
        {value} ريال
      </dd>
    </div>
  )
}
