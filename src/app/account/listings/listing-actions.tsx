'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil, RotateCcw, Send, ShieldAlert, Trash2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { canSellerRelist, type ListingStatus } from '@/lib/domain/types'

export function ListingActions({
  listingId,
  status,
  canEdit,
}: {
  listingId: string
  status: ListingStatus
  canEdit: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (action: 'publish' | 'cancel' | 'relist', successMessage: string) => {
    setBusy(action)
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الأمر')
        return
      }
      toast.success(successMessage)
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    try {
      const response = await fetch(`/api/listings/${listingId}`, { method: 'DELETE' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حذف اللوحة')
        return
      }
      toast.success('تم حذف اللوحة')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    /*
     * `contents`: الأزرار تنضمّ إلى صفّ التذييل بدل أن تسكن صندوقًا داخله.
     *
     * صندوقٌ ثانٍ داخل الصفّ يجعل «عرض اللوحة» وحده في طرفٍ وبقيّة الأزرار
     * كتلةً في الطرف الآخر، فتنكسر المسافات بينها وهي من جنسٍ واحد.
     */
    <div className="contents">
      {status === 'draft' && (
        <Button size="sm" className="shrink-0 whitespace-nowrap px-2.5" onClick={() => act('publish', 'نُشرت اللوحة في السوق')} disabled={busy !== null}>
          {busy === 'publish' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          انشر في السوق
        </Button>
      )}

      {canEdit && (
        <Button asChild size="sm" variant="outline" className="shrink-0 whitespace-nowrap px-2.5">
          <Link href={`/account/listings/${listingId}`}>
            <Pencil className="size-4" />
            تعديل
          </Link>
        </Button>
      )}

      {canSellerRelist(status) && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" className="shrink-0 whitespace-nowrap px-2.5" disabled={busy !== null}>
              <RotateCcw className="size-4" />
              إعادة عرض
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>إعادة عرض اللوحة؟</AlertDialogTitle>
            <AlertDialogDescription>
              تبدأ <b>جولة جديدة</b> لا استئنافًا: تُلغى مزايدات الجولة السابقة وتعود
              عرابينها لأصحابها، ويعود السعر إلى الافتتاحي. ويصل مزايديها السابقين إشعار
              بعودة اللوحة، فيعودون للمنافسة باختيارهم.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={() => act('relist', 'أُعيدت اللوحة كمسودة')}>
                إعادة العرض
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* الموقوف إداريًا: لا إعادة عرض ولا حذف — والسبب مذكور لا مسكوت عنه */}
      {status === 'suspended' && (
        <p className="flex basis-full items-start gap-1.5 rounded-xl border border-danger/40 bg-danger/[0.06] px-3 py-2 text-xs leading-relaxed text-danger">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          أوقفت الإدارة عرض هذه اللوحة. راجعها لرفع الإيقاف — وقد وصلك سبب الإيقاف في
          تنبيهاتك.
        </p>
      )}

      {status === 'active' && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              /*
               * الأحمر لا الرماديّ: الإلغاء يُنزل اللوحة من السوق ويوقف ما عليها،
               * فلا يُلبَس لون «تعديل» وهو ليس من جنسه.
               */
              variant="danger"
              className="shrink-0 whitespace-nowrap px-2.5"
              disabled={busy !== null}
            >
              <XCircle className="size-4" />
              إلغاء العرض
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>إلغاء عرض اللوحة؟</AlertDialogTitle>
            <AlertDialogDescription>
              ستختفي اللوحة من السوق وتتوقف المزايدات والعروض عليها.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={() => act('cancel', 'أُلغي عرض اللوحة')}>
                إلغاء العرض
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {(status === 'draft' || status === 'cancelled') && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 px-2.5"
              aria-label="حذف"
              disabled={busy !== null}
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>حذف اللوحة؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>تراجع</AlertDialogCancel>
              <AlertDialogAction onClick={remove}>حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
