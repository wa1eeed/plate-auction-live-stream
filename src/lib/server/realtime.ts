import type { ListingEventType } from '@/lib/domain/types'

/**
 * سجلّ لحظي مشترك بين خادم Next وخادم WebSocket داخل العملية نفسها.
 *
 * يعيش على `globalThis` لأن `server.mjs` وحزمة Next وحدتان منفصلتان في
 * الذاكرة، وهذا المرجع المشترك هو ما يجعل النشر من الخدمات يصل إلى المقابس.
 */
export type RealtimeSocket = {
  send: (data: string) => void
  topics: Set<string>
}

export type RealtimeRegistry = {
  sockets: Set<RealtimeSocket>
  /** رقم تسلسلي متزايد لكل موضوع — يكشف العميل به أي فجوة في الأحداث */
  seq: Map<string, number>
}

type GlobalWithRealtime = typeof globalThis & { __plateRealtime?: RealtimeRegistry }

export function getRealtimeRegistry(): RealtimeRegistry {
  const globalRef = globalThis as GlobalWithRealtime
  if (!globalRef.__plateRealtime) {
    globalRef.__plateRealtime = { sockets: new Set(), seq: new Map() }
  }
  return globalRef.__plateRealtime
}

/** موضوع إعلان واحد — يشترك فيه من يفتح صفحته. */
export function listingTopic(listingId: string): string {
  return `listing:${listingId}`
}

/** موضوع السوق — يشترك فيه من يتصفّح الشبكة فتصله كل التغيّرات. */
export const MARKET_TOPIC = 'market'

/**
 * موضوع مستخدم واحد — إشعاراته الشخصية.
 *
 * المعرّف وحده ليس سرًّا، لكنه غير قابل للتخمين، ولا يُبثّ على هذا الموضوع
 * إلا إشعار بلا تفاصيل حسّاسة. ومن يعرف معرّفه يعرف إشعاراته على أي حال.
 */
export function userTopic(userId: string): string {
  return `user:${userId}`
}

export type RealtimeKind = ListingEventType | 'presence' | 'notification'

export type RealtimeEvent = {
  t: 'ev'
  topic: string
  seq: number
  kind: RealtimeKind
  payload: Record<string, unknown>
  at: string
}

/**
 * ينشر حدثًا إلى كل المشتركين في الموضوع.
 * الرقم التسلسلي يتزايد لكل موضوع على حدة، فيستطيع العميل اكتشاف حدث مفقود
 * ويطلب مزامنة كاملة بدلًا من البقاء على حالة ناقصة.
 */
export function publishRealtime(
  topics: string[],
  kind: RealtimeKind,
  payload: Record<string, unknown> = {},
): void {
  const registry = getRealtimeRegistry()
  const at = new Date().toISOString()

  for (const topic of topics) {
    const seq = (registry.seq.get(topic) ?? 0) + 1
    registry.seq.set(topic, seq)

    const message: RealtimeEvent = { t: 'ev', topic, seq, kind, payload, at }
    const encoded = JSON.stringify(message)

    for (const socket of registry.sockets) {
      if (!socket.topics.has(topic)) continue
      try {
        socket.send(encoded)
      } catch {
        // مقبس معطوب لا يجب أن يوقف البقية — سيُنظَّف عند إغلاقه
      }
    }
  }
}

/** عدد المتصلين بموضوع — يُستخدم لعرض «يشاهدون الآن». */
export function topicViewers(topic: string): number {
  let count = 0
  for (const socket of getRealtimeRegistry().sockets) {
    if (socket.topics.has(topic)) count += 1
  }
  return count
}
