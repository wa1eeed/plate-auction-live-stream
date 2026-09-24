import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { diskDriver } from '@/lib/server/media/disk'
import { assertPrivateIsolation, r2Driver } from '@/lib/server/media/r2'
import { getMedia, mediaConfigured, resetMediaForTests } from '@/lib/server/media'
import { platformKey, stagingKey, userFileKey } from '@/lib/server/media/keys'

describe('محرّك القرص', () => {
  let root = ''
  const driver = () => diskDriver(root)

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'media-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('يكتب ثمّ يقرأ البايتات نفسها بنوعها من الامتداد', async () => {
    const key = platformKey('image/png')
    const bytes = new Uint8Array([1, 2, 3, 4, 5])

    await driver().put(key, bytes, 'image/png')
    const read = await driver().read(key)

    expect(read?.bytes).toEqual(bytes)
    expect(read?.contentType).toBe('image/png')
  })

  it('المفتاح يصير مسارًا تحت المجلَّد بتفرّعه', async () => {
    const key = userFileKey('usr_abc', 'application/pdf')
    await driver().put(key, new Uint8Array([9]), 'application/pdf')

    expect(existsSync(join(root, key))).toBe(true)
    expect(new Uint8Array(await readFile(join(root, key)))).toEqual(new Uint8Array([9]))
  })

  it('الحذف يرفعه، وحذفُ ما ليس موجودًا لا يرمي', async () => {
    const key = platformKey('image/png')
    await driver().put(key, new Uint8Array([1]), 'image/png')
    await driver().remove(key)

    expect(await driver().read(key)).toBeNull()
    await expect(driver().remove(key)).resolves.toBeUndefined()
  })

  it('وما لم يُكتب يُقرأ `null` — لا يرمي ولا يُخترع', async () => {
    expect(await driver().read(platformKey('image/png'))).toBeNull()
  })

  it('العامّ يُقدَّم من نفس الأصل — فلا تحتاج سياسةُ المحتوى مضيفًا في التطوير', () => {
    const key = platformKey('image/png')
    expect(driver().publicUrl(key)).toBe(`/api/media/${key}`)
  })

  it('ولا رابطَ موقَّت — المسار المحروس يبثّ بنفسه', async () => {
    expect(await driver().signedUrl(userFileKey('usr_1', 'application/pdf'), 300)).toBeNull()
  })

  /*
   * **الحارس الذي يمنع الكتابة خارج المجلَّد.**
   *
   * ولو سقط لَكتب مفتاحٌ فيه `..` في أيّ موضعٍ من نظام الملفّات — وهو ما
   * يُصيب كلَّ محرّكٍ يبني مسارًا من مدخلٍ خارجيّ.
   */
  it('مفتاحٌ يخرج عن المجلَّد يُردّ في كلّ عملية', async () => {
    const escapes = ['../escaped.png', 'platform/../../escaped.png', '/etc/passwd']
    for (const bad of escapes) {
      await expect(driver().put(bad, new Uint8Array([1]), 'image/png'), bad).rejects.toThrow()
      await expect(driver().remove(bad), bad).rejects.toThrow()
      expect(() => driver().publicUrl(bad), bad).toThrow()
    }
    // ولم يُكتب شيءٌ خارج المجلَّد
    expect(existsSync(join(root, '..', 'escaped.png'))).toBe(false)
  })
})

describe('اختيار المحرّك ومجلَّده', () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
    resetMediaForTests()
  })

  it('بلا مفاتيح R2 يعمل على القرص — فالمنصّة تنشر بلا حاوية', () => {
    for (const key of ['R2_ACCOUNT_ID', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
      delete process.env[key]
    }
    resetMediaForTests()
    expect(mediaConfigured()).toBe(false)
    expect(getMedia().kind).toBe('disk')
  })

  it('وبالمفاتيح الأربعة يعمل على R2 — بلا رايةٍ خامسة تُنسى', () => {
    Object.assign(process.env, {
      R2_ACCOUNT_ID: 'acc',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    })
    resetMediaForTests()
    expect(mediaConfigured()).toBe(true)
    expect(getMedia().kind).toBe('r2')
  })

  /*
   * **ضبطٌ ناقص كان يُنزِل المنصّة إلى القرص بلا كلمة.**
   *
   * ولو سقط لَسكنت البنراتُ قرصَ الحاوية والإدارةُ تحسبها في R2 — فتضيع مع
   * أوّل نشرة، وتبقى صفوفُها في القاعدة تشير إلى ما لم يعد موجودًا.
   */
  it('وثلاثةٌ من أربعةٍ تُرفض — ولا يُنزَل إلى القرص صامتًا', () => {
    Object.assign(process.env, {
      R2_ACCOUNT_ID: 'acc',
      R2_BUCKET: 'bucket',
      R2_ACCESS_KEY_ID: 'key',
    })
    delete process.env.R2_SECRET_ACCESS_KEY
    resetMediaForTests()

    expect(mediaConfigured()).toBe(false)
    expect(() => getMedia()).toThrow(/R2_SECRET_ACCESS_KEY/)
  })

  /*
   * **الفخُّ الذي لا يظهر إلّا بعد النشر.**
   *
   * `.data/media` نسبيٌّ داخل الحاوية، والحاوية تُستبدل مع كلّ نشرة. وصفُّ
   * البنر في القاعدة يبقى — فيشير إلى ملفٍّ لم يعد موجودًا، وتُعرض صورةٌ
   * مكسورة بلا رسالةِ خطأ واحدة.
   */
  it('ومجلَّد القرص يتبع الحجم الدائم حيث وُجد', async () => {
    const { diskRootForTests } = await import('@/lib/server/media/index')
    delete process.env.MEDIA_DIR
    process.env.PLATFORM_DATA_DIR = '/app/data'
    expect(diskRootForTests()).toBe('/app/data/media')

    /* وشرطةٌ زائدة في آخره لا تُنتج مسارًا بشرطتين */
    process.env.PLATFORM_DATA_DIR = '/app/data/'
    expect(diskRootForTests()).toBe('/app/data/media')

    /* وما ضُبط صراحةً يسبق كلَّ شيء */
    process.env.MEDIA_DIR = '/mnt/media'
    expect(diskRootForTests()).toBe('/mnt/media')

    /* وبلا حجمٍ دائم يبقى الافتراض المحلّيّ */
    delete process.env.MEDIA_DIR
    delete process.env.PLATFORM_DATA_DIR
    expect(diskRootForTests()).toBe('.data/media')
  })
})

/**
 * **فصلُ الحاويتين — وإلّا انكشفت وثائق المستخدمين.**
 *
 * ربطُ نطاقٍ مخصّص بحاوية R2 يجعلها **كلَّها** مقروءةً علنًا عبره، لا
 * البادئة التي تختارها. فلو سكنت `users-files/` حاويةَ البنرات لصار
 * `cdn.…/users-files/usr_1/proof.pdf` مفتوحًا لمن بلغه.
 */
describe('حاويتا R2 — العامّة والخاصّة', () => {
  const base = {
    accountId: 'acc',
    bucket: 'media-public',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
  }

  it('نطاقٌ عامٌّ بلا حاويةٍ خاصّة يُرفض — ولا يُكتفى بتحذير', () => {
    expect(() =>
      assertPrivateIsolation({ ...base, privateBucket: null, publicBaseUrl: 'https://cdn.example.com' }),
    ).toThrow(/R2_PRIVATE_BUCKET/)

    /* وحاويةٌ «خاصّة» هي نفسُها العامّة لا تفصل شيئًا */
    expect(() =>
      assertPrivateIsolation({
        ...base,
        privateBucket: 'media-public',
        publicBaseUrl: 'https://cdn.example.com',
      }),
    ).toThrow(/R2_PRIVATE_BUCKET/)
  })

  it('وبحاويتين مستقلّتين يمرّ', () => {
    expect(() =>
      assertPrivateIsolation({
        ...base,
        privateBucket: 'media-private',
        publicBaseUrl: 'https://cdn.example.com',
      }),
    ).not.toThrow()
  })

  it('وبلا نطاقٍ عامّ يمرّ — لا شيء يُقدَّم علنًا أصلًا', () => {
    expect(() =>
      assertPrivateIsolation({ ...base, privateBucket: null, publicBaseUrl: null }),
    ).not.toThrow()
  })

  it('والمفتاح يختار حاويته: العامّ في العامّة والخاصّ في الخاصّة', async () => {
    const seen: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seen.push(String(input))
      return new Response('', { status: 200 })
    }) as typeof fetch

    try {
      const driver = r2Driver({
        ...base,
        privateBucket: 'media-private',
        publicBaseUrl: 'https://cdn.example.com',
      })
      await driver.remove('platform/images/a.png')
      await driver.remove('users-files/usr_1/proof.pdf')

      expect(seen[0]).toContain('/media-public/platform/images/a.png')
      expect(seen[1]).toContain('/media-private/users-files/usr_1/proof.pdf')
      /* ولا يتسرّب الخاصُّ إلى الحاوية العامّة */
      expect(seen[1]).not.toContain('media-public')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('والرابطُ العامّ لا يُشتقّ لمفتاحٍ خاصّ — يُقدَّم من التطبيق وحده', () => {
    const driver = r2Driver({
      ...base,
      privateBucket: 'media-private',
      publicBaseUrl: 'https://cdn.example.com',
    })
    expect(driver.publicUrl('platform/images/a.png')).toBe(
      'https://cdn.example.com/platform/images/a.png',
    )
  })
})

/**
 * **العطل يجب أن يَنطق** — وقد كان يبلغ صاحبَ اللوحة «تعذّر الاتّصال بالخادم».
 *
 * ثلاثةُ أعطالٍ كانت تُقرأ عطلًا واحدًا: طلبٌ معلَّق بلا سقف (فيردّ الوكيل
 * العكسيّ 504 بصفحة HTML)، و`fetch failed` بلا سبب، و«403» بلا رمز. فلا
 * يُعرف أمفتاحٌ خاطئ أم حاويةٌ مفقودة أم خادمٌ لا يبلغ كلاودفلير — وكلٌّ
 * يُصلَح بغير ما يُصلَح به الآخر.
 */
describe('أعطالُ R2 تُنطَق لا تُخمَّن', () => {
  const config = {
    accountId: 'acc',
    bucket: 'media-public',
    privateBucket: 'media-private',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    publicBaseUrl: null,
  }
  const key = platformKey('image/png')
  const bytes = new Uint8Array([1, 2, 3])
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  /*
   * **الحارس الذي يمنع التعليق بلا سقف.**
   *
   * ولو سقط لعاد `fetch` بلا `signal`، فبقي الطلب معلَّقًا حتى مهلة undici
   * الداخلية — وهي أطول من كلّ وكيلٍ عكسيّ أمامه.
   */
  it('كلُّ طلبٍ يحمل سقفَ مهلةٍ — ولا يُترك معلَّقًا', async () => {
    const signals: (AbortSignal | null | undefined)[] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      signals.push(init?.signal)
      return new Response('', { status: 200 })
    }) as typeof fetch

    const driver = r2Driver(config)
    await driver.put(key, bytes, 'image/png')
    await driver.remove(key)
    await driver.read(key)

    expect(signals).toHaveLength(3)
    for (const signal of signals) expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('وانقضاءُ المهلة يُقال مهلةً — لا «تعذّر الاتّصال»', async () => {
    globalThis.fetch = (async () => {
      const error = new Error('The operation was aborted due to timeout')
      error.name = 'TimeoutError'
      throw error
    }) as typeof fetch

    await expect(r2Driver(config).put(key, bytes, 'image/png')).rejects.toThrow(/المهلة/)
  })

  it('و«fetch failed» تُبدَّل بسببها من `cause.code`', async () => {
    globalThis.fetch = (async () => {
      throw Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } })
    }) as typeof fetch

    await expect(r2Driver(config).put(key, bytes, 'image/png')).rejects.toThrow(/ENOTFOUND/)
  })

  /*
   * «403» وحدها لا تُصلَح: مفتاحٌ خاطئ، أو رمزٌ بلا صلاحية كتابة، أو حاويةٌ
   * باسمٍ آخر — ثلاثتُها تحت الرقم نفسه، ورمزُ R2 في الجسم يفرّقها.
   */
  it('ورمزُ خطأ R2 يُقتطف من الجسم فيُقرأ مع الرقم', async () => {
    globalThis.fetch = (async () =>
      new Response(
        '<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code><Message>…</Message></Error>',
        { status: 403 },
      )) as typeof fetch

    await expect(r2Driver(config).put(key, bytes, 'image/png')).rejects.toThrow(
      /403 SignatureDoesNotMatch/,
    )
  })

  it('وحذفُ ما ليس موجودًا يبقى غيرَ خطأ — 404 تُحتمل', async () => {
    globalThis.fetch = (async () => new Response('', { status: 404 })) as typeof fetch
    await expect(r2Driver(config).remove(key)).resolves.toBeUndefined()
  })
})

/**
 * **الترويسةُ التي أسقطت الرفعَ كلَّه — ولم يمسكها فحصٌ واحد.**
 *
 * S3 تشترط `x-amz-content-sha256` مُرسَلةً و**موقَّعة**. وتعليقٌ في `sigv4.ts`
 * كان يقول إنّ `r2.ts` يضيفها، و`r2.ts` لم يكن يضيفها — فلم تُرسل ولم
 * تُوقَّع. فردّ R2 بـ403 على كلّ طلبٍ موقَّع: الرفعُ يرمي، والحذفُ يرمي،
 * **والقراءةُ تردّ `null` صامتةً** فتُقرأ «ملفٌّ غير موجود» لا «رُفض».
 *
 * ولم تمسكه فحوصُ `sigv4` لأنّها تقيس التوقيعَ بمتّجهات أمازون — وهي صحيحةٌ
 * حسابًا — ولا تقيس **أنّ ما يُرسَل إلى R2 يحمل ما تشترطه S3**. فهذا الفحص
 * يقيس العقدَ لا الحساب.
 *
 * وقِيس على حاويةٍ حقيقية: بلا توقيعها `403`، وبتوقيعها `200`.
 */
describe('تجزئةُ الجسم — تُرسل وتُوقَّع في كلّ طلب', () => {
  const config = {
    accountId: 'acc',
    bucket: 'media-public',
    privateBucket: 'media-private',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    publicBaseUrl: null,
  }
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  /** يُوقِع بكلّ عملياتِ المحرّك ويردّ ترويسات كلّ طلبٍ خرج. */
  async function headersOf(): Promise<Record<string, string>[]> {
    const sent: Record<string, string>[] = []
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent.push((init?.headers ?? {}) as Record<string, string>)
      return new Response('', { status: 200 })
    }) as typeof fetch

    const driver = r2Driver(config)
    await driver.put(platformKey('image/png'), new Uint8Array([1, 2, 3]), 'image/png')
    await driver.remove(platformKey('image/png'))
    await driver.read(platformKey('image/png'))
    return sent
  }

  it('الترويسةُ مُرسَلةٌ في الرفع والحذف والقراءة — ولا واحدةَ بلا', async () => {
    const sent = await headersOf()
    expect(sent).toHaveLength(3)
    for (const headers of sent) {
      expect(headers['x-amz-content-sha256'], JSON.stringify(headers)).toBeTruthy()
    }
  })

  /*
   * إرسالُها بلا توقيعٍ لا يكفي — وهو بعينه ما ردّ R2 عليه بـ403. فالفحص
   * يقرأ `SignedHeaders` من ترويسة التوقيع نفسها.
   */
  it('ومذكورةٌ في `SignedHeaders` — فإرسالُها بلا توقيعٍ يُردّ بـ403', async () => {
    const sent = await headersOf()
    for (const headers of sent) {
      const signedList = /SignedHeaders=([^,]+)/.exec(headers.authorization)?.[1] ?? ''
      expect(signedList.split(';'), headers.authorization).toContain('x-amz-content-sha256')
    }
  })

  it('وقيمتُها هي تجزئةُ ما رُفع فعلًا — لا قيمةً ثابتة', async () => {
    const sent = await headersOf()
    /* sha256 للبايتات [1,2,3] */
    expect(sent[0]['x-amz-content-sha256']).toBe(
      '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    )
    /* وللجسم الفارغ في الحذف */
    expect(sent[1]['x-amz-content-sha256']).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    /* والقراءةُ بلا جسمٍ تُعلن ذلك صراحةً */
    expect(sent[2]['x-amz-content-sha256']).toBe('UNSIGNED-PAYLOAD')
  })
})

/**
 * **الرفع المباشر في R2 — وأين تهبط البايتاتُ غيرُ المفحوصة.**
 *
 * الخادم لا يرى ما كتبه المتصفّح وقتَ كتابته. فلو هبط في الحاوية العامّة
 * لَسكن — ولو دقيقة — حاويةً يقدّمها نطاقٌ عامّ بلا سؤال، والرافعُ يعرف
 * مفتاحَه. فالحجرُ في الحاوية الخاصّة شرطُ الأمان لا ترتيبُ مجلّدات.
 */
describe('الرفع المباشر في R2', () => {
  const config = {
    accountId: 'acc',
    bucket: 'media-public',
    privateBucket: 'media-private',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    publicBaseUrl: null,
  }
  const realFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('مفتاحُ الحجر يسكن الحاوية **الخاصّة** — لا العامّة', async () => {
    const key = stagingKey('image/png')
    const url = await r2Driver(config).signedUpload({
      key,
      contentType: 'image/png',
      expiresInSeconds: 900,
    })
    expect(url).toContain('/media-private/')
    expect(url).not.toContain('media-public')
  })

  /*
   * **الحارس الذي يمنع كتابةَ نوعٍ لم نأذن به.**
   *
   * ولو سقط لَأمكن لحامل الرابط أن يكتب به HTML بمفتاحٍ ينتهي بـ`.png`،
   * فيُقدَّم من نطاقٍ يثق به المتصفّح. وR2 نفسه يردّه ما دام النوع موقَّعًا.
   */
  it('والنوعُ موقَّعٌ في الرابط — فلا يُكتب بغيره', async () => {
    const url = await r2Driver(config).signedUpload({
      key: stagingKey('image/png'),
      contentType: 'image/png',
      expiresInSeconds: 900,
    })
    const signed = decodeURIComponent(/X-Amz-SignedHeaders=([^&]+)/.exec(url!)?.[1] ?? '')
    expect(signed.split(';')).toContain('content-type')
    expect(signed.split(';')).toContain('host')
    expect(url).toMatch(/X-Amz-Signature=[a-f0-9]{64}/)
  })

  it('ومدّتُه محدودة — رابطُ كتابةٍ لا يعيش بلا أجل', async () => {
    const url = await r2Driver(config).signedUpload({
      key: stagingKey('image/png'),
      contentType: 'image/png',
      expiresInSeconds: 900,
    })
    expect(url).toContain('X-Amz-Expires=900')
  })

  it('والنقلُ نسخٌ بأمر المخزن ثمّ حذفٌ — ولا تمرّ البايتاتُ بالخادم', async () => {
    const calls: { url: string; method: string; source?: string }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url: String(input), method: init?.method ?? 'GET', source: headers['x-amz-copy-source'] })
      return new Response('', { status: 200 })
    }) as typeof fetch

    await r2Driver(config).move('staging/abc.png', 'platform/images/xyz.png')

    /* ١) نسخٌ إلى العامّة، ومصدرُه في الخاصّة — والحاويتان مذكورتان */
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toContain('/media-public/platform/images/xyz.png')
    expect(calls[0].source).toBe('/media-private/staging/abc.png')
    /* ولا جسمَ يُرسل: النسخُ أمرٌ لا نقلُ بايتات */
    /* ٢) ثمّ يُحذف الحجر */
    expect(calls[1].method).toBe('DELETE')
    expect(calls[1].url).toContain('/media-private/staging/abc.png')
  })

  it('وقراءةُ الرأس تطلب مدًى — لا الملفَّ كلَّه', async () => {
    let range = ''
    globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      range = ((init?.headers ?? {}) as Record<string, string>).range ?? ''
      return new Response(new Uint8Array([1, 2, 3]), { status: 206 })
    }) as typeof fetch

    await r2Driver(config).readRange('staging/abc.png', 256 * 1024)
    expect(range).toBe('bytes=0-262143')
  })
})
