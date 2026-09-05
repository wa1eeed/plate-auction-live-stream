'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AtSign, Check, Copy, ExternalLink, Loader2, Save, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HandleField } from '@/components/market/handle-field'
import { showcasePath } from '@/lib/domain/reference'
import { cn } from '@/lib/utils'

/**
 * ضبط المعرض ومشاركته.
 *
 * الرابط أوّل ما في الصفحة لا آخرها: هذه الصفحة تُفتح لتُنسخ منها، لا لتُقرأ.
 */
export function ShowcaseForm({
  userId,
  handle: initialHandle,
  usesHandle: initialUses,
  displayName,
  origin,
}: {
  userId: string
  handle: string | null
  usesHandle: boolean
  displayName: string
  /** أصل العنوان كما ضبطته الإدارة — الرابط يُشارَك فلا يُبنى من `localhost` */
  origin: string
}) {
  const router = useRouter()
  const [handle, setHandle] = useState(initialHandle ?? '')
  const [usesHandle, setUsesHandle] = useState(initialUses)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // الرابط الذي يُنسخ هو الذي يُملى ويُلصق — فيؤخذ أقصرهما، وكلاهما يفتح الصفحة
  const path = showcasePath(initialHandle ?? userId)
  const url = `${origin}${path}`
  const shownAs = usesHandle && handle ? `@${handle}` : displayName

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('نُسخ رابط معرضك')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('تعذّر النسخ — انسخه يدويًّا')
    }
  }

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `لوحات ${shownAs}`, url })
        return
      }
      await copy()
    } catch {
      // ألغى المستخدم المشاركة
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch('/api/account/showcase', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle, showcaseUsesHandle: usesHandle }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success('حُفظت إعدادات المعرض')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* الرابط أوّلًا: هذه الصفحة تُفتح لتُنسخ منها */}
      <section className="rounded-2xl border border-gold-600/45 bg-gold-500/[0.06] p-5">
        <p className="text-xs font-bold text-muted">رابط معرضك — شاركه كما هو</p>
        <p
          dir="ltr"
          className="mt-2 truncate rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-start font-mono text-sm font-bold text-gold-500"
        >
          {url}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void share()}>
            <Share2 className="size-4" />
            مشاركة
          </Button>
          <Button type="button" variant="secondary" onClick={() => void copy()}>
            {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
            {copied ? 'نُسخ' : 'نسخ الرابط'}
          </Button>
          <Button asChild variant="outline">
            <a href={path} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              معاينة
            </a>
          </Button>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          صفحة عامّة يفتحها أي أحد بلا حساب — تعرض لوحاتك المنشورة وحدها. ولا تظهر فيها
          مسوّداتك ولا أسعارك الاحتياطية ولا بريدك ولا جوّالك.
        </p>
      </section>

      <form onSubmit={submit} className="space-y-5">
        <section className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-extrabold">
            <AtSign className="size-4 text-gold-500" />
            معرّفك في الرابط
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            بدونه يكون رابطك رقمًا طويلًا لا يُملى في مجلس ولا يُكتب في بطاقة.
          </p>

          <div className="mt-4 space-y-1.5">
            {/* الحقل نفسه الذي في التسجيل — فحصُ توفّرٍ واحد لا اثنان يفترقان */}
            <HandleField
              value={handle}
              onChange={setHandle}
              label="المعرّف"
              hint="حروف لاتينية صغيرة وأرقام وشرطة سفلية، من ٣ إلى ٣٠ خانة. وروابطك القديمة تبقى عاملة بعد تغييره."
            />
          </div>
        </section>

        <section className="surface rounded-2xl p-5">
          <h2 className="text-sm font-extrabold">الاسم الذي يظهر للزوّار</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            من يبيع لعملائه قد لا يريد اسمه الكامل في صفحةٍ تُنشر في مجموعة — والاختيار لك.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { value: false, label: displayName, hint: 'اسمك كما في حسابك' },
              {
                value: true,
                label: handle ? `@${handle}` : '@معرّفك',
                hint: handle ? 'معرّفك وحده' : 'اكتب معرّفك أوّلًا',
              },
            ].map((option) => (
              <button
                key={String(option.value)}
                type="button"
                disabled={option.value && !handle}
                onClick={() => setUsesHandle(option.value)}
                className={cn(
                  'rounded-xl border p-4 text-start transition-colors disabled:opacity-50',
                  usesHandle === option.value
                    ? 'border-gold-600 bg-gold-500/10'
                    : 'border-ink-600 bg-ink-900/40 hover:border-gold-600/40',
                )}
              >
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{option.hint}</span>
              </button>
            ))}
          </div>

          <p className="mt-3 rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2 text-xs">
            سيظهر عنوان معرضك: <b className="text-gold-500">لوحات {shownAs}</b>
          </p>
        </section>

        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ
          </Button>
        </div>
      </form>
    </div>
  )
}
