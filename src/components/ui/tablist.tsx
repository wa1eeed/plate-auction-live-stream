'use client'

import { useCallback, useRef } from 'react'

/**
 * تنقّل شريط التابات بلوحة المفاتيح.
 *
 * `role="tab"` عقدٌ لا وسم: من يعلنه يَعِد بأسهم تنقل بين التابات، وبتبويبةٍ
 * واحدة تدخل الشريط وتخرج منه (roving tabindex) — لا بثمانِ تبويبات تمرّ على
 * كل تاب. وشريطنا كان يعلن الدور ولا يفي به، فيقف مستعمل لوحة المفاتيح على
 * تابات لا تستجيب لسهم.
 *
 * وتُستعمل مع الأزرار كما هي: تُلصَق على الحاوية، وتقرأ أبناءها بـ`role=tab`.
 */
export function useTablistKeys() {
  const ref = useRef<HTMLDivElement>(null)

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End']
    if (!keys.includes(event.key)) return

    const tabs = Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])') ?? [],
    )
    if (tabs.length === 0) return

    const current = tabs.findIndex((tab) => tab === document.activeElement)
    /*
     * الاتجاه منطقيّ لا فيزيائي: في RTL السهم الأيسر يمضي إلى التالي.
     * وقراءته من `dir` المحسوب لا من افتراضٍ في الكود.
     */
    const rtl = getComputedStyle(ref.current!).direction === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'

    let next: number
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else {
      const step = event.key === forward ? 1 : -1
      const from = current === -1 ? 0 : current
      next = (from + step + tabs.length) % tabs.length
    }

    event.preventDefault()
    tabs[next].focus()
    tabs[next].click()
  }, [])

  return { ref, onKeyDown }
}

/** `tabIndex` المتجوّل: المفتوح وحده في ترتيب التبويب. */
export function tabIndexOf(selected: boolean): 0 | -1 {
  return selected ? 0 : -1
}
