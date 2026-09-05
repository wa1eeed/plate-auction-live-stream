'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

type Tab = { key: string; label: string; hint: string }
type Group = { title: string; hint: string; tabs: Tab[] }

/**
 * أقسام الإعدادات — لوحٌ جانبيّ مجمَّع لا صفٌّ من التابات.
 *
 * ستّة أقسام في صفٍّ واحد تُقرأ بالبحث لا بالنظر، وتُقصّ على الجوال. والعمود
 * المجمَّع يُظهرها كلّها بعناوين مجالاتها ووصفِ كلٍّ منها — فيُعرف موضع
 * «الرقم الضريبي» قبل فتح أربعة أقسام.
 *
 * والقسم المفتوح يُكتب في الرابط: من يضبط الأرشفة يحفظ رابطها، ومن يُحدِّث
 * الصفحة بعد حفظٍ يعود إلى ما كان فيه لا إلى أوّل قسم.
 */
export function SettingsTabs({
  groups,
  children,
}: {
  groups: Group[]
  children: Record<string, React.ReactNode>
}) {
  const first = groups[0]?.tabs[0]?.key ?? ''
  const [active, setActive] = useState(first)

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('tab')
    if (wanted && groups.some((g) => g.tabs.some((t) => t.key === wanted))) setActive(wanted)
  }, [groups])

  const open = (key: string) => {
    setActive(key)
    const url = new URL(window.location.href)
    url.searchParams.set('tab', key)
    window.history.replaceState(null, '', url)
  }

  const current = groups.flatMap((g) => g.tabs).find((t) => t.key === active)

  return (
    <div className="grid gap-5 lg:grid-cols-[15rem_1fr] lg:items-start">
      {/*
        * منتقٍ أصليّ على الجوال، وعمودٌ على الشاشة الواسعة.
        *
        * ستّة أقسام في عمودٍ على شاشةٍ ضيّقة تتراكم فوق النموذج: يمرّ صاحبها
        * على ستّة أزرار وثلاثة عناوين قبل أن يبلغ أوّل حقل. وشريطٌ أفقيّ ليس
        * بديلًا — ستّة أسماء عربية تفيض فيصير الشريط منطقة سحبٍ باللمس.
        *
        * و`select` الأصليّ يحلّها بسطرٍ واحد: يفتح منتقي النظام نفسه — عجلةً
        * في iOS وقائمةً في أندرويد — و`optgroup` يحمل عناوين المجالات كما
        * هي، فلا يضيع التصنيف الذي يُظهره العمود.
        */}
      <div className="lg:hidden">
        <label htmlFor="settings-picker" className="mb-1.5 block text-xs font-bold text-muted">
          القسم
        </label>
        <select
          id="settings-picker"
          value={active}
          onChange={(event) => open(event.target.value)}
          className="h-11 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm font-bold text-paper outline-none focus-visible:border-gold-500"
        >
          {groups.map((group) => (
            <optgroup key={group.title} label={group.title}>
              {group.tabs.map((tab) => (
                <option key={tab.key} value={tab.key}>
                  {tab.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/*
        * ودورُ العمود دورُ التابات وإن كان رأسيًّا.
        *
        * لوحٌ واحد ظاهر في كل لحظة والبقيّة مخفيّة — وهذا هو النمط بعينه مهما
        * كان اتجاهه. و`aria-current="page"` كان خطأً هنا: يقول «هذه الصفحة»
        * لقارئ الشاشة، والصفحة لم تتغيّر.
        */}
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="أقسام الإعدادات"
        className="hidden space-y-4 lg:sticky lg:top-20 lg:block"
      >
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wide text-muted/70">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.tabs.map((tab) => {
                const on = tab.key === active
                return (
                  <li key={tab.key}>
                    <button
                      type="button"
                      role="tab"
                      id={`settings-tab-${tab.key}`}
                      aria-selected={on}
                      aria-controls={`settings-panel-${tab.key}`}
                      tabIndex={on ? 0 : -1}
                      onClick={() => open(tab.key)}
                      className={cn(
                        'w-full rounded-xl px-3 py-2.5 text-start transition-colors',
                        on
                          ? 'bg-ink-800 text-paper shadow-sm ring-1 ring-ink-600'
                          : 'text-muted hover:bg-ink-800/70 hover:text-paper',
                      )}
                    >
                      <span className="block text-sm font-bold">{tab.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                        {tab.hint}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="min-w-0">
        {current && (
          <header className="mb-4">
            <h2 className="text-lg font-extrabold">{current.label}</h2>
            <p className="mt-0.5 text-xs text-muted">{current.hint}</p>
          </header>
        )}
        {/*
          * المفتوح وحده يُصيَّر.
          *
          * جُرِّب إبقاؤها كلّها مخفيّةً لتُحفظ حالة نموذجٍ نصفِ ممتلئ — فصارت
          * ستّة نماذج في الشجرة دائمًا، وحقولٌ متكرّرة الأسماء: «النسبة (٪)»
          * في قواعد المزاد وفي العمولة معًا. والمخفيّ خارج شجرة الوصول لكنّه
          * حاضرٌ لكل محدِّد يبحث بالاسم. والمكسب لا يوازي ذلك: لكل قسمٍ زرُّ
          * حفظه، وتبديلُ قسمٍ في منتصف التحرير نادر.
          */}
        {current && (
          <div
            role="tabpanel"
            id={`settings-panel-${current.key}`}
            aria-labelledby={`settings-tab-${current.key}`}
          >
            {children[current.key]}
          </div>
        )}
      </div>
    </div>
  )
}
