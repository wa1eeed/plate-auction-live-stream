'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ban, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * إيقاف إعلان مخالف ورفع الإيقاف عنه.
 *
 * لا حذف: الإيقاف يُبقي الأثر للتدقيق. والسبب إلزامي — يظهر للبائع في إشعاره
 * ويُقيَّد في سجلّ التدقيق باسم منفّذه.
 */
export function ListingAdminActions({
  listingId,
  label,
  suspended = false,
}: {
  listingId: string
  label: string
  /** موقوف الآن؟ فيُعرض رفع الإيقاف بدل الإيقاف */
  suspended?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const action = suspended ? 'reinstate' : 'suspend'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/listings/${listingId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, reason: reason.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الأمر')
        return
      }
      toast.success(suspended ? 'رُفع الإيقاف — عاد الإعلان مسودّة' : 'أُوقف الإعلان')
      setOpen(false)
      setReason('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={suspended ? undefined : 'text-danger hover:bg-danger/10'}
        >
          {suspended ? <RotateCcw className="size-3.5" /> : <Ban className="size-3.5" />}
          {suspended ? 'رفع الإيقاف' : 'إيقاف'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {suspended ? `رفع الإيقاف عن ${label}؟` : `إيقاف اللوحة ${label}؟`}
            </DialogTitle>
            <DialogDescription>
              {suspended ? (
                <>
                  سيعود الإعلان <b>مسودّة</b> عند البائع، ويُشعَر بذلك. هو من ينشره فيبدأ
                  المزاد بمدّة كاملة جديدة — فلا يعود بوقتٍ انقضى أثناء الإيقاف.
                </>
              ) : (
                <>
                  سيُغلق الإعلان ويختفي من السوق، و<b>تُفكّ العرابين المحجوزة عليه</b> فورًا.
                  ولا يستطيع البائع إعادة عرضه ولا حذفه — أنت وحدك من يرفع الإيقاف.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor={`reason-${listingId}`}>السبب</Label>
            <Input
              id={`reason-${listingId}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={suspended ? 'سبب رفع الإيقاف' : 'سبب المخالفة — يظهر للبائع'}
              minLength={3}
              maxLength={200}
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" variant={suspended ? 'default' : 'danger'} disabled={busy}>
              {busy ? 'جارٍ التنفيذ…' : suspended ? 'تأكيد رفع الإيقاف' : 'تأكيد الإيقاف'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
