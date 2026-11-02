import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_client.dart';
import '../../design/tokens.dart';

/// **غلافُ جلبٍ موحّد** — تحميلٌ ثمّ خطأٌ ثمّ محتوى.
///
/// **ولكلّ حالةٍ صورتُها**: شاشةٌ بيضاءُ أثناء الجلب تُقرأ تعطّلًا، وخطأٌ
/// بلا زرّ إعادةٍ يُجبر المستخدمَ على إغلاق التطبيق وفتحه.
///
/// **ورسالةُ الخطأ هي رسالةُ الخادم** — فهو يكتبها بالعربيّة لمستخدمها،
/// وترجمتُها في الواجهة تُفقد التفصيلَ الذي كُتب من أجله.
class AsyncView<T> extends StatefulWidget {
  const AsyncView({
    super.key,
    required this.load,
    required this.builder,
    this.emptyCheck,
    this.empty,
  });

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, VoidCallback reload)
  builder;

  /// متى تُعدّ النتيجةُ فارغةً — فتُعرض [empty] بدلها.
  final bool Function(T data)? emptyCheck;
  final Widget? empty;

  @override
  State<AsyncView<T>> createState() => _AsyncViewState<T>();
}

class _AsyncViewState<T> extends State<AsyncView<T>> {
  late Future<T> _future = widget.load();

  void _reload() => setState(() => _future = widget.load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<T>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const _Loading();
        }
        if (snap.hasError) {
          final error = snap.error;
          return _Failed(
            message: error is ApiError ? error.message : 'تعذّر تحميل البيانات',
            onRetry: _reload,
          );
        }
        final data = snap.data as T;
        if (widget.emptyCheck?.call(data) == true && widget.empty != null) {
          return widget.empty!;
        }
        return widget.builder(context, data, _reload);
      },
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) => const Center(
    child: SizedBox(
      width: 28,
      height: 28,
      child: CircularProgressIndicator(
        strokeWidth: 2.5,
        color: AppColors.accent,
      ),
    ),
  );
}

class _Failed extends StatelessWidget {
  const _Failed({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              LucideIcons.wifiOff,
              size: 26,
              color: AppColors.neutral600,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppText.body(14).copyWith(height: 1.7),
          ),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: onRetry,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 44,
              padding: const EdgeInsets.symmetric(horizontal: 24),
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                'أعد المحاولة',
                style: AppText.body(
                  14,
                  color: AppColors.neutral100,
                  weight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
