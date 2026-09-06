import {
  GlobalWorkerOptions,
  getDocument
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import type {
  PlanificationPdfCell,
  PlanificationPdfDocument,
  PlanificationPdfLine,
  PlanificationPdfPage
} from './planificationPdfParser'

GlobalWorkerOptions.workerSrc =
  pdfWorkerUrl

export interface PlanificationPdfTextItem {
  str: string
  transform: number[]
  width: number
  height?: number
}

export interface PlanificationPdfExtractionPage {
  pageNumber: number
  items: PlanificationPdfTextItem[]
}

const LINE_TOLERANCE = 3
const CELL_GAP = 18

function normalizeText(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getX(item: PlanificationPdfTextItem) {
  return Number(item.transform?.[4] ?? 0)
}

function getY(item: PlanificationPdfTextItem) {
  return Number(item.transform?.[5] ?? 0)
}

function toCell(
  items: PlanificationPdfTextItem[]
): PlanificationPdfCell | null {
  if (items.length === 0) {
    return null
  }

  const sorted = [...items]
    .sort((left, right) =>
      getX(left) - getX(right)
    )

  const text = normalizeText(
    sorted
      .map(item => item.str)
      .join(' ')
  )

  if (!text) {
    return null
  }

  const x = Math.min(
    ...sorted.map(getX)
  )

  const right = Math.max(
    ...sorted.map(item =>
      getX(item) +
      Math.max(0, Number(item.width) || 0)
    )
  )

  return {
    text,
    x,
    width: Math.max(1, right - x)
  }
}

function buildLine(
  items: PlanificationPdfTextItem[]
): PlanificationPdfLine | null {
  const sorted = [...items]
    .sort((left, right) =>
      getX(left) - getX(right)
    )

  const groups:
    PlanificationPdfTextItem[][] = []

  for (const item of sorted) {
    const text = normalizeText(item.str)

    if (!text) {
      continue
    }

    const current =
      groups[groups.length - 1]

    if (!current) {
      groups.push([item])
      continue
    }

    const previous =
      current[current.length - 1]
    const previousRight =
      getX(previous) +
      Math.max(0, Number(previous.width) || 0)
    const gap =
      getX(item) - previousRight

    if (gap > CELL_GAP) {
      groups.push([item])
    } else {
      current.push(item)
    }
  }

  const positionedCells =
    groups
      .map(toCell)
      .filter(
        (cell): cell is PlanificationPdfCell =>
          Boolean(cell)
      )

  if (positionedCells.length === 0) {
    return null
  }

  return {
    text: normalizeText(
      positionedCells
        .map(cell => cell.text)
        .join(' ')
    ),
    cells: positionedCells.map(
      cell => cell.text
    ),
    positionedCells
  }
}

export function buildPlanificationPdfDocumentFromExtraction(
  pages: PlanificationPdfExtractionPage[]
): PlanificationPdfDocument {
  const normalizedPages:
    PlanificationPdfPage[] =
    pages.map(page => {
      const rows:
        Array<{
          y: number
          items: PlanificationPdfTextItem[]
        }> = []

      const ordered = [...page.items]
        .filter(item =>
          normalizeText(item.str).length > 0
        )
        .sort((left, right) => {
          const yDifference =
            getY(right) - getY(left)

          return Math.abs(yDifference) >
            LINE_TOLERANCE
            ? yDifference
            : getX(left) - getX(right)
        })

      for (const item of ordered) {
        const y = getY(item)
        const row = rows.find(
          candidate =>
            Math.abs(candidate.y - y) <=
              LINE_TOLERANCE
        )

        if (row) {
          row.items.push(item)
          row.y =
            (row.y + y) / 2
        } else {
          rows.push({
            y,
            items: [item]
          })
        }
      }

      const lines = rows
        .sort((left, right) =>
          right.y - left.y
        )
        .map(row =>
          buildLine(row.items)
        )
        .filter(
          (line): line is PlanificationPdfLine =>
            Boolean(line)
        )

      return {
        pageNumber: page.pageNumber,
        lines
      }
    })

  const characterCount =
    normalizedPages.reduce(
      (total, page) =>
        total +
        page.lines.reduce(
          (pageTotal, line) =>
            pageTotal + line.text.length,
          0
        ),
      0
    )

  return {
    pages: normalizedPages,
    pageCount: normalizedPages.length,
    characterCount
  }
}

export async function extractPlanificationPdf(
  file: File
): Promise<PlanificationPdfDocument> {
  if (
    file.type !== 'application/pdf' &&
    !file.name.toLocaleLowerCase('pt-PT')
      .endsWith('.pdf')
  ) {
    throw new Error(
      'Selecione um ficheiro PDF.'
    )
  }

  const data =
    new Uint8Array(
      await file.arrayBuffer()
    )

  const pdf =
    await getDocument({ data }).promise

  const pages:
    PlanificationPdfExtractionPage[] = []

  try {
    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdf.getPage(pageNumber)
      const textContent =
        await page.getTextContent()

      const items = textContent.items
        .flatMap(item => {
          if (
            !('str' in item) ||
            !Array.isArray(item.transform)
          ) {
            return []
          }

          return [{
            str: String(item.str ?? ''),
            transform:
              item.transform.map(Number),
            width:
              Number(item.width ?? 0),
            height:
              Number(item.height ?? 0)
          }]
        })

      pages.push({
        pageNumber,
        items
      })
    }
  } finally {
    await pdf.destroy()
  }

  const document =
    buildPlanificationPdfDocumentFromExtraction(
      pages
    )

  if (document.characterCount === 0) {
    throw new Error(
      'O PDF não contém texto extraível. Não foram inventados dados; confirme se o ficheiro é uma digitalização sem camada de texto.'
    )
  }

  return document
}
