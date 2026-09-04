import { EMBLEM_ART, isImageArt, STRIP_SYMBOL, type EmblemArt } from './emblem-art'

/**
 * معرّف ثابت مشتقّ من محتوى الشعار **ومن نطاق لوحته**.
 *
 * عدّاد متزايد كان يُنتج معرّفات مختلفة بين الخادم والعميل فيقع عدم تطابق في
 * الترطيب — والاشتقاق من المحتوى يمنع ذلك.
 *
 * وكان الاشتقاق من المحتوى وحده، فتتشارك كل اللوحات قناعًا واحدًا. وقيل
 * «بلا ضرر» — والضرر ظهر: في جدولٍ يُخفي صفوفه بـ`display:none` يقع **أوّل**
 * تعريف للقناع في صفٍّ مخفيّ، فلا يحلّه المتصفّح وتُطلى اللوحات الظاهرة
 * سوداء. فصار لكل لوحة قناعها.
 */
function stableId(parts: (string | number)[]): string {
  const source = parts.join('|')
  let hash = 5381
  for (let i = 0; i < source.length; i++) hash = ((hash << 5) + hash + source.charCodeAt(i)) >>> 0
  return `emb${hash.toString(36)}`
}

/**
 * يرسم شعارًا داخل مجموعة SVG.
 *
 * الشعارات الصورية تمرّ عبر `feColorMatrix` يحوّل الإضاءة إلى شفافية:
 * البياض يختفي والسواد يأخذ اللون المطلوب — فتظهر النخلة والسيفان بحوافّ
 * نظيفة فوق أي خلفية دون مربّع أبيض.
 */
export function EmblemShapes({
  art,
  monochrome,
  /** ارتفاع صندوق الرسم داخل نظام إحداثيات 100×100 */
  box = 100,
  /** نطاق اللوحة الحاضنة — يجعل القناع خاصًّا بها فلا يُشارك غيرها */
  scope = '',
}: {
  art: EmblemArt
  monochrome?: string
  box?: number
  scope?: string
}) {
  if (isImageArt(art)) {
    const tint = monochrome ?? art.tint
    const id = stableId([art.href, tint, box, scope])
    const { content, imageRatio } = art

    // نكبّر الصورة حتى يملأ صندوق الرسم المساحة المطلوبة، ثم نزيحها
    const imgHeight = box / content.height
    const imgWidth = imgHeight * imageRatio
    const imgX = box / 2 - imgWidth * (content.x + content.width / 2)
    const imgY = -content.y * imgHeight

    // الصورة سوداء على أبيض: نعكسها لتصير قناعًا (الرسم أبيض = ظاهر،
    // الخلفية سوداء = مخفيّة)، ثم نملأ القناع باللون المطلوب.
    return (
      <>
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse" x={imgX} y={imgY} width={imgWidth} height={imgHeight}>
            <image
              href={art.href}
              x={imgX}
              y={imgY}
              width={imgWidth}
              height={imgHeight}
              preserveAspectRatio="none"
              style={{ filter: 'invert(1)' }}
            />
          </mask>
        </defs>
        <rect x={imgX} y={imgY} width={imgWidth} height={imgHeight} fill={tint} mask={`url(#${id})`} />
      </>
    )
  }

  return (
    <>
      {art.groups.map((group, groupIndex) => (
        <g key={groupIndex} transform={group.transform}>
          {group.shapes.map((shape, shapeIndex) => {
            const fill = monochrome ?? art.colors[shape.role]
            if (shape.kind === 'text') {
              return (
                <text
                  key={shapeIndex}
                  x={shape.x}
                  y={shape.y}
                  fill={fill}
                  fontSize={shape.size}
                  fontWeight={700}
                  textAnchor="middle"
                  letterSpacing={shape.letterSpacing ?? 0}
                >
                  {shape.text}
                </text>
              )
            }
            return <path key={shapeIndex} d={shape.d} fill={fill} opacity={shape.opacity} />
          })}
        </g>
      ))}
    </>
  )
}

/** شعار مستقل بحجمه الخاص — يُستخدم في المصغّرات وقوائم الاختيار. */
export function EmblemIcon({
  emblem,
  className,
  monochrome,
}: {
  emblem: string
  className?: string
  monochrome?: string
}) {
  const art = EMBLEM_ART[emblem]
  if (!art) return null
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={art.title}>
      <EmblemShapes art={art} monochrome={monochrome} />
    </svg>
  )
}

export { EMBLEM_ART, STRIP_SYMBOL }
