import type { Metadata } from 'next'
import { DocPage } from '../doc-page'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { privacy } = await getStore().getPageSettings()
  return { title: privacy.title, description: privacy.intro || undefined }
}

export default async function PrivacyPage() {
  const { privacy } = await getStore().getPageSettings()
  return <DocPage doc={privacy} />
}
