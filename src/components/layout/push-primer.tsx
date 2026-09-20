'use client'

import { BellRing, Gavel, Share, Timer, Wallet } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * تمهيدٌ قبل نافذة الإذن — لأنّ المتصفّح لا يسأل مرّتين.
 *
 * نافذةُ الإذن نافذةُ النظام: تظهر بلا سياق، ورفضةٌ واحدة تُغلق الباب إلى
 * الأبد — لا يفتحه إلّا صاحبُه من إعدادات المتصفّح، وهو ما لا يفعله أحد. فهي
 * **طلبٌ لا يُعاد**، وإنفاقُه على زائرٍ لا يعرف لماذا يُسأل إهدارٌ له.
 *
 * فيُقال أوّلًا ما الذي سيصله ولماذا يعنيه، ثمّ يُسأل. ومن قال «ليس الآن» لم
 * يُنفَق طلبُه، فيُسأل في مرّةٍ أخرى حين يكون أحوج إليه.
 */

const REASONS = [
  { icon: Gavel, text: 'تجاوزَك مزايدٌ آخر — وما زال في الوقت متّسع' },
  { icon: Timer, text: 'قارب مزادٌ تتابعه على الانتهاء' },
  { icon: Wallet, text: 'رست عليك لوحة، أو قاربت مهلة سدادها' },
] as const

export function PushPrimer({
  open,
  onOpenChange,
  onConfirm,
  /** على iOS لا إذن قبل التثبيت — فيُقال ما يُفعل بدل زرٍّ لا يقع به شيء */
  needsInstallFirst = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  needsInstallFirst?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-400">
            <BellRing className="size-6" />
          </div>
          <DialogTitle className="text-center">نُنبّهك قبل أن يفوتك المزاد</DialogTitle>
          <DialogDescription className="text-center">
            المزاد يتحرّك وأنت خارج الصفحة، والتنبيه يُرجعك في وقته.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 py-1">
          {REASONS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
              <Icon className="mt-0.5 size-4 shrink-0 text-gold-500" />
              <span className="text-muted">{text}</span>
            </li>
          ))}
        </ul>

        {needsInstallFirst ? (
          /*
           * سفاري لا يمنح الإذن لصفحةٍ في المتصفّح — يمنحه لأيقونةٍ على الشاشة
           * الرئيسية (iOS 16.4 فأحدث). فالزرّ هنا يُضغط ولا يقع شيء، ويُحرَق
           * الطلب. ويُقال ما يُفعل بدلًا منه.
           */
          <div className="rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-[12px] leading-relaxed text-muted">
            <p className="mb-1.5 font-semibold text-paper">على الآيفون خطوةٌ قبلها</p>
            <p>
              افتح <Share className="inline size-3.5 align-text-bottom" /> المشاركة في سفاري،
              ثمّ «إضافة إلى الشاشة الرئيسية». وبعد فتح المنصّة من أيقونتها يعمل التنبيه.
            </p>
          </div>
        ) : (
          <p className="text-center text-[11px] text-muted">
            لن نرسل إليك شيئًا غير هذا، ويمكنك إطفاؤه متى شئت.
          </p>
        )}

        <DialogFooter className="gap-2 sm:flex-col">
          {!needsInstallFirst && (
            <Button size="lg" className="w-full" onClick={onConfirm}>
              <BellRing className="size-4" />
              فعّل التنبيهات
            </Button>
          )}
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            {needsInstallFirst ? 'حسنًا' : 'ليس الآن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
