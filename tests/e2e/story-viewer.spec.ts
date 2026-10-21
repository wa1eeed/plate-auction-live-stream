import { expect, test } from './support/hydrated'
import { type Page } from '@playwright/test'
import { loginAdmin } from './support/session'

/**
 * **عارضُ الستوري يملأ الشاشة — ولا تُطلّ الصفحةُ من تحته.**
 *
 * وكان يسكن `<div className="space-y-4 …">` في الرئيسية، و`space-y-4` تضع
 * `margin-top` على كلّ ابنٍ بعد الأوّل — **والعارضُ ابنٌ منها**. فمع
 * `top: 0; bottom: 0` يدخل الهامشُ في معادلة الارتفاع فيُنقصه ستّةَ عشرَ
 * بكسلًا: قِيس فخرج ٧٩٦ في شاشةٍ ٨١٢، فظهرت الرئيسيةُ من تحته شريطًا.
 * ورآه صاحبُ المنصّة «فوترًا» داخل شاشة الستوري.
 *
 * **والمقيسُ التغطيةُ لا الأصناف**: `fixed inset-0` مكتوبٌ في الحالين،
 * وإنّما يفترقان في البكسلات. وأيُّ `transform` أو `filter` على أيّ جَدٍّ
 * يُعيد العطبَ من بابٍ آخر — فيُقاس الأثر.
 */
function squarePng(): Buffer {
  const { deflateSync } = require('node:zlib') as typeof import('node:zlib')
  const [w, h] = [540, 960]
  const crc32 = (buf: Buffer) => {
    let crc = ~0
    for (const byte of buf) {
      crc ^= byte
      for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
    return ~crc
  }
  const chunk = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(body.length)
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typed) >>> 0)
    return Buffer.concat([length, typed, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, 0x24)])
  const raw = Buffer.concat(Array.from({ length: h }, () => row))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function createStory(admin: Page, png: number[]) {
  return admin.evaluate(async (bytes: number[]) => {
    const send = async (purpose: string) => {
      const form = new FormData()
      form.append('file', new File([new Uint8Array(bytes)], 's.png', { type: 'image/png' }))
      form.append('purpose', purpose)
      const r = await fetch('/api/admin/media', { method: 'POST', body: form })
      if (!r.ok) throw new Error(`رفعٌ مرفوض ${r.status}: ${await r.text()}`)
      return ((await r.json()) as { key: string }).key
    }
    const key = await send('story')
    const made = await fetch('/api/admin/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'ستوري فحص التغطية',
        slides: [
          { id: 's1', mediaKey: key, mediaKind: 'image', posterKey: null, alt: 'شريحة', durationSeconds: 15 },
        ],
        linkUrl: '/market',
        published: true,
      }),
    })
    if (!made.ok) throw new Error(`إنشاءٌ مرفوض ${made.status}: ${await made.text()}`)
    return ((await made.json()) as { item: { id: string } }).item.id
  }, png)
}

test.describe('عارضُ الستوري', () => {
  test('يملأ الشاشة كلَّها ولا تُطلّ الصفحةُ من تحته', async ({ page, browser }) => {
    const adminContext = await browser.newContext()
    const admin = await adminContext.newPage()
    await loginAdmin(admin)
    const storyId = await createStory(admin, [...squarePng()])

    try {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/')

      const ring = page.getByRole('button', { name: /ستوري فحص التغطية/ }).first()
      await expect(ring).toBeVisible({ timeout: 20_000 })
      await ring.click()

      const viewer = page.getByRole('dialog', { name: 'ستوري فحص التغطية' })
      await expect(viewer).toBeVisible({ timeout: 15_000 })

      const cover = await viewer.evaluate((node: HTMLElement) => {
        const box = node.getBoundingClientRect()
        return {
          top: Math.round(box.top),
          left: Math.round(box.left),
          width: Math.round(box.width),
          height: Math.round(box.height),
          viewport: [window.innerWidth, window.innerHeight],
          /* والجَدُّ المباشر: ما خرج إلى `body` لا يُقيّده تخطيطُ أحد */
          parent: node.parentElement?.tagName,
        }
      })

      expect(cover.parent, 'العارضُ ما زال في شجرة الصفحة').toBe('BODY')
      expect([cover.top, cover.left], 'العارضُ منزاحٌ عن ركن الشاشة').toEqual([0, 0])
      expect(cover.width, 'لا يملأ العرض').toBe(cover.viewport[0])
      expect(cover.height, 'تُطلّ الصفحةُ من تحته').toBe(cover.viewport[1])
    } finally {
      await admin
        .evaluate((id: string) => fetch(`/api/admin/stories/${id}`, { method: 'DELETE' }), storyId)
        .catch(() => undefined)
      await adminContext.close()
    }
  })
})
