'use client'

import { Check, ChevronDown, CircleDot, ShieldCheck, Undo2, Wallet, X } from 'lucide-react'
import { DeadlineMeter } from './deadline-meter'
import { LocalTime } from './local-time'
import { OrderTimeline } from './order-timeline'
import type {
  OrderMoneyMarker,
  OrderStepState,
  OrderTimelineStep,
} from '@/lib/domain/order-timeline'
import { cn } from '@/lib/utils'

const STATE_WORD: Record<OrderStepState, string> = {
  done: 'تمّت',
  current: 'جارية الآن',
  pending: 'لم تبدأ',
  failed: 'متعثّرة',
}

/** لون السكّة بين محطّتين — تُلوَّن بحال المحطّة التي خرجت منها. */
function railTone(state: OrderStepState): string {
  return state === 'done' ? 'bg-success' : state === 'failed' ? 'bg-danger/45' : 'bg-ink-600'
}

const MONEY_TONE: Record<
  OrderMoneyMarker['tone'],
  { text: string; caret: string; icon: React.ElementType }
> = {
  pending: { text: 'text-muted', caret: 'border-t-ink-500', icon: Wallet },
  held: { text: 'text-gold-400', caret: 'border-t-gold-500', icon: ShieldCheck },
  done: { text: 'text-success', caret: 'border-t-success', icon: Check },
  failed: { text: 'text-danger', caret: 'border-t-danger', icon: Undo2 },
}

/**
 * مسار الصفقة — سكّة أفقية بخمس محطّات.
 *
 * أفقيّ على كل المقاسات، والجوال أوّلها. وما جعله ممكنًا أن المحطّة صار اسمها
 * **كلمة** («سداد»، «نقل») لا جملة: خمس جمل تحت خمس نقاط على عرض 360px تتكسّر
 * إلى كلمات مقطّعة، فيصير الشريط أطول من الفائدة. والجملة الكاملة موضعها نداء
 * المرحلة الجارية، وتفصيلها كلّه في «تفاصيل المسار».
 *
 * وثلاثة ألوان لا لونان: **الأخضر** ما قُطع، و**الذهبي** ما يحترق الآن من مهلة
 * المرحلة الجارية، و**الرمادي** ما لم يبدأ. فيُرى الزمن على السكّة لا في رقم.
 */
export function OrderJourney({
  steps,
  money,
  className,
}: {
  steps: OrderTimelineStep[]
  /** أين المال الآن — `null` لصفقة لم يتحرّك فيها مال */
  money?: OrderMoneyMarker | null
  className?: string
}) {
  const MoneyIcon = money ? MONEY_TONE[money.tone].icon : null

  return (
    <div className={className}>
      {/*
       * أين المال — سؤال الطرفين الأوّل في صفقة ضمان: ليس «أين وصلنا» بل «أين
       * مالي». والمحطّات الخمس وحدها لا تقول إن المبلغ محبوس لدى المنصّة لا عند
       * أحدهما.
       *
       * وجملةً كاملةً مرئية لا كلمةً في رقاقة وجملةً في `sr-only`: كان المُبصر
       * يقرأ «أمانة» ويقرأ قارئُ الشاشة «المبلغ محجوز أمانةً لدى المنصّة» —
       * انقلابٌ للأولويات في أثمن ما تحمله الصفقة.
       */}
      {money && MoneyIcon && (
        <p
          data-money={money.tone}
          className={cn(
            'mb-2.5 flex items-start gap-1.5 text-[11px] font-bold leading-snug',
            MONEY_TONE[money.tone].text,
          )}
        >
          <MoneyIcon className="mt-px size-3.5 shrink-0" />
          <span className="min-w-0">{money.label}</span>
        </p>
      )}

      <ol className="flex items-start pt-2">
        {steps.map((step, index) => {
          const first = index === 0
          const last = index === steps.length - 1
          const burn = step.state === 'current' ? Math.round((step.progress ?? 0) * 100) : 0
          const marker = money && money.index === index ? money : null

          return (
            <li
              key={step.key}
              data-stage={step.state}
              aria-current={step.state === 'current' ? 'step' : undefined}
              className="relative flex min-w-0 flex-1 flex-col items-center"
            >
              {/* مَعلمٌ صامت يربط جملة المال بمحطّتها — الجملة فوق، والإشارة هنا */}
              {marker && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute -top-1.5 inset-inline-0 mx-auto z-20 size-0 border-x-[4px] border-t-[5px] border-x-transparent lg:-top-2 lg:border-x-[5px] lg:border-t-[6px]',
                    MONEY_TONE[marker.tone].caret,
                  )}
                />
              )}

              {/* نصف السكّة نحو المحطّة السابقة، ولونه من حال تلك المحطّة */}
              {!first && (
                <span
                  aria-hidden
                  style={{ '--rail-delay': `${index * 70}ms` } as React.CSSProperties}
                  className={cn(
                    'rail-draw absolute top-[9px] start-0 end-1/2 h-1.5 rounded-full lg:top-2 lg:h-2',
                    railTone(steps[index - 1].state),
                  )}
                />
              )}

              {/* ونصفها نحو التالية */}
              {!last && (
                <span
                  aria-hidden
                  style={{ '--rail-delay': `${index * 70 + 35}ms` } as React.CSSProperties}
                  className={cn(
                    'rail-draw absolute top-[9px] start-1/2 end-0 h-1.5 rounded-full lg:top-2 lg:h-2',
                    railTone(step.state),
                  )}
                />
              )}

              {/*
               * ما احترق من مهلة المرحلة الجارية — من محطّتها إلى التالية.
               *
               * وعرضه عرضُ الخانة كاملًا لا نصفَها: المسافة بين محطّتين تساوي
               * خانةً واحدة (نصفٌ من هذه ونصفٌ من تلك)، فلو حُبس في النصف
               * لتوقّف الذهب عند منتصف الطريق وهو ممتلئ — فيقرأ نصفَ مهلةٍ
               * وقد انقضت كلّها.
               */}
              {!last && burn > 0 && (
                <span
                  aria-hidden
                  className="absolute top-[9px] start-1/2 h-1.5 w-full overflow-hidden rounded-full lg:top-2 lg:h-2"
                >
                  <span
                    className="block h-full rounded-full bg-gold-500 transition-[width] duration-500"
                    style={{ width: `${burn}%` }}
                  />
                </span>
              )}

              {/* المحطّة: الشكل يقول الحالة قبل اللون — ممتلئة، أو حلقة، أو نقطة */}
              <span className="relative z-10 flex h-5 items-center justify-center lg:h-6">
                {step.state === 'current' ? (
                  <span className="stage-halo flex size-5 items-center justify-center rounded-full border-[3px] border-gold-500 bg-ink-800 lg:size-6 lg:border-4" />
                ) : step.state === 'done' ? (
                  <span className="size-3.5 rounded-full bg-success ring-4 ring-ink-800 lg:size-4" />
                ) : step.state === 'failed' ? (
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-danger ring-4 ring-ink-800 lg:size-4">
                    <X className="size-2.5 text-paper" strokeWidth={4} />
                  </span>
                ) : (
                  <span className="size-2.5 rounded-full bg-ink-600 ring-4 ring-ink-800 lg:size-3" />
                )}
              </span>

              <p
                className={cn(
                  'mt-2 text-center text-[11px] leading-tight lg:mt-2.5 lg:text-xs',
                  step.state === 'current'
                    ? 'font-bold text-gold-400'
                    : step.state === 'failed'
                      ? 'font-bold text-danger'
                      : step.state === 'done'
                        ? 'text-muted'
                        : 'text-muted',
                )}
              >
                {step.short}
                <span className="sr-only">
                  {' — '}
                  {step.label} ({STATE_WORD[step.state]})
                </span>
              </p>
              {/*
               * ختم المحطّة — على الواسع وحده.
               *
               * السكّة على شاشة عريضة تُمَطّ إلى تسعمئة بكسل، فتصير خمس نقاط
               * صغيرة على خيط طويل. والمساحة الفائضة تُملأ بما ينفع: ختمُ كل
               * محطّة يصيّرها خطًّا زمنيًّا يُقرأ، لا صفًّا منتظرًا.
               */}
              {step.at && (
                <p className="mt-1 hidden text-center text-[10px] tabular-nums text-muted lg:block">
                  <LocalTime iso={step.at} mode="date" />
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {/* التفصيل موجود لمن أراده، ومطويّ عمّن لا يريده — بلا جافاسكربت */}
      <details className="group mt-3.5">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-muted transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
          تفاصيل المسار
        </summary>
        <div className="mt-3 border-t border-ink-600 pt-3">
          <OrderTimeline steps={steps} />
        </div>
      </details>
    </div>
  )
}

/**
 * نداء المرحلة الحالية: **ما المطلوب الآن، وممّن، وحتى متى.**
 *
 * المسار يقول أين نحن؛ وهذا يقول ما يُفعل. وبدونه يقرأ المستخدم خمس محطّات ثم
 * يسأل «وأنا؟».
 */
export function OrderStageCallout({
  step,
  deadline,
  serverTime,
  audience,
  action,
  bare = false,
}: {
  step: OrderTimelineStep
  /** موعد ينتهي عنده الدور — يُعرض عدّادًا */
  deadline?: string | null
  /** مرجع وقت الخادم، فلا ينحرف العدّاد بساعة الجهاز */
  serverTime: string
  /** الدور عليك أم على غيرك؟ */
  audience: 'you' | 'other'
  action?: React.ReactNode
  /**
   * بلا إطار ولا أرضيّة.
   *
   * داخل بطاقة الصفقة يحمل النداءَ شريطُها الملوّن نفسه، وإطارٌ ثانٍ داخل
   * إطار يصنع صندوقًا في صندوق يضيّق النصّ ولا يضيف معنى.
   */
  bare?: boolean
}) {
  const Icon = step.state === 'failed' ? X : step.state === 'done' ? Check : CircleDot
  const yours = audience === 'you' && step.state !== 'done'

  return (
    <div
      className={cn(
        bare && 'flex flex-wrap items-end justify-between gap-x-6 gap-y-3',
        !bare && 'rounded-xl border p-3.5',
        !bare &&
          (step.state === 'failed'
            ? 'border-danger/45 bg-danger/[0.06]'
            : yours
              ? 'border-gold-600/50 bg-gold-500/[0.07]'
              : 'border-ink-600 bg-ink-900/50'),
      )}
    >
      <div className={cn(bare && 'min-w-0 flex-1 basis-64')}>
      <p
        className={cn(
          'flex items-center gap-1.5 text-sm font-bold',
          step.state === 'failed'
            ? 'text-danger'
            : step.state === 'done'
              ? 'text-success'
              : yours
                ? 'text-gold-400'
                : 'text-paper',
        )}
      >
        <Icon className="size-4 shrink-0" />
        {step.label}
        {/* من عليه الدور يُقال صراحةً لا يُستنتج من لون */}
        {step.state === 'current' && (
          <span
            className={cn(
              'rounded-full border px-1.5 py-px text-[10px] font-bold',
              yours ? 'border-gold-600/60 text-gold-400' : 'border-ink-500 text-muted',
            )}
          >
            {yours ? 'دورك' : 'ننتظر الطرف الآخر'}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{step.hint}</p>

      {/*
        * المهلة عدّادٌ يعبر الصفر لا سطرٌ يموت عنده.
        *
        * كان «يتبقّى ٠٠:٠٠» بعد انقضائها — ومن تأخّر لا يعرف أساعةً تأخّر أم
        * ثلاثة أيام، والفرق بينهما هو الفرق بين تنبيهٍ ومصادرةِ عربون.
        */}
      {deadline && (
        <p className="mt-2.5">
          <DeadlineMeter
            deadline={deadline}
            serverTime={serverTime}
            label="يتبقّى"
            overdueLabel="تأخّر منذ"
          />
        </p>
      )}
      </div>
      {action && <div className={cn('flex flex-wrap gap-2', !bare && 'mt-3')}>{action}</div>}
    </div>
  )
}
