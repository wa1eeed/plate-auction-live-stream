import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../design/tokens.dart';

/// مزايدةٌ واحدةٌ في الكشف.
class BidEntry {
  const BidEntry({
    required this.bidder,
    required this.amount,
    required this.at,
    this.isMine = false,
  });

  /// اسمُ المزايد كما وصل — يُقنَّع هنا لا في الخادم.
  final String bidder;

  final int amount;
  final DateTime at;
  final bool isMine;
}

/// **كشفُ المزايدات — مكشوفٌ ومقنَّعٌ معًا.**
///
/// وهو أحدُ ضماناتِ المنصّة الثلاثة: كلُّ مزايدةٍ تُرى بمبلغها ووقتها، فلا
/// يُقال «زايد عليك أحد» بلا بيّنة. **والاسمُ يُقنَّع** — «خالد ع\*\*\*\*\*» —
/// فالشفافيّةُ في الأرقام لا في هويّات الناس، ومن زايد لم يأذن بنشر اسمه.
///
/// **والوقتُ كاملٌ بصيغةِ ‎١٢‎ ساعة** لا «قبل ساعتين»: كشفٌ يُراجَع حين
/// يُختلف، والنسبيُّ لا يُحتجّ به.
class BidLog extends StatelessWidget {
  const BidLog({super.key, required this.entries});

  final List<BidEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text('كشف المزايدات', style: AppText.heading(19)),
              const Spacer(),
              Text(
                '${entries.length} مزايدة',
                style: AppText.body(12, color: AppColors.neutral700),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        if (entries.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 22),
            decoration: BoxDecoration(
              color: AppColors.neutral100,
              borderRadius: BorderRadius.circular(AppRadii.card),
            ),
            child: Column(
              children: [
                const Icon(
                  LucideIcons.gavel,
                  size: 22,
                  color: AppColors.neutral500,
                ),
                const SizedBox(height: 8),
                Text(
                  'لا مزايدات بعد — كن أوّلَ المزايدين',
                  style: AppText.body(12.5, color: AppColors.neutral700),
                ),
              ],
            ),
          )
        else
          for (var i = 0; i < entries.length; i++) ...[
            _Row(entry: entries[i], highest: i == 0),
            if (i != entries.length - 1) const SizedBox(height: 6),
          ],
      ],
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.entry, required this.highest});

  final BidEntry entry;
  final bool highest;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        /* والأعلى مظلَّلٌ — فيُعرف بلا قراءةِ الأرقام كلِّها */
        color: highest ? AppColors.accent2_100 : AppColors.neutral100,
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.isMine ? 'أنت' : maskName(entry.bidder),
                  style: AppText.body(12.5, weight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Directionality(
                  textDirection: TextDirection.ltr,
                  child: Text(
                    formatStamp(entry.at),
                    style: AppText.digits(
                      10.5,
                      weight: FontWeight.w500,
                      color: AppColors.neutral700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Text(_money(entry.amount), style: AppText.money(15)),
        ],
      ),
    );
  }

  String _money(int halalas) => (halalas ~/ 100).toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]},',
  );
}

/// **يُبقي الاسمَ الأوّلَ وحرفَ الثاني** ويستر الباقي: «خالد ع\*\*\*\*\*».
///
/// فمن تابع مزادًا يعرف أنّ المزايدَ واحدٌ لا عدّة، ولا يعرف من هو.
String maskName(String full) {
  final trimmed = full.trim();
  /* و`''.split` تُرجع قائمةً فيها نصٌّ فارغ — لا قائمةً فارغة */
  if (trimmed.isEmpty) return '—';
  final parts = trimmed.split(RegExp(r'\s+'));
  if (parts.length == 1) {
    final one = parts.first;
    if (one.length <= 2) return one;
    return '${one.substring(0, 2)}${'*' * (one.length - 2)}';
  }
  final second = parts[1];
  return '${parts.first} ${second.substring(0, 1)}${'*' * 5}';
}

/// **ختمٌ كاملٌ بصيغةِ ‎١٢‎ ساعة**: `dd/mm/yyyy · hh:mm:ss ص|م`.
String formatStamp(DateTime t) {
  two(int n) => n.toString().padLeft(2, '0');
  final pm = t.hour >= 12;
  var h = t.hour % 12;
  if (h == 0) h = 12;
  return '${two(t.day)}/${two(t.month)}/${t.year} · '
      '${two(h)}:${two(t.minute)}:${two(t.second)} ${pm ? 'م' : 'ص'}';
}
