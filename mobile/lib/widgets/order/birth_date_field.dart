import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import 'identity_form.dart';

/// **تاريخُ ميلادٍ مُنتقًى** — سنةٌ وشهرٌ ويوم، بلا تقويمٍ محسوب.
///
/// **ولا يُحوَّل بين التقويمين**: ما يُنتقى هو ما في الهويّة، ويُرسل مع
/// علامة تقويمه. وحسابُ هجريٍّ من ميلاديٍّ يختلف يومًا أو يومين عن تقويم
/// أمّ القرى، ويومٌ واحدٌ يردّ الطلبَ في أبشر.
class BirthDate {
  const BirthDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  /// **`YYYY-MM-DD` كما يطلبه الخادم** — وهو ما كان الخللُ فيه.
  String get wire =>
      '${year.toString().padLeft(4, '0')}-'
      '${month.toString().padLeft(2, '0')}-'
      '${day.toString().padLeft(2, '0')}';

  String label(BirthCalendar calendar) =>
      '$day ${monthNames(calendar)[month - 1]} $year';
}

const _hijriMonths = [
  'محرّم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوّال',
  'ذو القعدة',
  'ذو الحجّة',
];

const _gregorianMonths = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/// **وأسماءُ الشهور تُغني عن أرقامها** — فـ`07/14` و`14/07` يلتبسان،
/// و«١٤ رجب» لا يلتبس بشيء.
List<String> monthNames(BirthCalendar calendar) =>
    calendar == BirthCalendar.hijri ? _hijriMonths : _gregorianMonths;

/// آخرُ سنةٍ تُعرَض — فلا يُنتقى ميلادٌ في المستقبل.
int _lastYear(BirthCalendar calendar) {
  final now = DateTime.now().year;
  /* والهجريّةُ تُقارب بـ‎٣٣/٣٢‎ من الفرق — وتقريبٌ يكفي لسقفِ عجلة */
  return calendar == BirthCalendar.hijri
      ? ((now - 622) * 33 / 32).floor() + 1
      : now;
}

/// أوّلُ سنةٍ تُعرَض — ‎١٣٠٠‎ هجريّةً و‎١٩٠٠‎ ميلاديّةً، وهو مدى الخادم.
int _firstYear(BirthCalendar calendar) =>
    calendar == BirthCalendar.hijri ? 1300 : 1900;

/// عددُ أيّام الشهر — والهجريُّ ثلاثون سقفًا، والميلاديُّ بحسابه.
int daysInMonth(BirthCalendar calendar, int year, int month) {
  if (calendar == BirthCalendar.hijri) return 30;
  if (month == 2) {
    final leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    return leap ? 29 : 28;
  }
  return const [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/// **خانةُ تاريخ الميلاد** — تُفتح عجلاتٍ لا لوحةَ مفاتيح.
///
/// **وكانت تُكتب نصًّا بصيغة `dd/mm/yyyy`** ويطلب الخادمُ `YYYY-MM-DD`،
/// فكلُّ تاريخٍ صحيحٍ يُكتب يُردّ برسالة «تاريخ الميلاد بصيغة سنة-شهر-يوم»
/// — وهي صيغةٌ لم تكن الشاشةُ تعرض مثالَها أصلًا. والانتقاءُ يُسقط الصيغةَ
/// من السؤال: لا ترتيبَ خاناتٍ يُخطَأ فيه، ولا شهرَ ثلاثةَ عشر.
class BirthDateField extends StatelessWidget {
  const BirthDateField({
    super.key,
    required this.calendar,
    required this.value,
    required this.onChanged,
  });

  final BirthCalendar calendar;
  final BirthDate? value;
  final ValueChanged<BirthDate> onChanged;

  @override
  Widget build(BuildContext context) {
    final picked = value;

    return GestureDetector(
      onTap: () async {
        final chosen = await showBirthDateSheet(context, calendar, picked);
        if (chosen != null) onChanged(chosen);
      },
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: AppColors.neutral100,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                picked == null ? 'اختر تاريخ ميلادك' : picked.label(calendar),
                textAlign: TextAlign.center,
                style: picked == null
                    ? AppText.body(14, color: AppColors.neutral500)
                    : AppText.body(14.5, weight: FontWeight.w700),
              ),
            ),
            const Icon(
              LucideIcons.chevronDown,
              size: 17,
              color: AppColors.neutral600,
            ),
          ],
        ),
      ),
    );
  }
}

/// ورقةُ العجلات الثلاث — يومٌ وشهرٌ وسنة.
Future<BirthDate?> showBirthDateSheet(
  BuildContext context,
  BirthCalendar calendar,
  BirthDate? initial,
) {
  return showModalBottomSheet<BirthDate>(
    context: context,
    backgroundColor: AppColors.bg,
    isScrollControlled: true,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
    ),
    builder: (context) => _BirthSheet(calendar: calendar, initial: initial),
  );
}

class _BirthSheet extends StatefulWidget {
  const _BirthSheet({required this.calendar, this.initial});

  final BirthCalendar calendar;
  final BirthDate? initial;

  @override
  State<_BirthSheet> createState() => _BirthSheetState();
}

class _BirthSheetState extends State<_BirthSheet> {
  late int _year;
  late int _month;
  late int _day;
  late final List<int> _years;
  late final FixedExtentScrollController _dayCtrl;
  late final FixedExtentScrollController _monthCtrl;
  late final FixedExtentScrollController _yearCtrl;

  @override
  void initState() {
    super.initState();
    /* وعجلةٌ تبدأ من ‎١٣٠٠‎ تُلفّ طويلًا — فتبدأ من سِنٍّ راشدة */
    final start =
        widget.initial ??
        BirthDate(widget.calendar == BirthCalendar.hijri ? 1410 : 1990, 1, 1);
    _year = start.year;
    _month = start.month;
    _day = start.day;

    /* والأحدثُ أعلى: من وُلد في ‎١٤١٠‎ لا يلفّ مئةً وعشرًا ليجدها */
    _years = [
      for (
        var y = _lastYear(widget.calendar);
        y >= _firstYear(widget.calendar);
        y--
      )
        y,
    ];

    /*
     * **وضابطُ العجلة يُبنى مرّةً** — فضابطٌ جديدٌ في كلّ رسمةٍ يُنشأ عند
     * موضعٍ ابتدائيّ، ورسمةٌ تقع أثناء اللفّ تُرجع العجلةَ إلى حيث بدأت.
     */
    _dayCtrl = FixedExtentScrollController(initialItem: _day - 1);
    _monthCtrl = FixedExtentScrollController(initialItem: _month - 1);
    _yearCtrl = FixedExtentScrollController(
      initialItem: _years.indexOf(_year).clamp(0, _years.length - 1),
    );
  }

  @override
  void dispose() {
    _dayCtrl.dispose();
    _monthCtrl.dispose();
    _yearCtrl.dispose();
    super.dispose();
  }

  int get _dayCount => daysInMonth(widget.calendar, _year, _month);

  /// **و‎٣٠‎ فبراير لا يُترك قائمًا** بعد تبديل الشهر أو السنة.
  void _clampDay() {
    if (_day <= _dayCount) return;
    _day = _dayCount;
    _dayCtrl.jumpToItem(_day - 1);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 22),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('تاريخ الميلاد', style: AppText.heading(20)),
          const SizedBox(height: 2),
          Text(
            widget.calendar == BirthCalendar.hijri
                ? 'كما في الهوية الوطنية — هجري'
                : 'كما في الإقامة — ميلادي',
            style: AppText.body(12, color: AppColors.neutral700),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 176,
            child: Row(
              children: [
                Expanded(
                  flex: 3,
                  child: _wheel(
                    label: 'يوم',
                    controller: _dayCtrl,
                    count: _dayCount,
                    index: _day - 1,
                    text: (i) => '${i + 1}',
                    onPick: (i) => setState(() => _day = i + 1),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 5,
                  child: _wheel(
                    label: 'شهر',
                    controller: _monthCtrl,
                    count: 12,
                    index: _month - 1,
                    text: (i) => monthNames(widget.calendar)[i],
                    onPick: (i) => setState(() {
                      _month = i + 1;
                      _clampDay();
                    }),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 4,
                  child: _wheel(
                    label: 'سنة',
                    controller: _yearCtrl,
                    count: _years.length,
                    index: _years.indexOf(_year).clamp(0, _years.length - 1),
                    text: (i) => '${_years[i]}',
                    onPick: (i) => setState(() {
                      _year = _years[i];
                      _clampDay();
                    }),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          GestureDetector(
            onTap: () => Navigator.pop(context, BirthDate(_year, _month, _day)),
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                'اختر ${BirthDate(_year, _month, _day).label(widget.calendar)}',
                style: AppText.body(
                  16,
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

  /// عجلةٌ واحدةٌ بعنوانها — والمنتقى في وسطها بإطارٍ ثابت.
  Widget _wheel({
    required String label,
    required FixedExtentScrollController controller,
    required int count,
    required int index,
    required String Function(int) text,
    required ValueChanged<int> onPick,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppText.body(11.5, color: AppColors.neutral700),
        ),
        const SizedBox(height: 4),
        Expanded(
          child: Stack(
            children: [
              Positioned.fill(
                child: Center(
                  child: Container(
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.neutral100,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                    ),
                  ),
                ),
              ),
              ListWheelScrollView.useDelegate(
                controller: controller,
                itemExtent: 40,
                diameterRatio: 1.6,
                physics: const FixedExtentScrollPhysics(),
                onSelectedItemChanged: onPick,
                childDelegate: ListWheelChildBuilderDelegate(
                  childCount: count,
                  builder: (context, i) => Center(
                    child: Text(
                      text(i),
                      maxLines: 1,
                      style: AppText.body(
                        15,
                        weight: i == index ? FontWeight.w700 : FontWeight.w500,
                        color: i == index
                            ? AppColors.text
                            : AppColors.neutral700,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
