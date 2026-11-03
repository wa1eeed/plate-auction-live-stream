import 'wallet.dart';

/// **وسيلةُ سداد** — كما يسمّيها الخادم في `PaymentMethod`.
enum PayMethod { wallet, card, bank }

/// اسمُها عند الخادم — ويُرسل في جسم `POST api/checkout/{id}`.
String payMethodWire(PayMethod m) => switch (m) {
  PayMethod.wallet => 'wallet',
  PayMethod.card => 'tap',
  PayMethod.bank => 'bank_transfer',
};

PayMethod? payMethodOf(String? wire) => switch (wire) {
  'wallet' => PayMethod.wallet,
  'tap' => PayMethod.card,
  'bank_transfer' => PayMethod.bank,
  _ => null,
};

/// خيارُ سدادٍ معروضٌ في الورقة — **ومعه سببُ تعطيله إن كان معطَّلًا**.
///
/// فوسيلةٌ تُخفى لأنّها غير مفعّلةٍ تجعل المستخدمَ يحسب أنّ المنصّة لا
/// تعرفها؛ وظهورُها باهتةً مع سببها يُجيب سؤالَه قبل أن يسأل.
class PayOption {
  const PayOption({
    required this.method,
    required this.label,
    required this.available,
    required this.hint,
  });

  final PayMethod method;
  final String label;
  final bool available;
  final String hint;
}

/// **صفحةُ سداد صفقةٍ واحدة** — من `GET api/checkout/{id}`.
///
/// **والمطلوبُ يأتي محسوبًا من الخادم** (`settlement.net`): فيه الثمنُ
/// ناقصَ العربون المخصوم وزائدَ عمولة المشتري وضريبتها. وأيُّ حسابٍ
/// يُعاد هنا يفترق عنه سطرًا من القواعد، فيُعرَض رقمٌ ثمّ يُخصم غيره.
class CheckoutInfo {
  const CheckoutInfo({
    required this.due,
    required this.price,
    required this.depositApplied,
    required this.commission,
    required this.availableHalalas,
    required this.plateLabel,
    required this.sellerName,
    required this.methods,
    this.bank,
  });

  /// المطلوبُ الآن بالهللات.
  final int due;

  final int price;

  /// ما خُصم من العربون المحجوز — صفرٌ في البيع المباشر والسوم.
  final int depositApplied;

  /// عمولةُ المشتري وضريبتُها مجموعتين.
  final int commission;

  final int availableHalalas;
  final String plateLabel;
  final String sellerName;
  final List<PayOption> methods;

  /// بياناتُ الحساب للحوالة — تُعرض قبل التأكيد لا بعده.
  final BankDetails? bank;

  PayOption? option(PayMethod m) =>
      methods.where((o) => o.method == m).firstOrNull;

  /// أوّلُ وسيلةٍ متاحةٍ — تُختار سلفًا فلا يُسأل عن بديهيّ.
  PayMethod? get preferred =>
      methods.where((o) => o.available).map((o) => o.method).firstOrNull;

  bool get none => methods.every((o) => !o.available);
}

/// ما عاد به السدادُ — **وثلاثةُ مآلاتٍ لا واحد**.
///
/// فالمحفظةُ تُسوّي فورًا، والبطاقةُ تُحوّل إلى صفحةٍ خارج التطبيق،
/// والحوالةُ تُنشئ عمليةً معلّقةً تنتظر توثيقَ الإدارة.
class PayResult {
  const PayResult({
    required this.reference,
    required this.settled,
    this.redirectUrl,
  });

  final String reference;
  final bool settled;
  final String? redirectUrl;
}
