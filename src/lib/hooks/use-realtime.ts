'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ListingEventType } from '@/lib/domain/types'

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

export type RealtimeEvent = {
  topic: string
  seq: number
  kind: ListingEventType | 'presence'
  payload: Record<string, unknown>
  at: string
}

type Options = {
  topics: string[]
  /** يُستدعى عند كل حدث — وعند اكتشاف فجوة في التسلسل تُطلب مزامنة كاملة */
  onEvent?: (event: RealtimeEvent) => void
  /** مزامنة كاملة من REST: عند الاتصال، وعند الفجوة، وعند عودة التبويب */
  onResync: () => void | Promise<void>
}

const PING_MS = 25_000
/**
 * نافذة تجميع المزامنات: عدة أحداث متتابعة تُنتج طلب مزامنة واحدًا.
 * بدونها كان كل مزايد يُطلق طلبًا لكل مزايدة، فتتضاعف الطلبات مع عدد المشاهدين.
 */
const RESYNC_COALESCE_MS = 200
const SILENCE_LIMIT_MS = 45_000
/** بعد هذا العدد من المحاولات الفاشلة نعتمد على إعادة الجلب الدورية وحدها */
const FALLBACK_AFTER_ATTEMPTS = 3
const FALLBACK_POLL_MS = 8_000

function backoffDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** (attempt - 1), 15_000)
  return base + Math.random() * 400 // نثر بسيط يمنع تزاحم إعادة الاتصال
}

/**
 * اشتراك لحظي عبر WebSocket.
 *
 * لماذا WebSocket لا SSE: البيانات هنا تُدفَع فور وقوعها بلا لقطات دورية،
 * والاتصال الواحد يخدم عدة مواضيع (الإعلان + السوق) بدل اتصال لكل صفحة.
 *
 * ضمانات عدم فقدان الحالة:
 *  1. رقم تسلسلي لكل موضوع — أي قفزة تعني حدثًا مفقودًا فتُطلب مزامنة كاملة.
 *  2. مزامنة كاملة عند كل اتصال ناجح وعند عودة التبويب أو الشبكة.
 *  3. إعادة اتصال بتراجع أُسّي، وإن تعذّر الاتصال نهائيًا نسقط إلى إعادة جلب دورية.
 *  4. نبضة ping/pong تكشف الاتصال الميت الذي لا يُغلق نفسه.
 */
export function useRealtime({ topics, onEvent, onResync }: Options) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [viewers, setViewers] = useState<Record<string, number>>({})

  const topicsKey = topics.join('|')
  const onEventRef = useRef(onEvent)
  const onResyncRef = useRef(onResync)
  onEventRef.current = onEvent
  onResyncRef.current = onResync

  useEffect(() => {
    const topicList = topicsKey.split('|').filter(Boolean)
    if (topicList.length === 0) return

    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pingTimer: ReturnType<typeof setInterval> | null = null
    let fallbackTimer: ReturnType<typeof setInterval> | null = null
    let attempts = 0
    let lastMessageAt = Date.now()
    let resyncTimer: ReturnType<typeof setTimeout> | null = null
    const lastSeq = new Map<string, number>()

    /** مزامنة فورية — للاتصال وعودة التبويب. */
    const resyncNow = () => {
      if (resyncTimer) {
        clearTimeout(resyncTimer)
        resyncTimer = null
      }
      void onResyncRef.current()
    }

    /** مزامنة مجمّعة — للأحداث المتتابعة. */
    const resyncSoon = () => {
      if (resyncTimer || cancelled) return
      resyncTimer = setTimeout(() => {
        resyncTimer = null
        void onResyncRef.current()
      }, RESYNC_COALESCE_MS)
    }

    const startFallbackPolling = () => {
      if (fallbackTimer || cancelled) return
      fallbackTimer = setInterval(resyncNow, FALLBACK_POLL_MS)
    }
    const stopFallbackPolling = () => {
      if (fallbackTimer) clearInterval(fallbackTimer)
      fallbackTimer = null
    }

    const connect = () => {
      if (cancelled) return
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const current = new WebSocket(`${protocol}//${window.location.host}/ws`)
      socket = current
      const stale = () => cancelled || socket !== current

      current.addEventListener('open', () => {
        if (stale()) return
        attempts = 0
        lastMessageAt = Date.now()
        setStatus('live')
        stopFallbackPolling()
        current.send(JSON.stringify({ t: 'sub', topics: topicList }))
        // مزامنة كاملة عند كل اتصال: تسدّ ما فات أثناء الانقطاع
        resyncNow()
      })

      current.addEventListener('message', (event) => {
        if (stale()) return
        lastMessageAt = Date.now()

        let message: Record<string, unknown>
        try {
          message = JSON.parse(event.data as string)
        } catch {
          return
        }

        if (message.t === 'welcome') {
          const seqMap = (message.seq ?? {}) as Record<string, number>
          for (const [topic, seq] of Object.entries(seqMap)) lastSeq.set(topic, seq)
          return
        }

        if (message.t !== 'ev') return
        const incoming = message as unknown as RealtimeEvent

        // اكتشاف الفجوة: أي قفزة في التسلسل تعني حدثًا لم يصلنا
        const previous = lastSeq.get(incoming.topic)
        lastSeq.set(incoming.topic, incoming.seq)
        const gapped = previous !== undefined && incoming.seq > previous + 1

        // الحضور لا يمسّ بيانات الإعلان، فلا يستدعي مزامنة
        if (incoming.kind === 'presence') {
          const count = Number(incoming.payload?.viewers ?? 0)
          setViewers((state) => ({ ...state, [incoming.topic]: count }))
          return
        }

        onEventRef.current?.(incoming)
        // الفجوة تعني نقصًا مؤكدًا في الحالة، فتُزامَن فورًا لا مجمّعة
        if (gapped) resyncNow()
        else resyncSoon()
      })

      const drop = () => {
        if (stale()) return
        socket = null
        attempts += 1
        setStatus(attempts >= FALLBACK_AFTER_ATTEMPTS ? 'offline' : 'reconnecting')
        if (attempts >= FALLBACK_AFTER_ATTEMPTS) startFallbackPolling()
        reconnectTimer = setTimeout(connect, backoffDelay(attempts))
      }

      current.addEventListener('close', drop)
      current.addEventListener('error', () => {
        try {
          current.close()
        } catch {
          // مغلق مسبقًا
        }
      })
    }

    connect()

    // نبضة العميل: تكشف الاتصال الميت الذي لا يصل منه إغلاق
    pingTimer = setInterval(() => {
      if (Date.now() - lastMessageAt > SILENCE_LIMIT_MS) {
        socket?.close()
        return
      }
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ t: 'ping' }))
      }
    }, PING_MS)

    const onWake = () => {
      if (document.visibilityState !== 'visible') return
      resyncNow()
      if (!socket || socket.readyState > WebSocket.OPEN) {
        if (reconnectTimer) clearTimeout(reconnectTimer)
        attempts = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (resyncTimer) clearTimeout(resyncTimer)
      if (pingTimer) clearInterval(pingTimer)
      stopFallbackPolling()
      socket?.close()
      socket = null
    }
  }, [topicsKey])

  const viewersFor = useCallback((topic: string) => viewers[topic] ?? 0, [viewers])

  return { status, viewersFor }
}
