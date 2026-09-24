'use client'

import { useRef, useState } from 'react'
import { ImageUp, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type Uploaded = { key: string; width: number | null; height: number | null }

/** ما قد يردّه الخادم — نجاحًا أو خطأً، وقد لا يردّ شيئًا مفهومًا. */
type UploadReply = Partial<Uploaded> & { error?: { message?: string } }

/** سقفُ انتظار الرفع — فوق أبطأ رفعٍ معقول لـ٢٤ ميغابايت، ودون صبرِ من ينتظر. */
const UPLOAD_TIMEOUT_MS = 120_000

/**
 * حقلُ رفع — يرفع **فورًا** ويردّ المفتاح، لا عند حفظ النموذج.
 *
 * والفصل مقصود: التحقّق من النسبة والنوع يقع في الخادم على البايتات، فرفعٌ
 * مبكّر يعني أنّ الإدارة ترى «نسبة الصورة 1:1 والمطلوب 2:1» وهي واقفةٌ عند
 * الحقل — لا بعد أن تملأ النموذج كلَّه وتضغط حفظ.
 *
 * والمعاينة من `blob:` المحلّيّ لا من الرابط المرفوع: تظهر قبل أن يبدأ الرفع
 * أصلًا، وتبقى ولو كان النطاق العامّ بطيئًا.
 */
export function MediaUploadField({
  label,
  hint,
  accept,
  purpose,
  value,
  previewUrl,
  onUploaded,
  onCleared,
  aspect = 'aspect-[2/1]',
}: {
  label: string
  hint?: string
  accept: string
  purpose: 'banner' | 'story' | 'poster'
  value: string | null
  /** معاينةُ ما هو محفوظٌ سلفًا عند التعديل */
  previewUrl?: string | null
  onUploaded: (uploaded: Uploaded) => void
  onCleared: () => void
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [isVideo, setIsVideo] = useState(false)

  const preview = localPreview ?? previewUrl ?? null

  async function upload(file: File) {
    setBusy(true)
    /*
     * الرابط المحلّيّ السابق يُبطَل قبل إنشاء غيره.
     *
     * و`createObjectURL` يحجز البايتات في الذاكرة حتى يُبطَل — فلوحةٌ تُجرَّب
     * فيها عشرون صورة تحمل عشرين نسخةً حيّة بلا هذا السطر.
     */
    if (localPreview) URL.revokeObjectURL(localPreview)
    const url = URL.createObjectURL(file)
    setLocalPreview(url)
    setIsVideo(file.type.startsWith('video/'))

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('purpose', purpose)

      const response = await fetch('/api/admin/media', {
        method: 'POST',
        body: form,
        /* مهلةٌ صريحة — وبلا `signal` يبقى الطلب معلَّقًا بلا سقفٍ ولا رسالة */
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(UPLOAD_TIMEOUT_MS) : undefined,
      })

      /*
       * الجسم يُقرأ **نصًّا** ثمّ يُحاوَل تحليله — لا `response.json()` رأسًا.
       *
       * وكان رأسًا و**قبل** فحص `ok`، فكان يُخفي كلَّ ما يقوله الخادم: وكيلٌ
       * عكسيّ يردّ 504 بصفحة HTML، أو ردٌّ فارغ، أو مهلةٌ انقضت — كلُّها ترمي
       * في `json()` فتقع في `catch` فيُقرأ «تعذّر الاتّصال بالخادم». فيُطارد
       * صاحبُ اللوحة شبكةً سليمة، والخادم قد قال سببه بالحرف ولم يُسمع.
       */
      const raw = await response.text()
      let data: UploadReply | null = null
      try {
        data = raw ? (JSON.parse(raw) as UploadReply) : null
      } catch {
        data = null
      }

      if (!response.ok) {
        toast.error(data?.error?.message ?? `تعذّر الرفع — ردّ الخادم ${response.status}`)
        URL.revokeObjectURL(url)
        setLocalPreview(null)
        return
      }
      /* ردٌّ بحالة 200 بلا مفتاح ليس نجاحًا — ولا يُمرَّر فراغٌ إلى النموذج */
      if (typeof data?.key !== 'string') {
        toast.error(`تعذّر الرفع — ردٌّ غير مفهوم من الخادم (${response.status})`)
        URL.revokeObjectURL(url)
        setLocalPreview(null)
        return
      }
      onUploaded(data as Uploaded)
    } catch (error) {
      const timedOut = (error as { name?: string })?.name === 'TimeoutError'
      toast.error(
        timedOut
          ? 'انقضت مهلة الرفع — الملفّ كبير أو الشبكة بطيئة، أعد المحاولة'
          : 'تعذّر الاتّصال بالخادم',
      )
      URL.revokeObjectURL(url)
      setLocalPreview(null)
    } finally {
      setBusy(false)
      // يُفرَّغ ليقبل اختيار الملفّ نفسه مرّةً أخرى بعد خطأ
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-dashed border-ink-600 bg-ink-900/40',
          aspect,
        )}
      >
        {preview ? (
          isVideo ? (
            <video src={preview} muted playsInline className="size-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          )
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="grid size-full place-items-center gap-2 text-muted transition-colors hover:text-paper"
          >
            <ImageUp className="size-6" />
            <span className="text-xs font-bold">اختر ملفًّا</span>
          </button>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/70">
            <Loader2 className="size-5 animate-spin text-gold-500" />
          </div>
        )}

        {value && !busy && (
          <button
            type="button"
            aria-label="إزالة الملفّ"
            onClick={() => {
              if (localPreview) URL.revokeObjectURL(localPreview)
              setLocalPreview(null)
              onCleared()
            }}
            className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-ink-950/80 text-paper"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {value ? 'استبدال' : 'رفع'}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
        }}
      />
    </div>
  )
}
