import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../design/tokens.dart';
import '../models/iban.dart';
import '../widgets/settings/ios_switch.dart';

/// معلّقٌ يمنع حذفَ الحساب — ولكلٍّ وجهتُه.
class DeletionBlocker {
  const DeletionBlocker(this.label, this.detail);
  final String label;
  final String detail;
}

/// **شاشةُ الإعدادات** — §5.10.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    this.blockers = const [],
    this.onBack,
    this.initial,
    this.onSave,
    this.onLogout,
    this.onDelete,
  });

  /// ما يمنع الحذفَ الآن — فارغةٌ يعني أنّه ممكن.
  final List<DeletionBlocker> blockers;

  final VoidCallback? onBack;

  /// ما يُملأ به النموذجُ عند الفتح — من الخادم.
  final SettingsDraft? initial;

  /// **يحفظ الملفَّ والحسابَ البنكيَّ معًا.**
  ///
  /// فالمستخدمُ يملأ الشاشةَ مرّةً ويحفظ مرّةً، وطلبان منفصلان يُنجح
  /// أحدَهما ويُسقط الآخرَ فتبقى الشاشةُ نصفَ محفوظة.
  final Future<bool> Function(SettingsDraft draft)? onSave;

  /// **الخروجُ من الحساب** — وكان الزرُّ بلا نداءٍ أصلًا.
  final VoidCallback? onLogout;

  /// **تعليقُ الحساب وطلبُ حذفه** — تشترطه أبل من داخل التطبيق.
  final VoidCallback? onDelete;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final _name = TextEditingController(text: widget.initial?.name ?? '');
  late final _handle = TextEditingController(
    text: widget.initial?.handle ?? '',
  );
  late final _email = TextEditingController(text: widget.initial?.email ?? '');
  late final _city = TextEditingController(text: widget.initial?.city ?? '');
  final _snap = TextEditingController();
  final _tiktok = TextEditingController();
  final _instagram = TextEditingController();
  final _iban = TextEditingController();
  final _holder = TextEditingController();

  final _prefs = <String, bool>{
    'تجاوزك أحد في مزاد': true,
    'اقترب انتهاء مزاد تتابعه': true,
    'وصلك سوم على لوحتك': true,
    'تحديثات صفقاتك': true,
    'أخبار المنصّة والعروض': false,
  };

  @override
  void dispose() {
    for (final c in [
      _name,
      _handle,
      _email,
      _city,
      _snap,
      _tiktok,
      _instagram,
      _iban,
      _holder,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  bool _busy = false;

  bool get _bankValid =>
      !_busy && Iban.isValid(_iban.text) && _holder.text.trim().isNotEmpty;

  Future<void> _save() async {
    final send = widget.onSave;
    if (send == null) return;
    setState(() => _busy = true);
    await send(
      SettingsDraft(
        name: _name.text.trim(),
        handle: _handle.text.trim(),
        email: _email.text.trim(),
        city: _city.text.trim(),
        snapchat: _snap.text.trim(),
        tiktok: _tiktok.text.trim(),
        instagram: _instagram.text.trim(),
        iban: Iban.normalize(_iban.text),
        bankName: Iban.bankName(_iban.text) ?? '',
        holderName: _holder.text.trim(),
      ),
    );
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
          child: Row(
            children: [
              GestureDetector(
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
              const SizedBox(width: 10),
              Text('الإعدادات', style: AppText.heading(24)),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
            children: [
              _accountSection(),
              const SizedBox(height: 14),
              _socialSection(),
              const SizedBox(height: 14),
              _bankSection(),
              const SizedBox(height: 14),
              _prefsSection(),
              const SizedBox(height: 14),
              _footer(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _card({required List<Widget> children}) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppRadii.card),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    ),
  );

  Widget _accountSection() => _card(
    children: [
      _title('بيانات الحساب'),
      const SizedBox(height: 12),
      _field('الاسم المعروض', _name),
      const SizedBox(height: 12),
      _handleField(),
      const SizedBox(height: 12),

      /// **والجوالُ موثّقٌ للقراءة** — تغييرُه يُغيّر هويّةَ الدخول،
      /// فلا يُترك لحقلٍ يُحرَّر بالخطأ.
      _readOnly('رقم الجوال', '05X XXX 4821', 'موثّق · يُغيَّر عبر الدعم'),
      const SizedBox(height: 12),
      _field('البريد الإلكتروني', _email, ltr: true),
      const SizedBox(height: 12),
      _field('المدينة', _city),
    ],
  );

  Widget _handleField() {
    final handle = _handle.text.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _label('المعرّف — رابط معرضك'),
        const SizedBox(height: 6),
        Container(
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: 14),
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
                    style: AppText.body(15, weight: FontWeight.w700),
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
        const SizedBox(height: 4),
        Text(
          handle == 'waleed'
              ? 'متاح — معرّفك الحالي'
              : (handle.length < 3 ? 'ثلاثة أحرف على الأقل' : 'متاح'),
          style: AppText.body(11.5, color: AppColors.neutral700),
        ),
      ],
    );
  }

  Widget _socialSection() => _card(
    children: [
      _title('حسابات التواصل'),
      const SizedBox(height: 4),
      Text(
        'اختيارية — تُحسب بها لوحاتك في البحث. الصق الرابط أو @الاسم',
        style: AppText.body(
          12,
          color: AppColors.neutral700,
        ).copyWith(height: 1.6),
      ),
      const SizedBox(height: 12),
      _field('سناب شات', _snap, ltr: true),
      const SizedBox(height: 12),
      _field('تيك توك', _tiktok, ltr: true),
      const SizedBox(height: 12),
      _field('إنستقرام', _instagram, ltr: true),
    ],
  );

  Widget _bankSection() {
    final err = Iban.error(_iban.text);
    final bank = Iban.bankName(_iban.text);

    return _card(
      children: [
        _title('الحساب البنكي'),
        const SizedBox(height: 4),
        Text(
          'تُحوَّل إليه طلبات السحب من محفظتك. يجب أن يكون باسمك كما في الهوية.',
          style: AppText.body(
            12,
            color: AppColors.neutral700,
          ).copyWith(height: 1.6),
        ),
        const SizedBox(height: 12),
        _label('رقم الآيبان'),
        const SizedBox(height: 6),
        SizedBox(
          height: 46,
          child: TextField(
            controller: _iban,
            textDirection: TextDirection.ltr,
            textCapitalization: TextCapitalization.characters,
            onChanged: (v) {
              /* ويُنسَّق وأنت تكتب، والمؤشّرُ يبقى في آخره */
              final formatted = Iban.format(v);
              _iban.value = TextEditingValue(
                text: formatted,
                selection: TextSelection.collapsed(offset: formatted.length),
              );
              setState(() {});
            },
            style: AppText.digits(
              15,
              weight: FontWeight.w600,
            ).copyWith(letterSpacing: 0.6),
            decoration: InputDecoration(
              hintText: 'SA00 0000 0000 0000 0000 0000',
              hintStyle: AppText.digits(
                15,
                weight: FontWeight.w500,
                color: AppColors.neutral500,
              ),
              filled: true,
              fillColor: AppColors.neutral100,
              contentPadding: const EdgeInsets.symmetric(horizontal: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppRadii.pill),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        if (bank != null) ...[
          const SizedBox(height: 4),
          Text(
            bank,
            style: AppText.body(
              12,
              color: AppColors.accent2_800,
              weight: FontWeight.w700,
            ),
          ),
        ],
        if (err != null) ...[
          const SizedBox(height: 4),
          Text(err, style: AppText.body(11.5, color: AppColors.accent700)),
        ],
        const SizedBox(height: 12),
        _field('اسم صاحب الحساب', _holder, hint: 'كما في الهوية الوطنية'),
        const SizedBox(height: 14),
        GestureDetector(
          onTap: _bankValid ? _save : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 46,
            decoration: BoxDecoration(
              color: _bankValid ? AppColors.accent : AppColors.accent300,
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            alignment: Alignment.center,
            child: Text(
              'احفظ الحساب البنكي',
              style: AppText.body(
                14,
                color: AppColors.neutral100,
                weight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _prefsSection() => _card(
    children: [
      _title('التنبيهات والأصوات'),
      const SizedBox(height: 4),
      for (final entry in _prefs.entries) ...[
        Container(height: 1, color: AppColors.divider),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  entry.key,
                  style: AppText.body(14, weight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: 10),
              IosSwitch(
                value: entry.value,
                onChanged: (v) => setState(() => _prefs[entry.key] = v),
              ),
            ],
          ),
        ),
      ],
    ],
  );

  /// **وحذفُ الحساب مشروطٌ بألّا يكون عليك معلّق** (§5.10).
  Widget _footer() => Row(
    children: [
      Expanded(
        child: _OutlinedButton(
          label: 'تسجيل الخروج',
          color: AppColors.text,
          onTap: widget.onLogout,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _OutlinedButton(
          label: 'حذف الحساب',
          color: AppColors.danger,
          onTap: () => _openDelete(context),
        ),
      ),
    ],
  );

  Future<void> _openDelete(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    backgroundColor: AppColors.bg,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadii.sheet)),
    ),
    builder: (context) => _DeleteSheet(
      blockers: widget.blockers,
      onConfirm: () {
        Navigator.pop(context);
        widget.onDelete?.call();
      },
    ),
  );

  Widget _title(String text) =>
      Text(text, style: AppText.body(15, weight: FontWeight.w700));

  Widget _label(String text) =>
      Text(text, style: AppText.body(12.5, weight: FontWeight.w700));

  Widget _field(
    String label,
    TextEditingController controller, {
    bool ltr = false,
    String? hint,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _label(label),
      const SizedBox(height: 6),
      SizedBox(
        height: 46,
        child: TextField(
          controller: controller,
          textDirection: ltr ? TextDirection.ltr : null,
          onChanged: (_) => setState(() {}),
          style: AppText.body(15),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: AppText.body(14, color: AppColors.neutral500),
            filled: true,
            fillColor: AppColors.neutral100,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadii.pill),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ),
    ],
  );

  Widget _readOnly(String label, String value, String note) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      _label(label),
      const SizedBox(height: 6),
      Container(
        height: 46,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: AppColors.neutral200,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          children: [
            Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                value,
                style: AppText.digits(15, weight: FontWeight.w600),
              ),
            ),
            const Spacer(),
            Text(note, style: AppText.body(11, color: AppColors.neutral700)),
          ],
        ),
      ),
    ],
  );
}

class _OutlinedButton extends StatelessWidget {
  const _OutlinedButton({required this.label, required this.color, this.onTap});

  final String label;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    behavior: HitTestBehavior.opaque,
    child: Container(
      height: 46,
      decoration: BoxDecoration(
        color: AppColors.neutral100,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: AppText.body(14, color: color, weight: FontWeight.w700),
      ),
    ),
  );
}

/// **ورقةُ حذف الحساب** — تمنع أو تشرح، ولا تحذف بضغطة.
class _DeleteSheet extends StatefulWidget {
  const _DeleteSheet({required this.blockers, this.onConfirm});

  final List<DeletionBlocker> blockers;

  /// **والإقرارُ وحده لا يحذف** — كان الزرُّ `Container` لا يُضغط.
  final VoidCallback? onConfirm;

  @override
  State<_DeleteSheet> createState() => _DeleteSheetState();
}

class _DeleteSheetState extends State<_DeleteSheet> {
  bool _ack = false;

  @override
  Widget build(BuildContext context) {
    final blocked = widget.blockers.isNotEmpty;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 5,
                decoration: BoxDecoration(
                  color: AppColors.neutral400,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
              ),
            ),
            const SizedBox(height: 14),
            if (blocked) ..._blocked() else ..._allowed(),
          ],
        ),
      ),
    );
  }

  /// **ولا يُحذف وعليك معلّق** — ولكلِّ مانعٍ وجهتُه ليُنهيه.
  List<Widget> _blocked() => [
    Text(
      'لا يمكن حذف حسابك الآن',
      style: AppText.body(20, weight: FontWeight.w700),
    ),
    const SizedBox(height: 6),
    Text(
      'أنهِ ما يلي ثم أعد المحاولة:',
      style: AppText.body(12.5, color: AppColors.neutral700),
    ),
    const SizedBox(height: 12),
    for (final b in widget.blockers)
      Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    b.label,
                    style: AppText.body(13.5, weight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    b.detail,
                    style: AppText.body(12, color: AppColors.neutral700),
                  ),
                ],
              ),
            ),
            const Icon(
              LucideIcons.chevronLeft,
              size: 18,
              color: AppColors.neutral600,
            ),
          ],
        ),
      ),
  ];

  /// **ويُشرح ما يقع قبل أن يقع**: تعليقٌ ‎٣٠‎ يومًا ثمّ حذفٌ نهائيّ.
  List<Widget> _allowed() => [
    Text('حذف الحساب', style: AppText.body(20, weight: FontWeight.w700)),
    const SizedBox(height: 10),
    for (final line in const [
      'يُعلَّق حسابك فورًا وتُخفى لوحاتك من السوق.',
      'لك 30 يومًا لاسترجاعه عبر خدمة العملاء.',
      'بعدها يُحذف نهائيًا، ويبقى ما يلزم الاحتفاظ به نظامًا '
          '(الفواتير وسجلّات الصفقات).',
    ]) ...[
      Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 5),
            child: Icon(LucideIcons.dot, size: 14),
          ),
          Expanded(
            child: Text(
              line,
              style: AppText.body(
                13,
                color: AppColors.neutral800,
              ).copyWith(height: 1.7),
            ),
          ),
        ],
      ),
    ],
    const SizedBox(height: 14),
    GestureDetector(
      onTap: () => setState(() => _ack = !_ack),
      behavior: HitTestBehavior.opaque,
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: _ack ? AppColors.danger : Colors.transparent,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: _ack ? AppColors.danger : AppColors.neutral500,
                width: 1.5,
              ),
            ),
            child: _ack
                ? const Icon(LucideIcons.check, size: 14, color: Colors.white)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'أفهم أنّ الحذف نهائيٌّ بعد 30 يومًا',
              style: AppText.body(13),
            ),
          ),
        ],
      ),
    ),
    const SizedBox(height: 14),
    GestureDetector(
      onTap: _ack ? widget.onConfirm : null,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 50,
        decoration: BoxDecoration(
          /* **ولا يُفعَّل الزرُّ قبل الإقرار** — حذفٌ لا رجعةَ فيه */
          color: _ack
              ? AppColors.danger
              : AppColors.danger.withValues(alpha: 0.35),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        alignment: Alignment.center,
        child: Text(
          'علّق حسابي واطلب الحذف',
          style: AppText.body(15, color: Colors.white, weight: FontWeight.w700),
        ),
      ),
    ),
  ];
}

/// ما تحمله شاشةُ الإعدادات — يُملأ منه ويُحفظ إليه.
class SettingsDraft {
  const SettingsDraft({
    required this.name,
    required this.handle,
    required this.email,
    required this.city,
    this.snapchat = '',
    this.tiktok = '',
    this.instagram = '',
    this.iban = '',
    this.bankName = '',
    this.holderName = '',
  });

  final String name;
  final String handle;
  final String email;
  final String city;
  final String snapchat;
  final String tiktok;
  final String instagram;
  final String iban;
  final String bankName;
  final String holderName;
}
