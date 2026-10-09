'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Apple,
  ArrowUpFromLine,
  CloudOff,
  ExternalLink,
  Loader2,
  Smartphone,
  Store,
  Trash2,
  UploadCloud,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/utils'
import type { AppPlatform, AppReleaseChannel } from '@/lib/domain/types'
import type { PlatformReleaseView, ReleaseSource, ReleaseView } from '@/lib/server/app-release-service'

/**
 * **الإصدارُ المنشور — جوابُ سؤالٍ يُسأل قبل كلّ نشر.**
 *
 * «أحتاج بناءً جديدًا؟» سؤالٌ يُعاد كلّ مرّة، وجوابُه رقمان: ما عند الناس
 * وما عند المختبِرين. وكانا في لوحتَي أبل وجوجل — لوحتان تُفتحان وتُقارنان
 * ويُنسى أيُّهما كان.
 *
 * **ولكلّ رقمٍ مصدرُه مكتوبٌ بجانبه.** فما يُقرأ من المتجر حقيقةٌ، وما
 * سُجّل عند الرفع خبرٌ عن ماضٍ قد يكون شاخ، وما أُثبت بيدٍ ذاكرةُ إنسان.
 * وجمعُها في خطٍّ واحدٍ بلا تمييزٍ يجعل الثلاثةَ في منزلةٍ واحدة — فيُطمأنّ
 * إلى ما لم يُنشر.
 */

const PLATFORM_META: Record<AppPlatform, { label: string; icon: typeof Apple; console: string; consoleLabel: string }> = {
  ios: {
    label: 'iOS',
    icon: Apple,
    console: 'https://appstoreconnect.apple.com/apps',
    consoleLabel: 'App Store Connect',
  },
  android: {
    label: 'أندرويد',
    icon: Smartphone,
    console: 'https://play.google.com/console',
    consoleLabel: 'Play Console',
  },
}

const CHANNEL_META: Record<
  AppReleaseChannel,
  { label: string; hint: Record<AppPlatform, string> }
> = {
  production: {
    label: 'الإنتاج',
    hint: { ios: 'ما يُنزَّل من App Store', android: 'ما يُنزَّل من Google Play' },
  },
  testing: {
    label: 'الاختبار',
    hint: { ios: 'TestFlight', android: 'المسار الداخليّ في Play' },
  },
}

const SOURCE_META: Record<ReleaseSource, { label: string; icon: typeof Store; variant: 'success' | 'gold' | 'muted' }> =
  {
    store: { label: 'من المتجر', icon: Store, variant: 'success' },
    upload: { label: 'من آخر رفعة', icon: UploadCloud, variant: 'gold' },
    manual: { label: 'أُثبت في اللوحة', icon: UserCheck, variant: 'muted' },
  }

/** لحظةُ القراءة من المتجر لا لحظةُ النشر — فيُقال أيُّهما في كلّ صفٍّ. */
const DATE_LABEL: Record<ReleaseSource, string> = {
  store: 'تاريخُ النشر',
  upload: 'وقتُ الرفع',
  manual: 'تاريخُ الإثبات',
}

export function AppReleasesPanel({ views }: { views: PlatformReleaseView[] }) {
  return (
    <section className="space-y-4">
      {/*
       * **وأوّلُ ما يُقال: هذه الأرقامُ ليست ما يرى المستخدمُ من الواجهة.**
       *
       * فالغلافُ يحمّل الموقعَ الحيّ، فتصحيحُ شاشةٍ أو إضافةُ صفحةٍ تصل
       * الأجهزةَ بنشر الويب وحده. ولا يُبنى تطبيقٌ إلّا لما يُخبز في الحزمة:
       * الأيقونة، وشاشة الإقلاع، وطبقاتُ النظام، وعنوانُ الموقع نفسه.
       *
       * وبلا هذه الفقرة يُقرأ «الإصدار 1.0.6» كأنّه نسخةُ المنصّة — فيُنتظر
       * مراجعةُ متجرٍ لتصحيحٍ وصل قبل ساعة.
       */}
      <p className="rounded-2xl border border-ink-600 bg-ink-800/60 p-4 text-xs leading-relaxed text-muted">
        هذه أرقامُ <b className="text-paper">حزمة التطبيق</b> في المتجرين. وما يُصحَّح في
        الواجهة أو يُضاف من صفحاتٍ يصل الأجهزةَ <b className="text-paper">بنشر الموقع وحده</b>،
        فالتطبيقُ يحمّل المنصّةَ الحيّة. ولا يلزم بناءٌ جديد إلّا لما يُخبز في الحزمة:
        الأيقونة، وشاشة الإقلاع، وعنوانُ الموقع، وإضافاتُ النظام.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {views.map((view) => (
          <PlatformCard key={view.platform} view={view} />
        ))}
      </div>
    </section>
  )
}

function PlatformCard({ view }: { view: PlatformReleaseView }) {
  const meta = PLATFORM_META[view.platform]
  const Icon = meta.icon

  return (
    <article className="space-y-3 rounded-2xl border border-ink-600 bg-ink-800 p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Icon className="size-4 text-gold-400" aria-hidden />
          {meta.label}
        </h3>
        <a
          href={meta.console}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted hover:text-paper"
        >
          {meta.consoleLabel}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </header>

      {view.storeUnreachable && (
        <p className="flex items-start gap-2 rounded-xl border border-ink-600 bg-ink-900/60 p-3 text-[11px] leading-relaxed text-muted">
          <CloudOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            تعذّر سؤالُ المتجر الآن — فما يُعرض من سجلّ المنصّة. وتُعاد المحاولة تلقائيًّا.
          </span>
        </p>
      )}

      <ChannelRow
        platform={view.platform}
        channel="production"
        release={view.production}
        promote={view.awaitingPromotion ? view.testing : null}
      />
      <ChannelRow platform={view.platform} channel="testing" release={view.testing} promote={null} />

      {view.awaitingPromotion && view.testing && (
        <p className="text-[11px] leading-relaxed text-gold-400">
          النسخةُ {view.testing.version} عند المختبِرين ولم تصل الإنتاج بعد.
        </p>
      )}
    </article>
  )
}

function ChannelRow({
  platform,
  channel,
  release,
  promote,
}: {
  platform: AppPlatform
  channel: AppReleaseChannel
  release: ReleaseView | null
  /** نسخةُ الاختبار المرشَّحةُ للإثبات — أو `null` فلا زرّ */
  promote: ReleaseView | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const channelMeta = CHANNEL_META[channel]

  async function write(body: unknown, success: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/settings/app-releases', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
        toast.error(data?.error?.message ?? 'تعذّر الحفظ')
        return
      }
      toast.success(success)
      router.refresh()
    } catch {
      toast.error('تعذّر الاتصال — تحقّق من الشبكة وأعد المحاولة')
    } finally {
      setBusy(false)
    }
  }

  const source = release ? SOURCE_META[release.source] : null
  const SourceIcon = source?.icon

  return (
    <div
      data-release-row={`${platform}-${channel}`}
      className="rounded-xl border border-ink-600 bg-ink-900/50 p-3.5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-xs font-bold text-paper">
          {channelMeta.label}
          <span className="ms-1.5 font-normal text-muted">· {channelMeta.hint[platform]}</span>
        </span>
        {source && SourceIcon && (
          <Badge variant={source.variant} className="shrink-0">
            <SourceIcon className="size-3" aria-hidden />
            {source.label}
          </Badge>
        )}
      </div>

      {release ? (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <b data-release-version className="font-mono text-xl leading-none tabular-nums text-paper">
              {release.version}
            </b>
            {release.build && (
              <span className="font-mono text-[11px] text-muted">بناء {release.build}</span>
            )}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {DATE_LABEL[release.source]}: {formatTimestamp(release.at)}
            {release.commit && (
              <span className="ms-2 font-mono">· {release.commit.slice(0, 7)}</span>
            )}
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-muted">
          {channel === 'production' ? 'لم يُنشر بعد — أو لم يُسجَّل' : 'لم تُرفع نسخةُ اختبار بعد'}
        </p>
      )}

      {promote && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-3"
          disabled={busy}
          onClick={() =>
            void write(
              {
                platform,
                channel: 'production',
                release: { version: promote.version, build: promote.build },
              },
              `أُثبت نشرُ ${promote.version} للإنتاج`,
            )
          }
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUpFromLine className="size-4" />}
          أثبِتُ نشرَ {promote.version} للإنتاج
        </Button>
      )}

      {release?.source === 'manual' && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-2"
          disabled={busy}
          onClick={() => void write({ platform, channel, release: null }, 'مُحي السجلّ')}
        >
          <Trash2 className="size-4" />
          امحُ ما أُثبت
        </Button>
      )}
    </div>
  )
}
