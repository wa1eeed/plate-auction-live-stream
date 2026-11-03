import 'package:flutter/widgets.dart';

/// **حالُ الجلسة** — داخلٌ أو متصفّحٌ بلا حساب.
///
/// **والتصفّحُ مفتوحٌ بلا دخول**: من فتح التطبيق أوّل مرّة يريد أن يرى
/// اللوحاتِ قبل أن يُعطي رقمَه. وبابُ تسجيلٍ قبل أن يُرى شيءٌ يُغلق التطبيق
/// على من لم يقرّر بعد.
///
/// **ويُطلب الدخولُ عند أوّل وظيفة** — مزايدةٍ أو شراءٍ أو سومٍ أو متابعةٍ أو
/// عرضِ لوحة: هنالك يصير للحساب معنًى، فيُطلب وقد عرف المستخدمُ لماذا.
// ignore_for_file: prefer_initializing_formals
class Session extends ChangeNotifier {
  Session({bool signedIn = false}) : _signedIn = signedIn;

  bool _signedIn;
  bool get signedIn => _signedIn;

  void signIn() {
    if (_signedIn) return;
    _signedIn = true;
    notifyListeners();
  }

  void signOut() {
    if (!_signedIn) return;
    _signedIn = false;
    notifyListeners();
  }
}

/// يُتيح الجلسةَ لشجرة الواجهة.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({
    super.key,
    required Session session,
    required super.child,
  }) : super(notifier: session);

  static Session of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<SessionScope>();
    assert(scope != null, 'لا جلسةَ في الشجرة — لُفَّ التطبيقَ بـSessionScope');
    return scope!.notifier!;
  }
}

/// ما يحتاج حسابًا — ومنه تُشتقّ جملةُ المطالبة.
enum GatedAction {
  bid,
  buy,
  offer,
  follow,
  sell,
  wallet,
  orders,
  notifications,
}

extension GatedActionText on GatedAction {
  /// **ولكلّ وظيفةٍ جملتُها** — لا «سجّل الدخول للمتابعة».
  ///
  /// فمن ضغط «زايد» يريد أن يُقال له لماذا يلزمه حساب: العربونُ يُحجز من
  /// محفظته، وهي لا تكون إلّا لحساب.
  (String, String) get prompt => switch (this) {
    GatedAction.notifications => (
      'تحتاج حسابًا لترى إشعاراتك',
      'الإشعارات تخصّ مزايداتك وصفقاتك — ولا تكون إلّا لحساب.',
    ),
    GatedAction.bid => (
      'تحتاج حسابًا لتزايد',
      'العربون يُحجز من محفظتك مع أوّل مزايدة، والمحفظة لا تكون إلّا '
          'لحساب.',
    ),
    GatedAction.buy => (
      'تحتاج حسابًا لتشتري',
      'المبلغ يُحجز أمانةً لدى المنصّة حتى تصلك اللوحة — ولا يُحجز '
          'إلّا من محفظة.',
    ),
    GatedAction.offer => (
      'تحتاج حسابًا لتسوم',
      'البائع يحتاج طريقًا يردّ عليك به، ويصلك ردُّه في نشاطك.',
    ),
    GatedAction.follow => (
      'تحتاج حسابًا لتتابع',
      'نُنبّهك قبل أن ينتهي المزاد — والتنبيه يحتاج حسابًا يصله.',
    ),
    GatedAction.sell => (
      'تحتاج حسابًا لتعرض لوحتك',
      'العرض يُنشئ صفقةً باسمك، ويصلك عائدها في محفظتك.',
    ),
    GatedAction.wallet => (
      'تحتاج حسابًا لمحفظتك',
      'المحفظة تحفظ رصيدك وعرابينك المحجوزة.',
    ),
    GatedAction.orders => (
      'تحتاج حسابًا لصفقاتك',
      'هنا تتابع ما اشتريتَ وما بعتَ، وما ينتظر ردَّك.',
    ),
  };
}
