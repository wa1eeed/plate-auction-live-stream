import 'package:flutter/material.dart';

import '../api/api_scope.dart';
import '../api/mapping.dart';
import '../api/mazad_api.dart';
import '../auth/auth_flow.dart';
import '../auth/auth_gate.dart';
import '../auth/session.dart';
import '../design/tokens.dart';
import '../widgets/common/async_view.dart';
import '../widgets/common/toast.dart';
import '../widgets/order/identity_form.dart';
import '../models/demo_data.dart';
import '../models/wallet.dart';
import '../screens/notifications_screen.dart';
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

  /* صفقةٌ مفتوحةٌ فوق «نشاطي» */
  bool _order = false;

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
  Future<void> _openGatedTab(AppTab tab, GatedAction action) async {
    if (await _gate(action)) {
      if (mounted) setState(() => _tab = tab);
    }
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
          AppTab.home => AsyncView<MarketSnapshot>(
            load: () => ApiScope.of(context).listings(),
            builder: (context, snap, reload) => HomeScreen(
              listings: snap.listings,
              serverTime: snap.serverTime,
              onOpenStory: (s) => setState(() => _story = s),
            ),
          ),
          AppTab.market =>
            _open == null
                ? MarketScreen(
                    listings: demoAll(_now),
                    serverTime: _now,
                    onOpen: (l) => setState(() => _open = l),
                  )
                : AsyncView<ListingDetailView>(
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
                    ),
                  ),
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
          AppTab.activity when _chat => ChatScreen(
            counterpartName: 'فهد',
            counterpartRole: 'البائع',
            orderReference: 'S26-00087',
            plateLabel: 'ق و س 1',
            messages: demoChat(_now),
            onBack: () => setState(() => _chat = false),
          ),
          AppTab.activity when _invoice => InvoiceScreen(
            order: demoOrder(_now),
            commission: 82000,
            onBack: () => setState(() => _invoice = false),
          ),
          AppTab.activity when _order => OrderScreen(
            order: demoOrder(_now),
            onBack: () => setState(() => _order = false),
            onOpenChat: () => setState(() => _chat = true),
            onOpenInvoice: () => setState(() => _invoice = true),
            onConfirmIdentity: (id, birth, cal) => runAction(
              context,
              () => ApiScope.of(context).confirmIdentity(
                demoOrder(_now).reference,
                nationalId: id,
                birthDate: birth,
                birthCalendar: cal == BirthCalendar.hijri
                    ? 'hijri'
                    : 'gregorian',
              ),
              success: 'وصلت بياناتك للبائع',
            ),
          ),
          AppTab.activity => AsyncView<ActivityBundle>(
            load: () => ApiScope.of(context).activity(),
            builder: (context, a, reload) => ActivityScreen(
              pending: a.pending,
              myBids: a.myBids,
              myOffers: a.myOffers,
              watching: a.watching,
              serverTime: a.serverTime,
              onOpenOrder: () => setState(() => _order = true),
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
          AppTab.account when _showcase => ShowcaseScreen(
            name: 'وليد',
            handle: '@waleed',
            city: 'الرياض',
            joined: 'سنتين',
            plates: demoOffers(_now) + demoFixed(_now),
            onBack: () => setState(() => _showcase = false),
          ),
          AppTab.account when _settings => SettingsScreen(
            blockers: const [
              DeletionBlocker('عربون محجوز', '11,500 ر.س على 3 مزادات'),
              DeletionBlocker('لوحات معروضة', '3 لوحات في السوق'),
            ],
            onBack: () => setState(() => _settings = false),
          ),
          AppTab.account when _wallet => AsyncView<WalletView>(
            load: () => ApiScope.of(context).wallet(),
            builder: (context, w, reload) => WalletScreen(
              wallet: w,
              onBack: () => setState(() => _wallet = false),
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
              _order ||
              _wallet ||
              _settings ||
              _notifs ||
              _showcase ||
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
