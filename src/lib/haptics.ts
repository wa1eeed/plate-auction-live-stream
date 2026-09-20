import { isNativeShell } from '@/lib/device'

/**
 * الاهتزاز — تأكيدٌ يُحسّ لا يُسمع.
 *
 * المزايدة تقع على شاشةٍ صغيرة بإبهامٍ يغطّي الزرّ، وقد يكون الصوت مُطفأً أو
 * المكان لا يحتمله. فنبضةٌ قصيرة تقول «وقع» أو «لم يقع» بلا نظرٍ ولا سمع.
 *
 * **ولا يُستعمل إلّا حيث يقع فعلٌ ذو أثر.** اهتزازٌ مع كلّ لمسة يُعلَّم صاحبُه
 * أن يتجاهله، فيضيع في اللحظة التي صُنع لها — وهي القاعدة نفسها في التكّة
 * الصوتية: العشر الأخيرة لا الدقيقة كاملة.
 */

export type HapticKind = 'success' | 'warning' | 'error'

/*
 * أنماطٌ بالمللي ثانية: نبضةٌ واحدة للنجاح، ونبضتان للتحذير، وثلاثٌ للخطأ.
 * والتصاعد مقصود — يُفرَّق بينها بالإحساس وحده بلا أن يُنظر إلى الشاشة.
 */
const PATTERN: Record<HapticKind, number | number[]> = {
  success: 18,
  warning: [14, 60, 14],
  error: [22, 55, 22, 55, 22],
}

type HapticsBridge = {
  impact?: (options: { style: string }) => Promise<void>
  notification?: (options: { type: string }) => Promise<void>
}

/** أسلوب الغلاف الأصيل — أدقّ من الاهتزاز الخام وأقرب إلى إحساس النظام. */
const NATIVE_STYLE: Record<HapticKind, string> = {
  success: 'SUCCESS',
  warning: 'WARNING',
  error: 'ERROR',
}

function nativeHaptics(): HapticsBridge | null {
  if (typeof window === 'undefined') return null
  const plugins = (window as { Capacitor?: { Plugins?: { Haptics?: HapticsBridge } } }).Capacitor
    ?.Plugins
  return plugins?.Haptics ?? null
}

/**
 * ينبض نبضةً من نوعٍ معلوم.
 *
 * ولا يرمي شيئًا البتّة: الاهتزاز زينةُ تأكيدٍ لا شرطَ صحّة، فمنصّةٌ تُسقط
 * مزايدةً لأنّ الهاتف لم يهتزّ عبثٌ محض. ويصمت حيث لا يُدعم — وهو حال سفاري
 * على iOS في الويب، ولذلك يُقدَّم جسرُ الغلاف عليه.
 */
export function haptic(kind: HapticKind): void {
  try {
    if (isNativeShell()) {
      const bridge = nativeHaptics()
      if (bridge?.notification) {
        void bridge.notification({ type: NATIVE_STYLE[kind] }).catch(() => undefined)
        return
      }
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERN[kind])
    }
  } catch {
    // لا شيء يُقال: تأكيدٌ لم يقع، والعملية نفسها وقعت
  }
}
