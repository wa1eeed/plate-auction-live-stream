import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../plate.dart';

/// **بنراتُ الرئيسية — ثلاثُ شرائحَ تُسحب أفقيًّا.**
///
/// **وارتفاعُها ثابتٌ ‎١٧٧‎ بكسلًا، قرارٌ صريح: لا يكبر.** فبنرٌ يتمدّد بطول
/// نصّه يدفع الكاروسيلات تحت الطيّة، ومن فتح الرئيسية لا يرى لوحةً واحدة.
class HomeBanners extends StatefulWidget {
  const HomeBanners({
    super.key,
    this.onSell,
    this.onMarket,
    this.onWallet,
    this.initialPage = 0,
  });

  /// الصفحةُ التي يُفتح عليها — للفحص، وافتراضُها الأولى.
  final int initialPage;

  final VoidCallback? onSell;
  final VoidCallback? onMarket;
  final VoidCallback? onWallet;

  static const height = 177.0;
  static const width = 354.0;

  @override
  State<HomeBanners> createState() => _HomeBannersState();
}

class _HomeBannersState extends State<HomeBanners> {
  late final _controller = PageController(
    viewportFraction: 0.955,
    initialPage: widget.initialPage,
  );
  late int _page = widget.initialPage;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        SizedBox(
          height: HomeBanners.height,
          child: PageView(
            controller: _controller,
            onPageChanged: (i) => setState(() => _page = i),
            children: [
              _SellSafelyBanner(onSell: widget.onSell),
              _ThreeWaysBanner(onTap: widget.onMarket),
              _DepositBanner(onTap: widget.onWallet),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(3, (i) {
            final active = i == _page;
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: active ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: active ? AppColors.accent : AppColors.neutral300,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
            );
          }),
        ),
      ],
    );
  }
}

/// غلافٌ مشتركٌ: انحناءٌ ‎١٦‎ وهامشٌ جانبيّ.
class _Banner extends StatelessWidget {
  const _Banner({required this.gradient, required this.child, this.onTap});

  final Gradient gradient;
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 18),
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(AppRadii.banner),
        ),
        clipBehavior: Clip.antiAlias,
        child: child,
      ),
    ),
  );
}

/// **١ — بيع واشترِ بأمان.** أخضرُ داكنٌ، ونصٌّ بلهجةٍ خفيفة.
class _SellSafelyBanner extends StatelessWidget {
  const _SellSafelyBanner({this.onSell});
  final VoidCallback? onSell;

  @override
  Widget build(BuildContext context) {
    return _Banner(
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.accent700, AppColors.accent900],
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: _StripesPainter())),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                /// **عمودُ النصّ لا يتجاوز نصفَ العرض** — واللوحاتُ تأخذ الباقي.
                SizedBox(
                  width: (HomeBanners.width - 32) * 0.5,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'بيع واشترِ بأمان',
                        style: AppText.body(
                          11.5,
                          color: AppColors.accent200,
                          weight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'عندك لوحة مميزة؟',
                        style: AppText.heading(17)
                            .copyWith(color: Colors.white),
                      ),
                      Text(
                        'بيعها بسعرها العادل',
                        style: AppText.body(13.5, color: Colors.white),
                      ),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: onSell,
                        behavior: HitTestBehavior.opaque,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 9,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                          ),
                          child: Text(
                            'اعرض لوحتك',
                            style: AppText.body(
                              12.5,
                              color: AppColors.accent800,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),

                /// **أربعُ لوحاتٍ مرتّبةٍ بلا ميلان، وكلُّها «ق و س 1»**.
                const Expanded(child: _BannerPlates()),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BannerPlates extends StatelessWidget {
  const _BannerPlates();

  @override
  Widget build(BuildContext context) {
    /*
     * **وكلُّ صفٍّ يأخذ حصّتَه من الارتفاع لا من العرض وحده.**
     *
     * فاللوحةُ تُحسب من أضيق القيدين، وصفٌّ بلا حدٍّ رأسيّ يأخذ العرضَ كلَّه
     * فيعلو بنسبته — وعلى شاشةٍ أعرض (لوحيّ، أو نافذةٌ ممدودة) يتجاوز
     * مجموعُها ارتفاعَ البنر الثابتَ ‎١٧٧‎ فتفيض. و`Expanded` يُعطي كلَّ صفٍّ
     * حدًّا رأسيًّا، فتصغر اللوحةُ لتسعَه.
     */
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SaudiPlate(letters: 'ق و س', number: '1'),
        ),
        SizedBox(height: 6),
        Expanded(
          child: SaudiPlate(
            letters: 'ق و س',
            number: '1',
            format: PlateFormat.sport,
          ),
        ),
        SizedBox(height: 6),
        Expanded(
          child: Row(
            children: [
              Expanded(
                child: SaudiPlate(
                  letters: 'ق و س',
                  number: '1',
                  format: PlateFormat.standard,
                ),
              ),
              SizedBox(width: 6),
              Expanded(
                child: SaudiPlate(
                  letters: 'ق و س',
                  number: '1',
                  kind: PlateKind.transport,
                  format: PlateFormat.standard,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// خطوطٌ مائلةٌ خفيفةٌ خلف البنر الأوّل.
class _StripesPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.04)
      ..strokeWidth = 14;
    for (var x = -size.height; x < size.width; x += 34) {
      canvas.drawLine(
        Offset(x, size.height),
        Offset(x + size.height, 0),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// **٢ — ثلاثُ خياراتٍ للبيع والشراء.** والعنوانُ في سطرٍ واحد.
class _ThreeWaysBanner extends StatelessWidget {
  const _ThreeWaysBanner({this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _Banner(
      onTap: onTap,
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.neutral800, AppColors.neutral900],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: (HomeBanners.width - 32) * 0.52,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ثلاث خيارات للبيع والشراء',
                    maxLines: 1,
                    overflow: TextOverflow.visible,
                    softWrap: false,
                    style: AppText.heading(15).copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  for (final (icon, label) in const [
                    (Icons.gavel_rounded, 'مزاد'),
                    (Icons.sell_rounded, 'سعر مباشر'),
                    (Icons.chat_bubble_rounded, 'سوم'),
                  ]) ...[
                    Row(
                      children: [
                        Icon(icon, size: 15, color: AppColors.neutral300),
                        const SizedBox(width: 7),
                        Text(
                          label,
                          style: AppText.body(12.5, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 7),
                  ],
                ],
              ),
            ),
            const Expanded(child: _FloatingCards()),
          ],
        ),
      ),
    );
  }
}

/// **ثلاثُ بطاقاتٍ بيضاءَ تطفو** — بتأخيراتٍ مختلفةٍ وميلانٍ لكلٍّ منها.
///
/// **وتتوقّف مع `prefers-reduced-motion`**: حركةٌ دائمةٌ في زاوية الشاشة
/// تُتعب من يتأثّر بها، والقرارُ قرارُ المستخدم في إعدادات جهازه لا قرارُنا.
class _FloatingCards extends StatefulWidget {
  const _FloatingCards();

  @override
  State<_FloatingCards> createState() => _FloatingCardsState();
}

class _FloatingCardsState extends State<_FloatingCards>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 4200),
  );

  @override
  void initState() {
    super.initState();
    _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced =
        MediaQuery.disableAnimationsOf(context) ||
        MediaQuery.maybeOf(context)?.accessibleNavigation == true;
    if (reduced) _c.stop();

    const specs = <(String, String, double, double)>[
      ('مزاد', '٠٠:٠٥:١٢', -6, 0),
      ('سعر مباشر', '35,000', 3, 0.33),
      ('سوم', 'قدّم سومك', -2, 0.66),
    ];

    return Stack(
      alignment: Alignment.center,
      children: [
        for (final (title, body, tilt, phase) in specs)
          AnimatedBuilder(
            animation: _c,
            builder: (context, child) {
              final t = reduced ? 0.0 : ((_c.value + phase) % 1) * 2 - 1;
              return Transform.translate(
                offset: Offset(0, t * 5),
                child: Transform.rotate(
                  angle: tilt * 3.1415926 / 180,
                  child: child,
                ),
              );
            },
            child: _MiniCard(title: title, body: body, phase: phase),
          ),
      ],
    );
  }
}

class _MiniCard extends StatelessWidget {
  const _MiniCard({
    required this.title,
    required this.body,
    required this.phase,
  });

  final String title;
  final String body;
  final double phase;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment(0, (phase - 0.33) * 2.6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [
            BoxShadow(
              offset: Offset(0, 3),
              blurRadius: 10,
              color: Color(0x33000000),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: AppText.body(
                9.5,
                color: AppColors.neutral600,
                weight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 2),
            Text(body, style: AppText.digits(12)),
          ],
        ),
      ),
    );
  }
}

/// **٣ — ضمانُ الجدّية.** أخضرُ sage، وثلاثُ خطواتٍ كلٌّ في سطرٍ واحد.
class _DepositBanner extends StatelessWidget {
  const _DepositBanner({this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _Banner(
      onTap: onTap,
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.accent2_700, AppColors.accent2_900],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: (HomeBanners.width - 32) * 0.62,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.verified_user_rounded,
                        size: 17,
                        color: Colors.white,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'ضمان الجدّية',
                        style: AppText.heading(15)
                            .copyWith(color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'عربون يحمي كل مزاد',
                    style: AppText.body(12, color: AppColors.accent2_200),
                  ),
                  const SizedBox(height: 6),

                  /// **كلُّ خطوةٍ في سطرٍ واحد** — قرارٌ صريح، ‎١٠٫٥‎ بلا التفاف.
                  for (final step in const [
                    'يُحجز من محفظتك مع أول مزايدة',
                    'يعود فورًا إن لم ترسُ عليك',
                    'يُخصم من قيمة اللوحة إن فزت',
                  ]) ...[
                    Row(
                      children: [
                        const Icon(
                          Icons.check_rounded,
                          size: 13,
                          color: AppColors.accent2_300,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          step,
                          maxLines: 1,
                          softWrap: false,
                          overflow: TextOverflow.visible,
                          style: AppText.body(10.5, color: Colors.white),
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                  ],
                ],
              ),
            ),
            const Expanded(child: _WalletBadge()),
          ],
        ),
      ),
    );
  }
}

/// بطاقةُ «محفظتك» مع شارة الدرع — يسارَ البنر الثالث.
class _WalletBadge extends StatelessWidget {
  const _WalletBadge();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.shield_rounded, size: 22, color: Colors.white),
            const SizedBox(height: 6),
            Text(
              'محفظتك',
              style: AppText.body(10.5, color: AppColors.accent2_200),
            ),
            const SizedBox(height: 4),
            Container(
              width: 56,
              height: 5,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                widthFactor: 0.28,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.accent2_200,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
