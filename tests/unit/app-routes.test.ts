import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * **كلُّ نداءٍ في التطبيق يقابله مسارٌ يعرف فعلَه.**
 *
 * والويبُ يقرأ أكثرَ بياناته في الخادم قبل أن تُصيَّر الصفحة، فلا يسأل
 * مسارًا عن نفسه — فنشأت مساراتٌ تعرف `PATCH` وحده أو `POST` وحده. ثمّ
 * جاء التطبيقُ الأصيل عميلًا خارجيًّا يطلب كلَّ شيء بالشبكة، فكان يصيبه
 * ‎٤٠٥‎: ردٌّ ليس JSON، فتعرض الشاشةُ «تعذّر إتمام الطلب» — وهي رسالةُ
 * ما لا يُفهَم، لا رسالةُ ما لا يوجد.
 *
 * وقد وقع ذلك في `GET api/account/profile` فسقطت شاشةُ «حسابي» كلُّها،
 * وفي `GET api/checkout/{id}` فلم يكن للسداد مسارُ قراءة، وفي
 * `GET api/orders/{id}`. **وهذا الفحصُ يقرأ نداءات التطبيق من مصدره**
 * ويقابلها بملفّات المسارات — فما نقص ظهر هنا لا في جهاز مستخدم.
 */
const API_SOURCE = 'mobile/lib/api/mazad_api.dart'
const ROUTES = 'src/app/api'

/** `_client.get('/api/...')` — ولو تفرّق النداءُ على أسطر. */
function appCalls(): { method: string; path: string }[] {
  const src = readFileSync(API_SOURCE, 'utf8')
  const found = [...src.matchAll(/_client\.(get|post|patch|delete)\(\s*'([^']+)'/g)]
  return found.map((m) => ({ method: m[1].toUpperCase(), path: m[2] }))
}

/** يحوّل `/api/orders/$id/messages` إلى ملفّ مساره، أو `null` إن لم يوجد. */
function routeFile(path: string): string | null {
  const segments = path.replace(/^\//, '').split('/').slice(1)
  let dir = ROUTES
  for (const segment of segments) {
    if (segment.startsWith('$')) {
      // خانةٌ متغيّرة: يقابلها مجلّدٌ بين قوسين مربّعين
      const dynamic = existsSync(dir)
        ? readdirSync(dir).find((name) => name.startsWith('['))
        : undefined
      if (!dynamic) return null
      dir = join(dir, dynamic)
    } else {
      dir = join(dir, segment)
      if (!existsSync(dir) || !statSync(dir).isDirectory()) return null
    }
  }
  const file = join(dir, 'route.ts')
  return existsSync(file) ? file : null
}

describe('نداءاتُ التطبيق ومساراتُ الخادم', () => {
  const calls = appCalls()

  it('تُقرأ النداءاتُ من مصدر التطبيق', () => {
    // فحصٌ لا يقرأ شيئًا يمرّ دائمًا
    expect(calls.length).toBeGreaterThan(15)
  })

  it.each(calls.map((c) => [c.method, c.path, c] as const))(
    '%s %s له مسارٌ يعرفه',
    (method, path, call) => {
      const file = routeFile(call.path)
      expect(file, `لا ملفَّ مسارٍ لـ ${method} ${path}`).not.toBeNull()

      const body = readFileSync(file!, 'utf8')
      const handler = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`)
      expect(
        handler.test(body),
        `${file} لا يُصدِّر ${method} — وردُّه على التطبيق ٤٠٥`,
      ).toBe(true)
    },
  )
})
