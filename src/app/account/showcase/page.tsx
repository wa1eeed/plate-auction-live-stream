import { Store } from 'lucide-react'
import { ShowcaseForm } from './showcase-form'
import { ListingCard } from '@/components/market/listing-card'
import { EmptyState } from '@/components/market/plate-row'
import { getStore } from '@/lib/store'
import { requireUserId } from '@/lib/server/require-user'
import { appUrl } from '@/lib/config'
import { getMarketListings } from '@/lib/server/market-service'
import { arabicCount } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'معرض لوحاتي' }

/**
 * معرضه — مفصولٌ عن إدارة لوحاته.
 *
 * كان زرًّا في صفحة الإدارة، فيُقرأ إجراءً من إجراءاتها لا صفحةً قائمة بذاتها.
 * وهما شيئان مختلفان: تلك للمسوّدات والأسعار الاحتياطية وأزرار الإلغاء — لا
 * يراها أحد سواه — وهذه **صفحةٌ تُنشَر**: يُنسخ رابطها ويُرسل في مجموعة أو
 * يُوضع في وصف حساب.
 *
 * وفصلها يجعل ذلك بيّنًا: بابٌ في قائمة حسابه اسمه «معرض لوحاتي»، وأوّل ما
 * فيه الرابط وأزرار مشاركته.
 */
export default async function ShowcasePage() {
  const userId = await requireUserId()
  const user = await getStore().findUser(userId)
  if (!user) throw new Error('المستخدم غير موجود')

  const cards = (await getMarketListings(userId, userId)).filter(
    (card) => card.status === 'active',
  )
  const published = cards.length
  const serverTime = new Date().toISOString()

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-gold-500/12 text-gold-500">
            <Store className="size-5" />
          </span>
          معرض لوحاتي
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          صفحةٌ واحدة تجمع لوحاتك المعروضة، تشاركها في واتساب أو تويتر أو مع عملائك —
          فيرونها كلّها بلا أن ترسل رابط كل لوحة وحدها.
          {published > 0 && (
            <>
              {' '}
              فيها الآن{' '}
              <b className="text-paper">
                {arabicCount(published, {
                  one: 'لوحة واحدة',
                  two: 'لوحتان',
                  few: 'لوحات',
                  many: 'لوحة',
                })}
              </b>
              .
            </>
          )}
        </p>
      </header>

      <ShowcaseForm
        userId={user.id}
        handle={user.handle}
        usesHandle={user.showcaseUsesHandle}
        displayName={user.displayName}
        origin={appUrl()}
        preview={
          /*
           * ما يراه الزائر، ببطاقات السوق نفسها.
           *
           * صاحبها يشارك رابطًا لا يعرف ما فيه إلّا أن يفتحه — وبطاقةٌ ثانية
           * تُبنى لهذا الموضع تفترق عن بطاقة السوق أوّل ما يتغيّر حقل.
           */
          cards.length === 0 ? (
            <EmptyState
              title="لا لوحة معروضة في معرضك"
              hint="انشر لوحةً في السوق فتظهر هنا تلقائيًّا."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <ListingCard key={card.id} card={card} serverTime={serverTime} />
              ))}
            </div>
          )
        }
      />
    </div>
  )
}
