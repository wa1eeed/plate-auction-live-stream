import webpush from 'web-push'
import { appUrl } from '@/lib/config'
import { URGENT_NOTIFICATIONS, type Notification, type NotificationType } from '@/lib/domain/types'
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
type PushBody = { title: string; body: string; href: string | null; tag: string }

async function deliver(store: AuctionStore, userId: string, payload: PushBody): Promise<void> {
  const keys = vapid()
  if (!keys) return

  const subscriptions = await store.listPushSubscriptions(userId)
  if (subscriptions.length === 0) return

  /*
   * الأيقونة تُقرأ من السجلّ لا تُكتب ثابتة — بواجهة المخزن لا بنبشِ داخله.
   * وبلا أيقونةٍ مرفوعة تُترك للعامل فيعرض المرسومة.
   */
  const brand = await store.getBrandSettings().catch(() => null)
  const icon = brand?.icon ? '/brand/icon' : null

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
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
          await store.deletePushSubscription(subscription.endpoint)
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
export function pushNotification(store: AuctionStore, notification: Notification): void {
  if (!shouldPush(notification.type)) return
  if (!pushConfigured()) return

  void deliver(store, notification.userId, {
    title: notification.title,
    body: notification.body,
    href: notification.href,
    // وسمٌ لكلّ نوع: إشعارٌ ثانٍ من نوعه يحلّ محلّ الأوّل ولا يتراكم فوقه
    tag: notification.type,
  }).catch(() => undefined)
}
