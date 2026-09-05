import { expect, test } from '@playwright/test'

/**
 * أنواع الإصدار الثلاثة.
 *
 * محورٌ مستقلّ عن صنف المركبة: لوحةٌ خصوصية قد تصدر طويلةً أو اعتيادية أو
 * رياضية. والفرق شكليّ يُرى في نسبة اللوحة وفي ما يُطبَع عليها.
 */
test.describe('نوع إصدار اللوحة', () => {
  test('لكلٍّ نسبته، والرياضية بلا عربية', async ({ page }) => {
    await page.goto('/market')
    await expect(page.locator('svg[data-plate-type]').first()).toBeVisible()

    const shapes = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-plate-type]')].map((svg) => {
        const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number)
        return {
          ratio: Number((w / h).toFixed(2)),
          // نصوص اللوحة عدا «السعودية» في خانة الدولة
          ink: [...svg.querySelectorAll('text')]
            .map((t) => t.textContent ?? '')
            .filter((t) => t !== 'السعودية' && !['K', 'S', 'A', 'KSA'].includes(t))
            .join(''),
        }
      }),
    )
    expect(shapes.length).toBeGreaterThan(3)

    const ratios = new Set(shapes.map((s) => s.ratio))
    // ثلاثة أشكال على الأقل في السوق — الطويلة والاعتيادية والرياضية
    expect(ratios.size, `النِّسب: ${[...ratios].join(', ')}`).toBeGreaterThanOrEqual(3)

    /*
     * والرياضية لا عربية فيها أصلًا — لا رقمًا ولا حرفًا.
     *
     * وليس إخفاءً بالتنسيق: رسمُها ثمّ إخفاؤها يُبقيها في نصّ الوصول وفي بحث
     * الصفحة، فتُقرأ لوحةً ليست هي.
     */
    const sport = shapes.filter((s) => s.ratio === 3.8)
    expect(sport.length, 'لا لوحة رياضية في البذرة').toBeGreaterThan(0)
    for (const plate of sport) {
      expect(plate.ink, `عربية في لوحة رياضية: ${plate.ink}`).not.toMatch(/[؀-ۿ]/)
    }
  })

  test('لوحة النقل: خانة الدولة زرقاء', async ({ page }) => {
    await page.goto('/market')
    await expect(page.locator('svg[data-plate-type]').first()).toBeVisible()

    /*
     * الأزرق علامةُ النقل في اللوحة الحقيقية — يُعرف صنف المركبة منه قبل قراءة
     * حرف. ويقع حيث تقع الدولة: شريطًا جانبيًّا أو خانةً وسطى بحسب الإصدار.
     */
    const found = await page.evaluate(() => {
      const transport = [...document.querySelectorAll('svg[data-plate-type="transport"]')]
      const other = [...document.querySelectorAll('svg[data-plate-type="private"]')]
      const blue = (svg: Element) =>
        [...svg.querySelectorAll('rect')].some((r) => r.getAttribute('fill') === '#1d4ed8')
      return {
        transport: transport.length,
        transportBlue: transport.filter(blue).length,
        privateBlue: other.filter(blue).length,
      }
    })

    expect(found.transport, 'لا لوحة نقل في البذرة').toBeGreaterThan(0)
    expect(found.transportBlue).toBe(found.transport)
    expect(found.privateBlue, 'الأزرق على لوحة خصوصي').toBe(0)
  })

  test('الرياضية تُوسَم في البطاقة، ولا يُوسَم ما هو معتاد', async ({ page }) => {
    /*
     * هي منتجٌ مختلف: لا عربية فيها أصلًا، فيُقال ذلك قبل فتحها. والاعتيادية
     * والطويلة شكلان لما هو معتاد، فوسمُهما يُثقل البطاقة بما لا يُقرَّر به.
     */
    await page.goto('/market')
    await expect(page.locator('article').first()).toBeVisible()

    const sportCards = page.locator('article', { hasText: 'لوحة رياضية' })
    expect(await sportCards.count(), 'لا لوحة رياضية موسومة').toBeGreaterThan(0)

    // وبطاقة الرياضية هي التي تحمل لوحةً بلا عربية
    const hasArabic = await sportCards.first().locator('svg[data-plate-type]').evaluate((svg) =>
      [...svg.querySelectorAll('text')]
        .map((t) => t.textContent ?? '')
        .filter((t) => t !== 'السعودية' && t !== 'KSA')
        .some((t) => /[؀-ۿ]/.test(t)),
    )
    expect(hasArabic, 'عربية في لوحةٍ موسومة رياضية').toBe(false)

    await expect(page.getByText('لوحة اعتيادية')).toHaveCount(0)
    await expect(page.getByText('لوحة طويلة')).toHaveCount(0)
  })

  /*
   * شعارٌ واحد في اللوحة لا شعاران.
   *
   * حيث تشغل كتلةُ الدولة الوسط — الرياضية والاعتيادية والطويلة للنقل — لا
   * موضع لشعارٍ أوسطَ ثانٍ. وحجمُه غيرُ الصفر كان يرسمه فوقها، فيجتمع في
   * موضعٍ واحد شعاران ويتكرّر السيفان والنخلة إن كان هو المختار. رُصد حيًّا.
   */
  test('لا يتكرّر الشعار حيث تشغل الدولة الوسط', async ({ page }) => {
    await page.goto('/market')
    await expect(page.locator('svg[data-plate-type]').first()).toBeVisible()

    const doubled = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-plate-type]')]
        .map((svg) => ({
          box: svg.getAttribute('viewBox'),
          // الشعار الأوسط موسومٌ، وشعار كتلة الدولة غيرُ موسوم
          centre: svg.querySelectorAll('[data-plate-emblem="center"]').length,
          hasCountryCell: svg.querySelectorAll('rect[rx="10"], rect[rx="8"]').length > 0,
        }))
        .filter((plate) => plate.hasCountryCell && plate.centre > 0),
    )

    expect(doubled, `شعاران في: ${doubled.map((d) => d.box).join(' · ')}`).toHaveLength(0)
  })

  test('الرياضية: الحروف والأرقام في وسط اللوحة لا في أسفلها', async ({ page }) => {
    await page.goto('/market')
    await expect(page.locator('svg[data-plate-type]').first()).toBeVisible()

    /*
     * الصفّ الوحيد يُوسَّط، ولا تكفي شهادةُ `layoutRow` وحدها.
     *
     * فالحساب صحيحٌ في اختبار الوحدة وقد يبقى الوصل مقطوعًا: تكفي هندسةٌ
     * جديدة تنسى `singleRow` حتى يعود الحبر إلى أسفل شريطه ويتجمّع الفائض
     * فوقه هامشًا — وهو العيب الذي رآه الناظر قبل أن يراه أي اختبار.
     */
    const plates = await page.evaluate(() =>
      [...document.querySelectorAll('svg[data-plate-type]')]
        .map((svg) => {
          const [, , w, h] = svg.getAttribute('viewBox')!.split(' ').map(Number)
          const glyphs = [...svg.querySelectorAll('text')].filter((t) => {
            const text = t.textContent ?? ''
            return text !== 'السعودية' && !['K', 'S', 'A', 'KSA'].includes(text)
          })
          const ink = glyphs.map((g) => g.textContent).join(' ')
          // الرياضية وحدها صفٌّ واحد: لا عربية فيها، وصفّان لا يُوسَّطان معًا
          if (!glyphs.length || /[؀-ۿ]/.test(ink)) return null
          const boxes = glyphs.map((g) => (g as SVGGraphicsElement).getBBox())
          const top = Math.min(...boxes.map((b) => b.y))
          const bottom = Math.max(...boxes.map((b) => b.y + b.height))
          return { height: h, drift: (top + bottom) / 2 - h / 2, ink }
        })
        .filter(Boolean),
    )

    expect(plates.length, 'لا لوحة رياضية في البذرة').toBeGreaterThan(0)
    for (const plate of plates!) {
      /*
       * الحدّ ٥٪ لا صفر: `getBBox` يقيس صندوق الخطّ لا حدّ الحبر، فيضمّ نزولًا
       * لا تشغله الأرقام والحروف الكبيرة ويميل به قليلًا إلى أسفل. وحين كان
       * الحبر عالقًا في أسفل شريطه تجاوز الميل ٨٪.
       */
      expect(
        Math.abs(plate!.drift),
        `«${plate!.ink}» منزاحة ${plate!.drift.toFixed(1)} عن وسط اللوحة`,
      ).toBeLessThanOrEqual(plate!.height * 0.05)
    }
  })
})
