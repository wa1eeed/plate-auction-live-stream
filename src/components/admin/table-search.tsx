'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ListPlus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { matchesReference, parseReference } from '@/lib/domain/reference'
import { useTablistKeys, tabIndexOf } from '@/components/ui/tablist'
import { cn } from '@/lib/utils'

/**
 * بحث فوري في جدول إداري.
 *
 * يعمل على الصفوف المُصيَّرة لا بطلب جديد: الجداول هنا محدودة (200 سطر سقفًا)
 * والبحث الفوري بلا انتظار شبكة أنفع من طلب لكل حرف. ويخفي الصفوف بـ`hidden`
 * بدل إزالتها فلا يُعاد بناء الجدول مع كل ضغطة.
 */
/** حجم الدفعة في جداول الإدارة — يملأ شاشة ونصفًا. */
const PAGE_SIZE = 25

export function TableSearch({
  placeholder,
  rows,
  tabs,
  children,
}: {
  placeholder: string
  /**
   * مفتاح كل صف ونصّه القابل للبحث، و`reference` رقمه المرجعي إن كان له رقم.
   * الرقم يُطابَق **تامًّا** لا كجزء من نصّ: «#1» يجب ألّا تسرد 10 و11 و19.
   * و`tab` قسمه إن قُسّم الجدول.
   */
  rows: { key: string; haystack: string; reference?: string; tab?: string }[]
  /** تقسيم الجدول إلى أقسام — بلا هذه يظهر الجدول كاملًا كما كان */
  tabs?: { key: string; label: string; hint?: string }[]
  children: React.ReactNode
}) {
  const keys = useTablistKeys()
  const [query, setQuery] = useState('')
  /*
   * تجزئة التصيير في البحث نفسه.
   *
   * الجداول تُصيَّر كاملة: مئتا صفّ في `الحركات` و`التدقيق`، ولكل صفّ في
   * الصفقات بطاقة بجملتين وأزرار. ووضعُ السقف هنا يُغني عن تعديل الصفحات
   * السبع، ويحترم البحث والأقسام: يُعدّ **المرئي** لا كل الصفوف.
   */
  const [limit, setLimit] = useState(PAGE_SIZE)
  const hasReferences = useMemo(() => rows.some((row) => row.reference), [rows])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const tab of tabs ?? []) map[tab.key] = 0
    for (const row of rows) if (row.tab && row.tab in map) map[row.tab] += 1
    return map
  }, [rows, tabs])

  // يُفتح على أوّل قسم فيه شيء — والأوّل عند الأدمن ما ينتظر قراره
  const [tab, setTab] = useState<string | null>(
    () => tabs?.find((entry) => (counts[entry.key] ?? 0) > 0)?.key ?? tabs?.[0]?.key ?? null,
  )

  // كل تبديل قسم أو بحث يعيد السقف إلى أوّله
  useEffect(() => setLimit(PAGE_SIZE), [query, tab])

  const hidden = useMemo(() => {
    const trimmed = query.trim()

    /*
     * البحث يعلو على التاب.
     *
     * ولو قُصر البحث على القسم المفتوح لقال «لا نتائج» عن معاملة موجودة في
     * قسم آخر — وهو أسوأ ما تُصاب به التابات: أن تكذب بالنيابة عن البحث.
     */
    if (!trimmed) {
      if (!tab) return new Set<string>()
      return new Set(rows.filter((row) => row.tab !== tab).map((row) => row.key))
    }

    /*
     * المطابقة التامّة للرقم لا تُطبَّق إلا على جدول يحمل أرقامًا.
     *
     * وإلا فجدولٌ بلا `reference` — كالمدفوعات والتدقيق — يُخفى **كلّه** حين
     * يلصق الأدمن رقمًا مرجعيًّا كاملًا، والحقل نفسه يدعوه إلى ذلك نصًّا.
     */
    if (hasReferences && parseReference(trimmed)) {
      return new Set(
        rows
          .filter((row) => !row.reference || !matchesReference(row.reference, trimmed))
          .map((row) => row.key),
      )
    }

    const needle = trimmed.toLowerCase()
    return new Set(
      rows.filter((row) => !row.haystack.toLowerCase().includes(needle)).map((row) => row.key),
    )
  }, [query, rows, tab, hasReferences])

  const matching = rows.filter((row) => !hidden.has(row.key))
  const overflow = matching.slice(limit)
  const shown = matching.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute end-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-11 rounded-2xl pe-10"
            aria-label={placeholder}
          />
          {query && (
            <button
              type="button"
              data-compact
              onClick={() => setQuery('')}
              aria-label="مسح البحث"
              className="absolute start-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-paper"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted" aria-live="polite">
          {query ? (
            <>
              <span className="font-bold text-paper">{shown}</span> من {rows.length}
              <span className="ms-1 opacity-70">(البحث يشمل الأقسام كلّها)</span>
            </>
          ) : (
            <>{shown} من {rows.length} سطرًا</>
          )}
        </p>
      </div>

      {tabs && tabs.length > 0 && (
        <div
          ref={keys.ref}
          onKeyDown={keys.onKeyDown}
          role="tablist"
          aria-label="أقسام الجدول"
          className="scrollbar-none edge-fade-start -mb-px flex gap-1 overflow-x-auto border-b border-ink-600 sm:mask-none"
        >
          {tabs.map((entry) => {
            const on = !query && tab === entry.key
            const count = counts[entry.key] ?? 0
            return (
              <button
                key={entry.key}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="admin-table-panel"
                tabIndex={tabIndexOf(on)}
                title={entry.hint}
                onClick={() => {
                  setQuery('')
                  setTab(entry.key)
                }}
                className={cn(
                  'relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm transition-colors',
                  on ? 'font-bold text-gold-500' : 'font-semibold text-muted hover:text-paper',
                )}
              >
                {entry.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-px text-[11px] font-bold tabular-nums',
                    count === 0
                      ? 'bg-ink-700 text-muted'
                      : entry.key === 'you'
                        ? 'bg-danger/15 text-danger'
                        : 'bg-ink-700 text-paper',
                  )}
                >
                  {count}
                </span>
                {on && (
                  <motion.span
                    layoutId="admin-table-tab"
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold-500"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* إخفاء غير المطابق وما تجاوز السقف — بلا إعادة بناء الجدول */}
      <style>{
        [...hidden, ...overflow.map((row) => row.key)]
          .map((key) => `[data-row="${key}"]{display:none}`)
          .join('')
      }</style>

      <div id="admin-table-panel" role="tabpanel">
      {shown === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-600 bg-ink-800/40 p-10 text-center text-sm text-muted">
          {query ? <>لا نتائج تطابق «{query}».</> : 'لا شيء في هذا القسم.'}
        </p>
      ) : (
        <>
          {children}
          {overflow.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setLimit((value) => value + PAGE_SIZE)}
              >
                <ListPlus className="size-4" />
                عرض المزيد
              </Button>
              <p aria-live="polite" className="text-xs text-muted">
                عُرض {Math.min(limit, shown)} من {shown}
              </p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
