import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../api/api_client.dart';
import '../../design/tokens.dart';

/// نوعُ الرسالة الطافية.
enum ToastKind { success, warning, info }

/// **رسالةٌ طافيةٌ أعلى الشاشة** — §4: `top:56`، تختفي بعد ‎٣٫٢‎ ثانية.
///
/// **وهي أعلى الشاشة لا أسفلها**: الإجراءُ يقع أسفلَ الشاشة حيث الإبهام،
/// ورسالةٌ تظهر فوقه تحجب الزرَّ الذي ضُغط للتوّ.
void showToast(
  BuildContext context,
  String message, {
  ToastKind kind = ToastKind.info,
}) {
  final messenger = ScaffoldMessenger.maybeOf(context);
  if (messenger == null) return;

  final (bg, icon) = switch (kind) {
    ToastKind.success => (AppColors.accent2_800, LucideIcons.check),
    ToastKind.warning => (AppColors.accent700, LucideIcons.triangleAlert),
    ToastKind.info => (AppColors.neutral900, LucideIcons.info),
  };

  messenger
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        duration: const Duration(milliseconds: 3200),
        backgroundColor: bg,
        behavior: SnackBarBehavior.floating,
        /* وتُدفع إلى أعلى الشاشة بهامشٍ يحسب ارتفاعَها */
        margin: EdgeInsets.only(
          bottom: MediaQuery.sizeOf(context).height - 140,
          left: 16,
          right: 16,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        content: Row(
          children: [
            Icon(icon, size: 17, color: AppColors.neutral100),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                style: AppText.body(
                  13.5,
                  color: AppColors.neutral100,
                  weight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
}

/// **يُجري فعلًا على الخادم ويُظهر نتيجتَه.**
///
/// **ورسالةُ الخطأ هي رسالةُ الخادم** — فهو يكتبها بالعربيّة لمستخدمها،
/// ويعرف لماذا رُدَّ الطلب: «رصيدك المتاح لا يكفي» أوضحُ من «تعذّر».
Future<bool> runAction(
  BuildContext context,
  Future<void> Function() action, {
  String? success,
}) async {
  try {
    await action();
    if (context.mounted && success != null) {
      showToast(context, success, kind: ToastKind.success);
    }
    return true;
  } on ApiError catch (e) {
    if (context.mounted) {
      showToast(context, e.message, kind: ToastKind.warning);
    }
    return false;
  }
}
