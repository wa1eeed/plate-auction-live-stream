/// **استعلامُ البحث — يُطبَّع فورًا وأنت تكتب.**
///
/// والمستخدمُ يكتب ما يحضره: «سعد» بالعربيّة، أو «SED» باللاتينيّة، أو
/// «١» بأرقامٍ عربيّة. ولا يُسأل أيَّها يريد — يُقرأ الثلاثةُ ويُردّان إلى
/// صورةٍ واحدة، ثمّ يُعرض عليه ما فُهم منه: «نبحث عن [حروف: س ع د SED]».
///
/// **ويُعرض ما فُهم لا ما كُتب**: بحثٌ صامتٌ يردّ لا شيءَ لا يقول أين الخلل —
/// أفي الحرف أم في الرقم.
class PlateQuery {
  const PlateQuery({required this.letters, required this.digits});

  /// حروفٌ عربيّةٌ مُطبَّعة، بترتيب ما كُتب.
  final List<String> letters;

  /// أرقامٌ غربيّة.
  final String digits;

  bool get isEmpty => letters.isEmpty && digits.isEmpty;

  /// مقابلُ الحروف باللاتينيّة — يُعرض بجانبها في الرقاقة.
  String get latin => letters.map((l) => _arToLatin[l] ?? '').join();

  /// خريطةُ الحروف السبعةَ عشر — عربيُّها ولاتينيُّها.
  static const _arToLatin = <String, String>{
    'ا': 'A',
    'ب': 'B',
    'ح': 'J',
    'د': 'D',
    'ر': 'R',
    'س': 'S',
    'ص': 'X',
    'ط': 'T',
    'ع': 'E',
    'ق': 'G',
    'ك': 'K',
    'ل': 'L',
    'م': 'Z',
    'ن': 'N',
    'ه': 'H',
    'و': 'U',
    'ى': 'V',
  };

  static final _latinToAr = {
    for (final e in _arToLatin.entries) e.value: e.key,
  };

  /// أشكالُ الحرف التي يكتبها الناس ولا تطابق صورتَه على اللوحة.
  static const _normalize = <String, String>{
    'أ': 'ا',
    'إ': 'ا',
    'آ': 'ا',
    'ى': 'ى',
    'ي': 'ى',
    'ة': 'ه',
    'ۀ': 'ه',
  };

  static const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';

  /// يقرأ ما كُتب أيًّا كانت لغتُه.
  factory PlateQuery.parse(String raw) {
    final letters = <String>[];
    final digits = StringBuffer();

    for (final ch in raw.characters) {
      final c = _normalize[ch] ?? ch;

      if (_arToLatin.containsKey(c)) {
        letters.add(c);
        continue;
      }
      final upper = c.toUpperCase();
      if (_latinToAr.containsKey(upper)) {
        letters.add(_latinToAr[upper]!);
        continue;
      }
      if (RegExp(r'\d').hasMatch(c)) {
        digits.write(c);
        continue;
      }
      final ai = _arabicDigits.indexOf(c);
      if (ai >= 0) digits.write(ai);
    }

    return PlateQuery(letters: letters, digits: digits.toString());
  }

  /// هل تُطابق هذه اللوحةُ ما طُلب؟
  ///
  /// والمطابقةُ **احتواءٌ بالترتيب** لا تساوٍ: من كتب «س» يريد كلَّ لوحةٍ
  /// فيها سين، ومن كتب «١» يريد كلَّ رقمٍ فيه واحد.
  bool matches({required String plateLetters, required String plateNumber}) {
    if (isEmpty) return true;

    final theirs = plateLetters
        .replaceAll(RegExp(r'\s+'), '')
        .split('')
        .map((c) => _normalize[c] ?? c)
        .toList();

    if (letters.isNotEmpty) {
      var i = 0;
      for (final l in theirs) {
        if (i < letters.length && l == letters[i]) i++;
      }
      if (i < letters.length) return false;
    }

    if (digits.isNotEmpty && !plateNumber.contains(digits)) return false;
    return true;
  }
}

extension on String {
  Iterable<String> get characters => split('');
}
