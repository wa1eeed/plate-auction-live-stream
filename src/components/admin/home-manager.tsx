'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Clock, Eye, EyeOff, Image as ImageIcon, Pencil, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { STORY_DURATION, type Banner, type Story } from '@/lib/domain/types'
import { MediaUploadField, type Uploaded } from './media-upload-field'

/* ------------------------------------------------------------ أدواتٌ مشتركة */

/**
 * `datetime-local` يعطي وقتًا محلّيًّا بلا منطقة، والخادم يريد ISO بـ`Z`.
 *
 * والتحويل هنا لا في الخادم: الإدارة تكتب بساعتها، و«ينتهي ١٠ مساءً» تعني
 * عشرة بتوقيتها هي. ولو أُرسل النصّ كما هو لفُسِّر UTC — فينتهي الإعلان قبل
 * موعده بثلاث ساعات في الرياض.
 */
function toIso(local: string): string | null {
  if (!local) return null
  const parsed = new Date(local)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function toLocal(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const dateFormat = new Intl.DateTimeFormat('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })

type WindowDraft = { published: boolean; startsAt: string; endsAt: string; sortOrder: number }

const EMPTY_WINDOW: WindowDraft = { published: true, startsAt: '', endsAt: '', sortOrder: 0 }

function WindowFields({
  draft,
  onChange,
}: {
  draft: WindowDraft
  onChange: (patch: Partial<WindowDraft>) => void
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt">يبدأ الظهور</Label>
          <Input
            id="startsAt"
            type="datetime-local"
            value={draft.startsAt}
            onChange={(event) => onChange({ startsAt: event.target.value })}
          />
          <p className="text-[11px] text-muted">اتركه فارغًا ليبدأ فور النشر</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt">ينتهي</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            value={draft.endsAt}
            onChange={(event) => onChange({ endsAt: event.target.value })}
          />
          <p className="text-[11px] text-muted">اتركه فارغًا ليبقى بلا نهاية</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">الترتيب</Label>
          <Input
            id="sortOrder"
            type="number"
            min={0}
            max={999}
            value={draft.sortOrder}
            onChange={(event) => onChange({ sortOrder: Number(event.target.value) || 0 })}
          />
          <p className="text-[11px] text-muted">الأصغر يظهر أوّلًا</p>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-3">
            <Switch
              checked={draft.published}
              onCheckedChange={(published) => onChange({ published })}
            />
            <span className="text-sm font-bold">منشور</span>
          </label>
        </div>
      </div>
    </>
  )
}

/** شاراتُ الحال — تقول بلمحةٍ لماذا لا يُرى ما نُشر. */
function WindowBadges({
  item,
}: {
  item: { published: boolean; startsAt: string | null; endsAt: string | null; sortOrder: number }
}) {
  const now = Date.now()
  const pending = item.startsAt && Date.parse(item.startsAt) > now
  const expired = item.endsAt && Date.parse(item.endsAt) <= now

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      <Badge variant={item.published ? 'success' : 'muted'}>
        {item.published ? (
          <>
            <Eye className="size-3" /> منشور
          </>
        ) : (
          <>
            <EyeOff className="size-3" /> مسودّة
          </>
        )}
      </Badge>
      {pending && (
        <Badge variant="gold">
          <Clock className="size-3" /> يبدأ {dateFormat.format(new Date(item.startsAt!))}
        </Badge>
      )}
      {expired && <Badge variant="muted">انتهى {dateFormat.format(new Date(item.endsAt!))}</Badge>}
      {!expired && item.endsAt && (
        <Badge variant="muted">حتى {dateFormat.format(new Date(item.endsAt))}</Badge>
      )}
      <span className="text-[11px] text-muted">ترتيب {item.sortOrder}</span>
    </div>
  )
}

function LinkField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="linkUrl">الرابط عند الضغط</Label>
      <Input
        id="linkUrl"
        dir="ltr"
        placeholder="/market?sale=auction أو https://…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="text-[11px] text-muted">
        داخليٌّ يبدأ بـ / وخارجيٌّ بـ https — واتركه فارغًا لما يُرى ولا يُضغط
      </p>
    </div>
  )
}

async function submit(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<boolean> {
  const response = await fetch(url, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    toast.error(data?.error?.message ?? 'تعذّرت العملية')
    return false
  }
  return true
}

/* ------------------------------------------------------------------ البنرات */

type BannerDraft = WindowDraft & {
  title: string
  alt: string
  linkUrl: string
  imageKey: string | null
  width: number
  height: number
  previewUrl: string | null
}

const EMPTY_BANNER: BannerDraft = {
  ...EMPTY_WINDOW,
  title: '',
  alt: '',
  linkUrl: '',
  imageKey: null,
  width: 0,
  height: 0,
  previewUrl: null,
}

export function BannerManager({ items }: { items: (Banner & { imageUrl: string })[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string | null; draft: BannerDraft } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    const { id, draft } = editing
    if (!draft.imageKey) {
      toast.error('ارفع صورة البنر أوّلًا')
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: draft.title,
        imageKey: draft.imageKey,
        width: draft.width,
        height: draft.height,
        alt: draft.alt,
        linkUrl: draft.linkUrl.trim() || null,
        published: draft.published,
        startsAt: toIso(draft.startsAt),
        endsAt: toIso(draft.endsAt),
        sortOrder: draft.sortOrder,
      }
      const done = await submit(
        id ? `/api/admin/banners/${id}` : '/api/admin/banners',
        id ? 'PATCH' : 'POST',
        payload,
      )
      if (!done) return
      toast.success(id ? 'حُدّث البنر' : 'أُضيف البنر')
      setEditing(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">البنرات</h2>
          <p className="text-sm text-muted">
            شريحةٌ أسفل الستوريز — إعلانٌ مدفوع أو ترويجُ قسم. المقاس ٢:١ (١٢٠٠×٦٠٠).
          </p>
        </div>
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_BANNER })}>
          <Plus className="size-4" />
          أضف بنرًا
        </Button>
      </div>

      {items.length === 0 ? (
        <Empty>لا بنرات بعد.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800">
              <div className="aspect-[2/1] bg-ink-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imageUrl} alt={item.alt} className="size-full object-cover" />
              </div>
              <div className="p-3">
                <WindowBadges item={item} />
                <p className="font-bold">{item.title}</p>
                {item.linkUrl && (
                  <p dir="ltr" className="mt-0.5 truncate text-start text-[11px] text-muted">
                    {item.linkUrl}
                  </p>
                )}
                <div className="mt-2.5 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        draft: {
                          title: item.title,
                          alt: item.alt,
                          linkUrl: item.linkUrl ?? '',
                          imageKey: item.imageKey,
                          width: item.width,
                          height: item.height,
                          previewUrl: item.imageUrl,
                          published: item.published,
                          startsAt: toLocal(item.startsAt),
                          endsAt: toLocal(item.endsAt),
                          sortOrder: item.sortOrder,
                        },
                      })
                    }
                  >
                    <Pencil className="size-3.5" />
                    تعديل
                  </Button>
                  <DeleteButton
                    title="حذف البنر؟"
                    description={`«${item.title}» — يختفي من الرئيسية، وتُحذف صورته. لا يمكن التراجع.`}
                    onConfirm={async () => {
                      if (await submit(`/api/admin/banners/${item.id}`, 'DELETE')) {
                        toast.success('حُذف البنر')
                        router.refresh()
                      }
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'تعديل بنر' : 'بنر جديد'}</DialogTitle>
            </DialogHeader>

            {editing && (
              <>
                <MediaUploadField
                  label="صورة البنر"
                  hint="٢:١ — مثل ١٢٠٠×٦٠٠"
                  accept="image/png,image/jpeg,image/webp"
                  purpose="banner"
                  value={editing.draft.imageKey}
                  previewUrl={editing.draft.previewUrl}
                  onUploaded={(uploaded: Uploaded) =>
                    setEditing((current) =>
                      current
                        ? {
                            ...current,
                            draft: {
                              ...current.draft,
                              imageKey: uploaded.key,
                              width: uploaded.width ?? 0,
                              height: uploaded.height ?? 0,
                            },
                          }
                        : current,
                    )
                  }
                  onCleared={() =>
                    setEditing((current) =>
                      current
                        ? { ...current, draft: { ...current.draft, imageKey: null, previewUrl: null } }
                        : current,
                    )
                  }
                />

                <Field
                  id="title"
                  label="العنوان (للإدارة)"
                  value={editing.draft.title}
                  placeholder="حملة رمضان"
                  onChange={(title) =>
                    setEditing({ ...editing, draft: { ...editing.draft, title } })
                  }
                />
                <Field
                  id="alt"
                  label="وصف الصورة"
                  value={editing.draft.alt}
                  placeholder="عرض خاصّ على عمولة البيع"
                  hint="يقرؤه من لا يرى الصورة — ومحرّكات البحث"
                  onChange={(alt) => setEditing({ ...editing, draft: { ...editing.draft, alt } })}
                />
                <LinkField
                  value={editing.draft.linkUrl}
                  onChange={(linkUrl) =>
                    setEditing({ ...editing, draft: { ...editing.draft, linkUrl } })
                  }
                />
                <WindowFields
                  draft={editing.draft}
                  onChange={(patch) =>
                    setEditing({ ...editing, draft: { ...editing.draft, ...patch } })
                  }
                />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={busy}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ---------------------------------------------------------------- الستوريز */

type StoryDraft = WindowDraft & {
  title: string
  alt: string
  linkUrl: string
  mediaKey: string | null
  mediaKind: 'image' | 'video'
  posterKey: string | null
  durationSeconds: number
  mediaPreview: string | null
  posterPreview: string | null
}

const EMPTY_STORY: StoryDraft = {
  ...EMPTY_WINDOW,
  title: '',
  alt: '',
  linkUrl: '',
  mediaKey: null,
  mediaKind: 'image',
  posterKey: null,
  durationSeconds: STORY_DURATION.default,
  mediaPreview: null,
  posterPreview: null,
}

export function StoryManager({
  items,
}: {
  items: (Story & { mediaUrl: string; posterUrl: string | null })[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string | null; draft: StoryDraft } | null>(null)
  const [busy, setBusy] = useState(false)

  const patch = (next: Partial<StoryDraft>) =>
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...next } } : current))

  async function save() {
    if (!editing) return
    const { id, draft } = editing
    if (!draft.mediaKey) {
      toast.error('ارفع محتوى الستوري أوّلًا')
      return
    }
    if (draft.mediaKind === 'video' && !draft.posterKey) {
      toast.error('الفدّيو يحتاج صورة غلاف')
      return
    }
    setBusy(true)
    try {
      const payload = {
        title: draft.title,
        mediaKey: draft.mediaKey,
        mediaKind: draft.mediaKind,
        posterKey: draft.mediaKind === 'video' ? draft.posterKey : null,
        alt: draft.alt,
        linkUrl: draft.linkUrl.trim() || null,
        durationSeconds: draft.durationSeconds,
        published: draft.published,
        startsAt: toIso(draft.startsAt),
        endsAt: toIso(draft.endsAt),
        sortOrder: draft.sortOrder,
      }
      const done = await submit(
        id ? `/api/admin/stories/${id}` : '/api/admin/stories',
        id ? 'PATCH' : 'POST',
        payload,
      )
      if (!done) return
      toast.success(id ? 'حُدّث الستوري' : 'أُضيف الستوري')
      setEditing(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">الستوريز</h2>
          <p className="text-sm text-muted">
            حلقاتٌ في أعلى الرئيسية تُفتح ملءَ الشاشة — صورةٌ أو فدّيو.
          </p>
        </div>
        <Button onClick={() => setEditing({ id: null, draft: EMPTY_STORY })}>
          <Plus className="size-4" />
          أضف ستوري
        </Button>
      </div>

      {items.length === 0 ? (
        <Empty>لا ستوريز بعد.</Empty>
      ) : (
        <ul
          /* اثنتان حتى على الضيّق: بطاقةُ ٩:١٦ بعرض الشاشة تصير ستّمئة بكسلٍ طولًا */
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-800">
              <div className="aspect-[9/16] bg-ink-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.posterUrl ?? item.mediaUrl}
                  alt={item.alt}
                  className="size-full object-cover"
                />
              </div>
              <div className="p-3">
                <WindowBadges item={item} />
                <p className="flex items-center gap-1.5 font-bold">
                  {item.mediaKind === 'video' ? (
                    <Video className="size-3.5 shrink-0 text-muted" />
                  ) : (
                    <ImageIcon className="size-3.5 shrink-0 text-muted" />
                  )}
                  <span className="truncate">{item.title}</span>
                </p>
                <div className="mt-2.5 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        draft: {
                          title: item.title,
                          alt: item.alt,
                          linkUrl: item.linkUrl ?? '',
                          mediaKey: item.mediaKey,
                          mediaKind: item.mediaKind,
                          posterKey: item.posterKey,
                          durationSeconds: item.durationSeconds,
                          mediaPreview: item.mediaUrl,
                          posterPreview: item.posterUrl,
                          published: item.published,
                          startsAt: toLocal(item.startsAt),
                          endsAt: toLocal(item.endsAt),
                          sortOrder: item.sortOrder,
                        },
                      })
                    }
                  >
                    <Pencil className="size-3.5" />
                    تعديل
                  </Button>
                  <DeleteButton
                    title="حذف الستوري؟"
                    description={`«${item.title}» — يختفي من الرئيسية، ويُحذف محتواه. لا يمكن التراجع.`}
                    onConfirm={async () => {
                      if (await submit(`/api/admin/stories/${item.id}`, 'DELETE')) {
                        toast.success('حُذف الستوري')
                        router.refresh()
                      }
                    }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'تعديل ستوري' : 'ستوري جديد'}</DialogTitle>
            </DialogHeader>

            {editing && (
              <>
                <div className="space-y-1.5">
                  <Label id="kind-label">النوع</Label>
                  <div role="group" aria-labelledby="kind-label" className="grid grid-cols-2 gap-2">
                    {(['image', 'video'] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={editing.draft.mediaKind === kind}
                        onClick={() =>
                          /* تبديلُ النوع يُسقط ما رُفع: صورةٌ لا تصلح فدّيو */
                          patch({ mediaKind: kind, mediaKey: null, mediaPreview: null })
                        }
                        className={
                          editing.draft.mediaKind === kind
                            ? 'rounded-xl border border-gold-500 bg-gold-500/10 px-3 py-2.5 text-sm font-bold'
                            : 'rounded-xl border border-ink-600 bg-ink-900 px-3 py-2.5 text-sm font-bold text-muted'
                        }
                      >
                        {kind === 'image' ? 'صورة' : 'فدّيو'}
                      </button>
                    ))}
                  </div>
                </div>

                <MediaUploadField
                  label={editing.draft.mediaKind === 'video' ? 'ملفّ الفدّيو' : 'الصورة'}
                  hint={editing.draft.mediaKind === 'video' ? 'MP4 أو MOV حتى ٢٠٠ ميغابايت' : 'يُفضَّل ٩:١٦'}
                  accept={
                    editing.draft.mediaKind === 'video'
                      ? 'video/mp4,video/quicktime'
                      : 'image/png,image/jpeg,image/webp'
                  }
                  purpose="story"
                  aspect="aspect-[9/16] max-h-64 mx-auto"
                  value={editing.draft.mediaKey}
                  previewUrl={editing.draft.mediaPreview}
                  onUploaded={(uploaded) => patch({ mediaKey: uploaded.key })}
                  onCleared={() => patch({ mediaKey: null, mediaPreview: null })}
                />

                {editing.draft.mediaKind === 'video' && (
                  <MediaUploadField
                    label="صورة الغلاف"
                    hint="أوّلُ ما يُرى في الحلقة قبل تحميل الفدّيو"
                    accept="image/png,image/jpeg,image/webp"
                    purpose="poster"
                    aspect="aspect-[9/16] max-h-48 mx-auto"
                    value={editing.draft.posterKey}
                    previewUrl={editing.draft.posterPreview}
                    onUploaded={(uploaded) => patch({ posterKey: uploaded.key })}
                    onCleared={() => patch({ posterKey: null, posterPreview: null })}
                  />
                )}

                <Field
                  id="story-title"
                  label="العنوان"
                  value={editing.draft.title}
                  placeholder="لوحات مميّزة"
                  hint="يظهر تحت الحلقة — كلمتان أو ثلاث"
                  onChange={(title) => patch({ title })}
                />
                <Field
                  id="story-alt"
                  label="وصف المحتوى"
                  value={editing.draft.alt}
                  placeholder="عرضٌ للوحات المميّزة هذا الأسبوع"
                  onChange={(alt) => patch({ alt })}
                />
                <LinkField value={editing.draft.linkUrl} onChange={(linkUrl) => patch({ linkUrl })} />

                {editing.draft.mediaKind === 'image' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="duration">مدّة العرض (ثانية)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min={STORY_DURATION.min}
                      max={STORY_DURATION.max}
                      value={editing.draft.durationSeconds}
                      onChange={(event) =>
                        patch({ durationSeconds: Number(event.target.value) || STORY_DURATION.default })
                      }
                    />
                    <p className="text-[11px] text-muted">
                      الفدّيو يأخذ مدّته هو — وهذه للصورة وحدها
                    </p>
                  </div>
                )}

                <WindowFields draft={editing.draft} onChange={patch} />
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={busy}>
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}

/* ------------------------------------------------------------ قطعٌ صغيرة */

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-10 text-center text-sm text-muted">
      {children}
    </div>
  )
}

function Field({
  id,
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  hint?: string
  onChange: (next: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  )
}

function DeleteButton({
  title,
  description,
  onConfirm,
}: {
  title: string
  description: string
  onConfirm: () => Promise<void>
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10">
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            حذف
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
