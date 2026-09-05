import { AdminHeader } from '@/components/admin/admin-ui'
import { PaymentSettingsForm } from '@/components/admin/payment-settings-form'
import { AuctionSettingsForm } from '@/components/admin/auction-settings-form'
import { CommissionSettingsForm } from '@/components/admin/commission-settings-form'
import { TaxSettingsForm } from '@/components/admin/tax-settings-form'
import { BrandSettingsForm } from '@/components/admin/brand-settings-form'
import { SeoSettingsForm } from '@/components/admin/seo-settings-form'
import { SettingsTabs } from '@/components/admin/settings-tabs'
import { getPaymentSettings, tapConfiguration } from '@/lib/server/payment-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الإعدادات' }

/**
 * الإعدادات مُقسَّمة بالمجال لا مصفوفةً في صفّ.
 *
 * كانت أربعة تابات متجاورة متساوية الوزن، ثمّ صارت ستّة — وستّة في صفٍّ تُقرأ
 * بالبحث. والمجالات هنا ثلاثة يعرفها من يشغّل المنصّة: **ما تبدو به**،
 * و**كيف تعمل**، و**ما يُفوتَر به**. ولكلٍّ وصفٌ يقول ما فيه قبل فتحه.
 */
const GROUPS = [
  {
    title: 'الهويّة والظهور',
    hint: 'ما يراه الزائر أوّلًا، وما تقرؤه محرّكات البحث عن المنصّة.',
    tabs: [
      { key: 'brand', label: 'الهويّة', hint: 'الاسم واللون والشعار ونصّ الواجهة' },
      { key: 'seo', label: 'الأرشفة', hint: 'نتيجة البحث والبيانات المنظَّمة والموضع' },
    ],
  },
  {
    title: 'قواعد التداول',
    hint: 'ما يحكم المزاد والعربون وما تستحقّه المنصّة.',
    tabs: [
      { key: 'auction', label: 'قواعد المزاد', hint: 'المهل والعربون والتمديد' },
      { key: 'commission', label: 'العمولة والضريبة', hint: 'ما تقتطعه المنصّة' },
    ],
  },
  {
    title: 'المال والامتثال',
    hint: 'كيف يدخل المال وكيف يُقرّ للهيئة.',
    tabs: [
      { key: 'payments', label: 'بوابات الدفع', hint: 'Tap والحوالة البنكية' },
      { key: 'tax', label: 'الفوترة الضريبية', hint: 'بيانات المنشأة والرقم الضريبي' },
    ],
  },
]

export default async function AdminSettingsPage() {
  await requireAdminId()
  const store = getStore()
  const [payment, auction, commission, tax, brand] = await Promise.all([
    getPaymentSettings(),
    store.getAuctionSettings(),
    store.getCommissionSettings(),
    store.getTaxSettings(),
    store.getBrandSettings(),
  ])

  return (
    <>
      <AdminHeader
        title="الإعدادات"
        description="هويّة المنصّة وأرشفتها، وقواعد المزاد والعمولة، وبوابات الدفع والفوترة الضريبية."
      />

      <SettingsTabs groups={GROUPS}>
        {{
          brand: <BrandSettingsForm settings={brand} />,
          seo: <SeoSettingsForm settings={brand} />,
          auction: <AuctionSettingsForm settings={auction} />,
          commission: <CommissionSettingsForm settings={commission} />,
          payments: <PaymentSettingsForm settings={payment} tap={tapConfiguration()} />,
          tax: <TaxSettingsForm settings={tax} />,
        }}
      </SettingsTabs>
    </>
  )
}
