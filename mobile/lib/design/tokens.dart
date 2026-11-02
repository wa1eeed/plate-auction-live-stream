import 'package:flutter/widgets.dart';

/// رموزُ التصميم — من حزمة التسليم `docs/design_handoff_plates_app`.
///
/// **ولماذا تُكتب هنا لا تُقرأ من `_ds/styles.css`؟** لأنّ ملفَّ النظام
/// (Organic) يحمل برتقاليَّه الأصليّ `#c67139`، والحزمةُ تُعيد تعريف اللون
/// الرئيسيّ أخضرَ العلم السعوديّ على `:root` (انظر `THEMES.green`). فالقيمةُ
/// المعتمدة هي ما في §2.1 من `README.md`، لا ما في ملفّ النظام.
abstract final class AppColors {
  /// أخضر العلم السعوديّ — قرارٌ صريح: لا البرتقاليّ ولا الكحليّ.
  static const accent = Color(0xFF006C35);
  static const accent100 = Color(0xFFE6F4EC);
  static const accent200 = Color(0xFFC7E6D3);
  static const accent300 = Color(0xFF94CFAB);
  static const accent400 = Color(0xFF57B07D);
  static const accent500 = Color(0xFF1F8F52);
  static const accent600 = Color(0xFF007A3D);
  static const accent700 = Color(0xFF006C35);
  static const accent800 = Color(0xFF00502A);
  static const accent900 = Color(0xFF003520);

  /// الثاني (sage): «البيع المباشر»، «أنت الأعلى»، «أنت المشتري»، النجاح.
  static const accent2 = Color(0xFF7A8A5E);
  static const accent2_100 = Color(0xFFF0FAE1);
  static const accent2_200 = Color(0xFFE1EECC);
  static const accent2_300 = Color(0xFFCCDBB2);
  static const accent2_600 = Color(0xFF728157);
  static const accent2_700 = Color(0xFF56633F);
  static const accent2_800 = Color(0xFF3D472B);
  static const accent2_900 = Color(0xFF272E1B);

  static const bg = Color(0xFFF5EAD8);
  static const surface = Color(0xFFEBDDC5);
  static const text = Color(0xFF201E1D);

  static const neutral100 = Color(0xFFF9F4ED);
  static const neutral200 = Color(0xFFEEE7DB);
  static const neutral300 = Color(0xFFDCD3C4);
  static const neutral400 = Color(0xFFC0B6A5);
  static const neutral500 = Color(0xFFA19786);
  static const neutral600 = Color(0xFF82796A);
  static const neutral700 = Color(0xFF645C50);
  static const neutral800 = Color(0xFF474238);
  static const neutral900 = Color(0xFF2E2B25);

  /// حدٌّ رفيع 1px — `--color-text` بشفافية ١٦٪.
  static const divider = Color(0x29201E1D);

  /// أحمر الحذف والإلغاء والمحطّة المتعثّرة.
  static const danger = Color(0xFFA3261B);
}

/// الانحناءات — §2.3.
abstract final class AppRadii {
  /// الكروت على خلفية `surface`.
  static const card = 12.0;

  /// كروت الرئيسية والمعرض والصفقات (خلفية `neutral-100` + حدّ).
  static const cardOutlined = 14.0;

  /// الإطارُ الداخليّ الذي تجلس فيه اللوحة داخل الكرت.
  static const plateInset = 8.0;

  static const banner = 16.0;

  /// الأزرار والحقول والتابات والوسوم.
  static const pill = 999.0;

  static const sheet = 28.0;

  /// خانات العدّاد (و`5` في المعرض).
  static const counterCell = 6.0;
}

/// أسماءُ عوائل الخطوط — §2.2.
abstract final class AppFonts {
  /// واجهةٌ عامّة: اللاتينيّ على Figtree والعربيّ على IBM Plex Sans Arabic.
  static const ui = 'Figtree';
  static const arabic = 'IBMPlexSansArabic';

  /// العناوين القليلة المتبقّية وأزرار الإجراء الكبيرة.
  static const display = 'Caprasimo';

  /// **حروفُ اللوحة وأرقامها — Arial Bold فقط، قرارٌ صريح.**
  ///
  /// والعربيُّ قد لا يكون في Arial وحده، فالحزمةُ تُسنده إلى
  /// `'Arial Unicode MS'`. وهنا يُقابله `fontFamilyFallback` في [plateTextStyle].
  static const plate = 'PlateArial';
  static const plateFallback = ['PlateArialUnicode'];
}
