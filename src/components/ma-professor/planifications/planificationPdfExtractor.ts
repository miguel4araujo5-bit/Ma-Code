import {
  GlobalWorkerOptions,
  OPS,
  getDocument
} from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { readRuledPlanificationTable, type PdfRuleBox } from './planificationPdfTableLayout'

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
  tableLines?: PlanificationPdfLine[]
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
      if (page.tableLines) return { pageNumber: page.pageNumber, lines: page.tableLines }
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

  const loadingTask =
    getDocument({ data })

  const pdf =
    await loadingTask.promise

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

      // pdfjs-dist 6.1.200 implements getTextContent() with
      // `for await...of` over a ReadableStream. Safari 26.x exposes
      // getReader() but not ReadableStream[Symbol.asyncIterator], which
      // throws "undefined is not a function". Consume the exact same
      // stream through its reader API so extraction remains equivalent
      // while working in Safari and the other supported browsers.
      const reader =
        page.streamTextContent()
          .getReader()
      const items:
        PlanificationPdfTextItem[] = []

      try {
        while (true) {
          const {
            value,
            done
          } = await reader.read()

          if (done) {
            break
          }

          if (!value) {
            continue
          }

          for (const item of value.items) {
            if (
              !('str' in item) ||
              !Array.isArray(item.transform)
            ) {
              continue
            }

            items.push({
              str: String(item.str ?? ''),
              transform:
                item.transform.map(Number),
              width:
                Number(item.width ?? 0),
              height:
                Number(item.height ?? 0)
            })
          }
        }
      } finally {
        reader.releaseLock()
      }

      const operators = await page.getOperatorList()
      const rules: PdfRuleBox[] = []
      operators.fnArray.forEach((operator, index) => {
        if (operator !== OPS.constructPath) return
        const args = operators.argsArray[index]
        // PDF.js 6 supplies the axis-aligned path bounds as the third argument.
        // Only straight horizontal/vertical strokes are candidates.
        const box = args?.[2]
        if (args?.[0] === OPS.stroke && box?.length === 4 &&
            Array.from(box).every(value => typeof value === 'number' && Number.isFinite(value))) {
          rules.push(Array.from(box) as PdfRuleBox)
        }
      })
      pages.push({
        pageNumber,
        items,
        tableLines: readRuledPlanificationTable(items, rules, Boolean(pages[pages.length - 1]?.tableLines)) ?? undefined
      })
    }
  } finally {
    await loadingTask.destroy()
  }

  const document =
    buildPlanificationPdfDocumentFromExtraction(
      pages
    )

  if (pages.some(page => page.tableLines) && pages.some(page =>
    !page.tableLines && page.items.some(item => /UFCD|conte[úu]dos|objetivos/i.test(item.str))
  )) {
    throw new Error('O PDF contém tabelas com estruturas diferentes que não foi possível associar com segurança. Utilize o Word original ou reveja o PDF.')
  }

  if (document.characterCount === 0) {
    throw new Error(
      'O PDF não contém texto extraível. Não foram inventados dados; confirme se o ficheiro é uma digitalização sem camada de texto.'
    )
  }

  return document
}
