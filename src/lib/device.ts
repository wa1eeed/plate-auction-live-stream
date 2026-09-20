import type { DevicePlatform } from '@/lib/domain/types'

/**
 * منصّة الجهاز ونسخة التطبيق — من المتصفّح لا من الخادم.
 *
 * الخادم يقرأ `User-Agent` وهو نصٌّ يُنتحل ويُبدَّل، ولا يعرف أنّ الصفحة تعمل
 * داخل غلافٍ أصيل أصلًا. والغلاف يعلن نفسه في الصفحة، فالمصدر هنا هو الأصدق.
 */

type CapacitorBridge = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

function bridge(): CapacitorBridge | null {
  if (typeof window === 'undefined') return null
  return (window as { Capacitor?: CapacitorBridge }).Capacitor ?? null
}

/**
 * `web` ما لم يكن الغلاف حاضرًا.
 *
 * والافتراض متعمَّد: الويب هو الحال الغالب، وخطؤه في الاتّجاه الآمن — جهازٌ
 * أصيلٌ يُحسَب ويبًا يُرسَل إليه بقناة الويب فيصله الإشعار، وويبٌ يُحسَب
 * أصيلًا يُرسَل إليه بقناةٍ لا يسمعها فلا يصله شيء.
 */
export function devicePlatform(): DevicePlatform {
  const capacitor = bridge()
  if (!capacitor?.isNativePlatform?.()) return 'web'
  const platform = capacitor.getPlatform?.()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

/** هل نحن داخل غلافٍ أصيل؟ يُغيّر ما يُعرض: التثبيت والرجوع والاهتزاز. */
export function isNativeShell(): boolean {
  return devicePlatform() !== 'web'
}

/**
 * نسخة التطبيق — يحقنها الغلاف، وفي الويب نسخةُ الوِب.
 *
 * تُقرأ في الإدارة لتشخيص عطبٍ يخصّ نسخةً بعينها: «كلّ من يشكو على 1.2.0».
 */
export function appVersion(): string | null {
  if (typeof window === 'undefined') return null
  const declared = (window as { __APP_VERSION__?: string }).__APP_VERSION__
  if (typeof declared === 'string' && declared.length > 0) return declared.slice(0, 40)
  return isNativeShell() ? null : 'web'
}

/**
 * هل المنصّة مثبَّتة على الشاشة الرئيسية؟
 *
 * يهمّ على iOS وحده فعليًّا: سفاري **لا يمنح إذن الإشعارات** لصفحةٍ في
 * المتصفّح، ويمنحه لها متى فُتحت من أيقونةٍ على الشاشة الرئيسية (16.4 فأحدث).
 * فطلبُ الإذن قبل التثبيت هناك يُحرق الطلبَ بلا فائدة.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

/** سفاري على iOS — يشمل آيباد الذي يقول عن نفسه «Macintosh» */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}
