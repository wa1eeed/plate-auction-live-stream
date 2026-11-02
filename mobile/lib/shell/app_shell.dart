import 'package:flutter/material.dart';

import '../api/api_scope.dart';
import '../api/mazad_api.dart';
import '../auth/auth_flow.dart';
import '../auth/auth_gate.dart';
import '../auth/session.dart';
import '../design/tokens.dart';
import '../widgets/common/async_view.dart';
import '../models/demo_data.dart';
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
import '../screens/notifications_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/showcase_screen.dart';
import '../screens/account_screen.dart';
import '../screens/wallet_screen.dart';
import '../screens/market_screen.dart';
import '../models/listing.dart';
import '../widgets/listing/price_box.dart';
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
                : ListingScreen(
                    listing: _open!,
                    serverTime: _now,
                    viewers: 100,
                    depositHalalas: 500000,
                    reserve: ReserveState.notMet,
                    sellerName: 'وليد المطيري',
                    bids: demoBids(_now),
                    onBack: () => setState(() => _open = null),
                  ),
          AppTab.sell => SellScreen(
            onCancel: () => setState(() => _tab = AppTab.home),
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
          ),
          AppTab.activity => ActivityScreen(
            onOpenOrder: () => setState(() => _order = true),
            pending: demoPending(),
            myBids: demoAuctions(_now),
            myOffers: demoOffers(_now),
            watching: demoFixed(_now),
            serverTime: _now,
          ),
          AppTab.account when _help => HelpScreen(
            onBack: () => setState(() => _help = false),
          ),
          AppTab.account when _notifs => NotificationsScreen(
            items: demoNotifications(_now),
            onBack: () => setState(() => _notifs = false),
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
          AppTab.account when _wallet => WalletScreen(
            wallet: demoWallet(_now),
            onBack: () => setState(() => _wallet = false),
          ),
          AppTab.account => AccountScreen(
            name: 'وليد',
            handle: '@waleed',
            membershipNumber: 'U26-00001',
            available: demoWallet(_now).available,
            balance: demoWallet(_now).balance,
            held: demoWallet(_now).held,
            myPlates: demoOffers(_now) + demoFixed(_now).take(1).toList(),
            onOpenWallet: () => setState(() => _wallet = true),
            onOpenSettings: () => setState(() => _settings = true),
            onOpenNotifications: () => setState(() => _notifs = true),
            onOpenShowcase: () => setState(() => _showcase = true),
            onOpenHelp: () => setState(() => _help = true),
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
