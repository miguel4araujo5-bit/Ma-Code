import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
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

export type PdfEditPageSelection =
  | 'all'
  | number

type PdfEditBaseElement = {
  id: string
  page: PdfEditPageSelection
  opacity?: number
}

export type PdfEditTextElement =
  PdfEditBaseElement & {
    type: 'text'
    text: string
    xPercent: number
    yPercent: number
    maxWidthPercent?: number
    fontSize?: number
    lineHeight?: number
    color?: string
    bold?: boolean
  }

export type PdfEditImageElement =
  PdfEditBaseElement & {
    type: 'image'
    file: File
    xPercent: number
    yPercent: number
    widthPercent?: number
    heightPercent?: number
  }

export type PdfEditRectangleElement =
  PdfEditBaseElement & {
    type: 'rectangle'
    xPercent: number
    yPercent: number
    widthPercent: number
    heightPercent: number
    fillColor?: string
    borderColor?: string
    borderWidth?: number
  }

export type PdfEditLineElement =
  PdfEditBaseElement & {
    type: 'line'
    startXPercent: number
    startYPercent: number
    endXPercent: number
    endYPercent: number
    color?: string
    thickness?: number
  }

export type PdfEditElement =
  | PdfEditTextElement
  | PdfEditImageElement
  | PdfEditRectangleElement
  | PdfEditLineElement

export type PdfEditOptions = {
  elements: PdfEditElement[]
}

type EmbeddedFonts = {
  regular: PDFFont
  bold: PDFFont
}

const DEFAULT_TEXT_COLOR = '#111827'
const DEFAULT_SHAPE_COLOR = '#2563eb'

const DEFAULT_FONT_SIZE = 18
const DEFAULT_LINE_HEIGHT_MULTIPLIER = 1.25
const DEFAULT_TEXT_WIDTH_PERCENT = 80

const DEFAULT_IMAGE_WIDTH_PERCENT = 30

const DEFAULT_BORDER_WIDTH = 1
const DEFAULT_LINE_THICKNESS = 2
const DEFAULT_OPACITY = 1

const MIN_FONT_SIZE = 6
const MAX_FONT_SIZE = 144

const MIN_LINE_HEIGHT = 6
const MAX_LINE_HEIGHT = 220

const MIN_BORDER_WIDTH = 0
const MAX_BORDER_WIDTH = 30

const MIN_LINE_THICKNESS = 0.5
const MAX_LINE_THICKNESS = 40

const MAX_TEXT_LENGTH = 10_000
const MAX_IMAGE_SIZE_BYTES =
  20 * 1024 * 1024

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

function toFiniteNumber(
  value: number | undefined,
  fallback: number
) {
  return Number.isFinite(value)
    ? Number(value)
    : fallback
}

function clampPercentage(
  value: number | undefined,
  fallback = 0
) {
  return clamp(
    toFiniteNumber(value, fallback),
    0,
    100
  )
}

function percentageToValue(
  percentage: number,
  total: number
) {
  return (
    total *
    clampPercentage(percentage) /
    100
  )
}

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .slice(0, MAX_TEXT_LENGTH)
}

function normalizeCommonCharacters(
  value: string
) {
  return value
    .replace(/[“”„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\u00a0/g, ' ')
    .replace(/\u200b/g, '')
}

function makeTextSafeForFont(
  value: string,
  font: PDFFont
) {
  const normalized =
    normalizeCommonCharacters(value)

  let safeText = ''

  for (
    const character of Array.from(
      normalized
    )
  ) {
    if (character === '\n') {
      safeText += character
      continue
    }

    try {
      font.widthOfTextAtSize(
        character,
        DEFAULT_FONT_SIZE
      )

      safeText += character
    } catch {
      safeText += '?'
    }
  }

  return safeText
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

  if (/^[0-9a-f]{3}$/i.test(cleaned)) {
    return cleaned
      .split('')
      .map((character) =>
        `${character}${character}`
      )
      .join('')
      .toUpperCase()
  }

  if (/^[0-9a-f]{6}$/i.test(cleaned)) {
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

  const red =
    Number.parseInt(
      hex.slice(0, 2),
      16
    ) / 255

  const green =
    Number.parseInt(
      hex.slice(2, 4),
      16
    ) / 255

  const blue =
    Number.parseInt(
      hex.slice(4, 6),
      16
    ) / 255

  return rgb(
    red,
    green,
    blue
  )
}

function getOpacity(
  value: number | undefined
) {
  return clamp(
    toFiniteNumber(
      value,
      DEFAULT_OPACITY
    ),
    0.05,
    1
  )
}

function isPngFile(file: File) {
  return (
    file.type === 'image/png' ||
    file.name
      .toLowerCase()
      .endsWith('.png')
  )
}

function isJpgFile(file: File) {
  return (
    file.type === 'image/jpeg' ||
    /\.jpe?g$/i.test(file.name)
  )
}

function validateImageFile(file: File) {
  if (
    !isPngFile(file) &&
    !isJpgFile(file)
  ) {
    throw new Error(
      `A imagem "${file.name}" deve estar no formato PNG, JPG ou JPEG.`
    )
  }

  if (file.size === 0) {
    throw new Error(
      `A imagem "${file.name}" está vazia.`
    )
  }

  if (
    file.size >
    MAX_IMAGE_SIZE_BYTES
  ) {
    throw new Error(
      `A imagem "${file.name}" ultrapassa o limite de 20 MB.`
    )
  }
}

function resolvePageIndexes(
  pageSelection: PdfEditPageSelection,
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

  if (
    !Number.isInteger(
      pageSelection
    ) ||
    pageSelection < 1 ||
    pageSelection > pageCount
  ) {
    throw new Error(
      `A página ${pageSelection} não existe. O documento tem ${pageCount} página${
        pageCount === 1 ? '' : 's'
      }.`
    )
  }

  return [
    pageSelection - 1
  ]
}

function validateElement(
  element: PdfEditElement,
  pageCount: number
) {
  if (!element.id.trim()) {
    throw new Error(
      'Foi encontrado um elemento sem identificador.'
    )
  }

  resolvePageIndexes(
    element.page,
    pageCount
  )

  if (element.type === 'text') {
    if (
      !normalizeText(
        element.text
      ).trim()
    ) {
      throw new Error(
        'Foi encontrado um elemento de texto vazio.'
      )
    }

    return
  }

  if (element.type === 'image') {
    validateImageFile(
      element.file
    )

    return
  }

  if (
    element.type === 'rectangle'
  ) {
    if (
      clampPercentage(
        element.widthPercent
      ) <= 0 ||
      clampPercentage(
        element.heightPercent
      ) <= 0
    ) {
      throw new Error(
        'Um dos retângulos não tem dimensões válidas.'
      )
    }
  }
}

function getImageCacheKey(
  file: File
) {
  return [
    file.name,
    file.size,
    file.lastModified,
    file.type
  ].join('-')
}

async function embedImage(
  pdfDocument: PDFDocument,
  file: File
): Promise<PDFImage> {
  validateImageFile(file)

  const bytes =
    await file.arrayBuffer()

  try {
    if (isPngFile(file)) {
      return await pdfDocument.embedPng(
        bytes
      )
    }

    return await pdfDocument.embedJpg(
      bytes
    )
  } catch {
    throw new Error(
      `Não foi possível ler a imagem "${file.name}". Confirme que o ficheiro não está danificado.`
    )
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
) {
  const sourceLines =
    text.split('\n')

  const wrappedLines: string[] = []

  for (
    const sourceLine of sourceLines
  ) {
    if (!sourceLine.trim()) {
      wrappedLines.push('')
      continue
    }

    const words =
      sourceLine.split(/\s+/)

    let currentLine = ''

    for (const word of words) {
      const candidate =
        currentLine
          ? `${currentLine} ${word}`
          : word

      const candidateWidth =
        font.widthOfTextAtSize(
          candidate,
          fontSize
        )

      if (
        candidateWidth <= maxWidth
      ) {
        currentLine = candidate
        continue
      }

      if (currentLine) {
        wrappedLines.push(
          currentLine
        )

        currentLine = ''
      }

      const wordWidth =
        font.widthOfTextAtSize(
          word,
          fontSize
        )

      if (wordWidth <= maxWidth) {
        currentLine = word
        continue
      }

      let fragment = ''

      for (
        const character of Array.from(
          word
        )
      ) {
        const nextFragment =
          `${fragment}${character}`

        const fragmentWidth =
          font.widthOfTextAtSize(
            nextFragment,
            fontSize
          )

        if (
          fragment &&
          fragmentWidth > maxWidth
        ) {
          wrappedLines.push(
            fragment
          )

          fragment = character
        } else {
          fragment =
            nextFragment
        }
      }

      currentLine = fragment
    }

    if (currentLine) {
      wrappedLines.push(
        currentLine
      )
    }
  }

  return wrappedLines
}

function drawTextElement(
  page: PDFPage,
  element: PdfEditTextElement,
  fonts: EmbeddedFonts
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const font =
    element.bold
      ? fonts.bold
      : fonts.regular

  const fontSize = clamp(
    toFiniteNumber(
      element.fontSize,
      DEFAULT_FONT_SIZE
    ),
    MIN_FONT_SIZE,
    MAX_FONT_SIZE
  )

  const lineHeight = clamp(
    toFiniteNumber(
      element.lineHeight,
      fontSize *
        DEFAULT_LINE_HEIGHT_MULTIPLIER
    ),
    MIN_LINE_HEIGHT,
    MAX_LINE_HEIGHT
  )

  const x =
    percentageToValue(
      element.xPercent,
      pageWidth
    )

  const topY =
    percentageToValue(
      element.yPercent,
      pageHeight
    )

  const availableFromX =
    Math.max(
      pageWidth - x,
      fontSize
    )

  const requestedMaxWidth =
    percentageToValue(
      element.maxWidthPercent ??
        DEFAULT_TEXT_WIDTH_PERCENT,
      pageWidth
    )

  const maxWidth =
    Math.max(
      fontSize,
      Math.min(
        requestedMaxWidth,
        availableFromX
      )
    )

  const safeText =
    makeTextSafeForFont(
      normalizeText(
        element.text
      ),
      font
    )

  const lines =
    wrapText(
      safeText,
      font,
      fontSize,
      maxWidth
    )

  let y =
    pageHeight -
    topY -
    fontSize

  for (const line of lines) {
    if (
      y < -lineHeight
    ) {
      break
    }

    if (line) {
      page.drawText(
        line,
        {
          x,
          y,
          size: fontSize,
          font,
          color:
            parseHexColor(
              element.color,
              DEFAULT_TEXT_COLOR
            ),
          opacity:
            getOpacity(
              element.opacity
            )
        }
      )
    }

    y -= lineHeight
  }
}

function drawImageElement(
  page: PDFPage,
  element: PdfEditImageElement,
  image: PDFImage
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const imageSize =
    image.size()

  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0
  ) {
    throw new Error(
      `A imagem "${element.file.name}" não tem dimensões válidas.`
    )
  }

  const x =
    percentageToValue(
      element.xPercent,
      pageWidth
    )

  const topY =
    percentageToValue(
      element.yPercent,
      pageHeight
    )

  let drawWidth =
    percentageToValue(
      element.widthPercent ??
        DEFAULT_IMAGE_WIDTH_PERCENT,
      pageWidth
    )

  let drawHeight =
    element.heightPercent !==
    undefined
      ? percentageToValue(
          element.heightPercent,
          pageHeight
        )
      : drawWidth *
        (
          imageSize.height /
          imageSize.width
        )

  const availableWidth =
    Math.max(
      pageWidth - x,
      1
    )

  const availableHeight =
    Math.max(
      pageHeight - topY,
      1
    )

  const fitScale =
    Math.min(
      1,
      availableWidth /
        Math.max(drawWidth, 1),
      availableHeight /
        Math.max(drawHeight, 1)
    )

  drawWidth *= fitScale
  drawHeight *= fitScale

  const y =
    pageHeight -
    topY -
    drawHeight

  page.drawImage(
    image,
    {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
      opacity:
        getOpacity(
          element.opacity
        )
    }
  )
}

function drawRectangleElement(
  page: PDFPage,
  element: PdfEditRectangleElement
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const x =
    percentageToValue(
      element.xPercent,
      pageWidth
    )

  const topY =
    percentageToValue(
      element.yPercent,
      pageHeight
    )

  const requestedWidth =
    percentageToValue(
      element.widthPercent,
      pageWidth
    )

  const requestedHeight =
    percentageToValue(
      element.heightPercent,
      pageHeight
    )

  const width =
    Math.max(
      1,
      Math.min(
        requestedWidth,
        pageWidth - x
      )
    )

  const height =
    Math.max(
      1,
      Math.min(
        requestedHeight,
        pageHeight - topY
      )
    )

  const y =
    pageHeight -
    topY -
    height

  const borderWidth =
    clamp(
      toFiniteNumber(
        element.borderWidth,
        DEFAULT_BORDER_WIDTH
      ),
      MIN_BORDER_WIDTH,
      MAX_BORDER_WIDTH
    )

  const opacity =
    getOpacity(
      element.opacity
    )

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color:
      parseHexColor(
        element.fillColor,
        DEFAULT_SHAPE_COLOR
      ),
    opacity,
    borderColor:
      parseHexColor(
        element.borderColor,
        DEFAULT_SHAPE_COLOR
      ),
    borderWidth,
    borderOpacity: opacity
  })
}

function drawLineElement(
  page: PDFPage,
  element: PdfEditLineElement
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const startX =
    percentageToValue(
      element.startXPercent,
      pageWidth
    )

  const startY =
    pageHeight -
    percentageToValue(
      element.startYPercent,
      pageHeight
    )

  const endX =
    percentageToValue(
      element.endXPercent,
      pageWidth
    )

  const endY =
    pageHeight -
    percentageToValue(
      element.endYPercent,
      pageHeight
    )

  const thickness =
    clamp(
      toFiniteNumber(
        element.thickness,
        DEFAULT_LINE_THICKNESS
      ),
      MIN_LINE_THICKNESS,
      MAX_LINE_THICKNESS
    )

  page.drawLine({
    start: {
      x: startX,
      y: startY
    },
    end: {
      x: endX,
      y: endY
    },
    thickness,
    color:
      parseHexColor(
        element.color,
        DEFAULT_SHAPE_COLOR
      ),
    opacity:
      getOpacity(
        element.opacity
      )
  })
}

function getElementLabel(
  element: PdfEditElement
) {
  if (element.type === 'text') {
    return 'texto'
  }

  if (element.type === 'image') {
    return 'imagem'
  }

  if (
    element.type === 'rectangle'
  ) {
    return 'retângulo'
  }

  return 'linha'
}

export async function editPdf(
  selected: SelectedPdf | undefined,
  options: PdfEditOptions,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para editar.'
    )
  }

  if (
    !options ||
    !Array.isArray(
      options.elements
    ) ||
    options.elements.length === 0
  ) {
    throw new Error(
      'Adicione pelo menos um texto, imagem, retângulo ou linha ao documento.'
    )
  }

  onProgress(
    'A abrir o documento PDF...'
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

  for (
    const element of
    options.elements
  ) {
    validateElement(
      element,
      pages.length
    )
  }

  onProgress(
    'A preparar os elementos da edição...'
  )

  const fonts: EmbeddedFonts = {
    regular:
      await pdfDocument.embedFont(
        StandardFonts.Helvetica
      ),

    bold:
      await pdfDocument.embedFont(
        StandardFonts.HelveticaBold
      )
  }

  const embeddedImages =
    new Map<
      string,
      PDFImage
    >()

  const imageElements =
    options.elements.filter(
      (
        element
      ): element is PdfEditImageElement =>
        element.type === 'image'
    )

  for (
    let imageIndex = 0;
    imageIndex <
    imageElements.length;
    imageIndex += 1
  ) {
    const imageElement =
      imageElements[imageIndex]

    const cacheKey =
      getImageCacheKey(
        imageElement.file
      )

    if (
      embeddedImages.has(
        cacheKey
      )
    ) {
      continue
    }

    onProgress(
      `A preparar imagem ${imageIndex + 1} de ${imageElements.length}...`
    )

    const embeddedImage =
      await embedImage(
        pdfDocument,
        imageElement.file
      )

    embeddedImages.set(
      cacheKey,
      embeddedImage
    )
  }

  let appliedElementCount = 0

  for (
    let elementIndex = 0;
    elementIndex <
    options.elements.length;
    elementIndex += 1
  ) {
    const element =
      options.elements[elementIndex]

    const pageIndexes =
      resolvePageIndexes(
        element.page,
        pages.length
      )

    onProgress(
      `A aplicar ${getElementLabel(
        element
      )} ${elementIndex + 1} de ${
        options.elements.length
      }...`
    )

    for (
      const pageIndex of pageIndexes
    ) {
      const page =
        pages[pageIndex]

      if (element.type === 'text') {
        drawTextElement(
          page,
          element,
          fonts
        )
      } else if (
        element.type === 'image'
      ) {
        const cacheKey =
          getImageCacheKey(
            element.file
          )

        const embeddedImage =
          embeddedImages.get(
            cacheKey
          )

        if (!embeddedImage) {
          throw new Error(
            `Não foi possível preparar a imagem "${element.file.name}".`
          )
        }

        drawImageElement(
          page,
          element,
          embeddedImage
        )
      } else if (
        element.type ===
        'rectangle'
      ) {
        drawRectangleElement(
          page,
          element
        )
      } else {
        drawLineElement(
          page,
          element
        )
      }

      appliedElementCount += 1
    }
  }

  onProgress(
    'A criar o documento PDF editado...'
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
        type: 'application/pdf'
      }
    )

  const baseName =
    sanitizeFileName(
      selected.file.name
    ) ||
    'documento'

  return {
    fileName:
      `${baseName}-editado.pdf`,

    blob,

    originalSize:
      selected.file.size,

    finalSize:
      blob.size,

    message:
      `${appliedElementCount} alteração${
        appliedElementCount === 1
          ? ''
          : 'ões'
      } ${
        appliedElementCount === 1
          ? 'foi aplicada'
          : 'foram aplicadas'
      } ao documento PDF.`
  }
}
