import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ما يحتاجه الإقلاع يجب أن يكون **داخل الصورة**.
 *
 * وقد سقطت نشرةٌ حيّة على هذا: `server.mjs` يستورد `scripts/db-migrate.mjs`
 * ويقرأ `drizzle/*.sql` عند الإقلاع، ومرحلة التشغيل في `Dockerfile` لم تكن
 * تنسخ أيًّا منهما. والبناء نجح — لأنّ مرحلة البناء تنسخ كلّ شيء — ثمّ ماتت
 * الحاوية عند أوّل إقلاع، فردّ الوكيل «no available server» بلا أثرٍ في سجلّ
 * البناء يدلّ على السبب.
 *
 * فهذا الفحص يقرأ `Dockerfile` نفسه: كلُّ مسارٍ يُقرأ وقت التشغيل لا بدّ أن
 * تنسخه **مرحلةُ التشغيل** تحديدًا، لا مرحلةُ البناء.
 */

const root = join(__dirname, '..', '..')
const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8')

/** أسطر `COPY` الواقعة بعد آخر `FROM` — أي في مرحلة التشغيل وحدها. */
function runnerCopies(): string[] {
  const lines = dockerfile.split('\n')
  const lastFrom = lines.findLastIndex((line) => /^FROM\s/.test(line))
  expect(lastFrom).toBeGreaterThan(-1)
  return lines.slice(lastFrom).filter((line) => /^COPY\s/.test(line))
}

describe('صورة التشغيل', () => {
  it('تنسخ كلّ ما يُقرأ عند الإقلاع', () => {
    const copies = runnerCopies().join('\n')
    // `server.mjs` نفسه، وما يستورده، وما يقرأه من قرص
    for (const needed of ['server.mjs', 'next.config.mjs', 'package.json', 'scripts', 'drizzle', '.next', 'public', 'node_modules']) {
      expect(copies, `مرحلة التشغيل لا تنسخ «${needed}»`).toContain(needed)
    }
  })

  it('تحرس ما يستورده `server.mjs` وقت التشغيل', () => {
    const server = readFileSync(join(root, 'server.mjs'), 'utf8')
    const dynamic = [...server.matchAll(/await import\('\.\/([^'/]+)\//g)].map((m) => m[1])
    expect(dynamic.length).toBeGreaterThan(0)

    const copies = runnerCopies().join('\n')
    for (const dir of new Set(dynamic)) {
      expect(copies, `«${dir}» يُستورد عند الإقلاع ولا يُنسخ إلى الصورة`).toContain(dir)
    }
  })

  it('تحرس مجلّد الترحيلات الذي يقرأه `db-migrate`', () => {
    const migrator = readFileSync(join(root, 'scripts', 'db-migrate.mjs'), 'utf8')
    const fallback = migrator.match(/dir\s*=\s*'([^']+)'/)?.[1]
    expect(fallback).toBeTruthy()
    expect(runnerCopies().join('\n')).toContain(fallback!)
  })
})
