/**
 * عدُّ شهادات التطوير عند أبل — **إنذارٌ لا حذف**.
 *
 * **ولمَ تتراكم؟** خادمُ البناء مؤقّت: حلقةُ مفاتيحه فارغةٌ في كلّ مرّة،
 * فلا يجد Xcode شهادةً فيُنشئ جديدة. وتتراكم حتّى يمتلئ سقفُ الحساب، فيسقط
 * البناءُ بـ«اختر شهادةً لتُبطلها» — خطأٌ يوقف العملَ ولا علاقةَ له بالكود،
 * ولا يُرفع إلّا بفتح موقع أبل باليد. وقد وقع، وكلّف ساعةً وسبعَ محاولات.
 *
 * **ولا تُحذف من هنا.** كُتبت أوّلًا لتُقلّم آليًّا، ثمّ رُوجعت: حذفُ شهادةٍ
 * عند أبل لا رجعةَ فيه، ويقع على حسابٍ فيه تطبيقاتٌ أخرى، بلا إنسانٍ يراه.
 * وخللٌ في مرشّحٍ سطرٍ واحد يُبطل شهادةَ توزيعٍ فيُعطَّل الإصدار كلُّه.
 *
 * فيُقاس ويُنذَر، ويبقى الحذفُ قرارًا يُتَّخذ عند الإنذار لا مفاجأةً عند
 * الإخفاق. والفرقُ بينهما أنّ الأوّل يقع في وقته والثاني يقع في أسوأ وقت.
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

const { KEY_ID, ISSUER_ID, KEY_PATH } = process.env

/** حدُّ الإنذار — دون سقف أبل بهامشٍ يكفي بناءاتٍ قادمة. */
const WARN_AT = Number(process.env.WARN_AT ?? 8)

/** رمزُ وصولٍ لأبل — موقَّعٌ ES256 وصالحٌ عشرين دقيقة. */
function token(p8) {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const signed =
    `${b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' })}.` +
    `${b64({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`

  /*
   * والتوقيعُ مسطَّحٌ (r‖s) لا DER.
   *
   * فـ`node:crypto` يُخرجه DER وأبل تنتظر ‎٦٤‎ بايتًا مسطّحة — ورمزٌ بتوقيعٍ
   * DER يُردّ ‎٤٠١‎ بلا بيانِ سبب، فيُظنّ المفتاحُ خاطئًا وهو سليم.
   */
  const sig = createSign('SHA256')
    .update(signed)
    .end()
    .sign({ key: p8, dsaEncoding: 'ieee-p1363' })
  return `${signed}.${sig.toString('base64url')}`
}

async function main() {
  if (!KEY_ID || !ISSUER_ID || !KEY_PATH) {
    console.log('::notice::لا مفتاح — لا يُقاس عددُ الشهادات')
    return
  }

  const res = await fetch(
    'https://api.appstoreconnect.apple.com/v1/certificates?limit=200',
    { headers: { authorization: `Bearer ${token(readFileSync(KEY_PATH, 'utf8'))}` } },
  )
  if (!res.ok) throw new Error(`رُدّت ${res.status}`)

  const { data } = await res.json()
  const dev = data.filter((c) => c.attributes.certificateType === 'DEVELOPMENT')
  const dist = data.length - dev.length

  console.log(`شهاداتُ التطوير: ${dev.length} · التوزيع: ${dist}`)

  if (dev.length >= WARN_AT) {
    console.log(
      `::warning::شهاداتُ التطوير ${dev.length} — السقفُ قريب. ` +
        'احذف القديمةَ من developer.apple.com/account/resources/certificates ' +
        'قبل أن يسقط بناءٌ بـ«اختر شهادةً لتُبطلها». ' +
        'وشهاداتُ **التوزيع** لا تُحذف.',
    )
  }
}

main().catch((error) => {
  console.log(`::warning::تعذّر قياسُ الشهادات: ${error.message}`)
})
