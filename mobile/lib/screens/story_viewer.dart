import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../widgets/home/stories_strip.dart';
import '../widgets/plate.dart';

/// **عارضُ الستوريز** — §5.11: ملءُ الشاشة، وتقدّمٌ ذاتيٌّ كلَّ خمسِ ثوانٍ.
class StoryViewer extends StatefulWidget {
  const StoryViewer({
    super.key,
    required this.stories,
    this.initialIndex = 0,
    this.onClose,
  });

  final List<Story> stories;
  final int initialIndex;
  final VoidCallback? onClose;

  static const slide = Duration(seconds: 5);

  @override
  State<StoryViewer> createState() => _StoryViewerState();
}

class _StoryViewerState extends State<StoryViewer>
    with SingleTickerProviderStateMixin {
  late int _index = widget.initialIndex;
  late final AnimationController _c =
      AnimationController(vsync: this, duration: StoryViewer.slide)
        ..addStatusListener((s) {
          if (s == AnimationStatus.completed) _next();
        });

  @override
  void initState() {
    super.initState();
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _next() {
    if (_index >= widget.stories.length - 1) {
      widget.onClose?.call();
      return;
    }
    setState(() => _index++);
    _c.forward(from: 0);
  }

  void _prev() {
    if (_index == 0) {
      _c.forward(from: 0);
      return;
    }
    setState(() => _index--);
    _c.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final story = widget.stories[_index];

    return ColoredBox(
      color: AppColors.neutral900,
      child: SafeArea(
        child: Stack(
          children: [
            /*
             * **والثلثُ الأوّل (جهةُ البداية) يرجع وما بعده يتقدّم.**
             *
             * فالإبهامُ يقع حيث يُمسك الجهاز، والرجوعُ أندرُ من التقدّم —
             * فيُعطى الثلثَ والتقدّمُ الثلثين.
             */
            Positioned.fill(
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: GestureDetector(
                      onTap: _next,
                      behavior: HitTestBehavior.opaque,
                    ),
                  ),
                  Expanded(
                    child: GestureDetector(
                      onTap: _prev,
                      behavior: HitTestBehavior.opaque,
                    ),
                  ),
                ],
              ),
            ),
            IgnorePointer(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 36),
                  child: SaudiPlate(
                    letters: story.letters,
                    number: story.number,
                    format: story.format,
                  ),
                ),
              ),
            ),
            Positioned(
              top: 10,
              left: 12,
              right: 12,
              child: Column(
                children: [
                  /* شريطُ تقدّمٍ لكلّ قصّة */
                  Row(
                    children: List.generate(widget.stories.length, (i) {
                      return Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(
                            right: i == widget.stories.length - 1 ? 0 : 4,
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: SizedBox(
                              height: 3,
                              child: Stack(
                                children: [
                                  Container(
                                    color: AppColors.neutral100.withValues(
                                      alpha: 0.3,
                                    ),
                                  ),
                                  if (i < _index)
                                    Container(color: AppColors.neutral100)
                                  else if (i == _index)
                                    AnimatedBuilder(
                                      animation: _c,
                                      builder: (context, _) =>
                                          FractionallySizedBox(
                                            alignment: AlignmentDirectional
                                                .centerStart,
                                            widthFactor: _c.value,
                                            child: Container(
                                              color: AppColors.neutral100,
                                            ),
                                          ),
                                    ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          story.label,
                          style: AppText.body(
                            15,
                            color: AppColors.neutral100,
                            weight: FontWeight.w700,
                          ),
                        ),
                      ),
                      GestureDetector(
                        onTap: widget.onClose,
                        behavior: HitTestBehavior.opaque,
                        child: const Padding(
                          padding: EdgeInsets.all(6),
                          child: Icon(
                            LucideIcons.x,
                            size: 22,
                            color: AppColors.neutral100,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              bottom: 20,
              child: GestureDetector(
                onTap: widget.onClose,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  height: 50,
                  decoration: BoxDecoration(
                    color: AppColors.neutral100,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    'شوف اللوحة',
                    style: AppText.body(15, weight: FontWeight.w700),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
