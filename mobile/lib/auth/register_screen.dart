import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../api/api_scope.dart';
import '../design/tokens.dart';
import '../widgets/common/toast.dart';

/// **تسجيلُ حسابٍ جديد** — §5.11 امتدادًا.
///
/// **والحقولُ أربعةٌ لا أكثر**: اسمٌ وجوالٌ وبريدٌ وكلمةُ مرور. وكلُّ حقلٍ
/// زائدٍ في التسجيل يُسقط من يُسجّل — والمدينةُ والمعرّفُ يُملآن لاحقًا من
/// الإعدادات، ولا يمنعان أحدًا من الدخول اليوم.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.onBack, this.onDone});

  final VoidCallback? onBack;
  final VoidCallback? onDone;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _show = false;
  bool _agreed = false;

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _nameOk => _name.text.trim().length >= 3;
  bool get _phoneOk => RegExp(r'^05\d{8}$').hasMatch(_phone.text.trim());
  bool get _emailOk =>
      RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(_email.text.trim());

  /// **وكلمةُ المرور ثمانيةٌ فأكثر** — ويُقال الشرطُ قبل الكتابة لا بعدها.
  bool get _passwordOk => _password.text.length >= 8;

  bool _busy = false;

  bool get _valid =>
      !_busy && _nameOk && _phoneOk && _emailOk && _passwordOk && _agreed;

  Future<void> _submit() async {
    setState(() => _busy = true);
    final ok = await runAction(
      context,
      () => ApiScope.of(context).register(
        name: _name.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
        phone: _phone.text.trim(),
      ),
      success: 'أهلًا بك — أُنشئ حسابك',
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) widget.onDone?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 4, 22, 0),
          child: Align(
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
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(22, 18, 22, 24),
            children: [
              Text(
                'أنشئ حسابك',
                style: AppText.body(
                  26,
                  weight: FontWeight.w700,
                ).copyWith(height: 1.3),
              ),
              const SizedBox(height: 10),
              Text(
                'دقيقةٌ واحدة، وتبدأ تزايد وتعرض لوحاتك.',
                style: AppText.body(
                  14,
                  color: AppColors.neutral800,
                ).copyWith(height: 1.7),
              ),
              const SizedBox(height: 22),
              _label('الاسم'),
              const SizedBox(height: 6),
              _field(controller: _name, hint: 'كما تحب أن تظهر'),
              const SizedBox(height: 14),
              _label('رقم الجوال'),
              const SizedBox(height: 6),
              _phoneField(),
              const SizedBox(height: 14),
              _label('البريد الإلكتروني'),
              const SizedBox(height: 6),
              _field(
                controller: _email,
                hint: 'name@example.com',
                keyboard: TextInputType.emailAddress,
                ltr: true,
              ),
              const SizedBox(height: 14),
              _label('كلمة المرور'),
              const SizedBox(height: 6),
              _field(
                controller: _password,
                hint: '8 أحرف على الأقل',
                obscure: !_show,
                ltr: true,
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
              if (_password.text.isNotEmpty && !_passwordOk) ...[
                const SizedBox(height: 4),
                Text(
                  'بقي ${8 - _password.text.length} أحرف',
                  style: AppText.body(11.5, color: AppColors.accent700),
                ),
              ],
              const SizedBox(height: 18),
              GestureDetector(
                onTap: () => setState(() => _agreed = !_agreed),
                behavior: HitTestBehavior.opaque,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 22,
                      height: 22,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        color: _agreed ? AppColors.accent : Colors.transparent,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: _agreed
                              ? AppColors.accent
                              : AppColors.neutral500,
                          width: 1.5,
                        ),
                      ),
                      child: _agreed
                          ? const Icon(
                              LucideIcons.check,
                              size: 14,
                              color: Colors.white,
                            )
                          : null,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'أوافق على شروط المنصّة وسياسة الخصوصية',
                        style: AppText.body(12.5).copyWith(height: 1.6),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(22, 0, 22, 22),
          child: Column(
            children: [
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
                    'أنشئ الحساب',
                    style: AppText.body(
                      17,
                      color: AppColors.neutral100,
                      weight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: widget.onBack,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    'لديك حساب؟ ادخل',
                    style: AppText.body(
                      13,
                      color: AppColors.neutral700,
                      weight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _label(String text) =>
      Text(text, style: AppText.body(12.5, weight: FontWeight.w700));

  Widget _phoneField() => Container(
    height: 54,
    padding: const EdgeInsets.symmetric(horizontal: 18),
    decoration: BoxDecoration(
      color: AppColors.neutral100,
      borderRadius: BorderRadius.circular(AppRadii.pill),
    ),
    child: Directionality(
      textDirection: TextDirection.ltr,
      child: Row(
        children: [
          Text(
            '+966',
            style: AppText.digits(
              15,
              weight: FontWeight.w700,
              color: AppColors.neutral700,
            ),
          ),
          const SizedBox(width: 10),
          Container(width: 1, height: 22, color: AppColors.divider),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(10),
              ],
              onChanged: (_) => setState(() {}),
              style: AppText.digits(15, weight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: '05XXXXXXXX',
                hintStyle: AppText.digits(
                  15,
                  weight: FontWeight.w500,
                  color: AppColors.neutral500,
                ),
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
        ],
      ),
    ),
  );

  Widget _field({
    required TextEditingController controller,
    required String hint,
    bool obscure = false,
    bool ltr = false,
    TextInputType? keyboard,
    Widget? suffix,
  }) => SizedBox(
    height: 54,
    child: TextField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboard,
      textDirection: ltr ? TextDirection.ltr : null,
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
