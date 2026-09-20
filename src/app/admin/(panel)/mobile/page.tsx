import { AdminHeader } from '@/components/admin/admin-ui'
import { BroadcastForm } from '@/components/admin/broadcast-form'
import { MobileSettingsForm } from '@/components/admin/mobile-settings-form'
import { fcmConfigured } from '@/lib/server/fcm'
import { pushConfigured } from '@/lib/server/push-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'التطبيق' }

export default async function AdminMobilePage() {
  await requireAdminId()
  const store = getStore()
  const [settings, devices] = await Promise.all([
    store.getMobileSettings(),
    store.countDevicesByPlatform(),
  ])

  return (
    <>
      <AdminHeader
        title="التطبيق"
        description="ما يُدفَع إلى أجهزة المستخدمين ونصُّه، والأجهزة المسجَّلة، ونسخ التطبيق."
      />
      <MobileSettingsForm
        settings={settings}
        devices={devices}
        /*
         * حالُ التهيئة تُقرأ على الخادم: المفاتيح سرٌّ من أسرار النشر لا
         * تُقرأ في المتصفّح، وما يُعرض هو «مهيّأ أو لا» وحده.
         *
         * وقناتان لا واحدة: الويب بمفاتيح VAPID، والأصيل بحساب خدمة FCM —
         * فقد تعمل إحداهما وتسكت الأخرى، ولا يُقال «الدفع معطّل» عنهما معًا.
         */
        webPushReady={pushConfigured()}
        nativePushReady={fcmConfigured()}
      />
      <div className="mt-6">
        <BroadcastForm />
      </div>
    </>
  )
}
