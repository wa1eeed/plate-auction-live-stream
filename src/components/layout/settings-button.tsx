'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { isNativeShell } from '@/lib/device'

/**
 * بابُ الإعدادات — **للغلاف الأصيل وحده**.
 *
 * ويحلّ محلّ قائمة العضوية هناك: تلك تحمل الرصيد وروابط الحساب، وكلاهما
 * مكرَّرٌ في التطبيق — الرصيد في المحفظة، والحساب في «ملفّي» بالملاحة
 * السفلية. والإعدادات لا باب لها غيرُه بعد أن أُخفي التذييل والدُرج.
 *
 * ولا يُرسم في الويب: القائمة هناك على حالها.
 */
export function SettingsButton() {
  /* بعد الترطيب: المخرَج مشتركٌ بين الويب والتطبيق */
  const [native, setNative] = useState(false)
  useEffect(() => setNative(isNativeShell()), [])

  if (!native) return null

  return (
    <Link
      href="/account/settings"
      aria-label="الإعدادات"
      className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-ink-600 bg-ink-800 text-muted transition-colors hover:border-ink-500 hover:text-paper"
    >
      <Settings className="size-4" />
    </Link>
  )
}
