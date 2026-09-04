'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SOCIAL_LABELS,
  SOCIAL_PLATFORMS,
  type SocialPlatform,
  type User,
} from '@/lib/domain/types'

type FormValues = {
  displayName: string
  phone: string
  city: string
  social: Record<SocialPlatform, string>
  payout: { bankName: string; iban: string; accountName: string }
}

export function SettingsForm({ user }: { user: User }) {
  const router = useRouter()
  const form = useForm<FormValues>({
    defaultValues: {
      displayName: user.displayName,
      phone: user.phone ?? '',
      city: user.city ?? '',
      social: {
        tiktok: user.social.tiktok ?? '',
        snapchat: user.social.snapchat ?? '',
        instagram: user.social.instagram ?? '',
      },
      payout: {
        bankName: user.payout.bankName,
        iban: user.payout.iban,
        accountName: user.payout.accountName,
      },
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data?.error?.message ?? 'تعذّر حفظ البيانات')
        return
      }
      toast.success('حُفظت بياناتك')
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    }
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <div className="space-y-1.5">
        <Label htmlFor="displayName">الاسم الظاهر</Label>
        <Input id="displayName" {...form.register('displayName')} />
        <p className="text-xs text-muted">يظهر للعامة مُخفى جزئيًا في كشف المزايدات.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">رقم الجوال</Label>
        <Input id="phone" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" {...form.register('phone')} />
        <p className="text-xs text-muted">لا يظهر للعامة — للتواصل عند إتمام الصفقة فقط.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="city">المدينة</Label>
        <Input id="city" placeholder="الرياض" {...form.register('city')} />
      </div>

      <div className="space-y-1.5">
        <Label>البريد الإلكتروني</Label>
        <Input dir="ltr" value={user.email} readOnly disabled />
      </div>

      <fieldset className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/50 p-4">
        <legend className="px-1 text-sm font-bold">حسابات التواصل (اختيارية)</legend>
        <p className="text-xs leading-relaxed text-muted">
          نستفيد منها عند بثّ المزادات على منصّات التواصل، وعند نسبة اللوحة إلى صاحبها في
          البثّ. اكتب اسم الحساب أو الصقه كرابط — كلاهما يُقبل.
        </p>
        {SOCIAL_PLATFORMS.map((platform) => (
          <div key={platform} className="space-y-1.5">
            <Label htmlFor={`social-${platform}`}>{SOCIAL_LABELS[platform]}</Label>
            <Input
              id={`social-${platform}`}
              dir="ltr"
              autoComplete="off"
              placeholder="@username"
              {...form.register(`social.${platform}` as const)}
            />
          </div>
        ))}
      </fieldset>

      {/*
        * حساب الإيداع — إليه يخرج مالك من المنصّة.
        *
        * موضعه هنا لا في المحفظة: المحفظة تعرض رصيدًا، وهذا **بيان هوية
        * مصرفية** يُملأ مرّة ويُراجَع نادرًا — وشقيقه في الصفحة سطرُ الجوال لا
        * جدول الحركات.
        */}
      <fieldset className="space-y-3 rounded-xl border border-ink-600 bg-ink-900/50 p-4">
        <legend className="px-1 text-sm font-bold">حساب الإيداع</legend>
        <p className="text-xs leading-relaxed text-muted">
          إليه تُحوَّل عوائد بيعك وما يعود إليك من صفقات. اتركه فارغًا ليبقى مالك في محفظتك، أو
          أكمله كاملًا — فالمنصّة لا تحوّل إلى حساب ناقص البيانات.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="payout-bank">البنك</Label>
          <Input id="payout-bank" placeholder="مصرف الراجحي" {...form.register('payout.bankName')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payout-iban">رقم الآيبان</Label>
          <Input
            id="payout-iban"
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder="SA00 0000 0000 0000 0000 0000"
            {...form.register('payout.iban')}
          />
          <p className="text-xs text-muted">
            أربع وعشرون خانة تبدأ بـSA. يُدقَّق عند الحفظ فلا تُكتشف الغلطة عند فشل الحوالة.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payout-name">اسم صاحب الحساب</Label>
          <Input id="payout-name" placeholder="كما هو في البنك" {...form.register('payout.accountName')} />
        </div>
      </fieldset>

      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Save className="size-4" />
        )}
        حفظ
      </Button>
    </form>
  )
}
