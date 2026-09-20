'use client'

import { useEffect } from 'react'

/**
 * تسجيل عامل الخدمة — شرطُ أن تُثبَّت المنصّة تطبيقًا.
 *
 * ويقع **بعد اكتمال التحميل** لا في أثنائه: التسجيل يفتح طلبًا وتنزيلًا
 * يزاحمان أوّل رسمٍ للصفحة، والفائدة منه لا تبدأ إلّا في الزيارة التالية —
 * فتأخيرُه لا يكلّف شيئًا وتقديمُه يكلّف ثوانيَ في أوّل ما يُرى.
 *
 * وفشلُه يُبتلع: المتصفّح قد يمنعه (نافذة خاصّة، أو إعداد يمنع التخزين)،
 * وليس في ذلك ما يُقال للزائر — الموقع يعمل بلا تطبيق.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // يُستثنى من المجموعة الشاملة — القياس والسبب في `playwright.config.ts`
    if (process.env.NEXT_PUBLIC_DISABLE_SW === '1') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
