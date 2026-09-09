import type {
  PlanificationPdfCell,
  PlanificationPdfDocument,
  PlanificationPdfLine
} from '../planifications/planificationPdfParser'

export type CriteriaImportConfidence =
  | 'high'
  | 'medium'
  | 'low'

export interface CriteriaImportMetadataField {
  value: string
  sourceText: string
  sourcePage: number
  confidence: CriteriaImportConfidence
}

export interface AssessmentCriteriaPdfMetadata {
  subject: CriteriaImportMetadataField | null
  course: CriteriaImportMetadataField | null
  grade: CriteriaImportMetadataField | null
  group: CriteriaImportMetadataField | null
}

export interface AssessmentCriteriaPdfCandidate {
  id: string
  name: string
  description: string
  domainLabel: string
  subcriteria: string[]
  weightPercent: number | null
  sourcePages: number[]
  confidence: CriteriaImportConfidence
  warnings: string[]
}

export interface ParsedAssessmentCriteriaPdfDocument {
  sourceDocumentName: string
  pageCount: number
  metadata: AssessmentCriteriaPdfMetadata
  candidates: AssessmentCriteriaPdfCandidate[]
  warnings: string[]
}

type HeaderKind =
  | 'criterion'
  | 'domain'
  | 'description'
  | 'weight'

type HeaderAnchor = {
  kind: HeaderKind
  x: number
  index: number
  text: string
}

type CandidateSource =
  | 'table'
  | 'explicit-cells'
  | 'explicit-line'

const HEADER_PATTERNS: Array<{
  kind: HeaderKind
  patterns: RegExp[]
}> = [
  {
    kind: 'criterion',
    patterns: [
      /\bsubcriterios?\b/,
      /\bcriterios?\b/,
      /\bindicadores?\b/,
      /\bdescritores?\b/
    ]
  },
  {
    kind: 'domain',
    patterns: [
      /\bdominios?\b/,
      /\bdimensoes?\b/,
      /\bcategorias?\b/,
      /\bareas?\b/
    ]
  },
  {
    kind: 'description',
    patterns: [
      /\bdescricao\b/,
      /\bevidencias?\b/,
      /\bobservacoes?\b/
    ]
  },
  {
    kind: 'weight',
    patterns: [
      /\bponderacao\b/,
      /\bpercentagem\b/,
      /\bpesos?\b/,
      /\bcotacao\b/,
      /%/
    ]
  }
]

function normalizeComparable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clean(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripBullet(value: string) {
  return clean(
    value.replace(
      /^\s*(?:[-–—•▪◦·*]|\d+[.)]|[a-zA-Z][.)])\s*/,
      ''
    )
  )
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const normalized = normalizeComparable(value)

    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    result.push(clean(value))
  }

  return result
}

function headerKind(value: string): HeaderKind | null {
  const normalized = normalizeComparable(value)

  if (!normalized) {
    return null
  }

  for (const candidate of HEADER_PATTERNS) {
    if (
      candidate.patterns.some(pattern =>
        pattern.test(normalized)
      )
    ) {
      return candidate.kind
    }
  }

  return null
}

function headerAnchors(line: PlanificationPdfLine) {
  const cells =
    line.positionedCells &&
    line.positionedCells.length > 0
      ? line.positionedCells
      : line.cells.map(
          (text, index): PlanificationPdfCell => ({
            text,
            x: index * 100,
            width: 80
          })
        )

  const anchors = cells.flatMap(
    (cell, index): HeaderAnchor[] => {
      const kind = headerKind(cell.text)

      return kind
        ? [{
            kind,
            x: cell.x,
            index,
            text: cell.text
          }]
        : []
    }
  )

  const kinds = new Set(
    anchors.map(anchor => anchor.kind)
  )

  const structural =
    kinds.has('criterion') ||
    kinds.has('domain')

  return structural && kinds.size >= 2
    ? anchors
    : []
}

function closestAnchor(
  cell: PlanificationPdfCell,
  anchors: HeaderAnchor[]
) {
  if (anchors.length === 0) {
    return null
  }

  const center =
    cell.x + Math.max(0, cell.width) / 2

  return anchors.reduce(
    (best, candidate) => {
      const bestDistance = Math.abs(
        center - best.x
      )
      const candidateDistance = Math.abs(
        center - candidate.x
      )

      return candidateDistance < bestDistance
        ? candidate
        : best
    },
    anchors[0]
  )
}

function rowValues(
  line: PlanificationPdfLine,
  anchors: HeaderAnchor[]
) {
  const values: Record<HeaderKind, string[]> = {
    criterion: [],
    domain: [],
    description: [],
    weight: []
  }

  const positioned = line.positionedCells ?? []

  if (positioned.length > 0) {
    for (const cell of positioned) {
      const anchor = closestAnchor(
        cell,
        anchors
      )

      if (!anchor) {
        continue
      }

      const value = clean(cell.text)
      if (value) {
        values[anchor.kind].push(value)
      }
    }
  } else {
    for (const anchor of anchors) {
      const value = clean(
        line.cells[anchor.index] ?? ''
      )

      if (value) {
        values[anchor.kind].push(value)
      }
    }
  }

  return {
    criterion: uniqueStrings(values.criterion).join(' '),
    domain: uniqueStrings(values.domain).join(' '),
    description: uniqueStrings(values.description).join('\n'),
    weight: uniqueStrings(values.weight).join(' ')
  }
}

function parsePercentage(
  value: string,
  allowBareNumber: boolean
) {
  const normalized =
    clean(value).replace(',', '.')
  const explicit = normalized.match(
    /(^|[^\d])(-?\d{1,3}(?:\.\d+)?)\s*%\b?/
  )

  const raw = explicit?.[2] ?? (
    allowBareNumber &&
    /^\s*\d{1,3}(?:\.\d+)?\s*$/.test(normalized)
      ? normalized.trim()
      : ''
  )

  if (!raw) {
    return null
  }

  const parsed = Number(raw)

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0 ||
    parsed > 100
  ) {
    return null
  }

  return parsed
}

function percentageOccurrences(value: string) {
  const matches =
    clean(value).match(
      /\d{1,3}(?:[.,]\d+)?\s*%/g
    ) ?? []

  return matches.length
}

function isTotalLabel(value: string) {
  const normalized = normalizeComparable(value)

  return (
    normalized === 'total' ||
    normalized.startsWith('total ') ||
    normalized === 'soma' ||
    normalized.startsWith('soma ')
  )
}

function pageEdgeRepeatedLines(
  document: PlanificationPdfDocument
) {
  const occurrences =
    new Map<
      string,
      Set<number>
    >()

  for (const page of document.pages) {
    const edgeLines = [
      ...page.lines.slice(0, 3),
      ...page.lines.slice(-3)
    ]

    for (const line of edgeLines) {
      const normalized =
        normalizeComparable(line.text)

      if (normalized.length < 4) {
        continue
      }

      const pages =
        occurrences.get(normalized) ??
        new Set<number>()

      pages.add(page.pageNumber)
      occurrences.set(normalized, pages)
    }
  }

  return new Set(
    Array.from(occurrences.entries())
      .filter(([, pages]) => pages.size >= 2)
      .map(([value]) => value)
  )
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
        const label =
          normalizeComparable(cells[index])

        if (
          patterns.some(pattern =>
            pattern.test(`${label}: ${cells[index + 1]}`)
          )
        ) {
          const value = cells[index + 1]

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
        /\barea disciplinar\s*[:–—-]\s*(.+)$/i
      ]
    ),
    course: metadataField(
      document,
      [
        /\bcurso profissional\s*[:–—-]\s*(.+)$/i,
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

function candidateId(
  pageNumber: number,
  ordinal: number
) {
  return `criteria-p${pageNumber}-r${ordinal}`
}

function buildCandidate(
  pageNumber: number,
  ordinal: number,
  source: CandidateSource,
  input: {
    name: string
    domainLabel?: string
    description?: string
    weightText?: string
    allowBareWeight?: boolean
  }
): AssessmentCriteriaPdfCandidate | null {
  const name = stripBullet(input.name)

  if (!name || isTotalLabel(name)) {
    return null
  }

  const domainLabel =
    clean(input.domainLabel ?? '')
  const description =
    clean(input.description ?? '')
  const weightPercent =
    parsePercentage(
      input.weightText ?? '',
      Boolean(input.allowBareWeight)
    )
  const warnings: string[] = []

  if (weightPercent === null) {
    warnings.push(
      'Ponderação não identificada com segurança; confirme-a antes de importar.'
    )
  }

  if (
    source !== 'table'
  ) {
    warnings.push(
      'A estrutura da tabela não foi identificada de forma completa; confirme este critério.'
    )
  }

  if (
    domainLabel &&
    normalizeComparable(domainLabel) !==
      normalizeComparable(name)
  ) {
    warnings.push(
      'Foi detetado um domínio/dimensão. O modelo atual não guarda hierarquia; essa informação será mostrada na revisão e não deve ser perdida silenciosamente.'
    )
  }

  return {
    id: candidateId(pageNumber, ordinal),
    name,
    description,
    domainLabel,
    subcriteria: [],
    weightPercent,
    sourcePages: [pageNumber],
    confidence:
      source === 'table' && weightPercent !== null
        ? 'high'
        : source === 'table' || weightPercent !== null
          ? 'medium'
          : 'low',
    warnings
  }
}

function candidateFromExplicitCells(
  line: PlanificationPdfLine,
  pageNumber: number,
  ordinal: number
) {
  const cells =
    (line.positionedCells ?? []).length > 0
      ? (line.positionedCells ?? []).map(cell => clean(cell.text))
      : line.cells.map(clean)
  const weightCells = cells.filter(
    value => percentageOccurrences(value) === 1
  )

  if (weightCells.length !== 1) {
    return null
  }

  const weightText = weightCells[0]
  const textCells = cells.filter(
    value =>
      value &&
      value !== weightText &&
      !headerKind(value)
  )

  if (textCells.length === 0) {
    return null
  }

  const name = textCells[0]

  return buildCandidate(
    pageNumber,
    ordinal,
    'explicit-cells',
    {
      name,
      description:
        textCells.slice(1).join('\n'),
      weightText
    }
  )
}

function candidateFromExplicitLine(
  line: PlanificationPdfLine,
  pageNumber: number,
  ordinal: number
) {
  const text = clean(line.text)

  if (
    percentageOccurrences(text) !== 1 ||
    headerAnchors(line).length > 0
  ) {
    return null
  }

  const match = text.match(
    /\d{1,3}(?:[.,]\d+)?\s*%/
  )

  if (!match || match.index === undefined) {
    return null
  }

  const before = stripBullet(
    text.slice(0, match.index)
      .replace(/[|:;–—-]+\s*$/, '')
  )
  const after = stripBullet(
    text.slice(
      match.index + match[0].length
    ).replace(/^\s*[|:;–—-]+/, '')
  )
  const name = before || after
  const description =
    before && after
      ? after
      : ''

  return buildCandidate(
    pageNumber,
    ordinal,
    'explicit-line',
    {
      name,
      description,
      weightText: match[0]
    }
  )
}

function sumKnownWeights(
  candidates: AssessmentCriteriaPdfCandidate[]
) {
  return candidates.reduce(
    (total, candidate) =>
      total + (candidate.weightPercent ?? 0),
    0
  )
}

export function parseAssessmentCriteriaPdfDocument(
  document: PlanificationPdfDocument,
  sourceDocumentName: string
): ParsedAssessmentCriteriaPdfDocument {
  const repeatedEdgeText =
    pageEdgeRepeatedLines(document)
  const candidates:
    AssessmentCriteriaPdfCandidate[] = []
  const warnings: string[] = []
  let ordinal = 0

  for (const page of document.pages) {
    let activeAnchors: HeaderAnchor[] = []

    for (const line of page.lines) {
      const normalizedLine =
        normalizeComparable(line.text)
      const anchors =
        headerAnchors(line)

      if (anchors.length > 0) {
        activeAnchors = anchors
        continue
      }

      if (
        !normalizedLine ||
        repeatedEdgeText.has(normalizedLine)
      ) {
        continue
      }

      if (activeAnchors.length > 0) {
        const values =
          rowValues(line, activeAnchors)
        const criterion =
          values.criterion ||
          (
            !values.criterion &&
            values.domain &&
            values.weight
              ? values.domain
              : ''
          )

        if (
          !criterion &&
          !values.weight
        ) {
          continue
        }

        ordinal += 1
        const candidate =
          buildCandidate(
            page.pageNumber,
            ordinal,
            'table',
            {
              name: criterion,
              domainLabel:
                values.criterion
                  ? values.domain
                  : '',
              description:
                values.description,
              weightText:
                values.weight,
              allowBareWeight: true
            }
          )

        if (candidate) {
          candidates.push(candidate)
        }

        continue
      }

      ordinal += 1
      const explicitCells =
        candidateFromExplicitCells(
          line,
          page.pageNumber,
          ordinal
        )

      if (explicitCells) {
        candidates.push(explicitCells)
        continue
      }

      const explicitLine =
        candidateFromExplicitLine(
          line,
          page.pageNumber,
          ordinal
        )

      if (explicitLine) {
        candidates.push(explicitLine)
        continue
      }

      if (percentageOccurrences(line.text) > 1) {
        warnings.push(
          `Página ${page.pageNumber}: existe uma linha com várias percentagens que não foi dividida automaticamente.`
        )
      }
    }
  }

  if (candidates.length === 0) {
    warnings.push(
      'Não foi possível identificar critérios de avaliação com segurança. Nenhum critério foi inventado.'
    )
  }

  const missingWeights =
    candidates.filter(
      candidate =>
        candidate.weightPercent === null
    ).length

  if (missingWeights > 0) {
    warnings.push(
      `${missingWeights} critério${missingWeights === 1 ? '' : 's'} sem ponderação segura; complete a revisão antes de importar.`
    )
  }

  if (
    candidates.length > 0 &&
    missingWeights === 0
  ) {
    const total =
      sumKnownWeights(candidates)

    if (Math.abs(total - 100) > 0.001) {
      warnings.push(
        `As ponderações detetadas totalizam ${total}%, não 100%. Confirme a estrutura do documento.`
      )
    }
  }

  return {
    sourceDocumentName,
    pageCount: document.pageCount,
    metadata: extractMetadata(document),
    candidates,
    warnings: uniqueStrings(warnings)
  }
}
