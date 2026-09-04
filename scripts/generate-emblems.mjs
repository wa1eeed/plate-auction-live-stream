/**
 * يولّد ملفات SVG المستقلة في /public/plate-emblems من مصدر الرسم الوحيد
 * src/components/plate/emblem-art.ts — شغّله بعد أي تعديل على الرسومات:
 *   pnpm exec tsx scripts/generate-emblems.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EMBLEM_ART } from '../src/components/plate/emblem-art.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/plate-emblems')
mkdirSync(outDir, { recursive: true })

const escape = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

for (const [key, art] of Object.entries(EMBLEM_ART)) {
  if (art.kind === 'image') {
    console.log(`· ${key} — شعار صوري، مصدره ${art.href}`)
    continue
  }
  const body = art.groups
    .map((group) => {
      const shapes = group.shapes
        .map((shape) => {
          const fill = art.colors[shape.role]
          if (shape.kind === 'text') {
            return `<text x="${shape.x}" y="${shape.y}" fill="${fill}" font-size="${shape.size}" font-family=\"Arial, sans-serif\" font-weight="700" text-anchor="middle" letter-spacing="${shape.letterSpacing ?? 0}">${escape(shape.text)}</text>`
          }
          const opacity = shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : ''
          return `<path d="${shape.d}" fill="${fill}"${opacity}/>`
        })
        .join('')
      return group.transform ? `<g transform="${group.transform}">${shapes}</g>` : shapes
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}" role="img" aria-label="${escape(art.title)}"><title>${escape(art.title)}</title>${body}</svg>\n`
  writeFileSync(resolve(outDir, `${key}.svg`), svg, 'utf8')
  console.log(`✓ ${key}.svg`)
}
