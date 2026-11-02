import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../design/tokens.dart';

/// مراحلُ الدخول الثلاث.
enum LoginStage { phone, code, handle }

/// **شاشةُ الدخول** — §5.11: جوالٌ ثمّ رمزٌ ثمّ اختيارُ معرّف.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.onDone});

  final VoidCallback? onDone;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  LoginStage _stage = LoginStage.phone;

  final _phone = TextEditingController();
  final _code = TextEditingController();
  final _handle = TextEditingController();
  final _codeFocus = FocusNode();

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    _handle.dispose();
    _codeFocus.dispose();
    super.dispose();
  }

  /// **جوالٌ سعوديٌّ يبدأ بـ‎05‎ وطولُه عشرة** — ما خالفه يُردّ عند الإرسال.
  bool get _phoneValid => RegExp(r'^05\d{8}$').hasMatch(_phone.text.trim());

  bool get _codeValid => _code.text.trim().length == 4;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 12, 22, 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 24),
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.accent700,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Center(
                  child: Container(
                    width: 24,
                    height: 12,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: AppColors.neutral100,
                        width: 2.5,
                      ),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                'سوق تداول اللوحات',
                style: AppText.body(18, weight: FontWeight.w700),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Expanded(child: _body()),
        ],
      ),
    );
  }

  Widget _body() => switch (_stage) {
    LoginStage.phone => _phoneStep(),
    LoginStage.code => _codeStep(),
    LoginStage.handle => _handleStep(),
  };

  Widget _phoneStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'أهلًا بك',
        style: AppText.body(26, weight: FontWeight.w700).copyWith(height: 1.3),
      ),
      const SizedBox(height: 14),
      Text(
        'ادخل برقم جوالك — نرسل لك رمز تحقق.',
        style: AppText.body(
          14,
          color: AppColors.neutral800,
        ).copyWith(height: 1.7),
      ),
      const SizedBox(height: 22),
      /* و«+966» ثابتةٌ بجانب الحقل — فلا يُسأل عن مفتاح الدولة */
      Container(
        height: 54,
        decoration: BoxDecoration(
          color: AppColors.neutral100,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 16),
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
                  style: AppText.digits(16, weight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: '05XXXXXXXX',
                    hintStyle: AppText.digits(
                      16,
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
      ),
      const Spacer(),
      _primary(
        'أرسل الرمز',
        _phoneValid,
        () => setState(() => _stage = LoginStage.code),
      ),
    ],
  );

  Widget _codeStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'رمز التحقق',
        style: AppText.body(26, weight: FontWeight.w700).copyWith(height: 1.3),
      ),
      const SizedBox(height: 14),
      Directionality(
        textDirection: TextDirection.ltr,
        child: Text(
          'أرسلناه إلى +966${_phone.text.trim()}',
          textAlign: TextAlign.right,
          style: AppText.body(14, color: AppColors.neutral800),
        ),
      ),
      const SizedBox(height: 22),
      /*
           * **إدخالٌ واحدٌ مخفيٌّ فوق أربعة مربّعات.**
           *
           * فأربعةُ حقولٍ منفصلةٍ تتقافز بينها لوحةُ المفاتيح، ويفشل اللصقُ
           * من الرسالة، ومحوُ خانةٍ يحتاج رجوعًا يدويًّا. وحقلٌ واحدٌ يحلّ
           * الثلاثة، والمربّعاتُ صورةٌ له.
           */
      Stack(
        children: [
          Row(
            children: List.generate(4, (i) {
              final filled = _code.text.length > i;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i == 3 ? 0 : 10),
                  child: Container(
                    height: 62,
                    decoration: BoxDecoration(
                      color: AppColors.neutral100,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(
                        color: filled ? AppColors.accent : AppColors.divider,
                        width: filled ? 2 : 1,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      filled ? _code.text[i] : '',
                      style: AppText.digits(24),
                    ),
                  ),
                ),
              );
            }),
          ),
          Positioned.fill(
            child: Opacity(
              opacity: 0,
              child: TextField(
                controller: _code,
                focusNode: _codeFocus,
                autofocus: true,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(4),
                ],
                onChanged: (_) => setState(() {}),
              ),
            ),
          ),
        ],
      ),
      const Spacer(),
      _primary(
        'تحقّق',
        _codeValid,
        () => setState(() => _stage = LoginStage.handle),
      ),
    ],
  );

  Widget _handleStep() => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Text(
        'اختر معرّفك',
        style: AppText.body(26, weight: FontWeight.w700).copyWith(height: 1.3),
      ),
      const SizedBox(height: 14),
      Text(
        'يصير رابطَ معرضك العلنيّ. يمكنك تغييره لاحقًا.',
        style: AppText.body(
          14,
          color: AppColors.neutral800,
        ).copyWith(height: 1.7),
      ),
      const SizedBox(height: 22),
      Container(
        height: 54,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: AppColors.neutral100,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Row(
            children: [
              Text(
                'souq-plates.sa/@',
                style: AppText.body(14, color: AppColors.neutral600),
              ),
              Expanded(
                child: TextField(
                  controller: _handle,
                  onChanged: (_) => setState(() {}),
                  style: AppText.body(16, weight: FontWeight.w700),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      const Spacer(),
      _primary('ابدأ', _handle.text.trim().length >= 3, widget.onDone),
      const SizedBox(height: 8),
      /* **و«لاحقًا» مخرجٌ صريح** — فالمعرّفُ لا يمنع الدخول */
      GestureDetector(
        onTap: widget.onDone,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          height: 44,
          child: Center(
            child: Text(
              'لاحقًا',
              style: AppText.body(
                14,
                color: AppColors.neutral700,
                weight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    ],
  );

  Widget _primary(String label, bool enabled, VoidCallback? onTap) =>
      GestureDetector(
        onTap: enabled ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: 54,
          decoration: BoxDecoration(
            color: enabled ? AppColors.accent : AppColors.accent300,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppText.body(
              17,
              color: AppColors.neutral100,
              weight: FontWeight.w700,
            ),
          ),
        ),
      );
}
