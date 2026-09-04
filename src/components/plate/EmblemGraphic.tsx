import { EMBLEM_ART, isImageArt, STRIP_SYMBOL, type EmblemArt } from './emblem-art'

/**
 * معرّف ثابت مشتقّ من محتوى الشعار **ومن نطاق لوحته**.
 *
 * عدّاد متزايد كان يُنتج معرّفات مختلفة بين الخادم والعميل فيقع عدم تطابق في
 * الترطيب — والاشتقاق من المحتوى يمنع ذلك.
 *
 * وكان الاشتقاق من المحتوى وحده، فتتشارك كل اللوحات تعريفًا واحدًا. وقيل
 * «بلا ضرر» — والضرر ظهر: في جدولٍ يُخفي صفوفه بـ`display:none` يقع **أوّل**
 * تعريف في صفٍّ مخفيّ، فلا يحلّه المتصفّح وتُطلى اللوحات الظاهرة سوداء. فصار
 * لكل لوحة تعريفها.
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

    /*
     * الصورة سوداء على أبيض، فتُقلَب إضاءتها إلى شفافية بمرشِّح SVG.
     *
     * وكان قناعًا يُعكَس محتواه بـ`filter: invert(1)` — وهو مرشِّح **CSS** على
     * عنصر داخل `<mask>`، لا يطبّقه WebKit. فيبقى القناع بصورته الأصلية،
     * والأبيض في القناع يعني «ظاهر»: فيُطلى مربّع الصورة كلّه ويُقتطع منه
     * الشعار — مربّعٌ أسود خلف النخلة والسيفين في كل لوحة على iOS.
     *
     * وبدائل الحيلة كلّها هنا من أوّليّات SVG نفسها، مدعومةٌ منذ SVG 1.1:
     *   `feColorMatrix` يجعل الألفا = ١ − الأحمر، فالأبيض يختفي والأسود يظهر
     *   وما بينهما يتدرّج — فتبقى الحواف ناعمة بلا تسنّن.
     *   ثمّ `feFlood` + `feComposite` يصبغان ما بقي باللون المطلوب، وهما
     *   يقبلان أي صيغة لون فلا يحتاج التلوين تفكيك ستّ عشرة.
     *
     * وحدود المرشِّح تُضبَط على حدود الصورة بالضبط (`userSpaceOnUse`) لا على
     * الافتراضي الذي يزيد ١٠٪ في كل جهة: خارج الصورة بكسلاتٌ شفّافة أحمرها
     * صفر، فتُعطيها المعادلة ألفا = ١ — أي يعود المربّع الأسود من حيث فُرَّ
     * منه، إطارًا حول الشعار هذه المرّة.
     */
    return (
      <>
        <defs>
          <filter
            id={id}
            filterUnits="userSpaceOnUse"
            x={imgX}
            y={imgY}
            width={imgWidth}
            height={imgHeight}
            /* الافتراضي `linearRGB` يلوي تدرّج الألفا ويختلف بين المحرّكات */
            colorInterpolationFilters="sRGB"
          >
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1 0 0 0 1"
              result="alpha"
            />
            <feFlood floodColor={tint} result="ink" />
            <feComposite in="ink" in2="alpha" operator="in" />
          </filter>
        </defs>
        <image
          href={art.href}
          x={imgX}
          y={imgY}
          width={imgWidth}
          height={imgHeight}
          preserveAspectRatio="none"
          filter={`url(#${id})`}
        />
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
