import 'package:flutter/widgets.dart';

import 'mazad_api.dart';

/// يُتيح [MazadApi] لشجرة الواجهة.
class ApiScope extends InheritedWidget {
  const ApiScope({super.key, required this.api, required super.child});

  final MazadApi api;

  static MazadApi of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ApiScope>();
    assert(scope != null, 'لا عميلَ في الشجرة — لُفَّ التطبيقَ بـApiScope');
    return scope!.api;
  }

  @override
  bool updateShouldNotify(ApiScope old) => old.api != api;
}
