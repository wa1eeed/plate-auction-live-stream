import { AdminHeader } from '@/components/admin/admin-ui'
import { PagesSettingsForm } from '@/components/admin/pages-settings-form'
import { requireAdminId } from '@/lib/server/require-admin'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'صفحات المنصّة' }

export default async function AdminPagesPage() {
  await requireAdminId()
  const settings = await getStore().getPageSettings()

  return (
    <>
      <AdminHeader
        title="صفحات المنصّة"
        description="نصوص «من نحن» و«الشروط والأحكام» و«كيف تعمل المنصّة»، وقسم الطمأنينة في الواجهة الأولى."
      />
      <PagesSettingsForm settings={settings} />
    </>
  )
}
