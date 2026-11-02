/// نوعُ الفاتورة — على مَن صدرت العمولةُ فيها.
enum InvoiceKind { buyerCommission, sellerCommission }

/// **فاتورةٌ ضريبيّةٌ مبسّطة — كما أصدرها الخادم.**
///
/// **ولا يُحسب شيءٌ منها في الجهاز**: كانت الشاشةُ تحسب الضريبةَ ‎١٥٪‎
/// وتُلفّق رقمًا من رقم الصفقة. ونسبةُ الضريبة تتغيّر بقرارٍ، والرقمُ
/// متسلسلٌ لا تنقطع سلسلتُه ولا يُخترع — وفاتورةٌ بأرقامٍ محسوبةٍ في الجهاز
/// تخالف ما في سجلّ المنصّة، فتُقدَّم للهيئة نسختان لرقمٍ واحد.
class TaxInvoice {
  const TaxInvoice({
    required this.id,
    required this.reference,
    required this.uuid,
    required this.kind,
    required this.orderReference,
    required this.customerName,
    required this.sellerName,
    required this.sellerVatNumber,
    required this.description,
    required this.netAmount,
    required this.vatRate,
    required this.vatAmount,
    required this.totalAmount,
    required this.issuedAt,
    required this.qr,
  });

  final String id;

  /// رقمُ الفاتورة — `T26-00001`.
  final String reference;

  final String uuid;
  final InvoiceKind kind;
  final String orderReference;
  final String customerName;

  /// اسمُ المنشأة ورقمُها الضريبيّ — **لقطةً وقت الإصدار** لا من الإعدادات.
  final String sellerName;
  final String sellerVatNumber;

  final String description;

  /// بالهللات.
  final int netAmount;

  /// نسبةُ الضريبة وقتَ الإصدار — `0.15`.
  final double vatRate;

  final int vatAmount;
  final int totalAmount;
  final DateTime issuedAt;

  /// محتوى رمز QR بترميز TLV ثمّ base64 — يُرسم كما وصل.
  final String qr;

  /// النسبةُ كما تُكتب للقارئ: ‎١٥٪‎.
  String get vatPercent {
    final percent = vatRate * 100;
    final rounded = percent.round();
    return (percent - rounded).abs() < 0.001
        ? '$rounded'
        : percent.toStringAsFixed(1);
  }
}
