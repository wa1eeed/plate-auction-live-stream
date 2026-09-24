'use client'

import { useRef, useState } from 'react'
import { ImageUp, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { uploadMedia, UploadError } from '@/lib/client/upload-media'

export type Uploaded = { key: string; width: number | null; height: number | null }

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
  /** نسبةُ ما صعد — `null` قبل أن تصل أوّلُ إشارة تقدّم */
  const [progress, setProgress] = useState<number | null>(null)
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

    setProgress(0)

    try {
      onUploaded(await uploadMedia(file, purpose, setProgress))
    } catch (error) {
      /*
       * `UploadError` تحمل رسالةً عربيةً جاهزة — تُعرض كما هي.
       *
       * وما سواها لم يبلغ الخادمَ أصلًا: وصلةٌ انقطعت أو مهلةٌ انقضت. وهي
       * الحالة **الوحيدة** التي تُقال فيها «تعذّر الاتّصال» — وكانت تُقال
       * لكلّ عطلٍ فتُخفي ما قاله الخادمُ بالحرف.
       */
      const timedOut = (error as { name?: string })?.name === 'TimeoutError'
      toast.error(
        error instanceof UploadError
          ? error.message
          : timedOut
            ? 'انقضت مهلة الرفع — الشبكة بطيئة، أعد المحاولة'
            : 'تعذّر الاتّصال بالخادم',
      )
      URL.revokeObjectURL(url)
      setLocalPreview(null)
    } finally {
      setBusy(false)
      setProgress(null)
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
          <div className="absolute inset-0 grid place-items-center gap-3 bg-ink-950/70 px-6">
            <Loader2 className="size-5 animate-spin text-gold-500" />
            {/*
              شريطٌ يتقدّم — لا دوّارةٌ تدور بلا خبر.
              ورفعُ مئةِ ميغابايت على وصلةٍ منزلية دقائق، ودوّارةٌ صامتة طولَها
              تُقرأ تعليقًا فيُعاد التحميل، فيُقطع رفعٌ كان يتمّ.
            */}
            {progress !== null && (
              <>
                <div className="h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-ink-700">
                  <div
                    className="h-full rounded-full bg-gold-500 transition-[width] duration-200"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-paper">
                  {Math.round(progress * 100)}٪
                </span>
              </>
            )}
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
