import 'package:flutter/material.dart';

import 'design/tokens.dart';
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
      home: const AppShell(),
    );
  }
}
