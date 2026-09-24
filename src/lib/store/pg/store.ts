import { and, asc, desc, eq, getTableColumns, gt, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm'
import {
  assertBidIsValid,
  assertCanBuyNow,
  computeExtension,
  findHighestBid,
} from '@/lib/domain/auction'
import { buildEntry, type NewLedgerEntry } from '@/lib/domain/wallet'
import { buildReference, referenceYear, type ReferenceKind } from '@/lib/domain/reference'
import { newId } from '@/lib/server/crypto'
import type {
  AdminAccount,
  Banner,
  Story,
  AuctionSettings,
  AuditLog,
  Bid,
  Deposit,
  Disbursement,
  LedgerEntry,
  Listing,
  ListingEvent,
  ListingEventType,
  Notification,
  Offer,
  Order,
  OrderStatus,
  Payment,
  PlatformEntry,
  TaxInvoice,
  UserDevice,
  Wallet,
  BrandSettings,
  CommissionSettings,
  FaqItem,
  MobileSettings,
  PageSettings,
  PaymentSettings,
  SaleType,
  TaxSettings,
  User,
} from '@/lib/domain/types'
import { emptyDatabase } from '../memory-store'
import type {
  AuctionStore,
  AdminRecord,
  BuyNowCommand,
  ListingQuery,
  NewDeposit,
  NewDisbursement,
  NewBanner,
  NewFaqItem,
  NewStory,
  NewListing,
  NewNotification,
  NewOffer,
  NewOrder,
  NewPayment,
  NewPlatformEntry,
  NewTaxInvoice,
  NewUserDevice,
  PlaceBidCommand,
  PlaceBidOutcome,
  UserAccount,
} from '../types'
import { getDb, withTransaction, type Database } from './client'
import * as t from './schema'

/**
 * تنفيذ `AuctionStore` على PostgreSQL.
 *
 * والمبدأ الحاكم: **ما كان يحرسه قفلُ الذاكرة تحرسه المعاملة والقاعدة**.
 * `KeyedMutex` كان يكفي حين تكون العملية واحدة؛ وقاعدةٌ قد يخاطبها خادمان
 * تحتاج الحارس فيها هي — `FOR UPDATE` داخل معاملة، وفرادةً على الأعمدة.
 *
 * والدوالّ تُنقل مجموعةً مجموعة، وكلُّ مجموعةٍ يحرسها اختبارٌ على قاعدةٍ
 * حقيقية. وما لم يُنقل بعدُ يرمي صراحةً — فلا يُظنّ عاملًا وهو ليس كذلك.
 */

/* ------------------------------------------------------------ أدواتٌ عامّة */

/**
 * افتراضيّات الإعدادات تُقرأ من البذرة نفسها.
 *
 * فلا يُكتب الافتراضيّ مرّتين — مرّةً في الذاكرة ومرّةً هنا — فيفترقان بعد
 * حقلٍ يُضاف في أحدهما. وهي قراءةٌ واحدة عند تحميل الوحدة لا في كلّ طلب.
 */
const DEFAULTS = emptyDatabase()

type SettingsKey =
  | 'brandSettings'
  | 'pageSettings'
  | 'auctionSettings'
  | 'commissionSettings'
  | 'paymentSettings'
  | 'taxSettings'
  | 'mobileSettings'

export class PostgresStore implements AuctionStore {
  readonly kind = 'postgres' as const

  private get db(): Database {
    return getDb()
  }

  /* ------------------------------------------------ الأرقام المرجعية */

  /**
   * عدّادٌ في القاعدة لا في الذاكرة.
   *
   * `ON CONFLICT … DO UPDATE` يقرأ ويزيد ويُعيد في عبارةٍ واحدة — وهي ذرّيةٌ
   * في بوستجرس بطبيعتها، فلا يأخذ طلبان الرقم نفسه ولو وصلا في اللحظة
   * ذاتها. وهو ما كان يحرسه القفل في تنفيذ الذاكرة.
   */
  async nextReference(kind: ReferenceKind, at: number | string = Date.now()): Promise<string> {
    const year = referenceYear(at)
    const [row] = await this.db
      .insert(t.sequences)
      .values({ kind, year, value: 1 })
      .onConflictDoUpdate({
        target: [t.sequences.kind, t.sequences.year],
        set: { value: sql`${t.sequences.value} + 1` },
      })
      .returning({ value: t.sequences.value })
    return buildReference(kind, year, row.value)
  }

  /* ------------------------------------------------------- الإعدادات */

  /**
   * شريحةُ إعداداتٍ واحدة — المحفوظ فوق الافتراضيّ.
   *
   * والترتيب مقصود كما في ملفّ الإعدادات: الافتراضيّ يملأ كلّ حقل — ومنه ما
   * أُضيف في نسخةٍ أحدث — ثمّ يحلّ المحفوظ محلّ ما حُفظ منه وحده. ولو قُلبا
   * لخرجت الحقول الجديدة `undefined` وسقطت الصفحات التي تقرؤها.
   */
  private async readSettings<T>(key: SettingsKey): Promise<T> {
    const [row] = await this.db.select().from(t.settings).where(eq(t.settings.key, key)).limit(1)
    const fallback = DEFAULTS[key] as T
    if (!row) return structuredClone(fallback)
    return { ...structuredClone(fallback), ...(row.value as object) } as T
  }

  private async writeSettings<T extends object>(
    key: SettingsKey,
    patch: Partial<T>,
    adminId?: string | null,
  ): Promise<T> {
    return withTransaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(t.settings)
        .where(eq(t.settings.key, key))
        // قفلُ الصفّ: تعديلان متزامنان لا يُلغي أحدهما الآخر
        .for('update')
        .limit(1)

      const current = {
        ...structuredClone(DEFAULTS[key] as T),
        ...((row?.value as object) ?? {}),
      } as T
      const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
        ...(adminId !== undefined ? { updatedByAdminId: adminId } : {}),
      } as T

      await tx
        .insert(t.settings)
        .values({ key, value: next, updatedAt: new Date().toISOString() })
        .onConflictDoUpdate({
          target: t.settings.key,
          set: { value: next, updatedAt: new Date().toISOString() },
        })
      return next
    })
  }

  getBrandSettings = () => this.readSettings<BrandSettings>('brandSettings')
  updateBrandSettings = (patch: Partial<BrandSettings>) =>
    this.writeSettings<BrandSettings>('brandSettings', patch)

  getPageSettings = () => this.readSettings<PageSettings>('pageSettings')
  updatePageSettings = (patch: Partial<PageSettings>) =>
    this.writeSettings<PageSettings>('pageSettings', patch)

  getAuctionSettings = () => this.readSettings<AuctionSettings>('auctionSettings')
  updateAuctionSettings = (patch: Partial<AuctionSettings>) =>
    this.writeSettings<AuctionSettings>('auctionSettings', patch)

  getCommissionSettings = () => this.readSettings<CommissionSettings>('commissionSettings')
  updateCommissionSettings = (patch: Partial<CommissionSettings>) =>
    this.writeSettings<CommissionSettings>('commissionSettings', patch)

  getPaymentSettings = () => this.readSettings<PaymentSettings>('paymentSettings')
  updatePaymentSettings = (patch: Partial<PaymentSettings>) =>
    this.writeSettings<PaymentSettings>('paymentSettings', patch)

  getTaxSettings = () => this.readSettings<TaxSettings>('taxSettings')
  updateTaxSettings = (patch: Partial<TaxSettings>) =>
    this.writeSettings<TaxSettings>('taxSettings', patch)

  getMobileSettings = () => this.readSettings<MobileSettings>('mobileSettings')
  updateMobileSettings = (
    patch: Partial<Omit<MobileSettings, 'updatedAt' | 'updatedByAdminId'>>,
    adminId: string | null,
  ) => this.writeSettings<MobileSettings>('mobileSettings', patch, adminId)

  /* ------------------------------ واجهة الرئيسية: ستوريز وبنرات */

  /*
   * الترشيح بنافذة الظهور **في الاستعلام** لا بعده.
   *
   * وهو ما يمنع بنرًا منتهيًا أن يغادر الخادم أصلًا: حمولةُ الصفحة لا تحمل
   * إلّا ما يُعرض، فلا يقع على المتصفّح إخفاءٌ يُنسى ولا يبقى رابطُ إعلانٍ
   * مدفوعٍ انتهى في مصدر الصفحة لمن قرأه.
   */
  private liveWhere(table: typeof t.banners | typeof t.stories, liveAt: number | undefined) {
    if (liveAt === undefined) return undefined
    const at = new Date(liveAt).toISOString()
    return and(
      eq(table.published, true),
      or(isNull(table.startsAt), lte(table.startsAt, at)),
      or(isNull(table.endsAt), gt(table.endsAt, at)),
    )
  }

  async listBanners(query: { liveAt?: number } = {}): Promise<Banner[]> {
    const rows = await this.db
      .select()
      .from(t.banners)
      .where(this.liveWhere(t.banners, query.liveAt))
      .orderBy(asc(t.banners.sortOrder), desc(t.banners.createdAt), asc(t.banners.id))
    return rows.map(bannerFromRow)
  }

  async getBanner(id: string): Promise<Banner | null> {
    const [row] = await this.db.select().from(t.banners).where(eq(t.banners.id, id)).limit(1)
    return row ? bannerFromRow(row) : null
  }

  async createBanner(input: NewBanner): Promise<Banner> {
    const now = new Date().toISOString()
    const [row] = await this.db
      .insert(t.banners)
      .values({ ...input, id: newId('bnr'), createdAt: now, updatedAt: now })
      .returning()
    return bannerFromRow(row)
  }

  async updateBanner(id: string, patch: Partial<Banner>): Promise<Banner> {
    const [row] = await this.db
      .update(t.banners)
      .set({ ...patch, id: undefined, updatedAt: new Date().toISOString() })
      .where(eq(t.banners.id, id))
      .returning()
    if (!row) throw new Error('البنر غير موجود')
    return bannerFromRow(row)
  }

  async deleteBanner(id: string): Promise<void> {
    await this.db.delete(t.banners).where(eq(t.banners.id, id))
  }

  async listStories(query: { liveAt?: number } = {}): Promise<Story[]> {
    const rows = await this.db
      .select()
      .from(t.stories)
      .where(this.liveWhere(t.stories, query.liveAt))
      .orderBy(asc(t.stories.sortOrder), desc(t.stories.createdAt), asc(t.stories.id))
    return rows.map(storyFromRow)
  }

  async getStory(id: string): Promise<Story | null> {
    const [row] = await this.db.select().from(t.stories).where(eq(t.stories.id, id)).limit(1)
    return row ? storyFromRow(row) : null
  }

  async createStory(input: NewStory): Promise<Story> {
    const now = new Date().toISOString()
    const [row] = await this.db
      .insert(t.stories)
      .values({ ...input, id: newId('sty'), createdAt: now, updatedAt: now })
      .returning()
    return storyFromRow(row)
  }

  async updateStory(id: string, patch: Partial<Story>): Promise<Story> {
    const [row] = await this.db
      .update(t.stories)
      .set({ ...patch, id: undefined, updatedAt: new Date().toISOString() })
      .where(eq(t.stories.id, id))
      .returning()
    if (!row) throw new Error('الستوري غير موجود')
    return storyFromRow(row)
  }

  async deleteStory(id: string): Promise<void> {
    await this.db.delete(t.stories).where(eq(t.stories.id, id))
  }

  /* -------------------------------------------------- الأسئلة الشائعة */

  async listFaq(query: { publishedOnly?: boolean; saleType?: SaleType } = {}): Promise<FaqItem[]> {
    const rows = await this.db
      .select()
      .from(t.faq)
      .where(query.publishedOnly ? eq(t.faq.published, true) : undefined)
      .orderBy(asc(t.faq.sortOrder), asc(t.faq.createdAt))

    const items = rows.map(faqFromRow)
    if (!query.saleType) return items
    /*
     * الترشيح بطريقة البيع في الذاكرة لا في الاستعلام.
     *
     * الرايات مصفوفةٌ في `jsonb`، والبحث فيها بـ`@>` يقتضي فهرسًا خاصًّا
     * لجدولٍ فيه عشرات الأسطر. والقراءة كاملةً أرخص من الفهرس هنا.
     */
    return items.filter((item) => item.showOnSaleTypes.includes(query.saleType!))
  }

  async getFaq(id: string): Promise<FaqItem | null> {
    const [row] = await this.db.select().from(t.faq).where(eq(t.faq.id, id)).limit(1)
    return row ? faqFromRow(row) : null
  }

  async createFaq(input: NewFaqItem): Promise<FaqItem> {
    const now = new Date().toISOString()
    const [row] = await this.db
      .insert(t.faq)
      .values({ ...input, id: newId('faq'), createdAt: now, updatedAt: now })
      .returning()
    return faqFromRow(row)
  }

  async updateFaq(id: string, patch: Partial<FaqItem>): Promise<FaqItem> {
    const [row] = await this.db
      .update(t.faq)
      .set({ ...patch, id: undefined, updatedAt: new Date().toISOString() })
      .where(eq(t.faq.id, id))
      .returning()
    if (!row) throw new Error('السؤال غير موجود')
    return faqFromRow(row)
  }

  async deleteFaq(id: string): Promise<void> {
    await this.db.delete(t.faq).where(eq(t.faq.id, id))
  }

  /* ----------------------------------------------------- المستخدمون */

  async findUserByHandle(handle: string): Promise<User | null> {
    const normalized = handle.trim().toLowerCase()
    if (!normalized) return null
    const [row] = await this.db
      .select()
      .from(t.users)
      .where(eq(t.users.handle, normalized))
      .limit(1)
    return row ? userFromRow(row) : null
  }

  async findUserByEmail(email: string): Promise<UserAccount | null> {
    const normalized = email.trim().toLowerCase()
    const [row] = await this.db.select().from(t.users).where(eq(t.users.email, normalized)).limit(1)
    return row ? { ...userFromRow(row), passwordHash: row.passwordHash } : null
  }

  async findUser(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(t.users).where(eq(t.users.id, id)).limit(1)
    return row ? userFromRow(row) : null
  }

  async listUsers(): Promise<User[]> {
    const rows = await this.db.select().from(t.users).orderBy(asc(t.users.createdAt))
    return rows.map(userFromRow)
  }

  async createUser(input: {
    email: string
    passwordHash: string
    displayName: string
    phone?: string | null
    city?: string | null
    handle?: string | null
  }): Promise<User> {
    const email = input.email.trim().toLowerCase()
    const handle = input.handle?.trim().toLowerCase() || null

    return withTransaction(async (tx) => {
      /*
       * الرقم المرجعيّ والإدراج في معاملةٍ واحدة.
       *
       * فلو فشل الإدراج — ببريدٍ مكرّر مثلًا — تراجَع العدّاد معه، ولم تبقَ
       * فجوةٌ في تسلسل أرقام العضوية. والفجوة ليست عطبًا، لكنّها تُقرأ في
       * تدقيقٍ لاحق حسابًا محذوفًا فتُستجوَب بلا سبب.
       */
      const year = referenceYear(Date.now())
      const [seq] = await tx
        .insert(t.sequences)
        .values({ kind: 'user', year, value: 1 })
        .onConflictDoUpdate({
          target: [t.sequences.kind, t.sequences.year],
          set: { value: sql`${t.sequences.value} + 1` },
        })
        .returning({ value: t.sequences.value })

      const [row] = await tx
        .insert(t.users)
        .values({
          id: newId('usr'),
          reference: buildReference('user', year, seq.value),
          email,
          passwordHash: input.passwordHash,
          displayName: input.displayName.trim(),
          phone: input.phone?.trim() || null,
          city: input.city?.trim() || null,
          avatarUrl: null,
          social: { tiktok: null, snapchat: null, instagram: null },
          handle,
          showcaseUsesHandle: false,
          bankName: null,
          bankIban: null,
          bankAccountName: null,
          createdAt: new Date().toISOString(),
        })
        .returning()

      /* محفظةٌ مع الحساب: لا مستخدمَ بلا محفظة، فلا يُقرأ رصيدٌ غير موجود */
      await tx
        .insert(t.wallets)
        .values({ userId: row.id, balance: 0, held: 0, updatedAt: row.createdAt })
        .onConflictDoNothing()

      return userFromRow(row)
    })
  }

  async updateUser(id: string, patch: Partial<User>): Promise<User> {
    const [row] = await this.db
      .update(t.users)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.email !== undefined ? { email: patch.email.trim().toLowerCase() } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
        ...(patch.social !== undefined ? { social: patch.social } : {}),
        ...(patch.handle !== undefined
          ? { handle: patch.handle?.trim().toLowerCase() || null }
          : {}),
        ...(patch.showcaseUsesHandle !== undefined
          ? { showcaseUsesHandle: patch.showcaseUsesHandle }
          : {}),
        ...(patch.payout !== undefined
          ? {
              bankName: patch.payout.bankName || null,
              bankIban: patch.payout.iban || null,
              bankAccountName: patch.payout.accountName || null,
            }
          : {}),
        ...(patch.disabledAt !== undefined ? { disabledAt: patch.disabledAt } : {}),
        ...(patch.disabledReason !== undefined ? { disabledReason: patch.disabledReason } : {}),
      })
      .where(eq(t.users.id, id))
      .returning()
    if (!row) throw new Error('المستخدم غير موجود')
    return userFromRow(row)
  }

  /* --------------------------------------------------------- الإدارة */

  async findAdminByEmail(email: string): Promise<AdminRecord | null> {
    const normalized = email.trim().toLowerCase()
    const [row] = await this.db
      .select()
      .from(t.admins)
      .where(eq(t.admins.email, normalized))
      .limit(1)
    return row ? { ...adminFromRow(row), passwordHash: row.passwordHash } : null
  }

  async findAdmin(id: string): Promise<AdminAccount | null> {
    const [row] = await this.db.select().from(t.admins).where(eq(t.admins.id, id)).limit(1)
    return row ? adminFromRow(row) : null
  }

  async touchAdminLogin(id: string, at: string): Promise<void> {
    await this.db.update(t.admins).set({ lastLoginAt: at }).where(eq(t.admins.id, id))
  }

  /**
   * يضمن وجود حساب الإدارة كما تصفه البيئة.
   *
   * حساب الإدارة **لا يُهاجَر ولا يُنشأ من واجهة**: يأتي من متغيّرات النشر في
   * كلّ إقلاع كما كان في تنفيذ الذاكرة. فمن بدّل كلمته في البيئة بدّلها في
   * القاعدة، ولا يبقى في الجدول حسابٌ بكلمةٍ قديمة.
   */
  async ensureAdmin(input: {
    email: string
    passwordHash: string
    displayName: string
  }): Promise<void> {
    const email = input.email.trim().toLowerCase()
    await this.db
      .insert(t.admins)
      .values({
        id: newId('adm'),
        email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .onConflictDoUpdate({
        target: t.admins.email,
        set: { passwordHash: input.passwordHash, displayName: input.displayName },
      })
  }

  /* ------------------------------------------------------- الإعلانات */

  async listListings(query: ListingQuery = {}): Promise<Listing[]> {
    const where = [
      query.sellerId ? eq(t.listings.sellerId, query.sellerId) : undefined,
      query.status ? inArray(t.listings.status, query.status) : undefined,
      /*
       * المسودّات تُستثنى ما لم تُطلب صراحةً.
       *
       * وهي إعلانٌ لم يُنشر بعد: ظهورُها في السوق يكشف ما لم يُرِد صاحبه
       * عرضه. والاستثناء هنا لا في كلّ مستدعٍ — فلا يُنسى في أحدها.
       */
      query.includeDrafts || query.status ? undefined : ne(t.listings.status, 'draft'),
    ].filter(Boolean)

    const rows = await this.db
      .select()
      .from(t.listings)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.listings.createdAt))
    return rows.map(listingFromRow)
  }

  async getListing(id: string): Promise<Listing | null> {
    const [row] = await this.db.select().from(t.listings).where(eq(t.listings.id, id)).limit(1)
    return row ? listingFromRow(row) : null
  }

  async createListing(input: NewListing): Promise<Listing> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'listing')
      const now = new Date().toISOString()
      const [row] = await tx
        .insert(t.listings)
        .values({ ...listingToRow(input), id: newId('lst'), reference, createdAt: now, updatedAt: now })
        .returning()
      return listingFromRow(row)
    })
  }

  async updateListing(id: string, patch: Partial<Listing>): Promise<Listing> {
    const [row] = await this.db
      .update(t.listings)
      .set({ ...listingToRow(patch), updatedAt: new Date().toISOString() })
      .where(eq(t.listings.id, id))
      .returning()
    if (!row) throw new Error('الإعلان غير موجود')
    return listingFromRow(row)
  }

  async deleteListing(id: string): Promise<void> {
    await this.db.delete(t.listings).where(eq(t.listings.id, id))
  }

  async incrementViews(id: string): Promise<void> {
    /*
     * زيادةٌ في القاعدة لا قراءةٌ ثمّ كتابة.
     *
     * صفحةٌ يفتحها عشرةٌ معًا تُنتج عشر قراءاتٍ للرقم نفسه ثمّ عشر كتابات
     * بالقيمة نفسها — فتُحسب زيارةٌ واحدة. و`+ 1` في العبارة يعدّ العشر.
     */
    await this.db
      .update(t.listings)
      .set({ viewCount: sql`${t.listings.viewCount} + 1` })
      .where(eq(t.listings.id, id))
  }

  /* -------------------------------------------------------- المزايدات */

  async listBids(listingId: string): Promise<Bid[]> {
    const rows = await this.db
      .select()
      .from(t.bids)
      .where(eq(t.bids.listingId, listingId))
      .orderBy(desc(t.bids.serverSequence))
    return rows.map(bidFromRow)
  }

  async listBidsByBidder(bidderId: string): Promise<Bid[]> {
    const rows = await this.db
      .select()
      .from(t.bids)
      .where(eq(t.bids.bidderId, bidderId))
      .orderBy(desc(t.bids.serverSequence))
    return rows.map(bidFromRow)
  }

  async listAllBids(): Promise<Bid[]> {
    const rows = await this.db.select().from(t.bids).orderBy(desc(t.bids.serverSequence))
    return rows.map(bidFromRow)
  }

  async getBid(id: string): Promise<Bid | null> {
    const [row] = await this.db.select().from(t.bids).where(eq(t.bids.id, id)).limit(1)
    return row ? bidFromRow(row) : null
  }

  /**
   * مزايدةٌ ذرّية — الإعلان مقفولٌ حتى تنتهي.
   *
   * وهي أخطر عمليةٍ في المنصّة: تقرأ أعلى مزايدة، وتتحقّق، وتكتب، وتمدّد
   * الوقت. ولو جرت اثنتان معًا بلا قفلٍ لقرأتا الأعلى نفسه فقُبلتا معًا —
   * فيصير للوحةٍ واحدة أعلى مزايدتين.
   *
   * و`FOR UPDATE` على صفّ الإعلان يجعل الثانية تنتظر الأولى، ثمّ تقرأ ما
   * كتبته — وهو ما كان يفعله قفلُ الذاكرة بالضبط.
   */
  async placeBid(command: PlaceBidCommand): Promise<PlaceBidOutcome> {
    return withTransaction(async (tx) => {
      /* طلبٌ وصل مرّتين: يُعاد جوابُ الأولى ولا تُسجَّل ثانية */
      const [duplicate] = await tx
        .select()
        .from(t.bids)
        .where(
          and(
            eq(t.bids.bidderId, command.bidderId),
            eq(t.bids.clientRequestId, command.clientRequestId),
          ),
        )
        .limit(1)

      const [locked] = await tx
        .select()
        .from(t.listings)
        .where(eq(t.listings.id, command.listingId))
        .for('update')
        .limit(1)
      if (!locked) throw new Error('الإعلان غير موجود')

      if (duplicate) {
        return {
          bid: bidFromRow(duplicate),
          listing: listingFromRow(locked),
          extended: false,
          addedSeconds: 0,
          previousHighestAmount: null,
        }
      }

      const listing = listingFromRow(locked)
      const existing = (
        await tx.select().from(t.bids).where(eq(t.bids.listingId, listing.id))
      ).map(bidFromRow)
      const highest = findHighestBid(existing)

      assertBidIsValid({
        listing,
        nowMs: command.nowMs,
        amount: command.amount,
        highestAmount: highest?.amount ?? null,
        highestBidderId: highest?.bidderId ?? null,
        bidderId: command.bidderId,
        isCustomAmount: command.isCustomAmount,
      })

      const sequence = await nextCounter(tx, 'bid_sequence')
      const at = new Date(command.nowMs).toISOString()
      const [row] = await tx
        .insert(t.bids)
        .values({
          id: newId('bid'),
          listingId: listing.id,
          bidderId: command.bidderId,
          amount: command.amount,
          status: 'accepted',
          serverSequence: sequence,
          clientRequestId: command.clientRequestId,
          createdAt: at,
          cancelledAt: null,
          cancellationReason: null,
        })
        .returning()

      const extension = computeExtension(listing, command.nowMs)
      const [updated] = await tx
        .update(t.listings)
        .set({ highestBidId: row.id, endsAt: extension.endsAt, updatedAt: at })
        .where(eq(t.listings.id, listing.id))
        .returning()

      return {
        bid: bidFromRow(row),
        listing: listingFromRow(updated),
        extended: extension.extended,
        addedSeconds: extension.addedSeconds,
        previousHighestAmount: highest?.amount ?? null,
      }
    })
  }

  async cancelBid(input: {
    bidId: string
    reason?: string
    nowMs: number
  }): Promise<{ listing: Listing; cancelled: Bid }> {
    return withTransaction(async (tx) => {
      const [bidRow] = await tx.select().from(t.bids).where(eq(t.bids.id, input.bidId)).limit(1)
      if (!bidRow) throw new Error('المزايدة غير موجودة')

      const [locked] = await tx
        .select()
        .from(t.listings)
        .where(eq(t.listings.id, bidRow.listingId))
        .for('update')
        .limit(1)
      if (!locked) throw new Error('الإعلان غير موجود')

      const at = new Date(input.nowMs).toISOString()
      const [cancelled] = await tx
        .update(t.bids)
        .set({ status: 'cancelled', cancelledAt: at, cancellationReason: input.reason ?? null })
        .where(eq(t.bids.id, input.bidId))
        .returning()

      /*
       * أعلى مزايدةٍ تُعاد حسابها بعد الإلغاء.
       *
       * إلغاءُ الأعلى يُصعّد من بعده — ولو بقي `highestBidId` على الملغاة
       * لقُرئ السعر من مزايدةٍ سُحبت، ولبُني عليها إرساءٌ باطل.
       */
      const remaining = (
        await tx.select().from(t.bids).where(eq(t.bids.listingId, locked.id))
      ).map(bidFromRow)
      const highest = findHighestBid(remaining)

      const [listing] = await tx
        .update(t.listings)
        .set({ highestBidId: highest?.id ?? null, updatedAt: at })
        .where(eq(t.listings.id, locked.id))
        .returning()

      return { listing: listingFromRow(listing), cancelled: bidFromRow(cancelled) }
    })
  }

  /* ----------------------------------------------------------- السوم */

  async listOffers(query: {
    listingId?: string
    buyerId?: string
    sellerId?: string
  }): Promise<Offer[]> {
    if (query.sellerId) {
      /* سومُ إعلاناتي: يُقرأ بانضمامٍ على البائع لا بجلب كلّ شيء ثمّ ترشيحه */
      const rows = await this.db
        .select({ offer: t.offers })
        .from(t.offers)
        .innerJoin(t.listings, eq(t.offers.listingId, t.listings.id))
        .where(
          and(
            eq(t.listings.sellerId, query.sellerId),
            query.listingId ? eq(t.offers.listingId, query.listingId) : undefined,
            query.buyerId ? eq(t.offers.buyerId, query.buyerId) : undefined,
          ),
        )
        .orderBy(desc(t.offers.createdAt))
      return rows.map((row) => offerFromRow(row.offer))
    }

    const where = [
      query.listingId ? eq(t.offers.listingId, query.listingId) : undefined,
      query.buyerId ? eq(t.offers.buyerId, query.buyerId) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.offers)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.offers.createdAt))
    return rows.map(offerFromRow)
  }

  async getOffer(id: string): Promise<Offer | null> {
    const [row] = await this.db.select().from(t.offers).where(eq(t.offers.id, id)).limit(1)
    return row ? offerFromRow(row) : null
  }

  async createOffer(input: NewOffer): Promise<Offer> {
    const [row] = await this.db
      .insert(t.offers)
      .values({
        ...input,
        id: newId('off'),
        createdAt: new Date().toISOString(),
        respondedAt: null,
      })
      .returning()
    return offerFromRow(row)
  }

  async updateOffer(id: string, patch: Partial<Offer>): Promise<Offer> {
    const [row] = await this.db
      .update(t.offers)
      .set({ ...patch, id: undefined })
      .where(eq(t.offers.id, id))
      .returning()
    if (!row) throw new Error('العرض غير موجود')
    return offerFromRow(row)
  }

  /* --------------------------------------------------------- الصفقات */

  async listOrders(query: {
    buyerId?: string
    sellerId?: string
    listingId?: string
  }): Promise<Order[]> {
    const where = [
      query.buyerId ? eq(t.orders.buyerId, query.buyerId) : undefined,
      query.sellerId ? eq(t.orders.sellerId, query.sellerId) : undefined,
      query.listingId ? eq(t.orders.listingId, query.listingId) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.orders)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.orders.createdAt))
    return rows.map(orderFromRow)
  }

  async listAllOrders(): Promise<Order[]> {
    const rows = await this.db.select().from(t.orders).orderBy(desc(t.orders.createdAt))
    return rows.map(orderFromRow)
  }

  async getOrder(id: string): Promise<Order | null> {
    const [row] = await this.db.select().from(t.orders).where(eq(t.orders.id, id)).limit(1)
    return row ? orderFromRow(row) : null
  }

  async createOrder(input: NewOrder): Promise<Order> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'order')
      const [row] = await tx
        .insert(t.orders)
        .values({
          ...input,
          id: newId('ord'),
          reference,
          escrowAmount: 0,
          remindersSent: [],
          createdAt: new Date().toISOString(),
          completedAt: null,
        })
        .returning()
      return orderFromRow(row)
    })
  }

  async updateOrderStatus(id: string, status: OrderStatus, nowMs: number): Promise<Order> {
    const at = new Date(nowMs).toISOString()
    const [row] = await this.db
      .update(t.orders)
      .set({ status, ...(status === 'completed' ? { completedAt: at } : {}) })
      .where(eq(t.orders.id, id))
      .returning()
    if (!row) throw new Error('الصفقة غير موجودة')
    return orderFromRow(row)
  }

  async markOrderReminded(id: string, marker: string): Promise<void> {
    /*
     * العلامة تُضاف بلا تكرار — والتذكير يُرسل مرّةً واحدة.
     *
     * والقراءةُ ثمّ الكتابة تكفي هنا: التذكيرات يمسحها مؤقّتٌ واحد، ولا
     * يتسابق عليها طلبان.
     */
    const [row] = await this.db.select().from(t.orders).where(eq(t.orders.id, id)).limit(1)
    if (!row) return
    const markers = new Set((row.remindersSent as string[]) ?? [])
    if (markers.has(marker)) return
    markers.add(marker)
    await this.db
      .update(t.orders)
      .set({ remindersSent: [...markers] })
      .where(eq(t.orders.id, id))
  }

  async updateOrder(id: string, patch: Partial<Order>): Promise<Order> {
    const [row] = await this.db
      .update(t.orders)
      .set({ ...patch, id: undefined, reference: undefined })
      .where(eq(t.orders.id, id))
      .returning()
    if (!row) throw new Error('الصفقة غير موجودة')
    return orderFromRow(row)
  }

  /**
   * شراءٌ مباشر ذرّيّ — لا تُباع اللوحة مرّتين.
   *
   * الإعلان يُقفل، ثمّ يُتحقَّق أنّه ما زال معروضًا، ثمّ يُغلق وتُنشأ الصفقة
   * في المعاملة نفسها. فمشتريان يضغطان معًا: أحدهما ينتظر، ثمّ يقرأ اللوحة
   * مباعةً فيُردّ.
   */
  async buyNow(command: BuyNowCommand): Promise<{ listing: Listing; order: Order }> {
    return withTransaction(async (tx) => {
      const [duplicate] = await tx
        .select()
        .from(t.orders)
        .where(
          and(
            eq(t.orders.buyerId, command.buyerId),
            eq(t.orders.clientRequestId, command.clientRequestId),
          ),
        )
        .limit(1)

      const [locked] = await tx
        .select()
        .from(t.listings)
        .where(eq(t.listings.id, command.listingId))
        .for('update')
        .limit(1)
      if (!locked) throw new Error('الإعلان غير موجود')

      if (duplicate) {
        return { listing: listingFromRow(locked), order: orderFromRow(duplicate) }
      }

      const listing = listingFromRow(locked)
      assertCanBuyNow(listing, command.buyerId)

      const at = new Date(command.nowMs).toISOString()
      const reference = await nextReferenceIn(tx, 'order')
      const [orderRow] = await tx
        .insert(t.orders)
        .values({
          id: newId('ord'),
          reference,
          listingId: listing.id,
          buyerId: command.buyerId,
          sellerId: listing.sellerId,
          amount: listing.price,
          source: 'fixed',
          status: 'awaiting_settlement',
          paymentDueAt: new Date(
            command.nowMs + listing.paymentWindowHours * 3_600_000,
          ).toISOString(),
          depositId: null,
          escrowAmount: 0,
          remindersSent: [],
          clientRequestId: command.clientRequestId,
          createdAt: at,
          completedAt: null,
        })
        .returning()

      const [updated] = await tx
        .update(t.listings)
        .set({
          status: 'sold',
          soldToUserId: command.buyerId,
          soldAmount: listing.price,
          endedAt: at,
          updatedAt: at,
        })
        .where(eq(t.listings.id, listing.id))
        .returning()

      return { listing: listingFromRow(updated), order: orderFromRow(orderRow) }
    })
  }

  /* --------------------------------------------------------- المحفظة */

  async getWallet(userId: string): Promise<Wallet> {
    const [row] = await this.db.select().from(t.wallets).where(eq(t.wallets.userId, userId)).limit(1)
    if (row) return { userId: row.userId, balance: row.balance, held: row.held, updatedAt: row.updatedAt }
    /* محفظةٌ فارغة لمن لا محفظة له — القراءة لا تُنشئ صفًّا */
    return { userId, balance: 0, held: 0, updatedAt: new Date(0).toISOString() }
  }

  async listWallets(): Promise<Wallet[]> {
    const rows = await this.db.select().from(t.wallets)
    return rows.map((row) => ({
      userId: row.userId,
      balance: row.balance,
      held: row.held,
      updatedAt: row.updatedAt,
    }))
  }

  async listLedger(query: { userId?: string; limit?: number }): Promise<LedgerEntry[]> {
    const rows = await this.db
      .select()
      .from(t.ledger)
      .where(query.userId ? eq(t.ledger.userId, query.userId) : undefined)
      .orderBy(desc(t.ledger.createdAt))
      .limit(query.limit ?? 500)
    return rows.map(ledgerFromRow)
  }

  /**
   * حركة محفظةٍ ذرّية — وهي موضع المال الأخطر.
   *
   * تُقفل المحفظة، ثمّ يُحسب القيد على رصيدها المقروء تحت القفل، ثمّ يُكتبان
   * معًا. وبلا القفل يقرأ سحبان الرصيد نفسه فيمرّان معًا — ويخرج من المحفظة
   * ضعفُ ما فيها.
   */
  async postLedgerEntry(input: NewLedgerEntry): Promise<{ wallet: Wallet; entry: LedgerEntry }> {
    return withTransaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(t.wallets)
        .where(eq(t.wallets.userId, input.userId))
        .for('update')
        .limit(1)

      const current: Wallet = locked
        ? { userId: locked.userId, balance: locked.balance, held: locked.held, updatedAt: locked.updatedAt }
        : { userId: input.userId, balance: 0, held: 0, updatedAt: new Date(0).toISOString() }

      const at = new Date().toISOString()
      const built = buildEntry(current, input, at)
      const reference = await nextReferenceIn(tx, 'wallet')

      await tx
        .insert(t.wallets)
        .values({
          userId: input.userId,
          balance: built.wallet.balance,
          held: built.wallet.held,
          updatedAt: at,
        })
        .onConflictDoUpdate({
          target: t.wallets.userId,
          set: { balance: built.wallet.balance, held: built.wallet.held, updatedAt: at },
        })

      const [entryRow] = await tx
        .insert(t.ledger)
        .values({ ...built.entry, id: newId('led'), reference })
        .returning()

      return { wallet: built.wallet, entry: ledgerFromRow(entryRow) }
    })
  }

  /* -------------------------------------------------------- العرابين */

  async listDeposits(
    query: { listingId?: string; userId?: string; status?: Deposit['status'][] } = {},
  ): Promise<Deposit[]> {
    const where = [
      query.listingId ? eq(t.deposits.listingId, query.listingId) : undefined,
      query.userId ? eq(t.deposits.userId, query.userId) : undefined,
      query.status ? inArray(t.deposits.status, query.status) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.deposits)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.deposits.createdAt))
    return rows.map(depositFromRow)
  }

  async getDeposit(id: string): Promise<Deposit | null> {
    const [row] = await this.db.select().from(t.deposits).where(eq(t.deposits.id, id)).limit(1)
    return row ? depositFromRow(row) : null
  }

  async createDeposit(input: NewDeposit): Promise<Deposit> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'deposit')
      const [row] = await tx
        .insert(t.deposits)
        .values({
          ...input,
          id: newId('dep'),
          reference,
          createdAt: new Date().toISOString(),
          resolvedAt: null,
          resolvedByAdminId: null,
        })
        .returning()
      return depositFromRow(row)
    })
  }

  async updateDeposit(id: string, patch: Partial<Deposit>): Promise<Deposit> {
    const [row] = await this.db
      .update(t.deposits)
      .set({ ...patch, id: undefined, reference: undefined })
      .where(eq(t.deposits.id, id))
      .returning()
    if (!row) throw new Error('العربون غير موجود')
    return depositFromRow(row)
  }

  /* ------------------------------------------------------- الإشعارات */

  async listNotifications(userId: string, limit = 30): Promise<Notification[]> {
    const rows = await this.db
      .select()
      .from(t.notifications)
      .where(eq(t.notifications.userId, userId))
      .orderBy(desc(t.notifications.createdAt))
      .limit(limit)
    return rows.map(notificationFromRow)
  }

  async countUnreadNotifications(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(t.notifications)
      .where(and(eq(t.notifications.userId, userId), isNull(t.notifications.readAt)))
    return row?.count ?? 0
  }

  async createNotification(input: NewNotification): Promise<Notification> {
    const [row] = await this.db
      .insert(t.notifications)
      .values({ ...input, id: newId('ntf'), readAt: null, createdAt: new Date().toISOString() })
      .returning()
    return notificationFromRow(row)
  }

  async markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
    const rows = await this.db
      .update(t.notifications)
      .set({ readAt: new Date().toISOString() })
      .where(
        and(
          eq(t.notifications.userId, userId),
          isNull(t.notifications.readAt),
          ids ? inArray(t.notifications.id, ids) : undefined,
        ),
      )
      .returning({ id: t.notifications.id })
    return rows.length
  }

  /* --------------------------------------------------- أجهزة المستخدم */

  async saveUserDevice(input: NewUserDevice): Promise<UserDevice> {
    const now = new Date().toISOString()
    const [row] = await this.db
      .insert(t.userDevices)
      .values({
        id: newId('dev'),
        userId: input.userId,
        platform: input.platform,
        pushToken: input.pushToken,
        webKeys: input.webKeys,
        appVersion: input.appVersion ?? null,
        notificationsEnabled: true,
        createdAt: now,
        lastSeenAt: now,
      })
      /* الجهاز الواحد لا يُسجَّل مرّتين — والصفحة تُعيد إرساله في كلّ فتح */
      .onConflictDoUpdate({
        target: t.userDevices.pushToken,
        set: {
          userId: input.userId,
          platform: input.platform,
          webKeys: input.webKeys,
          ...(input.appVersion !== undefined ? { appVersion: input.appVersion } : {}),
          lastSeenAt: now,
        },
      })
      .returning()
    return deviceFromRow(row)
  }

  async listUserDevices(userId: string): Promise<UserDevice[]> {
    const rows = await this.db
      .select()
      .from(t.userDevices)
      .where(eq(t.userDevices.userId, userId))
    return rows.map(deviceFromRow)
  }

  async countDevicesByPlatform(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ platform: t.userDevices.platform, count: sql<number>`count(*)::int` })
      .from(t.userDevices)
      .where(eq(t.userDevices.notificationsEnabled, true))
      .groupBy(t.userDevices.platform)
    return Object.fromEntries(rows.map((row) => [row.platform, row.count]))
  }

  async setDeviceNotifications(pushToken: string, enabled: boolean): Promise<boolean> {
    const rows = await this.db
      .update(t.userDevices)
      .set({ notificationsEnabled: enabled })
      .where(eq(t.userDevices.pushToken, pushToken))
      .returning({ id: t.userDevices.id })
    return rows.length > 0
  }

  async deleteUserDevice(pushToken: string): Promise<boolean> {
    const rows = await this.db
      .delete(t.userDevices)
      .where(eq(t.userDevices.pushToken, pushToken))
      .returning({ id: t.userDevices.id })
    return rows.length > 0
  }

  /* ------------------------------------------------------- المدفوعات */

  async listPayments(query: { userId?: string; status?: Payment['status'][] } = {}): Promise<Payment[]> {
    const where = [
      query.userId ? eq(t.payments.userId, query.userId) : undefined,
      query.status ? inArray(t.payments.status, query.status) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.payments)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.payments.createdAt))
    return rows.map(paymentFromRow)
  }

  async getPayment(id: string): Promise<Payment | null> {
    const [row] = await this.db.select().from(t.payments).where(eq(t.payments.id, id)).limit(1)
    return row ? paymentFromRow(row) : null
  }

  async findPaymentByCharge(chargeId: string): Promise<Payment | null> {
    const [row] = await this.db
      .select()
      .from(t.payments)
      .where(eq(t.payments.tapChargeId, chargeId))
      .limit(1)
    return row ? paymentFromRow(row) : null
  }

  async findPaymentByReference(reference: string): Promise<Payment | null> {
    const [row] = await this.db
      .select()
      .from(t.payments)
      .where(eq(t.payments.reference, reference))
      .limit(1)
    return row ? paymentFromRow(row) : null
  }

  async createPayment(input: NewPayment): Promise<Payment> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'payment')
      const now = new Date().toISOString()
      const [row] = await tx
        .insert(t.payments)
        .values({ ...input, id: newId('pay'), reference, createdAt: now, updatedAt: now })
        .returning()
      return paymentFromRow(row)
    })
  }

  async updatePayment(id: string, patch: Partial<Payment>): Promise<Payment> {
    const [row] = await this.db
      .update(t.payments)
      .set({ ...patch, id: undefined, reference: undefined, updatedAt: new Date().toISOString() })
      .where(eq(t.payments.id, id))
      .returning()
    if (!row) throw new Error('العملية غير موجودة')
    return paymentFromRow(row)
  }

  /* -------------------------------------------------- إيرادات المنصّة */

  async appendPlatformEntry(entry: NewPlatformEntry): Promise<PlatformEntry> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'revenue')
      const [row] = await tx
        .insert(t.platformEntries)
        .values({
          ...entry,
          id: newId('ple'),
          reference,
          createdAt: new Date().toISOString(),
          reversedAt: null,
          reversalReason: null,
        })
        .returning()
      return platformEntryFromRow(row)
    })
  }

  async listPlatformEntries(
    query: { orderId?: string; depositId?: string; userId?: string; settled?: boolean } = {},
  ): Promise<PlatformEntry[]> {
    const where = [
      query.orderId ? eq(t.platformEntries.orderId, query.orderId) : undefined,
      query.depositId ? eq(t.platformEntries.depositId, query.depositId) : undefined,
      query.userId ? eq(t.platformEntries.userId, query.userId) : undefined,
      query.settled !== undefined ? eq(t.platformEntries.settled, query.settled) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.platformEntries)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.platformEntries.createdAt))
    return rows.map(platformEntryFromRow)
  }

  async updatePlatformEntry(id: string, patch: Partial<PlatformEntry>): Promise<PlatformEntry> {
    const [row] = await this.db
      .update(t.platformEntries)
      .set({ ...patch, id: undefined, reference: undefined })
      .where(eq(t.platformEntries.id, id))
      .returning()
    if (!row) throw new Error('القيد غير موجود')
    return platformEntryFromRow(row)
  }

  /* --------------------------------------------------------- الفواتير */

  async listInvoices(query: { userId?: string; orderId?: string } = {}): Promise<TaxInvoice[]> {
    const where = [
      query.userId ? eq(t.invoices.customerId, query.userId) : undefined,
      query.orderId ? eq(t.invoices.orderId, query.orderId) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.invoices)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.invoices.issuedAt))
    return rows.map(invoiceFromRow)
  }

  async getInvoice(idOrReference: string): Promise<TaxInvoice | null> {
    const [row] = await this.db
      .select()
      .from(t.invoices)
      .where(or(eq(t.invoices.id, idOrReference), eq(t.invoices.reference, idOrReference)))
      .limit(1)
    return row ? invoiceFromRow(row) : null
  }

  /**
   * آخر تجزئة في السلسلة.
   *
   * والترتيب بـ`reference` لا بوقت الإصدار: السلسلة تتبع الأرقام المتسلسلة،
   * وفاتورتان في المللي ثانية نفسها تُرتَّبان برقميهما لا بختمهما.
   */
  async lastInvoiceHash(): Promise<string | null> {
    const [row] = await this.db
      .select({ hash: t.invoices.hash })
      .from(t.invoices)
      .orderBy(desc(t.invoices.reference))
      .limit(1)
    return row?.hash ?? null
  }

  async createInvoice(input: NewTaxInvoice): Promise<TaxInvoice> {
    const [row] = await this.db
      .insert(t.invoices)
      .values({ ...input, id: newId('inv') })
      .returning()
    return invoiceFromRow(row)
  }

  /* ----------------------------------------------------- أوامر الصرف */

  async listDisbursements(
    query: { status?: Disbursement['status'][]; beneficiaryId?: string; orderId?: string } = {},
  ): Promise<Disbursement[]> {
    const where = [
      query.status ? inArray(t.disbursements.status, query.status) : undefined,
      query.beneficiaryId ? eq(t.disbursements.beneficiaryId, query.beneficiaryId) : undefined,
      query.orderId ? eq(t.disbursements.orderId, query.orderId) : undefined,
    ].filter(Boolean)
    const rows = await this.db
      .select()
      .from(t.disbursements)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(t.disbursements.createdAt))
    return rows.map(disbursementFromRow)
  }

  async getDisbursement(idOrReference: string): Promise<Disbursement | null> {
    const [row] = await this.db
      .select()
      .from(t.disbursements)
      .where(
        or(eq(t.disbursements.id, idOrReference), eq(t.disbursements.reference, idOrReference)),
      )
      .limit(1)
    return row ? disbursementFromRow(row) : null
  }

  async createDisbursement(input: NewDisbursement): Promise<Disbursement> {
    return withTransaction(async (tx) => {
      const reference = await nextReferenceIn(tx, 'disbursement')
      const [row] = await tx
        .insert(t.disbursements)
        .values({
          ...input,
          id: newId('dsb'),
          reference,
          /* يبدأ معلَّقًا: لا يُصرف شيءٌ إلّا بقرارٍ لاحقٍ من الإدارة */
          status: 'pending',
          createdAt: new Date().toISOString(),
        })
        .returning()
      return disbursementFromRow(row)
    })
  }

  async updateDisbursement(id: string, patch: Partial<Disbursement>): Promise<Disbursement> {
    const [row] = await this.db
      .update(t.disbursements)
      .set({ ...patch, id: undefined, reference: undefined })
      .where(eq(t.disbursements.id, id))
      .returning()
    if (!row) throw new Error('أمر الصرف غير موجود')
    return disbursementFromRow(row)
  }

  /* ------------------------------------------------- الأحداث والتدقيق */

  async appendEvent(input: {
    listingId: string
    eventType: ListingEventType
    payload: Record<string, unknown>
  }): Promise<ListingEvent> {
    const [row] = await this.db
      .insert(t.listingEvents)
      .values({ ...input, id: newId('evt'), createdAt: new Date().toISOString() })
      .returning()
    return {
      id: row.id,
      listingId: row.listingId,
      eventType: row.eventType as ListingEventType,
      payload: row.payload as Record<string, unknown>,
      createdAt: row.createdAt,
    }
  }

  async listEvents(listingId: string, limit = 100): Promise<ListingEvent[]> {
    const rows = await this.db
      .select()
      .from(t.listingEvents)
      .where(eq(t.listingEvents.listingId, listingId))
      .orderBy(desc(t.listingEvents.createdAt))
      .limit(limit)
    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      eventType: row.eventType as ListingEventType,
      payload: row.payload as Record<string, unknown>,
      createdAt: row.createdAt,
    }))
  }

  async appendAudit(input: {
    actorId: string | null
    action: string
    entityType: string
    entityId: string
    beforeData: Record<string, unknown> | null
    afterData: Record<string, unknown> | null
  }): Promise<void> {
    await this.db
      .insert(t.audits)
      .values({ ...input, id: newId('aud'), createdAt: new Date().toISOString() })
  }

  async listAudits(limit = 200): Promise<AuditLog[]> {
    const rows = await this.db
      .select()
      .from(t.audits)
      .orderBy(desc(t.audits.createdAt))
      .limit(limit)
    return rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeData: row.beforeData as Record<string, unknown> | null,
      afterData: row.afterData as Record<string, unknown> | null,
      createdAt: row.createdAt,
    }))
  }
}

/* ------------------------------------------------ محوّلات الصفّ إلى المجال */

type UserRow = typeof t.users.$inferSelect
type AdminRow = typeof t.admins.$inferSelect
type FaqRow = typeof t.faq.$inferSelect
type BannerRow = typeof t.banners.$inferSelect
type StoryRow = typeof t.stories.$inferSelect

function bannerFromRow(row: BannerRow): Banner {
  return {
    id: row.id,
    title: row.title,
    imageKey: row.imageKey,
    width: row.width,
    height: row.height,
    alt: row.alt,
    linkUrl: row.linkUrl,
    sortOrder: row.sortOrder,
    published: row.published,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function storyFromRow(row: StoryRow): Story {
  return {
    id: row.id,
    title: row.title,
    mediaKey: row.mediaKey,
    mediaKind: row.mediaKind as Story['mediaKind'],
    posterKey: row.posterKey,
    alt: row.alt,
    linkUrl: row.linkUrl,
    durationSeconds: row.durationSeconds,
    sortOrder: row.sortOrder,
    published: row.published,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function userFromRow(row: UserRow): User {
  return {
    id: row.id,
    reference: row.reference,
    email: row.email,
    displayName: row.displayName,
    phone: row.phone,
    city: row.city,
    avatarUrl: row.avatarUrl,
    social: row.social as User['social'],
    handle: row.handle,
    showcaseUsesHandle: row.showcaseUsesHandle,
    payout: {
      bankName: row.bankName ?? '',
      iban: row.bankIban ?? '',
      accountName: row.bankAccountName ?? '',
    },
    disabledAt: row.disabledAt,
    disabledReason: row.disabledReason as User['disabledReason'],
    createdAt: row.createdAt,
  }
}

function adminFromRow(row: AdminRow): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  }
}

function faqFromRow(row: FaqRow): FaqItem {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    category: row.category as FaqItem['category'],
    sortOrder: row.sortOrder,
    published: row.published,
    showOnSaleTypes: row.showOnSaleTypes as SaleType[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/* ------------------------------------------------ عدّادات داخل المعاملة */

/**
 * عدّادٌ يُزاد داخل المعاملة الجارية لا في اتّصالٍ آخر.
 *
 * ولو أُخذ الرقم خارجها لبقي مأخوذًا وإن تراجعت المعاملة — فتظهر فجوةٌ في
 * تسلسل الأرقام تُقرأ في تدقيقٍ لاحق سجلًّا محذوفًا فتُستجوَب بلا سبب.
 */
async function nextCounter(tx: Database, kind: string, year = 0): Promise<number> {
  const [row] = await tx
    .insert(t.sequences)
    .values({ kind, year, value: 1 })
    .onConflictDoUpdate({
      target: [t.sequences.kind, t.sequences.year],
      set: { value: sql`${t.sequences.value} + 1` },
    })
    .returning({ value: t.sequences.value })
  return row.value
}

async function nextReferenceIn(
  tx: Database,
  kind: ReferenceKind,
  at: number | string = Date.now(),
): Promise<string> {
  const year = referenceYear(at)
  return buildReference(kind, year, await nextCounter(tx, kind, year))
}

/**
 * ما يُكتب في الصفّ من كائن المجال.
 *
 * يأخذ الحقول التي لها أعمدة ويُسقط ما عداها — فلا يُمرَّر حقلٌ مشتقّ ولا
 * `undefined` يمحو عمودًا لم يُقصد تعديله. ومفاتيحُ الجدول هي المرجع، فحقلٌ
 * يُضاف إلى المخطَّط يُنقل بلا تعديلٍ هنا.
 */
function toRow<R extends Record<string, unknown>>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- جدولُ Drizzle نوعٌ مولَّد لا يُوصف بعمومٍ أبسط
  table: any,
  input: Record<string, unknown>,
): R {
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(getTableColumns(table))) {
    if (key in input && input[key] !== undefined) out[key] = input[key]
  }
  return out as R
}

/* ------------------------------------------------ محوّلات بقيّة الكيانات */

type Row<T> = T extends { $inferSelect: infer R } ? R : never

const listingToRow = (input: Partial<Listing>) =>
  toRow<typeof t.listings.$inferInsert>(t.listings, input)

function listingFromRow(row: Row<typeof t.listings>): Listing {
  /*
   * الصفّ مرآةُ الكيان حقلًا بحقل، فالتحويل نسخٌ لا إعادةُ بناء.
   * وما يُحوَّل فعلًا هو **الأنواع**: القاعدة تحفظ الحالات نصًّا، والمجال
   * يعرفها اتّحادًا مغلقًا.
   */
  return { ...row } as unknown as Listing
}

const bidFromRow = (row: Row<typeof t.bids>): Bid => ({
  id: row.id,
  listingId: row.listingId,
  bidderId: row.bidderId,
  amount: row.amount,
  status: row.status as Bid['status'],
  serverSequence: row.serverSequence,
  createdAt: row.createdAt,
  cancelledAt: row.cancelledAt,
  cancellationReason: row.cancellationReason,
})

const offerFromRow = (row: Row<typeof t.offers>): Offer => ({
  id: row.id,
  listingId: row.listingId,
  buyerId: row.buyerId,
  amount: row.amount,
  message: row.message,
  status: row.status as Offer['status'],
  createdAt: row.createdAt,
  respondedAt: row.respondedAt,
})

const orderFromRow = (row: Row<typeof t.orders>): Order =>
  ({ ...row, remindersSent: (row.remindersSent as string[]) ?? [] }) as unknown as Order

const ledgerFromRow = (row: Row<typeof t.ledger>): LedgerEntry =>
  ({ ...row }) as unknown as LedgerEntry

const depositFromRow = (row: Row<typeof t.deposits>): Deposit =>
  ({ ...row }) as unknown as Deposit

const notificationFromRow = (row: Row<typeof t.notifications>): Notification =>
  ({ ...row }) as unknown as Notification

const deviceFromRow = (row: Row<typeof t.userDevices>): UserDevice => ({
  id: row.id,
  userId: row.userId,
  platform: row.platform as UserDevice['platform'],
  pushToken: row.pushToken,
  webKeys: (row.webKeys as UserDevice['webKeys']) ?? null,
  appVersion: row.appVersion,
  notificationsEnabled: row.notificationsEnabled,
  createdAt: row.createdAt,
  lastSeenAt: row.lastSeenAt,
})

const paymentFromRow = (row: Row<typeof t.payments>): Payment =>
  ({ ...row }) as unknown as Payment

const platformEntryFromRow = (row: Row<typeof t.platformEntries>): PlatformEntry =>
  ({ ...row }) as unknown as PlatformEntry

const invoiceFromRow = (row: Row<typeof t.invoices>): TaxInvoice =>
  ({ ...row }) as unknown as TaxInvoice

const disbursementFromRow = (row: Row<typeof t.disbursements>): Disbursement =>
  ({ ...row }) as unknown as Disbursement
