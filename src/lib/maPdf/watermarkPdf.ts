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

export type WatermarkPosition =
  | 'center'
  | 'top'
  | 'bottom'

export type WatermarkOptions = {
  text: string
  position?: WatermarkPosition
  fontSize?: number
  opacity?: number
  rotation?: number
}

const DEFAULT_FONT_SIZE = 48
const DEFAULT_OPACITY = 0.18
const DEFAULT_ROTATION = 45

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

function normalizeWatermarkText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

function getPageCenterY(
  pageHeight: number,
  position: WatermarkPosition,
  fontSize: number
) {
  if (position === 'top') {
    return pageHeight - PAGE_MARGIN - fontSize
  }

  if (position === 'bottom') {
    return PAGE_MARGIN + fontSize
  }

  return pageHeight / 2
}

function getFittedFontSize(
  page: PDFPage,
  font: PDFFont,
  text: string,
  requestedFontSize: number,
  rotation: number
) {
  const { width, height } = page.getSize()

  const availableLength =
    Math.abs(rotation) > 10
      ? Math.max(
          Math.hypot(width, height) - PAGE_MARGIN * 2,
          MIN_FONT_SIZE
        )
      : Math.max(
          width - PAGE_MARGIN * 2,
          MIN_FONT_SIZE
        )

  const requestedTextWidth = font.widthOfTextAtSize(
    text,
    requestedFontSize
  )

  if (requestedTextWidth <= availableLength) {
    return requestedFontSize
  }

  const fittedSize =
    requestedFontSize *
    (availableLength / requestedTextWidth)

  return clamp(
    fittedSize,
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
  const { width: pageWidth, height: pageHeight } =
    page.getSize()

  const textWidth = font.widthOfTextAtSize(
    text,
    fontSize
  )

  const rotationRadians =
    (rotation * Math.PI) / 180

  const cosine = Math.cos(rotationRadians)
  const sine = Math.sin(rotationRadians)

  const centerX = pageWidth / 2

  const centerY = getPageCenterY(
    pageHeight,
    position,
    fontSize
  )

  const x =
    centerX -
    (textWidth * cosine) / 2 +
    (fontSize * sine) / 2

  const y =
    centerY -
    (textWidth * sine) / 2 -
    (fontSize * cosine) / 2

  return {
    x,
    y
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
  selected: SelectedPdf | undefined,
  options: WatermarkOptions,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para adicionar a marca de água.'
    )
  }

  const text = normalizeWatermarkText(
    options.text
  )

  if (!text) {
    throw new Error(
      'Escreva o texto que pretende utilizar como marca de água.'
    )
  }

  const position =
    options.position ?? 'center'

  const requestedFontSize = clamp(
    Number.isFinite(options.fontSize)
      ? Number(options.fontSize)
      : DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    MAX_FONT_SIZE
  )

  const opacity = clamp(
    Number.isFinite(options.opacity)
      ? Number(options.opacity)
      : DEFAULT_OPACITY,
    MIN_OPACITY,
    MAX_OPACITY
  )

  const defaultRotation =
    position === 'center'
      ? DEFAULT_ROTATION
      : 0

  const rotation = clamp(
    Number.isFinite(options.rotation)
      ? Number(options.rotation)
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

  const pages = pdfDocument.getPages()

  if (pages.length === 0) {
    throw new Error(
      'O documento não contém páginas.'
    )
  }

  onProgress(
    'A preparar a marca de água...'
  )

  const font = await pdfDocument.embedFont(
    StandardFonts.HelveticaBold
  )

  validateWatermarkText(
    font,
    text
  )

  for (
    let pageIndex = 0;
    pageIndex < pages.length;
    pageIndex += 1
  ) {
    const page = pages[pageIndex]

    onProgress(
      `A aplicar marca de água na página ${
        pageIndex + 1
      } de ${pages.length}...`
    )

    const fontSize = getFittedFontSize(
      page,
      font,
      text,
      requestedFontSize,
      rotation
    )

    const origin = getTextOrigin(
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
        color: rgb(
          0.45,
          0.45,
          0.45
        ),
        opacity,
        rotate: degrees(rotation)
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

  const blob = new Blob(
    [
      bytesToArrayBuffer(
        outputBytes
      )
    ],
    {
      type: 'application/pdf'
    }
  )

  const baseName = sanitizeFileName(
    selected.file.name
  )

  return {
    fileName:
      `${baseName}-marca-de-agua.pdf`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message:
      `A marca de água foi aplicada às ${pages.length} página${
        pages.length === 1 ? '' : 's'
      } do documento.`
  }
}
