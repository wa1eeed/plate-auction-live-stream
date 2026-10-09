/**
 * **من سبّب البيع لا يُخبَر به.**
 *
 * فالشراء المباشر يبثّ `listing_sold` إلى كلّ من يتابع اللوحة — والمشتري
 * منهم. فيضغط «اشترِ» فيُنقل إلى صفحة السداد، وتلحقه نافذةٌ تقول إنّ اللوحة
 * بِيعت — وهو يعلم، ولم يسدّد بعد. والتنبيهاتُ تبقى عبر تغيّر المسار، فتستقرّ
 * فوق صفحة السداد نفسِها. وقد وقع ذلك على شاشة مستخدم.
 *
 * وهو خبرٌ لمن يشاهد لا لمن فعل.
 *
 * **وفي وحدةٍ بلا React**: القرار هنا قاعدةٌ تُفحص بمدخلٍ ومخرج، لا سلوكٌ
 * يُلاحَق في متصفّح. وفحصُه في المتصفّح وحده سباقٌ لا يُضبط: على الحلقة
 * المحلّية يصل الحدثُ بعد أن غادر المشتري الصفحة، فيمرّ الفحصُ وإن رُفع
 * الكتمُ كلُّه — وقد جُرّب فمرّ.
 */

const selfCaused = new Map<string, number>()

/**
 * نافذةٌ تحرس من تسرّب العلامة.
 *
 * فطلبٌ ينجح في الخادم ثمّ يسقط اتّصالُه — أو حدثٌ لا يصل — يترك علامةً
 * باقية. ولولا المهلةُ لكتمت إعلانًا **حقيقيًّا** عن بيعٍ لاحقٍ لغير صاحبها.
 */
export const SELF_WINDOW_MS = 20_000

/** يُعلّم أنّ هذا التبويب هو سببُ البيع الذي سيُبثّ بعد لحظة. */
export function muteNextSoldToast(listingId: string, nowMs: number = Date.now()): void {
  selfCaused.set(listingId, nowMs)
}

/** هل يُعلَن البيعُ في هذا التبويب؟ تُستهلك العلامةُ بالسؤال فلا تكتم مرّتين. */
export function shouldAnnounceSold(listingId: string, nowMs: number = Date.now()): boolean {
  const at = selfCaused.get(listingId)
  if (at === undefined) return true
  selfCaused.delete(listingId)
  return nowMs - at >= SELF_WINDOW_MS
}

/** للفحص وحده — تُنسى العلامات فلا يتسرّب فحصٌ إلى فحص. */
export function resetSoldAnnouncementsForTests(): void {
  selfCaused.clear()
}
