/**
 * **النبرةُ لكلّ إشعارٍ جديد مرّةً — لا لكلّ فتحةِ صفحة.**
 *
 * وكان الحارسُ عدّادًا في الذاكرة: `previousUnread` يبدأ صفرًا مع كلّ تركيب،
 * فأوّلُ مزامنةٍ بعد أيّ تحميلٍ ترى «غيرُ المقروء أكبرُ من صفر» فتُنبّه. فمن
 * عنده إشعارٌ واحدٌ لم يقرأه يسمع النبرةَ في كلّ صفحةٍ يدخلها وكلّ مرّةٍ
 * يُحدّث فيها — وهو خبرٌ واحدٌ يُعاد عليه عشرًا.
 *
 * **والعدَدُ ليس خبرًا أصلًا.** يرتفع بالوارد وينخفض بالقراءة، فيرتفع ثانيةً
 * بما قُرئ على جهازٍ آخر. والخبرُ هو **أحدثُ إشعارٍ بعينه**: إن تبدّل فثمّ
 * جديد، وإن ثبت فلا شيء مهما تقلّب العدّاد.
 *
 * **ويُحفظ في المتصفّح لا في الذاكرة**، وإلّا عاد العطبُ مع كلّ تحميل.
 */

export type ChimeMark = { id: string; at: string }

/** أحدثُ ما في القائمة — وما يُقاس عليه. */
export type LatestNotification = { id: string; createdAt: string }

/**
 * هل يُنبَّه؟
 *
 * و`mark === null` تعني «لم تُزامَن هذه الصفحةُ قطّ في هذا المتصفّح» —
 * فتُسجَّل العلامةُ ولا يُنبَّه: من فتح المنصّة لأوّل مرّة لا يُستقبل بنبرةٍ
 * عن إشعارٍ وصله أمس.
 *
 * و`at: ''` في العلامة تعني «زُومن ولا إشعارَ حينها» — وأيُّ تاريخٍ بعده،
 * فأوّلُ وارد يُنبَّه به.
 */
export function shouldChime(latest: LatestNotification | undefined, mark: ChimeMark | null): boolean {
  if (!latest) return false
  if (mark === null) return false
  /*
   * **والشرطان معًا: معرّفٌ مختلفٌ وتاريخٌ ليس أقدم.**
   *
   * فالمعرّفُ وحده لا يكفي: حذفُ أحدثِ إشعارٍ يجعل الذي يليه «أحدثَ
   * القائمة» ومعرّفُه مختلف — فيُنبَّه على قديمٍ قُرئ من زمن.
   *
   * والتاريخُ وحده لا يكفي: إشعاران في المللي ثانية نفسِها — ويقع، فـ
   * `notifyMany` تكتب دفعةً واحدة — فيصير `>` كاذبًا على وارِدٍ حقيقيّ
   * فيُبتلع خبرُه. ولذلك `>=`، ويحرسها المعرّفُ من أن تُعيد ما أُعيد.
   */
  if (latest.id === mark.id) return false
  return latest.createdAt >= mark.at
}

/** ما يُسجَّل بعد كلّ مزامنةٍ ناجحة — وبلا إشعاراتٍ تُسجَّل علامةٌ فارغة. */
export function markOf(latest: LatestNotification | undefined): ChimeMark {
  return latest ? { id: latest.id, at: latest.createdAt } : { id: '', at: '' }
}

/*
 * ولكلّ حسابٍ علامتُه: جهازٌ يتناوب عليه اثنان لا يبتلع أحدُهما نبرةَ الآخر.
 */
const key = (userId: string) => `pa_chime_${userId}`

/**
 * والقراءةُ والكتابةُ في `try`: التخزينُ يرمي في نافذةٍ خاصّة أو بمنعِ
 * بيانات الموقع. وتعذُّرُه يعني نبرةً تتكرّر — لا صفحةً تسقط.
 */
export function readMark(userId: string): ChimeMark | null {
  try {
    const raw = window.localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ChimeMark>
    if (typeof parsed?.id !== 'string' || typeof parsed?.at !== 'string') return null
    return { id: parsed.id, at: parsed.at }
  } catch {
    return null
  }
}

export function writeMark(userId: string, mark: ChimeMark): void {
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(mark))
  } catch {
    /* لا تخزينَ متاح — تُحتمل نبرةٌ تتكرّر ولا تُسقط الصفحة */
  }
}
