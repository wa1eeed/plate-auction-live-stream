import 'package:flutter/material.dart';

import '../screens/login_screen.dart';
import 'password_login_screen.dart';
import 'register_screen.dart';

/// أيُّ بابٍ من أبواب الدخول يُفتح.
enum AuthRoute { otp, password, register }

/// **مسارُ الدخول** — ثلاثةُ أبوابٍ يُنتقل بينها بلا خروجٍ من التطبيق.
///
/// وهو شاشةٌ كاملةٌ تُدفع فوق الهيكل: الدخولُ قرارٌ يستحقّ الشاشة، والورقةُ
/// السفليّةُ قبله هي التي تسأل «أتريد؟» — فإذا أراد، أُعطي المكانَ كلَّه.
class AuthFlow extends StatefulWidget {
  const AuthFlow({
    super.key,
    required this.initial,
    required this.onClose,
    required this.onSignedIn,
  });

  final AuthRoute initial;
  final VoidCallback onClose;
  final VoidCallback onSignedIn;

  @override
  State<AuthFlow> createState() => _AuthFlowState();
}

class _AuthFlowState extends State<AuthFlow> {
  late AuthRoute _route = widget.initial;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        /* ورجوعُ النظام يُغلق المسارَ ولا يُخرج من التطبيق */
        widget.onClose();
      },
      child: switch (_route) {
        AuthRoute.otp => LoginScreen(
          onDone: widget.onSignedIn,
          onPasswordLogin: () => setState(() => _route = AuthRoute.password),
          onRegister: () => setState(() => _route = AuthRoute.register),
        ),
        AuthRoute.password => PasswordLoginScreen(
          onBack: () => setState(() => _route = AuthRoute.otp),
          onDone: widget.onSignedIn,
        ),
        AuthRoute.register => RegisterScreen(
          onBack: () => setState(() => _route = AuthRoute.otp),
          onDone: widget.onSignedIn,
        ),
      },
    );
  }
}
