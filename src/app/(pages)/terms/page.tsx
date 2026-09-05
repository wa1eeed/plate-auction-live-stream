import type { Metadata } from 'next'
import { DocPage } from '../doc-page'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { terms } = await getStore().getPageSettings()
  return { title: terms.title, description: terms.intro || undefined }
}

export default async function TermsPage() {
  const { terms } = await getStore().getPageSettings()
  return <DocPage doc={terms} />
}
