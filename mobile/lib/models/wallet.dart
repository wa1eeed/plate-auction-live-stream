import '../widgets/plate.dart';

/// حركةٌ في كشف الحساب.
enum LedgerKind { topup, withdrawal, hold, release, forfeit, purchase, payout }

/// سطرٌ في كشف الحساب — **ولكلٍّ مرجعُه وحالُه وسببُه**.
class LedgerEntry {
  const LedgerEntry({
    required this.reference,
    required this.kind,
    required this.amount,
    required this.at,
    required this.status,
    this.note,
  });

  /// رقمٌ مرجعيٌّ `W26-…` — به يُراجَع السطرُ حين يُسأل عنه.
  final String reference;

  final LedgerKind kind;

  /// بالهللات — موجبٌ داخلٌ وسالبٌ خارج.
  final int amount;

  final DateTime at;

  /// «محجوز» · «تمّ» · «قيد المراجعة» …
  final String status;

  final String? note;

  String get title => switch (kind) {
    LedgerKind.topup => 'شحن رصيد',
    LedgerKind.withdrawal => 'طلب سحب',
    LedgerKind.hold => 'حجز عربون',
    LedgerKind.release => 'فكّ عربون',
    LedgerKind.forfeit => 'مصادرة عربون',
    LedgerKind.purchase => 'سداد قيمة لوحة',
    LedgerKind.payout => 'عائد بيع',
  };
}

/// عربونٌ محجوزٌ على لوحة.
class HeldDeposit {
  const HeldDeposit({
    required this.amount,
    required this.why,
    required this.letters,
    required this.number,
    required this.kind,
    required this.format,
    required this.emblem,
  });

  final int amount;

  /// **لماذا هو محجوز** — لا مبلغٌ بلا سبب.
  final String why;

  final String letters;
  final String number;
  final PlateKind kind;
  final PlateFormat format;
  final PlateEmblem emblem;
}

/// **المحفظة** — §5.8.
class WalletView {
  const WalletView({
    required this.available,
    required this.balance,
    required this.held,
    required this.deposits,
    required this.ledger,
  });

  /// ما يُمكن أن تزايد به أو تسحبه.
  final int available;

  /// الكلّيُّ — المتاحُ والمحجوزُ معًا.
  final int balance;

  /// المحجوزُ كعرابين.
  final int held;

  final List<HeldDeposit> deposits;
  final List<LedgerEntry> ledger;
}

/// طرائقُ الشحن المفعَّلة — كما تقولها الإدارةُ لا كما يفترض الجهاز.
class PaymentOptions {
  const PaymentOptions({
    required this.cardEnabled,
    required this.bankEnabled,
    this.bank,
  });

  /// مدى · Apple Pay · بطاقة ائتمانيّة — عبر بوّابة الدفع.
  final bool cardEnabled;

  final bool bankEnabled;

  /// بياناتُ الحساب البنكيّ — تُعرض للمحوِّل، وتأتي من إعدادات المنصّة.
  final BankDetails? bank;

  bool get none => !cardEnabled && !bankEnabled;
}

class BankDetails {
  const BankDetails({
    required this.name,
    required this.accountName,
    required this.iban,
    required this.accountNumber,
    required this.instructions,
  });

  final String name;
  final String accountName;
  final String iban;
  final String accountNumber;
  final String instructions;
}

/// نتيجةُ بدء الشحن.
class TopUpStarted {
  const TopUpStarted({required this.reference, this.redirectUrl});

  /// مرجعُ العمليّة — يُقال للمحوِّل ليُكتب في الحوالة.
  final String reference;

  /// صفحةُ البوّابة — للبطاقة وحدها، و`null` للحوالة.
  final String? redirectUrl;
}
