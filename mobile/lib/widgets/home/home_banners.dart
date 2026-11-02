import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

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
    required this.nearestAuctionEnd,
    this.availableHalalas = 0,
  });

  /// نهايةُ أقرب مزادٍ — عدّادُ بطاقة البنر الثاني حيٌّ منه.
  final DateTime nearestAuctionEnd;

  /// الرصيدُ المتاح — يظهر في بطاقة المحفظة بالبنر الثالث.
  final int availableHalalas;

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
  PageController? _controller;
  late int _page = widget.initialPage;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        /*
       * **وعرضُ البنر ‎٣٥٤‎ بالضبط على ‎٣٩٠‎** — أي العرضُ ناقصَ هامشَين ‎١٨‎.
       *
       * والنموذجُ شريطٌ أفقيٌّ بـ`scroll-snap`: هامشٌ ‎١٨‎ وفجوةٌ ‎١٠‎ وعنصرٌ
       * ‎٣٥٤‎. و`PageView` يُقسّم العرضَ صفحاتٍ بكسرٍ منه، فيُحسب الكسرُ
       * ليُطابق: خانةُ الصفحة = ‎٣٥٤‎ + ‎١٠‎، وداخلها هامشٌ ‎٥‎ من كلّ جهة.
       * فالبنرُ المستقرُّ يقع من ‎١٨‎ إلى ‎٣٧٢‎، والذي يليه يبدأ عند ‎٣٨٢‎ —
       * فجوةٌ ‎١٠‎ تمامًا كما في النموذج.
       */
        final slot = (w - 36) + 10;
        return Column(
          children: [
            SizedBox(
              height: HomeBanners.height,
              child: PageView(
                controller: _pageController(slot / w),
                onPageChanged: (i) => setState(() => _page = i),
                children: [
                  _SellSafelyBanner(onSell: widget.onSell),
                  _ThreeWaysBanner(
                    onTap: widget.onMarket,
                    nearestEnd: widget.nearestAuctionEnd,
                  ),
                  _DepositBanner(
                    onTap: widget.onWallet,
                    availableHalalas: widget.availableHalalas,
                  ),
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
      },
    );
  }

  /// يُنشئ المتحكّمَ عند أوّل بناءٍ بالكسر المحسوب من العرض.
  PageController _pageController(double fraction) {
    final existing = _controller;
    if (existing != null) return existing;
    return _controller = PageController(
      viewportFraction: fraction,
      initialPage: widget.initialPage,
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
///
/// **ولوحاتُه الأربعُ مُطلقةُ الموضع بمقاساتها** كما في النموذج، لا عمودٌ
/// مرنٌ يوزّعها: فكلٌّ لها عرضُها وإزاحتُها، وهي متداخلةٌ قليلًا بعضُها فوق
/// بعض — وتوزيعٌ متساوٍ يُفقدها هذا التراكبَ ويجعلها صفًّا مرصوصًا.
class _SellSafelyBanner extends StatelessWidget {
  const _SellSafelyBanner({this.onSell});
  final VoidCallback? onSell;

  /// ظلُّ اللوحات: `drop-shadow(0 4px 8px rgba(0,0,0,.25))`.
  static const _plateShadow = [
    BoxShadow(offset: Offset(0, 4), blurRadius: 8, color: Color(0x40000000)),
  ];

  @override
  Widget build(BuildContext context) {
    return _Banner(
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.accent700, AppColors.accent900],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned.fill(child: CustomPaint(painter: _StripesPainter())),

          /* طويلةٌ خصوصي: عرض ‎١٥٠‎ · من الطرف ‎١٤‎ · من الأعلى ‎١٨‎ */
          const _BannerPlate(
            width: 150,
            end: 14,
            top: 18,
            plate: SaudiPlate(letters: 'ق و س', number: '1'),
          ),
          /* رياضيّة: عرض ‎١٨٣‎ · من الطرف ‎‑٢٫٥‎ · من الأعلى ‎٥٨‎ */
          const _BannerPlate(
            width: 183,
            end: -2.5,
            top: 58,
            plate: SaudiPlate(
              letters: 'ق و س',
              number: '1',
              format: PlateFormat.sport,
            ),
          ),
          /* اعتياديّةٌ نقل: عرض ‎١٠٤‎ · من الطرف ‎‑٢‎ · من الأعلى ‎١٠٦‎ */
          const _BannerPlate(
            width: 104,
            end: -2,
            top: 106,
            plate: SaudiPlate(
              letters: 'ق و س',
              number: '1',
              kind: PlateKind.transport,
              format: PlateFormat.standard,
            ),
          ),
          /* اعتياديّةٌ خصوصي: عرض ‎١٠٤‎ · من الطرف ‎٧٦‎ · من الأعلى ‎١٠٦‎ */
          const _BannerPlate(
            width: 104,
            end: 76,
            top: 106,
            plate: SaudiPlate(
              letters: 'ق و س',
              number: '1',
              format: PlateFormat.standard,
            ),
          ),

          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /// **وعمودُ النصّ لا يتجاوز نصفَ العرض** — واللوحاتُ تأخذ الباقي.
                FractionallySizedBox(
                  widthFactor: 0.5,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Opacity(
                        opacity: 0.8,
                        child: Text(
                          'بيع واشترِ بأمان',
                          style: AppText.body(
                            11,
                            color: AppColors.neutral100,
                            weight: FontWeight.w700,
                          ).copyWith(letterSpacing: 0.44),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'عندك لوحة مميزة؟',
                        style: AppText.heading(
                          19,
                        ).copyWith(color: AppColors.neutral100, height: 1.35),
                      ),
                      const SizedBox(height: 6),
                      Opacity(
                        opacity: 0.9,
                        child: Text(
                          'بيعها بسعرها العادل',
                          style: AppText.body(
                            14,
                            color: AppColors.neutral100,
                            weight: FontWeight.w600,
                          ).copyWith(height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),

                /// زرٌّ بارتفاعِ ‎٣٨‎ وحشوةٍ أفقيّةٍ ‎١٨‎.
                GestureDetector(
                  onTap: onSell,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    decoration: BoxDecoration(
                      color: AppColors.neutral100,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    /*
                     * **ولا `alignment` على الحاوية**: ضبطُه يجعلها تملأ
                     * العرضَ المتاح، فيمتدّ الزرُّ عبر البنر ويقع على
                     * اللوحات. والزرُّ في النموذج بحجم نصّه وحشوتِه.
                     */
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        'اعرض لوحتك',
                        style: AppText.body(
                          13,
                          color: AppColors.accent900,
                          weight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// لوحةٌ في البنر: عرضُها وإزاحتُها من النموذج حرفًا بحرف.
class _BannerPlate extends StatelessWidget {
  const _BannerPlate({
    required this.width,
    required this.end,
    required this.top,
    required this.plate,
  });

  final double width;
  final double end;
  final double top;
  final SaudiPlate plate;

  @override
  Widget build(BuildContext context) => PositionedDirectional(
    end: end,
    top: top,
    width: width,
    child: DecoratedBox(
      decoration: const BoxDecoration(
        boxShadow: _SellSafelyBanner._plateShadow,
      ),
      child: plate,
    ),
  );
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

/// **٢ — ثلاثُ خياراتٍ للبيع والشراء.**
///
/// والعنوانُ في **سطرٍ واحد** (قرارٌ صريح)، وثلاثةُ صفوفٍ بأيقوناتٍ في
/// مربّعاتٍ ‎٢٦‎ بشفافيةِ ‎١٤٪‎. ويسارًا ثلاثُ بطاقاتٍ بيضاءَ تطفو.
class _ThreeWaysBanner extends StatelessWidget {
  const _ThreeWaysBanner({this.onTap, required this.nearestEnd});

  final VoidCallback? onTap;

  /// نهايةُ **أقرب مزادٍ فعليّ** — فعدّادُ البطاقة حيٌّ لا رقمٌ مكتوب.
  final DateTime nearestEnd;

  @override
  Widget build(BuildContext context) {
    return _Banner(
      onTap: onTap,
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.neutral800, AppColors.neutral900],
      ),
      child: Stack(
        children: [
          Positioned.fill(child: CustomPaint(painter: _StripesPainter())),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                widthFactor: 0.5,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ثلاث خيارات للبيع والشراء',
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.visible,
                      style: AppText.heading(15)
                          .copyWith(color: AppColors.neutral100, height: 1.35),
                    ),
                    const SizedBox(height: 7),
                    for (final (icon, label) in const [
                      (LucideIcons.gavel, 'مزاد'),
                      (LucideIcons.tag, 'سعر مباشر'),
                      (LucideIcons.messageCircle, 'سوم'),
                    ]) ...[
                      Row(
                        children: [
                          Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: AppColors.neutral100.withValues(
                                alpha: 0.14,
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Icon(
                              icon,
                              size: 14,
                              color: AppColors.neutral100,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            label,
                            style: AppText.body(
                              13,
                              color: AppColors.neutral100,
                              weight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 7),
                    ],
                  ],
                ),
              ),
            ),
          ),
          /* **والبطاقاتُ مُطلقةُ الموضع كما في النموذج** — لا في صفٍّ مرن */
          _FloatCard(
            end: 26,
            top: 12,
            tilt: -6,
            phase: 0,
            child: _AuctionMiniCard(endsAt: nearestEnd),
          ),
          const _FloatCard(
            end: 10,
            top: 58,
            tilt: 3,
            phase: -1.4,
            child: _FixedMiniCard(),
          ),
          const _FloatCard(
            end: 30,
            top: 104,
            tilt: -2,
            phase: -2.8,
            child: _OfferMiniCard(),
          ),
        ],
      ),
    );
  }
}

/// **بطاقةٌ تطفو** — `floatA 4.2s`: ترتفع ‎٥‎ بكسلات وتُرجِع ميلانَها إلى
/// ‎‑٠٫٤‎ من قيمته، ولكلٍّ تأخيرُها فلا تتحرّك الثلاثُ معًا.
///
/// **وتتوقّف مع `prefers-reduced-motion`**: حركةٌ دائمةٌ في زاوية الشاشة
/// تُتعب من يتأثّر بها، والقرارُ في إعدادات جهازه لا عندنا.
class _FloatCard extends StatefulWidget {
  const _FloatCard({
    required this.end,
    required this.top,
    required this.tilt,
    required this.phase,
    required this.child,
  });

  final double end;
  final double top;

  /// الميلانُ بالدرجات — `--r` في النموذج.
  final double tilt;

  /// تأخيرُ بدء الحركة بالثواني (سالبٌ: تبدأ وهي في منتصفها).
  final double phase;

  final Widget child;

  @override
  State<_FloatCard> createState() => _FloatCardState();
}

class _FloatCardState extends State<_FloatCard>
    with SingleTickerProviderStateMixin {
  static const _period = Duration(milliseconds: 4200);

  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: _period,
  );

  @override
  void initState() {
    super.initState();
    _c.value = (widget.phase / 4.2) % 1;
    _c.repeat();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced && _c.isAnimating) {
      _c.stop();
    }

    const rad = 3.1415926535 / 180;
    return PositionedDirectional(
      end: widget.end,
      top: widget.top,
      width: 132,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          /* منحنى `ease-in-out` ذهابًا وإيابًا: ‎٠→‎١→‎٠ */
          final wave = reduced
              ? 0.0
              : Curves.easeInOut.transform(
                  _c.value < 0.5 ? _c.value * 2 : (1 - _c.value) * 2,
                );
          return Transform.translate(
            offset: Offset(0, -5 * wave),
            child: Transform.rotate(
              angle: widget.tilt * (1 - 1.4 * wave) * rad,
              child: child,
            ),
          );
        },
        child: widget.child,
      ),
    );
  }
}

/// غلافُ البطاقة البيضاء الصغيرة.
class _MiniCard extends StatelessWidget {
  const _MiniCard({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 8),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(12),
      boxShadow: const [
        BoxShadow(
          offset: Offset(0, 6),
          blurRadius: 14,
          color: Color(0x40000000),
        ),
      ],
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );
}

/// عنوانُ البطاقة: نقطةٌ ملوّنةٌ ثمّ نصّ.
class _MiniHead extends StatelessWidget {
  const _MiniHead({
    required this.color,
    required this.label,
    this.pulse = false,
  });

  final Color color;
  final String label;
  final bool pulse;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      pulse ? _PulsingDot(color: color) : _StaticDot(color: color),
      const SizedBox(width: 6),
      Text(label, style: AppText.body(11, weight: FontWeight.w700)),
    ],
  );
}

class _StaticDot extends StatelessWidget {
  const _StaticDot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    width: 7,
    height: 7,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

/// نقطةٌ نابضة — `pulse 1.2s`: شفافيةٌ ‎١→‎٠٫٣٥→‎١.
class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});
  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context) && _c.isAnimating) {
      _c.stop();
    }
    return FadeTransition(
      opacity: Tween<double>(begin: 1, end: 0.35).animate(_c),
      child: _StaticDot(color: widget.color),
    );
  }
}

/// بطاقةُ المزاد — **بعدّادٍ حيٍّ من أقرب مزاد**، لا رقمٍ مكتوب.
class _AuctionMiniCard extends StatelessWidget {
  const _AuctionMiniCard({required this.endsAt});
  final DateTime endsAt;

  @override
  Widget build(BuildContext context) => _MiniCard(
    children: [
      const _MiniHead(
        color: AppColors.accent400,
        label: 'مزاد · ينتهي خلال',
        pulse: true,
      ),
      const SizedBox(height: 6),
      _LiveClock(endsAt: endsAt),
    ],
  );
}

/// ساعةُ `HH : MM : SS` — تُقرأ يسارًا ولو كان ما حولها عربيًّا.
class _LiveClock extends StatefulWidget {
  const _LiveClock({required this.endsAt});
  final DateTime endsAt;

  @override
  State<_LiveClock> createState() => _LiveClockState();
}

class _LiveClockState extends State<_LiveClock> {
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    var left = widget.endsAt.difference(DateTime.now());
    if (left.isNegative) left = Duration.zero;
    two(int n) => n.toString().padLeft(2, '0');
    final text =
        '${two(left.inHours)} : ${two(left.inMinutes % 60)} : ${two(left.inSeconds % 60)}';

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Text(text, textAlign: TextAlign.end, style: AppText.digits(14)),
    );
  }
}

/// بطاقةُ السعر المباشر — مبلغٌ ووسمُ «اشترِ الآن».
class _FixedMiniCard extends StatelessWidget {
  const _FixedMiniCard();

  @override
  Widget build(BuildContext context) => _MiniCard(
    children: [
      const _MiniHead(color: AppColors.accent2_300, label: 'سعر مباشر'),
      const SizedBox(height: 6),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('35,000', style: AppText.digits(14)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.accent2_700,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              'اشترِ الآن',
              style: AppText.body(
                9.5,
                color: AppColors.neutral100,
                weight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    ],
  );
}

/// بطاقةُ السوم — **ثلاثُ نقاطِ كتابةٍ** تتوالى بتأخيرِ ‎٠٫١٥‎ ثانية.
class _OfferMiniCard extends StatelessWidget {
  const _OfferMiniCard();

  @override
  Widget build(BuildContext context) => _MiniCard(
    children: [
      const _MiniHead(color: AppColors.neutral400, label: 'سوم'),
      const SizedBox(height: 6),
      Row(
        children: [
          Text('قدّم سومك', style: AppText.body(13, weight: FontWeight.w700)),
          const SizedBox(width: 6),
          const _TypingDots(),
        ],
      ),
    ],
  );
}

/// `dotB 1.2s` — كلُّ نقطةٍ تُضيء وترتفع ‎٣‎ بكسلات ثمّ تخفت.
class _TypingDots extends StatefulWidget {
  const _TypingDots();

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced && _c.isAnimating) {
      _c.stop();
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (i) {
        return AnimatedBuilder(
          animation: _c,
          builder: (context, child) {
            if (reduced) return Opacity(opacity: 0.25, child: child);
            final t = (_c.value + i * 0.125) % 1;
            /* ذروةُ النقطة عند ‎٤٠٪‎ ثمّ تخفت حتى ‎٨٠٪‎ */
            final lift = t < 0.4 ? t / 0.4 : (t < 0.8 ? (0.8 - t) / 0.4 : 0.0);
            return Transform.translate(
              offset: Offset(0, -3 * lift),
              child: Opacity(opacity: 0.25 + 0.75 * lift, child: child),
            );
          },
          child: Container(
            width: 4,
            height: 4,
            margin: EdgeInsets.only(right: i == 2 ? 0 : 3),
            decoration: const BoxDecoration(
              color: AppColors.text,
              shape: BoxShape.circle,
            ),
          ),
        );
      }),
    );
  }
}

/// **٣ — ضمانُ الجدّية.** أخضرُ sage، وبطاقةُ محفظةٍ وشارةُ درعٍ تدور.
class _DepositBanner extends StatelessWidget {
  const _DepositBanner({this.onTap, required this.availableHalalas});

  final VoidCallback? onTap;
  final int availableHalalas;

  @override
  Widget build(BuildContext context) {
    return _Banner(
      onTap: onTap,
      gradient: const LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.accent2_700, AppColors.accent2_900],
      ),
      child: Stack(
        children: [
          /* هالةٌ دائريّةٌ خفيفةٌ عند ‎١٨٪‎ عرضًا و‎٧٠٪‎ ارتفاعًا */
          Positioned.fill(child: CustomPaint(painter: _GlowPainter())),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                /*
                 * **والعنوانُ وحدَه داخل صندوق الـ‎٥٤٪‎.**
                 *
                 * أمّا الخطواتُ فنصٌّ `nowrap` يتجاوز الصندوقَ في النموذج
                 * ولا يُقصّ — فوضعُها خارجَه يُعطي الصورةَ نفسَها ويُجنّب
                 * فيضًا يصرخ به Flutter ولا يصرخ به CSS.
                 */
                FractionallySizedBox(
                  widthFactor: 0.54,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Opacity(
                        opacity: 0.85,
                        child: Row(
                          children: [
                            const Icon(
                              LucideIcons.shieldCheck,
                              size: 13,
                              color: AppColors.neutral100,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              'ضمان الجدّية',
                              style: AppText.body(
                                11,
                                color: AppColors.neutral100,
                                weight: FontWeight.w700,
                              ).copyWith(letterSpacing: 0.22),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        'عربون يحمي كل مزاد',
                        style: AppText.heading(17)
                            .copyWith(color: AppColors.neutral100, height: 1.3),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 13),

                /// **كلُّ خطوةٍ في سطرٍ واحد** — ‎١٠٫٥‎ بلا التفاف.
                for (final step in const [
                  'يُحجز من محفظتك مع أول مزايدة',
                  'يعود فورًا إن لم ترسُ عليك',
                  'يُخصم من قيمة اللوحة إن فزت',
                ]) ...[
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 15,
                        height: 15,
                        decoration: BoxDecoration(
                          color: AppColors.neutral100.withValues(alpha: 0.18),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          LucideIcons.check,
                          size: 11,
                          color: AppColors.neutral100,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        step,
                        maxLines: 1,
                        softWrap: false,
                        overflow: TextOverflow.visible,
                        style: AppText.body(
                          10.5,
                          color: AppColors.neutral100,
                          weight: FontWeight.w600,
                        ).copyWith(height: 1.3),
                      ),
                    ],
                  ),
                  const SizedBox(height: 7),
                ],
              ],
            ),
          ),
          PositionedDirectional(
            end: 14,
            top: 14,
            width: 140,
            child: _WalletMiniCard(availableHalalas: availableHalalas),
          ),
          const PositionedDirectional(
            end: 46,
            top: 84,
            child: SizedBox(width: 78, height: 78, child: _ShieldBadge()),
          ),
        ],
      ),
    );
  }
}

/// بطاقةُ «محفظتك» — وشريطُها **يُحجز جزؤه ثمّ يعود** (`holdBar 6s`).
class _WalletMiniCard extends StatefulWidget {
  const _WalletMiniCard({required this.availableHalalas});
  final int availableHalalas;

  @override
  State<_WalletMiniCard> createState() => _WalletMiniCardState();
}

class _WalletMiniCardState extends State<_WalletMiniCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// `0,12% → 0` · `30,70% → 28%` · `88,100% → 0`.
  double _width(double t) {
    if (t <= 0.12) return 0;
    if (t < 0.30) return 0.28 * Curves.easeInOut.transform((t - 0.12) / 0.18);
    if (t <= 0.70) return 0.28;
    if (t < 0.88) {
      return 0.28 * (1 - Curves.easeInOut.transform((t - 0.70) / 0.18));
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced && _c.isAnimating) {
      _c.stop();
    }

    final riyals = (widget.availableHalalas ~/ 100).toString().replaceAllMapped(
      RegExp(r'(\d)(?=(\d{3})+$)'),
      (m) => '${m[1]},',
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.neutral100,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            offset: Offset(0, 6),
            blurRadius: 14,
            color: Color(0x40000000),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'محفظتك',
                style: AppText.body(10.5, weight: FontWeight.w700),
              ),
              Text(
                'متاح $riyals',
                style: AppText.digits(
                  10.5,
                  weight: FontWeight.w700,
                  color: AppColors.neutral600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            child: Container(
              height: 7,
              color: AppColors.accent2_300,
              /* ويُملأ من اليسار — الشريطُ `dir="ltr"` في النموذج */
              child: Align(
                alignment: Alignment.centerLeft,
                child: AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) => FractionallySizedBox(
                    widthFactor: reduced ? 0.28 : _width(_c.value),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.accent,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: const BoxDecoration(
                  color: AppColors.accent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                'العربون يُحجز ولا يُخصم',
                style: AppText.body(10, color: AppColors.neutral700),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// **شارةُ الدرع** — حلقةٌ تدور (`spinR 6s`) وكلمةٌ تتبدّل (`cyc 6s`).
class _ShieldBadge extends StatefulWidget {
  const _ShieldBadge();

  @override
  State<_ShieldBadge> createState() => _ShieldBadgeState();
}

class _ShieldBadgeState extends State<_ShieldBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 6),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// `cyc`: تظهر من ‎٨٪‎ إلى ‎٢٩٪‎ من الدورة، وتدخل وتخرج بإزاحةِ ‎٤‎ بكسلات.
  (double, double) _cyc(double t) {
    if (t < 0.04) return (0, 4);
    if (t < 0.08) return ((t - 0.04) / 0.04, 4 * (1 - (t - 0.04) / 0.04));
    if (t <= 0.29) return (1, 0);
    if (t < 0.33) return (1 - (t - 0.29) / 0.04, -4 * ((t - 0.29) / 0.04));
    return (0, -4);
  }

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    if (reduced && _c.isAnimating) {
      _c.stop();
    }

    const words = <(String, Color, double)>[
      ('محجوز', AppColors.accent800, 0),
      ('عاد لك', AppColors.accent2_800, 2 / 6),
      ('خُصم', AppColors.neutral800, 4 / 6),
    ];

    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        return Stack(
          children: [
            Transform.rotate(
              angle: reduced ? 0 : _c.value * 2 * 3.1415926535,
              child: CustomPaint(
                size: const Size(78, 78),
                painter: _RingPainter(),
              ),
            ),
            Positioned.fill(
              /* القرصُ الداخليُّ بإزاحةِ ‎١١‎ من كلّ جهة */
              child: Padding(
                padding: const EdgeInsets.all(11),
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: AppColors.neutral100,
                    shape: BoxShape.circle,
                  ),
                  child: Stack(
                    children: [
                      const Positioned(
                        top: 9,
                        left: 0,
                        right: 0,
                        child: Icon(
                          LucideIcons.shield,
                          size: 18,
                          color: AppColors.accent2_800,
                        ),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 8,
                        height: 16,
                        child: Stack(
                          children: [
                            for (final (word, color, phase) in words)
                              Builder(
                                builder: (context) {
                                  final t = (_c.value - phase + 1) % 1;
                                  final (opacity, dy) = reduced
                                      ? (phase == 0 ? 1.0 : 0.0, 0.0)
                                      : _cyc(t);
                                  if (opacity == 0) {
                                    return const SizedBox.shrink();
                                  }
                                  return Positioned.fill(
                                    child: Opacity(
                                      opacity: opacity,
                                      child: Transform.translate(
                                        offset: Offset(0, dy),
                                        child: Center(
                                          child: Text(
                                            word,
                                            style: AppText.body(
                                              11,
                                              color: color,
                                              weight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// حلقةُ الشارة: مسارٌ باهتٌ كامل، وقوسٌ أبيضُ بطولِ ‎٦٠‎ من ‎٢١٤‎.
class _RingPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const r = 34.0;

    canvas.drawCircle(
      center,
      r,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = Colors.white.withValues(alpha: 0.18),
    );

    /* `stroke-dasharray:60 154` — فالقوسُ ‎٦٠‎ من محيطٍ طولُه ‎٢١٤‎ */
    const circumference = 2 * 3.1415926535 * r;
    final sweep = (60 / circumference) * 2 * 3.1415926535;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: r),
      -3.1415926535 / 2,
      sweep,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..strokeCap = StrokeCap.round
        ..color = Colors.white,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// الهالةُ الخفيفةُ خلف البنر الثالث.
class _GlowPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawCircle(
      Offset(size.width * 0.18, size.height * 0.70),
      60,
      Paint()..color = AppColors.neutral100.withValues(alpha: 0.10),
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
