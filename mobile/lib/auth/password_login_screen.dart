import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_scope.dart';
import '../design/tokens.dart';
import '../widgets/common/toast.dart';

/// **الدخولُ بالبريد وكلمة المرور** — مسارٌ ثانويٌّ لأصحاب الحسابات القديمة.
///
/// **ولا يُعرض في الواجهة الأولى**: التصميمُ المعتمد يدخل بالرمز، وعرضُ
/// مسارين متساويين يُجبر كلَّ وافدٍ على اختيارٍ لا يعنيه. فيُفتح هذا من
/// سطرٍ صغيرٍ تحت المسار الأوّل، ومن احتاجه عرف أنّه له.
class PasswordLoginScreen extends StatefulWidget {
  const PasswordLoginScreen({super.key, this.onBack, this.onDone});

  final VoidCallback? onBack;
  final VoidCallback? onDone;

  @override
  State<PasswordLoginScreen> createState() => _PasswordLoginScreenState();
}

class _PasswordLoginScreenState extends State<PasswordLoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  bool _busy = false;

  bool get _valid =>
      !_busy &&
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(_email.text.trim()) &&
      _password.text.length >= 8;

  /// **ويُقفل الزرُّ أثناء الطلب** — فضغطتان تُنشئان جلستين وتُربكان الخادم.
  Future<void> _submit() async {
    setState(() => _busy = true);
    final ok = await runAction(
      context,
      () =>
          ApiScope.of(context)
              .login(email: _email.text.trim(), password: _password.text),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) widget.onDone?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 4, 22, 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: GestureDetector(
              onTap: widget.onBack,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: 42,
                height: 42,
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  shape: BoxShape.circle,
                ),
                child: const Icon(LucideIcons.arrowRight, size: 20),
              ),
            ),
          ),
          const SizedBox(height: 22),
          Text(
            'الدخول بالبريد',
            style: AppText.body(
              26,
              weight: FontWeight.w700,
            ).copyWith(height: 1.3),
          ),
          const SizedBox(height: 14),
          Text(
            'لأصحاب الحسابات المسجّلة سابقًا بكلمة مرور.',
            style: AppText.body(
              14,
              color: AppColors.neutral800,
            ).copyWith(height: 1.7),
          ),
          const SizedBox(height: 22),
          _label('البريد الإلكتروني'),
          const SizedBox(height: 6),
          _field(
            controller: _email,
            hint: 'name@example.com',
            keyboard: TextInputType.emailAddress,
          ),
          const SizedBox(height: 14),
          _label('كلمة المرور'),
          const SizedBox(height: 6),
          _field(
            controller: _password,
            hint: '••••••••',
            obscure: !_show,
            /* **وعينٌ تُظهر ما كُتب**: من يكتب كلمةً طويلةً على لوحةِ هاتفٍ
               يخطئ ولا يرى أين، فيُعيد من أوّلها مرّةً بعد مرّة. */
            suffix: GestureDetector(
              onTap: () => setState(() => _show = !_show),
              behavior: HitTestBehavior.opaque,
              child: Icon(
                _show ? LucideIcons.eyeOff : LucideIcons.eye,
                size: 18,
                color: AppColors.neutral600,
              ),
            ),
          ),
          /*
           * **و«نسيت كلمة المرور؟» رُفع** — لا مسارَ استرجاعٍ في الخادم،
           * ولا بريدَ يُرسل منه. وكان نصًّا يُضغط فلا يقع شيء.
           */
          const Spacer(),
          GestureDetector(
            onTap: _valid ? _submit : null,
            behavior: HitTestBehavior.opaque,
            child: Container(
              height: 54,
              decoration: BoxDecoration(
                color: _valid ? AppColors.accent : AppColors.accent300,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                'دخول',
                style: AppText.body(
                  17,
                  color: AppColors.neutral100,
                  weight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Center(
            child: GestureDetector(
              onTap: widget.onBack,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(
                  'ادخل برقم الجوال بدلًا من ذلك',
                  style: AppText.body(
                    13,
                    color: AppColors.neutral700,
                    weight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) =>
      Text(text, style: AppText.body(12.5, weight: FontWeight.w700));

  Widget _field({
    required TextEditingController controller,
    required String hint,
    bool obscure = false,
    TextInputType? keyboard,
    Widget? suffix,
  }) => SizedBox(
    height: 54,
    child: TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      textDirection: TextDirection.ltr,
      onChanged: (_) => setState(() {}),
      style: AppText.body(15, weight: FontWeight.w600),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppText.body(15, color: AppColors.neutral500),
        filled: true,
        fillColor: AppColors.neutral100,
        suffixIcon: suffix == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(left: 14, right: 6),
                child: suffix,
              ),
        suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
          borderSide: BorderSide.none,
        ),
      ),
    ),
  );
}
