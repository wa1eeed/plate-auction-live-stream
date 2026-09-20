'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Megaphone, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BROADCAST_AUDIENCE_LABELS,
  type BroadcastAudience,
} from '@/lib/domain/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const AUDIENCES = Object.keys(BROADCAST_AUDIENCE_LABELS) as BroadcastAudience[]

/**
 * بثٌّ إداريّ — رسالةٌ تُكتب هنا وتصل أجهزةَ شريحةٍ من المستخدمين.
 *
 * **ويُعرض عدد من ستبلغهم قبل الإرسال.** ما يُرسَل لا يُسترَدّ: يصل جهازًا
 * مقفلًا ويبقى في سجلّ صاحبه — فإرسالٌ في العمياء لا يُحتمل. والعدد يُقرأ من
 * الخادم مع كلّ تبديل شريحة.
 */
export function BroadcastForm() {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [href, setHref] = useState('')
  const [audience, setAudience] = useState<BroadcastAudience>('all')
  const [reference, setReference] = useState('')
  const [count, setCount] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // العدد يتبع الشريحة — ويُلغى طلبُه إن بُدّلت قبل أن يصل
  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ audience })
    if (audience === 'user' && reference.trim()) params.set('reference', reference.trim())

    void fetch(`/api/admin/broadcast?${params}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setCount(typeof data?.count === 'number' ? data.count : null))
      .catch(() => undefined)

    return () => controller.abort()
  }, [audience, reference])

  const ready = title.trim().length >= 2 && body.trim().length >= 2 && (count ?? 0) > 0

  async function send() {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          href: href.trim() || null,
          audience,
          reference: audience === 'user' ? reference.trim() : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر البثّ')
        return
      }
      toast.success(`وصلت ${data.delivered} مستخدمًا`)
      setTitle('')
      setBody('')
      setHref('')
    } catch {
      toast.error('تعذّر الاتصال — أعد المحاولة')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <section className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <Megaphone className="size-4 text-gold-500" />
        بثٌّ إداريّ
      </h2>
      <p className="mb-4 mt-1 text-[12px] leading-relaxed text-muted">
        رسالةٌ تكتبها الإدارة وتصل الأجهزة، وتبقى في جرس كلّ من بلغته.
        <strong className="text-paper"> وما يُرسَل لا يُسترَدّ</strong> — فاقرأ العدد قبل الضغط.
        ويُقيَّد نصُّها في سجلّ التدقيق بمرسلها.
      </p>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="bc-title">العنوان</Label>
          <Input
            id="bc-title"
            value={title}
            maxLength={60}
            placeholder="مزادٌ جديد"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-body">النصّ</Label>
          <Input
            id="bc-body"
            value={body}
            maxLength={200}
            placeholder="لوحةٌ مميّزة دخلت المزاد الآن"
            onChange={(event) => setBody(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-href">الوجهة عند الضغط (اختياري)</Label>
          <Input
            id="bc-href"
            dir="ltr"
            value={href}
            maxLength={200}
            placeholder="/market/lst_…"
            onChange={(event) => setHref(event.target.value)}
          />
          {/* رابطٌ خارجيّ في إشعارٍ من المنصّة يُقرأ توصيةً منها — وهو باب تصيّد */}
          <p className="text-[11px] text-muted">مسارٌ داخليّ يبدأ بـ / — ولا تُقبل روابط خارجية.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bc-audience">الشريحة</Label>
          <select
            id="bc-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value as BroadcastAudience)}
            className="h-10 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm"
          >
            {AUDIENCES.map((key) => (
              <option key={key} value={key}>
                {BROADCAST_AUDIENCE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        {audience === 'user' && (
          <div className="space-y-1.5">
            <Label htmlFor="bc-reference">رقم العضوية</Label>
            <Input
              id="bc-reference"
              dir="ltr"
              value={reference}
              maxLength={40}
              placeholder="U26-00001"
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2.5">
          <span className="flex items-center gap-2 text-xs text-muted">
            <Users className="size-3.5" />
            ستبلغ
            <b className="text-lg tabular-nums text-paper">{count ?? '—'}</b>
            مستخدمًا
          </span>
          <Button type="button" disabled={!ready || busy} onClick={() => setConfirming(true)}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            بثّ
          </Button>
        </div>
      </div>

      {/* تأكيدٌ صريح: ضغطةٌ واحدة تبلغ كلّ من في الشريحة ولا رجعة فيها */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogTitle>تبثّ إلى {count} مستخدمًا؟</AlertDialogTitle>
          <AlertDialogDescription>
            «{title.trim()}» — {body.trim()}
            <br />
            تصل أجهزتهم الآن، ولا تُسترَدّ بعد الإرسال.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()}>نعم، ابثّها</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
