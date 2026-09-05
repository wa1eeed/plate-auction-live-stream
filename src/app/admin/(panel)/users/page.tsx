import Link from 'next/link'
import { ArrowLeft, Gavel, LayoutList, Receipt, Wallet } from 'lucide-react'
import { TableSearch } from '@/components/admin/table-search'
import { AdminHeader, Money } from '@/components/admin/admin-ui'
import { Badge } from '@/components/ui/badge'
import { listUserRows } from '@/lib/server/admin-service'
import { requireAdminId } from '@/lib/server/require-admin'
import { formatTimestamp } from '@/lib/utils'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'المستخدمون' }

/**
 * المستخدمون — بطاقاتٌ تُقرأ بنظرة، لا جدولٌ من عشرة أعمدة.
 *
 * كان جدولًا عرضه ٦٠rem يُمرَّر أفقيًّا على الجوال، وفيه **البريد** في كل
 * سطر. والبريد لا يُقرَّر به شيء وهو يُمسح بالعين: المشغّل يبحث عن من تأخّر
 * سداده أو من امتلأت محفظته، لا عن نطاق بريده. وهو مع ذلك بيانٌ شخصيّ يُعرض
 * على شاشةٍ قد تُشارَك أو تُصوَّر — فموضعه صفحة المستخدم لا قائمته.
 *
 * وما بقي هو ما يُقرَّر به: مالُه، ونشاطه، وما تعثّر عنده.
 */
export default async function AdminUsersPage() {
  await requireAdminId()
  const rows = await listUserRows()
  const flagged = rows.filter((row) => row.overdueCount > 0).length

  return (
    <>
      <AdminHeader
        title="المستخدمون"
        description={`${rows.length} مستخدمًا${flagged > 0 ? ` · ${flagged} عندهم صفقات متأخّرة` : ''}`}
      />

      <TableSearch
        placeholder="ابحث بالاسم أو المعرّف أو البريد أو المدينة أو رقم العضوية"
        rows={rows.map((row) => ({
          key: row.id,
          reference: row.reference,
          // البريد يبقى في البحث وإن غاب عن البطاقة: الدعم يُسأل به
          haystack: [row.displayName, row.handle ?? '', row.email, row.city ?? '', row.id].join(' '),
        }))}
      >
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-600 p-10 text-center text-sm text-muted">
            لا يوجد مستخدمون بعد.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((row) => (
              <li
                key={row.id}
                data-row={row.id}
                className={cn(
                  'surface rounded-2xl p-3.5 transition-colors hover:border-gold-600/40 sm:p-4',
                  row.overdueCount > 0 && 'border-danger/35 bg-danger/[0.03]',
                )}
              >
                <Link href={`/admin/users/${row.reference}`} className="block">
                  {/* الهوية: اسمه ومعرّفه ورقمه — وبها يُنادى في أي مراسلة */}
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-bold">{row.displayName}</span>
                        {row.handle && (
                          <span dir="ltr" className="font-mono text-[11px] text-muted">
                            @{row.handle}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {row.city ? `${row.city} · ` : ''}انضمّ {formatTimestamp(row.createdAt)}
                      </p>
                    </div>

                    <span
                      dir="ltr"
                      className="shrink-0 rounded-lg bg-ink-700 px-2 py-0.5 font-mono text-[11px] font-bold text-gold-500"
                    >
                      {row.reference}
                    </span>
                  </div>

                  {/*
                    * أرقامه في صفٍّ واحد يُمسح بالعين.
                    *
                    * وأربعة منها تكفي: ما يملك، وما يعرض، وما يزايد، وما اشترى
                    * أو باع. والتفصيل في صفحته.
                    */}
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-ink-600/70 pt-3 sm:grid-cols-4">
                    <Stat icon={Wallet} label="المتاح">
                      <Money value={row.available} className="text-sm" />
                      {row.held > 0 && (
                        <span className="block text-[10px] text-gold-500">
                          محجوز {row.held / 100}
                        </span>
                      )}
                    </Stat>

                    <Stat icon={LayoutList} label="لوحاته">
                      <span className="text-sm font-bold tabular-nums">{row.listingCount}</span>
                      {row.activeListingCount > 0 && (
                        <span className="block text-[10px] text-success">
                          {row.activeListingCount} معروضة
                        </span>
                      )}
                    </Stat>

                    <Stat icon={Gavel} label="مزايداته">
                      <span className="text-sm font-bold tabular-nums">{row.bidCount}</span>
                    </Stat>

                    <Stat icon={Receipt} label="صفقاته">
                      <span className="text-sm font-bold tabular-nums">
                        {row.purchaseCount + row.saleCount}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {row.purchaseCount} شراء · {row.saleCount} بيع
                      </span>
                    </Stat>
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    {row.overdueCount > 0 ? (
                      <Badge variant="danger">{row.overdueCount} صفقة متأخّرة السداد</Badge>
                    ) : (
                      <span />
                    )}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-500">
                      التفاصيل
                      <ArrowLeft className="size-3" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </TableSearch>
    </>
  )
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[10px] font-semibold text-muted">
        <Icon className="size-3" />
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
