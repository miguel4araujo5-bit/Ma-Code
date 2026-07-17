import {
  PDFDocument,
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

export type SignatureCoordinates = {
  xRatio: number
  yRatio: number
}

export type SignaturePosition =
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'center'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | SignatureCoordinates

export type SignaturePageSelection =
  | 'last'
  | 'all'
  | number

export type SignatureOptions = {
  signatureFile: File
  page?: SignaturePageSelection
  position?: SignaturePosition
  width?: number
  margin?: number
  opacity?: number
}

const DEFAULT_SIGNATURE_WIDTH = 150
const DEFAULT_MARGIN = 36
const DEFAULT_OPACITY = 1

const MIN_SIGNATURE_WIDTH = 40
const MAX_SIGNATURE_WIDTH = 400

const MIN_MARGIN = 0
const MAX_MARGIN = 150

const MIN_OPACITY = 0.1
const MAX_OPACITY = 1

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

function isPngFile(file: File) {
  return (
    file.type === 'image/png' ||
    file.name.toLowerCase().endsWith('.png')
  )
}

function isJpgFile(file: File) {
  return (
    file.type === 'image/jpeg' ||
    /\.jpe?g$/i.test(file.name)
  )
}

function validateSignatureFile(file: File) {
  if (!isPngFile(file) && !isJpgFile(file)) {
    throw new Error(
      'A assinatura deve estar num ficheiro PNG, JPG ou JPEG.'
    )
  }

  if (file.size === 0) {
    throw new Error(
      'O ficheiro da assinatura está vazio.'
    )
  }
}

async function embedSignatureImage(
  pdfDocument: PDFDocument,
  signatureFile: File
): Promise<PDFImage> {
  const imageBytes =
    await signatureFile.arrayBuffer()

  try {
    if (isPngFile(signatureFile)) {
      return await pdfDocument.embedPng(
        imageBytes
      )
    }

    return await pdfDocument.embedJpg(
      imageBytes
    )
  } catch {
    throw new Error(
      'Não foi possível ler a imagem da assinatura. Confirme que o ficheiro PNG ou JPG é válido.'
    )
  }
}

function resolvePageIndexes(
  pageSelection: SignaturePageSelection,
  pageCount: number
) {
  if (pageSelection === 'all') {
    return Array.from(
      { length: pageCount },
      (_, index) => index
    )
  }

  if (pageSelection === 'last') {
    return [pageCount - 1]
  }

  if (
    !Number.isInteger(pageSelection) ||
    pageSelection < 1 ||
    pageSelection > pageCount
  ) {
    throw new Error(
      `A página indicada não existe. O documento tem ${pageCount} página${
        pageCount === 1 ? '' : 's'
      }.`
    )
  }

  return [pageSelection - 1]
}

function getSignatureSize(
  page: PDFPage,
  image: PDFImage,
  requestedWidth: number,
  margin: number
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  const imageSize = image.size()

  if (
    imageSize.width <= 0 ||
    imageSize.height <= 0
  ) {
    throw new Error(
      'A imagem da assinatura não tem dimensões válidas.'
    )
  }

  const availableWidth = Math.max(
    pageWidth - margin * 2,
    MIN_SIGNATURE_WIDTH
  )

  const availableHeight = Math.max(
    pageHeight - margin * 2,
    MIN_SIGNATURE_WIDTH
  )

  const width = Math.min(
    requestedWidth,
    availableWidth
  )

  const proportionalHeight =
    width *
    (imageSize.height / imageSize.width)

  if (proportionalHeight <= availableHeight) {
    return {
      width,
      height: proportionalHeight
    }
  }

  const height = availableHeight

  return {
    width:
      height *
      (imageSize.width / imageSize.height),
    height
  }
}

function getSignatureCoordinates(
  page: PDFPage,
  signatureWidth: number,
  signatureHeight: number,
  position: SignaturePosition,
  margin: number
) {
  const {
    width: pageWidth,
    height: pageHeight
  } = page.getSize()

  if (typeof position === 'object') {
    const maximumX = Math.max(
      pageWidth - signatureWidth,
      0
    )

    const maximumTop = Math.max(
      pageHeight - signatureHeight,
      0
    )

    const x =
      clamp(position.xRatio, 0, 1) *
      maximumX

    const top =
      clamp(position.yRatio, 0, 1) *
      maximumTop

    return {
      x,
      y:
        pageHeight -
        signatureHeight -
        top
    }
  }

  const leftX = margin

  const centerX =
    (pageWidth - signatureWidth) / 2

  const rightX =
    pageWidth -
    signatureWidth -
    margin

  const bottomY = margin

  const centerY =
    (pageHeight - signatureHeight) / 2

  const topY =
    pageHeight -
    signatureHeight -
    margin

  switch (position) {
    case 'bottom-left':
      return {
        x: leftX,
        y: bottomY
      }

    case 'bottom-center':
      return {
        x: centerX,
        y: bottomY
      }

    case 'bottom-right':
      return {
        x: rightX,
        y: bottomY
      }

    case 'top-left':
      return {
        x: leftX,
        y: topY
      }

    case 'top-center':
      return {
        x: centerX,
        y: topY
      }

    case 'top-right':
      return {
        x: rightX,
        y: topY
      }

    case 'center':
    default:
      return {
        x: centerX,
        y: centerY
      }
  }
}

export async function signPdf(
  selected: SelectedPdf | undefined,
  options: SignatureOptions,
  onProgress: ProgressCallback
): Promise<ResultData> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para assinar.'
    )
  }

  if (!options.signatureFile) {
    throw new Error(
      'Escolha ou desenhe uma assinatura antes de continuar.'
    )
  }

  validateSignatureFile(
    options.signatureFile
  )

  const pageSelection =
    options.page ?? 'last'

  const position =
    options.position ?? 'bottom-right'

  const requestedWidth = clamp(
    Number.isFinite(options.width)
      ? Number(options.width)
      : DEFAULT_SIGNATURE_WIDTH,
    MIN_SIGNATURE_WIDTH,
    MAX_SIGNATURE_WIDTH
  )

  const margin = clamp(
    Number.isFinite(options.margin)
      ? Number(options.margin)
      : DEFAULT_MARGIN,
    MIN_MARGIN,
    MAX_MARGIN
  )

  const opacity = clamp(
    Number.isFinite(options.opacity)
      ? Number(options.opacity)
      : DEFAULT_OPACITY,
    MIN_OPACITY,
    MAX_OPACITY
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
    'A preparar a imagem da assinatura...'
  )

  const signatureImage =
    await embedSignatureImage(
      pdfDocument,
      options.signatureFile
    )

  for (
    let index = 0;
    index < pageIndexes.length;
    index += 1
  ) {
    const pageIndex =
      pageIndexes[index]

    const page =
      pages[pageIndex]

    onProgress(
      `A aplicar a assinatura na página ${
        pageIndex + 1
      } de ${pages.length}...`
    )

    const effectiveMargin =
      typeof position === 'object'
        ? 0
        : margin

    const signatureSize =
      getSignatureSize(
        page,
        signatureImage,
        requestedWidth,
        effectiveMargin
      )

    const coordinates =
      getSignatureCoordinates(
        page,
        signatureSize.width,
        signatureSize.height,
        position,
        effectiveMargin
      )

    page.drawImage(
      signatureImage,
      {
        x: coordinates.x,
        y: coordinates.y,
        width: signatureSize.width,
        height: signatureSize.height,
        opacity
      }
    )
  }

  onProgress(
    'A criar o documento PDF assinado...'
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

  const baseName =
    sanitizeFileName(
      selected.file.name
    )

  return {
    fileName:
      `${baseName}-assinado.pdf`,
    blob,
    originalSize: selected.file.size,
    finalSize: blob.size,
    message:
      pageIndexes.length === 1
        ? `A assinatura foi adicionada à página ${
            pageIndexes[0] + 1
          } do documento.`
        : `A assinatura foi adicionada às ${pageIndexes.length} páginas do documento.`
  }
}
