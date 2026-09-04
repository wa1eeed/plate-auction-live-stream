/**
 * إصدار الفواتير الضريبية.
 *
 * تُصدَر لحظة **استحقاق العمولة** لا لحظة طلبها: فاتورة تُبنى عند العرض تتغيّر
 * بتغيّر الإعدادات، وفاتورةٌ صدرت تبقى كما صدرت. ولذلك تُنسخ فيها بيانات
 * المنشأة والنسبة والمبالغ كلّها — فتُقرأ بعد سنتين بلا الرجوع إلى إعدادات
 * اليوم.
 *
 * ولا تُصدَر مرّتين: وجود فاتورة على الصفقة بنوعها يمنع الثانية، فإعادة تشغيل
 * إجراءٍ لا تُنتج رقمين لتوريد واحد.
 */

import { createHash, randomUUID } from 'node:crypto'
import type { Halalas } from '@/lib/domain/money'
import {
  encodeZatcaQr,
  invoiceDigestInput,
  isValidVatNumber,
  toBase64,
  ZATCA_GENESIS_INPUT,
} from '@/lib/domain/zatca'
import type { CommissionBreakdown, Order, TaxInvoice, TaxInvoiceKind } from '@/lib/domain/types'
import type { AuctionStore } from '@/lib/store/types'

/** تجزئة SHA-256 بترميز base64 — الصيغة التي تعتمدها الهيئة في السلسلة. */
export function sha256Base64(input: string): string {
  return toBase64(Uint8Array.from(createHash('sha256').update(input, 'utf8').digest()))
}

/** تجزئة بداية السلسلة — ثابتة ومعروفة، فأوّل فاتورة تشير إلى قيمة لا إلى فراغ. */
export function genesisHash(): string {
  return sha256Base64(ZATCA_GENESIS_INPUT)
}

export type InvoiceInput = {
  order: Order
  kind: TaxInvoiceKind
  /** من تُصدر له — المشتري أو البائع */
  customerId: string
  breakdown: CommissionBreakdown
  /** نسبة الضريبة وقت الاستحقاق */
  vatRate: number
  plateLabel: string
}

/**
 * يُصدر فاتورة ضريبية مبسّطة عن عمولة أحد الطرفين.
 *
 * يُرجع `null` بلا ضجيج في ثلاث حالات: الفوترة غير مفعّلة، أو لا عمولة على
 * هذا الطرف، أو فاتورةٌ صدرت له عن هذه الصفقة. وأيٌّ منها ليس خطأً يُوقف
 * الصفقة: المال يمضي والفوترة تلحقه.
 */
export async function issueCommissionInvoice(
  store: AuctionStore,
  input: InvoiceInput,
): Promise<TaxInvoice | null> {
  if (input.breakdown.base <= 0) return null

  const settings = await store.getTaxSettings()
  // رقمٌ ضريبي مختلّ يُنتج فاتورة مرفوضة — والامتناع أسلم من إصدار باطل
  if (!settings.enabled || !isValidVatNumber(settings.vatNumber)) return null

  const existing = await store.listInvoices({ orderId: input.order.id })
  if (existing.some((row) => row.kind === input.kind)) return null

  const customer = await store.findUser(input.customerId)
  if (!customer) return null

  const uuid = randomUUID()
  const issuedAt = new Date().toISOString()
  const previousHash = (await store.lastInvoiceHash()) ?? genesisHash()

  const netAmount: Halalas = input.breakdown.base
  const vatAmount: Halalas = input.breakdown.vat
  const totalAmount: Halalas = input.breakdown.total

  const address = [
    settings.buildingNumber,
    settings.street,
    settings.district,
    settings.city,
    settings.postalCode,
    settings.country,
  ]
    .filter(Boolean)
    .join('، ')

  /*
   * الرقم المرجعي يُحجز **قبل** التجزئة.
   *
   * التجزئة تشمل رقم الفاتورة، فحسابها على رقمٍ يُمنح بعدها يجعل المخزَّن
   * لا يطابق ما يُعاد حسابه — وسلسلةٌ لا يُعاد التحقّق منها لا تكشف تلاعبًا.
   */
  const reference = store.nextReference('invoice', issuedAt)

  const digest = invoiceDigestInput({
    reference,
    uuid,
    issuedAt,
    vatNumber: settings.vatNumber,
    netAmount,
    vatAmount,
    totalAmount,
    customerReference: customer.reference,
    previousHash,
  })

  const created = await store.createInvoice({
    uuid,
    kind: input.kind,
    orderId: input.order.id,
    listingId: input.order.listingId,
    orderReference: input.order.reference,
    customerId: customer.id,
    customerName: customer.displayName,
    customerReference: customer.reference,
    sellerName: settings.legalName,
    sellerVatNumber: settings.vatNumber,
    sellerCrNumber: settings.crNumber,
    sellerAddress: address,
    description:
      input.kind === 'buyer_commission'
        ? `عمولة وساطة على شراء اللوحة «${input.plateLabel}»`
        : `عمولة وساطة على بيع اللوحة «${input.plateLabel}»`,
    netAmount,
    vatRate: input.vatRate,
    vatAmount,
    totalAmount,
    issuedAt,
    previousHash,
    hash: sha256Base64(digest),
    qr: encodeZatcaQr({
      sellerName: settings.legalName,
      vatNumber: settings.vatNumber,
      issuedAt,
      total: totalAmount,
      vatTotal: vatAmount,
    }),
    reference,
  })

  return created
}

/**
 * يتحقّق من سلامة السلسلة.
 *
 * يُعاد حساب تجزئة كل فاتورة من حقولها ومن تجزئة سابقتها. واختلافُ واحدة
 * يكسر ما بعدها كلّه — وهذا هو المقصود: لا يمكن تعديل فاتورة في الوسط
 * وإخفاء الأثر دون إعادة بناء السلسلة كلّها.
 */
export function verifyInvoiceChain(invoices: TaxInvoice[]): { ok: boolean; brokenAt: string | null } {
  let previous = genesisHash()
  // الترتيب هنا ترتيب الإصدار — والمخزَن يُعيده معكوسًا للعرض
  for (const invoice of invoices) {
    if (invoice.previousHash !== previous) return { ok: false, brokenAt: invoice.reference }
    const expected = sha256Base64(
      invoiceDigestInput({
        reference: invoice.reference,
        uuid: invoice.uuid,
        issuedAt: invoice.issuedAt,
        vatNumber: invoice.sellerVatNumber,
        netAmount: invoice.netAmount,
        vatAmount: invoice.vatAmount,
        totalAmount: invoice.totalAmount,
        customerReference: invoice.customerReference,
        previousHash: invoice.previousHash,
      }),
    )
    if (expected !== invoice.hash) return { ok: false, brokenAt: invoice.reference }
    previous = invoice.hash
  }
  return { ok: true, brokenAt: null }
}
