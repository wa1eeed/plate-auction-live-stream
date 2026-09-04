import { AdminHeader } from '@/components/admin/admin-ui'
import { PaymentSettingsForm } from '@/components/admin/payment-settings-form'
import { AuctionSettingsForm } from '@/components/admin/auction-settings-form'
import { CommissionSettingsForm } from '@/components/admin/commission-settings-form'
import { TaxSettingsForm } from '@/components/admin/tax-settings-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPaymentSettings, tapConfiguration } from '@/lib/server/payment-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الإعدادات' }

export default async function AdminSettingsPage() {
  await requireAdminId()
  const [payment, auction, commission, tax] = await Promise.all([
    getPaymentSettings(),
    getStore().getAuctionSettings(),
    getStore().getCommissionSettings(),
    getStore().getTaxSettings(),
  ])

  return (
    <>
      <AdminHeader
        title="الإعدادات"
        description="قواعد المزاد الموحّدة، وعمولة المنصّة وضريبتها، وبوابات الدفع، وبيانات المنشأة الضريبية."
      />

      <Tabs defaultValue="auction">
        <TabsList className="mb-5">
          <TabsTrigger value="auction">قواعد المزاد</TabsTrigger>
          <TabsTrigger value="commission">العمولة والضريبة</TabsTrigger>
          <TabsTrigger value="payments">الدفع</TabsTrigger>
          <TabsTrigger value="tax">الفوترة الضريبية</TabsTrigger>
        </TabsList>

        <TabsContent value="auction">
          <AuctionSettingsForm settings={auction} />
        </TabsContent>

        <TabsContent value="commission">
          <CommissionSettingsForm settings={commission} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentSettingsForm settings={payment} tap={tapConfiguration()} />
        </TabsContent>

        <TabsContent value="tax">
          <TaxSettingsForm settings={tax} />
        </TabsContent>
      </Tabs>
    </>
  )
}
