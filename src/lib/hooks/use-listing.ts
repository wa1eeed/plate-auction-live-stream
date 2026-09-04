'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { formatAmount } from '@/lib/domain/money'
import type { ListingDetail } from '@/lib/domain/types'
import { useRealtime, type ConnectionStatus, type RealtimeEvent } from './use-realtime'

export type { ConnectionStatus }

/**
 * متابعة إعلان لحظيًا عبر WebSocket.
 * الأحداث تصل مدفوعةً فورًا، والحالة الكاملة تُعاد مزامنتها من REST لأنها
 * مخصّصة للمشاهد (هل أنا الأعلى؟ أي مزايدة لي؟) فلا تصلح للبثّ الجماعي.
 */
export function useListing(listingId: string, initial: ListingDetail) {
  const [detail, setDetail] = useState(initial)
  const topic = `listing:${listingId}`
  const lastExtensionRef = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}`, { cache: 'no-store' })
      if (!response.ok) return
      setDetail((await response.json()) as ListingDetail)
    } catch {
      // ستُعاد المحاولة مع الحدث أو الدورة التالية
    }
  }, [listingId])

  const onEvent = useCallback((event: RealtimeEvent) => {
    if (event.kind === 'bid_placed') {
      const amount = typeof event.payload.amount === 'number' ? event.payload.amount : null
      toast.info(amount ? `مزايدة جديدة — ${formatAmount(amount)} ريال` : 'مزايدة جديدة', {
        duration: 2500,
      })
      return
    }
    if (event.kind === 'time_extended' && lastExtensionRef.current !== event.at) {
      lastExtensionRef.current = event.at
      const seconds = Number(event.payload.addedSeconds ?? 0)
      toast.info(`تم تمديد المزاد ${Math.round(seconds / 60)} دقيقة`, { duration: 2500 })
      return
    }
    if (event.kind === 'auction_ended') toast.info('انتهى المزاد')
    if (event.kind === 'listing_sold') toast.info('تمّت الصفقة على هذه اللوحة')
  }, [])

  const { status, viewersFor } = useRealtime({ topics: [topic], onEvent, onResync: refetch })

  return { detail, status, refetch, viewers: viewersFor(topic) }
}
