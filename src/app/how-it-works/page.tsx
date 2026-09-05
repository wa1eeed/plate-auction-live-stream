import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  Gavel,
  HandCoins,
  LayoutGrid,
  Lock,
  Plus,
  ShieldCheck,
  Tag,
  Timer,
} from 'lucide-react'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { getStore } from '@/lib/store'

export async function generateMetadata(): Promise<Metadata> {
  const { howItWorks } = await getStore().getPageSettings()
  return { title: howItWorks.title, description: howItWorks.intro || undefined }
}

/*
 * الأيقونات تبقى في الشيفرة والنصّ يأتي من الإدارة.
 *
 * الأيقونة اختيارٌ تصميميّ يقابل موضعًا لا كلمة، فلو تُركت لحقلٍ نصّي لخرجت
 * خطوةٌ بلا رمز أو رمزٌ لا يشبه خطوته. والترتيب هو الرابط بينهما: الخطوة
 * الأولى تأخذ الأيقونة الأولى، ولذلك عددُ الخطوات مثبَّت عند أربعٍ في
 * `PageSettings` — لا تُزاد من الإدارة ولا تُنقص.
 */
const SELLER_ICONS = [Plus, Tag, LayoutGrid, ShieldCheck]
const BUYER_ICONS = [LayoutGrid, Gavel, Timer, HandCoins]

export default async function HowItWorksPage() {
  /*
   * صفحة «كيف يعمل» تصف القاعدة السارية لا قاعدةً مكتوبة في الملفّ.
   *
   * العمولة تُشغَّل وتُعطَّل من لوحة الإدارة، وصفحةٌ تَعِد بخصمٍ معطَّل تُقرأ
   * وعدًا كاذبًا في الاتجاهين: البائع يتوقّع نقصًا لا يقع، والمنصّة تبدو
   * كأنّها تأخذ ما لا تأخذ.
   */
  const store = getStore()
  const [{ seller: sellerFee }, { howItWorks: page }] = await Promise.all([
    store.getCommissionSettings(),
    store.getPageSettings(),
  ])
  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{page.title}</h1>
        {page.intro && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{page.intro}</p>
        )}

        <Section title={page.sellerTitle} steps={page.sellerSteps} icons={SELLER_ICONS} />
        <Section title={page.buyerTitle} steps={page.buyerSteps} icons={BUYER_ICONS} />

        <section className="mt-8 rounded-2xl border border-gold-600/40 bg-gold-500/8 p-5">
          <h2 className="flex items-center gap-2 font-bold text-gold-600">
            <Lock className="size-4" />
            {page.reserveTitle}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{page.reserveBody}</p>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="font-bold">{page.rulesTitle}</h2>
          <ul className="mt-3 space-y-2">
            {page.rules.map((rule) => (
              <li key={rule} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="font-bold">{page.settlementTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{page.settlementBody}</p>
          {/*
            * سطر العمولة يُولَّد ولا يُكتب.
            *
            * العمولة تُشغَّل وتُعطَّل من الإعدادات، وصفحةٌ تَعِد بخصمٍ معطَّل
            * تُقرأ وعدًا كاذبًا في الاتجاهين: البائع يتوقّع نقصًا لا يقع،
            * والمنصّة تبدو كأنّها تأخذ ما لا تأخذ. فبقي هذا السطر خارج ما
            * يُحرَّر، يتبع القاعدة السارية لا ما كُتب في مربّع.
            */}
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {sellerFee.enabled
              ? 'ويُقتطع من حصيلة البائع عمولة المنصّة وضريبتها قبل أن يصله المبلغ.'
              : 'ولا تقتطع المنصّة عمولة على البيع حاليًا — يصل البائع كامل قيمة الصفقة.'}
          </p>
        </section>

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

function Section({
  title,
  steps,
  icons,
}: {
  title: string
  steps: { title: string; body: string }[]
  /** بالترتيب نفسه — الخطوة الأولى تأخذ الأولى */
  icons: React.ElementType[]
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => {
          const Icon = icons[index] ?? icons[0]
          return (
          <li key={index} className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gold-500/15 text-gold-500">
                <Icon className="size-4.5" />
              </span>
              <span className="text-xs font-bold text-muted">الخطوة {index + 1}</span>
            </div>
            <h3 className="font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
          )
        })}
      </ol>
    </section>
  )
}
