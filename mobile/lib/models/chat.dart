/// نوعُ الرسالة.
enum MessageKind { text, image, pdf, voice }

/// رسالةٌ في محادثة الصفقة.
class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.kind,
    required this.at,
    required this.mine,
    this.text,
    this.mediaKey,
    this.fileName,
    this.fileSize,
    this.duration,
  });

  final String id;
  final MessageKind kind;
  final DateTime at;

  /// **منك أو من الطرف الآخر** — ومنه يُشتقّ اللونُ والجهة.
  final bool mine;

  final String? text;

  /// مفتاحُ الوسيط في مخزنه — لا محتواه.
  final String? mediaKey;

  final String? fileName;

  /// الحجمُ بالبايت كما وصل — ويُصاغ عند العرض.
  final int? fileSize;

  final Duration? duration;

  /// **رسالةٌ تُرسم قبل أن تصل**: تُظهَر فورَ الضغط وتُستبدل بما يردّه
  /// الخادم. فمحادثةٌ تنتظر جولةً كاملةً لتُظهر ما كُتب تُقرأ معلَّقة.
  static ChatMessage pending(String body) => ChatMessage(
    id: 'pending',
    kind: MessageKind.text,
    at: DateTime.now(),
    mine: true,
    text: body,
  );

  bool get isPending => id == 'pending';
}

/// محادثةٌ كاملةٌ ومعرّفُ صاحبها — فمنه تُعرف جهةُ كلّ فقاعة.
class ChatThread {
  const ChatThread({required this.me, required this.messages});

  final String me;
  final List<ChatMessage> messages;
}
