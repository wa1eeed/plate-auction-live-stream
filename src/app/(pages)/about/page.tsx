import type { Metadata } from 'next'
import { DocPage } from '../doc-page'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { about } = await getStore().getPageSettings()
  return { title: about.title, description: about.intro || undefined }
}

export default async function AboutPage() {
  const { about } = await getStore().getPageSettings()
  return <DocPage doc={about} />
}
