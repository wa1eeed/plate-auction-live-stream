import { AdminHeader } from '@/components/admin/admin-ui'
import { BroadcastForm } from '@/components/admin/broadcast-form'
import { MobileSettingsForm } from '@/components/admin/mobile-settings-form'
import { OnboardingSettingsForm } from '@/components/admin/onboarding-settings-form'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { apnsConfigured } from '@/lib/server/apns'
import { fcmConfigured } from '@/lib/server/fcm'
import { pushConfigured } from '@/lib/server/push-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'إعدادات التطبيق' }

/**
 * **مجالان: ما يراه صاحبُ الجهاز، وما يصله.**
 *
 * وكانت مقدّمةُ التطبيق في «الإعدادات ← الهويّة والظهور» — وليست من الهويّة
 * في شيء: الهويّةُ ما يراه الزائرُ في المتصفّح، وهذه أوّلُ ما يراه من فتح
 * التطبيق. فانتقلت إلى موضعها، وصارت الصفحةُ تابزًا كصفحة الإعدادات: ثلاثةُ
 * نماذجَ في صفحةٍ واحدة تُمرَّر لا تُقرأ.
 *
 * ولكلّ تابٍ مسارُ حفظٍ مستقلّ — فلا يُكسر نموذجٌ ليُقسَّم، ولا يُحفظ ما لم
 * يُغيَّر.
 */
const GROUPS = [
  {
    title: 'أوّلُ ما يُرى',
    hint: 'ما يستقبل به التطبيقُ من فتحه أوّل مرّة.',
    tabs: [
      {
        key: 'onboarding',
        label: 'مقدّمة التطبيق',
        hint: 'شاشة الهويّة وشرائح التعريف',
      },
    ],
  },
  {
    title: 'ما يصل الأجهزة',
    hint: 'الإشعاراتُ ونصوصُها، والأجهزةُ المسجَّلة، ورسالةٌ تُبثّ للجميع.',
    tabs: [
      { key: 'push', label: 'الإشعارات والأجهزة', hint: 'القوالب والنسخ والصوت' },
      { key: 'broadcast', label: 'بثٌّ إداريّ', hint: 'رسالةٌ إلى كلّ الأجهزة' },
    ],
  },
]

export default async function AdminMobilePage() {
  await requireAdminId()
  const store = getStore()
  const [settings, devices, onboarding] = await Promise.all([
    store.getMobileSettings(),
    store.countDevicesByPlatform(),
    store.getOnboardingSettings(),
  ])

  return (
    <>
      <AdminHeader
        title="إعدادات التطبيق"
        description="ما يستقبل به التطبيقُ مستخدمَه، وما يُدفَع إلى جهازه ونصُّه، والأجهزة المسجَّلة."
      />

      <SettingsTabs groups={GROUPS}>
        {{
          onboarding: <OnboardingSettingsForm settings={onboarding} />,
          push: (
            <MobileSettingsForm
              settings={settings}
              devices={devices}
              webPushReady={pushConfigured()}
              nativePushReady={fcmConfigured()}
              applePushReady={apnsConfigured()}
            />
          ),
          broadcast: <BroadcastForm />,
        }}
      </SettingsTabs>
    </>
  )
}
