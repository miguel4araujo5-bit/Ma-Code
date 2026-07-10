import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type { ProgressCallback, SelectedPdf } from '../../types/maPdf'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfTextItemLike = {
  str?: unknown
  transform?: unknown
  width?: unknown
  height?: unknown
  hasEOL?: unknown
}

type PositionedTextItem = {
  text: string
  x: number
  y: number
  width: number
  height: number
  hasEOL: boolean
}

export type ExtractedPdfLine = {
  text: string
  cells: string[]
}

export type ExtractedPdfPage = {
  pageNumber: number
  lines: ExtractedPdfLine[]
}

export type ExtractedPdfDocument = {
  pages: ExtractedPdfPage[]
  pageCount: number
  characterCount: number
}

function toFiniteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback
}

function normalizeText(value: unknown) {
  return typeof value === 'string'
    ? value
        .replace(
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,
          ''
        )
        .trim()
    : ''
}

function toPositionedItem(value: unknown): PositionedTextItem | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const item = value as PdfTextItemLike
  const text = normalizeText(item.str)

  if (
    !text ||
    !Array.isArray(item.transform) ||
    item.transform.length < 6
  ) {
    return null
  }

  const transform = item.transform
  const x = toFiniteNumber(transform[4])
  const y = toFiniteNumber(transform[5])

  const measuredHeight = Math.hypot(
    toFiniteNumber(transform[2]),
    toFiniteNumber(transform[3])
  )

  const height = Math.max(
    1,
    toFiniteNumber(item.height, measuredHeight || 10),
    measuredHeight
  )

  const estimatedWidth = Math.max(
    text.length * height * 0.45,
    height * 0.5
  )

  const width = Math.max(
    0,
    toFiniteNumber(item.width, estimatedWidth)
  )

  return {
    text,
    x,
    y,
    width,
    height,
    hasEOL: item.hasEOL === true
  }
}

function getMedian(values: number[]) {
  if (values.length === 0) {
    return 10
  }

  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }

  return sorted[middle]
}

function getAverageCharacterWidth(item: PositionedTextItem) {
  return item.width > 0 && item.text.length > 0
    ? item.width / item.text.length
    : item.height * 0.5
}

function joinItemsAsText(items: PositionedTextItem[]) {
  const sorted = [...items].sort((a, b) => a.x - b.x)

  let result = ''
  let previousRight = 0
  let previousItem: PositionedTextItem | null = null

  for (const item of sorted) {
    if (!previousItem) {
      result = item.text
      previousRight = item.x + item.width
      previousItem = item
      continue
    }

    const gap = item.x - previousRight

    const characterWidth = Math.max(
      2,
      (
        getAverageCharacterWidth(previousItem) +
        getAverageCharacterWidth(item)
      ) / 2
    )

    const shouldInsertSpace = gap > characterWidth * 0.25

    const spaceCount = shouldInsertSpace
      ? Math.min(
          8,
          Math.max(1, Math.round(gap / characterWidth))
        )
      : 0

    result += `${' '.repeat(spaceCount)}${item.text}`

    previousRight = Math.max(
      previousRight,
      item.x + item.width
    )

    previousItem = item
  }

  return result.replace(/[ \t]+/g, ' ').trim()
}

function splitItemsIntoCells(items: PositionedTextItem[]) {
  const sorted = [...items].sort((a, b) => a.x - b.x)

  if (sorted.length === 0) {
    return []
  }

  const cells: string[] = []
  let currentItems: PositionedTextItem[] = [sorted[0]]
  let previousRight = sorted[0].x + sorted[0].width

  for (let index = 1; index < sorted.length; index += 1) {
    const item = sorted[index]
    const previousItem = sorted[index - 1]
    const gap = item.x - previousRight

    const characterWidth = Math.max(
      2,
      (
        getAverageCharacterWidth(previousItem) +
        getAverageCharacterWidth(item)
      ) / 2
    )

    const cellBreakThreshold = Math.max(
      previousItem.height * 1.8,
      item.height * 1.8,
      characterWidth * 4.5,
      18
    )

    if (
      gap > cellBreakThreshold ||
      previousItem.hasEOL
    ) {
      const cellText = joinItemsAsText(currentItems)

      if (cellText) {
        cells.push(cellText)
      }

      currentItems = [item]
    } else {
      currentItems.push(item)
    }

    previousRight = Math.max(
      previousRight,
      item.x + item.width
    )
  }

  const lastCellText = joinItemsAsText(currentItems)

  if (lastCellText) {
    cells.push(lastCellText)
  }

  return cells
}

function groupItemsIntoLines(items: PositionedTextItem[]) {
  if (items.length === 0) {
    return []
  }

  const medianHeight = getMedian(
    items.map((item) => item.height)
  )

  const lineTolerance = Math.max(
    2,
    medianHeight * 0.45
  )

  const sorted = [...items].sort((a, b) => {
    const verticalDifference = b.y - a.y

    if (Math.abs(verticalDifference) > lineTolerance) {
      return verticalDifference
    }

    return a.x - b.x
  })

  const lineGroups: Array<{
    baseline: number
    items: PositionedTextItem[]
  }> = []

  for (const item of sorted) {
    const currentLine =
      lineGroups[lineGroups.length - 1]

    if (
      !currentLine ||
      Math.abs(currentLine.baseline - item.y) >
        lineTolerance
    ) {
      lineGroups.push({
        baseline: item.y,
        items: [item]
      })

      continue
    }

    currentLine.items.push(item)

    currentLine.baseline =
      currentLine.items.reduce(
        (total, lineItem) =>
          total + lineItem.y,
        0
      ) / currentLine.items.length
  }

  return lineGroups
    .map((group) => {
      const text = joinItemsAsText(group.items)
      const cells = splitItemsIntoCells(group.items)

      return {
        text,
        cells:
          cells.length > 0
            ? cells
            : text
              ? [text]
              : []
      }
    })
    .filter((line) => line.text.length > 0)
}

export async function extractTextFromPdf(
  selected: SelectedPdf | undefined,
  onProgress: ProgressCallback
): Promise<ExtractedPdfDocument> {
  if (!selected) {
    throw new Error(
      'Escolha um ficheiro PDF para converter.'
    )
  }

  onProgress(
    'A preparar a leitura do documento PDF...'
  )

  const data = new Uint8Array(
    await selected.file.arrayBuffer()
  )

  const loadingTask = getDocument({ data })

  try {
    const pdfDocument = await loadingTask.promise
    const pages: ExtractedPdfPage[] = []

    let characterCount = 0

    if (pdfDocument.numPages === 0) {
      throw new Error(
        'O documento não contém páginas.'
      )
    }

    for (
      let pageNumber = 1;
      pageNumber <= pdfDocument.numPages;
      pageNumber += 1
    ) {
      onProgress(
        `A extrair texto da página ${pageNumber} de ${pdfDocument.numPages}...`
      )

      const page =
        await pdfDocument.getPage(pageNumber)

      const textContent =
        await page.getTextContent()

      const positionedItems = textContent.items
        .map((item) => toPositionedItem(item))
        .filter(
          (
            item
          ): item is PositionedTextItem =>
            item !== null
        )

      const lines =
        groupItemsIntoLines(positionedItems)

      characterCount += lines.reduce(
        (total, line) =>
          total + line.text.length,
        0
      )

      pages.push({
        pageNumber,
        lines
      })

      page.cleanup()
    }

    if (characterCount === 0) {
      throw new Error(
        'Este PDF não contém texto selecionável. Se o documento for uma digitalização ou fotografia, será necessário OCR, que ainda não está disponível nesta ferramenta.'
      )
    }

    return {
      pages,
      pageCount: pdfDocument.numPages,
      characterCount
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve esconder
      // o resultado ou o erro principal.
    }
  }
}
