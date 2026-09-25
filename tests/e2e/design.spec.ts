import { expect, test } from '@playwright/test'
import { clickUntil, stableCount } from '../support/ui'
import { loginAdmin, loginUser, USERS } from './support/session'

test.describe('الصفحة الرئيسية', () => {
  test('البطل والخلاصات الثلاث تظهر بأقسامها', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1 })).toContainText('لوحتك تسوى')
    await expect(page.getByRole('link', { name: /شاهد سوق اللوحات/ }).first()).toBeVisible()

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

/**
 * حصيلةُ التصفية — **في الشريحة لا في سطرٍ تحتها**.
 *
 * كان سطرٌ يقول «عرض ١٤ من ٣٣ لوحة»، ورُفع بطلب صاحب المنصّة. وما كان يقوله
 * صار في شريحة «الكل»: عدّادٌ يُقرأ قبل الضغط لا بعده.
 */
function allCount(page: import('@playwright/test').Page) {
  return page.getByRole('tab', { name: 'الكل' }).locator('[data-tab-count]')
}

test.describe('فلاتر السوق', () => {
  test('تابات طريقة البيع تصفّي النتائج', async ({ page }) => {
    await page.goto('/market')
    const grid = page.locator('article')
    await expect(grid.first()).toBeVisible()
    const before = await grid.count()

    await page.getByRole('tab', { name: 'مزاد' }).click()
    await expect(page.getByRole('tab', { name: 'مزاد' })).toHaveAttribute('aria-selected', 'true')
    /* وعدّادُ الشريحة يطابق ما رُسم — فالوعد يُوفى */
    await expect.poll(() => grid.count()).toBeLessThan(before)
    await expect(page.getByRole('tab', { name: 'مزاد' }).locator('[data-tab-count]')).toHaveText(
      String(await grid.count()),
    )
  })

  test('الشريحة المفتوحة تُرى — مرسومةً فوق التاب لا خلف الصفحة', async ({ page }) => {
    await page.goto('/market')
    const selected = page.locator('[role="tab"][aria-selected="true"]')
    await expect(selected).toHaveText(/الكل/)

    /*
     * كان المؤشّر خطًّا سفليًّا بـ`-z-10` فيُرسم خلف الصفحة لا خلف النصّ، فلا
     * يظهر شيءٌ ولا يعرف الزائر أيّ قسمٍ يتصفّح. وصار شريحةً تملأ التاب،
     * فيُقاس أنّها مرسومةٌ فعلًا وبمقاس التاب لا موجودةً فحسب.
     *
     * والقياس بعد الترطيب: `layoutId` في Framer يُركّب المستطيل بعده، فالقياس
     * فور التحميل يقع على عنصرٍ بلا مقاس — سباقٌ في الفحص لا عيبٌ في الصفحة.
     */
    const thumb = selected.locator('[data-tab-thumb]')
    await expect.poll(() => thumb.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(0)

    const [box, tab] = await Promise.all([
      thumb.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return { zIndex: getComputedStyle(el).zIndex, width: rect.width, height: rect.height }
      }),
      selected.evaluate((el) => {
        const rect = el.getBoundingClientRect()
        return { width: rect.width, height: rect.height, color: getComputedStyle(el).color }
      }),
    ])
    expect(box.zIndex).not.toMatch(/^-/)
    // تملأ التاب لا نقطةً فيه
    expect(box.width).toBeGreaterThan(tab.width * 0.9)
    expect(box.height).toBeGreaterThan(tab.height * 0.9)

    // والمفتوح يتميّز عن غيره لونًا — لا بالشريحة وحدها
    const other = await page
      .locator('[role="tab"][aria-selected="false"]')
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    expect(tab.color).not.toBe(other)
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

  /*
   * ولا مُسبِّب غير مرئيّ: رابط «تخطّي إلى المحتوى» كان `sr-only` بحشوٍ يتغلّب
   * على `padding:0`، فيبقى ٣٣ بكسل مطلقًا عند الطرف — مقصوصًا عن العين
   * وحاضرًا في حساب العرض. تمريرٌ أفقيّ في كل صفحة لا يُرى له سبب.
   */
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
    await page.goto('/market')
    const count = allCount(page)
    /* تُقرأ قبل فتح الدُرج: الدُرج يغطّي الشرائح فلا تُقرأ وهو مفتوح */
    const before = await count.innerText()
    await openDrawer(page)

    await page.getByRole('button', { name: 'ثلاثي الحروف' }).click()
    await page.getByRole('button', { name: 'عرض النتائج' }).click()

    await expect(count).not.toHaveText(before)
    const chip = page.getByRole('button', { name: /إزالة ثلاثي الحروف/ })
    await expect(chip).toBeVisible()

    await chip.click()
    await expect(count).toHaveText(before)
  })

  test('عدد الأرقام يصفّي مستقلًّا عن عدد الحروف', async ({ page }) => {
    await page.goto('/market')
    const count = allCount(page)
    /* تُقرأ قبل فتح الدُرج: الدُرج يغطّي الشرائح فلا تُقرأ وهو مفتوح */
    const before = await count.innerText()
    await openDrawer(page)

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
    // واسم العمود يظهر بجانب قيمته في ما بقي جدولًا — وجدولٌ فيه صفوف
    await page.goto('/admin/deposits')
    const label = await page.evaluate(() => {
      const td = document.querySelector('.admin-table td')
      return td ? getComputedStyle(td, '::before').content : ''
    })
    expect(label.length).toBeGreaterThan(2)

    /*
     * والإعلانات بطاقاتٌ اللوحةُ عنوانها.
     *
     * كان جدولًا عرضه ٦٢rem يُمرَّر أفقيًّا، فتُقرأ اللوحة في عمودٍ والسعر في
     * عمودٍ لا يُريان معًا. والمشغّل يبحث عن إعلانٍ بعينه يعرفه بصورة لوحته.
     */
    await page.goto('/admin/listings')
    /*
     * أوّل بطاقةٍ **ظاهرة** لا أوّل بطاقةٍ في الصفحة.
     *
     * الصفحة صارت أقسامًا — معروضة ومباعة وملغاة وموقوفة — وغيرُ المفتوح
     * يُخفى بـ`display:none` لا يُنزع. وترتيب الصفوف في الـDOM ترتيبُ المصدر
     * لا ترتيبُ القسم، فأوّلها قد يكون في قسمٍ آخر — ومتى باعت بقيّةُ الطقم
     * أوّلَ إعلانٍ سقط هذا الفحص وحده بلا أن ينكسر شيء في الصفحة.
     */
    const listingCard = page.locator('li[data-row]:visible').first()
    await expect(listingCard).toBeVisible()
    await expect(listingCard.locator('svg[data-plate-type]')).toBeVisible()
    expect(await page.locator('.admin-table').count()).toBe(0)
    const listingsOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    expect(listingsOverflow, 'تمرير أفقي في /admin/listings').toBeLessThanOrEqual(1)

    /*
     * والمستخدمون بطاقات كذلك — ولا بريد فيها.
     *
     * البريد لا يُقرَّر به شيء وهو يُمسح بالعين في قائمة، وهو بيانٌ شخصيّ
     * يُعرض على شاشةٍ قد تُشارَك أو تُصوَّر. وموضعه صفحة صاحبه.
     */
    await page.goto('/admin/users')
    const userCard = page.locator('li[data-row]').first()
    await expect(userCard).toBeVisible()
    await expect(userCard).not.toContainText('@demo.sa')
    expect(await page.locator('.admin-table').count()).toBe(0)

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

    /*
     * الصفُّ يُلتقط بمِقبضه وبزرِّ الإلغاء فيه.
     *
     * وكان يُؤخذ بـ`li.lastElementChild`، فلمّا تغيّر بناءُ البطاقة صار ذلك
     * غلافَها لا صفَّ أزرارها. وكان يقيس أوّلَ بطاقةٍ ثمّ يفتّش عن «إلغاء
     * العرض» في الصفحة كلّها — فيقيس بطاقةً ويحكم على أخرى، وقد تكون الأولى
     * بلا أفعالٍ أصلًا.
     */
    const rows = page.locator('[data-card-actions]')
    await expect(rows.first()).toBeVisible()

    /*
     * يُقاس أعرضُ صفٍّ في الصفحة لا أوّلُه.
     *
     * فالبطاقاتُ تختلف أفعالُها بحال اللوحة: صفٌّ بزرّين لا يفيض عن أضيق
     * شاشةٍ أبدًا. والالتفافُ إن وقع وقع على أثقلها.
     */
    const widest = await rows.evaluateAll((list) => {
      let best = 0
      let most = -1
      list.forEach((footer, index) => {
        const kids = [...footer.querySelectorAll(':scope > *, :scope > .contents > *')].filter(
          (c) =>
            (c as HTMLElement).offsetParent && !(c as HTMLElement).classList.contains('contents'),
        )
        if (kids.length > most) {
          most = kids.length
          best = index
        }
      })
      return best
    })
    const row = rows.nth(widest)
    await expect(row).toBeVisible()

    const measure = () =>
      row.evaluate((footer: HTMLElement) => {
        /* `display:contents` يجعل الأزرار أحفادًا في الشجرة وأبناءً في التخطيط */
        const kids = [...footer.querySelectorAll(':scope > *, :scope > .contents > *')].filter(
          (c) =>
            (c as HTMLElement).offsetParent && !(c as HTMLElement).classList.contains('contents'),
        )
        return {
          count: kids.length,
          lines: new Set(kids.map((c) => Math.round(c.getBoundingClientRect().top))).size,
          hidden: footer.scrollWidth - footer.clientWidth,
        }
      })

    /*
     * والعهدُ نفسُه يُقاس، لا أثرُه على بياناتِ اليوم.
     *
     * فعددُ الأزرار يتبع حالَ اللوحات، وهي تتبدّل بما يفعله ما قبله من
     * اختبارات: صفٌّ بزرّين لا يلتفّ ولو أُذن له، فيمرّ القياسُ بلا معنى
     * — وصفٌّ بواحدٍ يُسقطه على غير علّة، وهو ما وقع في البوّابة.
     *
     * والعهدُ أن يُمرَّر الصفُّ ولا يلتفّ: يُقرأ من الصفّ نفسِه فيثبت.
     */
    expect(
      await row.evaluate((el) => getComputedStyle(el).flexWrap),
      'صفُّ الأزرار يلتفّ بدل أن يُمرَّر',
    ).toBe('nowrap')

    const wide = await measure()
    expect(wide.lines, 'الأزرار تلتفّ إلى أكثر من سطر').toBe(1)
    expect(wide.hidden, 'زرٌّ مخبوء خلف الحافّة عند 360').toBeLessThanOrEqual(1)

    /*
     * ثمّ يُضيَّق إلى 320.
     *
     * فعند 360 تسع الأزرارُ الصفَّ بعشرين بكسلًا فائضة — يستوي فيها الالتفافُ
     * ومنعُه، فلا يُمسك الاختبارُ شيئًا. وعند 320 تفيض عن الصفّ، فإمّا التفّت
     * سطرين وإمّا بقيت سطرًا يُمرَّر. وهذا هو المقيس.
     */
    await page.setViewportSize({ width: 320, height: 900 })
    await expect(row).toBeVisible()
    const narrow = await measure()
    expect(narrow.lines, 'الأزرار تلتفّ عند 320 بدل أن تُمرَّر').toBe(1)

    const cancel = page.getByRole('button', { name: 'إلغاء العرض' }).first()
    await expect(cancel).toBeVisible()
    const red = await cancel.evaluate((el) => getComputedStyle(el).backgroundColor)
    // لون الخطر لا الرماديّ: أحمرُ غالبٌ على قناتَي الخُضرة والزرقة
    const [r, g, b] = red.match(/\d+/g)!.map(Number)
    expect(r, red).toBeGreaterThan(150)
    expect(r, red).toBeGreaterThan(g + 60)
    expect(r, red).toBeGreaterThan(b + 60)
  })

  /*
   * أقسام الإدارة دُرجٌ جانبيّ لا شريطٌ يُمرَّر.
   *
   * كانت أربعة عشر رابطًا في صفٍّ أفقيّ داخل شاشة ٣٧٥، أكثرها خلف الحافّة،
   * وعناوين العناقيد تمرّ في الصفّ نفسه فلا تفصل شيئًا. ولوحة الإدارة تُفتح
   * على قسمٍ بعينه لا تُتصفَّح، فالوصول إلى قسمٍ مخبوء كان تمريرًا وتخمينًا.
   */
  test('أقسام الإدارة دُرجٌ جانبيّ يُظهرها كلّها', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginAdmin(page)
    await page.goto('/admin/orders')

    // العمود الجانبي غائب، ولا شريط يُمرَّر مكانه
    await expect(page.locator('nav[aria-label="أقسام الإدارة"]')).toBeHidden()

    const trigger = page.getByRole('button', { name: 'أقسام الإدارة' })
    await expect(trigger).toBeVisible()
    await trigger.click()

    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()
    /*
     * كلّها حاضرة دفعةً واحدة — والعدد يُقاس بالعمود لا يُكتب رقمًا.
     *
     * رقمٌ مثبَّت يسقط كلّما أُضيف قسم، فيُصلَح بتحديثه لا بالنظر فيما كُسر.
     * والمقصود أنّ الدُرج لا يُسقط شيئًا يُظهره العمود، وهذا ما يُقاس.
     */
    const sections = await page.evaluate(
      () => document.querySelectorAll('nav[aria-label="أقسام الإدارة"] a').length,
    )
    expect(sections).toBeGreaterThan(10)
    await expect(drawer.getByRole('link')).toHaveCount(sections)
    for (const group of ['التشغيل', 'المال', 'المحاسبة', 'النظام']) {
      await expect(drawer, `عنقود ${group} غائب عن الدُرج`).toContainText(group)
    }

    // والنقر ينقل ويُغلق — لا يبقى الدُرج فوق الصفحة الجديدة
    await drawer.getByRole('link', { name: /الإعدادات/ }).click()
    await expect(page).toHaveURL(/\/admin\/settings/)
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  /*
   * التابات تقتسم العرض فلا تُسحب باللمس.
   *
   * كانت `overflow-x-auto` وثلاثة أزرار تتجاوز ٣٧٥ بكسل بقليل، فيصير الشريط
   * منطقة سحبٍ باللمس: تتحرّك التابات مع الإصبع وتتأرجح عند الطرفين. وما
   * يُلمس ليَنقُل لا يجوز أن ينزلق.
   */
  test('تابات المعاملات لا تُسحب باللمس', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await loginUser(page, USERS.majed)

    for (const path of ['/account/purchases', '/account/sales']) {
      await page.goto(path)
      const drag = await page.locator('[role="tablist"]').first().evaluate((el) => ({
        x: el.scrollWidth - el.clientWidth,
        y: el.scrollHeight - el.clientHeight,
      }))
      expect(drag.x, `${path}: الشريط يُسحب أفقيًّا`).toBeLessThanOrEqual(1)
      expect(drag.y, `${path}: الشريط يُسحب رأسيًّا`).toBeLessThanOrEqual(1)
    }
  })

  /*
   * الدُرج يُمرَّر فيُبلَغ آخره.
   *
   * كان `h-full` بلا تمرير: ثلاثة عشر قسمًا آخرها «الإعدادات» خلف الحافّة
   * السفلى، والقصّ صامت لا يدلّ عليه شريط ولا ظلّ.
   */
  test('دُرج الإدارة يُمرَّر حتى آخر قسم', async ({ page }) => {
    // شاشة قصيرة عمدًا: هي ما يكشف القصّ
    await page.setViewportSize({ width: 375, height: 620 })
    await loginAdmin(page)
    await page.goto('/admin')

    await page.getByRole('button', { name: 'أقسام الإدارة' }).click()
    const drawer = page.getByRole('dialog')
    await expect(drawer).toBeVisible()

    const last = drawer.getByRole('link', { name: /الإعدادات/ })
    await last.scrollIntoViewIfNeeded()
    await expect(last).toBeInViewport()
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

  /*
   * وصفّ الإجماليّ بطاقةٌ كبقيّتها.
   *
   * كان `tfoot` يبقى `table-footer-group` في جدولٍ صار `display:block`، فيلفّه
   * المتصفّح بجدولٍ ضمنيّ يشرنق نفسه صندوقًا ضيّقًا خارج نسق البطاقات. وخلاياه
   * كانت تأخذ أسماء أعمدةٍ ليست لها — أوّلها يمتدّ ثلاثة أعمدة فيزيح ما بعده —
   * فيُقرأ مجموعُ المدين «التاريخ» ومجموعُ الدائن «البيان». وهما رقمان لا
   * يحملهما الشريط الذي تحته، فلا مقروءَ سواه.
   */
  test('صفّ الإجماليّ في الكشف بطاقةٌ بأسماء مجاميعه', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginUser(page, USERS.majed)
    await page.goto('/account/wallet')
    /*
     * الصفحة فيها أكثر من `.admin-table`، فيُقصد **الظاهر** منها.
     *
     * والمنتقي المطلق يطابق الاثنين فيخفق بـ`strict mode violation`، و
     * `document.querySelector` يأخذ أوّلهما في الـDOM لا أوّلهما على الشاشة —
     * فيقيس صفًّا من جدولٍ آخر ويقارنه ببطاقةٍ من ثالث.
     */
    const foot = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.admin-table tfoot tr')]
      const row = rows.find((candidate) => candidate.getBoundingClientRect().width > 0)!
      // البطاقة من **جدول الصفّ نفسه** فلا يُقارن عرضٌ بعرضٍ من جدولين
      const card = row.closest('table')!.querySelector('tbody tr')!
      return {
        labels: [...row.querySelectorAll('td')].map(
          (td) => getComputedStyle(td, '::before').content,
        ),
        width: row.getBoundingClientRect().width,
        cardWidth: card.getBoundingClientRect().width,
      }
    })

    // بعرض البطاقات، لا صندوقًا يشرنق نفسه
    expect(Math.abs(foot.width - foot.cardWidth), 'صفّ الإجماليّ خارج نسق البطاقات')
      .toBeLessThanOrEqual(1)
    // وعنوانه بلا اسمٍ قبله، ومجاميعه بأسمائها هي لا بأسماء الأعمدة
    expect(foot.labels[0], 'عنوان الإجماليّ سُمّي باسم عمود').toBe('none')
    expect(foot.labels.slice(1)).toEqual([
      '"إجمالي المدين"',
      '"إجمالي الدائن"',
      '"الرصيد الختامي"',
    ])
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
  test('اللوحة منقوشة حيث يُرى النقش، والمصغّرة مسطّحة', async ({ page }) => {
    const { listings } = (await (await page.request.get('/api/listings')).json()) as {
      listings: { id: string; status: string }[]
    }
    const open = listings.find((row) => row.status === 'active')!

    await page.goto(`/market/${open.id}`)
    const big = page.locator('svg[data-plate-type]').first()
    await expect(big).toBeVisible()
    expect(await big.locator('filter[id^="plate-emboss"]').count()).toBe(1)

    /*
     * والمصغّرة وحدها بلا نقش.
     *
     * الحرف على اللوحة الحقيقية مطروقٌ بارز، وبريقه من حافّته — فيُنقش حيث
     * يُرى. وفي ١٩٠ بكسلًا لا يُرى ويبقى ثمنه، فتُستثنى.
     */
    await page.goto('/market')
    const thumb = page.locator('li[data-row] svg[data-plate-type], .admin-table svg[data-plate-type]').first()
    const marketCard = page.locator('article svg[data-plate-type]').first()
    await expect(marketCard).toBeVisible()
    expect(await marketCard.locator('filter[id^="plate-emboss"]').count()).toBe(1)
    // والمصغّرة في قوائم الحساب مسطّحة
    await loginUser(page, USERS.waleed)
    await page.goto('/account/bids')
    const listThumb = page.locator('li svg[data-plate-type]').first()
    if (await listThumb.count()) {
      expect(await listThumb.locator('filter[id^="plate-emboss"]').count()).toBe(0)
    }
    void thumb
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
    const first = await stableCount(page.locator('article'))
    expect(first).toBeLessThanOrEqual(12)

    const more = page.getByRole('button', { name: 'عرض المزيد' })
    await expect(more).toBeVisible()
    await expect(page.getByText(/عُرضت \d+ من \d+/)).toBeVisible()

    const before = apiCalls
    // يُعاد النقر حتى تنمو الشبكة — الزرّ يُفصَل في الترطيب فتضيع النقرة
    await clickUntil(more, async () => (await page.locator('article').count()) > first)
    await expect
      .poll(() => page.locator('article').count())
      .toBeGreaterThan(first)
    expect(apiCalls, 'التجزئة لا تكلّف الخادم طلبًا').toBe(before)
  })

  test('تغيير الفلتر يعيد العدّ إلى أوّله', async ({ page }) => {
    await page.goto('/market')
    await page.locator('article').first().waitFor()

    /*
     * يُنتظر الزرّ ثمّ يُنتظر أثرُه — والنقر بينهما كان يقع في فجوة الترطيب.
     *
     * الصفحة تُرسَل مصيَّرةً من الخادم ثمّ تُرطَّب، فأوّلُ `article` يظهر قبل
     * أن يتعلّق السلوك بالزرّ. والنقر هناك يقع على زرٍّ يستبدله أوّلُ تصيير في
     * العميل، فيُفصَل من الشجرة في أثناء النقر: «element was detached from the
     * DOM» ثمّ مهلةٌ تنقضي. سقط اثنان من ثلاثة تشغيلات.
     *
     * و`grown` كان يُقرأ عقب النقر مباشرةً — قبل أن تُصيَّر الدفعة الجديدة —
     * فيساوي ما قبله، ويصير الفحص الأخير يقارن بعددٍ لم ينمُ: أخضرُ لا يحرس
     * شيئًا. فيُنتظر النموّ ثمّ يُقرأ.
     */
    const more = page.getByRole('button', { name: 'عرض المزيد' })
    await expect(more).toBeVisible()
    const first = await stableCount(page.locator('article'))
    await clickUntil(more, async () => (await page.locator('article').count()) > first)
    await expect.poll(() => page.locator('article').count()).toBeGreaterThan(first)
    const grown = await page.locator('article').count()

    await page.getByRole('tab', { name: 'مزاد' }).click()
    await expect(page.getByRole('tab', { name: 'مزاد' })).toHaveAttribute('aria-selected', 'true')
    // النتائج الجديدة تُفتح على أوّلها لا على آخر ما بلغه التمرير
    expect(await page.locator('article').count()).toBeLessThanOrEqual(grown)
  })
})

test('شعار اللوحة يُرسم في كل محرّك ولو خُفي أوّل تعريف له', async ({ page }) => {
  /*
   * مربّعٌ أسود خلف النخلة والسيفين — وقع مرّتين بسببين مختلفين.
   *
   * الأولى: قناعٌ مشترك بين كل اللوحات، فيقع أوّل تعريف له في صفٍّ مخفيّ
   * بـ`display:none` فلا يحلّه المتصفّح. ولكل لوحة تعريفها الآن.
   *
   * والثانية: عكسُ الصورة داخل القناع بـ`filter: invert(1)` — وهو مرشِّح
   * **CSS** على عنصر SVG، لا يطبّقه WebKit. فيبقى القناع بصورته الأصلية،
   * والأبيض فيه يعني «ظاهر»: فيُطلى المربّع كلّه ويُقتطع منه الشعار. ورُصد
   * حيًّا على iOS في كل صفحة فيها لوحة.
   *
   * فصار الرسم بأوّليّات SVG وحدها. والاختبار يحرس الشرطين معًا — ولا يكفي
   * فيه محرّك واحد يمرّ، فالعيب الثاني لا يظهر في Chromium أصلًا.
   */
  await loginAdmin(page)
  await page.goto('/admin/orders')
  const plate = page.locator('svg[data-plate-type]:visible').first()
  await expect(plate).toBeVisible()

  const audit = await plate.evaluate((svg) => {
    const emblem = svg.querySelector('image')
    return {
      // شفافيته مخبوزة في ملفّه: لا قناع ولا مرشِّح يُنتزع بهما بياضٌ عند العرض
      masked: emblem?.hasAttribute('mask') ?? false,
      filtered: emblem?.hasAttribute('filter') ?? false,
      // ولا مرشِّح CSS على أي عنصر داخل اللوحة — WebKit يتجاهله بلا خطأ
      cssFilters: [...svg.querySelectorAll('[style*="filter"]')].length,
      // وما يشير إلى تعريفٍ يجده داخل لوحته هو
      resolves: [...svg.querySelectorAll('[mask^="url(#"], [filter^="url(#"]')].every((el) => {
        const ref = el.getAttribute('mask') ?? el.getAttribute('filter')!
        return svg.querySelector(`[id="${ref.slice(5, -1)}"]`) !== null
      }),
    }
  })

  expect(audit.masked, 'قناعٌ على الشعار — سقط في WebKit مرّتين من قبل').toBe(false)
  expect(audit.filtered, 'مرشِّحٌ على الشعار — سقط في WebKit مرّتين من قبل').toBe(false)
  expect(audit.cssFilters, 'مرشِّح CSS داخل SVG — يسقط صامتًا في WebKit').toBe(0)
  expect(audit.resolves, 'إحالةٌ إلى تعريف خارج اللوحة').toBe(true)
})

/*
 * **وحروف اللوحة تُفحص في الوحدات لا هنا.**
 *
 * وصياغةٌ أولى استنسخت لوحةً في المتصفّح وبدّلت نصَّها ثمّ قاست — وحجمُ الخط
 * كان قد حُسب للحروف الأصلية فبقي كما هو. أي أنّها تقيس شيئًا آخر: جُرّبت
 * بإرجاع المتوسّط القديم **فمرّت**. والحساب نفسه هو ما يُحرَس، في
 * `tests/unit/plate-advance.test.ts`.
 */
