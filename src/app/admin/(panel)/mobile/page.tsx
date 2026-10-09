import { AdminHeader } from '@/components/admin/admin-ui'
import { AppIconForm } from '@/components/admin/app-icon-form'
import { AppReleasesPanel } from '@/components/admin/app-releases-panel'
import { BroadcastForm } from '@/components/admin/broadcast-form'
import { MobileSettingsForm } from '@/components/admin/mobile-settings-form'
import { OnboardingSettingsForm } from '@/components/admin/onboarding-settings-form'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { apnsConfigured } from '@/lib/server/apns'
import { buildReleaseViews, fetchAppStoreRelease } from '@/lib/server/app-release-service'
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
    title: 'هويّةُ التطبيق وأوّلُ ما يُرى',
    hint: 'أيقونتُه وشاشةُ إقلاعه، وما يستقبل به من فتحه أوّل مرّة — وتسري على المنصّتين معًا.',
    tabs: [
      {
        key: 'icon',
        label: 'الأيقونة وشاشة الإقلاع',
        hint: 'تُخبز في حزمتَي iOS وأندرويد',
      },
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
  {
    title: 'حالةُ النشر',
    hint: 'ما وصل المتجرين فعلًا — فيُعرف هل يلزم بناءٌ جديد قبل أن يُطلب.',
    tabs: [{ key: 'releases', label: 'الإصدارات', hint: 'المنشورُ والمختبَر في المتجرين' }],
  },
]

export default async function AdminMobilePage() {
  await requireAdminId()
  const store = getStore()
  /*
   * **وسؤالُ متجرِ أبل يمضي مع قراءات القاعدة لا بعدها.**
   *
   * فأربعُ ثوانٍ من مهلته تُضاف إلى زمن الصفحة لو تسلسلت، وهي تمضي في
   * ظلِّها لو توازت. ولا يُسقط فشلُه الصفحةَ: الخدمةُ تردّ `ok: false`
   * ويقول العرضُ إنّه تعذّر.
   */
  const [settings, devices, onboarding, brand, releases, appStore] = await Promise.all([
    store.getMobileSettings(),
    store.countDevicesByPlatform(),
    store.getOnboardingSettings(),
    store.getBrandSettings(),
    store.getAppReleases(),
    fetchAppStoreRelease(),
  ])

  return (
    <>
      <AdminHeader
        title="إعدادات التطبيق"
        description="إعداداتٌ موحَّدةٌ لتطبيق iOS وأندرويد معًا: ما يستقبل به مستخدمَه، وأيقونتُه وشاشةُ إقلاعه، وما يُدفَع إلى جهازه."
      />

      <SettingsTabs groups={GROUPS}>
        {{
          icon: <AppIconForm asset={brand.appIcon} />,
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
          releases: <AppReleasesPanel views={buildReleaseViews(releases, appStore)} />,
        }}
      </SettingsTabs>
    </>
  )
}
