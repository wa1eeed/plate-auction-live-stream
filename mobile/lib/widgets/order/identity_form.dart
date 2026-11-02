import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../design/tokens.dart';

/// تقويمُ الميلاد — **وهو شرطٌ لا تفصيل**.
enum BirthCalendar { hijri, gregorian }

/// **نموذجُ بيانات المشتري** — نداءُ مرحلة `id` (§5.7).
///
/// **وتُطلب في مرحلة النقل لا في الملفّ الشخصيّ**: بياناتُ هذه الصفقة
/// بعينها، فلا تُجمع هويّاتُ الناس لغير حاجة ولا يُسأل عنها من جاء يتصفّح.
///
/// **ولا تُرسَل خارج المنصّة**: أبشر يطلب من البائع رقمَ هوية المشتري
/// وتاريخَ ميلاده، وكانا يُتبادلان في محادثةٍ خارجها — ورقمٌ من عشر خاناتٍ
/// يُملى هناك يُسقط منه رقمٌ فيُردّ الطلبُ في أبشر بلا سببٍ مفهوم.
class IdentityForm extends StatefulWidget {
  const IdentityForm({super.key, this.onSubmit});

  final void Function(String nationalId, String birthDate, BirthCalendar cal)?
  onSubmit;

  @override
  State<IdentityForm> createState() => _IdentityFormState();
}

class _IdentityFormState extends State<IdentityForm> {
  final _id = TextEditingController();
  final _birth = TextEditingController();
  BirthCalendar _cal = BirthCalendar.hijri;

  @override
  void dispose() {
    _id.dispose();
    _birth.dispose();
    super.dispose();
  }

  /// **رقمٌ من عشر خاناتٍ يبدأ بـ١ أو ٢** — مواطنٌ أو مقيم.
  bool get _idValid => RegExp(r'^[12]\d{9}$').hasMatch(_id.text.trim());

  bool get _birthValid =>
      RegExp(r'^\d{2}/\d{2}/\d{4}$').hasMatch(_birth.text.trim());

  bool get _valid => _idValid && _birthValid;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.banner),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('أكّد بياناتك ليبدأ البائع النقل', style: AppText.heading(17)),
          const SizedBox(height: 6),
          Text(
            'أبشر يطلب من البائع رقم هويتك أو إقامتك وتاريخ ميلادك. '
            'لا يراها إلا طرفا الصفقة.',
            style: AppText.body(
              12,
              color: AppColors.neutral700,
            ).copyWith(height: 1.5),
          ),
          const SizedBox(height: 14),
          Text(
            'رقم الهوية أو الإقامة',
            style: AppText.body(12.5, weight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          _field(
            controller: _id,
            hint: '1xxxxxxxxx',
            keyboard: TextInputType.number,
            formatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(10),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Text(
                  'تاريخ الميلاد',
                  style: AppText.body(12.5, weight: FontWeight.w700),
                ),
              ),
              _CalendarToggle(
                value: _cal,
                onChanged: (v) => setState(() => _cal = v),
              ),
            ],
          ),
          const SizedBox(height: 6),
          _field(
            controller: _birth,
            hint: 'dd/mm/yyyy',
            keyboard: TextInputType.datetime,
          ),
          const SizedBox(height: 6),
          Text(
            _cal == BirthCalendar.hijri
                ? 'مثل: 14/07/1412 — كما في الهوية الوطنية'
                : 'مثل: 04/05/1990 — كما في الإقامة',
            style: AppText.body(11, color: AppColors.neutral700),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: _valid
                ? () => widget.onSubmit?.call(
                    _id.text.trim(),
                    _birth.text.trim(),
                    _cal,
                  )
                : null,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 50,
              decoration: BoxDecoration(
                /* وزرٌّ باهتٌ قبل اكتمال البيانات — لا رفضٌ بعد الضغط */
                color: _valid ? AppColors.accent : AppColors.accent300,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                'أرسلها للبائع',
                style: AppText.body(
                  17,
                  color: AppColors.neutral100,
                  weight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    TextInputType? keyboard,
    List<TextInputFormatter>? formatters,
  }) => SizedBox(
    height: 46,
    child: TextField(
      controller: controller,
      keyboardType: keyboard,
      inputFormatters: formatters,
      onChanged: (_) => setState(() {}),
      /* والرقمُ يُقرأ يسارًا ولو كان ما حوله عربيًّا */
      textDirection: TextDirection.ltr,
      textAlign: TextAlign.center,
      style: AppText.digits(15, weight: FontWeight.w600),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppText.digits(
          15,
          weight: FontWeight.w500,
          color: AppColors.neutral500,
        ),
        filled: true,
        fillColor: AppColors.neutral100,
        contentPadding: EdgeInsets.zero,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          borderSide: BorderSide.none,
        ),
      ),
    ),
  );
}

/// **مبدّلُ التقويم** — هجريٌّ أو ميلاديّ.
///
/// فسجلُّ أبشر هجريٌّ للمواطن وميلاديٌّ لكثيرٍ من المقيمين، **ورقمٌ بلا
/// تقويمه يُدخَل خطأً فيُردّ الطلب**.
class _CalendarToggle extends StatelessWidget {
  const _CalendarToggle({required this.value, required this.onChanged});

  final BirthCalendar value;
  final ValueChanged<BirthCalendar> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(3),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: BirthCalendar.values.map((c) {
        final active = c == value;
        return GestureDetector(
          onTap: () => onChanged(c),
          behavior: HitTestBehavior.opaque,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
            decoration: BoxDecoration(
              color: active ? AppColors.text : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              c == BirthCalendar.hijri ? 'هجري' : 'ميلادي',
              style: AppText.body(
                11.5,
                weight: FontWeight.w700,
                color: active ? AppColors.bg : AppColors.neutral700,
              ),
            ),
          ),
        );
      }).toList(),
    ),
  );
}
