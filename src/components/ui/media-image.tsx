'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * **صورةٌ لها مكانٌ محجوزٌ ولمعانٌ ينتظر — لا فراغٌ ثمّ قفزة.**
 *
 * وصورُ الستوريز والبنرات تأتي من قرص الخادم بلا CDN، فأوّلُ مشاهدةٍ تنتظر
 * الشبكة. وبلا هيكلٍ تحتها يرى صاحبُ الجهاز **مربّعًا فارغًا** لا يدري
 * أمعطَّلٌ هو أم قادم — وهو ما شكاه صاحبُ المنصّة.
 *
 * **والهيكلُ تحتها لا فوقها.** فلو كان فوقها وتعطّل السكربتُ بقي حاجبًا
 * للصورة إلى الأبد. وتحتها: إن لم يُزَل اختفى خلفها وحده حين تُرسم.
 *
 * **ولا تُخفى الصورةُ بانتظار `onLoad`.** فالمستمِعُ يُركَّب عند الترطيب،
 * وترطيبٌ لا يقع يعني صورةً بشفافيةٍ صفر لا تظهر أبدًا — وهو حارسٌ قائمٌ
 * في هذا المستودع (انظر تعليق `skeleton` في `globals.css`). فهي ظاهرةٌ
 * دائمًا، والهيكلُ وحده يُزال.
 */
export function MediaImage({
  src,
  alt,
  className,
  /** أوّلُ ما يُرى في الشاشة: يُجلب فورًا وبأولويّةٍ عالية لا كسولًا */
  priority = false,
  width,
  height,
}: {
  src: string
  alt: string
  className?: string
  priority?: boolean
  width?: number | null
  height?: number | null
}) {
  const [settled, setSettled] = useState(false)

  return (
    <>
      {!settled && <span aria-hidden className="skeleton absolute inset-0" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        /*
         * و`lazy` على ما هو في أوّل الشاشة تأخيرٌ لا توفير: المتصفّح يؤجّل
         * الطلبَ حتى يحسب التخطيط، والبنرُ الأوّل فوق الطيّة دائمًا.
         */
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onLoad={() => setSettled(true)}
        /* وعطبُ التحميل يُزيل الهيكلَ أيضًا: لمعانٌ لا ينتهي أسوأ من فراغ */
        onError={() => setSettled(true)}
        className={cn('relative size-full object-cover', className)}
      />
    </>
  )
}
