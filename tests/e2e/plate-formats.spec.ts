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
})
