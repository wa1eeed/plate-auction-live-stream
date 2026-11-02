import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_client.dart';
import '../design/tokens.dart';
import '../models/chat.dart';
import '../widgets/common/toast.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;

/// **محادثةُ الصفقة** — §5.7.
///
/// **وتُفتح من الصفقة وحدها**: لا دليلَ مستخدمين ولا محادثاتٌ عامّة. فمن
/// يتحدّث إليك هو طرفُ صفقةٍ قائمةٍ معك، ومحفوظةٌ للطرفين في سجلّها —
/// فما اتُّفق عليه هنا يُراجَع حين يُختلف.
class ChatScreen extends StatefulWidget {
  const ChatScreen({
    super.key,
    required this.counterpartName,
    required this.counterpartRole,
    required this.orderReference,
    required this.plateLabel,
    required this.messages,
    this.onBack,
    this.onSend,
    this.onCall,
  });

  final String counterpartName;
  final String counterpartRole;
  final String orderReference;
  final String plateLabel;
  final List<ChatMessage> messages;
  final VoidCallback? onBack;

  /// **يُرسل النصَّ ويُعيد ما حفظه الخادم** — أو يرمي فتُرَدّ الفقاعة.
  ///
  /// فالشاشةُ ترسم ما كُتب فورًا ولا تنتظر جولةً كاملة، ثمّ تستبدله بما وصل.
  /// ولو سقط الطلبُ رُدّت الفقاعةُ وعاد النصُّ إلى الحقل — فلا تبقى رسالةٌ
  /// مرسومةً يظنّها صاحبُها وصلت وما وصلت.
  final Future<ChatMessage> Function(String body)? onSend;

  final VoidCallback? onCall;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _scroll = ScrollController();
  final _input = TextEditingController();

  /*
   * **ما أُرسل في هذه الجلسة** — فوق ما وصل من الخادم.
   *
   * ولا تُنسخ القائمةُ المُمرَّرةُ كلُّها إلى الحالة: لو نُسخت لجُمّدت على
   * أوّل بناءٍ، فلا يظهر ما كتبه الطرفُ الآخر حين تُحدَّث الشاشةُ من فوق.
   */
  final _sent = <ChatMessage>[];

  /* نصٌّ في الطريق — يُرسم فقاعةً شاحبةً حتّى يردّ الخادم */
  String? _flight;

  List<ChatMessage> get _all => [
    ...widget.messages,
    ..._sent,
    if (_flight != null) ChatMessage.pending(_flight!),
  ];

  bool get _canSend => _input.text.trim().isNotEmpty && _flight == null;

  @override
  void initState() {
    super.initState();
    /* والزرُّ يتبدّل بين الميكروفون والإرسال مع أوّل حرف */
    _input.addListener(() => setState(() {}));
    /*
     * **وتُفتح على آخر رسالة.**
     *
     * فمحادثةٌ تُفتح على أوّلها تُجبر صاحبَها على التمرير في كلّ مرّة، وما
     * يهمّه آخرُ ما وصل.
     */
    WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
  }

  @override
  void dispose() {
    _scroll.dispose();
    _input.dispose();
    super.dispose();
  }

  void _toBottom() {
    if (!_scroll.hasClients) return;
    _scroll.jumpTo(_scroll.position.maxScrollExtent);
  }

  Future<void> _send() async {
    final body = _input.text.trim();
    final send = widget.onSend;
    if (body.isEmpty || send == null || _flight != null) return;

    setState(() {
      _flight = body;
      _input.clear();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());

    try {
      final saved = await send(body);
      if (!mounted) return;
      setState(() {
        _sent.add(saved);
        _flight = null;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) => _toBottom());
    } on ApiError catch (e) {
      /*
       * **والنصُّ يعود إلى الحقل** لا يُفقد.
       *
       * فرسالةٌ تُمحى عند انقطاع الشبكة تُكتب مرّةً أخرى من الذاكرة — وما
       * كُتب في سطرين قد لا يُستعاد كما كان.
       *
       * **والخطأُ يُعرض هنا لا يُعاد رميُه**: مُستمعُ الضغط لا يُنتظر، فما
       * يُرمى منه يصير خطأً غيرَ ملتقَطٍ يُسقط الشاشة ولا يُخبر أحدًا.
       */
      if (!mounted) return;
      setState(() {
        _input.text = body;
        _flight = null;
      });
      showToast(context, e.message, kind: ToastKind.warning);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rows = _all;

    return Column(
      children: [
        _header(),
        Expanded(
          child: ListView.separated(
            controller: _scroll,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            /* التنبيهُ أوّلُ القائمة لا شريطٌ فوقها — فيُمرَّر معها */
            itemCount: rows.length + 1 + (rows.isEmpty ? 1 : 0),
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              if (i == 0) return const _Notice();
              if (rows.isEmpty) return const _NoMessages();
              return _Bubble(message: rows[i - 1]);
            },
          ),
        ),
        _composer(),
      ],
    );
  }

  Widget _header() => Container(
    padding: const EdgeInsets.fromLTRB(14, 4, 14, 10),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.divider)),
    ),
    child: Row(
      children: [
        _round(LucideIcons.arrowRight, 19, 'رجوع', onTap: widget.onBack),
        const SizedBox(width: 10),
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: AppColors.accent200,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            widget.counterpartName.substring(0, 1),
            style: AppText.body(
              15,
              weight: FontWeight.w700,
              color: AppColors.accent900,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.counterpartName,
                style: AppText.body(15, weight: FontWeight.w700),
              ),
              Text(
                '${widget.counterpartRole} · صفقة '
                '${widget.orderReference} · ${widget.plateLabel}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.body(11.5, color: AppColors.neutral700),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        _round(LucideIcons.phone, 17, 'اتصال', onTap: widget.onCall),
      ],
    ),
  );

  /// دائرةُ ‎٤٠‎ بخلفية `surface` — زرُّ الترويسة.
  Widget _round(
    IconData icon,
    double size,
    String label, {
    VoidCallback? onTap,
  }) => Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 40,
        height: 40,
        decoration: const BoxDecoration(
          color: AppColors.surface,
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: size),
      ),
    ),
  );

  Widget _composer() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: const BoxDecoration(
      color: AppColors.neutral100,
      border: Border(top: BorderSide(color: AppColors.divider)),
    ),
    child: SafeArea(
      top: false,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _circle(LucideIcons.paperclip, 19, 'إرفاق'),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 42),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.bg,
                border: Border.all(color: AppColors.divider),
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: TextField(
                controller: _input,
                style: AppText.body(14),
                /* والسطرُ يطول بما يُكتب إلى خمسةٍ ثمّ يُمرَّر */
                minLines: 1,
                maxLines: 5,
                textInputAction: TextInputAction.newline,
                decoration: InputDecoration(
                  hintText: 'اكتب رسالة…',
                  hintStyle: AppText.body(14, color: AppColors.neutral500),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          /*
           * **والزرُّ واحدٌ يتبدّل** لا زرّان يتزاحمان — كما في التصميم:
           * ميكروفونٌ ما لم يُكتب شيء، وسهمُ إرسالٍ أوّلَ حرف.
           */
          _circle(
            _canSend ? LucideIcons.send : LucideIcons.mic,
            18,
            _canSend ? 'إرسال' : 'رسالة صوتية',
            filled: true,
            /* وسهمُ Lucide يشير يمينًا — ويُعكس ليشير إلى حيث تذهب الرسالة */
            mirrored: _canSend,
            onTap: _canSend ? _send : null,
          ),
        ],
      ),
    ),
  );

  /// دائرةُ ‎٤٢‎ — المرفقاتُ بخلفية `surface`، والإرسالُ بـ`accent-700`.
  Widget _circle(
    IconData icon,
    double size,
    String label, {
    bool filled = false,
    bool mirrored = false,
    VoidCallback? onTap,
  }) {
    final glyph = Icon(
      icon,
      size: size,
      color: filled ? AppColors.neutral100 : AppColors.text,
    );

    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: filled ? AppColors.accent700 : AppColors.surface,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: mirrored ? Transform.scale(scaleX: -1, child: glyph) : glyph,
        ),
      ),
    );
  }
}

/// **تنبيهٌ في صدر المحادثة** — فالاتّفاقُ خارجها لا تحميه المنصّة.
class _Notice extends StatelessWidget {
  const _Notice();

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.center,
    child: Container(
      constraints: const BoxConstraints(maxWidth: 300),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.neutral200,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        'المحادثة جزء من سجل الصفقة ومحفوظة للطرفين، ويطّلع عليها فريق '
        'المنصّة عند أي اعتراض. لا تشارك رموز التحقق أو كلمات المرور.',
        textAlign: TextAlign.center,
        style: AppText.body(
          11.5,
          color: AppColors.neutral800,
        ).copyWith(height: 1.6),
      ),
    ),
  );
}

class _NoMessages extends StatelessWidget {
  const _NoMessages();

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 30),
    child: Center(
      child: Text(
        'لا رسائل بعد',
        style: AppText.body(12.5, color: AppColors.neutral700),
      ),
    ),
  );
}

/// فقاعةُ رسالة — **لي يمينًا بالأخضر، وللطرف يسارًا بالفاتح**.
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;
    final width = MediaQuery.sizeOf(context).width;

    /*
     * **والرسالةُ في الطريق شاحبةٌ** حتّى يُقرّها الخادم.
     *
     * فمن رأى فقاعتَه كاملةَ اللون ظنّها وصلت — وقد تسقط. والشحوبُ يقول
     * «جارية» بلا نصٍّ يُضاف ولا دوّارةٍ تُقلق.
     */
    return Opacity(
      opacity: message.isPending ? 0.55 : 1,
      child: Column(
        crossAxisAlignment: mine
            ? CrossAxisAlignment.start
            : CrossAxisAlignment.end,
        children: [
          Container(
            /* عرضٌ أقصاه ‎٧٨٪‎ من الشاشة */
            constraints: BoxConstraints(maxWidth: width * 0.78),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(
              color: mine ? AppColors.accent700 : AppColors.neutral100,
              /* وزاويةُ الذيل عند صاحبها: ‎١٦ ١٦ ١٦ ٤‎ */
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(mine ? 4 : 16),
                bottomRight: Radius.circular(mine ? 16 : 4),
              ),
            ),
            child: _content(mine),
          ),
          const SizedBox(height: 3),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                formatStamp(message.at),
                style: AppText.digits(
                  10,
                  weight: FontWeight.w500,
                  color: AppColors.neutral600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// لونُ السطر الثانويّ في الفقاعة — اسمُ الملفّ وحجمُه ومدّةُ الصوت.
  Color _sub(bool mine) => mine
      ? AppColors.neutral100.withValues(alpha: 0.75)
      : AppColors.neutral600;

  Widget _content(bool mine) {
    final ink = mine ? AppColors.neutral100 : AppColors.text;

    return switch (message.kind) {
      MessageKind.text => Text(
        message.text ?? '',
        style: AppText.body(13.5, color: ink).copyWith(height: 1.6),
      ),

      /* صورةٌ ‎٢٠٠‎ بنسبة ‎٤:٣‎ على أرضيّةٍ مخطّطةٍ مائلة */
      MessageKind.image => ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: SizedBox(
          width: 200,
          height: 150,
          child: CustomPaint(
            painter: const _Hatch(),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  LucideIcons.image,
                  size: 26,
                  color: AppColors.neutral800,
                ),
                if (message.fileName != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    message.fileName!,
                    style: AppText.body(
                      11,
                      weight: FontWeight.w600,
                      color: AppColors.neutral800,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),

      MessageKind.pdf => Container(
        width: 220,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: ink.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            /* شارةُ الملفّ ‎٣٨×٤٤‎ بأحمرها — تُقرأ قبل اسم الملفّ */
            Container(
              width: 38,
              height: 44,
              padding: const EdgeInsets.only(bottom: 6),
              alignment: Alignment.bottomCenter,
              decoration: BoxDecoration(
                color: const Color(0xFFC0392B),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  'PDF',
                  style: AppText.body(
                    10,
                    weight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    message.fileName ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(
                      12.5,
                      color: ink,
                      weight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(_size, style: AppText.body(11, color: _sub(mine))),
                ],
              ),
            ),
          ],
        ),
      ),

      MessageKind.voice => SizedBox(
        width: 210,
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: ink.withValues(alpha: 0.16),
                shape: BoxShape.circle,
              ),
              child: Icon(LucideIcons.play, size: 14, color: ink),
            ),
            const SizedBox(width: 10),
            /* موجةٌ من عشرين عمودًا — صورةُ الصوت لا تسجيلُه */
            Expanded(
              child: Directionality(
                textDirection: TextDirection.ltr,
                child: SizedBox(
                  height: 26,
                  child: Row(
                    children: [
                      for (final (i, h) in _wave.indexed) ...[
                        if (i != 0) const SizedBox(width: 2),
                        Expanded(
                          child: Align(
                            child: Container(
                              height: h,
                              decoration: BoxDecoration(
                                color: ink.withValues(alpha: 0.55),
                                borderRadius: BorderRadius.circular(2),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(_duration, style: AppText.digits(11, color: _sub(mine))),
          ],
        ),
      ),
    };
  }

  static const _wave = <double>[
    6,
    12,
    18,
    9,
    22,
    14,
    8,
    16,
    24,
    11,
    7,
    15,
    20,
    10,
    6,
    13,
    19,
    9,
    5,
    12,
  ];

  String get _duration {
    final d = message.duration ?? Duration.zero;
    return '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
  }

  /// **والحجمُ يصل بايتاتٍ من الخادم** — ويُصاغ للقارئ هنا.
  String get _size {
    final bytes = message.fileSize;
    if (bytes == null) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).round()} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}

/// أرضيّةُ الصورة المخطّطة — شرائطُ مائلةٌ ‎١٣٥°‎ بعرض ‎١٠‎.
class _Hatch extends CustomPainter {
  const _Hatch();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = AppColors.neutral200);

    final stripe = Paint()
      ..color = AppColors.neutral300
      ..strokeWidth = 10
      ..style = PaintingStyle.stroke;

    /* والميلُ ‎١٣٥°‎: من أعلى اليسار إلى أسفل اليمين، والخطوةُ ‎٢٠‎ */
    for (var x = -size.height; x < size.width + size.height; x += 20) {
      canvas.drawLine(
        Offset(x, 0),
        Offset(x + size.height, size.height),
        stripe,
      );
    }
  }

  @override
  bool shouldRepaint(_Hatch oldDelegate) => false;
}
