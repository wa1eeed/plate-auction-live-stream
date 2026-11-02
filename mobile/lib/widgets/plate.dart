import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../design/tokens.dart';

/// نوعُ اللوحة.
enum PlateKind { private, transport, motorcycle }

/// إصدارُ اللوحة.
enum PlateFormat { long, standard, sport }

/// شعارُ منتصف الطويلة الخصوصيّ.
enum PlateEmblem { palm, gold, vision, dereyah, madaen }

/// **خريطةُ الحروف — سبعةَ عشرَ حرفًا لا غير.**
///
/// وهي حروفُ اللوحات السعوديّة المعتمدة؛ ما خرج عنها يُرسم `·` كما في النموذج.
const _letterMap = <String, String>{
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

const _arabicDigits = '٠١٢٣٤٥٦٧٨٩';

const _emblemAsset = <PlateEmblem, String>{
  PlateEmblem.palm: 'assets/emblems/palm.png',
  PlateEmblem.gold: 'assets/emblems/gold.png',
  PlateEmblem.vision: 'assets/emblems/vision.png',
  PlateEmblem.dereyah: 'assets/emblems/dereyah.png',
  PlateEmblem.madaen: 'assets/emblems/madaen.png',
};

/// عرضُ شعار المنتصف بوحدة `cqw` — رؤية ٢٠٣٠ أكبر، والدرعيّة ومدائن أصغر.
const _emblemWidthCqw = <PlateEmblem, double>{
  PlateEmblem.vision: 13,
  PlateEmblem.dereyah: 11,
  PlateEmblem.madaen: 11,
};

/// الأزرقُ الموحّد لكلّ لوحات النقل — وكلُّ ما عليه بالأسود.
const _transportBlue = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [Color(0xFF3F6FE0), Color(0xFF2A55C9)],
);

/// حبرُ اللوحة وإطارُها.
const _ink = Color(0xFF141414);

/// وجهُ اللوحة — تدرّجٌ معدنيّ `172deg`.
const _faceLong = LinearGradient(
  begin: Alignment(-0.14, -1),
  end: Alignment(0.14, 1),
  colors: [Color(0xFFFFFFFF), Color(0xFFF4F5F6), Color(0xFFE2E5E8)],
  stops: [0, 0.45, 1],
);

const _faceTop = LinearGradient(
  begin: Alignment(-0.14, -1),
  end: Alignment(0.14, 1),
  colors: [Color(0xFFFFFFFF), Color(0xFFE7EAED)],
);

const _faceBottom = LinearGradient(
  begin: Alignment(-0.14, -1),
  end: Alignment(0.14, 1),
  colors: [Color(0xFFF7F8F9), Color(0xFFE2E5E8)],
);

const _faceSport = LinearGradient(
  begin: Alignment(-0.14, -1),
  end: Alignment(0.14, 1),
  colors: [Color(0xFFFFFFFF), Color(0xFFF2F3F5), Color(0xFFDFE2E6)],
  stops: [0, 0.45, 1],
);

const _faceSportBlock = LinearGradient(
  begin: Alignment(-0.14, -1),
  end: Alignment(0.14, 1),
  colors: [Color(0xFFFFFFFF), Color(0xFFE2E5E8)],
);

/// **مستطيلُ الكروم اللامع** في شريط الاعتياديّة — كملصقٍ فضّيّ.
const _chrome = LinearGradient(
  begin: Alignment.topCenter,
  end: Alignment.bottomCenter,
  colors: [
    Color(0xFFF7F8FA),
    Color(0xFFC3C8CF),
    Color(0xFFFBFCFD),
    Color(0xFF8E959E),
    Color(0xFFD9DDE2),
    Color(0xFFA8AEB6),
  ],
  stops: [0, 0.28, 0.46, 0.62, 0.82, 1],
);

/// حرفٌ واحدٌ على اللوحة: عربيُّه ولاتينيُّه، وهل هو الباء.
class _Glyph {
  const _Glyph(this.ar, this.en, {this.isBa = false});
  final String ar;
  final String en;
  final bool isBa;
}

/// **اللوحةُ السعوديّة** — أهمُّ مكوّنٍ بصريّ في التطبيق.
///
/// منقولةٌ من `docs/design_handoff_plates_app/Plate.dc.html`، وهو المرجعُ عند
/// أيّ تعارضٍ مع وصفٍ نصّيّ.
///
/// **والمقاسُ كلُّه نسبةً إلى عرض الحاوية**: النموذجُ يكتبه بوحدة `cqw`
/// (‏١٪ من عرض الحاوية) فتتحجّم اللوحةُ بلا تشوّه. وليس في Flutter نظيرٌ
/// لـ`container-type`، فيُقاس العرضُ بـ[LayoutBuilder] ويُحسب `cqw = w / 100`.
/// فكلُّ رقمٍ في هذا الملفّ هو رقمُ النموذج نفسُه مضروبًا في `cqw`.
class SaudiPlate extends StatelessWidget {
  const SaudiPlate({
    super.key,
    required this.letters,
    required this.number,
    this.kind = PlateKind.private,
    this.format = PlateFormat.long,
    this.emblem = PlateEmblem.palm,
  });

  /// حروفٌ عربيّة، بمسافاتٍ أو بغيرها: `"ق و س"` أو `"قوس"`.
  final String letters;

  /// رقمٌ من واحدٍ إلى أربع خانات.
  final String number;

  final PlateKind kind;
  final PlateFormat format;
  final PlateEmblem emblem;

  /// **والدراجةُ النارية اعتياديّةٌ دائمًا** — لا طويلةَ لها ولا رياضيّة.
  PlateFormat get _format =>
      kind == PlateKind.motorcycle ? PlateFormat.standard : format;

  bool get _isTransport => kind == PlateKind.transport;

  List<_Glyph> get _letterGlyphs => letters
      .replaceAll(RegExp(r'\s+'), '')
      .split('')
      .map(
        (a) =>
            _Glyph(a == 'ه' ? 'هـ' : a, _letterMap[a] ?? '·', isBa: a == 'ب'),
      )
      .toList();

  List<_Glyph> get _numberGlyphs => number
      .split('')
      .map(
        (d) => RegExp(r'\d').hasMatch(d)
            ? _Glyph(_arabicDigits[int.parse(d)], d)
            : const _Glyph('·', '·'),
      )
      .toList();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cqw = constraints.maxWidth / 100;
        /*
         * **واللوحةُ تُقرأ من اليسار إلى اليمين — ولو كان التطبيق كلُّه عربيًّا.**
         *
         * النموذجُ يكتب `dir="ltr"` على جذر اللوحة في إصداراتها الثلاثة، وهو
         * ليس تفصيلًا: ترتيبُ الخانات يسار→يمين حسب اللاتينيّ، وكلُّ حرفٍ
         * عربيٍّ فوق مقابله. فلو ورثت اتّجاهَ الصفحة لانقلب الصفّان معًا —
         * فيصير «4040» رقمًا «0404»، و«ق و س» تحتها «S U G» لا «G U S».
         */
        return Directionality(
          textDirection: TextDirection.ltr,
          child: Align(
            alignment: Alignment.center,
            child: switch (_format) {
              PlateFormat.long => _LongPlate(plate: this, cqw: cqw),
              PlateFormat.standard => _StandardPlate(plate: this, cqw: cqw),
              PlateFormat.sport => _SportPlate(plate: this, cqw: cqw),
            },
          ),
        );
      },
    );
  }
}

/// **النقشُ البارزُ على الحروف والأرقام** — أربعُ طبقاتٍ من `text-shadow`.
///
/// ولاحظ أنّ النموذج يكتب الإزاحةَ السالبة بـ`min()` والموجبةَ بـ`max()`:
/// فالقيمةُ النسبيّة تصغر على المقاسات الصغيرة حتى تختفي اللمعة، فيُفرض لها
/// حدٌّ أدنى بالبكسل. و`min` لسالبٍ هو `-max` لمقداره — وهو ما يُحسب هنا.
List<Shadow> _emboss(double cqw) {
  double floor(double px, double factor) => math.max(px, factor * cqw);
  return [
    Shadow(
      offset: Offset(-floor(0.6, 0.13), -floor(0.6, 0.13)),
      color: const Color(0xF2FFFFFF),
    ),
    Shadow(
      offset: Offset(floor(0.4, 0.08), floor(0.4, 0.08)),
      color: const Color(0x610A0D12),
    ),
    Shadow(
      offset: Offset(floor(0.7, 0.15), floor(0.8, 0.18)),
      color: const Color(0x330A0D12),
    ),
    Shadow(
      offset: Offset(floor(1, 0.24), floor(1.3, 0.3)),
      blurRadius: floor(1, 0.26),
      color: const Color(0x380A0D12),
    ),
  ];
}

/// النقشُ نفسُه على الشعار — ثلاثُ طبقاتٍ عبر `drop-shadow`.
Widget _embossedEmblem(String asset, double width) {
  return Image.asset(asset, width: width, fit: BoxFit.contain);
}

/// **الظلُّ الداخليّ (الحفر)** على كلّ وجهٍ وخانةٍ وشريطٍ وكتلة.
List<BoxShadow> _engrave(double cqw, {double scale = 1}) => [
  BoxShadow(
    offset: Offset(0.17 * cqw * scale, 0.22 * cqw * scale),
    blurRadius: 0.8 * cqw * scale,
    color: const Color(0x3D0A0D12),
    blurStyle: BlurStyle.inner,
  ),
];

/// **الحافّةُ البيضاء الرفيعة جدًا خارج الإطار** — توحي أنّ الأسود إطارٌ داخليّ.
List<BoxShadow> _rim(double cqw, {double scale = 1}) => [
  const BoxShadow(color: Color(0xFFFBFBFC), spreadRadius: 1),
  const BoxShadow(color: Color(0x24201E1D), spreadRadius: 1.5),
  BoxShadow(
    offset: Offset(0, 0.5 * cqw * scale),
    blurRadius: 1.4 * cqw * scale,
    color: const Color(0x2E201E1D),
  ),
];

TextStyle _plateText(double size, List<Shadow> shadows) => TextStyle(
  fontFamily: AppFonts.plate,
  fontFamilyFallback: AppFonts.plateFallback,
  fontWeight: FontWeight.w700,
  fontSize: size,
  height: 1,
  color: _ink,
  shadows: shadows,
);

/// **خانةُ حرفٍ أو رقم** — عمودٌ بعرضٍ ثابتٍ ونصُّه في وسطه.
///
/// وهذا أصلُ القاعدة: «كلُّ حرفٍ عربيٍّ فوق ما يقابله من اللاتينيّ تمامًا».
/// فلو تُركت الحروفُ تتجاور بعرضها الطبيعيّ لانحرف العمودان — عرضُ الحبر في
/// Arial يختلف بين العربيّ واللاتينيّ، فـ«77» أطولُ من «٧٧» فوقه.
class _Cell extends StatelessWidget {
  const _Cell({required this.width, required this.child});
  final double width;
  final Widget child;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    child: Center(child: child),
  );
}

/// **الباء**: نقطةُ Arial ملتصقةٌ بالحرف، فتُرسم `ٮ` بلا نقطةٍ ومعها نقطةٌ
/// دائريّةٌ مستقلّةٌ بمسافةٍ واضحة.
class _Glyphs extends StatelessWidget {
  const _Glyphs({
    required this.glyphs,
    required this.cellWidth,
    required this.fontSize,
    required this.shadows,
    required this.latin,
  });

  final List<_Glyph> glyphs;
  final double cellWidth;
  final double fontSize;
  final List<Shadow> shadows;
  final bool latin;

  @override
  Widget build(BuildContext context) {
    final style = _plateText(fontSize, shadows);
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: glyphs.map((g) {
        if (latin || !g.isBa) {
          return _Cell(
            width: cellWidth,
            child: Text(
              latin ? g.en : g.ar,
              style: style,
              textAlign: TextAlign.center,
            ),
          );
        }
        return _Cell(
          width: cellWidth,
          child: SizedBox(
            height: fontSize,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Text('ٮ', style: style, textAlign: TextAlign.center),
                Positioned(
                  left: 0.29 * fontSize,
                  top: 0.8 * fontSize,
                  child: Container(
                    width: 0.16 * fontSize,
                    height: 0.16 * fontSize,
                    decoration: const BoxDecoration(
                      color: _ink,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

/// **كتلةُ الدولة** — في الرياضيّة، وفي الطويلة النقل مكان الشعار.
class _CountryBlock extends StatelessWidget {
  const _CountryBlock({
    required this.cqw,
    required this.width,
    required this.gradient,
    required this.radius,
    this.borderInline = 0,
  });

  final double cqw;
  final double width;
  final Gradient gradient;
  final double radius;
  final double borderInline;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: borderInline > 0
            ? Border.symmetric(
                vertical: BorderSide(color: _ink, width: borderInline),
              )
            : null,
        boxShadow: _engrave(cqw),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _embossedEmblem(_emblemAsset[PlateEmblem.palm]!, 4.6 * cqw),
          SizedBox(height: 0.5 * cqw),
          Text('السعودية', style: _plateText(1.7 * cqw, _emboss(cqw))),
          SizedBox(height: 0.5 * cqw),
          Text(
            'KSA',
            style: _plateText(
              4.4 * cqw,
              _emboss(cqw),
            ).copyWith(letterSpacing: 0.3 * cqw),
          ),
          SizedBox(height: 0.5 * cqw),
          CustomPaint(
            size: Size(3.2 * cqw, 1.6 * cqw),
            painter: _TrianglePainter(),
          ),
        ],
      ),
    );
  }
}

/// المثلّثُ السفليّ في كتلة الدولة.
class _TrianglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width / 2, size.height)
      ..close();
    canvas.drawPath(path, Paint()..color = _ink);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// **الطويلة `4.65:1`** — أرقامٌ · شعارُ المنتصف · حروفٌ · شريطُ KSA.
class _LongPlate extends StatelessWidget {
  const _LongPlate({required this.plate, required this.cqw});
  final SaudiPlate plate;
  final double cqw;

  @override
  Widget build(BuildContext context) {
    final shadows = _emboss(cqw);
    final transport = plate._isTransport;

    return Container(
      width: 100 * cqw,
      decoration: BoxDecoration(
        color: _ink,
        borderRadius: BorderRadius.circular(2.2 * cqw),
        boxShadow: _rim(cqw),
      ),
      padding: EdgeInsets.all(0.6 * cqw),
      child: AspectRatio(
        aspectRatio: 4.65 / 1,
        child: Row(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  gradient: _faceLong,
                  borderRadius: BorderRadius.circular(1 * cqw),
                  boxShadow: _engrave(cqw),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _StackedGlyphs(
                        glyphs: plate._numberGlyphs,
                        cellWidth: 7.4 * cqw,
                        arSize: 6.6 * cqw,
                        enSize: 6.4 * cqw,
                        gap: 1.2 * cqw,
                        shadows: shadows,
                      ),
                    ),
                    if (transport)
                      _CountryBlock(
                        cqw: cqw,
                        width: 14 * cqw,
                        gradient: _transportBlue,
                        radius: 0,
                        borderInline: 0.6 * cqw,
                      )
                    else
                      SizedBox(
                        width: 14 * cqw,
                        child: Center(
                          child: _embossedEmblem(
                            _emblemAsset[plate.emblem]!,
                            (_emblemWidthCqw[plate.emblem] ?? 11.5) * cqw,
                          ),
                        ),
                      ),
                    Expanded(
                      child: _StackedGlyphs(
                        glyphs: plate._letterGlyphs,
                        cellWidth: 8.6 * cqw,
                        arSize: 6.6 * cqw,
                        enSize: 6.4 * cqw,
                        gap: 1.2 * cqw,
                        shadows: shadows,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            /// **ولوحةُ النقل بلا شريطٍ جانبيّ** — كتلتُها الزرقاء في المنتصف.
            if (!transport) ...[
              SizedBox(width: 0.6 * cqw),
              _SideStrip(cqw: cqw, shadows: shadows),
            ],
          ],
        ),
      ),
    );
  }
}

/// عربيٌّ فوق لاتينيّه — عمودٌ واحدٌ بمحاذاةٍ تامّة.
class _StackedGlyphs extends StatelessWidget {
  const _StackedGlyphs({
    required this.glyphs,
    required this.cellWidth,
    required this.arSize,
    required this.enSize,
    required this.gap,
    required this.shadows,
  });

  final List<_Glyph> glyphs;
  final double cellWidth;
  final double arSize;
  final double enSize;
  final double gap;
  final List<Shadow> shadows;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _Glyphs(
          glyphs: glyphs,
          cellWidth: cellWidth,
          fontSize: arSize,
          shadows: shadows,
          latin: false,
        ),
        SizedBox(height: gap),
        _Glyphs(
          glyphs: glyphs,
          cellWidth: cellWidth,
          fontSize: enSize,
          shadows: shadows,
          latin: true,
        ),
      ],
    );
  }
}

/// **الشريطُ الجانبيّ للطويلة** — شعارٌ و«السعودية» وKSA عموديًّا.
class _SideStrip extends StatelessWidget {
  const _SideStrip({required this.cqw, required this.shadows});
  final double cqw;
  final List<Shadow> shadows;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 6 * cqw,
      decoration: BoxDecoration(
        gradient: _faceTop,
        borderRadius: BorderRadius.circular(0.8 * cqw),
        boxShadow: _engrave(cqw),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _embossedEmblem(_emblemAsset[PlateEmblem.palm]!, 3.4 * cqw),
          SizedBox(height: 0.5 * cqw),
          Text(
            'السعودية',
            style: _plateText(1.05 * cqw, shadows),
            maxLines: 1,
            overflow: TextOverflow.visible,
          ),
          SizedBox(height: 0.5 * cqw),
          Column(
            children: ['K', 'S', 'A']
                .map(
                  (c) => Text(
                    c,
                    style: _plateText(
                      1.9 * cqw,
                      shadows,
                    ).copyWith(height: 1.02),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    );
  }
}

/// **الاعتياديّة `2:1`** — شبكةُ ٢×٢ بأعمدةٍ متساوية، والشريطُ إلى جانبها.
///
/// وعرضُها `69cqw` لا `100`: كُبّرت نسبةً إلى الحاوية لتماثلَ الطويلةَ ارتفاعًا
/// في الكروت — فلا يتغيّر ارتفاع الكرت بتغيّر نوع اللوحة.
class _StandardPlate extends StatelessWidget {
  const _StandardPlate({required this.plate, required this.cqw});
  final SaudiPlate plate;
  final double cqw;

  @override
  Widget build(BuildContext context) {
    /// النقشُ في الاعتياديّة أكبر — النموذجُ يكتب له مُعامِلاتٍ أوسع.
    final shadows = _embossStandard(cqw);
    final transport = plate._isTransport;
    final gap = 0.75 * cqw;

    Widget cell(Gradient face, Widget child) => Expanded(
      child: Container(
        decoration: BoxDecoration(
          gradient: face,
          borderRadius: BorderRadius.circular(0.9 * cqw),
          boxShadow: _engrave(cqw, scale: 1.5),
        ),
        child: Center(child: child),
      ),
    );

    return Container(
      width: 69 * cqw,
      decoration: BoxDecoration(
        color: _ink,
        borderRadius: BorderRadius.circular(2.7 * cqw),
        boxShadow: _rim(cqw, scale: 1.5),
      ),
      padding: EdgeInsets.all(gap),
      child: AspectRatio(
        aspectRatio: 2 / 1,
        child: Row(
          children: [
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        cell(
                          _faceTop,
                          _Glyphs(
                            glyphs: plate._numberGlyphs,
                            cellWidth: 6.6 * cqw,
                            fontSize: 8.7 * cqw,
                            shadows: shadows,
                            latin: false,
                          ),
                        ),
                        SizedBox(width: gap),
                        cell(
                          _faceTop,
                          _Glyphs(
                            glyphs: plate._letterGlyphs,
                            cellWidth: 8.1 * cqw,
                            fontSize: 8.4 * cqw,
                            shadows: shadows,
                            latin: false,
                          ),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: gap),
                  Expanded(
                    child: Row(
                      children: [
                        cell(
                          _faceBottom,
                          _Glyphs(
                            glyphs: plate._numberGlyphs,
                            cellWidth: 6.6 * cqw,
                            fontSize: 8.4 * cqw,
                            shadows: shadows,
                            latin: true,
                          ),
                        ),
                        SizedBox(width: gap),
                        cell(
                          _faceBottom,
                          _Glyphs(
                            glyphs: plate._letterGlyphs,
                            cellWidth: 8.1 * cqw,
                            fontSize: 8.1 * cqw,
                            shadows: shadows,
                            latin: true,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: gap),
            _StandardStrip(
              cqw: cqw,
              shadows: shadows,
              gradient: transport ? _transportBlue : _faceTop,

              /// **والدراجةُ بلا كرومٍ ولا دائرة** — هندسةُ الاعتياديّة وحدها.
              withChrome: plate.kind != PlateKind.motorcycle,
            ),
          ],
        ),
      ),
    );
  }
}

/// نقشُ الاعتياديّة — مُعامِلاتُه أوسعُ من الطويلة لأنّ حرفَها أكبر.
List<Shadow> _embossStandard(double cqw) {
  double floor(double px, double factor) => math.max(px, factor * cqw);
  return [
    Shadow(
      offset: Offset(-floor(0.6, 0.19), -floor(0.6, 0.19)),
      color: const Color(0xF2FFFFFF),
    ),
    Shadow(
      offset: Offset(floor(0.4, 0.12), floor(0.4, 0.12)),
      color: const Color(0x610A0D12),
    ),
    Shadow(
      offset: Offset(floor(0.7, 0.22), floor(0.8, 0.27)),
      color: const Color(0x330A0D12),
    ),
    Shadow(
      offset: Offset(floor(1, 0.36), floor(1.3, 0.45)),
      blurRadius: floor(1, 0.39),
      color: const Color(0x380A0D12),
    ),
  ];
}

/// **شريطُ الاعتياديّة** — من أعلى إلى أسفل بـ`space-between`:
/// [شعار + «السعودية»] · K/S/A · [كرومٌ لامعٌ + دائرةٌ سوداء] حتى الحدّ السفليّ.
class _StandardStrip extends StatelessWidget {
  const _StandardStrip({
    required this.cqw,
    required this.shadows,
    required this.gradient,
    required this.withChrome,
  });

  final double cqw;
  final List<Shadow> shadows;
  final Gradient gradient;
  final bool withChrome;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 9 * cqw,
      padding: EdgeInsets.symmetric(vertical: 1.35 * cqw),
      decoration: BoxDecoration(
        gradient: gradient,
        borderRadius: BorderRadius.circular(0.9 * cqw),
        boxShadow: _engrave(cqw, scale: 1.5),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            children: [
              _embossedEmblem(_emblemAsset[PlateEmblem.palm]!, 6.3 * cqw),
              SizedBox(height: 0.38 * cqw),
              Text(
                'السعودية',
                style: _plateText(1.95 * cqw, shadows),
                maxLines: 1,
                overflow: TextOverflow.visible,
              ),
            ],
          ),
          Column(
            children: ['K', 'S', 'A']
                .map(
                  (c) => Text(
                    c,
                    style: _plateText(
                      3.6 * cqw,
                      shadows,
                    ).copyWith(height: 1.02),
                  ),
                )
                .toList(),
          ),
          if (withChrome)
            Column(
              children: [
                Container(
                  width: 6.9 * cqw,
                  height: 2.25 * cqw,
                  decoration: BoxDecoration(
                    gradient: _chrome,
                    borderRadius: BorderRadius.circular(0.38 * cqw),
                    border: Border.all(
                      color: const Color(0x40141414),
                      width: 0.15 * cqw,
                    ),
                    boxShadow: [
                      BoxShadow(
                        offset: Offset(0, 0.15 * cqw),
                        blurRadius: 0.3 * cqw,
                        color: const Color(0x40141414),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 1.05 * cqw),
                Container(
                  width: 4.8 * cqw,
                  height: 4.8 * cqw,
                  decoration: const BoxDecoration(
                    color: _ink,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            )
          else
            const SizedBox.shrink(),
        ],
      ),
    );
  }
}

/// **الرياضيّة `3.8:1` — إنجليزيٌّ فقط**، وكتلةُ الدولة في وسطها.
///
/// ولا تظهر إلّا لخصوصيٍّ أو نقلٍ خاصّ — لا للدراجة.
class _SportPlate extends StatelessWidget {
  const _SportPlate({required this.plate, required this.cqw});
  final SaudiPlate plate;
  final double cqw;

  @override
  Widget build(BuildContext context) {
    final shadows = _emboss(cqw);
    final numEn = plate._numberGlyphs.map((g) => g.en).join();
    final lettersEn = plate._letterGlyphs.map((g) => g.en).join();

    Widget face(String text) => Expanded(
      child: Container(
        decoration: BoxDecoration(
          gradient: _faceSport,
          borderRadius: BorderRadius.circular(0.9 * cqw),
          boxShadow: _engrave(cqw),
        ),
        padding: EdgeInsetsDirectional.only(start: 0.8 * cqw),
        child: Center(
          child: Text(
            text,
            style: _plateText(
              10.5 * cqw,
              shadows,
            ).copyWith(letterSpacing: 0.8 * cqw),
          ),
        ),
      ),
    );

    return Container(
      width: 82 * cqw,
      decoration: BoxDecoration(
        color: _ink,
        borderRadius: BorderRadius.circular(2 * cqw),
        boxShadow: _rim(cqw),
      ),
      padding: EdgeInsets.all(0.6 * cqw),
      child: AspectRatio(
        aspectRatio: 3.8 / 1,
        child: Row(
          children: [
            face(numEn),
            SizedBox(width: 0.6 * cqw),
            _CountryBlock(
              cqw: cqw,
              width: 15 * cqw,
              gradient: plate._isTransport ? _transportBlue : _faceSportBlock,
              radius: 0.6 * cqw,
            ),
            SizedBox(width: 0.6 * cqw),
            face(lettersEn),
          ],
        ),
      ),
    );
  }
}
