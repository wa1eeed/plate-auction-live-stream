import 'package:flutter/foundation.dart';
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

  /// **حروفُ اللوحة — Arial من النظام، ولا يُضمَّن.**
  ///
  /// كان يُحزم في التطبيق، فردّت أبل الرفعَ بـ`ITMS-91198: Disallowed font`.
  /// وهي تُرخّص Arial من Monotype لنظامها وحده، وتضمينُه في حزمةٍ خرقٌ
  /// للترخيص تكشفه آليًّا. فلا يُشحن مهما اشتُري — المانعُ أبل لا السعر.
  ///
  /// **و iOS فيه Arial نظامًا**، فيُطلب بالاسم فيرسمه النظامُ كما يريد
  /// التصميم بلا تضمين. وهو في ويندوز وmacOS كذلك.
  /// **ويُختار بالمنصّة لا بالاحتياط.**
  ///
  /// فـ`fontFamilyFallback` لا يُنقذ هنا: حين تغيب `Arial` يُسند Flutter
  /// الحروفَ **اللاتينيّةَ** إلى خطّ النظام الافتراضيّ — وهو يُجيبها — ولا
  /// يبلغ الاحتياطيَّ إلّا لما لا يُجيبه، أي العربيَّ وحده. فتخرج اللوحةُ
  /// بخطّين: عربيٌّ بـNoto ولاتينيٌّ بـRoboto. وقد رُئي ذلك في اللوحات.
  ///
  /// فيُسمّى لكلّ منصّةٍ خطُّها كاملًا، ولا يُترك الأمرُ لترتيبِ إسنادٍ
  /// يختلف باختلاف ما في الجهاز.
  static String get plate =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'Arial' : 'PlateNoto';

  /// **والاحتياطيُّ لمن لا Arial عنده** — أندرويد ولينكس.
  ///
  /// وهو Noto Sans Arabic بترخيص OFL: يُوزَّع بلا قيدٍ ويُحزم بلا إذن،
  /// وقُرئ جدولُ محارفه فوُجد فيه الثلاثون التي تحتاجها اللوحة.
  ///
  /// **وشكلُه يخالف Arial قليلًا** — وهو ثمنٌ لا مفرَّ منه: خطٌّ يُشحن خيرٌ
  /// من تطبيقٍ لا يُرفع. ومن رأى اللوحتين جنبًا إلى جنبٍ عرف الفرق، ومن رأى
  /// واحدةً قرأها لوحةً صحيحة.
  /// والاحتياطيُّ شبكةُ أمانٍ لا أكثر — فالمنصّةُ حسمت الاختيار.
  static const plateFallback = ['PlateNoto'];
}

/// **أنماطُ النصّ** — §2.2.
///
/// والأرقامُ غربيّةٌ دائمًا وبـ`tabular-nums` في كلّ سعرٍ وعدّادٍ ووقت: فعرضُ
/// الرقم يثبت، فلا يرقص السعرُ ولا يتزحزح العدّادُ وهو ينزل.
abstract final class AppText {
  static const _tabular = [FontFeature.tabularFigures()];

  /// الأساسُ: لاتينيٌّ على Figtree وعربيٌّ على Plex — والخلطُ وارد.
  static const base = TextStyle(
    fontFamily: AppFonts.ui,
    fontFamilyFallback: [AppFonts.arabic],
    color: AppColors.text,
    height: 1.45,
  );

  /// **العناوينُ والأسعارُ والمبالغ**: Plex 700 — قرارٌ صريح، «رسميّةٌ
  /// واحترافية» لا الخطّ الاستعراضيّ.
  static TextStyle money(double size) => base.copyWith(
    fontFamily: AppFonts.arabic,
    fontWeight: FontWeight.w700,
    fontSize: size,
    height: 1.2,
    fontFeatures: _tabular,
  );

  static TextStyle heading(double size) => base.copyWith(
    fontFamily: AppFonts.arabic,
    fontWeight: FontWeight.w700,
    fontSize: size,
    height: 1.3,
  );

  static TextStyle body(double size, {FontWeight? weight, Color? color}) =>
      base.copyWith(
        fontSize: size,
        fontWeight: weight ?? FontWeight.w400,
        color: color,
      );

  /// رقمٌ يُقرأ خانةً خانة — العدّادات وأرقام الإعلان والمراجع.
  static TextStyle digits(
    double size, {
    FontWeight weight = FontWeight.w700,
    Color? color,
  }) => base.copyWith(
    fontFamily: AppFonts.arabic,
    fontSize: size,
    fontWeight: weight,
    height: 1,
    color: color,
    fontFeatures: _tabular,
  );
}
