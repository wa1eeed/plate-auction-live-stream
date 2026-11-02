import 'dart:async';

import 'package:flutter/material.dart';

import '../design/tokens.dart';

/// **العدّادُ التنازليّ** — أربعُ خاناتٍ: يوم · ساعة · دقيقة · ثانية (§5.2).
///
/// **ولا ينبض والتطبيقُ في الخلفية**: عدّادٌ لا يراه أحدٌ لا يُحسب، والنبضُ
/// بلا انقطاعٍ يستنزف البطّاريةَ بلا مقابلٍ يُرى. وعند العودة يُقرأ الوقتُ
/// فورًا فما يظهر صحيحٌ لا قديم.
///
/// **والمرجعُ وقتُ الخادم لا ساعةُ الجهاز**: ساعةٌ منحرفةٌ بدقائق تُنهي مزادًا
/// قبل أوانه أو تُبقيه بعده، والمزايدةُ في آخر دقيقتين تُمدّد — فالانحرافُ
/// يُغيّر النتيجة لا العرض.
class AuctionCountdown extends StatefulWidget {
  const AuctionCountdown({
    super.key,
    required this.endsAt,
    required this.serverTime,
    this.cellMinWidth = 25,
  });

  final DateTime endsAt;

  /// وقتُ الخادم ساعةَ بناء الشاشة — منه يُحسب انحرافُ ساعة الجهاز.
  final DateTime serverTime;

  final double cellMinWidth;

  @override
  State<AuctionCountdown> createState() => _AuctionCountdownState();
}

class _AuctionCountdownState extends State<AuctionCountdown>
    with WidgetsBindingObserver {
  late Duration _left;
  Timer? _timer;
  late Duration _skew;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _skew = DateTime.now().difference(widget.serverTime);
    _read();
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _read();
      _schedule();
    } else {
      _timer?.cancel();
      _timer = null;
    }
  }

  void _read() {
    final now = DateTime.now().subtract(_skew);
    setState(() => _left = widget.endsAt.difference(now));
  }

  /// **نبضةٌ في الثانية، مُحاذاةً لحافّتها** — لا عشرٌ في الثانية.
  ///
  /// فالمعروضُ ثوانٍ لا أعشارُها، وتسعٌ من كلّ عشرٍ تُنتج النصَّ نفسَه.
  /// والمحاذاةُ تُصلح ما هو أدقّ: الرقمُ يتبدّل في لحظته لا متأخّرًا عنها.
  void _schedule() {
    _timer?.cancel();
    if (_left <= Duration.zero) return;
    final toEdge = 1000 - (_left.inMilliseconds % 1000);
    _timer = Timer(Duration(milliseconds: toEdge.clamp(50, 1000)), () {
      _read();
      _schedule();
    });
  }

  @override
  Widget build(BuildContext context) {
    final left = _left.isNegative ? Duration.zero : _left;

    /// **ويحمرُّ — أي يصير أخضرَ الهويّة — في آخر ربع ساعة.**
    final urgent = left.inMinutes < 15;
    final cellColor = urgent ? AppColors.accent : AppColors.text;

    final days = left.inDays;
    final hours = left.inHours % 24;
    final minutes = left.inMinutes % 60;
    final seconds = left.inSeconds % 60;

    return Semantics(
      liveRegion: true,
      label: 'يتبقّى $days يوم و$hours ساعة و$minutes دقيقة',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _cell(days, 'يوم', cellColor),
          _colon(),
          _cell(hours, 'ساعة', cellColor),
          _colon(),
          _cell(minutes, 'دقيقة', cellColor),
          _colon(),
          _cell(seconds, 'ثانية', cellColor),
        ],
      ),
    );
  }

  Widget _colon() => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 1.5),
    child: Text(':', style: AppText.digits(11, color: AppColors.neutral500)),
  );

  Widget _cell(int value, String name, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          constraints: BoxConstraints(minWidth: widget.cellMinWidth),
          padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 3.5),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppRadii.counterCell),
          ),
          child: Text(
            value.toString().padLeft(2, '0'),
            textAlign: TextAlign.center,
            style: AppText.digits(12.5, color: Colors.white),
          ),
        ),
        const SizedBox(height: 2),
        Text(name, style: AppText.body(8.5, color: AppColors.neutral600)),
      ],
    );
  }
}
