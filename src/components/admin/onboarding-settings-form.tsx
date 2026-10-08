'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  MAX_ONBOARDING_SLIDES,
  ONBOARDING_ICONS,
  type OnboardingIcon,
  type OnboardingSettings,
  type OnboardingSlide,
} from '@/lib/domain/types'

const ICON_LABELS: Record<OnboardingIcon, string> = {
  gavel: 'مطرقة المزاد',
  tag: 'بطاقة سعر',
  handshake: 'مصافحة',
  shield: 'درع الضمان',
  wallet: 'محفظة',
  plate: 'لوحة',
}

/**
 * **محرّرُ مقدّمة التطبيق — شاشةُ الهويّة وشرائحُ التعريف.**
 *
 * ولا رفعَ صورٍ للشرائح: الإعدادات تُقرأ من ملفٍّ واحد في كلّ طلب، والصورةُ
 * تُخزَّن فيه بترميز base64 — فخمسُ صورٍ تُثقل كلَّ قراءة. والأيقونةُ تُرسم
 * من مكتبة المنصّة نفسها فتتّسق مع بقيّتها وتظهر بلا شبكة.
 */
export function OnboardingSettingsForm({ settings }: { settings: OnboardingSettings }) {
  const router = useRouter()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [tagline, setTagline] = useState(settings.splashTagline)
  const [slides, setSlides] = useState<OnboardingSlide[]>(settings.slides)
  const [busy, setBusy] = useState(false)

  const patch = (index: number, change: Partial<OnboardingSlide>) =>
    setSlides((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)))

  const add = () =>
    setSlides((rows) => [
      ...rows,
      { id: `ob-${Date.now().toString(36)}`, title: '', body: '', icon: 'gavel' },
    ])

  async function save() {
    if (slides.some((row) => !row.title.trim() || !row.body.trim())) {
      toast.error('كلُّ شريحةٍ تحتاج عنوانًا ونصًّا')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/onboarding', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled, splashTagline: tagline, slides }),
      })
      const data = (await response.json().catch(() => null)) as {
        error?: { message?: string }
      } | null
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success('حُفظت المقدّمة')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <h3 className="font-bold">شاشة الهويّة</h3>
        <p className="text-xs leading-relaxed text-muted">
          تُعرض لحظةَ فتح التطبيق بعد شاشة النظام مباشرةً، فتبدو لحظةً واحدة. والشعارُ منها
          شعارُ المنصّة في تبويب «الهويّة» — ولا يُضبط هنا.
          <br />
          <b className="text-paper">وشاشةُ النظام نفسها لا تُضبط من هنا</b>: تُعرض قبل أن
          يعمل أيُّ كودٍ في التطبيق، فهي مخبوزةٌ في ملفّه ولا تتبدّل إلّا بنسخةٍ جديدة
          في المتجر.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="ob-tagline">الجملة تحت الشعار</Label>
          <Input
            id="ob-tagline"
            value={tagline}
            maxLength={80}
            onChange={(event) => setTagline(event.target.value)}
            placeholder="سوق تداول لوحات المركبات"
          />
          <p className="text-[11px] text-muted">اتركها فارغةً ليظهر الشعار وحده.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">شرائح التعريف</h3>
            <p className="mt-1 text-xs text-muted">
              تُعرض مرّةً واحدة لمن يفتح التطبيق أوّل مرّة على جهازه.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <span>{enabled ? 'تُعرض' : 'موقوفة'}</span>
          </label>
        </div>

        {slides.length === 0 && (
          <p className="rounded-xl border border-ink-600 bg-ink-900/50 p-4 text-center text-xs text-muted">
            لا شرائح — يفتح التطبيق على السوق مباشرةً.
          </p>
        )}

        {slides.map((slide, index) => (
          <div key={slide.id} className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-muted">الشريحة {index + 1}</span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`احذف الشريحة ${index + 1}`}
                onClick={() => setSlides((rows) => rows.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`ob-title-${slide.id}`}>العنوان</Label>
              <Input
                id={`ob-title-${slide.id}`}
                value={slide.title}
                maxLength={60}
                onChange={(event) => patch(index, { title: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`ob-body-${slide.id}`}>النصّ</Label>
              <textarea
                id={`ob-body-${slide.id}`}
                value={slide.body}
                maxLength={240}
                rows={3}
                onChange={(event) => patch(index, { body: event.target.value })}
                className="flex w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-paper focus-visible:border-gold-500 focus-visible:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`ob-icon-${slide.id}`}>الأيقونة</Label>
              <select
                id={`ob-icon-${slide.id}`}
                value={slide.icon}
                onChange={(event) => patch(index, { icon: event.target.value as OnboardingIcon })}
                className="flex h-10 w-full rounded-xl border border-ink-600 bg-ink-900 px-3 text-sm text-paper focus-visible:border-gold-500 focus-visible:outline-none"
              >
                {ONBOARDING_ICONS.map((icon) => (
                  <option key={icon} value={icon}>
                    {ICON_LABELS[icon]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {slides.length < MAX_ONBOARDING_SLIDES && (
          <Button variant="outline" onClick={add}>
            <Plus className="size-4" />
            أضف شريحة
          </Button>
        )}
      </section>

      <Button size="lg" onClick={save} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        احفظ المقدّمة
      </Button>
    </div>
  )
}
