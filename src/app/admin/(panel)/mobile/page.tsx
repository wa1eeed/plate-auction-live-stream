import { AdminHeader } from '@/components/admin/admin-ui'
import { BroadcastForm } from '@/components/admin/broadcast-form'
import { MobileSettingsForm } from '@/components/admin/mobile-settings-form'
import { apnsConfigured } from '@/lib/server/apns'
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
         * و**ثلاثُ قنوات لا واحدة**: الويب بمفاتيح VAPID، وأندرويد بحساب
         * خدمة FCM، وiOS بمفتاح APNs مباشرةً. فقد تعمل واحدةٌ وتسكت أختُها،
         * ولا يُقال «الدفع معطّل» عنها جميعًا — فيُبحث في الخطأ حيث لا خطأ.
         */
        webPushReady={pushConfigured()}
        nativePushReady={fcmConfigured()}
        applePushReady={apnsConfigured()}
      />
      <div className="mt-6">
        <BroadcastForm />
      </div>
    </>
  )
}
