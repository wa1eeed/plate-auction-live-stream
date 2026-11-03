import '../widgets/plate.dart';

/// **مراحلُ الصفقة** — §6.3.
///
/// `pay → id → transfer → review → done`، ومعها `cancelled` (عدولٌ قبل
/// السداد) و`defaulted` (انقضت المهلةُ فصودر جزءٌ من العربون).
enum OrderStage { pay, id, transfer, review, done, cancelled, defaulted }

/// حالُ محطّةٍ على السكّة.
enum StationState {
  /// وقعت — قرصٌ sage.
  done,

  /// جاريةٌ الآن — حلقةٌ مجوّفةٌ أكبرُ بحدٍّ أخضر.
  current,

  /// لم تبدأ — نقطةٌ رماديّة.
  pending,

  /// تعثّرت — قرصٌ أحمر.
  failed,
}

/// محطّةٌ واحدةٌ بختمها.
class Station {
  const Station({required this.label, required this.state, this.at});

  final String label;
  final StationState state;

  /// وقتُ وقوعها — **يُعرض تحتها تاريخًا وسطرًا للوقت**.
  final DateTime? at;
}

/// **صفقةٌ** — ما تحتاجه الشاشةُ من `AccountOrder`.
class OrderView {
  const OrderView({
    required this.id,
    required this.reference,
    required this.stage,
    required this.source,
    required this.letters,
    required this.number,
    required this.plateKind,
    required this.format,
    required this.emblem,
    required this.price,
    this.net,
    required this.buyerName,
    required this.sellerName,
    required this.youAreBuyer,
    required this.createdAt,
    this.paidAt,
    this.identityAt,
    this.transferAt,
    this.releasedAt,
    this.deadline,
    this.counterpartPhone,
    this.counterpartNationalId,
    this.counterpartBirthDate,
  });

  /// **المعرّفُ الذي تأخذه المسارات** — لا الرقمُ الذي يُعرض.
  ///
  /// فالرقمُ (`S26-00087`) للقارئ، والمعرّفُ (`ord_…`) للخادم. وتمريرُ
  /// الرقم مكانَ المعرّف يردّ ‎٤٠٤‎ على عملٍ صحيح.
  final String id;

  final String reference;
  final OrderStage stage;

  /// «مزاد» أو «بيع مباشر» أو «سوم».
  final String source;

  final String letters;
  final String number;
  final PlateKind plateKind;
  final PlateFormat format;
  final PlateEmblem emblem;

  final int price;

  /// **ما يُدفَع أو يُقبَض فعلًا** — الثمنُ ناقصَ العربون وزائدَ العمولة.
  ///
  /// و`null` لصفقةٍ لم تصل تسويتُها. ولا يُحسب هنا: قواعدُ العمولة
  /// وضريبتها في الخادم، وحسابٌ موازٍ يفترق عنها عند أوّل تعديل.
  final int? net;

  final String buyerName;
  final String sellerName;

  /// **دورُك** — ومنه تُشتقّ النصوصُ كلُّها.
  final bool youAreBuyer;

  final DateTime createdAt;
  final DateTime? paidAt;
  final DateTime? identityAt;
  final DateTime? transferAt;
  final DateTime? releasedAt;

  /// مهلةُ المرحلة الحاليّة.
  final DateTime? deadline;

  /// **جوّالُ الطرف الآخر** — و`null` قبل أن يؤكّد المشتري بياناته.
  ///
  /// فالبطاقةُ تبقى مقفلةً حتى يصير التواصلُ لازمًا للنقل (§5.7).
  final String? counterpartPhone;

  /// رقمُ هوية المشتري وتاريخُ ميلاده — **للبائع، وبعد التأكيد**.
  final String? counterpartNationalId;
  final String? counterpartBirthDate;

  bool get isClosed =>
      stage == OrderStage.cancelled || stage == OrderStage.defaulted;

  /// **المحطّاتُ الخمس** — وحالُ كلٍّ مشتقٌّ من المرحلة لا محفوظٌ معها.
  ///
  /// فحقلٌ يُكتب لكلّ محطّةٍ يُنسى تحديثُه مرّةً فتتناقض السكّةُ مع الحال،
  /// والمشتقُّ يصدق دائمًا.
  List<Station> get stations {
    final order = [
      OrderStage.pay,
      OrderStage.id,
      OrderStage.transfer,
      OrderStage.review,
      OrderStage.done,
    ];
    final labels = ['طلب', 'سداد', 'نقل', 'تأكيد', 'تم'];
    final stamps = [createdAt, paidAt, identityAt, transferAt, releasedAt];

    /* والمُغلقةُ تقف عند آخر ما وقع، وتُوسَم المحطّةُ التالية متعثّرة */
    final reached = isClosed
        ? stamps.lastIndexWhere((s) => s != null)
        : order.indexOf(stage);

    return [
      for (var i = 0; i < 5; i++)
        Station(
          label: labels[i],
          at: stamps[i],
          state: switch (true) {
            _ when i < reached => StationState.done,
            /* و«تم» محطّةٌ تقع ولا تجري: بلوغُها هو وقوعُها */
            _ when stage == OrderStage.done => StationState.done,
            _ when i == reached && isClosed => StationState.done,
            _ when i == reached + 1 && isClosed => StationState.failed,
            _ when i == reached => StationState.current,
            _ => StationState.pending,
          },
        ),
    ];
  }

  /// نسبةُ امتلاء الشريط ‎٠..١‎.
  double get fill {
    final done = stations.where((s) => s.state == StationState.done).length;
    return (done / 4).clamp(0.0, 1.0);
  }

  /// **اسمُ المرحلة بصيغة المخاطب** — ومنه عنوانُ الشاشة.
  String get stageName {
    if (stage == OrderStage.cancelled) return 'أُلغيت الصفقة قبل السداد';
    if (stage == OrderStage.defaulted) return 'انقضت مهلة السداد';
    if (youAreBuyer) {
      return switch (stage) {
        OrderStage.pay => 'سدّد قيمة اللوحة',
        OrderStage.id => 'بانتظارك لتأكيد بياناتك',
        OrderStage.transfer => 'الدور على البائع: نقل الملكية في أبشر',
        OrderStage.review => 'الإدارة تتحقّق من نقل الملكية',
        OrderStage.done => 'اكتملت الصفقة — اللوحة باسمك',
        _ => '',
      };
    }
    return switch (stage) {
      OrderStage.pay => 'بانتظار سداد المشتري',
      OrderStage.id => 'بانتظار بيانات المشتري',
      OrderStage.transfer => 'بانتظارك لنقل الملكية',
      OrderStage.review => 'الإدارة تتحقّق من نقلك',
      OrderStage.done => 'اكتملت الصفقة — وصل عائدك',
      _ => '',
    };
  }

  /// **اسمُ المرحلة في وسمٍ ضيّق** — سطرٌ قصيرٌ لا نداءٌ كامل.
  ///
  /// فـ`stageName` نداءٌ يُكتب عنوانًا لشاشة («الدور على البائع: نقل
  /// الملكية في أبشر»)، ووسمٌ في كرتٍ عرضُه بضعُ عشرات لا يسعه — فيُقطع
  /// بنقاطٍ أو يفيض. وهذا يقول الحالَ في كلمتين أو ثلاث.
  String get stageChip {
    if (stage == OrderStage.cancelled) return 'ملغاة';
    if (stage == OrderStage.defaulted) return 'انقضت مهلة السداد';
    if (stage == OrderStage.done) return 'مكتملة';
    if (youAreBuyer) {
      return switch (stage) {
        OrderStage.pay => 'بانتظار سدادك',
        OrderStage.id => 'بانتظارك لتأكيد بياناتك',
        OrderStage.transfer => 'بانتظار نقل البائع',
        OrderStage.review => 'الإدارة تتحقّق',
        _ => '',
      };
    }
    return switch (stage) {
      OrderStage.pay => 'بانتظار سداد المشتري',
      OrderStage.id => 'بانتظار بيانات المشتري',
      OrderStage.transfer => 'بانتظارك لنقل الملكية',
      OrderStage.review => 'الإدارة تتحقّق',
      _ => '',
    };
  }

  /// **أين المال** — جملةٌ صريحةٌ لا حالةٌ تُؤوَّل.
  String get moneyLine {
    if (stage == OrderStage.cancelled) {
      return youAreBuyer ? 'لم يغادر المبلغ محفظتك' : 'لم يُسدَّد مبلغ';
    }
    if (stage == OrderStage.defaulted) {
      return youAreBuyer
          ? 'صودر جزءٌ من العربون وعاد الباقي'
          : 'لم يُسدَّد مبلغ';
    }
    if (stage == OrderStage.pay) {
      return youAreBuyer
          ? 'لم يغادر المبلغ محفظتك بعد'
          : 'لم يسدّد المشتري بعد';
    }
    if (stage == OrderStage.done) {
      return youAreBuyer ? 'ذهب المبلغ إلى البائع' : 'وصل عائدك إلى محفظتك';
    }
    return 'المبلغ محجوز أمانةً لدى المنصّة';
  }
}
