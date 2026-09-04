import { AdminHeader } from '@/components/admin/admin-ui'
import { FaqManager } from '@/components/admin/faq-manager'
import { listFaqForAdmin } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'الأسئلة الشائعة' }

export default async function AdminFaqPage() {
  await requireAdminId()
  const items = await listFaqForAdmin()

  return (
    <>
      <AdminHeader
        title="الأسئلة الشائعة"
        description="تظهر في صفحة الأسئلة، والمعلّم منها يظهر أيضًا أسفل صفحة كل مزاد."
      />
      <FaqManager items={items} />
    </>
  )
}
