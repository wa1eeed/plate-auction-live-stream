import Link from 'next/link'
import { LogIn, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from './brand-mark'
import { getCurrentUser } from '@/lib/server/require-user'
import { getWalletView } from '@/lib/server/wallet-service'
import { HeaderNav } from './header-nav'
import { AccountMenu } from './account-menu'
import { MobileNav } from './mobile-nav'
import { NotificationBell } from './notification-bell'
import { SoundToggle } from './sound-toggle'

/**
 * ترويسة المنصّة.
 *
 * تُبنى على الخادم لتعرف حالة الجلسة والرصيد بلا وميض، وأجزاؤها التفاعلية
 * (القائمة المنسدلة ودُرج الجوال وإبراز الرابط النشط) مكوّنات عميل صغيرة —
 * فلا تتحوّل الترويسة كلّها إلى شجرة عميل من أجل قائمة.
 */
export async function SiteHeader({ active }: { active?: 'market' | 'account' }) {
  const user = await getCurrentUser()
  // الرصيد المتاح في الترويسة: المزايد يحتاج معرفته قبل الدخول لمزاد بعربون
  const wallet = user ? await getWalletView(user.id).catch(() => null) : null

  return (
    <header className="sticky top-0 z-40 border-b border-ink-600/70 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <BrandMark
          className="group transition-opacity hover:opacity-90"
          nameClassName="hidden text-[15px] sm:inline"
        />

        <HeaderNav active={active} />

        <div className="ms-auto flex items-center gap-2">
          {user ? (
            <>
              <Button asChild size="sm" className="hidden md:inline-flex">
                <Link href="/account/listings/new">
                  <Plus className="size-4" />
                  أضف لوحة
                </Link>
              </Button>
              <SoundToggle className="hidden sm:flex" />
              <NotificationBell userId={user.id} />
              <AccountMenu
                name={user.displayName}
                available={wallet?.available ?? null}
                held={wallet?.held ?? 0}
              />
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost" className="hidden sm:inline-flex">
                <Link href="/login">
                  <LogIn className="size-4" />
                  دخول
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">
                  <span className="hidden sm:inline">حساب جديد</span>
                  <span className="sm:hidden">ابدأ</span>
                </Link>
              </Button>
            </>
          )}

          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  )
}
