import { z } from 'zod'
import { HANDLE_PATTERN, PLATE_FORMATS, RESERVED_HANDLES, type PlateFormat } from './types'
import { normalizeArabicLetters, normalizePlateNumbers } from '@/lib/saudi-plate-mapping'
import {
  FAQ_CATEGORIES,
  PLATE_EMBLEMS,
  PLATE_TYPES,
  PLATE_TYPE_MAX_LETTERS,
  SALE_TYPES,
  isValidSaudiIban,
  normalizeSocialHandle,
} from './types'
import { isValidCrNumber, isValidVatNumber } from './zatca'
import type { FaqCategory, PlateType, SaleType } from './types'

const plateTypeSchema = z.enum(PLATE_TYPES as unknown as [PlateType, ...PlateType[]])
/** نوع الإصدار — الطويلة افتراضًا لتوافق ما أُنشئ قبل وجود الخيار */
const plateFormatSchema = z
  .enum(PLATE_FORMATS as unknown as [PlateFormat, ...PlateFormat[]])
  .default('long')
const emblemSchema = z.enum(PLATE_EMBLEMS as unknown as [string, ...string[]])
const saleTypeSchema = z.enum(SALE_TYPES as unknown as [SaleType, ...SaleType[]])

/** رقم جوال سعودي: 05XXXXXXXX أو +9665XXXXXXXX */
export const saudiPhoneSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/[\s\-()]/g, '')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)),
  )
  .refine((value) => /^(?:\+?966|0)?5\d{8}$/.test(value), {
    message: 'أدخل رقم جوال سعودي صحيح يبدأ بـ 05',
  })
  .transform((value) => `+966${value.replace(/^\+?966/, '').replace(/^0/, '')}`)

export const displayNameSchema = z
  .string()
  .trim()
  .min(2, 'الاسم قصير جدًا')
  .max(40, 'الاسم طويل جدًا')
  .regex(/^[\p{L}\p{N} _.'-]+$/u, 'الاسم يحتوي على رموز غير مسموحة')

// ------------------------------------------------------------------ الحسابات

export const loginSchema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
})

/**
 * حساب تواصل — يقبل `@name` والرابط الكامل والاسم وحده.
 *
 * التحقّق يقع على **المُطبَّع** لا على المُدخل: من لصق رابطًا كاملًا لا يُرفض
 * إدخاله، ومن كتب حروفًا عربية يُرفض لأن الحساب لن يُفتح.
 */
const socialHandleSchema = z
  .string()
  .trim()
  .max(120, 'المُدخل طويل جدًا')
  .transform((value) => normalizeSocialHandle(value))
  .nullable()
  .optional()

export const socialHandlesSchema = z.object({
  tiktok: socialHandleSchema,
  snapchat: socialHandleSchema,
  instagram: socialHandleSchema,
})

/**
 * المعرّف العلنيّ — يُختار عند التسجيل لا بعده.
 *
 * هو رابط معرضه: `/@waleed`. واختياره في النموذج يجعله جزءًا من الحساب منذ
 * لحظته، فلا يبقى صاحبه برابطٍ رقميّ طويل حتى يكتشف الصفحة التي تُغيّره.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((value) => value.replace(/^@+/, ''))
  .refine((value) => HANDLE_PATTERN.test(value), {
    message: 'حروف لاتينية صغيرة وأرقام وشرطة سفلية، من ٣ إلى ٣٠ خانة',
  })
  .refine((value) => !RESERVED_HANDLES.has(value), { message: 'هذا المعرّف محجوز' })

export const registerSchema = loginSchema.extend({
  displayName: displayNameSchema,
  handle: handleSchema,
  phone: saudiPhoneSchema.optional().or(z.literal('')),
  social: socialHandlesSchema.optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'يجب الموافقة على شروط الاستخدام' }),
  }),
})

/**
 * حساب الإيداع.
 *
 * يُقبل فارغًا كاملًا — من لم يُدخله بعد لا يُمنع من حفظ بقيّة إعداداته.
 * فإن أُدخل، لزم تمامه: آيبان بلا اسم صاحب حساب حوالةٌ تُردّ من البنك.
 */
export const payoutAccountSchema = z
  .object({
    bankName: z.string().trim().max(80, 'اسم البنك طويل جدًا'),
    iban: z
      .string()
      .trim()
      .transform((value) => value.replace(/\s/g, '').toUpperCase())
      .refine(
        (value) => value === '' || isValidSaudiIban(value),
        'آيبان غير صالح — يبدأ بـSA وطوله أربع وعشرون خانة',
      ),
    accountName: z.string().trim().max(120, 'اسم صاحب الحساب طويل جدًا'),
  })
  .superRefine((value, ctx) => {
    const filled = [value.bankName, value.iban, value.accountName].filter(Boolean).length
    if (filled === 0 || filled === 3) return
    for (const field of ['bankName', 'iban', 'accountName'] as const) {
      if (!value[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: 'أكمل بيانات الحساب أو اتركها فارغة',
        })
      }
    }
  })

export const profileUpdateSchema = z.object({
  displayName: displayNameSchema,
  phone: saudiPhoneSchema.nullable().optional().or(z.literal('')),
  city: z.string().trim().max(40, 'اسم المدينة طويل جدًا').nullable().optional().or(z.literal('')),
  social: socialHandlesSchema.optional(),
  /** حساب الإيداع — يرسله النموذج نفسه، ويُقبل فارغًا */
  payout: payoutAccountSchema.optional(),
})

// ------------------------------------------------------------------ الإعلانات

const riyalField = (label: string, min = 0) =>
  z
    .number({ invalid_type_error: `${label} يجب أن يكون رقمًا` })
    .int(`${label} يجب أن يكون عددًا صحيحًا من الريالات`)
    .min(min, `${label} يجب أن يكون ${min} أو أكثر`)
    .max(100_000_000, `${label} كبير جدًا`)

export const listingInputSchema = z
  .object({
    plateType: plateTypeSchema,
    plateFormat: plateFormatSchema,
    arabicLetters: z.string().trim().min(1, 'أدخل حرفًا واحدًا على الأقل'),
    latinLetters: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{1,3}$/, 'الحروف اللاتينية من 1 إلى 3 أحرف إنجليزية'),
    plateNumbers: z.string().trim().min(1, 'أدخل رقمًا واحدًا على الأقل'),
    emblem: emblemSchema,
    customEmblemUrl: z.string().trim().url('رابط الشعار غير صحيح').nullable().optional(),
    description: z.string().trim().max(400, 'الوصف طويل جدًا').nullable().optional(),

    saleType: saleTypeSchema,
    price: riyalField('سعر البيع المباشر', 0),
    startingPrice: riyalField('السعر الافتتاحي', 0),
    minimumIncrement: riyalField('الحد الأدنى للزيادة', 0),
    reservePrice: riyalField('السعر الاحتياطي', 0),
    minimumOffer: riyalField('أقل عرض مقبول', 0),

    durationSeconds: z.number().int().min(300, 'أقل مدة 5 دقائق').max(2_592_000, 'أقصى مدة 30 يومًا'),
    /*
     * التمديد والعربون ومهلة السداد ليست هنا عمدًا.
     * هي قواعد حوكمة مركزية تضبطها الإدارة لكل المنصّة — انظر `AuctionSettings`.
     * بائع يضع عربونًا صفرًا يفتح مزاده للعبث، وآخر يضع مهلة ساعة يوقع المشتري
     * في مخالفة. للبائع ما يخصّ لوحته: السعر والزيادة والاحتياطي والمدّة.
     */
  })
  .superRefine((value, ctx) => {
    const maxLetters = PLATE_TYPE_MAX_LETTERS[value.plateType]
    const normalizedLetters = normalizeArabicLetters(value.arabicLetters, maxLetters)
    if (normalizedLetters.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['arabicLetters'],
        message: 'الحروف غير مدعومة في لوحات المركبات السعودية',
      })
    }
    if (normalizedLetters.length !== value.latinLetters.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['latinLetters'],
        message: 'عدد الحروف اللاتينية يجب أن يطابق عدد الحروف العربية',
      })
    }
    if (normalizePlateNumbers(value.plateNumbers, 4).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plateNumbers'],
        message: 'أرقام اللوحة يجب أن تكون من 1 إلى 4 أرقام',
      })
    }
    if (value.emblem === 'custom' && !value.customEmblemUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customEmblemUrl'],
        message: 'أضف رابط الشعار المخصص',
      })
    }

    if (value.saleType === 'fixed' && value.price < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'حدّد سعر البيع المباشر' })
    }
    if (value.saleType === 'auction') {
      // السعر الافتتاحي اختياري: صفر يعني مزادًا مفتوحًا يبدأ من أول مزايدة،
      // وحدّه الأدنى عندئذٍ هو الحد الأدنى للزيادة.
      if (value.minimumIncrement < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minimumIncrement'],
          message: 'حدّد الحد الأدنى للزيادة',
        })
      }
      if (value.reservePrice > 0 && value.reservePrice < value.startingPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reservePrice'],
          message: 'السعر الاحتياطي لا يمكن أن يكون أقل من السعر الافتتاحي',
        })
      }
    }
  })

export type ListingInput = z.infer<typeof listingInputSchema>

// ------------------------------------------------------------------ التداول

export const placeBidSchema = z.object({
  amount: z.number().int().positive('المبلغ غير صالح').max(100_000_000),
  isCustomAmount: z.boolean().default(false),
  clientRequestId: z
    .string()
    .trim()
    .min(6, 'معرّف الطلب غير صالح')
    .max(64, 'معرّف الطلب غير صالح'),
})

export const buyNowSchema = z.object({
  clientRequestId: z.string().trim().min(6).max(64),
})

export const placeOfferSchema = z.object({
  amount: z.number().int().positive('المبلغ غير صالح').max(100_000_000),
  message: z.string().trim().max(300, 'الرسالة طويلة جدًا').optional(),
})

export const offerDecisionSchema = z.object({
  decision: z.enum(['accept', 'decline']),
})

export const orderStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
})

export const cancelBidSchema = z.object({
  bidId: z.string().min(1, 'معرّف المزايدة مطلوب'),
  reason: z.string().trim().max(160).optional(),
})

// ------------------------------------------------------------------ الإدارة

export const adminLoginSchema = z.object({
  email: z.string().trim().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(8, 'كلمة المرور 8 أحرف على الأقل'),
})

export const walletAdjustmentSchema = z.object({
  type: z.enum(['topup', 'withdrawal', 'adjustment']),
  amount: z
    .number({ invalid_type_error: 'المبلغ يجب أن يكون رقمًا' })
    .int('المبلغ يجب أن يكون عددًا صحيحًا من الريالات')
    .positive('المبلغ يجب أن يكون أكبر من صفر')
    .max(100_000_000, 'المبلغ كبير جدًا'),
  note: z.string().trim().max(200, 'الملاحظة طويلة جدًا').optional(),
})

export const depositDecisionSchema = z.object({
  decision: z.enum(['forfeit', 'refund', 'undo_forfeit']),
  reason: z.string().trim().min(3, 'اذكر سببًا موجزًا').max(200, 'السبب طويل جدًا'),
})

export const adminOrderStatusSchema = z.object({
  status: z.enum(['completed', 'cancelled', 'defaulted']),
})

export const faqInputSchema = z.object({
  question: z.string().trim().min(5, 'السؤال قصير جدًا').max(200, 'السؤال طويل جدًا'),
  answer: z.string().trim().min(10, 'الإجابة قصيرة جدًا').max(2000, 'الإجابة طويلة جدًا'),
  category: z.enum(FAQ_CATEGORIES as unknown as [FaqCategory, ...FaqCategory[]]),
  sortOrder: z.number().int().min(0).max(999).default(0),
  published: z.boolean().default(true),
  showOnSaleTypes: z.array(saleTypeSchema).default([]),
})

export type FaqInput = z.infer<typeof faqInputSchema>

// ------------------------------------------------------------------ المدفوعات

export const startTopUpSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'المبلغ يجب أن يكون رقمًا' })
    .int('المبلغ يجب أن يكون عددًا صحيحًا من الريالات')
    .min(50, 'أقل مبلغ شحن 50 ريالًا')
    .max(500_000, 'أقصى مبلغ شحن 500,000 ريال'),
  method: z.enum(['tap', 'bank_transfer']),
})

export const transferProofSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, 'أدخل رقم العملية أو وصفًا موجزًا للحوالة')
    .max(200, 'النص طويل جدًا'),
})

export const paymentDecisionSchema = z.object({
  decision: z.enum(['confirm', 'reject']),
  reason: z.string().trim().max(200, 'السبب طويل جدًا').optional(),
})

/** الرقم الدولي السعودي: SA ثم 22 رقمًا. */
const ibanSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, '').toUpperCase())
  .refine((value) => value === '' || /^SA\d{22}$/.test(value), {
    message: 'أدخل رقم آيبان سعودي صحيح يبدأ بـ SA',
  })

export const paymentSettingsSchema = z.object({
  tapEnabled: z.boolean(),
  tapMode: z.enum(['test', 'live']),
  bankTransferEnabled: z.boolean(),
  bankName: z.string().trim().max(80, 'اسم البنك طويل جدًا'),
  bankAccountName: z.string().trim().max(80, 'اسم صاحب الحساب طويل جدًا'),
  bankIban: ibanSchema,
  bankAccountNumber: z.string().trim().max(40, 'رقم الحساب طويل جدًا'),
  bankInstructions: z.string().trim().max(400, 'التعليمات طويلة جدًا'),
})

export const auctionSettingsSchema = z
  .object({
    depositMode: z.enum(['fixed', 'percent']),
    depositFixed: riyalField('العربون الثابت', 0),
    depositPercent: z
      .number({ invalid_type_error: 'النسبة يجب أن تكون رقمًا' })
      .min(0, 'النسبة لا تقلّ عن صفر')
      .max(50, 'نسبة تتجاوز 50٪ تمنع المزايدة بدل أن تضمن الجدّية'),
    depositMin: riyalField('أقل عربون', 0),
    depositMax: riyalField('أقصى عربون', 0),
    paymentWindowHours: z
      .number()
      .int()
      .min(1, 'أقل مهلة سداد ساعة واحدة')
      .max(720, 'أقصى مهلة سداد 30 يومًا'),
    forfeitPercent: z
      .number({ invalid_type_error: 'نسبة المصادرة يجب أن تكون رقمًا' })
      .min(0, 'النسبة لا تقلّ عن صفر')
      .max(100, 'لا تتجاوز المصادرة كامل العربون'),
    forfeitUndoWindowHours: z
      .number()
      .int()
      .min(0, 'المهلة لا تقلّ عن صفر')
      .max(168, 'أقصى مهلة تراجع أسبوع'),
    /*
     * مهلتا الضمان — تُضبطان من اللوحة كما تُضبط مهلة السداد.
     *
     * وكانتا ثابتتين في الكود، فيُقال للأدمن إنهما قابلتان للضبط وهو لا يجدهما.
     */
    escrowTransferWindowHours: z
      .number()
      .int()
      .min(1, 'أقل مهلة نقل ساعة واحدة')
      .max(720, 'أقصى مهلة نقل 30 يومًا'),
    escrowReviewWindowHours: z
      .number()
      .int()
      .min(1, 'أقل مهلة مراجعة ساعة واحدة')
      .max(720, 'أقصى مهلة مراجعة 30 يومًا'),
    extensionTriggerSeconds: z.number().int().min(0).max(3_600),
    extensionDurationSeconds: z.number().int().min(0).max(3_600),
    extensionResetsTimer: z.boolean(),
    allowCustomBid: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.depositMax > 0 && value.depositMin > value.depositMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['depositMin'],
        message: 'أقل عربون لا يمكن أن يتجاوز أقصاه',
      })
    }
    if (value.extensionTriggerSeconds > 0 && value.extensionDurationSeconds === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['extensionDurationSeconds'],
        message: 'حدّد مدّة التمديد أو عطّل التمديد بجعل نافذته صفرًا',
      })
    }
  })


// ---------------------------------------------------------- العمولة والضريبة

const commissionSideSchema = z.object({
  enabled: z.boolean(),
  mode: z.enum(['percent', 'fixed']),
  percent: z
    .number({ invalid_type_error: 'النسبة يجب أن تكون رقمًا' })
    .min(0, 'النسبة لا تقلّ عن صفر')
    .max(50, 'عمولة تتجاوز 50٪ تُخرج الصفقة عن معناها'),
  fixed: riyalField('العمولة الثابتة', 0),
  min: riyalField('أقل عمولة', 0),
  max: riyalField('أقصى عمولة', 0),
})

export const commissionSettingsSchema = z
  .object({
    seller: commissionSideSchema,
    buyer: commissionSideSchema,
    vatEnabled: z.boolean(),
    vatPercent: z
      .number({ invalid_type_error: 'نسبة الضريبة يجب أن تكون رقمًا' })
      .min(0, 'النسبة لا تقلّ عن صفر')
      .max(100, 'نسبة غير معقولة'),
  })
  .superRefine((value, ctx) => {
    for (const side of ['seller', 'buyer'] as const) {
      const entry = value[side]
      if (entry.max > 0 && entry.max < entry.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [side, 'max'],
          message: 'أقصى عمولة أقل من أدناها',
        })
      }
    }
  })

/**
 * بيانات المنشأة الضريبية.
 *
 * التحقّق يشتدّ **عند التفعيل** ويرتخي قبله: منشأة تملأ نموذجها على دفعات
 * لا تُمنع من الحفظ لأن حقلًا لم يُكتب بعد. أمّا وقد فُعّلت الفوترة، فرقمٌ
 * ضريبي مختلّ يُنتج فواتير مرفوضة — والمنع هنا أرحم من الرفض بعد الإصدار.
 */
export const taxSettingsSchema = z
  .object({
    enabled: z.boolean(),
    legalName: z.string().trim().max(120, 'الاسم طويل جدًا'),
    vatNumber: z.string().trim().max(15, 'الرقم الضريبي خمس عشرة خانة'),
    crNumber: z.string().trim().max(10, 'الرقم الموحّد عشر خانات'),
    street: z.string().trim().max(120),
    buildingNumber: z.string().trim().max(10),
    district: z.string().trim().max(120),
    city: z.string().trim().max(120),
    postalCode: z.string().trim().max(10),
    additionalNumber: z.string().trim().max(10),
    country: z.string().trim().max(60),
  })
  .superRefine((value, ctx) => {
    if (!value.enabled) return
    if (!value.legalName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['legalName'], message: 'اسم المنشأة مطلوب لتفعيل الفوترة' })
    }
    if (!isValidVatNumber(value.vatNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vatNumber'],
        message: 'رقم ضريبي غير صالح — خمس عشرة خانة تبدأ بـ3 وتنتهي بـ3',
      })
    }
    if (value.crNumber && !isValidCrNumber(value.crNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['crNumber'], message: 'الرقم الموحّد عشر خانات' })
    }
    if (!value.city) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['city'], message: 'المدينة مطلوبة في العنوان الوطني' })
    }
  })

