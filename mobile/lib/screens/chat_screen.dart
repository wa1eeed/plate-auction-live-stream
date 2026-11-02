import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;

/// نوعُ الرسالة.
enum MessageKind { text, image, pdf, voice }

/// رسالةٌ في محادثة الصفقة.
class ChatMessage {
  const ChatMessage({
    required this.kind,
    required this.at,
    required this.mine,
    this.text,
    this.fileName,
    this.fileSize,
    this.duration,
  });

  final MessageKind kind;
  final DateTime at;

  /// **منك أو من الطرف الآخر** — ومنه يُشتقّ اللونُ والجهة.
  final bool mine;

  final String? text;
  final String? fileName;
  final String? fileSize;
  final Duration? duration;
}

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
  });

  final String counterpartName;
  final String counterpartRole;
  final String orderReference;
  final String plateLabel;
  final List<ChatMessage> messages;
  final VoidCallback? onBack;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _scroll = ScrollController();
  final _input = TextEditingController();

  @override
  void initState() {
    super.initState();
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

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _header(),
        _notice(),
        Expanded(
          child: ListView.separated(
            controller: _scroll,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            itemCount: widget.messages.length,
            separatorBuilder: (_, _) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _Bubble(message: widget.messages[i]),
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
        GestureDetector(
          onTap: widget.onBack,
          behavior: HitTestBehavior.opaque,
          child: Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.arrowRight, size: 19),
          ),
        ),
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
      ],
    ),
  );

  /// **تنبيهٌ ثابتٌ أعلى المحادثة** — فالاتّفاقُ خارجها لا تحميه المنصّة.
  Widget _notice() => Container(
    margin: const EdgeInsets.fromLTRB(14, 10, 14, 0),
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Icon(LucideIcons.shield, size: 14, color: AppColors.neutral700),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            'المحادثة محفوظة للطرفين وتُراجَع عند الاعتراض. '
            'لا تتّفقا على الدفع خارج المنصّة — لا ضمان له.',
            style: AppText.body(
              11.5,
              color: AppColors.neutral700,
            ).copyWith(height: 1.6),
          ),
        ),
      ],
    ),
  );

  Widget _composer() => Container(
    padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
    decoration: const BoxDecoration(
      color: AppColors.bg,
      border: Border(top: BorderSide(color: AppColors.divider)),
    ),
    child: SafeArea(
      top: false,
      child: Row(
        children: [
          _circle(LucideIcons.paperclip, 'مرفقات'),
          const SizedBox(width: 8),
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 44),
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: AppColors.neutral100,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: TextField(
                controller: _input,
                style: AppText.body(14),
                decoration: InputDecoration(
                  hintText: 'اكتب رسالة',
                  hintStyle: AppText.body(14, color: AppColors.neutral500),
                  border: InputBorder.none,
                  isDense: true,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          _circle(LucideIcons.mic, 'تسجيل صوتي', filled: true),
        ],
      ),
    ),
  );

  Widget _circle(IconData icon, String label, {bool filled = false}) =>
      Semantics(
        button: true,
        label: label,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: filled ? AppColors.accent : AppColors.surface,
            shape: BoxShape.circle,
          ),
          child: Icon(
            icon,
            size: 19,
            color: filled ? AppColors.neutral100 : AppColors.text,
          ),
        ),
      );
}

/// فقاعةُ رسالة — **لي يسارًا بالأخضر، وللطرف يمينًا بالفاتح**.
class _Bubble extends StatelessWidget {
  const _Bubble({required this.message});

  final ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final mine = message.mine;

    return Row(
      mainAxisAlignment: mine ? MainAxisAlignment.start : MainAxisAlignment.end,
      children: [
        Flexible(
          child: Column(
            crossAxisAlignment: mine
                ? CrossAxisAlignment.start
                : CrossAxisAlignment.end,
            children: [
              Container(
                constraints: const BoxConstraints(maxWidth: 260),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: mine ? AppColors.accent700 : AppColors.surface,
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
              Directionality(
                textDirection: TextDirection.ltr,
                child: Text(
                  formatStamp(message.at),
                  style: AppText.digits(
                    9.5,
                    weight: FontWeight.w500,
                    color: AppColors.neutral600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _content(bool mine) {
    final ink = mine ? AppColors.neutral100 : AppColors.text;

    return switch (message.kind) {
      MessageKind.text => Text(
        message.text ?? '',
        style: AppText.body(13.5, color: ink).copyWith(height: 1.6),
      ),
      MessageKind.image => ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 180,
          height: 120,
          color: AppColors.neutral300,
          child: const Icon(
            LucideIcons.image,
            size: 26,
            color: AppColors.neutral600,
          ),
        ),
      ),
      MessageKind.pdf => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: AppColors.danger.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              LucideIcons.fileText,
              size: 17,
              color: AppColors.danger,
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message.fileName ?? '',
                style: AppText.body(12.5, color: ink, weight: FontWeight.w700),
              ),
              Text(
                message.fileSize ?? '',
                style: AppText.body(
                  11,
                  color: mine ? AppColors.accent200 : AppColors.neutral700,
                ),
              ),
            ],
          ),
        ],
      ),
      MessageKind.voice => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.play, size: 18, color: ink),
          const SizedBox(width: 10),
          /* موجةٌ من عشرين عمودًا — صورةُ الصوت لا تسجيلُه */
          Row(
            children: List.generate(20, (i) {
              final h = 6.0 + (i * 7 % 17);
              return Container(
                width: 2.5,
                height: h,
                margin: const EdgeInsets.symmetric(horizontal: 1),
                decoration: BoxDecoration(
                  color: ink.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            }),
          ),
          const SizedBox(width: 10),
          Text(
            _duration,
            style: AppText.digits(11.5, weight: FontWeight.w600, color: ink),
          ),
        ],
      ),
    };
  }

  String get _duration {
    final d = message.duration ?? Duration.zero;
    return '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
  }
}
