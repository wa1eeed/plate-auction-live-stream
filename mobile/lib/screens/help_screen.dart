import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';

/// تاباتُ المساعدة الثلاث.
enum HelpTab { how, faq, terms }

/// سؤالٌ وجوابُه.
typedef Faq = (String, String);

/// **شاشةُ المساعدة** — §5.11.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key, this.onBack});

  final VoidCallback? onBack;

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  HelpTab _tab = HelpTab.how;
  int? _open;

  static const _buyer = <String>[
    'تصفّح السوق واختر لوحتك',
    'زايد أو اشترِ مباشرة — ويُحجز عربونك مع أول مزايدة',
    'سدّد، فيُحجز المبلغ أمانةً لدى المنصّة',
    'أكّد بياناتك، وينقلها البائع في أبشر',
  ];

  static const _seller = <String>[
    'اعرض لوحتك واختر طريقة البيع',
    'تابع المزايدات أو اقبل السوم',
    'استلم بيانات المشتري من صفحة الصفقة',
    'افصل اللوحة وانقلها في أبشر، فيصلك عائدك',
  ];

  static const _faqs = <Faq>[
    (
      'كيف أنقل اللوحة للمشتري في أبشر؟',
      'افصل اللوحة عن سيارتك أولًا، ثم ادخل أبشر ← خدماتي ← المرور ← '
          'نقل ملكية لوحة، وأدخل رقم هوية المشتري وتاريخ ميلاده كما يظهران '
          'لك في صفحة الصفقة.',
    ),
    (
      'كيف أستلم اللوحة في أبشر؟',
      'يصلك طلبٌ معلّق في أبشر بعد أن ينقلها البائع. ادخل أبشر ← الطلبات '
          'المعلّقة ووافق عليه. ولن يصلك الطلب قبل أن تؤكّد بياناتك في '
          'صفحة الصفقة.',
    ),
    (
      'هل لا بدّ أن تكون اللوحة في المحفظة الرقمية؟',
      'نعم للبائع: اللوحة الراكبة على سيارة لا يظهر لها خيار نقلٍ مجرّد. '
          'افصلها أولًا فتنتقل إلى محفظتك الرقمية ثم انقلها.',
    ),
    (
      'ما رسوم أبشر؟ ومن يدفعها؟',
      '402 ر.س لتفعيل المحفظة الرقمية يدفعها كل طرف عن نفسه مرة واحدة، '
          'و230 ر.س لنقل الملكية على المشتري بالعرف. وهي رسوم حكومية '
          'تُدفع في سداد ولا تمرّ بالمنصّة.',
    ),
    (
      'متى يعود عربوني؟',
      'فورًا إن انتهى المزاد ولم ترسُ عليك. وإن رست عليك خُصم من قيمة '
          'اللوحة. وإن لم تسدّد حتى انقضت المهلة صودر جزءٌ منه وعاد الباقي.',
    ),
    (
      'ما عمولة المنصّة؟',
      '2% على المشتري و2.5% على البائع، وضريبة القيمة المضافة 15% على '
          'العمولة وحدها لا على قيمة اللوحة.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
          child: Column(
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: widget.onBack,
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
                  const SizedBox(width: 10),
                  Text('المساعدة', style: AppText.heading(24)),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Row(
                  children: HelpTab.values.map((t) {
                    final active = _tab == t;
                    final label = switch (t) {
                      HelpTab.how => 'كيف يعمل',
                      HelpTab.faq => 'الأسئلة الشائعة',
                      HelpTab.terms => 'الشروط',
                    };
                    return Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() => _tab = t),
                        behavior: HitTestBehavior.opaque,
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          height: 38,
                          decoration: BoxDecoration(
                            color: active ? AppColors.text : Colors.transparent,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            label,
                            style: AppText.body(
                              12.5,
                              weight: FontWeight.w700,
                              color: active ? AppColors.bg : AppColors.text,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            children: switch (_tab) {
              HelpTab.how => [
                _steps('للمشتري', _buyer, AppColors.accent2_200),
                const SizedBox(height: 14),
                _steps('للبائع', _seller, AppColors.accent200),
              ],
              HelpTab.faq => [
                for (var i = 0; i < _faqs.length; i++) ...[
                  _Accordion(
                    faq: _faqs[i],
                    open: _open == i,
                    onTap: () => setState(() => _open = _open == i ? null : i),
                  ),
                  const SizedBox(height: 8),
                ],
              ],
              HelpTab.terms => [_terms()],
            },
          ),
        ),
      ],
    );
  }

  Widget _steps(String title, List<String> steps, Color tint) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppText.heading(17)),
        const SizedBox(height: 12),
        for (var i = 0; i < steps.length; i++) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: Text('${i + 1}', style: AppText.digits(12.5)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  steps[i],
                  style: AppText.body(13).copyWith(height: 1.6),
                ),
              ),
            ],
          ),
          if (i != steps.length - 1) const SizedBox(height: 10),
        ],
      ],
    ),
  );

  Widget _terms() => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final line in const [
          'المنصّة وسيطٌ يحجز المال حتى تُنقل الملكية في أبشر — '
              'وهي لا تنقل ملكيةً ولا تملك أن تنقلها.',
          'العربون يُحجز مع أول مزايدة، ويعود كاملًا إن لم ترسُ عليك.',
          'من رست عليه ولم يسدّد حتى انقضت المهلة صودر جزءٌ من عربونه.',
          'رسوم أبشر حكوميّة تُدفع في سداد ولا تمرّ بالمنصّة.',
          'الفاتورة الضريبية على عمولة المنصّة وحدها — '
              'قيمة اللوحة لا تدخلها.',
        ]) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 6),
                child: Icon(LucideIcons.dot, size: 14),
              ),
              Expanded(
                child: Text(
                  line,
                  style: AppText.body(
                    13,
                    color: AppColors.neutral800,
                  ).copyWith(height: 1.8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
        ],
      ],
    ),
  );
}

/// **أكورديون** — السؤالُ ظاهرٌ وجوابُه يُفتح بضغطة.
class _Accordion extends StatelessWidget {
  const _Accordion({
    required this.faq,
    required this.open,
    required this.onTap,
  });

  final Faq faq;
  final bool open;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  faq.$1,
                  style: AppText.body(
                    13.5,
                    weight: FontWeight.w700,
                  ).copyWith(height: 1.5),
                ),
              ),
              const SizedBox(width: 8),
              AnimatedRotation(
                duration: const Duration(milliseconds: 200),
                turns: open ? 0.5 : 0,
                child: const Icon(
                  LucideIcons.chevronDown,
                  size: 18,
                  color: AppColors.neutral600,
                ),
              ),
            ],
          ),
          if (open) ...[
            const SizedBox(height: 8),
            Text(
              faq.$2,
              style: AppText.body(
                12.5,
                color: AppColors.neutral800,
              ).copyWith(height: 1.8),
            ),
          ],
        ],
      ),
    ),
  );
}
