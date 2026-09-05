'use client'

import { useEffect, useState } from 'react'
import { AtSign, Check, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'free' }
  | { kind: 'taken'; reason: string }

/**
 * المعرّف العلنيّ — يُختار عند التسجيل ويُفحص وأنت تكتب.
 *
 * وهو رابط معرضه: `/@waleed`. واختياره هنا لا بعد التسجيل يجعله جزءًا من
 * الحساب منذ لحظته، فلا يبقى صاحبه برابطٍ رقميّ طويل حتى يكتشف الصفحة التي
 * تُغيّره.
 *
 * والفحص أثناء الكتابة لا عند الإرسال: من ملأ النموذج كلّه ثمّ رُدّ عليه
 * «المعرّف مأخوذ» يعيد قراءة كل حقلٍ ليعرف أين أخطأ.
 */
export function HandleField({
  value,
  onChange,
  error,
  label = 'معرّفك',
  hint = 'رابط معرضك الذي تشاركه — يمكنك تغييره لاحقًا.',
}: {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
  hint?: string
}) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    const handle = value.trim().toLowerCase()
    if (handle.length < 3) {
      setState({ kind: 'idle' })
      return
    }

    /*
     * مهلةٌ قبل السؤال، وإلغاءٌ لما سبقها.
     *
     * بلا المهلة يُسأل الخادم بكل حرف. وبلا الإلغاء تصل الإجابات بغير ترتيب
     * إرسالها، فتحلّ إجابةُ حرفٍ سابق محلّ إجابة ما يكتبه الآن.
     */
    setState({ kind: 'checking' })
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/handles/available?handle=${encodeURIComponent(handle)}`, {
          signal: controller.signal,
        })
        const data = (await response.json()) as { available: boolean; reason?: string }
        setState(
          data.available
            ? { kind: 'free' }
            : { kind: 'taken', reason: data.reason ?? 'غير متاح' },
        )
      } catch {
        // أُلغي الطلب أو تعذّر الاتصال — لا تُعرض حالة مضلّلة
        setState({ kind: 'idle' })
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  return (
    <>
      <Label htmlFor="handle">{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted">
          <AtSign className="size-4" />
        </span>
        <Input
          id="handle"
          dir="ltr"
          autoComplete="username"
          placeholder="waleed"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/^@+/, '').toLowerCase())}
          className={cn(
            'ps-9 font-mono',
            state.kind === 'free' && 'border-success',
            (state.kind === 'taken' || error) && 'border-danger',
          )}
        />
        <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center">
          {state.kind === 'checking' && <Loader2 className="size-4 animate-spin text-muted" />}
          {state.kind === 'free' && <Check className="size-4 text-success" />}
          {state.kind === 'taken' && <X className="size-4 text-danger" />}
        </span>
      </div>

      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : state.kind === 'taken' ? (
        <p className="text-xs font-semibold text-danger">{state.reason}</p>
      ) : state.kind === 'free' ? (
        <p className="text-xs font-semibold text-success">
          متاح — معرضك سيكون على <span dir="ltr">/@{value}</span>
        </p>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted">{hint}</p>
      )}
    </>
  )
}
