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

export interface PlanificationSpreadsheetParseResult {
  sections: ParsedPlanificationPdfSection[]
  text: string
  warnings: string[]
}

const MAX_HEADER_SCAN_ROWS = 80
const MAX_HEADER_SPAN = 3

function cellText(
  value: unknown
) {
  if (
    value === null ||
    value === undefined
  ) {
    return ''
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString()
  }

  return String(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

function normalizeComparable(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[()\[\]{}:;,.º°ª_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactLines(
  value: string
) {
  const seen =
    new Set<string>()

  return value
    .split(/\n+/)
    .map(line =>
      line
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(line => {
      const key =
        normalizeComparable(
          line
        )

      if (
        !key ||
        seen.has(key)
      ) {
        return false
      }

      seen.add(key)
      return true
    })
    .join('\n')
}

function appendText(
  current: string,
  next: string
) {
  return compactLines(
    [
      current,
      next
    ]
      .filter(Boolean)
      .join('\n')
  )
}

function headerKind(
  value: string
): ColumnKind | null {
  const normalized =
    normalizeComparable(
      value
    )

  if (!normalized) {
    return null
  }

  if (
    normalized.includes('periodo') &&
    normalized.includes('letivo')
  ) {
    return 'period'
  }

  if (
    normalized === 'ufcd' ||
    normalized.startsWith('ufcd ') ||
    normalized === 'uc' ||
    normalized.startsWith('uc ') ||
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
    normalized.includes('aula') &&
    normalized.includes('previst')
  ) {
    return 'lessons'
  }

  if (
    normalized.includes('tempos') &&
    normalized.includes('letiv')
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
  const selected =
    rows.slice(
      startRow,
      startRow + span
    )

  const width =
    Math.max(
      0,
      ...selected.map(row =>
        row.length
      )
    )

  return Array.from(
    {
      length: width
    },
    (_, columnIndex) =>
      selected
        .map(row =>
          cellText(
            row[columnIndex]
          )
        )
        .filter(Boolean)
        .join(' ')
  )
}

function detectHeader(
  rows: SpreadsheetRow[]
): HeaderCandidate | null {
  let best:
    HeaderCandidate | null =
    null

  const limit =
    Math.min(
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
      const values =
        combinedHeaderRow(
          rows,
          startRow,
          span
        )

      const columns:
        ColumnMap = {}

      values.forEach(
        (
          value,
          columnIndex
        ) => {
          const kind =
            headerKind(
              value
            )

          if (
            kind &&
            columns[kind] ===
              undefined
          ) {
            columns[kind] =
              columnIndex
          }
        }
      )

      const kinds =
        Object.keys(
          columns
        ) as ColumnKind[]

      const score =
        kinds.length

      const required =
        columns.module !==
          undefined &&
        columns.contents !==
          undefined &&
        columns.objectives !==
          undefined

      if (
        !required ||
        score < 4
      ) {
        continue
      }

      const candidate = {
        startRow,
        endRow:
          startRow +
          span -
          1,
        columns,
        score
      }

      if (
        !best ||
        candidate.score >
          best.score ||
        (
          candidate.score ===
            best.score &&
          candidate.startRow <
            best.startRow
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
  return index ===
    undefined
    ? ''
    : cellText(
        row[index]
      )
}

function parseDurationHours(
  value: string
) {
  const match =
    value.match(
      /\b(\d+(?:[.,]\d+)?)\s*(?:horas?|h)\b/i
    )

  if (!match) {
    return null
  }

  const parsed =
    Number(
      match[1]
        .replace(
          ',',
          '.'
        )
    )

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null
}

function parsePlannedLessons(
  value: string
) {
  const match =
    value.match(
      /\b(\d{1,3})\b/
    )

  if (!match) {
    return null
  }

  const parsed =
    Number(
      match[1]
    )

  return Number.isInteger(
    parsed
  ) &&
  parsed > 0
    ? parsed
    : null
}

function moduleDescriptor(
  value: string
) {
  const normalized =
    value
      .replace(/\s+/g, ' ')
      .trim()

  if (!normalized) {
    return null
  }

  const ufcd =
    normalized.match(
      /\bufcd\s*[.:#-]?\s*(\d{3,6})\b/i
    )

  const explicitModule =
    normalized.match(
      /\bm[oó]dulo\s*(?:n[.ºo°]*\s*)?[.:#-]?\s*([A-Za-z0-9][A-Za-z0-9._/-]{0,15})\b/i
    )

  const competenceUnit =
    normalized.match(
      /\buc\s*[.:#-]?\s*(\d{3,6})\b/i
    )

  const leadingNumeric =
    normalized.match(
      /^(\d{3,6})(?:\b|(?=\s*\())/
    )

  const leadingAlphaNumeric =
    normalized.match(
      /^([A-Za-z]*\d[A-Za-z0-9._/-]{0,15})(?:\b|(?=\s*[-–—:(]))/
    )

  const code =
    ufcd?.[1] ??
    explicitModule?.[1] ??
    (
      competenceUnit
        ? `UC${competenceUnit[1]}`
        : undefined
    ) ??
    leadingNumeric?.[1] ??
    leadingAlphaNumeric?.[1] ??
    ''

  if (!code) {
    return null
  }

  let name =
    normalized

  if (ufcd) {
    name =
      name.replace(
        ufcd[0],
        ' '
      )
  } else if (explicitModule) {
    name =
      name.replace(
        explicitModule[0],
        ' '
      )
  } else if (competenceUnit) {
    name =
      name.replace(
        competenceUnit[0],
        ' '
      )
  } else {
    name =
      name.replace(
        new RegExp(
          `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i'
        ),
        ' '
      )
  }

  name =
    name
      .replace(
        /\(?\s*\d+(?:[.,]\d+)?\s*(?:horas?|h)\s*\)?/gi,
        ' '
      )
      .replace(
        /^[\s–—:;-]+|[\s–—:;-]+$/g,
        ''
      )
      .replace(/\s+/g, ' ')
      .trim()

  return {
    code,
    name,
    durationHours:
      parseDurationHours(
        normalized
      )
  }
}

function splitStrategies(
  value: string
) {
  const text =
    compactLines(
      value
    )

  const comparable =
    normalizeComparable(
      text
    )

  const marker =
    comparable.indexOf(
      'uso de'
    )

  if (
    marker === -1
  ) {
    return {
      methodologyText:
        text
          .replace(
            /^\s*m[eé]todos?\s*:\s*/i,
            ''
          )
          .trim(),
      resourcesText: ''
    }
  }

  const originalMarker =
    text.search(
      /\bus[oa]\s+de\s*:/i
    )

  if (
    originalMarker === -1
  ) {
    return {
      methodologyText: text,
      resourcesText: ''
    }
  }

  const matchedMarker =
    text
      .slice(
        originalMarker
      )
      .match(
        /^\bus[oa]\s+de\s*:/i
      )?.[0] ??
    ''

  return {
    methodologyText:
      text
        .slice(
          0,
          originalMarker
        )
        .replace(
          /^\s*m[eé]todos?\s*:\s*/i,
          ''
        )
        .trim(),
    resourcesText:
      text
        .slice(
          originalMarker +
            matchedMarker.length
        )
        .trim()
  }
}

function isEvaluationRow(
  row: SpreadsheetRow
) {
  return row.some(value => {
    const normalized =
      normalizeComparable(
        cellText(
          value
        )
      )

    return (
      normalized ===
        'avaliacao' ||
      normalized.startsWith(
        'avaliacao '
      )
    )
  })
}

function evaluationText(
  row: SpreadsheetRow
) {
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

function createSection(
  sourceDocumentName: string,
  sheetName: string,
  descriptor: NonNullable<
    ReturnType<
      typeof moduleDescriptor
    >
  >,
  periodLabel: string,
  contentsText: string,
  objectivesText: string,
  strategiesText: string,
  plannedLessonsText: string
): ParsedPlanificationPdfSection {
  const strategies =
    splitStrategies(
      strategiesText
    )

  const warnings: string[] = [
    `Origem Excel: folha “${sheetName}”.`
  ]

  if (!descriptor.name) {
    warnings.push(
      'A designação da UFCD/módulo não foi identificada com segurança.'
    )
  }

  if (
    descriptor.durationHours ===
    null
  ) {
    warnings.push(
      'A duração da UFCD/módulo não foi identificada.'
    )
  }

  const plannedLessons =
    parsePlannedLessons(
      plannedLessonsText
    )

  if (
    plannedLessons ===
    null
  ) {
    warnings.push(
      'O número de aulas/tempos previstos não foi identificado.'
    )
  }

  return {
    sourceDocumentName,
    sourcePages: [],
    code:
      descriptor.code,
    name:
      descriptor.name,
    durationHours:
      descriptor.durationHours,
    plannedLessons,
    periodLabel:
      compactLines(
        periodLabel
      ),
    contentsText:
      compactLines(
        contentsText
      ),
    objectivesText:
      compactLines(
        objectivesText
      ),
    methodologyText:
      strategies.methodologyText,
    resourcesText:
      strategies.resourcesText,
    evaluationText: '',
    warnings
  }
}

function appendRowToSection(
  section: ParsedPlanificationPdfSection,
  periodLabel: string,
  contentsText: string,
  objectivesText: string,
  strategiesText: string,
  plannedLessonsText: string
) {
  const strategies =
    splitStrategies(
      strategiesText
    )

  return {
    ...section,
    periodLabel:
      appendText(
        section.periodLabel,
        periodLabel
      ),
    contentsText:
      appendText(
        section.contentsText,
        contentsText
      ),
    objectivesText:
      appendText(
        section.objectivesText,
        objectivesText
      ),
    methodologyText:
      appendText(
        section.methodologyText,
        strategies.methodologyText
      ),
    resourcesText:
      appendText(
        section.resourcesText,
        strategies.resourcesText
      ),
    plannedLessons:
      section.plannedLessons ??
      parsePlannedLessons(
        plannedLessonsText
      )
  }
}

export function parsePlanificationSpreadsheetRows(
  rows: SpreadsheetRow[],
  sourceDocumentName: string,
  sheetName = 'Folha 1'
): PlanificationSpreadsheetParseResult {
  const text =
    rows
      .map(row =>
        row
          .map(cellText)
          .filter(Boolean)
          .join(' | ')
      )
      .filter(Boolean)
      .join('\n')

  const header =
    detectHeader(
      rows
    )

  if (!header) {
    return {
      sections: [],
      text,
      warnings: [
        `A folha “${sheetName}” não contém uma grelha de planificação reconhecível.`
      ]
    }
  }

  const sections:
    ParsedPlanificationPdfSection[] =
    []

  let currentIndex = -1

  for (
    let rowIndex =
      header.endRow + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex]

    if (
      !row ||
      row.every(value =>
        !cellText(value)
      )
    ) {
      continue
    }

    if (
      detectHeader([
        row
      ])
    ) {
      continue
    }

    if (
      isEvaluationRow(
        row
      )
    ) {
      if (
        currentIndex >= 0
      ) {
        const current =
          sections[currentIndex]

        sections[currentIndex] = {
          ...current,
          evaluationText:
            appendText(
              current.evaluationText,
              evaluationText(
                row
              )
            )
        }
      }

      continue
    }

    const moduleText =
      valueAt(
        row,
        header.columns.module
      )

    const descriptor =
      moduleDescriptor(
        moduleText
      )

    const periodLabel =
      valueAt(
        row,
        header.columns.period
      )

    const contentsText =
      valueAt(
        row,
        header.columns.contents
      )

    const objectivesText =
      valueAt(
        row,
        header.columns.objectives
      )

    const strategiesText =
      valueAt(
        row,
        header.columns.strategies
      )

    const plannedLessonsText =
      valueAt(
        row,
        header.columns.lessons
      )

    if (descriptor) {
      const current =
        currentIndex >= 0
          ? sections[
              currentIndex
            ]
          : null

      if (
        current &&
        current.code ===
          descriptor.code
      ) {
        sections[currentIndex] =
          appendRowToSection(
            current,
            periodLabel,
            contentsText,
            objectivesText,
            strategiesText,
            plannedLessonsText
          )

        continue
      }

      sections.push(
        createSection(
          sourceDocumentName,
          sheetName,
          descriptor,
          periodLabel,
          contentsText,
          objectivesText,
          strategiesText,
          plannedLessonsText
        )
      )

      currentIndex =
        sections.length - 1

      continue
    }

    if (
      currentIndex >= 0
    ) {
      sections[currentIndex] =
        appendRowToSection(
          sections[currentIndex],
          periodLabel,
          contentsText,
          objectivesText,
          strategiesText,
          plannedLessonsText
        )
    }
  }

  return {
    sections,
    text,
    warnings: []
  }
}

export async function extractPlanificationSpreadsheet(
  bytes: Uint8Array,
  sourceDocumentName: string
): Promise<PlanificationSpreadsheetParseResult> {
  const XLSX =
    await import('xlsx')

  const workbook =
    XLSX.read(
      bytes,
      {
        type: 'array',
        cellDates: false
      }
    )

  if (
    workbook.SheetNames.length ===
    0
  ) {
    throw new Error(
      'O ficheiro Excel não contém folhas legíveis.'
    )
  }

  const sections:
    ParsedPlanificationPdfSection[] =
    []

  const textParts: string[] = []
  const warnings: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet =
      workbook.Sheets[
        sheetName
      ]

    if (!worksheet) {
      continue
    }

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          header: 1,
          raw: false,
          defval: '',
          blankrows: false
        }
      ) as unknown as SpreadsheetRow[]

    const parsed =
      parsePlanificationSpreadsheetRows(
        rows,
        sourceDocumentName,
        sheetName
      )

    if (parsed.text) {
      textParts.push(
        parsed.text
      )
    }

    if (
      parsed.sections.length > 0
    ) {
      sections.push(
        ...parsed.sections
      )
    } else if (
      parsed.text.trim()
    ) {
      warnings.push(
        ...parsed.warnings
      )
    }
  }

  if (
    sections.length ===
    0
  ) {
    throw new Error(
      'Não foram encontradas UFCD ou módulos estruturados nas folhas deste Excel.'
    )
  }

  const counts =
    sections.reduce(
      (
        result,
        section
      ) => {
        result.set(
          section.code,
          (
            result.get(
              section.code
            ) ?? 0
          ) + 1
        )

        return result
      },
      new Map<string, number>()
    )

  const duplicates =
    [...counts.entries()]
      .filter(
        ([, count]) =>
          count > 1
      )
      .map(
        ([code]) =>
          code
      )

  if (
    duplicates.length >
    0
  ) {
    throw new Error(
      `Existem códigos repetidos em várias linhas/folhas do Excel: ${duplicates.join(', ')}. Reveja o ficheiro antes de importar.`
    )
  }

  return {
    sections,
    text:
      textParts.join('\n'),
    warnings: [
      ...warnings,
      'Excel: a grelha foi interpretada pelos cabeçalhos e não pela posição fixa das colunas. Reveja os dados antes de importar.'
    ]
  }
}
