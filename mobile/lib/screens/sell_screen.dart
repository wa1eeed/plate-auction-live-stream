import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/listing.dart';
import '../widgets/plate.dart';
import '../widgets/sell/letter_slots.dart';
import '../widgets/sell/segmented_row.dart';

/// **شاشةُ إضافة لوحة** — §5.5: ثلاثُ خطواتٍ ومعاينةٌ حيّة.
class SellScreen extends StatefulWidget {
  const SellScreen({super.key, this.onCancel});

  final VoidCallback? onCancel;

  @override
  State<SellScreen> createState() => _SellScreenState();
}

class _SellScreenState extends State<SellScreen> {
  int _step = 0;

  PlateKind _kind = PlateKind.private;
  PlateFormat _format = PlateFormat.long;
  PlateEmblem _emblem = PlateEmblem.palm;
  List<String?> _letters = [null, null, null];
  final _number = TextEditingController();

  SaleType _sale = SaleType.auction;
  final _price = TextEditingController();
  int _days = 3;

  @override
  void dispose() {
    _number.dispose();
    _price.dispose();
    super.dispose();
  }

  /// **والدراجةُ اعتياديّةٌ دائمًا** — فيُخفى اختيارُ الإصدار لها.
  bool get _showFormat => _kind != PlateKind.motorcycle;

  /// **والشعارُ للطويلة الخصوصيّ وحدها** — غيرُها لا شعارَ وسطَ لها.
  bool get _showEmblem =>
      _kind == PlateKind.private && _format == PlateFormat.long;

  bool get _isSport => _format == PlateFormat.sport;

  String get _previewLetters {
    final chosen = _letters.whereType<String>().toList();
    /*
     * وقبل الاختيار تُعرض نقاطٌ لا علاماتُ استفهام — فالمكوّنُ يرسم `·`
     * لما ليس من حروف اللوحة، وهي صورةُ الخانة الفارغة في النموذج.
     */
    return chosen.isEmpty ? '؟؟؟' : chosen.join('');
  }

  bool get _step1Valid =>
      _letters.every((l) => l != null) && _number.text.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _header(),
        _preview(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
            children: [
              if (_step == 0) ..._stepOne(),
              if (_step == 1) ..._stepTwo(),
              if (_step == 2) ..._stepThree(),
            ],
          ),
        ),
        _footer(),
      ],
    );
  }

  Widget _header() {
    const titles = ['اللوحة', 'طريقة البيع', 'المراجعة'];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(
        children: [
          Row(
            children: [
              GestureDetector(
                onTap: () => _step == 0
                    ? widget.onCancel?.call()
                    : setState(() => _step--),
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
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'اعرض لوحتك · ${_step + 1} من 3',
                      style: AppText.body(12, color: AppColors.neutral700),
                    ),
                    Text(
                      titles[_step],
                      style: AppText.heading(21).copyWith(height: 1.2),
                    ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: widget.onCancel,
                behavior: HitTestBehavior.opaque,
                child: Text(
                  'إلغاء',
                  style: AppText.body(
                    13,
                    color: AppColors.neutral700,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          /* شريطُ تقدّمٍ ‎٦‎ يمتلئ بالخطوة */
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            child: Container(
              height: 6,
              color: AppColors.surface,
              child: AnimatedFractionallySizedBox(
                duration: const Duration(milliseconds: 300),
                widthFactor: (_step + 1) / 3,
                alignment: AlignmentDirectional.centerStart,
                child: Container(color: AppColors.accent),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// **معاينةٌ حيّةٌ فوق الخيارات** — تتبدّل مع كلّ ضغطة.
  ///
  /// فمن يختار «نقل خاص» يرى الكتلةَ الزرقاء تظهر، ومن يختار «رياضية» يرى
  /// اللوحةَ تنقلب إنجليزيّةً — ولا يُطلب منه أن يتخيّل.
  Widget _preview() => Container(
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 4),
    padding: const EdgeInsets.fromLTRB(18, 18, 18, 16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: SaudiPlate(
      letters: _previewLetters,
      number: _number.text.trim().isEmpty ? '؟' : _number.text.trim(),
      kind: _kind,
      format: _format,
      emblem: _emblem,
    ),
  );

  List<Widget> _stepOne() => [
    _label('نوع اللوحة'),
    SegmentedRow<PlateKind>(
      value: _kind,
      options: const [
        (PlateKind.private, 'خصوصي'),
        (PlateKind.transport, 'نقل خاص'),
        (PlateKind.motorcycle, 'دراجة'),
      ],
      onChanged: (k) => setState(() {
        _kind = k;
        if (k == PlateKind.motorcycle) _format = PlateFormat.standard;
        /* **وتغييرُ النوع يُرجع الشعارَ إلى النخلة** — §6.4 */
        _emblem = PlateEmblem.palm;
      }),
    ),
    if (_showFormat) ...[
      const SizedBox(height: 18),
      _label('الإصدار'),
      SegmentedRow<PlateFormat>(
        value: _format,
        options: const [
          (PlateFormat.long, 'طويلة'),
          (PlateFormat.standard, 'اعتيادية'),
          (PlateFormat.sport, 'رياضية'),
        ],
        onChanged: (f) => setState(() {
          _format = f;
          _emblem = PlateEmblem.palm;
        }),
      ),
      if (_isSport) ...[
        const SizedBox(height: 6),
        Text(
          'الرياضية إنجليزي فقط — تُطبع الحروف باللاتينية',
          style: AppText.body(12, color: AppColors.neutral700),
        ),
      ],
    ],
    if (_showEmblem) ...[
      const SizedBox(height: 18),
      _label('شعار المنتصف'),
      EmblemPicker(
        value: _emblem,
        onChanged: (e) => setState(() => _emblem = e),
      ),
    ],
    const SizedBox(height: 18),
    _labelRich('الحروف', ' — اختر من القائمة، الخانة التالية تُفتح بعد الأولى'),
    LetterSlots(
      letters: _letters,
      latinFirst: _isSport,
      onChanged: (v) => setState(() => _letters = v),
    ),
    const SizedBox(height: 18),
    _labelRich('الأرقام', ' — من 1 إلى 4، بالعربية أو الإنجليزية'),
    SizedBox(
      height: 52,
      child: TextField(
        controller: _number,
        keyboardType: TextInputType.number,
        inputFormatters: [
          FilteringTextInputFormatter.digitsOnly,
          LengthLimitingTextInputFormatter(4),
        ],
        onChanged: (_) => setState(() {}),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        style: AppText.digits(17, weight: FontWeight.w700),
        decoration: InputDecoration(
          hintText: 'مثل 4040',
          hintStyle: AppText.body(15, color: AppColors.neutral500),
          filled: true,
          fillColor: AppColors.neutral100,
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    ),
  ];

  List<Widget> _stepTwo() => [
    _label('طريقة البيع'),
    SegmentedRow<SaleType>(
      value: _sale,
      options: const [
        (SaleType.auction, 'مزاد'),
        (SaleType.fixed, 'سعر مباشر'),
        (SaleType.offers, 'استقبال عروض'),
      ],
      onChanged: (s) => setState(() => _sale = s),
    ),
    const SizedBox(height: 18),
    _label(_sale == SaleType.auction ? 'سعر الافتتاح' : 'السعر'),
    SizedBox(
      height: 52,
      child: TextField(
        controller: _price,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        onChanged: (_) => setState(() {}),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        style: AppText.digits(17, weight: FontWeight.w700),
        decoration: InputDecoration(
          hintText: 'بالريال',
          hintStyle: AppText.body(15, color: AppColors.neutral500),
          filled: true,
          fillColor: AppColors.neutral100,
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadii.pill),
            borderSide: BorderSide.none,
          ),
        ),
      ),
    ),
    if (_sale == SaleType.auction) ...[
      const SizedBox(height: 18),
      _label('مدّة المزاد'),
      Row(
        children: [1, 3, 7, 14].map((d) {
          final active = _days == d;
          return Expanded(
            child: Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: GestureDetector(
                onTap: () => setState(() => _days = d),
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: 62,
                  decoration: BoxDecoration(
                    color: active ? AppColors.accent100 : AppColors.neutral100,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    border: Border.all(
                      color: active ? AppColors.accent : AppColors.divider,
                      width: active ? 2 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$d',
                        style: AppText.digits(
                          18,
                          color: active ? AppColors.accent900 : AppColors.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        d == 1 ? 'يوم' : 'أيام',
                        style: AppText.body(10.5, color: AppColors.neutral700),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    ],
  ];

  List<Widget> _stepThree() {
    final riyals = int.tryParse(_price.text.trim()) ?? 0;
    /* **وعمولةُ البائع ‎٢٫٥٪‎ وضريبتُها ‎١٥٪‎ على العمولة وحدها** — §6.5 */
    final commission = riyals * 25 ~/ 1000;
    final vat = commission * 15 ~/ 100;
    final net = riyals - commission - vat;

    return [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        child: Column(
          children: [
            _row('اللوحة', '$_previewLetters ${_number.text.trim()}'),
            _row('طريقة البيع', switch (_sale) {
              SaleType.auction =>
                'مزاد · $_days ${_days == 1 ? "يوم" : "أيام"}',
              SaleType.fixed => 'سعر مباشر',
              SaleType.offers => 'استقبال عروض',
            }),
            _row(
              _sale == SaleType.auction ? 'سعر الافتتاح' : 'السعر',
              '${_fmt(riyals)} ر.س',
            ),
            Container(height: 1, color: AppColors.divider),
            _row('عمولة المنصّة (2.5%)', '− ${_fmt(commission)} ر.س'),
            _row(
              'ضريبة القيمة المضافة (15% على العمولة)',
              '− ${_fmt(vat)} ر.س',
            ),
            Container(height: 1, color: AppColors.divider),
            _row('عائدك', '${_fmt(net)} ر.س', bold: true),
          ],
        ),
      ),
      const SizedBox(height: 14),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.accent100,
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(LucideIcons.info, size: 16, color: AppColors.accent800),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'مزايدة في آخر دقيقتين تمدّد المزاد دقيقتين. '
                'والعربون يُحجز من المزايد مع أوّل مزايدة.',
                style: AppText.body(
                  12,
                  color: AppColors.accent900,
                ).copyWith(height: 1.6),
              ),
            ),
          ],
        ),
      ),
    ];
  }

  Widget _row(String label, String value, {bool bold = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: AppText.body(
              12.5,
              color: bold ? AppColors.text : AppColors.neutral700,
              weight: bold ? FontWeight.w700 : FontWeight.w400,
            ),
          ),
        ),
        Text(
          value,
          style: bold
              ? AppText.money(16)
              : AppText.body(12.5, weight: FontWeight.w600),
        ),
      ],
    ),
  );

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: AppText.body(13, weight: FontWeight.w700)),
  );

  Widget _labelRich(String bold, String rest) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: bold,
            style: AppText.body(13, weight: FontWeight.w700),
          ),
          TextSpan(
            text: rest,
            style: AppText.body(12, color: AppColors.neutral700),
          ),
        ],
      ),
    ),
  );

  Widget _footer() {
    final enabled = _step == 0 ? _step1Valid : true;
    const labels = ['التالي: طريقة البيع', 'التالي: المراجعة', 'انشر اللوحة'];

    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: const BoxDecoration(
        color: AppColors.bg,
        border: Border(top: BorderSide(color: AppColors.divider)),
      ),
      child: SafeArea(
        top: false,
        child: GestureDetector(
          onTap: enabled && _step < 2 ? () => setState(() => _step++) : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 52,
            decoration: BoxDecoration(
              /* وزرٌّ باهتٌ حتى تكتمل الخطوة — لا رفضٌ بعد الضغط */
              color: enabled ? AppColors.accent : AppColors.accent300,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            alignment: Alignment.center,
            child: Text(
              labels[_step],
              style: AppText.body(
                16,
                color: AppColors.neutral100,
                weight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _fmt(int riyals) => riyals.toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}
