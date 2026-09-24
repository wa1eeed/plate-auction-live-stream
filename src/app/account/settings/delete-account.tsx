'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
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

type Blocker = { kind: string; detail: string }

/**
 * حذفُ الحساب — **تعطيلٌ لا محو، ومكتوبٌ ذلك للمستخدم قبل أن يضغط**.
 *
 * آبل تشترط أن يجد المستخدم هذا داخل التطبيق. ونقول له الحقيقة: حسابه
 * يُعطَّل ويبقى تاريخُه الماليّ — لأنّ محوَه محوٌ لصفقاتٍ وفواتيرَ تخصّ
 * طرفًا آخر أيضًا. ووعدٌ بمحوٍ لا يقع أسوأ من بيانِ تعطيل.
 *
 * والعوائقُ تُقرأ **عند فتح الحوار** لا عند تحميل الصفحة: صفحةٌ مفتوحة منذ
 * ساعة قد تعرض حالةً بائتة، فيُضغط الزرُّ على ظنٍّ خاطئ.
 */
export function DeleteAccount() {
  const router = useRouter()
  const [blockers, setBlockers] = useState<Blocker[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [busy, setBusy] = useState(false)

  async function check(open: boolean) {
    if (!open) return
    setChecking(true)
    setBlockers(null)
    try {
      const response = await fetch('/api/account/delete')
      const data = (await response.json()) as { blockers?: Blocker[] }
      setBlockers(data.blockers ?? [])
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setChecking(false)
    }
  }

  async function confirm() {
    setBusy(true)
    try {
      const response = await fetch('/api/account/delete', { method: 'POST' })
      const data = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر تنفيذ الطلب')
        return
      }
      toast.success('عُطّل حسابك — نأسف لمغادرتك')
      router.push('/')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  const blocked = (blockers?.length ?? 0) > 0

  return (
    <AlertDialog onOpenChange={check}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="border-danger/40 text-danger hover:bg-danger/10">
          <TriangleAlert className="size-4" />
          حذف الحساب
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogTitle>حذف الحساب</AlertDialogTitle>

        {checking ? (
          <AlertDialogDescription className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            نتحقّق من عملياتك الجارية…
          </AlertDialogDescription>
        ) : blocked ? (
          <>
            <AlertDialogDescription>
              لا يمكن حذف الحساب الآن — لديك ما لم ينتهِ بعد:
            </AlertDialogDescription>
            <ul className="space-y-2 text-sm">
              {blockers!.map((blocker) => (
                <li key={blocker.kind} className="flex gap-2 rounded-xl bg-ink-900 p-3">
                  <TriangleAlert className="size-4 shrink-0 text-warn" />
                  <span>{blocker.detail}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <AlertDialogDescription>
            سيُعطَّل حسابك فورًا ولن تستطيع الدخول. ويبقى سجلّك الماليّ من صفقاتٍ وفواتير
            محفوظًا كما يقتضيه النظام — فهو يخصّ الطرف الآخر أيضًا. ولإعادة التفعيل تواصل
            مع خدمة العملاء.
          </AlertDialogDescription>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>تراجع</AlertDialogCancel>
          {!checking && !blocked && (
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                /* الحوار لا يُغلق قبل أن يتمّ الطلب — وإلّا اختفت رسالةُ الردّ */
                event.preventDefault()
                void confirm()
              }}
              className="bg-danger text-paper hover:bg-danger/90"
            >
              {busy ? 'جارٍ…' : 'أؤكّد حذف حسابي'}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
