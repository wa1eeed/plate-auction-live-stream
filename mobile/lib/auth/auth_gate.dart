import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import 'session.dart';

/// ما اختاره المستخدمُ من ورقة المطالبة.
enum AuthChoice { otp, password, register }

/// **ورقةُ المطالبة بالدخول** — تُفتح عند أوّل وظيفةٍ تحتاج حسابًا.
///
/// **وهي ورقةٌ سفليّةٌ لا شاشةٌ تحلّ محلّ ما يرى**: من ضغط «زايد» وهو يقرأ
/// لوحةً لا يُنتزع منها. والورقةُ تُغطّي جزءًا ويبقى ما تحتها ظاهرًا، فيعود
/// إليه بإغلاقها.
Future<AuthChoice?> showAuthGate(BuildContext context, GatedAction action) {
  final (title, body) = action.prompt;

  return showModalBottomSheet<AuthChoice>(
    context: context,
    backgroundColor: AppColors.bg,
    isScrollControlled: true,
    barrierColor: AppColors.neutral900.withValues(alpha: 0.45),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
    ),
    builder: (context) => _AuthGateSheet(title: title, body: body),
  );
}

class _AuthGateSheet extends StatelessWidget {
  const _AuthGateSheet({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: AppColors.neutral400,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Container(
              width: 52,
              height: 52,
              decoration: const BoxDecoration(
                color: AppColors.accent100,
                shape: BoxShape.circle,
              ),
              alignment: Alignment.center,
              child: const Icon(
                LucideIcons.userPlus,
                size: 24,
                color: AppColors.accent700,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppText.heading(20),
            ),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: AppText.body(
                13,
                color: AppColors.neutral700,
              ).copyWith(height: 1.7),
            ),
            const SizedBox(height: 20),

            /// **والمسارُ الأوّل هو الرمز** — كما في التصميم المعتمد.
            _primary(context, 'ادخل برقم جوالك', AuthChoice.otp),
            const SizedBox(height: 10),
            _secondary(context, 'أنشئ حسابًا جديدًا', AuthChoice.register),
            const SizedBox(height: 14),

            /// **وكلمةُ المرور خيارٌ ثانويٌّ** — سطرٌ لا زرّ.
            ///
            /// فالتطبيقُ القديم كان بها، ومن له حسابٌ قديمٌ يبحث عنها —
            /// ولو عُرضت زرًّا ثالثًا لصارت مسارًا موازيًا يُشتّت من لا
            /// حساب له.
            Center(
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(AuthChoice.password),
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    'لديك حساب بكلمة مرور؟ ادخل بالبريد',
                    style: AppText.body(
                      12.5,
                      color: AppColors.neutral700,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _primary(BuildContext context, String label, AuthChoice choice) =>
      GestureDetector(
        onTap: () => Navigator.of(context).pop(choice),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppText.body(
              16,
              color: AppColors.neutral100,
              weight: FontWeight.w700,
            ),
          ),
        ),
      );

  Widget _secondary(BuildContext context, String label, AuthChoice choice) =>
      GestureDetector(
        onTap: () => Navigator.of(context).pop(choice),
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.neutral100,
            borderRadius: BorderRadius.circular(AppRadii.pill),
            border: Border.all(color: AppColors.divider),
          ),
          alignment: Alignment.center,
          child: Text(label, style: AppText.body(16, weight: FontWeight.w700)),
        ),
      );
}
