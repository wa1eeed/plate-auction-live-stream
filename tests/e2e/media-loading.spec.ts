import { expect, test } from './support/hydrated'
import { type Page } from '@playwright/test'
import { loginAdmin } from './support/session'

/**
 * **صورةٌ لها مكانٌ محجوزٌ ولمعانٌ ينتظر — لا فراغٌ ثمّ قفزة.**
 *
 * وصورُ البنرات والستوريز تأتي من قرص الخادم بلا CDN، فأوّلُ مشاهدةٍ تنتظر
 * الشبكة. وكانت تُترك فراغًا: مربّعٌ أسودُ لا يدري صاحبُ الجهاز أمعطَّلٌ هو
 * أم قادم. وهو ما شكاه صاحبُ المنصّة — «لابد انتظر لين تظهر الصور».
 *
 * **والهيكلُ تحتها لا فوقها، والصورةُ ظاهرةٌ دائمًا.** فلو عُلّقت شفافيّتُها
 * على `onLoad` لبقيت خفيّةً أبدًا حيث لا يقع ترطيب. فالمقيسُ شيئان: أن
 * يُرى اللمعانُ قبل وصولها، وأن تُرى هي بعده.
 */
/** صورةُ بنرٍ 2:1 صالحة — PNG مبنيّةٌ بايتةً بايتة، فلا ملفَّ ثابتًا يُرفق. */
function bannerPng(): Buffer {
  const width = 1200
  const height = 600
  const chunk = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(body.length)
    const typed = Buffer.concat([Buffer.from(type, 'ascii'), body])
    const crcValue = Buffer.alloc(4)
    crcValue.writeUInt32BE(crc32(typed) >>> 0)
    return Buffer.concat([length, typed, crcValue])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 /* عمق */
  ihdr[9] = 2 /* RGB */

  /* صفوفٌ خامٌ بلون واحد، ثمّ ضغطُ zlib بأدنى مستوى */
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x3a)])
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deflateSync } = require('node:zlib') as typeof import('node:zlib')

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function crc32(buffer: Buffer): number {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc
}

/**
 * يرفع صورةً ويُنشئ بنرًا منشورًا — ويُعيد معرّفه ليُحذف بعد الفحص.
 *
 * **ومن داخل الصفحة بـ`fetch` لا من `request` الخارجيّ.** فسياقُ الطلبات
 * المستقلّ لا يحمل كوكي الجلسة كما يحملها المستند — جُرّب فرُدّ بـ401
 * والكوكي في السياق. و`fetch` من الصفحة هو المسار الذي يسلكه التطبيق نفسُه.
 */
async function createBanner(admin: Page, png: number[]) {
  return admin.evaluate(async (bytes: number[]) => {
    const file = new File([new Uint8Array(bytes)], 'b.png', { type: 'image/png' })
    const form = new FormData()
    form.append('file', file)
    form.append('purpose', 'banner')

    const uploaded = await fetch('/api/admin/media', { method: 'POST', body: form })
    if (!uploaded.ok) throw new Error(`رفعٌ مرفوض ${uploaded.status}: ${await uploaded.text()}`)
    const { key, width, height } = (await uploaded.json()) as {
      key: string
      width: number
      height: number
    }

    const created = await fetch('/api/admin/banners', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'بنرُ فحصِ التحميل',
        imageKey: key,
        width,
        height,
        alt: 'بنرٌ لفحص حالة التحميل',
        published: true,
      }),
    })
    if (!created.ok) throw new Error(`إنشاءٌ مرفوض ${created.status}: ${await created.text()}`)
    return ((await created.json()) as { item: { id: string } }).item.id
  }, png)
}

test.describe('حالةُ تحميل الوسائط', () => {
  test('البنرُ يُظهر لمعانَ انتظارٍ ثمّ صورتَه', async ({ page, browser }) => {
    const adminContext = await browser.newContext()
    const admin = await adminContext.newPage()
    await loginAdmin(admin)
    const bannerId = await createBanner(admin, [...bannerPng()])

    try {
      /*
       * **تُبطَّأ الصورةُ عمدًا.**
       *
       * فعلى الحلقة المحلّية تصل في أجزاءٍ من الثانية، فلا يُرى الهيكلُ
       * أصلًا — ويمرّ الفحصُ وإن لم يكن ثمّ هيكل. والإبطاءُ يجعل ما يراه
       * صاحبُ جهازٍ على شبكةٍ بطيئة **مقيسًا**.
       */
      let released: (() => void) | null = null
      const held = new Promise<void>((resolve) => {
        released = resolve
      })
      await page.route('**/api/media/**', async (route) => {
        await held
        await route.continue()
      })

      /* البنراتُ في عمود الجوّال (`lg:hidden`) — فيُقاس بعرض جوّال */
      await page.setViewportSize({ width: 390, height: 844 })
      /*
       * و`domcontentloaded` لا `load`: حدثُ التحميل ينتظر الصورَ، وصورتُنا
       * محبوسةٌ عمدًا — فيعلق الانتقال حتى المهلة.
       */
      await page.goto('/', { waitUntil: 'domcontentloaded' })

      const frame = page.locator('section a, section div').filter({ has: page.locator('img[alt="بنرٌ لفحص حالة التحميل"]') }).first()
      const skeleton = frame.locator('.skeleton')
      await expect(skeleton, 'لا لمعانَ ينتظر — فراغٌ وحده').toBeVisible({ timeout: 20_000 })

      released?.()

      const image = page.locator('img[alt="بنرٌ لفحص حالة التحميل"]').first()
      await expect(image).toBeVisible({ timeout: 20_000 })
      /* وتُرسم فعلًا لا تُعلَن فقط: عرضٌ طبيعيٌّ غير صفر */
      await expect
        .poll(
          async () =>
            image.evaluate((node: HTMLImageElement) => node.naturalWidth),
          { timeout: 20_000, message: 'الصورةُ لم تُرسم' },
        )
        .toBeGreaterThan(0)

      /* واللمعانُ يُرفع بعدها — فلا يبقى فوق صورةٍ وصلت */
      await expect(skeleton, 'اللمعانُ باقٍ بعد وصول الصورة').toHaveCount(0, { timeout: 20_000 })
    } finally {
      await admin
        .evaluate((id: string) => fetch(`/api/admin/banners/${id}`, { method: 'DELETE' }), bannerId)
        .catch(() => undefined)
      await adminContext.close()
    }
  })
})
