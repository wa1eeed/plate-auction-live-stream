import Link from 'next/link'
import type { Metadata } from 'next'
import { HelpCircle } from 'lucide-react'
import { FaqList } from '@/components/market/faq-list'
import { PageShell } from '@/components/layout/page-shell'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { Button } from '@/components/ui/button'
import { FAQ_CATEGORY_LABELS, type FaqCategory } from '@/lib/domain/types'
import { listPublicFaq } from '@/lib/server/admin-service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'الأسئلة الشائعة',
  description:
    'إجابات عن المزايدة والعربون والسعر الاحتياطي والسداد في سوق تداول لوحات المركبات.',
}

export default async function FaqPage() {
  const items = await listPublicFaq()

  // نجمع حسب التصنيف مع حفظ ترتيب الظهور داخل كل مجموعة
  const groups = new Map<FaqCategory, typeof items>()
  for (const item of items) {
    const list = groups.get(item.category) ?? []
    list.push(item)
    groups.set(item.category, list)
  }

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <header className="mb-8 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-gold-500/12 text-gold-500">
            <HelpCircle className="size-6" />
          </span>
          <h1 className="text-2xl font-extrabold sm:text-3xl">الأسئلة الشائعة</h1>
          <p className="mt-2 text-sm text-muted">
            كل ما تحتاج معرفته قبل المزايدة أو عرض لوحتك للبيع.
          </p>
        </header>

        {items.length === 0 ? (
          <FaqList items={[]} />
        ) : (
          <div className="space-y-8">
            {[...groups.entries()].map(([category, list]) => (
              <section key={category}>
                <h2 className="mb-3 text-sm font-bold text-gold-500">
                  {FAQ_CATEGORY_LABELS[category]}
                </h2>
                <FaqList items={list} showCategory={false} />
              </section>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-ink-600 bg-ink-800 p-6 text-center">
          <p className="text-sm text-muted">لم تجد إجابتك؟</p>
          <Button asChild className="mt-3">
            <Link href="/market">تصفّح السوق وابدأ المزايدة</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </PageShell>
  )
}
