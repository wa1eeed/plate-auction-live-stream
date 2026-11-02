import '../widgets/plate.dart';

/// دورُك في هذه الصفقة — **بصيغة المخاطب** لا بصيغة الغائب.
///
/// و«أنت المشتري» أوضحُ من «مشترٍ»: من يفتح «نشاطي» يسأل «ماذا عليّ؟»
/// لا «ما تصنيفُ هذه الصفقة؟».
enum ActorRole { buyer, seller }

/// نوعُ ما ينتظر — ولكلٍّ نداؤُه وأزرارُه.
enum PendingKind {
  /// صفقةٌ تنتظر سدادَك أو بياناتك.
  order,

  /// سومٌ وصلك — اقبل أو ارفض.
  offer,

  /// مزادٌ تجاوزك فيه أحد.
  outbid,

  /// صفقةُ بيعٍ تنتظر نقلَك للملكية.
  transfer,
}

/// **بندٌ في «بانتظارك»** — واحدٌ من أربعةٍ يجمعها التابُ الأوّل.
class PendingItem {
  const PendingItem({
    required this.id,
    required this.kind,
    required this.role,
    required this.letters,
    required this.number,
    required this.plateKind,
    required this.format,
    required this.emblem,
    required this.saleLabel,
    required this.kicker,
    required this.title,
    required this.sub,
    required this.cta,
    this.amount,
  });

  final String id;
  final PendingKind kind;
  final ActorRole role;

  final String letters;
  final String number;
  final PlateKind plateKind;
  final PlateFormat format;
  final PlateEmblem emblem;

  /// «مزاد» أو «بيع مباشر» أو «سوم» — وسمُ نوع الصفقة.
  final String saleLabel;

  /// سطرٌ صغيرٌ أخضرُ فوق العنوان.
  final String kicker;

  final String title;
  final String sub;

  /// نصُّ الزرّ الأساسيّ.
  final String cta;

  /// مبلغٌ يُعرض في الزرّ إن كان الإجراءُ مزايدة.
  final int? amount;
}
