import type { AuctionStore } from '@/lib/store/types'
import type { Order } from '@/lib/domain/types'
import { startOrderPayment } from '@/lib/server/checkout-service'
import { markPaymentPaid } from '@/lib/server/payment-service'
import { releaseOrderEscrow, submitTransferProof } from '@/lib/server/escrow-service'

/**
 * يُتمّ صفقة بالسداد الحقيقي لا باختصار الأدمن.
 *
 * صار الإتمام يشترط دفعة مختومة على الصفقة — فلا يُغلقها بائع ولا أدمن قبل أن
 * يدفع المشتري. والاختبار يمرّ بما يمرّ به المستخدم: حوالة بنكية يؤكّدها
 * الأدمن، وهي أخفّ من الدفع من المحفظة لأنها لا تشترط رصيدًا كافيًا.
 */
export async function settleOrderForTest(
  store: AuctionStore,
  order: Order,
  adminId: string,
): Promise<void> {
  await store.updatePaymentSettings({
    tapEnabled: false,
    tapMode: 'test',
    bankTransferEnabled: true,
    bankName: 'مصرف الاختبار',
    bankAccountName: 'سوق اللوحات',
    bankIban: 'SA0380000000608010167519',
    bankAccountNumber: '',
    bankInstructions: '',
  })

  const started = await startOrderPayment({
    orderId: order.id,
    userId: order.buyerId,
    method: 'bank_transfer',
  })
  const rows = await store.listPayments({ userId: order.buyerId })
  const payment = rows.find((row) => row.reference === started.paymentReference)!
  await markPaymentPaid({ paymentId: payment.id, adminId, note: null })
}

/**
 * يمضي بالصفقة إلى نهايتها: سداد ← نقل ملكية ← تأكيد المشتري ← إفراج.
 *
 * السداد يحجز ولا يُتمّ، فما يختبر «اكتمال الصفقة» يحتاج المسار كاملًا.
 */
export async function completeOrderForTest(
  store: AuctionStore,
  order: Order,
  adminId: string,
): Promise<void> {
  await settleOrderForTest(store, order, adminId)
  await submitTransferProof({
    orderId: order.id,
    sellerId: order.sellerId,
    note: 'نُقلت الملكية — اختبار',
  })
  // الإفراج صار قرار إدارة لا تأكيد مشترٍ — والاختبار يمرّ بالمسار نفسه
  const transferred = await store.getOrder(order.id)
  await releaseOrderEscrow(transferred!, { by: 'admin', adminId })
}
