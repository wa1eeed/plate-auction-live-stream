import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/plate.dart';

/// **معرضُ لوحاتي** — §5.11، وهذا اسمُه لا «المعرض العلنيّ».
///
/// **ولا يكشف ما لا يُنشر**: ما كان مسودّةً أو محجوزًا لا يظهر هنا، فالمعرضُ
/// صفحةٌ يفتحها الغريبُ برابطٍ — وعرضُ غير المنشور فيه إفشاءٌ لما لم يُعرض.
class ShowcaseScreen extends StatelessWidget {
  const ShowcaseScreen({
    super.key,
    required this.name,
    required this.handle,
    required this.city,
    required this.joined,
    required this.plates,
    this.onBack,
  });

  final String name;
  final String handle;
  final String city;

  /// «سنتين» · «٣ أشهر» — منضمٌّ منذ.
  final String joined;

  final List<Listing> plates;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(
            children: [
              _round(LucideIcons.arrowRight, 'رجوع', onBack),
              const SizedBox(width: 10),
              Expanded(
                child: Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    'souq-plates.sa/$handle',
                    style: AppText.body(13, color: AppColors.neutral700),
                  ),
                ),
              ),
              _round(LucideIcons.share, 'مشاركة', null),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            children: [
              _head(),
              const SizedBox(height: 18),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 0.92,
                children: plates.map((p) => _ShowcaseTile(listing: p)).toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _round(IconData icon, String label, VoidCallback? onTap) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 42,
        height: 42,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 19),
      ),
    ),
  );

  Widget _head() => ClipRRect(
    borderRadius: BorderRadius.circular(AppRadii.banner),
    child: Container(
      color: AppColors.accent200,
      child: Stack(
        children: [
          PositionedDirectional(
            start: -40,
            bottom: -70,
            child: Container(
              width: 150,
              height: 150,
              decoration: const BoxDecoration(
                color: AppColors.accent300,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(
                    color: AppColors.accent,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    name.substring(0, 1),
                    style: AppText.heading(30)
                        .copyWith(color: AppColors.neutral100),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  name,
                  style: AppText.body(
                    24,
                    weight: FontWeight.w700,
                  ).copyWith(height: 1.2),
                ),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    handle,
                    style: AppText.body(13, color: AppColors.accent900),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (final part in [
                      city,
                      'منضمّ منذ $joined',
                      '${plates.length} لوحات',
                    ]) ...[
                      Text(
                        part,
                        style: AppText.body(
                          12.5,
                          color: AppColors.accent900,
                          weight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(width: 16),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// بطاقةُ لوحةٍ في المعرض — كرتان في الصفّ، ومنطقةُ اللوحة ‎٦٠‎.
class _ShowcaseTile extends StatelessWidget {
  const _ShowcaseTile({required this.listing});

  final Listing listing;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.cardOutlined),
      border: Border.all(color: AppColors.divider),
    ),
    clipBehavior: Clip.antiAlias,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [AppColors.neutral200, AppColors.neutral100],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(10, 32, 10, 8),
          child: Column(
            children: [
              SizedBox(
                height: 60,
                child: Center(
                  child: SaudiPlate(
                    letters: listing.letters,
                    number: listing.number,
                    kind: listing.kind,
                    format: listing.format,
                    emblem: listing.emblem,
                  ),
                ),
              ),
              const SizedBox(height: 6),
              Text(
                listing.reference,
                style: AppText.digits(
                  10.5,
                  weight: FontWeight.w500,
                  color: AppColors.neutral600,
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
          child: Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: _dot, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Text(_label, style: AppText.body(11, weight: FontWeight.w600)),
              const Spacer(),
              Text(
                _money,
                style: AppText.digits(12.5, weight: FontWeight.w700),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Color get _dot => switch (listing.saleType) {
    SaleType.auction => AppColors.accent,
    SaleType.fixed => AppColors.accent2,
    SaleType.offers => AppColors.neutral700,
  };

  String get _label => switch (listing.saleType) {
    SaleType.auction => 'مزاد',
    SaleType.fixed => 'بيع مباشر',
    SaleType.offers => 'على السوم',
  };

  String get _money => (listing.price ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}
