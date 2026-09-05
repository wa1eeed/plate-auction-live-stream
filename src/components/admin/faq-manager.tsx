'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  FAQ_CATEGORIES,
  FAQ_CATEGORY_LABELS,
  SALE_TYPES,
  SALE_TYPE_LABELS,
  type FaqCategory,
  type FaqItem,
  type SaleType,
} from '@/lib/domain/types'

type Draft = {
  question: string
  answer: string
  category: FaqCategory
  sortOrder: number
  published: boolean
  showOnSaleTypes: SaleType[]
}

const EMPTY: Draft = {
  question: '',
  answer: '',
  category: 'general',
  sortOrder: 0,
  published: true,
  showOnSaleTypes: [],
}

/** إدارة الأسئلة الشائعة: إضافة وتعديل وحذف، وتحديد ما يظهر أسفل صفحة المزاد. */
export function FaqManager({ items }: { items: FaqItem[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!editing) return
    const { id, draft } = editing
    setBusy(true)
    try {
      const response = await fetch(id ? `/api/admin/faq/${id}` : '/api/admin/faq', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success(id ? 'حُدّث السؤال' : 'أُضيف السؤال')
      setEditing(null)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/faq/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json()
      toast.error(data?.error?.message ?? 'تعذّر الحذف')
      return
    }
    toast.success('حُذف السؤال')
    router.refresh()
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing({ id: null, draft: EMPTY })}>
          <Plus className="size-4" />
          أضف سؤالًا
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/50 p-10 text-center text-sm text-muted">
          لا توجد أسئلة بعد. أضف أول سؤال ليظهر للزوّار.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-ink-600 bg-ink-800 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="muted">{FAQ_CATEGORY_LABELS[item.category]}</Badge>
                    <Badge variant={item.published ? 'success' : 'muted'}>
                      {item.published ? (
                        <>
                          <Eye className="size-3" /> منشور
                        </>
                      ) : (
                        <>
                          <EyeOff className="size-3" /> مخفي
                        </>
                      )}
                    </Badge>
                    {item.showOnSaleTypes.map((type) => (
                      <Badge key={type} variant="gold">
                        {SALE_TYPE_LABELS[type]}
                      </Badge>
                    ))}
                    <span className="text-[11px] text-muted">ترتيب {item.sortOrder}</span>
                  </div>
                  <p className="font-bold">{item.question}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted">{item.answer}</p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setEditing({
                        id: item.id,
                        draft: {
                          question: item.question,
                          answer: item.answer,
                          category: item.category,
                          sortOrder: item.sortOrder,
                          published: item.published,
                          showOnSaleTypes: item.showOnSaleTypes,
                        },
                      })
                    }
                  >
                    <Pencil className="size-3.5" />
                    تعديل
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogTitle>حذف السؤال؟</AlertDialogTitle>
                      <AlertDialogDescription>
                        «{item.question}» — سيختفي من صفحة الأسئلة ومن صفحات المزادات. لا يمكن
                        التراجع.
                      </AlertDialogDescription>
                      <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(event) => {
                            event.preventDefault()
                            void remove(item.id)
                          }}
                        >
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
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
          >
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'تعديل السؤال' : 'سؤال جديد'}</DialogTitle>
              <DialogDescription>
                الأسئلة المنشورة تظهر في صفحة الأسئلة الشائعة، والمعلّمة منها تظهر أيضًا أسفل صفحة
                كل مزاد.
              </DialogDescription>
            </DialogHeader>

            {editing && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="faq-question">السؤال</Label>
                  <Input
                    id="faq-question"
                    value={editing.draft.question}
                    onChange={(event) =>
                      setEditing({ ...editing, draft: { ...editing.draft, question: event.target.value } })
                    }
                    required
                    minLength={5}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="faq-answer">الإجابة</Label>
                  <textarea
                    id="faq-answer"
                    value={editing.draft.answer}
                    onChange={(event) =>
                      setEditing({ ...editing, draft: { ...editing.draft, answer: event.target.value } })
                    }
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={5}
                    className="w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus-visible:border-gold-600"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="faq-category">التصنيف</Label>
                    <select
                      id="faq-category"
                      value={editing.draft.category}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          draft: { ...editing.draft, category: event.target.value as FaqCategory },
                        })
                      }
                      className="h-10 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm outline-none focus-visible:border-gold-600"
                    >
                      {FAQ_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {FAQ_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="faq-order">ترتيب العرض</Label>
                    <Input
                      id="faq-order"
                      inputMode="numeric"
                      dir="ltr"
                      value={String(editing.draft.sortOrder)}
                      onChange={(event) =>
                        setEditing({
                          ...editing,
                          draft: {
                            ...editing.draft,
                            sortOrder: Number(event.target.value.replace(/[^\d]/g, '') || 0),
                          },
                        })
                      }
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-ink-600 bg-ink-900/60 p-3">
                  <span className="text-sm font-semibold">منشور للزوّار</span>
                  <Switch
                    checked={editing.draft.published}
                    onCheckedChange={(published) =>
                      setEditing({ ...editing, draft: { ...editing.draft, published } })
                    }
                  />
                </label>

                {/*
                  * أين يظهر السؤال أسفل صفحات اللوحات — لكل طريقة بيعٍ رايتها.
                  *
                  * كانت رايةً واحدة تُنزله على كل صفحة إعلان، والصفحات ثلاثٌ
                  * تفترق أسئلتها: العربون والتمديد للمزايد، و«متى يصلني
                  * المبلغ؟» لمن يشتري مباشرة. فسؤالٌ في غير موضعه يُقرأ حشوًا.
                  */}
                <fieldset className="rounded-xl border border-ink-600 bg-ink-900/60 p-3">
                  <legend className="px-1 text-sm font-semibold">يظهر أسفل صفحات اللوحات</legend>
                  <p className="mb-2.5 text-[11px] leading-relaxed text-muted">
                    اختر طرق البيع التي يظهر السؤال أسفل صفحاتها. وبلا اختيار يبقى في صفحة
                    الأسئلة وحدها.
                  </p>
                  <div className="space-y-1.5">
                    {SALE_TYPES.map((type) => {
                      const checked = editing.draft.showOnSaleTypes.includes(type)
                      return (
                        <label
                          key={type}
                          className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-900 px-3 py-2"
                        >
                          <span className="text-sm">{SALE_TYPE_LABELS[type]}</span>
                          <Switch
                            checked={checked}
                            onCheckedChange={(next) =>
                              setEditing({
                                ...editing,
                                draft: {
                                  ...editing.draft,
                                  showOnSaleTypes: next
                                    ? [...editing.draft.showOnSaleTypes, type]
                                    : editing.draft.showOnSaleTypes.filter((t) => t !== type),
                                },
                              })
                            }
                          />
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={busy}>
                {busy ? 'جارٍ الحفظ…' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
