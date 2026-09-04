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

export const metadata: Metadata = {
  title: 'كيف يعمل السوق',
  description: 'شرح طرق البيع الثلاث وآلية المزايدة والتمديد التلقائي والسعر الاحتياطي.',
}

const SELLER_STEPS = [
  { icon: Plus, title: 'أضف لوحتك', body: 'أدخل الحروف والأرقام واختر الشعار — تُحفظ كمسودة أولًا.' },
  { icon: Tag, title: 'اختر طريقة البيع', body: 'بيع مباشر بسعر ثابت، أو مزاد بمزايدات، أو استقبال عروض.' },
  { icon: LayoutGrid, title: 'انشرها في السوق', body: 'تظهر فورًا للجميع، ويبدأ عدّاد المزاد لحظة النشر.' },
  {
    icon: ShieldCheck,
    title: 'انقل الملكية واقبض',
    body: 'يصل مبلغ المشتري فيُحجز أمانةً لدى المنصّة، فتنقل الملكية وترفع إثباتها، ثم يُفرَج لك بعد تأكيده أو انقضاء مهلته.',
  },
]

const BUYER_STEPS = [
  { icon: LayoutGrid, title: 'تصفّح بلا تسجيل', body: 'ابحث بالحروف أو الأرقام، وصفِّ حسب طريقة البيع والنوع.' },
  { icon: Gavel, title: 'زايد أو اشترِ', body: 'زايد في المزادات، أو اشترِ مباشرة، أو أرسل عرضك للبائع.' },
  { icon: Timer, title: 'تابع مزايداتك', body: 'صفحة مزايداتي تُظهر أين أنت الأعلى وأين تمت المزايدة عليك.' },
  {
    icon: HandCoins,
    title: 'سدّد ونحن نحفظ مالك',
    body: 'تسدّد عبر المنصّة فيبقى مبلغك محفوظًا لدينا لا يصل البائع، وبعد نقل الملكية تتحقّق الإدارة ثم تحوّل المبلغ للبائع. ولك أن تفتح تذكرة استفسار أو اعتراض في أيّ وقت قبل التحويل.',
  },
]

const RULES = [
  'المزايدة وقبول العرض التزام بيعي داخل السوق.',
  'تُقبل المزايدة فقط إذا ساوت المبلغ المطلوب التالي أو تجاوزته.',
  'لا يمكنك المزايدة على إعلانك ولا على نفسك وأنت أعلى مزايد.',
  'وقت انتهاء المزاد يُحسب على الخادم، فلا تؤثر ساعة جهازك على النتيجة.',
  'أي مزايدة صحيحة في الدقائق الأخيرة تمدّد المزاد تلقائيًا.',
  'المزايدات الملغاة تبقى ظاهرة في الكشف موسومةً للشفافية.',
]

export default async function HowItWorksPage() {
  /*
   * صفحة «كيف يعمل» تصف القاعدة السارية لا قاعدةً مكتوبة في الملفّ.
   *
   * العمولة تُشغَّل وتُعطَّل من لوحة الإدارة، وصفحةٌ تَعِد بخصمٍ معطَّل تُقرأ
   * وعدًا كاذبًا في الاتجاهين: البائع يتوقّع نقصًا لا يقع، والمنصّة تبدو
   * كأنّها تأخذ ما لا تأخذ.
   */
  const { seller: sellerFee } = await getStore().getCommissionSettings()
  return (
    <PageShell>
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-extrabold sm:text-3xl">كيف يعمل السوق</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          سوق لتداول لوحات المركبات: كل لوحة إعلان مستقل، وصاحب الحساب الواحد يبيع ويشتري.
        </p>

        <Section title="إذا كنت بائعًا" steps={SELLER_STEPS} />
        <Section title="إذا كنت مشتريًا" steps={BUYER_STEPS} />

        <section className="mt-8 rounded-2xl border border-gold-600/40 bg-gold-500/8 p-5">
          <h2 className="flex items-center gap-2 font-bold text-gold-600">
            <Lock className="size-4" />
            السعر الاحتياطي
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            في المزادات يمكن للبائع تحديد سعر احتياطي سرّي. رقمه لا يظهر لأي مزايد في أي وقت، وإنما
            تظهر <span className="text-paper">حالته</span> فقط: «تحقق» أو «لم يتحقق بعد». إن انتهى
            المزاد دون بلوغه لا تُباع اللوحة.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="font-bold">قواعد التداول</h2>
          <ul className="mt-3 space-y-2">
            {RULES.map((rule) => (
              <li key={rule} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" />
                {rule}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-ink-600 bg-ink-800 p-5">
          <h2 className="font-bold">السداد ونقل الملكية</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            يسدّد المشتري عبر المنصّة فيبقى المبلغ محفوظًا لديها، ثم ينقل البائع الملكية عبر
            القنوات الرسمية ويرفع إثباتها. وتتحقّق الإدارة من النقل ثم تحوّل المبلغ إلى البائع
            {sellerFee.enabled ? ' بعد خصم عمولة المنصّة وضريبتها' : ''} — لا يخرج المال إلا
            بقرارها. وللمشتري أن يفتح تذكرة
            استفسار أو اعتراض في أيّ وقت قبل التحويل، فيتوقّف التحويل حتى تفصل الإدارة.
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
}: {
  title: string
  steps: { icon: typeof Gavel; title: string; body: string }[]
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-lg font-extrabold">{title}</h2>
      <ol className="grid gap-4 sm:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-ink-600 bg-ink-800 p-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gold-500/15 text-gold-500">
                <step.icon className="size-4.5" />
              </span>
              <span className="text-xs font-bold text-muted">الخطوة {index + 1}</span>
            </div>
            <h3 className="font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
