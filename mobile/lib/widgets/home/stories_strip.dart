import 'package:flutter/material.dart';

import '../../design/tokens.dart';
import '../plate.dart';

/// قصّةٌ واحدةٌ في الشريط.
class Story {
  const Story({
    required this.id,
    required this.label,
    required this.letters,
    required this.number,
    this.format = PlateFormat.long,
    this.seen = false,
  });

  final String id;
  final String label;
  final String letters;
  final String number;
  final PlateFormat format;
  final bool seen;
}

const demoStories = <Story>[
  Story(id: 's1', label: 'مزاد الليلة', letters: 'س ع د', number: '1'),
  Story(id: 's2', label: 'وصل حديثًا', letters: 'ق و س', number: '77'),
  Story(id: 's3', label: 'كيف تزايد', letters: 'ك ط ع', number: '4040'),
  Story(
    id: 's4',
    label: 'نقل الملكية',
    letters: 'ن ق ل',
    number: '1',
    seen: true,
  ),
  Story(
    id: 's5',
    label: 'سبورت',
    letters: 'س ب ت',
    number: '9',
    format: PlateFormat.sport,
    seen: true,
  ),
];

/// **شريطُ الستوريز** — حلقاتٌ ‎٦٨‎ بكسلًا، داخلَها لوحةٌ مصغّرة.
///
/// **والمشاهَدُ يُحفظ محليًّا** لا على الخادم: أيُّ قصّةٍ رآها هذا الجهازُ شأنُه
/// وحده، ولا يُسأل عنه الخادمُ في كلّ فتحةٍ للرئيسية.
class StoriesStrip extends StatelessWidget {
  const StoriesStrip({super.key, this.onOpen});

  final ValueChanged<Story>? onOpen;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 18),
        itemCount: demoStories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final st = demoStories[i];
          return GestureDetector(
            onTap: onOpen == null ? null : () => onOpen!(st),
            behavior: HitTestBehavior.opaque,
            child: SizedBox(
              width: 70,
              child: Column(
                children: [
                  Container(
                    width: 68,
                    height: 68,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: st.seen
                            ? AppColors.neutral300
                            : AppColors.accent,
                        width: 2.5,
                      ),
                    ),
                    child: Container(
                      decoration: const BoxDecoration(
                        color: AppColors.surface,
                        shape: BoxShape.circle,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Center(
                        child: SaudiPlate(
                          letters: st.letters,
                          number: st.number,
                          format: st.format,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    st.label,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body(11, color: AppColors.neutral800),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
