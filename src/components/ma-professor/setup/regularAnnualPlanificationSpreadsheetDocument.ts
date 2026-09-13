import type {
  ParsedPlanificationPdfSection
} from '../planifications/planificationPdfParser'

type SpreadsheetRow = unknown[]

type ColumnKind =
  | 'period'
  | 'module'
  | 'contents'
  | 'objectives'
  | 'strategies'
  | 'resources'
  | 'evaluation'
  | 'lessons'

type ColumnMap = Partial<
  Record<ColumnKind, number>
>

type HeaderCandidate = {
  startRow: number
  endRow: number
  columns: ColumnMap
  score: number
}

export interface RegularAnnualSpreadsheetParseResult {
  sections: ParsedPlanificationPdfSection[]
  text: string
  warnings: string[]
}

const MAX_HEADER_SCAN_ROWS = 80
const MAX_HEADER_SPAN = 3

function cellText(value: unknown) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

function normalizeComparable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[()\[\]{}:;,.º°ª_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactLines(value: string) {
  const seen = new Set<string>()

  return value
    .split(/\n+/)
    .map(line =>
      line
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(line => {
      const key = normalizeComparable(line)

      if (!key || seen.has(key)) {
        return false
      }

      seen.add(key)
      return true
    })
    .join('\n')
}

function appendText(current: string, next: string) {
  return compactLines(
    [current, next]
      .filter(Boolean)
      .join('\n')
  )
}

function headerKind(value: string): ColumnKind | null {
  const normalized = normalizeComparable(value)

  if (!normalized) return null

  if (
    normalized.includes('periodo') &&
    normalized.includes('letivo')
  ) {
    return 'period'
  }

  if (
    normalized === 'ufcd' ||
    normalized.startsWith('ufcd ') ||
    normalized === 'modulo' ||
    normalized.startsWith('modulo ')
  ) {
    return 'module'
  }

  if (
    normalized.includes('conteudo') ||
    normalized.includes('tema')
  ) {
    return 'contents'
  }

  if (
    normalized.includes('objetivo') ||
    normalized.includes('competencia')
  ) {
    return 'objectives'
  }

  if (
    normalized.includes('estrategia') ||
    normalized.includes('metodologia')
  ) {
    return 'strategies'
  }

  if (
    normalized === 'recursos' ||
    normalized.startsWith('recursos ')
  ) {
    return 'resources'
  }

  if (
    normalized === 'avaliacao' ||
    normalized.startsWith('avaliacao ')
  ) {
    return 'evaluation'
  }

  if (
    (
      normalized.includes('aula') &&
      normalized.includes('previst')
    ) ||
    (
      normalized.includes('tempos') &&
      normalized.includes('letiv')
    )
  ) {
    return 'lessons'
  }

  return null
}

function combinedHeaderRow(
  rows: SpreadsheetRow[],
  startRow: number,
  span: number
) {
  const selected = rows.slice(
    startRow,
    startRow + span
  )

  const width = Math.max(
    0,
    ...selected.map(row => row.length)
  )

  return Array.from(
    { length: width },
    (_, columnIndex) =>
      selected
        .map(row => cellText(row[columnIndex]))
        .filter(Boolean)
        .join(' ')
  )
}

function detectHeader(
  rows: SpreadsheetRow[]
): HeaderCandidate | null {
  let best: HeaderCandidate | null = null
  const limit = Math.min(
    rows.length,
    MAX_HEADER_SCAN_ROWS
  )

  for (
    let startRow = 0;
    startRow < limit;
    startRow += 1
  ) {
    for (
      let span = 1;
      span <= MAX_HEADER_SPAN &&
      startRow + span <= limit;
      span += 1
    ) {
      const values = combinedHeaderRow(
        rows,
        startRow,
        span
      )
      const columns: ColumnMap = {}

      values.forEach((value, columnIndex) => {
        const kind = headerKind(value)

        if (
          kind &&
          columns[kind] === undefined
        ) {
          columns[kind] = columnIndex
        }
      })

      if (
        columns.module !== undefined ||
        columns.contents === undefined ||
        columns.objectives === undefined
      ) {
        continue
      }

      const kinds = Object.keys(
        columns
      ) as ColumnKind[]
      const score = kinds.length
      const hasSupportingColumn =
        columns.period !== undefined ||
        columns.strategies !== undefined ||
        columns.resources !== undefined ||
        columns.evaluation !== undefined ||
        columns.lessons !== undefined

      if (
        score < 3 ||
        !hasSupportingColumn
      ) {
        continue
      }

      const candidate = {
        startRow,
        endRow: startRow + span - 1,
        columns,
        score
      }

      if (
        !best ||
        candidate.score > best.score ||
        (
          candidate.score === best.score &&
          candidate.startRow < best.startRow
        )
      ) {
        best = candidate
      }
    }
  }

  return best
}

function valueAt(
  row: SpreadsheetRow,
  index: number | undefined
) {
  return index === undefined
    ? ''
    : cellText(row[index])
}

function parsePlannedLessons(value: string) {
  const match = value.match(
    /\b(\d{1,4})\b/
  )

  if (!match) return null

  const parsed = Number(match[1])

  return Number.isInteger(parsed) &&
    parsed > 0
    ? parsed
    : null
}

function isEvaluationRow(row: SpreadsheetRow) {
  return row.some(value => {
    const normalized = normalizeComparable(
      cellText(value)
    )

    return normalized === 'avaliacao' ||
      normalized.startsWith('avaliacao ')
  })
}

function evaluationRowText(row: SpreadsheetRow) {
  return compactLines(
    row
      .map(cellText)
      .map(value =>
        value.replace(
          /^\s*avalia[cç][aã]o\s*[:–—-]?\s*/i,
          ''
        )
      )
      .filter(Boolean)
      .join('\n')
  )
}

function containsCurricularUnitEvidence(
  rows: SpreadsheetRow[]
) {
  return rows.some(row =>
    row.some(value =>
      /\b(?:UFCD|M[oó]dulo)\b/i.test(
        cellText(value)
      )
    )
  )
}

export function parseRegularAnnualPlanificationSpreadsheetRows(
  rows: SpreadsheetRow[],
  sourceDocumentName: string,
  sheetName = 'Folha 1'
): RegularAnnualSpreadsheetParseResult {
  const text = rows
    .map(row =>
      row
        .map(cellText)
        .filter(Boolean)
        .join(' | ')
    )
    .filter(Boolean)
    .join('\n')

  const header = detectHeader(rows)

  if (!header) {
    return {
      sections: [],
      text,
      warnings: [
        `A folha “${sheetName}” não contém uma grelha anual reconhecível.`
      ]
    }
  }

  if (containsCurricularUnitEvidence(rows)) {
    return {
      sections: [],
      text,
      warnings: [
        `A folha “${sheetName}” contém referências a UFCD/módulo sem uma coluna curricular identificável e não será tratada como planificação anual.`
      ]
    }
  }

  let periodLabel = ''
  let contentsText = ''
  let objectivesText = ''
  let methodologyText = ''
  let resourcesText = ''
  let evaluationText = ''
  let plannedLessons = 0
  let dataRows = 0

  for (
    let rowIndex = header.endRow + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row = rows[rowIndex]

    if (
      !row ||
      row.every(value => !cellText(value))
    ) {
      continue
    }

    if (detectHeader([row])) {
      continue
    }

    if (isEvaluationRow(row)) {
      evaluationText = appendText(
        evaluationText,
        evaluationRowText(row)
      )
      continue
    }

    const period = valueAt(
      row,
      header.columns.period
    )
    const contents = valueAt(
      row,
      header.columns.contents
    )
    const objectives = valueAt(
      row,
      header.columns.objectives
    )
    const strategies = valueAt(
      row,
      header.columns.strategies
    )
    const resources = valueAt(
      row,
      header.columns.resources
    )
    const evaluation = valueAt(
      row,
      header.columns.evaluation
    )
    const lessonText = valueAt(
      row,
      header.columns.lessons
    )

    if (
      !period &&
      !contents &&
      !objectives &&
      !strategies &&
      !resources &&
      !evaluation &&
      !lessonText
    ) {
      continue
    }

    periodLabel = appendText(
      periodLabel,
      period
    )
    contentsText = appendText(
      contentsText,
      contents
    )
    objectivesText = appendText(
      objectivesText,
      objectives
    )
    methodologyText = appendText(
      methodologyText,
      strategies
    )
    resourcesText = appendText(
      resourcesText,
      resources
    )
    evaluationText = appendText(
      evaluationText,
      evaluation
    )

    const rowLessons = parsePlannedLessons(
      lessonText
    )

    if (rowLessons !== null) {
      plannedLessons += rowLessons
    }

    if (
      contents ||
      objectives
    ) {
      dataRows += 1
    }
  }

  if (
    dataRows === 0 ||
    (!contentsText && !objectivesText)
  ) {
    return {
      sections: [],
      text,
      warnings: [
        `A folha “${sheetName}” tem cabeçalhos anuais, mas não contém conteúdos ou objetivos importáveis.`
      ]
    }
  }

  const section: ParsedPlanificationPdfSection = {
    sourceDocumentName,
    sourcePages: [],
    code: '',
    name: '',
    durationHours: null,
    plannedLessons:
      plannedLessons > 0
        ? plannedLessons
        : null,
    periodLabel,
    contentsText,
    objectivesText,
    methodologyText,
    resourcesText,
    evaluationText,
    warnings: [
      `Origem Excel: folha “${sheetName}”.`,
      'Grelha anual sem código curricular: a gravação só é permitida numa Componente anual já existente do ensino regular.'
    ]
  }

  return {
    sections: [section],
    text,
    warnings: []
  }
}

export async function extractRegularAnnualPlanificationSpreadsheet(
  bytes: Uint8Array,
  sourceDocumentName: string
): Promise<RegularAnnualSpreadsheetParseResult> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(
    bytes,
    {
      type: 'array',
      cellDates: false
    }
  )

  if (!workbook.SheetNames.length) {
    throw new Error(
      'O ficheiro Excel não contém folhas legíveis.'
    )
  }

  const matches: Array<{
    sheetName: string
    parsed: RegularAnnualSpreadsheetParseResult
  }> = []
  const textParts: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]

    if (!worksheet) continue

    const rows = XLSX.utils.sheet_to_json(
      worksheet,
      {
        header: 1,
        raw: false,
        defval: '',
        blankrows: false
      }
    ) as unknown as SpreadsheetRow[]

    const parsed =
      parseRegularAnnualPlanificationSpreadsheetRows(
        rows,
        sourceDocumentName,
        sheetName
      )

    if (parsed.text) {
      textParts.push(parsed.text)
    }

    if (parsed.sections.length) {
      matches.push({
        sheetName,
        parsed
      })
    }
  }

  if (matches.length === 0) {
    throw new Error(
      'Não foi encontrada uma grelha anual de planificação reconhecível neste Excel.'
    )
  }

  if (matches.length > 1) {
    throw new Error(
      `Foram encontradas várias grelhas anuais nas folhas ${matches.map(match => `“${match.sheetName}”`).join(', ')}. Importe uma grelha anual de cada vez para evitar associações ambíguas.`
    )
  }

  return {
    sections: matches[0].parsed.sections,
    text: textParts.join('\n'),
    warnings: [
      'Excel anual: a grelha foi reconhecida pelos cabeçalhos. Reveja conteúdos e objetivos antes de confirmar.'
    ]
  }
}
