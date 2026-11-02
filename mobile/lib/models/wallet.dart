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
