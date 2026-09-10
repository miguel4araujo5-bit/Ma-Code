import type {
  PlanificationPdfCell,
  PlanificationPdfDocument,
  PlanificationPdfLine
} from '../planifications/planificationPdfParser'
import type {
  AssessmentCriteriaPdfCandidate,
  AssessmentCriteriaPdfMetadata,
  CriteriaImportMetadataField
} from './assessmentCriteriaPdfParserCore'

type MatrixColumn =
  | 'domain'
  | 'weight'
  | 'operation'
  | 'indicators'
  | 'instruments'

type MatrixAnchor = {
  kind: MatrixColumn
  x: number
  index: number
}

type MatrixRow = {
  pageNumber: number
  values: Record<MatrixColumn, string>
}

export interface ProfessionalCriteriaMatrixResult {
  metadata: AssessmentCriteriaPdfMetadata
  candidates: AssessmentCriteriaPdfCandidate[]
  warnings: string[]
}

function clean(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function unique(values: string[]) {
  const seen = new Set<string>()

  return values.filter(value => {
    const key = normalize(value)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function sourceCells(
  line: PlanificationPdfLine
): PlanificationPdfCell[] {
  if (
    line.positionedCells &&
    line.positionedCells.length > 0
  ) {
    return line.positionedCells
  }

  return line.cells.map(
    (text, index) => ({
      text,
      x: index * 100,
      width: 80
    })
  )
}

function columnKind(value: string): MatrixColumn | null {
  const text = normalize(value)

  if (/^dominios?$/.test(text)) return 'domain'
  if (/\bponderacao\b/.test(text) || /\bpercentagem\b/.test(text) || /^pesos?$/.test(text)) return 'weight'
  if (/\boperacionalizacao\b/.test(text)) return 'operation'
  if (/\bindicadores?\b/.test(text)) return 'indicators'
  if (/\binstrumentos?\b/.test(text) || /\btecnicas?\b.*\bavaliacao\b/.test(text)) return 'instruments'

  return null
}

function headerAnchors(
  line: PlanificationPdfLine
) {
  const anchors = sourceCells(line).flatMap(
    (cell, index): MatrixAnchor[] => {
      const kind = columnKind(cell.text)

      return kind
        ? [{ kind, x: cell.x, index }]
        : []
    }
  )
  const kinds = new Set(
    anchors.map(anchor => anchor.kind)
  )

  return (
    kinds.has('domain') &&
    (
      kinds.has('operation') ||
      kinds.has('indicators') ||
      kinds.has('instruments')
    ) &&
    kinds.size >= 3
  )
    ? anchors
    : []
}

function closestAnchor(
  cell: PlanificationPdfCell,
  anchors: MatrixAnchor[]
) {
  if (anchors.length === 0) return null

  const center =
    cell.x + Math.max(0, cell.width) / 2

  return anchors.reduce(
    (best, candidate) =>
      Math.abs(candidate.x - center) <
      Math.abs(best.x - center)
        ? candidate
        : best,
    anchors[0]
  )
}

function rowValues(
  line: PlanificationPdfLine,
  anchors: MatrixAnchor[]
): Record<MatrixColumn, string> {
  const buckets: Record<MatrixColumn, string[]> = {
    domain: [],
    weight: [],
    operation: [],
    indicators: [],
    instruments: []
  }
  const positioned =
    line.positionedCells ?? []

  if (positioned.length > 0) {
    for (const cell of positioned) {
      const anchor = closestAnchor(
        cell,
        anchors
      )

      if (!anchor) continue

      const value = clean(cell.text)
      if (value) buckets[anchor.kind].push(value)
    }
  } else {
    for (const anchor of anchors) {
      const value = clean(
        line.cells[anchor.index] ?? ''
      )

      if (value) buckets[anchor.kind].push(value)
    }
  }

  return {
    domain: unique(buckets.domain).join(' '),
    weight: unique(buckets.weight).join(' '),
    operation: unique(buckets.operation).join(' '),
    indicators: unique(buckets.indicators).join(' '),
    instruments: unique(buckets.instruments).join(' ')
  }
}

function metadataField(
  document: PlanificationPdfDocument,
  patterns: RegExp[]
): CriteriaImportMetadataField | null {
  for (const page of document.pages) {
    for (const line of page.lines) {
      const text = clean(line.text)

      for (const pattern of patterns) {
        const match = text.match(pattern)
        const value = clean(match?.[1] ?? '')

        if (value) {
          return {
            value,
            sourceText: text,
            sourcePage: page.pageNumber,
            confidence: 'high'
          }
        }
      }

      const cells = line.cells.map(clean)

      for (
        let index = 0;
        index < cells.length - 1;
        index += 1
      ) {
        const combined =
          `${cells[index]}: ${cells[index + 1]}`

        for (const pattern of patterns) {
          const match = combined.match(pattern)
          const value = clean(match?.[1] ?? '')

          if (value) {
            return {
              value,
              sourceText: text,
              sourcePage: page.pageNumber,
              confidence: 'high'
            }
          }
        }
      }
    }
  }

  return null
}

function extractMetadata(
  document: PlanificationPdfDocument
): AssessmentCriteriaPdfMetadata {
  return {
    subject: metadataField(
      document,
      [
        /\bdisciplina\s*[:–—-]\s*(.+)$/i,
        /\b[áa]rea disciplinar\s*[:–—-]\s*(.+)$/i,
        /\bcrit[eé]rios?\s+de\s+avalia[çc][ãa]o\s*[:–—-]\s*(.+)$/i
      ]
    ),
    course: metadataField(
      document,
      [
        /\bcurso profissional(?:\s+de)?\s*[:–—-]?\s*(.+)$/i,
        /\bcurso\s*[:–—-]\s*(.+)$/i
      ]
    ),
    grade: metadataField(
      document,
      [
        /\bano de escolaridade\s*[:–—-]\s*(.+)$/i,
        /\bano\s*[:–—-]\s*(.+)$/i
      ]
    ),
    group: metadataField(
      document,
      [
        /\bturma\s*[:–—-]\s*(.+)$/i
      ]
    )
  }
}

function parsePercentage(value: string) {
  const match = clean(value)
    .replace(',', '.')
    .match(/(^|[^\d])(\d{1,3}(?:\.\d+)?)\s*%/)
  const parsed = Number(match?.[2] ?? NaN)

  return (
    Number.isFinite(parsed) &&
    parsed > 0 &&
    parsed <= 100
  )
    ? parsed
    : null
}

function rowWeight(row: MatrixRow) {
  return (
    parsePercentage(row.values.weight) ??
    parsePercentage(row.values.domain)
  )
}

function isBoundary(line: PlanificationPdfLine) {
  const value = normalize(line.text)

  return (
    /^niveis? de desempenho\b/.test(value) ||
    /^contributos? para o perfil\b/.test(value) ||
    /^perfil do aluno\b/.test(value) ||
    /^resumo estruturado\b/.test(value)
  )
}

function stripWeight(value: string) {
  return clean(
    value
      .replace(/\(\s*\d{1,3}(?:[.,]\d+)?\s*%\s*\)/g, ' ')
      .replace(/\b\d{1,3}(?:[.,]\d+)?\s*%\b/g, ' ')
      .replace(/^dominio\s*\d*\s*[:–—-]?\s*/i, '')
  )
}

function nearestWeightedIndex(
  rows: MatrixRow[],
  weightedIndexes: number[],
  rowIndex: number
) {
  const pageNumber = rows[rowIndex].pageNumber
  const candidates = weightedIndexes.filter(
    index => rows[index].pageNumber === pageNumber
  )

  if (candidates.length === 0) return null

  return candidates.reduce(
    (best, candidate) => {
      const currentDistance =
        Math.abs(candidate - rowIndex)
      const bestDistance =
        Math.abs(best - rowIndex)

      return currentDistance <= bestDistance
        ? candidate
        : best
    },
    candidates[0]
  )
}

function domainNameFor(
  rows: MatrixRow[],
  weightedIndexes: number[],
  targetIndex: number
) {
  const parts: Array<{
    index: number
    value: string
  }> = []

  for (
    let index = 0;
    index < rows.length;
    index += 1
  ) {
    if (
      rows[index].pageNumber !==
        rows[targetIndex].pageNumber ||
      Math.abs(index - targetIndex) > 8 ||
      nearestWeightedIndex(
        rows,
        weightedIndexes,
        index
      ) !== targetIndex
    ) {
      continue
    }

    const value = stripWeight(
      rows[index].values.domain
    )

    if (
      value &&
      normalize(value) !== 'dominio'
    ) {
      parts.push({ index, value })
    }
  }

  return unique(
    parts
      .sort((left, right) =>
        left.index - right.index
      )
      .map(part => part.value)
  ).join(' ')
}

function mergeDuplicates(
  candidates: AssessmentCriteriaPdfCandidate[]
) {
  const byKey =
    new Map<string, AssessmentCriteriaPdfCandidate>()

  for (const candidate of candidates) {
    const key =
      `${normalize(candidate.name)}|${candidate.weightPercent}`
    const current = byKey.get(key)

    if (!current) {
      byKey.set(key, candidate)
      continue
    }

    byKey.set(
      key,
      {
        ...current,
        sourcePages: Array.from(
          new Set([
            ...current.sourcePages,
            ...candidate.sourcePages
          ])
        ).sort((left, right) => left - right),
        subcriteria: unique([
          ...current.subcriteria,
          ...candidate.subcriteria
        ])
      }
    )
  }

  return Array.from(byKey.values())
}

export function parseProfessionalAssessmentCriteriaMatrix(
  document: PlanificationPdfDocument
): ProfessionalCriteriaMatrixResult | null {
  const rows: MatrixRow[] = []
  let activeAnchors: MatrixAnchor[] = []

  for (const page of document.pages) {
    for (const line of page.lines) {
      const header = headerAnchors(line)

      if (header.length > 0) {
        activeAnchors = header
        continue
      }

      if (activeAnchors.length === 0) continue

      if (isBoundary(line)) {
        activeAnchors = []
        continue
      }

      rows.push({
        pageNumber: page.pageNumber,
        values: rowValues(
          line,
          activeAnchors
        )
      })
    }
  }

  const weightedIndexes = rows.flatMap(
    (row, index) =>
      rowWeight(row) === null
        ? []
        : [index]
  )

  if (weightedIndexes.length < 2) {
    return null
  }

  const rawCandidates =
    weightedIndexes.flatMap(
      (index, ordinal): AssessmentCriteriaPdfCandidate[] => {
        const weightPercent = rowWeight(
          rows[index]
        )
        const name = domainNameFor(
          rows,
          weightedIndexes,
          index
        )

        if (
          weightPercent === null ||
          !name ||
          /^(?:total|soma)\b/i.test(name)
        ) {
          return []
        }

        return [{
          id:
            `criteria-matrix-p${rows[index].pageNumber}-r${ordinal + 1}`,
          name,
          description: '',
          domainLabel: '',
          subcriteria: [],
          weightPercent,
          sourcePages: [
            rows[index].pageNumber
          ],
          confidence: 'high',
          warnings: []
        }]
      }
    )

  const candidates =
    mergeDuplicates(rawCandidates)

  if (candidates.length < 2) {
    return null
  }

  const total = candidates.reduce(
    (sum, candidate) =>
      sum + (candidate.weightPercent ?? 0),
    0
  )
  const warnings = [
    'Foi reconhecida uma matriz de critérios por domínio. Operacionalizações, indicadores, instrumentos e níveis de desempenho não foram transformados em critérios autónomos.'
  ]

  if (Math.abs(total - 100) > 0.001) {
    warnings.unshift(
      `As ponderações detetadas na matriz totalizam ${total}%, não 100%. Confirme a estrutura do documento.`
    )
  }

  return {
    metadata: extractMetadata(document),
    candidates,
    warnings
  }
}
