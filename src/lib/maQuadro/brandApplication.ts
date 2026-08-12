import type {
  MAQuadroProject,
  MAQuadroStoredBrandKit
} from '../../types/maQuadro'

import {
  getMAQuadroProject,
  saveMAQuadroProject
} from './db'

import {
  cloneMAQuadroValue,
  duplicateProject
} from './project'

type CanvasObject = Record<string, unknown>

type Rgb = {
  r: number
  g: number
  b: number
}

const HEX_COLOR = /^#([0-9a-f]{6})$/i

function parseHexColor(value: string): Rgb | null {
  const match = value.match(HEX_COLOR)

  if (!match) {
    return null
  }

  const hex = match[1]

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16)
  }
}

function relativeLuminance(rgb: Rgb) {
  const channel = (value: number) => {
    const normalized = value / 255

    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  )
}

function paletteEntries(kit: MAQuadroStoredBrandKit) {
  return kit.colors
    .map((color) => {
      const rgb = parseHexColor(color.value)

      return rgb
        ? {
            value: color.value.toUpperCase(),
            luminance: relativeLuminance(rgb)
          }
        : null
    })
    .filter(
      (
        item
      ): item is {
        value: string
        luminance: number
      } => Boolean(item)
    )
}

function mapColorToBrand(
  value: unknown,
  palette: ReturnType<typeof paletteEntries>
) {
  if (
    typeof value !== 'string' ||
    palette.length === 0
  ) {
    return value
  }

  const rgb = parseHexColor(value)

  if (!rgb) {
    return value
  }

  const luminance = relativeLuminance(rgb)

  let best = palette[0]
  let bestDistance = Math.abs(
    best.luminance - luminance
  )

  for (const candidate of palette.slice(1)) {
    const distance = Math.abs(
      candidate.luminance - luminance
    )

    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }

  return best.value
}

function isTextObject(object: CanvasObject) {
  const role = object.maRole
  const type =
    typeof object.type === 'string'
      ? object.type.toLocaleLowerCase('en-US')
      : ''

  return (
    role === 'text' ||
    type === 'textbox' ||
    type === 'i-text' ||
    type === 'text'
  )
}

function chooseFontFamily(
  object: CanvasObject,
  kit: MAQuadroStoredBrandKit
) {
  const primary =
    kit.fonts[0]?.family ||
    'Arial'

  const secondary =
    kit.fonts[1]?.family ||
    primary

  const name =
    typeof object.maName === 'string'
      ? object.maName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('pt-PT')
      : ''

  const fontSize =
    typeof object.fontSize === 'number'
      ? object.fontSize
      : 0

  const primaryName =
    /(titulo|subtitulo|headline|heading|etiqueta|numero|dado|website|acao|beneficio|chamada|cta)/

  const secondaryName =
    /(descricao|corpo|body|legenda|caption|rodape|texto|paragrafo)/

  if (primaryName.test(name)) {
    return primary
  }

  if (secondaryName.test(name)) {
    return secondary
  }

  return fontSize >= 48
    ? primary
    : secondary
}

function transformTextStyles(
  value: unknown,
  palette: ReturnType<typeof paletteEntries>,
  fontFamily: string
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) =>
      transformTextStyles(
        item,
        palette,
        fontFamily
      )
    )
  }

  if (
    !value ||
    typeof value !== 'object'
  ) {
    return value
  }

  const source = value as CanvasObject

  const next: CanvasObject = {
    ...source
  }

  if ('fill' in next) {
    next.fill = mapColorToBrand(
      next.fill,
      palette
    )
  }

  if ('stroke' in next) {
    next.stroke = mapColorToBrand(
      next.stroke,
      palette
    )
  }

  if ('fontFamily' in next) {
    next.fontFamily = fontFamily
  }

  for (const [key, child] of Object.entries(next)) {
    if (
      key !== 'fill' &&
      key !== 'stroke' &&
      key !== 'fontFamily' &&
      child &&
      typeof child === 'object'
    ) {
      next[key] = transformTextStyles(
        child,
        palette,
        fontFamily
      )
    }
  }

  return next
}

function transformCanvasObject(
  source: CanvasObject,
  kit: MAQuadroStoredBrandKit,
  palette: ReturnType<typeof paletteEntries>
): CanvasObject {
  const next: CanvasObject = {
    ...source
  }

  if ('fill' in next) {
    next.fill = mapColorToBrand(
      next.fill,
      palette
    )
  }

  if ('stroke' in next) {
    next.stroke = mapColorToBrand(
      next.stroke,
      palette
    )
  }

  if (
    next.shadow &&
    typeof next.shadow === 'object'
  ) {
    const shadow = {
      ...(next.shadow as CanvasObject)
    }

    if ('color' in shadow) {
      shadow.color = mapColorToBrand(
        shadow.color,
        palette
      )
    }

    next.shadow = shadow
  }

  if (isTextObject(next)) {
    const fontFamily = chooseFontFamily(
      next,
      kit
    )

    next.fontFamily = fontFamily

    if (
      next.styles &&
      typeof next.styles === 'object'
    ) {
      next.styles = transformTextStyles(
        next.styles,
        palette,
        fontFamily
      )
    }
  }

  if (Array.isArray(next.objects)) {
    next.objects = next.objects.map((child) =>
      child && typeof child === 'object'
        ? transformCanvasObject(
            child as CanvasObject,
            kit,
            palette
          )
        : child
    )
  }

  return next
}

export function createMAQuadroBrandedProject(
  source: MAQuadroProject,
  kit: MAQuadroStoredBrandKit
) {
  const palette = paletteEntries(kit)

  const copy = duplicateProject(
    cloneMAQuadroValue(source),
    `${source.name} — ${kit.name}`
  )

  return {
    ...copy,
    pages: copy.pages.map((page) => ({
      ...page,
      background: {
        ...page.background,
        color: mapColorToBrand(
          page.background.color,
          palette
        ) as string,
        gradientFrom: mapColorToBrand(
          page.background.gradientFrom,
          palette
        ) as string,
        gradientTo: mapColorToBrand(
          page.background.gradientTo,
          palette
        ) as string
      },
      canvasJson: {
        ...page.canvasJson,
        objects: Array.isArray(
          page.canvasJson.objects
        )
          ? page.canvasJson.objects.map((object) =>
              object && typeof object === 'object'
                ? transformCanvasObject(
                    object as CanvasObject,
                    kit,
                    palette
                  )
                : object
            )
          : []
      },
      thumbnail: undefined
    }))
  } satisfies MAQuadroProject
}

export async function createMAQuadroBrandedProjectCopy(
  projectId: string,
  kit: MAQuadroStoredBrandKit
) {
  const source = await getMAQuadroProject(
    projectId
  )

  if (!source) {
    throw new Error(
      'Projeto MA-Quadro não encontrado.'
    )
  }

  const branded = createMAQuadroBrandedProject(
    source,
    kit
  )

  await saveMAQuadroProject(branded)

  return branded
}

export const createMAQuadroBrandedProjectFromStoredProject =
  createMAQuadroBrandedProjectCopy
