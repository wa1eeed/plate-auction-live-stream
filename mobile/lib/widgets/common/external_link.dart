import 'package:url_launcher/url_launcher.dart';

/// **يفتح رابطًا خارج التطبيق.**
///
/// **وصفحةُ الدفع خاصّةً لا تُفتح داخله**: المستخدمُ عُلّم أن يتحقّق من
/// القفل وشريط العنوان قبل أن يُدخل بطاقة، وإطارٌ داخل تطبيقٍ يحجبهما —
/// فيصير التطبيقُ يُعلّم الناسَ ما يستغلّه المحتالون. ومتجرا التطبيقات
/// يمنعان ذلك كذلك.
///
/// ويُرجع هل فُتح — فما لم يُفتح يُقال لصاحبه بدل أن يُترك ينتظر.
Future<bool> launchExternal(String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}
