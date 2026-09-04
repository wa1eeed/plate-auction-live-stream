/**
 * الإشعارات: إنشاؤها ودفعها لحظيًا وقراءتها.
 *
 * الإشعار هنا ليس سجلًّا للأحداث بل **دعوة للتصرّف**: لكل نوع وجهةٌ يذهب إليها
 * المستخدم بالضغط. إشعار بلا وجهة يُخبر ولا يُمكّن.
 */
import type {
  Notification,
  NotificationSummary,
  NotificationType,
} from '@/lib/domain/types'
import { getStore } from '@/lib/store'
import type { AuctionStore } from '@/lib/store/types'
import { publishRealtime, userTopic } from './realtime'

export type NotifyInput = {
  userId: string
  type: NotificationType
  title: string
  body: string
  href?: string | null
  listingId?: string | null
}

/**
 * ينشئ إشعارًا ويدفعه لحظيًا إلى صاحبه.
 *
 * لا يرمي أبدًا: فشل الإشعار يجب ألّا يُسقط المزايدة التي أنشأته. الإشعار
 * تحسينٌ للتجربة، والعملية المالية أهمّ منه.
 */
export async function notify(store: AuctionStore, input: NotifyInput): Promise<void> {
  try {
    const notification = await store.createNotification({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      listingId: input.listingId ?? null,
    })
    publishRealtime([userTopic(input.userId)], 'notification', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      href: notification.href,
    })
  } catch {
    // لا نُسقط العملية الأصلية من أجل إشعار
  }
}

/** إشعار جماعي — لكل مستخدم في القائمة، بلا تكرار. */
export async function notifyMany(
  store: AuctionStore,
  userIds: string[],
  build: (userId: string) => Omit<NotifyInput, 'userId'>,
): Promise<void> {
  for (const userId of new Set(userIds)) {
    await notify(store, { userId, ...build(userId) })
  }
}

export async function getNotifications(userId: string, limit = 30): Promise<NotificationSummary> {
  const store = getStore()
  const [items, unread] = await Promise.all([
    store.listNotifications(userId, limit),
    store.countUnreadNotifications(userId),
  ])
  return { items, unread }
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  return getStore().markNotificationsRead(userId, ids)
}

export type { Notification }
