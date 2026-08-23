import type {
  MAQuadroCanvasJson,
  MAQuadroPage,
  MAQuadroProject
} from '../../types/maQuadro'

type CanvasObject = Record<string, unknown>

function numberValue(
  value: unknown,
  fallback = 0
) {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : fallback
}

function stringValue(
  value: unknown,
  fallback = ''
) {
  return typeof value === 'string'
    ? value
    : fallback
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function opacityAttribute(
  object: CanvasObject
) {
  const opacity = numberValue(
    object.opacity,
    1
  )

  return opacity < 1
    ? ` opacity="${Math.max(
        0,
        Math.min(
          1,
          opacity
        )
      )}"`
    : ''
}

function renderRect(
  object: CanvasObject
) {
  const left =
    numberValue(
      object.left
    )

  const top =
    numberValue(
      object.top
    )

  const width =
    Math.max(
      0,
      numberValue(
        object.width
      )
    )

  const height =
    Math.max(
      0,
      numberValue(
        object.height
      )
    )

  const fill =
    stringValue(
      object.fill,
      'transparent'
    )

  const stroke =
    stringValue(
      object.stroke,
      'none'
    )

  const strokeWidth =
    Math.max(
      0,
      numberValue(
        object.strokeWidth
      )
    )

  const rx =
    Math.max(
      0,
      numberValue(
        object.rx
      )
    )

  const ry =
    Math.max(
      0,
      numberValue(
        object.ry,
        rx
      )
    )

  return `<rect x="${left}" y="${top}" width="${width}" height="${height}" rx="${rx}" ry="${ry}" fill="${escapeXml(
    fill
  )}" stroke="${escapeXml(
    stroke
  )}" stroke-width="${strokeWidth}"${opacityAttribute(
    object
  )}/>`
}

function renderCircle(
  object: CanvasObject
) {
  const left =
    numberValue(
      object.left
    )

  const top =
    numberValue(
      object.top
    )

  const radius =
    Math.max(
      0,
      numberValue(
        object.radius
      )
    )

  const fill =
    stringValue(
      object.fill,
      'transparent'
    )

  const stroke =
    stringValue(
      object.stroke,
      'none'
    )

  const strokeWidth =
    Math.max(
      0,
      numberValue(
        object.strokeWidth
      )
    )

  return `<circle cx="${
    left + radius
  }" cy="${
    top + radius
  }" r="${radius}" fill="${escapeXml(
    fill
  )}" stroke="${escapeXml(
    stroke
  )}" stroke-width="${strokeWidth}"${opacityAttribute(
    object
  )}/>`
}

function renderText(
  object: CanvasObject
) {
  const left =
    numberValue(
      object.left
    )

  const top =
    numberValue(
      object.top
    )

  const width =
    Math.max(
      1,
      numberValue(
        object.width,
        1
      )
    )

  const fontSize =
    Math.max(
      1,
      numberValue(
        object.fontSize,
        24
      )
    )

  const lineHeight =
    Math.max(
      0.5,
      numberValue(
        object.lineHeight,
        1.05
      )
    )

  const fill =
    stringValue(
      object.fill,
      '#0F172A'
    )

  const fontFamily =
    stringValue(
      object.fontFamily,
      'Arial'
    )

  const fontWeight =
    typeof object.fontWeight ===
    'number'
      ? String(
          object.fontWeight
        )
      : stringValue(
          object.fontWeight,
          '400'
        )

  const fontStyle =
    stringValue(
      object.fontStyle,
      'normal'
    )

  const textAlign =
    stringValue(
      object.textAlign,
      'left'
    )

  const text =
    stringValue(
      object.text
    )

  const lines =
    text.split(
      '\n'
    )

  const anchor =
    textAlign ===
    'center'
      ? 'middle'
      : textAlign ===
          'right'
        ? 'end'
        : 'start'

  const x =
    textAlign ===
    'center'
      ? left +
        width / 2
      : textAlign ===
          'right'
        ? left +
          width
        : left

  const tspans =
    lines
      .map(
        (
          line,
          index
        ) =>
          `<tspan x="${x}" dy="${
            index === 0
              ? 0
              : fontSize *
                lineHeight
          }">${escapeXml(
            line
          )}</tspan>`
      )
      .join('')

  return `<text x="${x}" y="${
    top + fontSize
  }" fill="${escapeXml(
    fill
  )}" font-family="${escapeXml(
    fontFamily
  )}" font-size="${fontSize}" font-weight="${escapeXml(
    fontWeight
  )}" font-style="${escapeXml(
    fontStyle
  )}" text-anchor="${anchor}"${opacityAttribute(
    object
  )}>${tspans}</text>`
}

function renderCanvasObject(
  object: CanvasObject
) {
  switch (
    stringValue(
      object.type
    )
  ) {
    case 'Rect':
      return renderRect(
        object
      )

    case 'Circle':
      return renderCircle(
        object
      )

    case 'Textbox':
    case 'Text':
    case 'IText':
      return renderText(
        object
      )

    default:
      return ''
  }
}

function getCanvasObjects(
  canvasJson:
    MAQuadroCanvasJson
) {
  return Array.isArray(
    canvasJson.objects
  )
    ? canvasJson.objects.filter(
        (
          value
        ): value is CanvasObject =>
          Boolean(
            value
          ) &&
          typeof value ===
            'object'
      )
    : []
}

export function createMAQuadroPagePreview(
  page: MAQuadroPage
) {
  const objects =
    getCanvasObjects(
      page.canvasJson
    )

  const background =
    page.background.type ===
    'transparent'
      ? '#FFFFFF'
      : page.background
          .color ||
        '#FFFFFF'

  const rendered =
    objects
      .map(
        renderCanvasObject
      )
      .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `width="${page.width}" height="${page.height}" ` +
    `viewBox="0 0 ${page.width} ${page.height}">` +
    `<rect width="100%" height="100%" fill="${escapeXml(
      background
    )}"/>` +
    rendered +
    `</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    svg
  )}`
}

export function createMAQuadroProjectPreview(
  project:
    MAQuadroProject
) {
  const firstPage =
    project.pages[0]

  return firstPage
    ? createMAQuadroPagePreview(
        firstPage
      )
    : ''
}
