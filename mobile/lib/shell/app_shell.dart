import 'package:flutter/material.dart';

import '../design/tokens.dart';
import '../models/demo_data.dart';
import '../screens/activity_screen.dart';
import '../screens/listing_screen.dart';
import '../screens/order_screen.dart';
import '../screens/market_screen.dart';
import '../models/listing.dart';
import '../widgets/listing/price_box.dart';
import 'tab_bar.dart';

/// **هيكلُ التطبيق** — الشاشاتُ الخمسُ وشريطُها السفليّ.
///
/// والزرُّ الدائريُّ يُرسم **فوق** الشريط لا فيه: يرتفع ‎٣٠‎ بكسلًا بحدٍّ بلون
/// الخلفية، فلو كان عنصرًا في الصفّ لقُصّ عند حافّته.
class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.home});

  final Widget home;

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        bottom: false,
        child: switch (_tab) {
          AppTab.home => widget.home,
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
          AppTab.sell => const _Soon(label: 'اعرض لوحتك'),
          AppTab.activity when _order => OrderScreen(
            order: demoOrder(_now),
            onBack: () => setState(() => _order = false),
          ),
          AppTab.activity => ActivityScreen(
            onOpenOrder: () => setState(() => _order = true),
            pending: demoPending(),
            myBids: demoAuctions(_now),
            myOffers: demoOffers(_now),
            watching: demoFixed(_now),
            serverTime: _now,
          ),
          AppTab.account => const _Soon(label: 'حسابي'),
        },
      ),
      /*
       * **والشاشاتُ الفرعيّةُ تُخفي شريطَ التبويب** — §4.
       *
       * فصفحةُ اللوحة تحمل شريطَها السفليَّ (مزايدةٌ أو شراء)، وشريطان
       * فوق بعضٍ يدفعان الإجراءَ خارج متناول الإبهام، والزرُّ الطافي يقع
       * على زرّ «زايد».
       */
      bottomNavigationBar: (_open != null || _order)
          ? null
          : Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.topCenter,
              children: [
                AppTabBar(
                  current: _tab,
                  onSelect: (t) => setState(() => _tab = t),
                  pendingCount: 3,
                ),
                Positioned(
                  top: -SellButton.lift,
                  child: SellButton(
                    onTap: () => setState(() => _tab = AppTab.sell),
                  ),
                ),
                Positioned(
                  top: SellButton.diameter - SellButton.lift + 1,
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

class _Soon extends StatelessWidget {
  const _Soon({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) =>
      Center(child: Text(label, style: AppText.heading(18)));
}
