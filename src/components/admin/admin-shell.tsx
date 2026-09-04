import Link from 'next/link'
import { ExternalLink, ShieldCheck } from 'lucide-react'
import { SkipLink } from '@/components/layout/skip-link'
import { AdminNav, AdminNavDrawer, type AdminNavBadges } from './admin-nav'
import { AdminSignOut } from './admin-sign-out'

/**
 * غلاف لوحة الإدارة.
 *
 * هويّة بصرية مميّزة عن السوق عمدًا (شريط داكن وشارة صلاحية): من يعمل في
 * الحسابين معًا يجب أن يعرف من أول نظرة أيّهما أمامه، فلا ينفّذ إجراءً إداريًا
 * وهو يظنّ نفسه مستخدمًا عاديًا.
 */
export function AdminShell({
  adminName,
  badges,
  children,
}: {
  adminName: string
  badges?: AdminNavBadges
  children: React.ReactNode
}) {
  return (
    <div data-theme="light" className="relative flex min-h-dvh flex-col bg-ink-950 text-paper">
      <SkipLink />
      <header className="sticky top-0 z-40 border-b border-ink-600 bg-[#0e1420] text-white">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
          {/* الأقسام أوّل ما تُطاله الإبهام على الجوال — وتختفي حيث يظهر العمود */}
          <AdminNavDrawer badges={badges} />

          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-extrabold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-gold-500 text-ink-950">
              <ShieldCheck className="size-4" />
            </span>
            <span className="hidden sm:inline">لوحة الإدارة</span>
          </Link>

          <span className="hidden rounded-full border border-gold-600/50 bg-gold-500/15 px-2.5 py-0.5 text-[11px] font-bold text-gold-400 min-[420px]:inline">
            صلاحيات إدارية
          </span>

          <div className="ms-auto flex items-center gap-2">
            {/* نافذة جديدة: الأدمن يفحص السوق ثم يعود إلى لوحته بلا فقد سياق */}
            <Link
              href="/market"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              عرض السوق
              <ExternalLink className="size-3.5" />
            </Link>
            <span className="hidden text-xs text-white/60 md:inline">{adminName}</span>
            <AdminSignOut />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <AdminNav badges={badges} />
          <main id="main" className="min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
