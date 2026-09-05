'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { SOCIAL_LABELS, SOCIAL_PLATFORMS } from '@/lib/domain/types'
import { toast } from 'sonner'
import { Loader2, LogIn, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * مخطط واحد للنموذجين: الحقول الإضافية مطلوبة في التسجيل فقط.
 * `mode` جزء من القيم حتى لا يفشل التحقق بصمت على حقل مخفي.
 */
const schema = z
  .object({
    mode: z.enum(['login', 'register']),
    email: z.string().trim().email('البريد الإلكتروني غير صحيح'),
    password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
    displayName: z.string().trim().max(40, 'الاسم طويل جدًا').optional(),
    phone: z.string().trim().optional(),
    tiktok: z.string().trim().optional(),
    snapchat: z.string().trim().optional(),
    instagram: z.string().trim().optional(),
    acceptedTerms: z.boolean().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.mode !== 'register') return
    if ((values.displayName ?? '').trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['displayName'], message: 'أدخل اسمك' })
    }
    if (values.phone && !/^(?:\+?966|0)?5\d{8}$/.test(values.phone.replace(/[\s-]/g, ''))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'أدخل رقم جوال سعودي صحيح يبدأ بـ 05',
      })
    }
    if (!values.acceptedTerms) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceptedTerms'],
        message: 'يجب الموافقة على شروط الاستخدام',
      })
    }
  })

type FormValues = z.infer<typeof schema>

export function AuthForm({
  mode,
  nextUrl,
  demo,
}: {
  mode: 'login' | 'register'
  nextUrl: string
  demo: { email: string; password: string } | null
}) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode,
      email: demo?.email ?? '',
      password: demo?.password ?? '',
      displayName: '',
      phone: '',
      acceptedTerms: false,
    },
  })

  const onSubmit = form.handleSubmit(
    async (values) => {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const payload =
        mode === 'login'
          ? { email: values.email, password: values.password }
          : {
              email: values.email,
              password: values.password,
              displayName: values.displayName,
              phone: values.phone || '',
              social: {
                tiktok: values.tiktok || null,
                snapchat: values.snapchat || null,
                instagram: values.instagram || null,
              },
              acceptedTerms: true,
            }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await response.json()
        if (!response.ok) {
          toast.error(data?.error?.message ?? 'تعذّر إتمام العملية')
          return
        }
        toast.success('أهلًا بك')
        router.push(nextUrl)
        router.refresh()
      } catch {
        toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
      }
    },
    // شبكة أمان: لا يفشل الإرسال بصمت أبدًا
    (errors) => {
      const first = Object.values(errors)[0]
      toast.error(first?.message?.toString() ?? 'تحقّق من الحقول')
    },
  )

  return (
    /*
     * `method="post"` وإن كان الإرسال بجافاسكربت.
     *
     * النموذج بلا `method` يرتدّ عند تعطّل السكربت إلى **GET**، فتُكتب كلمة
     * المرور في شريط العنوان وسجلّ التصفّح وترويسة `Referer`. رُصد حيًّا:
     * فشل تحميل الحزمة مرّة فصار الرابط `?email=…&password=…`.
     */
    <form
      method="post"
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-ink-600 bg-ink-800 p-6"
    >
      {mode === 'register' && (
        <div className="space-y-1.5">
          <Label htmlFor="displayName">الاسم</Label>
          <Input id="displayName" autoComplete="name" {...form.register('displayName')} />
          {form.formState.errors.displayName && (
            <p className="text-xs text-danger">{form.formState.errors.displayName.message}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input id="email" type="email" dir="ltr" autoComplete="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">كلمة المرور</Label>
        <Input
          id="password"
          type="password"
          dir="ltr"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-xs text-danger">{form.formState.errors.password.message}</p>
        )}
      </div>

      {mode === 'register' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="phone">رقم الجوال (اختياري)</Label>
            <Input id="phone" dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" {...form.register('phone')} />
            {form.formState.errors.phone && (
              <p className="text-xs text-danger">{form.formState.errors.phone.message}</p>
            )}
            <p className="text-xs text-muted">لا يظهر رقمك للعامة — يُستخدم للتواصل عند إتمام صفقة.</p>
          </div>

          {/* اختيارية بالكامل: تُستعمل عند بثّ المزادات على منصّات التواصل */}
          <details className="rounded-xl border border-ink-600 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              حسابات التواصل (اختيارية)
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              نستفيد منها عند بثّ المزادات على تيك توك وسناب شات وإنستقرام.
            </p>
            <div className="mt-3 space-y-3">
              {SOCIAL_PLATFORMS.map((platform) => (
                <div key={platform} className="space-y-1.5">
                  <Label htmlFor={`social-${platform}`}>{SOCIAL_LABELS[platform]}</Label>
                  <Input
                    id={`social-${platform}`}
                    dir="ltr"
                    autoComplete="off"
                    placeholder="@username"
                    {...form.register(platform)}
                  />
                </div>
              ))}
            </div>
          </details>

          <label className="flex items-start gap-3 rounded-xl border border-ink-600 p-3 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[#a97f22]" {...form.register('acceptedTerms')} />
            <span className="text-muted">
              أوافق على شروط الاستخدام، وأقرّ بأن المزايدة وقبول العروض التزام بيعي.
            </span>
          </label>
          {form.formState.errors.acceptedTerms && (
            <p className="text-xs text-danger">{form.formState.errors.acceptedTerms.message}</p>
          )}
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === 'login' ? (
          <LogIn className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
      </Button>

      {demo && (
        <p className="rounded-lg border border-gold-600/40 bg-gold-500/10 p-3 text-xs text-gold-500">
          وضع Demo: الحقول معبّأة مسبقًا بحساب تجريبي.
        </p>
      )}
    </form>
  )
}
