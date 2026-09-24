import Link from 'next/link'
import { ArrowLeft, Wallet } from 'lucide-react'
import { formatAmount } from '@/lib/domain/money'
import type { User } from '@/lib/domain/types'

/**
 * **رأسُ الملفّ — هويّةٌ ورصيدٌ في بطاقةٍ واحدة.**
 *
 * وكان الاسمُ سطرًا والرصيدُ بطاقةً تحته، فيقرأ صاحبُه اسمَه ثمّ ينزل ليرى
 * ما عنده. وهما سؤالٌ واحدٌ عند فتح الملفّ: «من أنا هنا، وكم أملك؟» —
 * فيُجابان معًا في أوّل ما تقع عليه العين.
 *
 * والبطاقةُ داكنةٌ على صفحةٍ فاتحة عمدًا: تفصل الهويّةَ عمّا تحتها بلا خطٍّ
 * ولا عنوان، وهو ما تفعله التطبيقات الأصيلة في رؤوس ملفّاتها.
 */
export function AccountHeader({
  user,
  wallet,
}: {
  user: User
  wallet: { available: number; balance: number; held: number }
}) {
  const initial = user.displayName.trim().charAt(0) || '؟'
  const year = new Date(user.createdAt).toLocaleDateString('ar-SA', { year: 'numeric' })

  return (
    <section className="overflow-hidden rounded-3xl bg-ink-950 p-4 text-paper">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-lg font-extrabold text-gold-500"
        >
          {initial}
        </span>
        <div className="min-w-0">
          {/* نصٌّ لا عنوان — العنوانُ الوحيد في الصفحة يحمله الغلاف. انظر `page.tsx` */}
          <p className="truncate text-lg font-extrabold">{user.displayName}</p>
          {/*
            * رقمُ العضوية وسنةُ الانضمام في سطرٍ واحد.
            *
            * والرقمُ هو ما يُقتبَس في كلّ مراسلةٍ مع الإدارة، فموضعُه تحت
            * الاسم لا في قاعٍ يُبحث عنه.
            */}
          <p className="mt-0.5 truncate text-[11px] text-muted">
            {user.reference} · عضو منذ {year}
          </p>
        </div>
      </div>

      {/* شريطُ المحفظة — داخل البطاقة لا تحتها */}
      <Link
        href="/account/wallet"
        className="mt-3.5 flex items-center gap-3 rounded-2xl bg-ink-900/70 p-3.5 transition-colors hover:bg-ink-900"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-500">
          <Wallet className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] text-muted">الرصيد المتاح للمزايدة</span>
          <span className="block text-xl font-extrabold tabular-nums text-gold-500">
            {formatAmount(wallet.available)}
            <span className="ms-1 text-[11px] font-normal text-muted">ريال</span>
          </span>
          {wallet.held > 0 && (
            <span className="mt-0.5 block text-[11px] text-muted">
              محجوز كعرابين <b className="text-paper">{formatAmount(wallet.held)}</b>
            </span>
          )}
        </span>
        <ArrowLeft className="size-4 shrink-0 text-muted" />
      </Link>
    </section>
  )
}

export type CounterColumn = {
  href: string
  label: string
  total: number
  rows: { label: string; count: number }[]
}

/**
 * **ثلاثةُ أعمدةٍ بتفصيلها — لا ثلاثةُ أرقامٍ مجرّدة.**
 *
 * و«٤ طلبات» سؤالٌ لا جواب: أهي أربعٌ تنتظرني أم أربعٌ انتهت؟ فيُكتب تحت
 * كلّ رقمٍ ممّا يتركّب — سطران يكفيان، وما زاد صار جدولًا يُقرأ لا يُمسح.
 */
export function AccountCounters({ columns }: { columns: CounterColumn[] }) {
  return (
    <ul className="surface grid grid-cols-3 divide-x divide-x-reverse divide-ink-600/70 rounded-2xl">
      {columns.map((column) => (
        <li key={column.href}>
          <Link href={column.href} className="block h-full px-3 py-3.5 transition-colors hover:bg-ink-700/40">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[11px] text-muted">{column.label}</span>
              <b className="text-lg font-extrabold tabular-nums text-paper">{column.total}</b>
            </span>
            <span className="mt-2 block space-y-1">
              {column.rows.map((row) => (
                <span key={row.label} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[10px] text-muted">{row.label}</span>
                  <b className="text-[11px] tabular-nums text-muted">{row.count}</b>
                </span>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
