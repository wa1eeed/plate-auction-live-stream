import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_scope.dart';
import '../api/mapping.dart';
import '../api/api_client.dart';
import '../api/mazad_api.dart';
import '../auth/auth_flow.dart';
import '../auth/auth_gate.dart';
import '../auth/session.dart';
import '../design/tokens.dart';
import '../widgets/common/async_view.dart';
import '../widgets/common/external_link.dart';
import '../widgets/common/toast.dart';
import '../widgets/wallet/top_up_sheet.dart';
import '../widgets/order/identity_form.dart';
import '../widgets/order/pay_sheet.dart';
import '../models/chat.dart';
import '../models/invoice.dart';
import '../models/order.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
import '../screens/orders_screen.dart';
import '../screens/activity_screen.dart';
import '../screens/listing_screen.dart';
import '../screens/order_screen.dart';
import '../screens/sell_screen.dart';
import '../screens/chat_screen.dart';
import '../screens/home_screen.dart';
import '../screens/story_viewer.dart';
import '../widgets/home/stories_strip.dart';
import '../screens/help_screen.dart';
import '../screens/invoice_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/showcase_screen.dart';
import '../screens/account_screen.dart';
import '../screens/wallet_screen.dart';
import '../screens/market_screen.dart';
import '../models/listing.dart';
import 'tab_bar.dart';

/// **هيكلُ التطبيق** — الشاشاتُ الخمسُ وشريطُها السفليّ.
///
/// والزرُّ الدائريُّ يُرسم **فوق** الشريط لا فيه: يرتفع ‎٣٠‎ بكسلًا بحدٍّ بلون
/// الخلفية، فلو كان عنصرًا في الصفّ لقُصّ عند حافّته.
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.onNeedAuth});

  /// يُستدعى حين يطلب المستخدمُ وظيفةً تحتاج حسابًا وقد اختار بابًا.
  final ValueChanged<AuthRoute> onNeedAuth;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  AppTab _tab = AppTab.home;

  /* وقتُ الخادم — يُقرأ مرّةً ولا يتبدّل بإعادة البناء */
  final _now = DateTime.now();

  /* لوحةٌ مفتوحةٌ فوق السوق — تُخفي شريطَ التبويب */
  Listing? _open;

  /// **«صفقاتي»** — `null` مغلقةٌ، و`true` تُفتح على «مبيعاتي».
  bool? _orders;

  /*
   * **صفقةٌ مفتوحةٌ فوق «نشاطي» — كائنُها لا رايةٌ تقول «مفتوحة».**
   *
   * فالمحادثةُ والفاتورةُ تُنادَيان بمعرّفها، والشاشةُ تُرسم ببياناتها. وكانت
   * رايةً تُرسم معها صفقةٌ تجريبيّة — فيُفتح للمستخدم غيرُ ما ضغط.
   */
  OrderView? _openOrder;

  /* المحفظةُ تُفتح فوق «حسابي» من زرّ البطاقة */
  bool _wallet = false;

  /* والإعداداتُ تُفتح فوق «حسابي» من قائمته */
  bool _settings = false;
  bool _notifs = false;
  bool _showcase = false;
  bool _help = false;
  bool _chat = false;
  bool _invoice = false;
  Story? _story;

  /// **شحنُ الرصيد** — الخياراتُ ثمّ الورقةُ ثمّ النداء.
  ///
  /// **والخياراتُ تُجلب قبل فتح الورقة**: الإدارةُ تُطفئ البطاقةَ أو الحوالةَ
  /// من لوحتها، فورقةٌ ترسم الطريقتين دائمًا تُرَدّ بـ‎٤٠٩‎ بعد أن يختار
  /// المستخدمُ مبلغَه — وقد أدخل ما أدخل.
  Future<void> _topUp(VoidCallback reload) async {
    final api = ApiScope.of(context);

    final options = await runValue(context, api.paymentOptions);
    if (options == null || !mounted) return;

    final choice = await showTopUpSheet(context, options);
    if (choice == null || !mounted) return;

    final (amount, byCard) = choice;
    final started = await runValue(
      context,
      () => api.startTopUp(amountRiyals: amount, byCard: byCard),
    );
    if (started == null || !mounted) return;

    /*
     * **وصفحةُ البوّابة تُفتح خارج التطبيق.**
     *
     * فصفحةُ دفعٍ داخل التطبيق تمنع المستخدمَ من رؤية القفل في شريط العنوان
     * — وهو ما يُعلَّم الناسُ أن يتحقّقوا منه قبل أن يُدخلوا بطاقة. ومتجرا
     * التطبيقات يمنعان ذلك كذلك.
     */
    final url = started.redirectUrl;
    if (url != null) {
      final opened = await launchExternal(url);
      if (!mounted) return;
      if (!opened) {
        showToast(
          context,
          'ما قدرنا نفتح صفحة الدفع — حاول مرّة ثانية',
          kind: ToastKind.warning,
        );
        return;
      }
      /* والرصيدُ يصل بعد أن يردّ الخطّافُ من البوّابة — فيُعاد الجلب */
      reload();
      return;
    }

    if (!mounted) return;
    showToast(
      context,
      'سُجّلت حوالتك برقم ${started.reference} — '
      'اكتبه في الحوالة ليُوثَّق رصيدك',
      kind: ToastKind.success,
    );
    reload();
  }

  /// **شاشةُ اللوحة** — تُفتح من السوق ومن «نشاطي» كذلك.
  ///
  /// فصفوفُ «مزايداتي» و«عروضي» و«أتابعها» لم تكن تُضغط: الكرتُ يقبل
  /// `onTap` ولم يُمرَّر — فيرى المستخدمُ لوحاتَه ولا يصل إلى واحدةٍ منها.
  /// وهي الشاشةُ نفسُها، فلا تُكتب مرّتين.
  Widget _listingView() => AsyncView<ListingDetailView>(
    /* وتفاصيلُ اللوحة تُجلب عند فتحها لا مع السوق كلِّه */
    load: () => ApiScope.of(context).listingDetail(_open!.id),
    builder: (context, detail, reload) => ListingScreen(
      listing: detail.listing,
      serverTime: _now,
      bids: detail.bids,
      depositHalalas: detail.depositAmount,
      increment: detail.increment,
      reserve: detail.reserve,
      sellerName: detail.sellerName,
      onBack: () => setState(() => _open = null),
      onBid: (amount) => _act(
        GatedAction.bid,
        (api) => api.bid(_open!.id, amount),
        success: 'سُجّلت مزايدتك',
        then: reload,
      ),
      onBuy: () => _act(
        GatedAction.buy,
        (api) async => api.buy(_open!.id),
        success: 'تمّ الشراء — سدّد لتُحجز لك',
        then: reload,
      ),
      onOffer: () => _act(
        GatedAction.offer,
        (api) => api.offer(_open!.id, detail.nextBidAmount),
        success: 'وصل سومك للبائع',
        then: reload,
      ),
      onFollow: () => _gate(GatedAction.follow),
      onShare: () => _shareListing(detail.listing.id),
    ),
  );

  /// **مشاركةُ رابط اللوحة** — يُنسخ الرابطُ لتُلصق في أيّ تطبيق.
  ///
  /// ولا تُستدعى ورقةُ المشاركة الأصليّة: تلزمها حزمةٌ جديدة، وإضافتُها
  /// قبيل إصدارٍ تُدخل على البناء ما لم يُجرَّب. والنسخُ يبلغ المقصودَ
  /// اليومَ بلا ذلك.
  Future<void> _shareListing(String id) async {
    final link = '${ApiClient.baseUrl}/market/$id';
    await Clipboard.setData(ClipboardData(text: link));
    if (!mounted) return;
    showToast(context, 'نُسخ رابط اللوحة', kind: ToastKind.success);
  }

  /// **الاتّصالُ بالطرف الآخر** — يفتح هاتفَ الجهاز بالرقم.
  ///
  /// و`onCall` في المحادثة لم يكن يُمرَّر، فأيقونةُ السمّاعة جُماد.
  Future<void> _call(String phone) async {
    final opened = await launchExternal('tel:$phone');
    if (!mounted || opened) return;
    showToast(
      context,
      'ما قدرنا نفتح الهاتف — الرقم $phone',
      kind: ToastKind.warning,
    );
  }

  /// **الخروجُ من الحساب.**
  ///
  /// وكان الزرُّ في الإعدادات بلا نداءٍ أصلًا — و`logout()` مكتوبةٌ في
  /// العميل لا يناديها أحد. فمن دخل لم يكن له بابُ خروج.
  ///
  /// **وتُمحى الجلسةُ محلّيًّا وإن سقط نداءُ الخادم**: كوكيٌّ بقي في جهازٍ
  /// ظنَّ صاحبُه أنّه خرج أسوأُ من كوكيٍّ بطل عند الخادم وحده.
  Future<void> _logout() async {
    final api = ApiScope.of(context);
    final session = SessionScope.of(context);

    await api.logout().catchError((_) {});
    if (!mounted) return;

    session.signOut();
    setState(() {
      _settings = false;
      _wallet = false;
      _notifs = false;
      _showcase = false;
      _help = false;
      _orders = null;
      _openOrder = null;
      _open = null;
      _tab = AppTab.home;
    });
    showToast(context, 'خرجت من حسابك', kind: ToastKind.info);
  }

  /// **تعليقُ الحساب وطلبُ حذفه** — وأبل تشترطه من داخل التطبيق.
  ///
  /// والخادمُ يمحو الجلسةَ في طلبه نفسِه، فيُخرَج هنا كذلك: واجهةُ حسابٍ
  /// معطَّلٍ تُردّ عن كلّ ما فيها.
  Future<void> _deleteAccount() async {
    final api = ApiScope.of(context);
    final done = await runAction(
      context,
      api.deleteAccount,
      success: 'علّقنا حسابك — يُحذف بعد ثلاثين يومًا',
    );
    if (!done || !mounted) return;

    SessionScope.of(context).signOut();
    setState(() {
      _settings = false;
      _tab = AppTab.home;
    });
  }

  /// **سدادُ الصفقة** — تُفتح الورقةُ بالمطلوب المحسوب من الخادم.
  ///
  /// ومآلاتُه ثلاثة: المحفظةُ تُسوّي فورًا فتنتقل الصفقةُ إلى تأكيد
  /// البيانات، والبطاقةُ تُحوّل إلى صفحةٍ خارج التطبيق، والحوالةُ تُسجَّل
  /// معلّقةً برقمٍ يُكتب فيها.
  Future<void> _pay(OrderView order) async {
    final api = ApiScope.of(context);

    final info = await runValue(context, () => api.checkout(order.id));
    if (info == null || !mounted) return;

    final method = await showPaySheet(context, info);
    if (method == null || !mounted) return;

    final result = await runValue(
      context,
      () => api.payOrder(order.id, method),
    );
    if (result == null || !mounted) return;

    /* وصفحةُ البوّابة تُفتح خارج التطبيق — كما في شحن الرصيد */
    final url = result.redirectUrl;
    if (url != null) {
      final opened = await launchExternal(url);
      if (!mounted) return;
      if (!opened) {
        showToast(
          context,
          'ما قدرنا نفتح صفحة الدفع — حاول مرّة ثانية',
          kind: ToastKind.warning,
        );
        return;
      }
      await _refreshOpenOrder();
      return;
    }

    if (!mounted) return;
    showToast(
      context,
      result.settled
          ? 'سُدّدت الصفقة — أكّد بياناتك ليبدأ البائع النقل'
          : 'سُجّلت حوالتك برقم ${result.reference} — '
                'اكتبه في الحوالة ليُعتمد سدادك',
      kind: ToastKind.success,
    );
    await _refreshOpenOrder();
  }

  /// **تُعاد قراءةُ الصفقة المفتوحة** بعد ما يُغيّر مرحلتَها.
  ///
  /// فالشاشةُ تحمل نسخةً أُخذت من حزمة «نشاطي»، ولو بقيت على حالها بعد
  /// السداد ظلّ زرُّ «سدّد» أمام من سدّد.
  Future<void> _refreshOpenOrder() async {
    final open = _openOrder;
    if (open == null) return;

    /* وتُقرأ وحدَها لا ضمن القائمة — ومن سقطت قراءتُه بقي على ما بيده */
    final fresh = await ApiScope.of(context)
        .order(open.id)
        .then<OrderView?>((o) => o, onError: (_) => null);
    if (!mounted || fresh == null) return;
    setState(() => _openOrder = fresh);
  }

  /// **لا فاتورةَ بعد** — تُصدَر عند اكتمال الصفقة لا عند نشأتها.
  Widget _noInvoiceYet() => Padding(
    padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
    child: Column(
      children: [
        Align(
          alignment: AlignmentDirectional.centerStart,
          child: GestureDetector(
            onTap: () => setState(() => _invoice = false),
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 42,
              height: 42,
              decoration: const BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.arrowRight, size: 20),
            ),
          ),
        ),
        const Spacer(),
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            LucideIcons.receipt,
            size: 28,
            color: AppColors.neutral500,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'ما صدرت الفاتورة بعد',
          style: AppText.heading(19),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 6),
        Text(
          'تُصدَر على عمولة المنصّة حين تكتمل الصفقة وتُنقل الملكية.',
          style: AppText.body(
            13,
            color: AppColors.neutral700,
          ).copyWith(height: 1.7),
          textAlign: TextAlign.center,
        ),
        const Spacer(flex: 2),
      ],
    ),
  );

  /*
   * **والبوّابةُ تسأل مرّةً عند الوظيفة لا عند الفتح.**
   *
   * فمن ضغط «زايد» وهو متصفّحٌ بلا حساب تُفتح له ورقةٌ تقول لماذا يلزمه
   * حساب، ثمّ يختار بابَه. ومن كان داخلًا يمضي بلا اعتراض.
   */
  Future<bool> _gate(GatedAction action) async {
    if (SessionScope.of(context).signedIn) return true;
    final choice = await showAuthGate(context, action);
    if (choice == null || !mounted) return false;
    widget.onNeedAuth(switch (choice) {
      AuthChoice.otp => AuthRoute.otp,
      AuthChoice.password => AuthRoute.password,
      AuthChoice.register => AuthRoute.register,
    });
    return false;
  }

  /// **يُجري فعلًا بعد البوّابة** — فإن لم يكن داخلًا سُئل أوّلًا.
  ///
  /// ورسالةُ النجاح والخطأ كلتاهما من الخادم تُعرض طافيةً، فلا يبقى
  /// المستخدمُ يحزر أوقع الفعلُ أم لا.
  Future<void> _act(
    GatedAction action,
    Future<void> Function(MazadApi api) run, {
    String? success,
    VoidCallback? then,
  }) async {
    if (!await _gate(action)) return;
    if (!mounted) return;
    final ok = await runAction(
      context,
      () => run(ApiScope.of(context)),
      success: success,
    );
    /*
     * **ويُعاد الجلبُ بعد نجاحٍ يُغيّر ما يُعرض.**
     *
     * فمن زايد يريد أن يرى مزايدتَه في الكشف وسعرَه الجديد — وشاشةٌ لا
     * تتبدّل بعد فعلٍ نجح تُقرأ فشلًا، فيُعيد الفعلَ مرّةً أخرى.
     */
    if (ok) then?.call();
  }

  /// يفتح تبويبًا يحتاج حسابًا — أو يسأل أوّلًا.
  Future<void> _openGatedTab(AppTab tab, GatedAction action) =>
      _openGated(action, () => _tab = tab);

  /// **ويُغيَّر ما يُغيَّر بعد الإذن لا قبله** — وإلّا فُتحت شاشةٌ ثمّ رُدّت.
  Future<void> _openGated(GatedAction action, VoidCallback change) async {
    if (!await _gate(action)) return;
    if (mounted) setState(change);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: switch (_tab) {
          AppTab.home when _story != null => StoryViewer(
            stories: demoStories,
            initialIndex: demoStories.indexOf(_story!),
            onClose: () => setState(() => _story = null),
          ),
          AppTab.home => AsyncView<HomeBundle>(
            load: () =>
                ApiScope.of(context)
                    .home(signedIn: SessionScope.of(context).signedIn),
            builder: (context, h, reload) => HomeScreen(
              listings: h.market.listings,
              serverTime: h.market.serverTime,
              availableHalalas: h.availableHalalas,
              pendingCount: h.pendingCount,
              pendingFirst: h.pendingFirst,
              hasUnread: h.hasUnread,
              onOpenStory: (s) => setState(() => _story = s),
              /* والكرتُ يفتح صفحتَه في تاب السوق — فهو موضعُها */
              onOpen: (l) => setState(() {
                _open = l;
                _tab = AppTab.market;
              }),
              onOpenWallet: () => _openGated(GatedAction.wallet, () {
                _tab = AppTab.account;
                _wallet = true;
              }),
              onOpenNotifications: () =>
                  _openGated(GatedAction.notifications, () {
                    _tab = AppTab.account;
                    _notifs = true;
                  }),
              onOpenPending: () =>
                  _openGated(GatedAction.orders, () => _tab = AppTab.activity),
              onOpenMarket: () => setState(() => _tab = AppTab.market),
              onOpenSell: () =>
                  _openGated(GatedAction.sell, () => _tab = AppTab.sell),
            ),
          ),
          /*
           * **والسوقُ يقرأ الخادمَ لا البذرة.**
           *
           * كان يُرسم من `demoAll` — فمعرّفاتُ لوحاته ليست عند الخادم، ومن
           * ضغط لوحةً سأل الخادمَ عن معرّفٍ لا يعرفه فقيل له «الإعلان غير
           * موجود». وهي شاشةٌ كاملةٌ لا تعمل، وسببُها سطرٌ لم يُربط.
           */
          AppTab.market when _open == null => AsyncView<MarketSnapshot>(
            load: () => ApiScope.of(context).listings(),
            builder: (context, snap, reload) => MarketScreen(
              listings: snap.listings,
              serverTime: snap.serverTime,
              onOpen: (l) => setState(() => _open = l),
            ),
          ),
          AppTab.market =>
            _open == null ? const SizedBox.shrink() : _listingView(),
          AppTab.sell => SellScreen(
            onCancel: () => setState(() => _tab = AppTab.home),
            onPublish: (draft) => runAction(
              context,
              () => ApiScope.of(context).createListing(
                plateType: draft.plateType,
                plateFormat: draft.plateFormat,
                arabicLetters: draft.arabicLetters,
                latinLetters: draft.latinLetters,
                plateNumbers: draft.plateNumbers,
                emblem: draft.emblem,
                saleType: draft.saleType,
                priceRiyals: draft.priceRiyals,
                durationSeconds: draft.durationSeconds,
                minimumIncrementRiyals: 500,
              ),
              success: 'نُشرت لوحتك في السوق',
            ),
          ),
          AppTab.activity when _chat && _openOrder != null =>
            AsyncView<ChatThread>(
              load: () => ApiScope.of(context).chat(_openOrder!.id),
              builder: (context, thread, reload) => ChatScreen(
                counterpartName: _openOrder!.youAreBuyer
                    ? _openOrder!.sellerName
                    : _openOrder!.buyerName,
                counterpartRole: _openOrder!.youAreBuyer ? 'البائع' : 'المشتري',
                orderReference: _openOrder!.reference,
                plateLabel: '${_openOrder!.letters} ${_openOrder!.number}',
                messages: thread.messages,
                onSend: (body) =>
                    ApiScope.of(context).sendMessage(_openOrder!.id, body),
                /* ويُطلَب الرقمُ في هاتف الجهاز — لا داخل التطبيق */
                onCall: _openOrder!.counterpartPhone == null
                    ? null
                    : () => _call(_openOrder!.counterpartPhone!),
                onBack: () => setState(() => _chat = false),
              ),
            ),
          AppTab.activity when _invoice && _openOrder != null =>
            AsyncView<List<TaxInvoice>>(
              load: () => ApiScope.of(context).invoices(_openOrder!.id),
              /*
               * **وفاتورةٌ لم تُصدَر بعد تُقال لا تُلفَّق.**
               *
               * فالعمولةُ تُفوتر عند اكتمال الصفقة لا عند نشأتها — ومن فتح
               * الفاتورةَ قبلها كانت الشاشةُ تحسب له رقمًا وضريبةً لا وجود
               * لهما في سجلّ المنصّة.
               */
              builder: (context, invoices, reload) => invoices.isEmpty
                  ? _noInvoiceYet()
                  : InvoiceScreen(
                      order: _openOrder!,
                      invoice: invoices.first,
                      onBack: () => setState(() => _invoice = false),
                    ),
            ),
          AppTab.activity when _openOrder != null => OrderScreen(
            order: _openOrder!,
            /* وكانت البطاقةُ مقفلةً أبدًا — لا تُمرَّر إليها بياناتٌ أصلًا */
            counterpartPhone: _openOrder!.counterpartPhone,
            counterpartId: _openOrder!.counterpartNationalId,
            onBack: () => setState(() => _openOrder = null),
            onOpenChat: () => setState(() => _chat = true),
            onOpenInvoice: () => setState(() => _invoice = true),
            onPay: () => _pay(_openOrder!),
            onConfirmIdentity: (nationalId, birth, cal) async {
              final sent = await runAction(
                context,
                () => ApiScope.of(context).confirmIdentity(
                  _openOrder!.id,
                  nationalId: nationalId,
                  birthDate: birth,
                  birthCalendar: cal == BirthCalendar.hijri
                      ? 'hijri'
                      : 'gregorian',
                ),
                success: 'وصلت بياناتك للبائع',
              );
              /* ومرحلةُ الصفقة تنتقل بوصولها — فتُعاد قراءتُها */
              if (sent) await _refreshOpenOrder();
              return sent;
            },
          ),
          /* ولوحةٌ فُتحت من «نشاطي» يرجع ظهرُها إلى «نشاطي» */
          AppTab.activity when _open != null => _listingView(),
          AppTab.activity => AsyncView<ActivityBundle>(
            load: () => ApiScope.of(context).activity(),
            builder: (context, a, reload) => ActivityScreen(
              pending: a.pending,
              myBids: a.myBids,
              myOffers: a.myOffers,
              watching: a.watching,
              serverTime: a.serverTime,
              /* والصفقةُ تُؤخذ من الحزمة التي في اليد — لا ندوةَ ثانية */
              onOpenOrder: (id) => setState(() {
                _openOrder = a.orders.where((o) => o.id == id).firstOrNull;
              }),
              onOpenListing: (l) => setState(() => _open = l),
              onOpenAuction: (id) => setState(() {
                _open = a.myBids.where((l) => l.id == id).firstOrNull;
              }),
            ),
          ),
          AppTab.account when _orders != null => AsyncView<OrdersBundle>(
            load: () => ApiScope.of(context).orders(),
            builder: (context, mine, reload) => OrdersScreen(
              purchases: mine.purchases,
              sales: mine.sales,
              startOnSales: _orders!,
              onBack: () => setState(() => _orders = null),
              /* وكرتُ الصفقة يفتح مسارَها في «نشاطي» — موضعُه */
              onOpen: (o) => setState(() {
                _orders = null;
                _openOrder = o;
                _tab = AppTab.activity;
              }),
            ),
          ),
          AppTab.account when _help => HelpScreen(
            onBack: () => setState(() => _help = false),
          ),
          AppTab.account when _notifs => AsyncView<List<AppNotification>>(
            load: () => ApiScope.of(context).notifications(),
            builder: (context, items, reload) => NotificationsScreen(
              items: items,
              onBack: () => setState(() => _notifs = false),
            ),
          ),
          /*
           * **ومعرضُ لوحاتي كان بذرةَ ديمو واسمًا مكتوبًا في الكود.**
           *
           * «وليد · @waleed · الرياض · سنتين» ولوحاتٌ من `demoOffers` —
           * فمن فتحه رأى حسابَ غيره. وهي علّةُ السوق نفسُها: شاشةٌ تُرسم من
           * البذرة لا من الخادم.
           */
          AppTab.account when _showcase => AsyncView<AccountBundle>(
            load: () => ApiScope.of(context).account(),
            builder: (context, me, reload) => ShowcaseScreen(
              name: me.profile.name,
              handle: me.profile.handle,
              city: me.profile.city,
              joined: me.profile.joinedLabel,
              plates: me.myPlates,
              onBack: () => setState(() => _showcase = false),
            ),
          ),
          AppTab.account when _settings => AsyncView<SettingsBundle>(
            load: () => ApiScope.of(context).settings(),
            builder: (context, bundle, reload) => SettingsScreen(
              initial: SettingsDraft(
                name: bundle.profile.name,
                handle: bundle.profile.handle.replaceFirst('@', ''),
                email: bundle.profile.email,
                city: bundle.profile.city,
              ),
              /* وما يمنع الحذفَ يُقرأ من الخادم — وكان دائمًا فارغًا */
              blockers: bundle.blockers,
              onBack: () => setState(() => _settings = false),
              onLogout: _logout,
              onDelete: _deleteAccount,
              onSave: (draft) => runAction(
                context,
                () => ApiScope.of(context).saveProfile(
                  displayName: draft.name,
                  city: draft.city,
                  snapchat: draft.snapchat,
                  tiktok: draft.tiktok,
                  instagram: draft.instagram,
                  iban: draft.iban.isEmpty ? null : draft.iban,
                  bankName: draft.bankName,
                  holderName: draft.holderName,
                ),
                success: 'حُفظت إعداداتك',
              ),
            ),
          ),
          AppTab.account when _wallet => AsyncView<WalletView>(
            load: () => ApiScope.of(context).wallet(),
            builder: (context, w, reload) => WalletScreen(
              wallet: w,
              onBack: () => setState(() => _wallet = false),
              onTopUp: () => _topUp(reload),
              onWithdraw: () => showToast(
                context,
                'طلب السحب يصل قريبًا — تواصل مع الإدارة حاليًا',
                kind: ToastKind.info,
              ),
            ),
          ),
          AppTab.account => AsyncView<AccountBundle>(
            load: () => ApiScope.of(context).account(),
            builder: (context, me, reload) => AccountScreen(
              name: me.profile.name,
              handle: me.profile.handle,
              membershipNumber: me.profile.membershipNumber,
              available: me.wallet.available,
              balance: me.wallet.balance,
              held: me.wallet.held,
              myPlates: me.myPlates,
              onOpenWallet: () => setState(() => _wallet = true),
              onOpenSettings: () => setState(() => _settings = true),
              onOpenNotifications: () => setState(() => _notifs = true),
              onOpenShowcase: () => setState(() => _showcase = true),
              onOpenHelp: () => setState(() => _help = true),
              onOpenOrders: (sales) => setState(() => _orders = sales),
            ),
          ),
        },
      ),
      /*
       * **والشاشاتُ الفرعيّةُ تُخفي شريطَ التبويب** — §4.
       *
       * فصفحةُ اللوحة تحمل شريطَها السفليَّ (مزايدةٌ أو شراء)، وشريطان
       * فوق بعضٍ يدفعان الإجراءَ خارج متناول الإبهام، والزرُّ الطافي يقع
       * على زرّ «زايد».
       */
      /* و«اعرض لوحتك» شاشةٌ كاملةٌ بزرّها السفليّ — فلا شريطَ فوقه */
      bottomNavigationBar:
          (_open != null ||
              _openOrder != null ||
              _wallet ||
              _settings ||
              _notifs ||
              _showcase ||
              _orders != null ||
              _help ||
              _chat ||
              _invoice ||
              _story != null ||
              _tab == AppTab.sell)
          ? null
          /*
           * **والزرُّ الطافي داخلَ حدود الشريط لا خارجَها.**
           *
           * فـ`Clip.none` يُظهر ما يخرج عن الكومة ولا يُمرّر إليه الضغط —
           * فكان الزرُّ يُرى ولا يعمل. فتُفسَح للشريط حشوةٌ علويّةٌ بمقدار
           * ارتفاعه، ويقع هو في أعلاها: الصورةُ نفسُها، والضغطُ يصل.
           */
          : Stack(
              alignment: Alignment.topCenter,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: SellButton.lift),
                  child: AppTabBar(
                    current: _tab,
                    onSelect: (t) => switch (t) {
                      AppTab.activity => _openGatedTab(t, GatedAction.orders),
                      AppTab.account => _openGatedTab(t, GatedAction.wallet),
                      _ => setState(() => _tab = t),
                    },
                    pendingCount: 3,
                  ),
                ),
                SellButton(
                  onTap: () => _openGatedTab(AppTab.sell, GatedAction.sell),
                ),
                Positioned(
                  top: SellButton.diameter + 1,
                  child: Text(
                    'اعرض لوحتك',
                    style: AppText.body(10.5, color: AppColors.neutral600),
                  ),
                ),
              ],
            ),
    );
  }
}
