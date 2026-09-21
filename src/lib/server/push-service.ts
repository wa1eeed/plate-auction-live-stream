import webpush from 'web-push'
import { apnsConfigured, sendApns } from './apns'
import { fcmConfigured, sendFcm } from './fcm'
import { appUrl } from '@/lib/config'
import {
  TIME_SENSITIVE_NOTIFICATIONS,
  URGENT_NOTIFICATIONS,
  type Notification,
  type NotificationType,
} from '@/lib/domain/types'
import type { AuctionStore } from '@/lib/store/types'

/**
 * إشعارات الدفع — ما يبلغ صاحبه وهو خارج الصفحة.
 *
 * البثّ اللحظي يكفي من كان ناظرًا؛ وهذا لمن أغلق جهازه. ولذلك لا يُرسَل عن كلّ
 * إشعار: ما لا يستدعي تصرّفًا فورًا يُقرأ في الجرس متى فُتحت المنصّة، ودفعُه
 * إلى شاشةٍ مقفلة ضجيجٌ يُعلَّم صاحبُه أن يتجاهله — فتضيع القيمة في اللحظة
 * التي صُنعت لها.
 */

/*
 * المفاتيح من البيئة وحدها — ولا تُولَّد عند الإقلاع.
 *
 * مفتاحٌ يُولَّد في الذاكرة يتبدّل مع كلّ نشرة، فتصير كلُّ الاشتراكات المحفوظة
 * لا تُقبل: خادم الدفع يرفض ما لم يُوقَّع بالمفتاح الذي اشترك به الجهاز. فهو
 * إذن سرٌّ من أسرار النشر، يُولَّد مرّةً ويُحفظ في البيئة:
 *
 *   node -e "const w=require('web-push');const k=w.generateVAPIDKeys();console.log(k)"
 */
type Vapid = { publicKey: string; privateKey: string; subject: string }

function vapid(): Vapid | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return null

  /*
   * `subject` وسيلةُ تواصلٍ يطلبها المعيار ليبلغ صانعُ المتصفّح مشغّلَ الخدمة
   * إن أساءت. ولا يقبل المعيار إلّا `https:` أو `mailto:` — ورابطُ المنصّة
   * يفي بها في الإنتاج وحده.
   *
   * **وبلا صيغةٍ صالحة يُعدّ الدفع معطّلًا** لا يُحاوَل: التحقّق يرمي قبل أن
   * تبدأ الحلقة المحروسة، فيُبتلع الخطأ ولا يُرسَل شيء — منصّةٌ تظنّ أنّها
   * تُنبّه ولا أحد يصله شيء، وهو أسوأ ما في الباب كلّه. فيُقال «معطّل» ويُعرف.
   */
  const configured = process.env.VAPID_SUBJECT?.trim()
  const fromApp = appUrl()
  const subject =
    configured && /^(https:|mailto:)/.test(configured)
      ? configured
      : fromApp.startsWith('https:')
        ? fromApp
        : null
  if (!subject) return null

  return { publicKey, privateKey, subject }
}

/** هل الدفع مهيّأ؟ تُقرأ في الواجهة فيُقال للمستخدم إن كان الزرّ ينفع. */
export function pushConfigured(): boolean {
  return vapid() !== null
}

/** المفتاح العامّ — يحتاجه المتصفّح ليولّد اشتراكه. وهو عامّ فلا حرج. */
export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null
}

function shouldPush(type: NotificationType): boolean {
  return URGENT_NOTIFICATIONS.includes(type)
}

/**
 * ما يُرسَل: **إشارةٌ لا خبر**.
 *
 * الحمولة تمرّ بخادم صانع المتصفّح، وهي وإن كانت مشفّرة فالمبدأ عندنا واحد:
 * ما يخصّ المستخدم يُقرأ من عندنا بعد تحقّق الهويّة، لا يُودَع طرفًا ثالثًا.
 * وهو المبدأ نفسه في [أحداث السوم المختومة]: الحدث يقول «حدث شيء»، والمحتوى
 * يُجلب عبر HTTPS حيث يُطبَّق الحجب لكلّ قارئ بحسبه.
 *
 * فالعنوان والنصّ يُرسلان مقتضبين ليُعرَض شيءٌ ولو انقطع الجلب — والمتصفّح
 * **يُلزم** بعرض إشعارٍ لكلّ دفعة، فبلا نصٍّ يعرض هو «حُدِّث الموقع في
 * الخلفية»، وهي أسوأ من عبارتنا. ولا مبلغ فيهما ولا رقم لوحة.
 */
type PushBody = {
  title: string
  body: string
  href: string | null
  /** الوسم هو نوع الإشعار — يُقرأ للاستبدال **ولاشتقاق الإلحاح** */
  tag: string
}

/** أيخترق هذا النوعُ وضعَ التركيز؟ — ثلاثةٌ وحدها. */
function isTimeSensitive(tag: string): boolean {
  return (TIME_SENSITIVE_NOTIFICATIONS as readonly string[]).includes(tag)
}

async function deliver(store: AuctionStore, userId: string, payload: PushBody): Promise<void> {
  const keys = vapid()
  if (!keys) return

  /*
   * لكلّ منصّةٍ قناتها — والجهاز الذي لا قناة له يُترك ولا يُحذف.
   *
   * إرسالُ رمز APNs عبر Web Push يفشل، ويُقرأ الفشل «اشتراكًا ميّتًا» فيُحذف
   * الجهاز — فيخسر تسجيلَه لا إشعارًا واحدًا. ولذلك يُفرَز قبل الإرسال.
   */
  const all = (await store.listUserDevices(userId)).filter(
    (device) => device.notificationsEnabled,
  )
  const devices = all.filter((device) => device.platform === 'web' && device.webKeys)

  /*
   * **ثلاث قنواتٍ لا اثنتان** — ولكلّ منصّةٍ ما تفهمه.
   *
   * وiOS لا يمرّ بـFCM: إضافة Capacitor تُعيد هناك **رمز APNs خامًا** لا
   * رمزَ تسجيلٍ من FCM، فإرسالُه إليه يُردّ. وأندرويد يمرّ به لأنّ الإضافة
   * تستعمله فتُعيد رمزًا صحيحًا.
   *
   * وما لا قناةَ له يُترك **ولا يُحذف**: جهازٌ لم تُضبط قناتُه بعدُ ليس ميّتًا.
   */
  const appleDevices = apnsConfigured() ? all.filter((device) => device.platform === 'ios') : []
  const nativeDevices = fcmConfigured()
    ? all.filter((device) => device.platform === 'android')
    : []

  if (devices.length === 0 && nativeDevices.length === 0 && appleDevices.length === 0) return

  /*
   * الأيقونة تُقرأ من السجلّ لا تُكتب ثابتة — بواجهة المخزن لا بنبشِ داخله.
   * وبلا أيقونةٍ مرفوعة تُترك للعامل فيعرض المرسومة.
   */
  const brand = await store.getBrandSettings().catch(() => null)
  const icon = brand?.icon ? '/brand/icon' : null

  /*
   * عدد غير المقروء يُقرأ مرّةً لكلّ إرسال لا لكلّ جهاز.
   *
   * وهو للشارة على iOS: آبل تعرض ما يُرسَل إليها حرفيًّا ولا تحسبه، والخادم
   * وحده يعرفه. وفشلُ قراءته لا يمنع الإشعار — تُرسَل بلا شارة.
   */
  const badge =
    nativeDevices.length || appleDevices.length
      ? await store.countUnreadNotifications(userId).catch(() => 0)
      : 0

  await Promise.all(
    appleDevices.map(async (device) => {
      const result = await sendApns(device.pushToken, {
        title: payload.title,
        body: payload.body,
        href: payload.href,
        tag: payload.tag,
        badge,
        timeSensitive: isTimeSensitive(payload.tag),
      }).catch(() => 'failed' as const)
      if (result === 'gone') await store.deleteUserDevice(device.pushToken)
    }),
  )

  await Promise.all(
    nativeDevices.map(async (device) => {
      const result = await sendFcm(device.pushToken, {
        title: payload.title,
        body: payload.body,
        href: payload.href,
        tag: payload.tag,
        badge,
        /*
         * الإلحاح يُشتقّ من النوع لا يُمرَّر من المُستدعي.
         *
         * ولو مُرِّر لصار قرارًا في كلّ موضعِ إرسال، فاختلفت المواضع بمرور
         * الوقت: إشعارٌ يخترق التركيز من مسارٍ ولا يخترقه من آخر. والنوع
         * واحدٌ فحكمُه واحد.
         */
        timeSensitive: isTimeSensitive(payload.tag),
      }).catch(() => 'failed' as const)
      // الميّت وحده يُحذف — والفشل العابر يُعاد إليه في الإشعار التالي
      if (result === 'gone') await store.deleteUserDevice(device.pushToken)
    }),
  )

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: device.pushToken,
            keys: device.webKeys!,
          },
          JSON.stringify({ ...payload, icon }),
          {
            TTL: 3600,
            // مع كلّ إرسال لا في حالةٍ عامّة للعملية — فلا يعتمد على ترتيب النداء
            vapidDetails: {
              subject: keys.subject,
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
            },
          },
        )
      } catch (error) {
        /*
         * اشتراكٌ ميّت يُحذف لا يُعاد إليه.
         *
         * الجهاز يُلغي اشتراكه بمسح بيانات الموقع أو بحذف التطبيق، فيردّ خادمُ
         * الدفع 404 أو 410. وإبقاؤه يعني محاولةً فاشلة في كلّ إشعارٍ إلى
         * الأبد — ولكلّ محاولةٍ طلبُ شبكةٍ ينتظره من بعده.
         */
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await store.deleteUserDevice(device.pushToken)
        }
      }
    }),
  )
}

/**
 * يُرسل عن إشعارٍ أُنشئ — إن كان ممّا يُدفع.
 *
 * ولا يُنتظر ولا يُسقط شيئًا: الإشعار وقع في السجلّ وبُثّ لحظيًّا، وفشلُ الدفع
 * لا يُبطل ذلك ولا يُبطل العملية التي أنتجته.
 */
/**
 * يملأ متغيّرات القالب — استبدالُ نصٍّ بنصّ، لا تنفيذَ شيء.
 *
 * والمتغيّر الذي لا قيمة له يُحذف مع ما حوله من فراغٍ زائد، فلا تُقرأ في
 * الإشعار `{{plate}}` حرفيّةً ولا فجوةٌ بين كلمتين.
 */
function fillTemplate(text: string, values: Record<string, string | null>): string {
  return text
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export async function pushNotificationAsync(
  store: AuctionStore,
  notification: Notification,
): Promise<void> {
  if (!shouldPush(notification.type)) return
  if (!pushConfigured()) return

  /*
   * القالب يُقرأ من اللوحة، والإشعار احتياطُه.
   *
   * نوعٌ أطفأته الإدارة لا يُدفَع — ويبقى في الجرس يُقرأ متى فُتحت المنصّة.
   * وقالبٌ بلا نصٍّ بعد ملئه يعود إلى نصّ الإشعار نفسه: إشعارٌ بلا عنوان يجعل
   * المتصفّح يعرض «حُدِّث الموقع في الخلفية».
   */
  const settings = await store.getMobileSettings().catch(() => null)
  const template = settings?.pushTypes?.[notification.type]
  if (template && !template.enabled) return

  /*
   * وسمُ اللوحة يُقرأ من إعلانها — وهو بيانٌ علنيّ لا حرج فيه.
   *
   * وإشعارٌ بلا إعلان (عمولةٌ مستحقّة مثلًا) يملأ المتغيّر فراغًا، فيسقط من
   * النصّ بلا أثر — ولذلك لا تُبنى الجملة على وجوده.
   */
  const listing = notification.listingId
    ? await store.getListing(notification.listingId).catch(() => null)
    : null
  const plate = listing ? `${listing.arabicLetters} ${listing.plateNumbers}` : null
  const title = template ? fillTemplate(template.title, { plate }) : ''
  const body = template ? fillTemplate(template.body, { plate }) : ''

  await deliver(store, notification.userId, {
    title: title || notification.title,
    body: body || notification.body,
    href: notification.href,
    // وسمٌ لكلّ نوع: إشعارٌ ثانٍ من نوعه يحلّ محلّ الأوّل ولا يتراكم فوقه
    tag: notification.type,
  })
}

/**
 * يُرسل عن إشعارٍ أُنشئ — إن كان ممّا يُدفع.
 *
 * ولا يُنتظر ولا يُسقط شيئًا: الإشعار وقع في السجلّ وبُثّ لحظيًّا، وفشلُ الدفع
 * لا يُبطل ذلك ولا يُبطل العملية التي أنتجته.
 */
export function pushNotification(store: AuctionStore, notification: Notification): void {
  void pushNotificationAsync(store, notification).catch(() => undefined)
}
