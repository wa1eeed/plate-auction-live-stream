import 'package:flutter/material.dart';

import 'design/tokens.dart';
import 'auth/auth_flow.dart';
import 'auth/session.dart';
import 'shell/app_shell.dart';

void main() => runApp(const MazadApp());

/// **تطبيقُ «سوق تداول اللوحات»** — أصيلٌ موحّدٌ لـiOS وأندرويد.
class MazadApp extends StatelessWidget {
  const MazadApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'سوق تداول اللوحات',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        scaffoldBackgroundColor: AppColors.bg,
        fontFamily: AppFonts.ui,
        fontFamilyFallback: const [AppFonts.arabic],
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.accent,
          primary: AppColors.accent,
          surface: AppColors.bg,
        ),
        useMaterial3: true,
      ),
      /* **والتطبيقُ عربيٌّ كلُّه** — واللوحةُ وحدها تُستثنى، وهي تفرض اتّجاهها */
      locale: const Locale('ar', 'SA'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: const _Root(),
    );
  }
}

/// **الجذرُ يحمل الجلسةَ ويُبقي التصفّحَ مفتوحًا.**
///
/// فالتطبيقُ يُفتح على السوق لا على بابِ تسجيل: من لم يقرّر بعدُ يرى
/// اللوحاتِ أوّلًا، ويُطلب الحسابُ عند أوّل وظيفةٍ يحتاجه فيها.
class _Root extends StatefulWidget {
  const _Root();

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  final _session = Session();
  AuthRoute? _auth;

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: _session,
      child: _auth == null
          ? AppShell(onNeedAuth: (route) => setState(() => _auth = route))
          : AuthFlow(
              initial: _auth!,
              onClose: () => setState(() => _auth = null),
              onSignedIn: () {
                _session.signIn();
                setState(() => _auth = null);
              },
            ),
    );
  }
}
