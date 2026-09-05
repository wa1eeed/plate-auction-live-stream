'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ShieldCheck, Sparkles } from 'lucide-react'
import { SaudiLicensePlate } from '@/components/plate/SaudiLicensePlate'
import { formatAmount } from '@/lib/domain/money'
import type { AccountOrder } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

/**
 * لحظة تُذكَر.
 *
 * صفقةٌ اكتملت كانت تُعلَن بشارة رمادية في صفّ — وهي أهمّ ما يقع في المنصّة:
 * لوحةٌ صارت لك، أو مالٌ وصل محفظتك. فتُعلَن مرّة واحدة لصاحبها بلوحته
 * ورقمه، ثم تُطوى ولا تعود: احتفاءٌ يتكرّر يصير ضجيجًا.
 *
 * والذاكرة في `localStorage` لا في الخادم: زينةٌ لا تستحقّ حقلًا في قاعدة
 * البيانات ولا طلبًا إضافيًّا، وأسوأ ما يقع أن تُعرض مرّتين على جهازين.
 */
export function DealWon({ order, side }: { order: AccountOrder; side: 'buyer' | 'seller' }) {
  const [shown, setShown] = useState(false)
  const reduced = useReducedMotion()
  const key = useRef(`pa_celebrated:${order.id}`)

  useEffect(() => {
    if (order.status !== 'completed') return
    try {
      if (window.localStorage.getItem(key.current)) return
      window.localStorage.setItem(key.current, '1')
      setShown(true)
    } catch {
      // متصفّح يمنع التخزين: لا احتفاء خيرٌ من احتفاء يتكرّر كل فتح
    }
  }, [order.status])

  if (!shown) return null

  const amount = side === 'seller' ? order.settlement.net : order.amount
  // ولا يُذكر خصمٌ لم يقع — العمولة قد تكون معطّلة
  const fee = (order.settlement.commission?.total ?? 0) > 0

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-success/45 bg-success/[0.06] p-5"
    >
      {/* توهّج خافت خلف المحتوى — لا يُقرأ ويُحسّ */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 start-1/4 size-48 rounded-full bg-success/15 blur-3xl"
      />

      <p className="relative flex items-center gap-2 text-sm font-extrabold text-success">
        <Sparkles className="size-4" />
        {side === 'buyer' ? 'صارت لك' : 'تم اكتمال الصفقة'}
      </p>
      <p className="relative mt-1 text-xs text-muted">
        {/*
          * البائع يُقال له أين ماله وما يملك أن يفعل به.
          *
          * «وصل عائدك» تُخبر أنّ شيئًا وقع ولا تقول أين استقرّ — ومن باع لوحته
          * يسأل بعدها سؤالًا واحدًا: كيف أُخرجه؟ فيُقال له في السطر نفسه.
          */}
        {side === 'buyer'
          ? 'تحقّقت الإدارة من النقل وحوّلت المبلغ للبائع، واللوحة باسمك.'
          : fee
            ? 'مبلغ البيع تم إيداعه في محفظتك بعد خصم عمولة المنصّة وضريبتها، ويمكنك سحبه لحسابك البنكي.'
            : 'مبلغ البيع تم إيداعه في محفظتك، ويمكنك سحبه لحسابك البنكي.'}
      </p>

      <div className="relative mt-4 grid gap-4 sm:grid-cols-[1.2fr_1fr] sm:items-center">
        <motion.div
          initial={reduced ? false : { scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-xl border border-ink-600 bg-ink-700/45 p-3"
        >
          <SaudiLicensePlate {...order.plate} size="fullscreen" animated />
        </motion.div>

        <div className={cn('text-center sm:text-start')}>
          {/* «صافي» تقتضي خصمًا وقع — فلا تُقال حيث لا عمولة */}
          <p className="text-[11px] text-muted">
            {side === 'buyer' ? 'قيمة الصفقة' : fee ? 'صافي ما وصلك' : 'ما وصلك'}
          </p>
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="text-3xl font-extrabold leading-none tabular-nums text-success"
          >
            {formatAmount(amount)}
            <span className="ms-1.5 text-sm font-bold">ريال</span>
          </motion.p>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted sm:justify-start">
            <ShieldCheck className="size-3.5 text-success" />
            {order.reference}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
