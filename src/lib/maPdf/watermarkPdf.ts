import {
  degrees,
  PDFDocument,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage
} from 'pdf-lib'

import type {
  ProgressCallback,
  ResultData,
  SelectedPdf
} from '../../types/maPdf'

import {
  bytesToArrayBuffer,
  sanitizeFileName
} from './fileUtils'

export type WatermarkCoordinates = {
  xRatio: number
  yRatio: number
}

export type WatermarkPosition =
  | 'center'
  | 'top'
  | 'bottom'
  | WatermarkCoordinates

export type WatermarkPageSelection =
  | 'all'
  | 'last'
  | number

export type WatermarkOptions = {
  text: string
  page?: WatermarkPageSelection
  position?: WatermarkPosition
  fontSize?: number
  opacity?: number
  rotation?: number
  color?: string
}

const DEFAULT_FONT_SIZE = 48
const DEFAULT_OPACITY = 0.18
const DEFAULT_ROTATION = 45
const DEFAULT_COLOR = '#737373'

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 180

const MIN_OPACITY = 0.05
const MAX_OPACITY = 1

const MIN_ROTATION = -180
const MAX_ROTATION = 180

const PAGE_MARGIN = 36
const MAX_TEXT_LENGTH = 120

function clamp(
  value: number,
  minimum: number,
  maximum: number
) {
  return Math.min(
    Math.max(value, minimum),
    maximum
  )
}

function normalizeWatermarkText(
  value: string
) {
  return value
    .replace(
      /[\u0000-\u001f\u007f]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

function normalizeHexColor(
  value: string | undefined,
  fallback: string
) {
  const cleaned = (
    value || fallback
  )
    .trim()
    .replace(/^#/, '')

  if (
    /^[0-9a-f]{3}$/i.test(
      cleaned
    )
  ) {
    return cleaned
      .split('')
      .map(
        (character) =>
          `${character}${character}`
      )
      .join('')
      .toUpperCase()
  }

  if (
    /^[0-9a-f]{6}$/i.test(
      cleaned
    )
  ) {
    return cleaned.toUpperCase()
  }

  return fallback
    .replace(/^#/, '')
    .toUpperCase()
}

function parseHexColor(
  value: string | undefined,
  fallback: string
) {
  const hex =
    normalizeHexColor(
      value,
      fallback
    )

  return rgb(
    Number.parseInt(
      hex.slice(0, 2),
      16
    ) / 255,
    Number.parseInt(
      hex.slice(2, 4),
      16
    ) / 255,
    Number.parseInt(
      hex.slice(4, 6),
      16
    ) / 255
  )
}

function isCustomPosition(
  position: WatermarkPosition
): position is WatermarkCoordinates {
  return typeof position === 'object'
}

function resolvePageIndexes(
  pageSelection: WatermarkPageSelection,
  pageCount: number
) {
  if (pageSelection === 'all') {
    return Array.from(
      {
        length: pageCount
      },
      (_, index) => index
    )
  }

  if (pageSelection === 'last') {
    return [
      pageCount - 1
    ]
  }

  if (
    !Number.isInteger(
      pageSelection
    ) ||
    pageSelection < 1 ||
    pageSelection > pageCount
  ) {
    throw new Error(
      `A página indicada não existe. O documento tem ${pageCount} página${
        pageCount === 1
          ? ''
          : 's'
      }.`
    )
  }

  return [
    pageSelection - 1
  ]
}

function getRequestedCenter(
  pageWidth: number,
  pageHeight: number,
  position: WatermarkPosition,
  fontSize: number
) {
  if (
    isCustomPosition(
      position
    )
  ) {
    return {
      x:
        clamp(
          position.xRatio,
          0,
          1
        ) *
        pageWidth,

      y:
        pageHeight -
        clamp(
          position.yRatio,
          0,
          1
        ) *
        pageHeight
    }
  }

  const x =
    pageWidth / 2

  if (position === 'top') {
    return {
      x,
      y:
        pageHeight -
        PAGE_MARGIN -
        fontSize
    }
  }

  if (position === 'bottom') {
    return {
      x,
      y:
        PAGE_MARGIN +
        fontSize
    }
  }

  return {
    x,
    y:
      pageHeight / 2
  }
}

function getRotatedBounds(
  textWidth: number,
  textHeight: number,
  rotation: number
) {
  const radians =
    (
      rotation *
      Math.PI
    ) / 180

  const cosine =
    Math.abs(
      Math.cos(radians)
    )

  const sine =
    Math.abs(
      Math.sin(radians)
    )

  return {
    width:
      textWidth *
        cosine +
      textHeight *
        sine,

    height:
      textWidth *
        sine +
      textHeight *
        cosine
  }
}

function getFittedFontSize(
  page: PDFPage,
  font: PDFFont,
  text: string,
  requestedFontSize: number,
  position: WatermarkPosition,
  rotation: number
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const requestedCenter =
    getRequestedCenter(
      pageWidth,
      pageHeight,
      position,
      requestedFontSize
    )

  const requestedTextWidth =
    font.widthOfTextAtSize(
      text,
      requestedFontSize
    )

  const requestedBounds =
    getRotatedBounds(
      requestedTextWidth,
      requestedFontSize,
      rotation
    )

  const availableWidth =
    Math.max(
      2 *
        Math.min(
          requestedCenter.x,
          pageWidth -
            requestedCenter.x
        ),
      MIN_FONT_SIZE
    )

  const availableHeight =
    Math.max(
      2 *
        Math.min(
          requestedCenter.y,
          pageHeight -
            requestedCenter.y
        ),
      MIN_FONT_SIZE
    )

  const scale =
    Math.min(
      1,

      availableWidth /
        Math.max(
          requestedBounds.width,
          1
        ),

      availableHeight /
        Math.max(
          requestedBounds.height,
          1
        )
    )

  return clamp(
    requestedFontSize *
      scale,
    MIN_FONT_SIZE,
    requestedFontSize
  )
}

function getTextOrigin(
  page: PDFPage,
  font: PDFFont,
  text: string,
  fontSize: number,
  position: WatermarkPosition,
  rotation: number
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const textWidth =
    font.widthOfTextAtSize(
      text,
      fontSize
    )

  const rotationRadians =
    (
      rotation *
      Math.PI
    ) / 180

  const cosine =
    Math.cos(
      rotationRadians
    )

  const sine =
    Math.sin(
      rotationRadians
    )

  const requestedCenter =
    getRequestedCenter(
      pageWidth,
      pageHeight,
      position,
      fontSize
    )

  const bounds =
    getRotatedBounds(
      textWidth,
      fontSize,
      rotation
    )

  const halfWidth =
    Math.min(
      bounds.width / 2,
      pageWidth / 2
    )

  const halfHeight =
    Math.min(
      bounds.height / 2,
      pageHeight / 2
    )

  const centerX =
    clamp(
      requestedCenter.x,
      halfWidth,
      pageWidth -
        halfWidth
    )

  const centerY =
    clamp(
      requestedCenter.y,
      halfHeight,
      pageHeight -
        halfHeight
    )

  return {
    x:
      centerX -
      (
        textWidth *
        cosine
      ) / 2 +
      (
        fontSize *
        sine
      ) / 2,

    y:
      centerY -
      (
        textWidth *
        sine
      ) / 2 -
      (
        fontSize *
        cosine
      ) / 2
  }
}

function validateWatermarkText(
  font: PDFFont,
  text: string
) {
  try {
    font.widthOfTextAtSize(
      text,
      DEFAULT_FONT_SIZE
    )
  } catch {
    throw new Error(
      'A marca de água contém caracteres não suportados. Utilize letras, números e pontuação simples.'
    )
  }
}

export async function addWatermarkToPdf(
  selected:
    | SelectedPdf
    | undefined,

  options:
    WatermarkOptions,

  onProgress:
    ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para adicionar a marca de água.'
    )
  }

  const text =
    normalizeWatermarkText(
      options.text
    )

  if (!text) {
    throw new Error(
      'Escreva o texto que pretende utilizar como marca de água.'
    )
  }

  const pageSelection =
    options.page ??
    'all'

  const position =
    options.position ??
    'center'

  const requestedFontSize =
    clamp(
      Number.isFinite(
        options.fontSize
      )
        ? Number(
            options.fontSize
          )
        : DEFAULT_FONT_SIZE,

      MIN_FONT_SIZE,
      MAX_FONT_SIZE
    )

  const opacity =
    clamp(
      Number.isFinite(
        options.opacity
      )
        ? Number(
            options.opacity
          )
        : DEFAULT_OPACITY,

      MIN_OPACITY,
      MAX_OPACITY
    )

  const defaultRotation =
    position === 'center'
      ? DEFAULT_ROTATION
      : 0

  const rotation =
    clamp(
      Number.isFinite(
        options.rotation
      )
        ? Number(
            options.rotation
          )
        : defaultRotation,

      MIN_ROTATION,
      MAX_ROTATION
    )

  onProgress(
    'A analisar o documento PDF...'
  )

  const sourceBytes =
    await selected.file.arrayBuffer()

  const pdfDocument =
    await PDFDocument.load(
      sourceBytes,
      {
        updateMetadata: false
      }
    )

  const pages =
    pdfDocument.getPages()

  if (pages.length === 0) {
    throw new Error(
      'O documento não contém páginas.'
    )
  }

  const pageIndexes =
    resolvePageIndexes(
      pageSelection,
      pages.length
    )

  onProgress(
    'A preparar a marca de água...'
  )

  const font =
    await pdfDocument.embedFont(
      StandardFonts.HelveticaBold
    )

  validateWatermarkText(
    font,
    text
  )

  for (
    let index = 0;
    index <
    pageIndexes.length;
    index += 1
  ) {
    const pageIndex =
      pageIndexes[index]

    const page =
      pages[pageIndex]

    onProgress(
      `A aplicar marca de água na página ${
        pageIndex + 1
      } de ${
        pages.length
      }...`
    )

    const fontSize =
      getFittedFontSize(
        page,
        font,
        text,
        requestedFontSize,
        position,
        rotation
      )

    const origin =
      getTextOrigin(
        page,
        font,
        text,
        fontSize,
        position,
        rotation
      )

    page.drawText(
      text,
      {
        x: origin.x,
        y: origin.y,
        size: fontSize,
        font,

        color:
          parseHexColor(
            options.color,
            DEFAULT_COLOR
          ),

        opacity,

        rotate:
          degrees(
            rotation
          )
      }
    )
  }

  onProgress(
    'A criar o documento PDF final...'
  )

  pdfDocument.setCreator(
    'MA PDF - MA-Code.pt'
  )

  pdfDocument.setProducer(
    'MA PDF - MA-Code.pt'
  )

  const outputBytes =
    await pdfDocument.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 20
    })

  const blob =
    new Blob(
      [
        bytesToArrayBuffer(
          outputBytes
        )
      ],
      {
        type:
          'application/pdf'
      }
    )

  const baseName =
    sanitizeFileName(
      selected.file.name
    )

  return {
    fileName:
      `${baseName}-marca-de-agua.pdf`,

    blob,

    originalSize:
      selected.file.size,

    finalSize:
      blob.size,

    message:
      pageIndexes.length ===
      1
        ? `A marca de água foi aplicada à página ${
            pageIndexes[0] + 1
          } do documento.`

        : `A marca de água foi aplicada às ${pageIndexes.length} páginas do documento.`
  }
}
