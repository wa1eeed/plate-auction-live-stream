import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/** شريحةٌ من نشاطٍ ما — عددٌ ولونٌ يقول حالَه. */
export type ActivitySegment = {
  label: string
  count: number
  tone: 'success' | 'danger' | 'gold' | 'muted'
}

export type ActivityRow = {
  href: string
  label: string
  Icon: React.ElementType
  segments: ActivitySegment[]
}

const TONE_BAR: Record<ActivitySegment['tone'], string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  gold: 'bg-gold-500',
  muted: 'bg-ink-600',
}
const TONE_DOT: Record<ActivitySegment['tone'], string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  gold: 'bg-gold-500',
  muted: 'bg-ink-600',
}

/**
 * **نشاطُك مجموعًا لا أرقامًا متفرّقة.**
 *
 * وأربعةُ مربّعاتٍ تقول «٦ مزايدات» لا تقول شيئًا يُتصرَّف به: أهي ستٌّ أنت
 * الأعلى فيها فتطمئنّ، أم ستٌّ تجاوزك غيرُك فيها فتعود؟ والشريطُ المقسَّم
 * يقول ذلك **بنظرة**، والتفصيلُ يُفتح لمن أراد.
 *
 * و`<details>` أصيلٌ لا حالةَ فيه: يفتح ويغلق **قبل الترطيب**، ويقرؤه قارئُ
 * الشاشة مطويًّا ومفتوحًا بلا `aria` نكتبها. وصفحةُ الحساب `force-dynamic`،
 * فكلُّ ما لا يحتاج جافاسكربت يُكتب بغيره.
 */
export function ActivityGroups({ groups }: { groups: { title: string; hint: string; rows: ActivityRow[] }[] }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} aria-labelledby={`group-${group.title}`}>
          <h2 id={`group-${group.title}`} className="mb-2 flex items-baseline gap-2 px-0.5">
            <span className="text-base font-extrabold">{group.title}</span>
            <span className="text-[11px] text-muted">{group.hint}</span>
          </h2>

          <ul className="surface divide-y divide-ink-600/70 overflow-hidden rounded-2xl">
            {group.rows.map((row) => {
              const total = row.segments.reduce((sum, part) => sum + part.count, 0)
              const shown = row.segments.filter((part) => part.count > 0)
              return (
                <li key={row.href}>
                  <details className="group/row">
                    {/*
                      * الصفُّ كلُّه يفتح التفصيل، والسهمُ وحده ينتقل.
                      *
                      * ولو كان الصفُّ رابطًا لَما أمكن فتحُه، ولو كان زرًّا
                      * لَاحتاج صاحبُه ضغطتين ليبلغ الصفحة. فالفتحُ في موضعه
                      * والانتقالُ في موضعه.
                      */}
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink-700/40 [&::-webkit-details-marker]:hidden">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold-600/30 bg-gold-500/10 text-gold-500">
                        <row.Icon className="size-4" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-paper">{row.label}</span>
                          {shown.length > 0 && (
                            <span
                              aria-hidden
                              className={cn('size-1.5 rounded-full', TONE_DOT[shown[0].tone])}
                            />
                          )}
                        </span>
                        {/* الشريطُ المقسَّم — نسبةُ كلّ حالٍ من المجموع */}
                        {total > 0 && (
                          <span aria-hidden className="mt-1.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
                            {shown.map((part) => (
                              <span
                                key={part.label}
                                className={cn('block rounded-full', TONE_BAR[part.tone])}
                                style={{ width: `${(part.count / total) * 100}%` }}
                              />
                            ))}
                          </span>
                        )}
                      </span>

                      <span className="text-lg font-extrabold tabular-nums text-paper">{total}</span>
                      <ChevronLeft className="size-4 shrink-0 text-muted transition-transform group-open/row:-rotate-90" />
                    </summary>

                    <div className="border-t border-ink-600/70 bg-ink-900/40 px-4 py-3">
                      {total === 0 ? (
                        <p className="text-xs text-muted">لا شيء بعد.</p>
                      ) : (
                        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
                          {shown.map((part) => (
                            <li key={part.label} className="flex items-center justify-between gap-2 text-xs">
                              <span className="flex items-center gap-1.5 text-muted">
                                <span aria-hidden className={cn('size-1.5 rounded-full', TONE_DOT[part.tone])} />
                                {part.label}
                              </span>
                              <b className="tabular-nums text-paper">{part.count}</b>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link
                        href={row.href}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-gold-500"
                      >
                        افتح {row.label}
                        <ChevronLeft className="size-3.5" />
                      </Link>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
