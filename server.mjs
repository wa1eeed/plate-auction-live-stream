/**
 * خادم مخصّص: Next.js + WebSocket في عملية واحدة.
 *
 * لماذا خادم مخصّص؟
 *   البيانات اللحظية للمزادات تحتاج دفعًا حقيقيًا من الخادم. مسارات Next
 *   العادية لا تستطيع ترقية الاتصال إلى WebSocket، فنستضيف الاثنين هنا.
 *
 * تقسيم المسؤوليات:
 *   الأوامر (مزايدة/شراء/عرض) تبقى على HTTP POST — لتحتفظ بالمصادقة وتحديد
 *   المعدل ومنع التكرار ورموز الأخطاء. أما الأحداث فتُدفع عبر WebSocket.
 */
import { createServer } from 'node:http'
import { parse } from 'node:url'
import next from 'next'
import { WebSocketServer } from 'ws'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)

/** نبضة للكشف عن المقابس الميتة، ومسح دوري لإنهاء المزادات في وقتها. */
const HEARTBEAT_MS = 30_000
const SWEEP_MS = 5_000

// السجلّ المشترك مع كود التطبيق — انظر src/lib/server/realtime.ts
const registry = (globalThis.__plateRealtime ??= { sockets: new Set(), seq: new Map() })

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

// يجب استدعاؤه بعد prepare — يخدم ترقيات Next (إعادة التحميل الساخن)
const upgrade = app.getUpgradeHandler()

const server = createServer((req, res) => {
  handle(req, res, parse(req.url ?? '/', true)).catch((error) => {
    console.error('[http]', error?.message ?? error)
    res.statusCode = 500
    res.end('internal error')
  })
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const { pathname } = parse(req.url ?? '/', true)
  if (pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    return
  }
  // بقية الترقيات لـ Next (إعادة التحميل الساخن في وضع التطوير)
  upgrade(req, socket, head)
})

/** ينشر حدثًا من داخل خادم WebSocket نفسه (حضور المشاهدين مثلًا). */
function publish(topic, kind, payload) {
  const seq = (registry.seq.get(topic) ?? 0) + 1
  registry.seq.set(topic, seq)
  const encoded = JSON.stringify({
    t: 'ev',
    topic,
    seq,
    kind,
    payload,
    at: new Date().toISOString(),
  })
  for (const entry of registry.sockets) {
    if (entry.topics.has(topic)) {
      try {
        entry.send(encoded)
      } catch {
        // يُنظَّف عند الإغلاق
      }
    }
  }
}

function viewers(topic) {
  let count = 0
  for (const entry of registry.sockets) if (entry.topics.has(topic)) count += 1
  return count
}

wss.on('connection', (ws) => {
  const entry = { send: (data) => ws.send(data), topics: new Set() }
  registry.sockets.add(entry)
  ws.isAlive = true
  ws.on('pong', () => {
    ws.isAlive = true
  })

  const announce = (topic) => {
    if (topic.startsWith('listing:')) publish(topic, 'presence', { viewers: viewers(topic) })
  }

  ws.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(String(raw))
    } catch {
      return
    }

    if (message.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong' }))
      return
    }

    if (message.t === 'sub' && Array.isArray(message.topics)) {
      const added = []
      for (const topic of message.topics) {
        if (typeof topic !== 'string' || topic.length > 120) continue
        if (entry.topics.size >= 20) break
        if (!entry.topics.has(topic)) {
          entry.topics.add(topic)
          added.push(topic)
        }
      }
      // نُعلم العميل بآخر تسلسل لكل موضوع ليكتشف الفجوات من أول لحظة
      const seq = {}
      for (const topic of entry.topics) seq[topic] = registry.seq.get(topic) ?? 0
      ws.send(JSON.stringify({ t: 'welcome', seq }))
      for (const topic of added) announce(topic)
      return
    }

    if (message.t === 'unsub' && Array.isArray(message.topics)) {
      for (const topic of message.topics) {
        if (entry.topics.delete(topic)) announce(topic)
      }
    }
  })

  const cleanup = () => {
    const topics = [...entry.topics]
    registry.sockets.delete(entry)
    for (const topic of topics) announce(topic)
  }
  ws.on('close', cleanup)
  ws.on('error', cleanup)
})

// إسقاط المقابس التي لا تستجيب للنبضة
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate()
      continue
    }
    ws.isAlive = false
    try {
      ws.ping()
    } catch {
      ws.terminate()
    }
  }
}, HEARTBEAT_MS)
heartbeat.unref?.()

/**
 * مسح دوري ينهي المزادات المستحقة حتى لو لم يفتح أحد أي صفحة.
 * يمرّ عبر مسار داخلي محمي بمفتاح الجلسة بدل استدعاء الخدمة مباشرة، لأن
 * حزمة Next تملك نسختها الخاصة من الوحدات.
 */
const sweep = setInterval(() => {
  fetch(`http://127.0.0.1:${port}/api/internal/sweep`, {
    method: 'POST',
    headers: { 'x-internal-sweep': process.env.SESSION_SECRET ?? 'development-only-insecure-secret' },
  }).catch(() => {
    // الخادم قد يكون منشغلًا — تُعاد المحاولة في الدورة التالية
  })
}, SWEEP_MS)
sweep.unref?.()

server.listen(port, hostname, () => {
  console.log(`▲ جاهز على http://${hostname}:${port}  ·  WebSocket على /ws`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    clearInterval(heartbeat)
    clearInterval(sweep)
    wss.close()
    server.close(() => process.exit(0))
  })
}
