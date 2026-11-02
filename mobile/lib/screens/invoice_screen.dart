import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../design/tokens.dart';
import '../models/invoice.dart';
import '../models/order.dart';
import '../widgets/listing/bid_log.dart' show formatStamp;

/// **الفاتورةُ الضريبيّة المبسّطة** — §5.7.
///
/// **وقيمةُ اللوحة لا تدخلها**: المنصّةُ تفوتر عمولتَها وحدها، والثمنُ أمانةٌ
/// تمرّ بها إلى البائع. وفاتورةٌ بقيمة اللوحة تُقرأ بيعًا من المنصّة، وهي
/// وسيطٌ لا بائع — ويختلّ بها حسابُ الضريبة عند الطرفين.
///
/// **ولا يُحسب رقمٌ منها في الجهاز**: الرقمُ والضريبةُ والرمزُ تُصدَر في
/// الخادم وتُقرأ هنا كما وصلت. وكانت الشاشةُ تحسب ‎١٥٪‎ وتُلفّق رقمًا من
/// رقم الصفقة — ونسبةُ الضريبة تتغيّر بقرار، والرقمُ متسلسلٌ لا يُخترع،
/// وفاتورةٌ بأرقامٍ محسوبةٍ في الجهاز تخالف ما في سجلّ المنصّة.
class InvoiceScreen extends StatelessWidget {
  const InvoiceScreen({
    super.key,
    required this.order,
    required this.invoice,
    this.onBack,
  });

  final OrderView order;

  /// الفاتورةُ كما أصدرها الخادم.
  final TaxInvoice invoice;

  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _bar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [_card()],
          ),
        ),
      ],
    );
  }

  /// الشريطُ: رجوعٌ ‎٤٢‎ · «الفاتورة» ‎٢٢‎ · «تنزيل PDF» ‎٣٨‎.
  Widget _bar() => Padding(
    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
    child: Row(
      children: [
        GestureDetector(
          onTap: onBack,
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
        const SizedBox(width: 10),
        Expanded(child: Text('الفاتورة', style: AppText.heading(22))),
        const SizedBox(width: 10),
        Container(
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: AppColors.neutral100,
            border: Border.all(color: AppColors.divider),
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            'تنزيل PDF',
            style: AppText.body(12.5, weight: FontWeight.w700),
          ),
        ),
      ],
    ),
  );

  /// الورقةُ: بيضاءُ بحدٍّ وزاويةٍ ‎١٢‎ وحشوةِ ‎٢٠×١٨‎ وفواصلِ ‎١٤‎.
  Widget _card() => Container(
    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 20),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.divider),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D000000),
          blurRadius: 2,
          offset: Offset(0, 1),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _head(),
        const SizedBox(height: 14),
        _facts(),
        const SizedBox(height: 14),
        _items(),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: Text(
                'الإجمالي شامل الضريبة',
                style: AppText.body(16, weight: FontWeight.w700),
              ),
            ),
            Text(
              '${_money(invoice.totalAmount)} ر.س',
              style: AppText.digits(16, weight: FontWeight.w700),
            ),
          ],
        ),
        const SizedBox(height: 14),
        Text(
          '$_kindNote قيمة اللوحة ${_money(order.price)} ر.س.',
          style: AppText.body(
            11.5,
            color: AppColors.neutral700,
          ).copyWith(height: 1.7),
        ),
      ],
    ),
  );

  Widget _head() => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'فاتورة ضريبية مبسّطة',
              style: AppText.heading(17).copyWith(height: 1.2),
            ),
            const SizedBox(height: 3),
            Text(
              'Simplified Tax Invoice',
              style: AppText.body(11.5, color: AppColors.neutral700),
            ),
          ],
        ),
      ),
      const SizedBox(width: 10),
      _qr(),
    ],
  );

  /// **رمزُ ZATCA في مربّعه ‎٧٢‎** — يُرسم من محتواه لا يُحاكى.
  ///
  /// فالمحتوى (TLV ثمّ base64) يُصدَر في الخادم ويُوقَّع معه، ويُرسم هنا كما
  /// وصل. ومربّعٌ متقطّعُ الحدّ في موضعه مكانٌ حُجز له في التصميم، وفاتورةٌ
  /// به لا يقرؤها مفتّشُ الهيئة.
  Widget _qr() => Container(
    width: 72,
    height: 72,
    padding: const EdgeInsets.all(3),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(6),
      border: invoice.qr.isEmpty
          ? Border.all(color: AppColors.neutral500, width: 1.5)
          : null,
    ),
    child: invoice.qr.isEmpty
        /* وفاتورةٌ بلا رمزٍ تقول ذلك ولا تُرسم لها شبكةٌ كاذبة */
        ? Center(
            child: Text(
              'رمز QR\nZATCA',
              textAlign: TextAlign.center,
              style: AppText.body(
                10,
                color: AppColors.neutral700,
              ).copyWith(height: 1.3),
            ),
          )
        : QrImageView(
            data: invoice.qr,
            version: QrVersions.auto,
            padding: EdgeInsets.zero,
            backgroundColor: Colors.white,
            errorCorrectionLevel: QrErrorCorrectLevel.M,
            semanticsLabel: 'رمز الاستجابة السريعة للفاتورة',
          ),
  );

  /// **شبكةُ الحقائق — عمودان `auto 1fr`** كما في التصميم.
  ///
  /// و`Table` لا صفوفٌ مستقلّة: الصفوفُ المستقلّةُ يأخذ كلٌّ منها عرضَ
  /// عنوانه، فتتعرّج بداياتُ القيم. والعمودُ الأوّلُ `IntrinsicColumnWidth`
  /// يساوي أعرضَ عنوانٍ فتصطفّ القيمُ كلُّها على خطٍّ واحد.
  Widget _facts() => Table(
    columnWidths: const {0: IntrinsicColumnWidth(), 1: FlexColumnWidth()},
    defaultVerticalAlignment: TableCellVerticalAlignment.top,
    children: [
      /* **واللاتينيُّ يُفرض على رقم الفاتورة وحده** — كما في التصميم */
      _fact('رقم الفاتورة', invoice.reference, ltr: true, bold: true),
      _fact('التاريخ', formatStamp(invoice.issuedAt), digits: true),
      _fact('المورّد', invoice.sellerName),
      _fact('الرقم الضريبي', invoice.sellerVatNumber, digits: true),
      _fact('العميل', invoice.customerName),
      _fact(
        'مرجع الصفقة',
        '${invoice.orderReference} · ${order.letters} ${order.number}'
            ' · ${order.source}',
        digits: true,
      ),
    ],
  );

  TableRow _fact(
    String label,
    String value, {
    bool ltr = false,
    bool digits = false,
    bool bold = false,
  }) {
    final style = ltr || digits
        ? AppText.digits(12.5, weight: bold ? FontWeight.w700 : FontWeight.w500)
        : AppText.body(12.5, weight: bold ? FontWeight.w700 : FontWeight.w400);

    return TableRow(
      children: [
        Padding(
          padding: const EdgeInsetsDirectional.only(bottom: 6, end: 14),
          child: Text(
            label,
            style: AppText.body(12.5, color: AppColors.neutral700),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: ltr
              ? Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(value, style: style),
                  ),
                )
              : Text(value, style: style),
        ),
      ],
    );
  }

  /// البنودُ بين خطّين — العمولةُ ثمّ ضريبتُها.
  Widget _items() => Container(
    decoration: const BoxDecoration(
      border: Border(
        top: BorderSide(color: AppColors.divider),
        bottom: BorderSide(color: AppColors.divider),
      ),
    ),
    child: Column(
      children: [
        _item(invoice.description, invoice.netAmount),
        Container(height: 1, color: AppColors.divider),
        _item('ضريبة القيمة المضافة ${invoice.vatPercent}٪', invoice.vatAmount),
      ],
    ),
  );

  Widget _item(String label, int halalas) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      children: [
        Expanded(child: Text(label, style: AppText.body(13))),
        const SizedBox(width: 10),
        Text(_money(halalas), style: AppText.digits(13)),
      ],
    ),
  );

  /// **والنصُّ يتبع دورَك**: ما يدفعه المشتري أمانةٌ تمرّ، وما يأخذه البائع
  /// عائدٌ — ولكلٍّ جملتُه.
  String get _kindNote => order.youAreBuyer
      ? 'قيمة اللوحة أمانة تُحوَّل للبائع ولا تدخل الفاتورة — المنصّة تفوتر '
            'عمولتها فقط.'
      : 'قيمة اللوحة لا تدخل الفاتورة — المنصّة تفوتر عمولتها فقط.';

  static String _money(int halalas) => (halalas ~/ 100)
      .toString()
      .replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+$)'), (m) => '${m[1]},');
}
