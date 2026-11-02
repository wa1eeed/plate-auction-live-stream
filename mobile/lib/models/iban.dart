/// **الآيبان السعوديّ** — `SA` ثمّ اثنان وعشرون رقمًا.
///
/// ويُنسَّق مجموعاتٍ رباعيّةً وأنت تكتب: `SA03 8000 0000 6080 1016 7519`.
/// **فأربعةٌ وعشرون محرفًا متّصلةً لا تُراجَع بالعين** — ومن ينسخه من تطبيق
/// بنكه يلصقه بمسافاته، ومن يكتبه يُسقط رقمًا ولا يرى أين.
abstract final class Iban {
  /// يزيل ما ليس حرفًا ولا رقمًا ويرفع الحروف.
  static String normalize(String raw) =>
      raw.replaceAll(RegExp(r'[^A-Za-z0-9]'), '').toUpperCase();

  /// يُنسّق مجموعاتٍ من أربعة.
  static String format(String raw) {
    final clean = normalize(raw);
    final out = StringBuffer();
    for (var i = 0; i < clean.length; i++) {
      if (i > 0 && i % 4 == 0) out.write(' ');
      out.write(clean[i]);
    }
    return out.toString();
  }

  /// `SA` + ‎٢٢‎ رقمًا.
  static bool isValid(String raw) =>
      RegExp(r'^SA\d{22}$').hasMatch(normalize(raw));

  /// **رسالةُ الخطأ تقول ما ينقص** — لا «آيبان غير صحيح».
  ///
  /// فمن كتب ثمانيةَ عشرَ رقمًا يريد أن يعرف كم بقي، لا أن يُعيد العدّ.
  static String? error(String raw) {
    final clean = normalize(raw);
    if (clean.isEmpty) return null;
    if (!clean.startsWith('SA')) return 'يبدأ الآيبان السعودي بـ SA';
    final digits = clean.substring(2);
    if (digits.contains(RegExp(r'\D'))) return 'بعد SA أرقام فقط';
    if (digits.length < 22) return 'بقي ${22 - digits.length} رقمًا';
    if (digits.length > 22) return 'زادت ${digits.length - 22} أرقام';
    return null;
  }

  /// **اسمُ البنك من رمزه** — أربعةُ محارفَ بعد `SA` ورقمَي الفحص.
  ///
  /// ويُعرض فورَ اكتمالها، فيُطمئن من لصق آيبانًا أنّه آيبانُ بنكه هو.
  static String? bankName(String raw) {
    final clean = normalize(raw);
    if (clean.length < 6 || !clean.startsWith('SA')) return null;
    return _banks[clean.substring(4, 6)];
  }

  /// رمزُ البنك رقمان في الآيبان السعوديّ.
  static const _banks = <String, String>{
    '80': 'مصرف الراجحي',
    '10': 'البنك الأهلي السعودي',
    '45': 'بنك الرياض',
    '15': 'البنك السعودي البريطاني',
    '55': 'البنك السعودي الفرنسي',
    '05': 'بنك الرياض',
    '20': 'بنك الرياض',
    '30': 'البنك العربي الوطني',
    '40': 'بنك الجزيرة',
    '50': 'البنك السعودي للاستثمار',
    '60': 'بنك البلاد',
    '65': 'مصرف الإنماء',
    '71': 'بنك الخليج الدولي',
    '76': 'بنك الإمارات دبي الوطني',
  };

  /// **يُحفظ مقنّعًا** — آخرُ أربعةٍ وحدها تُعرض بعد الحفظ.
  static String mask(String raw) {
    final clean = normalize(raw);
    if (clean.length < 8) return clean;
    return '${clean.substring(0, 4)} •••• •••• ${clean.substring(clean.length - 4)}';
  }
}
