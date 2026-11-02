import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../models/plate_query.dart';
import '../widgets/market_row_card.dart';

/// ترتيبُ النتائج — زرٌّ واحدٌ يتبدّل، لا قائمةٌ تُفتح.
enum MarketSort { endingSoon, highest, lowest }

/// **شاشةُ السوق** — §5.3.
class MarketScreen extends StatefulWidget {
  const MarketScreen({
    super.key,
    required this.listings,
    required this.serverTime,
  });

  final List<Listing> listings;
  final DateTime serverTime;

  @override
  State<MarketScreen> createState() => _MarketScreenState();
}

class _MarketScreenState extends State<MarketScreen> {
  final _controller = TextEditingController();
  var _query = const PlateQuery(letters: [], digits: '');
  SaleType? _sale;
  MarketSort _sort = MarketSort.endingSoon;

  /// رقائقُ عددِ الحروف وعددِ الأرقام — اختيارٌ واحدٌ من كلٍّ، يُلغى بإعادة ضغطه.
  int? _letterCount;
  int? _digitCount;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<Listing> get _results {
    var rows = widget.listings.where((l) {
      if (_sale != null && l.saleType != _sale) return false;
      if (_letterCount != null &&
          l.letters.replaceAll(RegExp(r'\s+'), '').length != _letterCount) {
        return false;
      }
      if (_digitCount != null && l.number.length != _digitCount) return false;
      return _query.matches(plateLetters: l.letters, plateNumber: l.number);
    }).toList();

    rows.sort(
      (a, b) => switch (_sort) {
        /* وما لا نهايةَ له يقع آخرًا، لا أوّلًا بقيمةٍ صفريّة */
        MarketSort.endingSoon => (a.endsAt ?? _far).compareTo(b.endsAt ?? _far),
        MarketSort.highest => b.price.compareTo(a.price),
        MarketSort.lowest => a.price.compareTo(b.price),
      },
    );
    return rows;
  }

  static final _far = DateTime.utc(9999);

  int _countFor(SaleType? sale) => widget.listings
      .where((l) => sale == null || l.saleType == sale)
      .where(
        (l) => _query.matches(plateLetters: l.letters, plateNumber: l.number),
      )
      .length;

  @override
  Widget build(BuildContext context) {
    final rows = _results;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          color: AppColors.bg,
          padding: const EdgeInsets.fromLTRB(18, 6, 18, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('السوق', style: AppText.heading(28)),
              const SizedBox(height: 12),
              _searchRow(),
              if (!_query.isEmpty) ...[
                const SizedBox(height: 12),
                _queryEcho(),
              ],
              const SizedBox(height: 12),
              _saleTabs(),
              const SizedBox(height: 12),
              _chips(),
            ],
          ),
        ),
        Expanded(
          child: rows.isEmpty
              ? const _Empty()
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(18, 4, 18, 90),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) => MarketRowCard(
                    listing: rows[i],
                    serverTime: widget.serverTime,
                    onWatch: () {},
                  ),
                ),
        ),
      ],
    );
  }

  Widget _searchRow() {
    return Row(
      children: [
        Expanded(
          child: SizedBox(
            height: 46,
            child: TextField(
              controller: _controller,
              onChanged: (v) => setState(() => _query = PlateQuery.parse(v)),
              style: AppText.body(15),
              decoration: InputDecoration(
                hintText: 'حروف أو أرقام: سعد · SED · ١',
                hintStyle: AppText.body(15, color: AppColors.neutral500),
                filled: true,
                fillColor: AppColors.neutral100,
                prefixIcon: const Icon(
                  LucideIcons.search,
                  size: 18,
                  color: AppColors.neutral600,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: () => setState(
            () => _sort = switch (_sort) {
              MarketSort.endingSoon => MarketSort.highest,
              MarketSort.highest => MarketSort.lowest,
              MarketSort.lowest => MarketSort.endingSoon,
            },
          ),
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 46,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.neutral100,
              border: Border.all(color: AppColors.divider),
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.arrowUpDown, size: 15),
                const SizedBox(width: 6),
                Text(
                  _sortLabel,
                  style: AppText.body(12.5, weight: FontWeight.w600),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String get _sortLabel => switch (_sort) {
    MarketSort.endingSoon => 'الأقرب انتهاءً',
    MarketSort.highest => 'الأعلى سعرًا',
    MarketSort.lowest => 'الأقل سعرًا',
  };

  /// **ويُعرض ما فُهم من الاستعلام لا ما كُتب** — فيعرف أين يُصحّح.
  Widget _queryEcho() {
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text('نبحث عن', style: AppText.body(12.5, color: AppColors.neutral800)),
        if (_query.letters.isNotEmpty)
          _echoChip('حروف: ${_query.letters.join(' ')} ', _query.latin),
        if (_query.digits.isNotEmpty) _echoChip('أرقام: ${_query.digits}', ''),
        GestureDetector(
          onTap: () => setState(() {
            _controller.clear();
            _query = const PlateQuery(letters: [], digits: '');
          }),
          behavior: HitTestBehavior.opaque,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            child: Text(
              'مسح',
              style: AppText.body(12.5, color: AppColors.accent700),
            ),
          ),
        ),
      ],
    );
  }

  Widget _echoChip(String text, String latin) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
    decoration: BoxDecoration(
      color: AppColors.accent2_100,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          text,
          style: AppText.body(
            12.5,
            color: AppColors.accent2_900,
            weight: FontWeight.w700,
          ),
        ),
        if (latin.isNotEmpty)
          Directionality(
            textDirection: TextDirection.ltr,
            child: Text(
              latin,
              style: AppText.body(
                12.5,
                color: AppColors.accent2_900,
                weight: FontWeight.w700,
              ),
            ),
          ),
      ],
    ),
  );

  /// **التاباتُ بأعدادها** — فيعرف قبل أن يضغط كم فيها.
  Widget _saleTabs() {
    const tabs = <(SaleType?, String)>[
      (null, 'الكل'),
      (SaleType.auction, 'مزاد'),
      (SaleType.fixed, 'مباشر'),
      (SaleType.offers, 'سوم'),
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        children: tabs.map((t) {
          final active = _sale == t.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => _sale = t.$1),
              behavior: HitTestBehavior.opaque,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                height: 38,
                decoration: BoxDecoration(
                  color: active ? AppColors.text : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      t.$2,
                      style: AppText.body(
                        13,
                        weight: FontWeight.w700,
                        color: active ? AppColors.bg : AppColors.text,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Opacity(
                      opacity: 0.7,
                      child: Text(
                        '${_countFor(t.$1)}',
                        style: AppText.digits(
                          11,
                          weight: FontWeight.w700,
                          color: active ? AppColors.bg : AppColors.text,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _chips() {
    return SizedBox(
      height: 32,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.zero,
        children: [
          for (final (n, label) in const [
            (1, 'أحادي'),
            (2, 'ثنائي'),
            (3, 'ثلاثي'),
          ])
            _chip(
              label,
              _letterCount == n,
              () => setState(() => _letterCount = _letterCount == n ? null : n),
            ),
          Container(
            width: 1,
            margin: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
            color: AppColors.divider,
          ),
          for (final (n, label) in const [
            (1, 'رقم'),
            (2, 'رقمين'),
            (3, '3 أرقام'),
            (4, '4 أرقام'),
          ])
            _chip(
              label,
              _digitCount == n,
              () => setState(() => _digitCount = _digitCount == n ? null : n),
            ),
        ],
      ),
    );
  }

  Widget _chip(String label, bool active, VoidCallback onTap) => Padding(
    padding: const EdgeInsetsDirectional.only(end: 6),
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 13),
        decoration: BoxDecoration(
          color: active ? AppColors.accent100 : AppColors.neutral100,
          border: Border.all(
            color: active ? AppColors.accent : AppColors.divider,
            width: 1.5,
          ),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: AppText.body(
            12.5,
            weight: FontWeight.w600,
            color: active ? AppColors.accent900 : AppColors.text,
          ),
        ),
      ),
    ),
  );
}

/// **حالةٌ فارغةٌ تقول ما لم يُوجد** — لا شاشةٌ بيضاء.
class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
    child: Column(
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: const BoxDecoration(
            color: AppColors.surface,
            shape: BoxShape.circle,
          ),
          child: const Icon(
            LucideIcons.search,
            size: 28,
            color: AppColors.neutral500,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'ما لقينا لوحة بهذا الوصف',
          textAlign: TextAlign.center,
          style: AppText.heading(19),
        ),
      ],
    ),
  );
}
