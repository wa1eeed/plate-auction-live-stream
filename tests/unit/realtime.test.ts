import { beforeEach, describe, expect, it } from 'vitest'
import {
  MARKET_TOPIC,
  getRealtimeRegistry,
  listingTopic,
  publishRealtime,
  topicViewers,
  type RealtimeSocket,
} from '@/lib/server/realtime'

type Captured = { topic: string; seq: number; kind: string; payload: Record<string, unknown> }

function fakeSocket(topics: string[]): RealtimeSocket & { received: Captured[] } {
  const received: Captured[] = []
  return {
    topics: new Set(topics),
    received,
    send: (data: string) => received.push(JSON.parse(data)),
  }
}

beforeEach(() => {
  const registry = getRealtimeRegistry()
  registry.sockets.clear()
  registry.seq.clear()
})

describe('النشر اللحظي', () => {
  it('يصل الحدث للمشتركين في الموضوع فقط', () => {
    const registry = getRealtimeRegistry()
    const subscriber = fakeSocket([listingTopic('lst_1')])
    const outsider = fakeSocket([listingTopic('lst_2')])
    registry.sockets.add(subscriber).add(outsider)

    publishRealtime([listingTopic('lst_1')], 'bid_placed', { amount: 1000 })

    expect(subscriber.received).toHaveLength(1)
    expect(subscriber.received[0].kind).toBe('bid_placed')
    expect(outsider.received).toHaveLength(0)
  })

  it('ينشر إلى موضوع الإعلان وموضوع السوق معًا', () => {
    const registry = getRealtimeRegistry()
    const onListing = fakeSocket([listingTopic('lst_1')])
    const onMarket = fakeSocket([MARKET_TOPIC])
    registry.sockets.add(onListing).add(onMarket)

    publishRealtime([listingTopic('lst_1'), MARKET_TOPIC], 'listing_sold', { amount: 500 })

    expect(onListing.received).toHaveLength(1)
    expect(onMarket.received).toHaveLength(1)
  })

  it('يزيد التسلسل لكل موضوع على حدة فيمكن كشف الفجوات', () => {
    const registry = getRealtimeRegistry()
    const socket = fakeSocket([listingTopic('lst_1'), MARKET_TOPIC])
    registry.sockets.add(socket)

    publishRealtime([listingTopic('lst_1')], 'bid_placed', {})
    publishRealtime([listingTopic('lst_1')], 'bid_placed', {})
    publishRealtime([MARKET_TOPIC], 'listing_published', {})

    const listingSeqs = socket.received
      .filter((m) => m.topic === listingTopic('lst_1'))
      .map((m) => m.seq)
    const marketSeqs = socket.received.filter((m) => m.topic === MARKET_TOPIC).map((m) => m.seq)

    expect(listingSeqs).toEqual([1, 2])
    expect(marketSeqs).toEqual([1])
  })

  it('مقبس معطوب لا يمنع وصول الحدث لبقية المشتركين', () => {
    const registry = getRealtimeRegistry()
    const broken: RealtimeSocket = {
      topics: new Set([MARKET_TOPIC]),
      send: () => {
        throw new Error('socket closed')
      },
    }
    const healthy = fakeSocket([MARKET_TOPIC])
    registry.sockets.add(broken).add(healthy)

    expect(() => publishRealtime([MARKET_TOPIC], 'bid_placed', {})).not.toThrow()
    expect(healthy.received).toHaveLength(1)
  })

  it('يحسب عدد المشاهدين لكل موضوع', () => {
    const registry = getRealtimeRegistry()
    registry.sockets.add(fakeSocket([listingTopic('lst_1')]))
    registry.sockets.add(fakeSocket([listingTopic('lst_1'), MARKET_TOPIC]))
    registry.sockets.add(fakeSocket([MARKET_TOPIC]))

    expect(topicViewers(listingTopic('lst_1'))).toBe(2)
    expect(topicViewers(MARKET_TOPIC)).toBe(2)
    expect(topicViewers(listingTopic('lst_missing'))).toBe(0)
  })
})
