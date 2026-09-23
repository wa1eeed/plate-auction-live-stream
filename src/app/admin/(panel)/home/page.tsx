import { AdminHeader } from '@/components/admin/admin-ui'
import { BannerManager, StoryManager } from '@/components/admin/home-manager'
import { listBannersForAdmin, listStoriesForAdmin } from '@/lib/server/home-media-service'
import { getMedia } from '@/lib/server/media'
import { requireAdminId } from '@/lib/server/require-admin'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'واجهة الرئيسية' }

export default async function AdminHomePage() {
  await requireAdminId()
  const media = getMedia()
  const [banners, stories] = await Promise.all([listBannersForAdmin(), listStoriesForAdmin()])

  return (
    <>
      <AdminHeader
        title="واجهة الرئيسية"
        description="الستوريز والبنرات في أعلى الصفحة الرئيسية — على التطبيق وويب الجوال."
      />
      <div className="space-y-10">
        {/*
          * الروابط تُشتقّ هنا لا في المكوّن.
          *
          * المكوّن عميلٌ لا يعرف المحرّك العامل، والمفتاح تفصيلُ تخزينٍ
          * داخليّ — فما يعبر الحدّ روابطُ جاهزة.
          */}
        <StoryManager
          items={stories.map((story) => ({
            ...story,
            mediaUrl: media.publicUrl(story.mediaKey),
            posterUrl: story.posterKey ? media.publicUrl(story.posterKey) : null,
          }))}
        />
        <BannerManager
          items={banners.map((banner) => ({
            ...banner,
            imageUrl: media.publicUrl(banner.imageKey),
          }))}
        />
      </div>
    </>
  )
}
