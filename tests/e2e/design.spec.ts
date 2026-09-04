import { expect, test } from '@playwright/test'
import { loginAdmin, loginUser, USERS } from './support/session'

test.describe('الصفحة الرئيسية', () => {
  test('البطل والخلاصات الثلاث تظهر بأقسامها', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('لوحتك تسوى')
    await expect(page.getByRole('link', { name: /شوف اللوحات/ }).first()).toBeVisible()

    for (const heading of ['مزادات جارية', 'بيع مباشر', 'على السوم']) {
      await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible()
    }
  })

  test('المحتوى مرئيّ في مخرجات الخادم لا يعتمد على جافاسكربت', async ({ request }) => {
    const html = await (await request.get('/')).text()

    // النصوص موجودة في HTML الخام
    for (const needle of ['لوحتك تسوى', 'مزادات جارية', 'بيع مباشر', 'على السوم']) {
      expect(html).toContain(needle)
    }

    // ولا عنصر يُرسَل بشفافية صفر: حركة دخول مبنيّة على JS تترك الصفحة
    // بيضاء إن تعطّل السكربت
    const hidden = html.match(/opacity:\s*0[;"]/g) ?? []
    expect(hidden).toHaveLength(0)
  })

  test('كل خلاصة تقود إلى السوق مفلترًا بطريقة بيعها', async ({ page }) => {
    await page.goto('/')
    await page
      .getByRole('heading', { name: /مزادات جارية/ })
      .locator('..')
      .locator('..')
      .getByRole('link', { name: /عرض الكل/ })
      .click()

    await expect(page).toHaveURL(/sale=auction/)
    await expect(page.getByRole('tab', { name: 'مزاد' })).toHaveAttribute('aria-selected', 'true')
  })

  test('التذييل يحمل ضمانات المنصّة وروابطها', async ({ page }) => {
    await page.goto('/')
    const footer = page.getByRole('contentinfo')

    for (const assurance of ['سعر احتياطي محمي', 'عربون يضمن الجدّية', 'كشف مزايدات شفّاف']) {
      await expect(footer.getByText(assurance)).toBeVisible()
    }
    await expect(footer.getByRole('navigation', { name: 'روابط عامة' })).toBeVisible()
    await expect(footer).toContainText('©')
  })
})

test.describe('فلاتر السوق', () => {
  test('تابات طريقة البيع تصفّي النتائج', async ({ page }) => {
    await page.goto('/market')
    const count = page.getByText(/عرض \d+ من \d+ لوحة/)
    await expect(count).toBeVisible()
    const before = await count.innerText()

    await page.getByRole('tab', { name: 'مزاد' }).click()
    await expect(page.getByRole('tab', { name: 'مزاد' })).toHaveAttribute('aria-selected', 'true')
    await expect(count).not.toHaveText(before)
  })

  test('التاب المفتوح ظاهر للعين لا لقارئ الشاشة وحده', async ({ page }) => {
    await page.goto('/market')
    const selected = page.locator('[role="tab"][aria-selected="true"]')
    await expect(selected).toHaveText(/الكل/)

    /*
     * الخطّ السفلي كان `-z-10` فيُرسم خلف الصفحة لا خلف النص، فلا يظهر شيء
     * ولا يعرف الزائر أي قسم يتصفّح. نتحقّق أنه مرئيّ فعلًا لا موجودًا فحسب.
     */
    /*
     * المؤشّر يُركَّب بعد الترطيب (`layoutId` في Framer)، فالقياس فور التحميل
     * قد يقع على عنصر بلا مقاس — وهو سباقٌ في الاختبار لا عيبٌ في الصفحة.
     */
    const bar = selected.locator('span').last()
    await expect
      .poll(() => bar.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(0)

    const indicator = await bar.evaluate((el) => {
      const style = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      return { zIndex: style.zIndex, height: Math.round(box.height), width: Math.round(box.width) }
    })
    expect(indicator.zIndex).not.toMatch(/^-/)
    expect(indicator.height).toBeGreaterThan(0)
    expect(indicator.width).toBeGreaterThan(20)

    // والمفتوح يتميّز عن غيره لونًا ووزنًا لا بالخطّ وحده
    const [openWeight, otherWeight] = await Promise.all([
      selected.evaluate((el) => getComputedStyle(el).fontWeight),
      page
        .locator('[role="tab"][aria-selected="false"]')
        .first()
        .evaluate((el) => getComputedStyle(el).fontWeight),
    ])
    expect(Number(openWeight)).toBeGreaterThan(Number(otherWeight))
  })

  test('التاب المفتوح يُكتب في الرابط فيصمد أمام التحديث والمشاركة', async ({ page }) => {
    await page.goto('/market')
    await expect(page).not.toHaveURL(/sale=/)

    await page.getByRole('tab', { name: 'بيع مباشر' }).click()
    await expect(page).toHaveURL(/sale=fixed/)

    // التحديث يُبقي الزائر حيث كان
    await page.reload()
    await expect(page.getByRole('tab', { name: 'بيع مباشر' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    // والعودة إلى «الكل» تُنظّف الرابط
    await page.getByRole('tab', { name: 'الكل' }).click()
    await expect(page).not.toHaveURL(/sale=/)
  })

  test('دُرج الفلاتر يفتح ويطبّق نوع اللوحة ويعرض عدّادها', async ({ page }) => {
    await page.goto('/market')
    await page.getByRole('button', { name: /فلاتر/ }).click()

    await expect(page.getByRole('heading', { name: 'تصفية النتائج' })).toBeVisible()
    await page.getByRole('button', { name: 'دراجة نارية' }).click()
    await page.getByRole('button', { name: 'عرض النتائج' }).click()

    // رقاقة الفلتر المفعّل ظاهرة ولا يبقى الفلتر مخفيًا بلا أثر
    await expect(page.getByText('دراجة نارية').first()).toBeVisible()
  })
})

test.describe('الترويسة والتنقّل', () => {
  test('دُرج الجوال يفتح ويغلق عند الانتقال', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')

    await page.getByRole('button', { name: 'القائمة' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    await drawer.getByRole('link', { name: 'السوق' }).click()
    await expect(page).toHaveURL(/\/market/)
    await expect(drawer).not.toBeVisible()
  })

  test('لا تمرير أفقي في أي عرض', async ({ page }) => {
    for (const width of [375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      )
      expect(overflow, `تمرير أفقي عند عرض ${width}`).toBe(false)
    }
  })
})


test.describe('فلترة عدد الحروف والأرقام', () => {
  async function openDrawer(page: import('@playwright/test').Page) {
    await page.goto('/market')
    await page.getByRole('button', { name: /فلاتر/ }).click()
    await expect(page.getByRole('heading', { name: 'تصفية النتائج' })).toBeVisible()
  }

  test('«ثلاثي الحروف» يقلّص النتائج ويترك رقاقة قابلة للإزالة', async ({ page }) => {
    const count = page.getByText(/عرض \d+ من \d+ لوحة/)
    await openDrawer(page)
    const before = await count.innerText()

    await page.getByRole('button', { name: 'ثلاثي الحروف' }).click()
    await page.getByRole('button', { name: 'عرض النتائج' }).click()

    await expect(count).not.toHaveText(before)
    const chip = page.getByRole('button', { name: /إزالة ثلاثي الحروف/ })
    await expect(chip).toBeVisible()

    await chip.click()
    await expect(count).toHaveText(before)
  })

  test('عدد الأرقام يصفّي مستقلًّا عن عدد الحروف', async ({ page }) => {
    const count = page.getByText(/عرض \d+ من \d+ لوحة/)
    await openDrawer(page)
    const before = await count.innerText()

    await page.getByRole('button', { name: 'أربعة أرقام' }).click()
    await page.getByRole('button', { name: 'عرض النتائج' }).click()
    await expect(count).not.toHaveText(before)

    // كل لوحة معروضة تحمل أربعة أرقام فعلًا
    // داخل البطاقات وحدها: لوحة التذييل زينة بمقاس آخر
    const digits = await page.locator('article [data-plate-numbers]').evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.plateNumbers ?? ''),
    )
    expect(digits.length).toBeGreaterThan(0)
    for (const value of digits) expect(value).toHaveLength(4)
  })
})

test.describe('اللوحة داخل البطاقة', () => {
  test('لوحة الدراجة بلا شعار أوسط وبارتفاع بطاقات موحّد', async ({ page }) => {
    await page.goto('/market')
    await page.getByRole('button', { name: /فلاتر/ }).click()
    await page.getByRole('button', { name: 'دراجة نارية' }).click()
    await page.getByRole('button', { name: 'عرض النتائج' }).click()

    const moto = page.locator('article svg[data-plate-type="motorcycle"]').first()
    await expect(moto).toBeVisible()
    // الشعار الأوسط محذوف: لا يبقى إلا شعار الشريط الجانبي
    expect(await moto.locator('[data-plate-emblem="center"]').count()).toBe(0)

    // ارتفاعات اللوحات موحّدة عبر الأنواع فلا تختلف مقاسات البطاقات
    await page.goto('/market')
    const heights = await page.locator('article svg[data-plate-type]').evaluateAll((nodes) =>
      nodes.map((n) => Math.round(n.getBoundingClientRect().height)),
    )
    expect(heights.length).toBeGreaterThan(1)
    expect(new Set(heights).size).toBe(1)
  })

  test('العدّاد تحت اللوحة مباشرة والسعر تحته', async ({ page }) => {
    await page.goto('/market?sale=auction')
    const card = page.locator('article').filter({ has: page.getByRole('timer') }).first()

    const order = await card.evaluate((node) => {
      const y = (selector: string) => {
        const el = node.querySelector(selector)
        return el ? el.getBoundingClientRect().top : NaN
      }
      return {
        plate: y('svg[data-plate-type]'),
        timer: y('[role="timer"]'),
        price: y('[data-card-price]'),
      }
    })

    expect(order.plate).toBeLessThan(order.timer)
    expect(order.timer).toBeLessThan(order.price)
  })
})

test.describe('مسار الصفقة وتفصيلها', () => {
  test('المشتري يرى المطلوب سداده بعد خصم العربون، ومسار صفقته', async ({ page }) => {
    // ماجد صاحب الصفقات المبذورة — مكتملة ومنتظِرة ومتخلّفة
    await loginUser(page, USERS.majed)
    await page.goto('/account/purchases')
    // صفوف الصفقات وحدها — الصفحة فيها قوائم أخرى (تنقّل الحساب مثلًا)
    const first = page.locator('li[data-row^="S"]').first()
    await expect(first).toBeVisible()

    // الطرح ظاهر: قيمة الصفقة، ثم العربون، ثم المطلوب
    await expect(first.getByText('قيمة الصفقة', { exact: true })).toBeVisible()
    await expect(first.getByText(/^(المطلوب سداده|سُدّد المتبقّي)$/)).toBeVisible()

    // والمسار سكّة بخمس محطّات ثابتة من النشأة إلى استقرار المال
    const rail = first.locator('ol').first()
    await expect(rail.locator('> li')).toHaveCount(5)
    // باسم كلمةٍ لكل محطّة — فالجملة لا تُقرأ تحت خمس نقاط على عرض الجوال
    await expect(rail.locator('> li').first()).toContainText('طلب')
    // والتفصيل موجود مطويًّا لمن أراده
    await expect(first.getByText('تفاصيل المسار')).toBeVisible()
  })

  test('التواريخ رقمية بشرطات مائلة بلا اسم شهر', async ({ page }) => {
    await loginUser(page, USERS.majed)
    await page.goto('/account/purchases')
    const text = (await page.locator('main').innerText()).replace(/[\u200e\u200f]/g, '')

    expect(text).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    // ولا اسم شهر عربي في أي ختم زمني
    for (const month of ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو',
      'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']) {
      expect(text, `اسم شهر في التواريخ: ${month}`).not.toContain(month)
    }
  })
})

test.describe('حراسة الأفعال التي لا رجعة فيها', () => {
  /*
   * فعلٌ يمسّ مال طرفٍ ثانٍ لا يقع بضغطة.
   *
   * كان «إلغاء» عند البائع و«إتمام/إلغاء» عند الأدمن يُنفَّذان فورًا بلا سؤال
   * ولا ذكر لما يقع بالعربون.
   */
  test('إلغاء البائع لصفقته يسأل ويذكر مصير العربون', async ({ page }) => {
    // سارة بائعة صفقتين بانتظار سداد المشتري — والدور فيهما على غيرها
    await loginUser(page, USERS.sara)
    await page.goto('/account/sales')
    const tab = page.getByRole('tab', { name: /تحت الإجراء/ })
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')

    const cancel = page.getByRole('button', { name: 'إلغاء الصفقة' }).first()
    await expect(cancel).toBeVisible()
    await cancel.click()

    await expect(page.getByRole('alertdialog')).toContainText('إلغاء الصفقة؟')
    await expect(page.getByRole('alertdialog')).toContainText('نهائيًّا ولا رجعة فيها')
    // والتراجع يترك الصفقة كما هي
    await page.getByRole('button', { name: 'تراجع' }).click()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('الصفحة تقبل التكبير باليدين', async ({ page }) => {
    await page.goto('/market')
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).not.toMatch(/maximum-scale|user-scalable=no/)
  })
})

test.describe('الجوال عند 360px', () => {
  /*
   * جداول الإدارة كانت تمرّر أفقيًّا ثلاثة أضعاف عرض الشاشة، وعمود الإجراءات
   * آخرها — فيُدفَن ما يُفعل خلف الحافّة. وصارت بطاقات، كلّ خليّة باسم عمودها.
   */
  test('جداول الإدارة تنقلب بطاقات بلا تمرير أفقي', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await loginAdmin(page)
    for (const path of ['/admin/orders', '/admin/users', '/admin/payments']) {
      await page.goto(path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `تمرير أفقي في ${path}`).toBeLessThanOrEqual(1)
    }
    // واسم العمود يظهر بجانب قيمته في الجداول
    await page.goto('/admin/users')
    const label = await page.evaluate(() => {
      const td = document.querySelector('.admin-table td')
      return td ? getComputedStyle(td, '::before').content : ''
    })
    expect(label.length).toBeGreaterThan(2)

    // والصفقات بطاقات ممتدّة لا جدولًا: كل ما يُقرأ ويُفعل داخل البطاقة
    await page.goto('/admin/orders')
    // الصفوف خارج القسم المفتوح مخفيّة، فيُقاس ما يُرى
    const card = page.locator('li[data-row]:visible').first()
    await expect(card).toBeVisible()
    await expect(card).toContainText('المشتري')
    expect(await page.locator('.admin-table').count()).toBe(0)
  })

  /*
   * أزرار «لوحاتي» في سطرٍ واحد لا تلتفّ، والإلغاء بلون فعله.
   *
   * كانت تلتفّ سطرين فيبدو «إلغاء العرض» وحده في سطرٍ كأنّه غير ما فوقه،
   * وكان بلون «تعديل» — وهو ينزل اللوحة من السوق ويوقف ما عليها.
   */
  test('أزرار لوحاتي في سطر واحد، والإلغاء أحمر', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await loginUser(page, USERS.waleed)
    await page.goto('/account/listings')

    const card = page.locator('main li').first()
    await expect(card).toBeVisible()

    const rows = await card.evaluate((li) => {
      const footer = li.lastElementChild as HTMLElement
      const kids = [...footer.children].filter((c) => (c as HTMLElement).offsetParent)
      return {
        lines: new Set(kids.map((c) => Math.round(c.getBoundingClientRect().top))).size,
        hidden: footer.scrollWidth - footer.clientWidth,
      }
    })
    expect(rows.lines, 'الأزرار تلتفّ إلى أكثر من سطر').toBe(1)
    expect(rows.hidden, 'زرٌّ مخبوء خلف الحافّة').toBeLessThanOrEqual(1)

    const cancel = page.getByRole('button', { name: 'إلغاء العرض' }).first()
    await expect(cancel).toBeVisible()
    const red = await cancel.evaluate((el) => getComputedStyle(el).backgroundColor)
    // لون الخطر لا الرماديّ: أحمرُ غالبٌ على قناتَي الخُضرة والزرقة
    const [r, g, b] = red.match(/\d+/g)!.map(Number)
    expect(r, red).toBeGreaterThan(150)
    expect(r, red).toBeGreaterThan(g + 60)
    expect(r, red).toBeGreaterThan(b + 60)
  })

  test('كشف الحساب يُقرأ كاملًا على الجوال', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    await loginUser(page, USERS.majed)
    await page.goto('/account/wallet')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
    // والرصيد — وهو آخر عمود — مرئي لا خلف حافّة
    await expect(page.getByText('الرصيد').first()).toBeVisible()
  })
})

/*
 * البطاقة على اللاب توب تقارب ألف بكسل، فنصفها كان بياضًا. ويملؤه ما يسأل
 * عنه البائع: كم رآه الناس، ومن يتصدّر، وكم بقي على الاحتياطي.
 */
test('لوحاتي على الشاشة الواسعة تملأ فراغها بما يخصّ البائع', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await loginUser(page, USERS.waleed)
  await page.goto('/account/listings')

  const panel = page.locator('main li dl').first()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('المشاهدات')

  // والاسم مُقنَّع كما يراه أيّ زائر — لا يكشفه كون البائع صاحب الإعلان
  const leader = await panel.textContent()
  if (leader?.includes('يتصدّرها')) expect(leader).toMatch(/\*{3,}/)

  // ويُخفى دون `lg` فلا يسحق العمودين قبله
  await page.setViewportSize({ width: 375, height: 900 })
  await expect(page.locator('main li dl').first()).toBeHidden()
})

test('نموذج الدخول لا يكتب كلمة المرور في الرابط إن تعطّل السكربت', async ({ page }) => {
  /*
   * `<form onSubmit>` بلا `method` يرتدّ إلى GET عند تعطّل الحزمة، فتُكتب
   * كلمة المرور في شريط العنوان وسجلّ التصفّح وترويسة `Referer`. رُصد حيًّا.
   */
  await page.goto('/login')
  await expect(page.locator('form').first()).toHaveAttribute('method', 'post')
})

test.describe('لمسات التصميم', () => {
  /*
   * اللوحة هي هويّة المنصّة، والحقيقية **مطروقة** لا مطبوعة — فتُنقَش في
   * المقاسات التي تُرى فيها التفاصيل، ولا يُحمَّل ذلك على أربعين بطاقة.
   */
  test('اللوحة الكبيرة منقوشة والصغيرة مسطّحة', async ({ page }) => {
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; status: string }[]
    }
    const open = listings.find((row) => row.status === 'active')!

    await page.goto(`/market/${open.id}`)
    const big = page.locator('svg[data-plate-type]').first()
    await expect(big).toBeVisible()
    expect(await big.locator('filter[id^="plate-emboss"]').count()).toBe(1)

    await page.goto('/market')
    const small = page.locator('article svg[data-plate-type]').first()
    await expect(small).toBeVisible()
    expect(await small.locator('filter[id^="plate-emboss"]').count()).toBe(0)
  })

  /*
   * صفقة اكتملت تُعلَن مرّة لصاحبها ثم تُطوى: احتفاءٌ يتكرّر يصير ضجيجًا.
   */
  test('لحظة اكتمال الصفقة تُعرض مرّة واحدة', async ({ page }) => {
    await loginUser(page, USERS.majed)
    await page.goto('/account/purchases?stage=done')
    await expect(page.getByText('صارت لك')).toBeVisible()

    await page.reload()
    await expect(page.getByText('صارت لك')).toHaveCount(0)
  })

  test('لوحة الإدارة تُصدّر الأمانة والإيراد قبل العدّادات', async ({ page }) => {
    await loginAdmin(page)
    await page.goto('/admin')
    await expect(page.getByText('أمانةٌ في يد المنصّة الآن')).toBeVisible()
    await expect(page.getByText('عرابين محجوزة').first()).toBeVisible()
    await expect(page.getByText('مبالغ صفقات محبوسة').first()).toBeVisible()
    // والمنحنى يمشي مع القراءة: الأقدم يمينًا واليوم يسارًا
    await expect(page.getByRole('img', { name: /إيراد آخر سبعة أيام/ })).toBeVisible()
  })
})

test.describe('التنقّل بلوحة المفاتيح في التابات', () => {
  /*
   * `role="tab"` عقدٌ لا وسم: من يعلنه يَعِد بأسهم تنقل، وبتبويبةٍ واحدة تدخل
   * الشريط وتخرج منه. وكان الشريط يعلن الدور ولا يفي به.
   */
  test('الأسهم تنقل بين التابات، والتبويبة تمرّ على المفتوح وحده', async ({ page }) => {
    await page.goto('/market')
    const tabs = page.getByRole('tab')
    await expect(tabs.first()).toBeVisible()

    // المفتوح وحده في ترتيب التبويب
    await expect(tabs.filter({ has: page.locator('[tabindex="0"]') })).toHaveCount(0)
    expect(await tabs.first().getAttribute('tabindex')).toBe('0')
    expect(await tabs.nth(1).getAttribute('tabindex')).toBe('-1')

    // وفي RTL السهم الأيسر يمضي إلى التالي
    await tabs.first().focus()
    await page.keyboard.press('ArrowLeft')
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('End')
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Home')
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('بطاقة السوق على الجوال', () => {
  test.use({ viewport: { width: 390, height: 900 } })

  /*
   * البطاقة صفٌّ ممتدّ: اللوحة نصفه ووسمُها تحتها في الفراغ الذي كان مهدورًا،
   * والسعر والعدّاد في النصف الآخر — وهما ما يحسم قرار المزايد.
   */
  test('اللوحة نصف البطاقة، ووسمها تحتها، والعدّاد سطرٌ مستقلّ', async ({ page }) => {
    await page.goto('/market')
    const card = page.locator('article').first()
    await expect(card).toBeVisible()

    const [cardBox, plateBox] = await Promise.all([
      card.boundingBox(),
      card.locator('svg[data-plate-type]').boundingBox(),
    ])
    // اللوحة تشغل ثلث عرض البطاقة على الأقلّ — لا رقعةً صغيرة في زاوية
    expect(plateBox!.width / cardBox!.width).toBeGreaterThan(0.33)

    // ووسمٌ واحد **مرئيّ** لا أربعة في سطر: صفّ الحاسوب باقٍ في DOM مخفيًّا
    const badges = card
      .locator('span:visible')
      .filter({ hasText: /^(مزاد|بيع مباشر|استقبال عروض)$/ })
    expect(await badges.count()).toBeLessThanOrEqual(1)

    // ولا تمرير أفقي
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('البطاقة تقصر فيظهر أكثر من إعلان في الطيّة', async ({ page }) => {
    await page.goto('/market')
    await page.locator('article').first().waitFor()
    const heights = await page
      .locator('article')
      .evaluateAll((els) => els.slice(0, 3).map((el) => el.getBoundingClientRect().height))
    for (const height of heights) expect(height).toBeLessThan(220)
  })
})

test.describe('تصفّح السوق على دفعات', () => {
  test.use({ viewport: { width: 390, height: 700 } })

  /*
   * الشبكة تُصيَّر على دفعات لا كاملة: مئة بطاقة فيها مئة SVG تُرسم ليرى
   * الزائر أربعًا. والنموّ **بلا طلب شبكة** — التصفية والترتيب في المتصفّح.
   */
  test('دفعة أولى محدودة، وتنمو بلا طلب من الخادم', async ({ page }) => {
    let apiCalls = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/listings')) apiCalls += 1
    })

    await page.goto('/market')
    await page.locator('article').first().waitFor()
    const first = await page.locator('article').count()
    expect(first).toBeLessThanOrEqual(12)

    const more = page.getByRole('button', { name: 'عرض المزيد' })
    await expect(more).toBeVisible()
    await expect(page.getByText(/عُرضت \d+ من \d+/)).toBeVisible()

    const before = apiCalls
    await more.click()
    await expect
      .poll(() => page.locator('article').count())
      .toBeGreaterThan(first)
    expect(apiCalls, 'التجزئة لا تكلّف الخادم طلبًا').toBe(before)
  })

  test('تغيير الفلتر يعيد العدّ إلى أوّله', async ({ page }) => {
    await page.goto('/market')
    await page.locator('article').first().waitFor()
    await page.getByRole('button', { name: 'عرض المزيد' }).click()
    const grown = await page.locator('article').count()

    await page.getByRole('tab', { name: 'مزاد' }).click()
    await expect(page.getByRole('tab', { name: 'مزاد' })).toHaveAttribute('aria-selected', 'true')
    // النتائج الجديدة تُفتح على أوّلها لا على آخر ما بلغه التمرير
    expect(await page.locator('article').count()).toBeLessThanOrEqual(grown)
  })
})

test('شعار اللوحة يُرسم ولو كان أوّل تعريف لقناعه في صفٍّ مخفيّ', async ({ page }) => {
  /*
   * كان قناع الشعار مشتركًا بين كل اللوحات. وفي جدولٍ يُخفي صفوفه
   * بـ`display:none` يقع أوّل تعريف في صفٍّ مخفيّ، فلا يحلّه المتصفّح وتُطلى
   * اللوحات الظاهرة **سوداء**. ولكل لوحة قناعها الآن.
   */
  await loginAdmin(page)
  await page.goto('/admin/orders')
  const plate = page.locator('svg[data-plate-type]:visible').first()
  await expect(plate).toBeVisible()

  // القناع الذي تشير إليه اللوحة الظاهرة معرَّفٌ داخلها هي
  const resolves = await plate.evaluate((svg) => {
    const masked = svg.querySelector('[mask^="url(#"]')
    if (!masked) return true
    // `url(#` خمسة أحرف لا ستّة
    const id = masked.getAttribute('mask')!.slice(5, -1)
    return svg.querySelector(`mask[id="${id}"]`) !== null
  })
  expect(resolves, 'قناع الشعار يشير إلى تعريف خارج لوحته').toBe(true)
})
