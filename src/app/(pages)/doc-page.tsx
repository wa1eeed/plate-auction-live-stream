import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, LayoutGrid } from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import type { EditableDoc } from '@/lib/domain/types'

/**
 * قالبٌ واحد للصفحات المحرَّرة — «من نحن» و«الشروط والأحكام».
 *
 * الصفحتان تختلفان في نصّهما لا في شكلهما، فقالبان متطابقان يفترقان بمرور
 * الوقت: يُصلَح تباعد في إحداهما ويُنسى في الأخرى. والمشترك هنا هو التخطيط،
 * والمختلف يأتي من الإدارة.
 *
 * والفقرات تُفصل بالسطر الفارغ لا بوسمٍ يكتبه المحرِّر: من يكتب في مربّع نصّ
 * يفصل بسطرٍ فارغ بطبعه، ولا يُطلب منه أن يتعلّم لغة وسمٍ ليكتب فقرتين.
 */
export function DocPage({ doc }: { doc: EditableDoc }) {
  // المخفيّة لا تُعرض ولو عُرف رابطها — الإخفاء قرارٌ لا تلميح
  if (!doc.published) notFound()

  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{doc.title}</h1>
        {doc.intro && (
          <p className="mt-2.5 text-pretty text-sm leading-relaxed text-muted">{doc.intro}</p>
        )}

        <div className="mt-8 space-y-4">
          {doc.sections.map((section, index) => (
            <section key={index} className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
              <h2 className="font-bold">{section.heading}</h2>
              <div className="mt-2 space-y-2.5">
                {section.body
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph, i) => (
                    <p key={i} className="text-sm leading-relaxed text-muted">
                      {paragraph}
                    </p>
                  ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8">
          <Button asChild>
            <Link href="/market">
              <LayoutGrid className="size-4" />
              تصفّح السوق
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </PageShell>
  )
}
