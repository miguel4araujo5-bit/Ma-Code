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

type PdfMatrix = [
  number,
  number,
  number,
  number,
  number,
  number
]

type PdfOperatorListLike = {
  fnArray: number[]
  argsArray: unknown[]
}

const LINE_TOLERANCE = 3
const CELL_GAP = 18
const RULE_TOLERANCE = 1.5
const MIN_VERTICAL_RULE_LENGTH = 25
const MIN_HORIZONTAL_RULE_LENGTH = 250

// pdfjs-dist 6.x packs path commands inside constructPath as the
// DrawOPS numeric protocol. Keeping the tiny protocol local avoids importing
// an internal pdf.js module while still reading the public operator list.
const PATH_MOVE_TO = 0
const PATH_LINE_TO = 1
const PATH_CURVE_TO = 2
const PATH_QUADRATIC_CURVE_TO = 3
const PATH_CLOSE = 4
const IDENTITY_MATRIX: PdfMatrix = [1, 0, 0, 1, 0, 0]

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

function toNumericArray(value: unknown) {
  if (
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value)
  ) {
    return []
  }

  try {
    return Array.from(
      value as ArrayLike<number>,
      item => Number(item)
    )
  } catch {
    return []
  }
}

function multiplyMatrices(
  left: PdfMatrix,
  right: PdfMatrix
): PdfMatrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5]
  ]
}

function transformPoint(
  x: number,
  y: number,
  matrix: PdfMatrix
) {
  return {
    x:
      x * matrix[0] +
      y * matrix[2] +
      matrix[4],
    y:
      x * matrix[1] +
      y * matrix[3] +
      matrix[5]
  }
}

function makeRule(
  start: { x: number; y: number },
  end: { x: number; y: number }
): PdfRuleBox | null {
  const values = [
    start.x,
    start.y,
    end.x,
    end.y
  ]

  if (!values.every(Number.isFinite)) {
    return null
  }

  if (
    Math.abs(start.x - end.x) <= RULE_TOLERANCE &&
    Math.abs(start.y - end.y) > MIN_VERTICAL_RULE_LENGTH
  ) {
    const x =
      (start.x + end.x) / 2

    return [
      x,
      Math.min(start.y, end.y),
      x,
      Math.max(start.y, end.y)
    ]
  }

  if (
    Math.abs(start.y - end.y) <= RULE_TOLERANCE &&
    Math.abs(start.x - end.x) > MIN_HORIZONTAL_RULE_LENGTH
  ) {
    const y =
      (start.y + end.y) / 2

    return [
      Math.min(start.x, end.x),
      y,
      Math.max(start.x, end.x),
      y
    ]
  }

  return null
}

function isStrokePaintingOperator(operator: unknown) {
  const strokeOperators = [
    OPS.stroke,
    OPS.closeStroke,
    OPS.fillStroke,
    OPS.eoFillStroke,
    OPS.closeFillStroke,
    OPS.closeEOFillStroke
  ].filter(
    (value): value is number =>
      typeof value === 'number'
  )

  return (
    typeof operator === 'number' &&
    strokeOperators.includes(operator)
  )
}

function getPackedPath(args: unknown[]) {
  const packedContainer =
    Array.isArray(args[1])
      ? args[1]
      : null

  if (!packedContainer) {
    return []
  }

  return toNumericArray(
    packedContainer[0]
  )
}

function readPackedPathRules(
  path: number[],
  matrix: PdfMatrix
) {
  const rules: PdfRuleBox[] = []
  let index = 0
  let current:
    { x: number; y: number } | null = null
  let subpathStart:
    { x: number; y: number } | null = null

  const readPoint = () => {
    if (index + 1 >= path.length) {
      return null
    }

    const x = path[index]
    const y = path[index + 1]
    index += 2

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null
    }

    return transformPoint(
      x,
      y,
      matrix
    )
  }

  while (index < path.length) {
    const command = path[index]
    index += 1

    if (command === PATH_MOVE_TO) {
      const point = readPoint()

      if (!point) {
        break
      }

      current = point
      subpathStart = point
      continue
    }

    if (command === PATH_LINE_TO) {
      const point = readPoint()

      if (!point) {
        break
      }

      if (current) {
        const rule =
          makeRule(
            current,
            point
          )

        if (rule) {
          rules.push(rule)
        }
      }

      current = point
      continue
    }

    if (command === PATH_CURVE_TO) {
      const control1 = readPoint()
      const control2 = readPoint()
      const point = readPoint()

      if (
        !control1 ||
        !control2 ||
        !point
      ) {
        break
      }

      current = point
      continue
    }

    if (command === PATH_QUADRATIC_CURVE_TO) {
      const control = readPoint()
      const point = readPoint()

      if (!control || !point) {
        break
      }

      current = point
      continue
    }

    if (command === PATH_CLOSE) {
      if (
        current &&
        subpathStart
      ) {
        const rule =
          makeRule(
            current,
            subpathStart
          )

        if (rule) {
          rules.push(rule)
        }

        current = subpathStart
      }

      continue
    }

    // A command outside the pdf.js 6.x packed path protocol means that
    // continuing could shift the coordinate cursor and invent geometry.
    break
  }

  return rules
}

function getLegacyStraightRule(
  value: unknown,
  matrix: PdfMatrix
) {
  const box =
    toNumericArray(value)

  if (box.length !== 4) {
    return null
  }

  return makeRule(
    transformPoint(
      box[0],
      box[1],
      matrix
    ),
    transformPoint(
      box[2],
      box[3],
      matrix
    )
  )
}

/**
 * Recover the individual ruled-table segments from the public PDF.js
 * operator list. In pdfjs-dist 6.x constructPath exposes one packed path plus
 * a bounding box for the entire path. Treating that bounding box as a single
 * rule loses real table grids and makes text fall back to line proximity.
 */
export function extractPlanificationPdfRuleBoxes(
  operators: PdfOperatorListLike
): PdfRuleBox[] {
  const rules: PdfRuleBox[] = []
  const matrixStack: PdfMatrix[] = []
  let matrix: PdfMatrix = [
    ...IDENTITY_MATRIX
  ]

  for (
    let index = 0;
    index < operators.fnArray.length;
    index += 1
  ) {
    const operator =
      operators.fnArray[index]
    const rawArgs =
      operators.argsArray[index]
    const args =
      Array.isArray(rawArgs)
        ? rawArgs
        : []

    if (operator === OPS.save) {
      matrixStack.push([
        ...matrix
      ])
      continue
    }

    if (operator === OPS.restore) {
      matrix =
        matrixStack.pop() ??
        [...IDENTITY_MATRIX]
      continue
    }

    if (operator === OPS.transform) {
      const values =
        toNumericArray(args)

      if (
        values.length >= 6 &&
        values.slice(0, 6)
          .every(Number.isFinite)
      ) {
        matrix =
          multiplyMatrices(
            matrix,
            values.slice(0, 6) as PdfMatrix
          )
      }

      continue
    }

    if (operator !== OPS.constructPath) {
      continue
    }

    if (!isStrokePaintingOperator(args[0])) {
      continue
    }

    const packedPath =
      getPackedPath(args)

    const packedRules =
      readPackedPathRules(
        packedPath,
        matrix
      )

    if (packedRules.length > 0) {
      rules.push(
        ...packedRules
      )
      continue
    }

    // Compatibility fallback for older/operator-list variants that expose a
    // single straight segment directly as constructPath bounds.
    const legacyRule =
      getLegacyStraightRule(
        args[2],
        matrix
      )

    if (legacyRule) {
      rules.push(legacyRule)
    }
  }

  return rules
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

  const pages:
    PlanificationPdfExtractionPage[] = []

  try {
    const pdf =
      await loadingTask.promise

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page =
        await pdf.getPage(pageNumber)

      try {
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

        const operators =
          await page.getOperatorList()
        const rules =
          extractPlanificationPdfRuleBoxes(
            operators
          )

        pages.push({
          pageNumber,
          items,
          tableLines:
            readRuledPlanificationTable(
              items,
              rules,
              Boolean(
                pages[
                  pages.length - 1
                ]?.tableLines
              )
            ) ?? undefined
        })
      } finally {
        try {
          page.cleanup()
        } catch {
          // A limpeza da página não deve esconder
          // o resultado ou o erro principal.
        }
      }
    }
  } finally {
    try {
      await loadingTask.destroy()
    } catch {
      // A limpeza do worker não deve esconder
      // o resultado ou o erro principal.
    }
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
