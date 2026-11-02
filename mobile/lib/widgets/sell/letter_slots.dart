import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';
import '../plate.dart';

/// **حروفُ اللوحة السبعةَ عشر** — عربيُّها ولاتينيُّها.
const plateLetters = <(String, String)>[
  ('ا', 'A'),
  ('ب', 'B'),
  ('ح', 'J'),
  ('د', 'D'),
  ('ر', 'R'),
  ('س', 'S'),
  ('ص', 'X'),
  ('ط', 'T'),
  ('ع', 'E'),
  ('ق', 'G'),
  ('ك', 'K'),
  ('ل', 'L'),
  ('م', 'Z'),
  ('ن', 'N'),
  ('ه', 'H'),
  ('و', 'U'),
  ('ى', 'V'),
];

/// **ثلاثُ خاناتٍ تُفتح بالتتابع** — §5.5.
///
/// **ولا تُفتح الثانيةُ قبل الأولى**: من ملأ الثالثةَ وترك الأولى أنشأ لوحةً
/// ناقصةً تُردّ عند الحفظ. والتتابعُ يمنع الخطأَ قبل وقوعه لا بعده.
///
/// **ومع الرياضيّة يُبرز اللاتينيّ**: إصدارٌ إنجليزيٌّ فقط، فمن يختار حروفَه
/// يختارها بما سيُطبع عليها.
class LetterSlots extends StatelessWidget {
  const LetterSlots({
    super.key,
    required this.letters,
    required this.onChanged,
    this.latinFirst = false,
  });

  /// ثلاثُ خاناتٍ، و`null` لما لم يُختر بعد.
  final List<String?> letters;

  final ValueChanged<List<String?>> onChanged;

  /// الرياضيّةُ تُبرز اللاتينيّ.
  final bool latinFirst;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(width: 8),
          Expanded(child: _slot(context, i)),
        ],
      ],
    );
  }

  /// الخانةُ الأولى مفتوحةٌ دائمًا، وما بعدها يُفتح بما قبله.
  bool _enabled(int i) => i == 0 || letters[i - 1] != null;

  Widget _slot(BuildContext context, int i) {
    final value = letters[i];
    final enabled = _enabled(i);

    return Opacity(
      opacity: enabled ? 1 : 0.45,
      child: GestureDetector(
        onTap: enabled ? () => _pick(context, i) : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: value == null ? Colors.transparent : AppColors.neutral100,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(
              color: value == null ? AppColors.neutral400 : AppColors.accent,
              width: value == null ? 1.5 : 2,
            ),
          ),
          alignment: Alignment.center,
          child: value == null
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      LucideIcons.plus,
                      size: 18,
                      color: AppColors.neutral600,
                    ),
                    if (i == 0) ...[
                      const SizedBox(height: 2),
                      Text(
                        'اختر',
                        style: AppText.body(10.5, color: AppColors.neutral600),
                      ),
                    ],
                  ],
                )
              : _glyph(value),
        ),
      ),
    );
  }

  Widget _glyph(String ar) {
    final latin = plateLetters.firstWhere((e) => e.$1 == ar).$2;
    final top = latinFirst ? latin : (ar == 'ه' ? 'هـ' : ar);
    final bottom = latinFirst ? (ar == 'ه' ? 'هـ' : ar) : latin;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          top,
          style: TextStyle(
            fontFamily: AppFonts.plate,
            fontFamilyFallback: AppFonts.plateFallback,
            fontWeight: FontWeight.w700,
            fontSize: 22,
            height: 1,
            color: AppColors.text,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          bottom,
          style: TextStyle(
            fontFamily: AppFonts.plate,
            fontFamilyFallback: AppFonts.plateFallback,
            fontWeight: FontWeight.w700,
            fontSize: 14,
            height: 1,
            color: AppColors.neutral700,
          ),
        ),
      ],
    );
  }

  Future<void> _pick(BuildContext context, int i) async {
    final chosen = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.bg,
      /*
       * **وارتفاعُها يتبع محتواها** — سبعةَ عشرَ حرفًا في خمسة أعمدةٍ أطولُ
       * من نصف الشاشة، وهو حدُّ الورقة الافتراضيّ. فبدونه تفيض وتُقصّ
       * الصفوفُ الأخيرة، ومن لم ير «ى» ظنّها غيرَ مدعومة.
       */
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadii.sheet),
        ),
      ),
      builder: (context) => _LetterSheet(latinFirst: latinFirst),
    );
    if (chosen == null) return;

    final next = [...letters];
    next[i] = chosen;
    /* وما بعد المُغيَّرة يُفرَّغ: الترتيبُ معنًى لا تجاور */
    onChanged(next);
  }
}

/// ورقةُ اختيار الحرف — السبعةَ عشر وحدها.
class _LetterSheet extends StatelessWidget {
  const _LetterSheet({required this.latinFirst});

  final bool latinFirst;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 5,
              decoration: BoxDecoration(
                color: AppColors.neutral400,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
            ),
            const SizedBox(height: 14),
            Text('اختر الحرف', style: AppText.heading(19)),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 5,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 1.15,
              children: plateLetters.map((e) {
                final top = latinFirst ? e.$2 : (e.$1 == 'ه' ? 'هـ' : e.$1);
                final bottom = latinFirst ? (e.$1 == 'ه' ? 'هـ' : e.$1) : e.$2;
                return GestureDetector(
                  onTap: () => Navigator.of(context).pop(e.$1),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          top,
                          style: TextStyle(
                            fontFamily: AppFonts.plate,
                            fontFamilyFallback: AppFonts.plateFallback,
                            fontWeight: FontWeight.w700,
                            fontSize: 20,
                            height: 1,
                            color: AppColors.text,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          bottom,
                          style: TextStyle(
                            fontFamily: AppFonts.plate,
                            fontFamilyFallback: AppFonts.plateFallback,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                            height: 1,
                            color: AppColors.neutral700,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }
}

/// **منتقي شعار المنتصف** — خمسةُ أزرارٍ بلا أسماء، والاسمُ في `aria-label`.
///
/// فالشعارُ يُعرف بصورته لا باسمه: من رآه عرفه، ومن لم يعرفه لا يُفيده
/// «مدائن صالح» مكتوبًا تحت أيقونةٍ ‎٢٨‎ بكسلًا.
class EmblemPicker extends StatelessWidget {
  const EmblemPicker({super.key, required this.value, required this.onChanged});

  final PlateEmblem value;
  final ValueChanged<PlateEmblem> onChanged;

  static const _names = <PlateEmblem, String>{
    PlateEmblem.palm: 'النخلة والسيفان',
    PlateEmblem.gold: 'الشعار الذهبي',
    PlateEmblem.vision: 'رؤية 2030',
    PlateEmblem.dereyah: 'الدرعية',
    PlateEmblem.madaen: 'مدائن صالح',
  };

  static const _assets = <PlateEmblem, String>{
    PlateEmblem.palm: 'assets/emblems/palm.png',
    PlateEmblem.gold: 'assets/emblems/gold.png',
    PlateEmblem.vision: 'assets/emblems/vision.png',
    PlateEmblem.dereyah: 'assets/emblems/dereyah.png',
    PlateEmblem.madaen: 'assets/emblems/madaen.png',
  };

  @override
  Widget build(BuildContext context) => Row(
    children: PlateEmblem.values.map((e) {
      final active = e == value;
      return Expanded(
        child: Padding(
          padding: const EdgeInsetsDirectional.only(end: 6),
          child: Semantics(
            button: true,
            selected: active,
            label: _names[e],
            child: GestureDetector(
              onTap: () => onChanged(e),
              behavior: HitTestBehavior.opaque,
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.neutral100,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(
                    color: active ? AppColors.accent : AppColors.divider,
                    width: active ? 2 : 1,
                  ),
                ),
                alignment: Alignment.center,
                child: Image.asset(_assets[e]!, width: 28, height: 28),
              ),
            ),
          ),
        ),
      );
    }).toList(),
  );
}
