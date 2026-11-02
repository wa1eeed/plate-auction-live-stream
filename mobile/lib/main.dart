import 'package:flutter/material.dart';

import 'design/tokens.dart';
import 'api/api_client.dart';
import 'api/api_scope.dart';
import 'api/mazad_api.dart';
import 'auth/auth_flow.dart';
import 'auth/session.dart';
import 'shell/app_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  /*
   * **ويُنشأ العميلُ قبل الإقلاع** — ومعه مِرطبانُ الكوكي من القرص.
   *
   * فقراءةُ الجلسة المحفوظة تحتاج قرصًا، وبناءُ الشجرة قبلها يُظهر
   * التطبيقَ خارجًا ثمّ يُدخله فجأةً — ووميضٌ كهذا يُقرأ عطبًا.
   */
  final client = await ApiClient.create();
  final api = MazadApi(client);
  final signedIn = await client.hasSession();

  runApp(MazadApp(api: api, signedIn: signedIn));
}

/// **تطبيقُ «سوق تداول اللوحات»** — أصيلٌ موحّدٌ لـiOS وأندرويد.
class MazadApp extends StatelessWidget {
  const MazadApp({super.key, required this.api, required this.signedIn});

  final MazadApi api;

  /// هل وُجدت جلسةٌ محفوظةٌ على القرص؟
  final bool signedIn;

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
      home: ApiScope(
        api: api,
        child: _Root(signedIn: signedIn),
      ),
    );
  }
}

/// **الجذرُ يحمل الجلسةَ ويُبقي التصفّحَ مفتوحًا.**
///
/// فالتطبيقُ يُفتح على السوق لا على بابِ تسجيل: من لم يقرّر بعدُ يرى
/// اللوحاتِ أوّلًا، ويُطلب الحسابُ عند أوّل وظيفةٍ يحتاجه فيها.
class _Root extends StatefulWidget {
  const _Root({required this.signedIn});

  final bool signedIn;

  @override
  State<_Root> createState() => _RootState();
}

class _RootState extends State<_Root> {
  late final _session = Session(signedIn: widget.signedIn);
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
