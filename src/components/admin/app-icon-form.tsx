'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Save, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { BRAND_ASSET_LIMITS, type BrandAsset } from '@/lib/domain/types'

/**
 * **أيقونةُ التطبيق وشاشةُ إقلاعه — في إعدادات التطبيق لا في الهويّة.**
 *
 * والهويّةُ ما يراه الزائرُ في المتصفّح: الشعارُ في الترويسة، وأيقونةُ
 * التبويب، وصورةُ المشاركة. وهذه تُخبز في حزمتَي iOS وأندرويد، فموضعُها
 * مع بقيّة ما يخصّ التطبيق.
 *
 * **وعهدُها يختلف عن الفافيكون**: الفافيكون يجلس في شريط تبويب فيجوز أن
 * يكون شفّافًا وغيرَ مربّع. وهذه يضع النظامُ عليها قناعَه المستدير ويكبّرها
 * لشاشة الإقلاع — فتلزمها مربّعةً معتمةً إلى أطرافها.
 */
export function AppIconForm({ asset }: { asset: BrandAsset | null }) {
  const router = useRouter()
  const [current, setCurrent] = useState(asset)
  const [pending, setPending] = useState<BrandAsset | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  const shown = pending === undefined ? current : pending
  const dirty = pending !== undefined

  async function pick(file: File) {
    if (file.size > BRAND_ASSET_LIMITS.appIcon) {
      toast.error(
        `الملفّ ${Math.round(file.size / 1024)} كيلوبايت، والحدّ ${Math.round(
          BRAND_ASSET_LIMITS.appIcon / 1024,
        )}`,
      )
      return
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    setPending({
      data: btoa(binary),
      mime: file.type,
      fileName: file.name,
      bytes: file.size,
      updatedAt: new Date().toISOString(),
    })
  }

  async function save() {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/app-icon', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          appIcon: pending
            ? { data: pending.data, mime: pending.mime, fileName: pending.fileName }
            : null,
        }),
      })
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string }
        appIcon?: BrandAsset | null
      } | null
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      setCurrent(data?.appIcon ?? null)
      setPending(undefined)
      toast.success('حُفظت أيقونة التطبيق')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <div>
        <h3 className="font-bold">أيقونة التطبيق وشاشة الإقلاع</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          تُستعمل في <b className="text-paper">iOS وأندرويد معًا</b>: أيقونةُ الحزمة، والشاشةُ
          التي تُعرض لحظةَ الفتح. وتسري على اختصار الشاشة الرئيسية في المتصفّح فورًا، وعلى
          تطبيق المتجرين في <b className="text-paper">البناء الذي يليها</b>.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          مربّعة ١٠٢٤×١٠٢٤، <b className="text-paper">معتمة إلى أطرافها</b> — النظام يقصّها
          باستدارته، فالزوايا الفاتحة تظهر بيضاء داخل القصّة. وهي غير «أيقونة التبويب» في
          صفحة الهويّة: تلك للمتصفّح ويجوز أن تكون شفّافة.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-ink-600 bg-ink-900">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${shown.mime};base64,${shown.data}`}
              alt="أيقونة التطبيق"
              className="size-full object-cover"
            />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted">لا أيقونة — تُرسم من المستودع</span>
          )}
        </span>

        <div className="space-y-2">
          <Label htmlFor="app-icon-file" className="sr-only">
            ارفع أيقونة التطبيق
          </Label>
          <input
            id="app-icon-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-xs text-muted file:me-3 file:rounded-lg file:border file:border-ink-600 file:bg-ink-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-paper"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pick(file)
            }}
          />
          {shown && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>
              <Trash2 className="size-4" />
              أزِلها
            </Button>
          )}
        </div>
      </div>

      <Button onClick={save} disabled={busy || !dirty}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : dirty ? (
          <Save className="size-4" />
        ) : (
          <Upload className="size-4" />
        )}
        {dirty ? 'احفظ الأيقونة' : 'لا تغيير'}
      </Button>
    </section>
  )
}
