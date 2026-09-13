import type {
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

type SpreadsheetRow = unknown[]

type HeaderKind =
  | 'processNumber'
  | 'studentNumber'
  | 'studentName'
  | 'acs'
  | 'automatic'
  | 'selfAssessment'
  | 'finalGrade'

type HeaderColumns = Partial<
  Record<HeaderKind, number>
>

type HeaderCandidate = {
  rowIndex: number
  columns: HeaderColumns
  domainColumns: number[]
  score: number
}

export type UfcdFinalGradeImportDraftChanges = {
  finalGrade?: string
  selfAssessmentGrade?: string
  usesAcs?: boolean
}

export type UfcdFinalGradeImportMatchStatus =
  | 'matched'
  | 'unmatched'
  | 'ambiguous'
  | 'invalid'

export interface ParsedUfcdFinalGradeRow {
  sourceRow: number
  processNumber: string
  studentNumber: string
  studentName: string
  finalGrade?: number
  selfAssessmentGrade?: number
  usesAcs?: boolean
  warnings: string[]
}

export interface ParsedUfcdFinalGradeSheet {
  sheetName: string
  headerScore: number
  moduleCode: string | null
  academicYearLabel: string | null
  rows: ParsedUfcdFinalGradeRow[]
  warnings: string[]
}

export interface UfcdFinalGradeImportPreviewRow
  extends ParsedUfcdFinalGradeRow {
  status: UfcdFinalGradeImportMatchStatus
  studentId: EntityId | null
  matchedStudentName: string | null
  matchedBy: 'number' | 'name' | 'both' | null
  draftChanges: UfcdFinalGradeImportDraftChanges
}

export interface UfcdFinalGradeImportPreview {
  fileName: string
  sheetName: string
  moduleCode: string | null
  academicYearLabel: string | null
  rows: UfcdFinalGradeImportPreviewRow[]
  blockingErrors: string[]
  warnings: string[]
  matchedCount: number
  unmatchedCount: number
  ambiguousCount: number
  invalidCount: number
}

const MAX_HEADER_SCAN_ROWS = 80

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
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeComparable(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[º°ª]/g, '')
    .replace(/[()\[\]{}:;,.\\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeStudentNumber(
  value: string
) {
  const compact =
    value
      .replace(/\s+/g, '')
      .trim()

  if (/^\d+$/.test(compact)) {
    return String(Number(compact))
  }

  return normalizeComparable(compact)
}

function normalizeStudentName(
  value: string
) {
  return normalizeComparable(value)
}

function normalizeModuleCode(
  value: string
) {
  return value
    .replace(/^ufcd\s*/i, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLocaleUpperCase('pt-PT')
}

function normalizeAcademicYear(
  value: string
) {
  const match =
    value.match(
      /(20\d{2})\D+(20\d{2})/
    )

  return match
    ? `${match[1]}-${match[2]}`
    : normalizeComparable(value)
}

function headerKind(
  value: unknown
): HeaderKind | null {
  const normalized =
    normalizeComparable(
      cellText(value)
    )

  if (!normalized) {
    return null
  }

  if (
    normalized.includes('processo') &&
    (
      normalized.includes('n') ||
      normalized.includes('numero')
    )
  ) {
    return 'processNumber'
  }

  if (
    normalized === 'n' ||
    normalized === 'numero' ||
    normalized === 'n aluno' ||
    normalized === 'numero aluno' ||
    normalized === 'n turma' ||
    normalized === 'numero turma'
  ) {
    return 'studentNumber'
  }

  if (
    normalized.includes('aluno') &&
    (
      normalized.includes('dominio') ||
      normalized === 'aluno' ||
      normalized.includes('nome')
    )
  ) {
    return 'studentName'
  }

  if (normalized === 'acs') {
    return 'acs'
  }

  if (
    normalized.includes('nivel automatico') ||
    normalized.includes('classificacao automatica') ||
    normalized.includes('media automatica')
  ) {
    return 'automatic'
  }

  if (
    normalized.includes('autoavaliacao') ||
    normalized.includes('auto avaliacao')
  ) {
    return 'selfAssessment'
  }

  if (
    normalized.includes('nivel final') ||
    normalized.includes('classificacao final') ||
    normalized === 'nota final'
  ) {
    return 'finalGrade'
  }

  return null
}

function isDomainHeader(
  value: unknown
) {
  const normalized =
    normalizeComparable(
      cellText(value)
    )

  return /^d\s*\d+$/.test(normalized)
}

function detectHeader(
  rows: SpreadsheetRow[]
): HeaderCandidate | null {
  let best: HeaderCandidate | null = null

  const limit =
    Math.min(
      rows.length,
      MAX_HEADER_SCAN_ROWS
    )

  for (
    let rowIndex = 0;
    rowIndex < limit;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex] ?? []

    const columns:
      HeaderColumns = {}
    const domainColumns:
      number[] = []

    row.forEach(
      (value, columnIndex) => {
        const kind =
          headerKind(value)

        if (
          kind &&
          columns[kind] === undefined
        ) {
          columns[kind] = columnIndex
        }

        if (isDomainHeader(value)) {
          domainColumns.push(columnIndex)
        }
      }
    )

    const required =
      columns.studentName !== undefined &&
      (
        columns.finalGrade !== undefined ||
        columns.selfAssessment !== undefined ||
        columns.acs !== undefined
      )

    if (!required) {
      continue
    }

    const score =
      Object.keys(columns).length * 3 +
      domainColumns.length

    const candidate: HeaderCandidate = {
      rowIndex,
      columns,
      domainColumns,
      score
    }

    if (
      !best ||
      candidate.score > best.score ||
      (
        candidate.score === best.score &&
        candidate.rowIndex < best.rowIndex
      )
    ) {
      best = candidate
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

function numericCell(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null
  }

  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    return value
  }

  const text =
    cellText(value)
      .replace(/\s+/g, '')
      .replace(',', '.')

  if (!text) {
    return null
  }

  const parsed = Number(text)

  return Number.isFinite(parsed)
    ? parsed
    : null
}

function parseOptionalIntegerGrade(
  value: unknown,
  label: string,
  warnings: string[]
) {
  const text = cellText(value)

  if (!text) {
    return undefined
  }

  const numeric = numericCell(value)

  if (
    numeric === null ||
    !Number.isInteger(numeric) ||
    numeric < 0 ||
    numeric > 20
  ) {
    warnings.push(
      `${label} ignorada porque não é um número inteiro entre 0 e 20.`
    )
    return undefined
  }

  return numeric
}

function parseAcs(
  value: unknown,
  domainValues: unknown[],
  warnings: string[]
): boolean | undefined {
  const text = cellText(value)
  const normalized =
    normalizeComparable(text)
  const domainsWithValues =
    domainValues.filter(
      domainValue =>
        cellText(domainValue) !== ''
    )

  if (text) {
    if (
      [
        'sim',
        's',
        'x',
        'acs',
        '100',
        '100%'
      ].includes(normalized)
    ) {
      return true
    }

    if (
      [
        'nao',
        'n',
        'false'
      ].includes(normalized)
    ) {
      return false
    }

    const numeric = numericCell(value)

    if (numeric !== null) {
      if (domainsWithValues.length > 0) {
        warnings.push(
          'A coluna ACS tem valor ao mesmo tempo que existem domínios preenchidos; a marcação ACS não foi importada.'
        )
        return undefined
      }

      return true
    }

    warnings.push(
      'O valor da coluna ACS não foi reconhecido e foi ignorado.'
    )
    return undefined
  }

  if (domainsWithValues.length > 0) {
    return false
  }

  return undefined
}

function extractMetadata(
  rows: SpreadsheetRow[],
  headerRowIndex: number
) {
  const topText =
    rows
      .slice(
        0,
        Math.min(
          headerRowIndex,
          30
        )
      )
      .flatMap(row =>
        row.map(cellText)
      )
      .filter(Boolean)
      .join(' | ')

  const moduleMatch =
    topText.match(
      /\b(?:m[oó]dulo\s*\/\s*ufcd|ufcd|m[oó]dulo)\s*[:#-]?\s*(?:ufcd\s*[-:#]?\s*)?([A-Za-z0-9][A-Za-z0-9._/-]{1,15})/i
    )

  const academicYearMatch =
    topText.match(
      /ano\s*letivo\s*[:#-]?\s*(20\d{2})\s*[-/]\s*(20\d{2})/i
    )

  return {
    moduleCode:
      moduleMatch?.[1] ?? null,
    academicYearLabel:
      academicYearMatch
        ? `${academicYearMatch[1]}-${academicYearMatch[2]}`
        : null
  }
}

function isSummaryRow(
  row: SpreadsheetRow
) {
  return row.some(value => {
    const normalized =
      normalizeComparable(
        cellText(value)
      )

    return (
      normalized.includes('avaliacao global') ||
      normalized.includes('formandos avaliados') ||
      normalized.includes('data de conclusao')
    )
  })
}

function rowHasImportedValue(
  row: ParsedUfcdFinalGradeRow
) {
  return (
    row.finalGrade !== undefined ||
    row.selfAssessmentGrade !== undefined ||
    row.usesAcs !== undefined
  )
}

export function parseUfcdFinalGradeSpreadsheetRows(
  rows: SpreadsheetRow[],
  sheetName = 'Folha 1'
): ParsedUfcdFinalGradeSheet | null {
  const header =
    detectHeader(rows)

  if (!header) {
    return null
  }

  const metadata =
    extractMetadata(
      rows,
      header.rowIndex
    )

  const parsedRows:
    ParsedUfcdFinalGradeRow[] = []
  const warnings: string[] = []

  for (
    let rowIndex =
      header.rowIndex + 1;
    rowIndex < rows.length;
    rowIndex += 1
  ) {
    const row =
      rows[rowIndex] ?? []

    if (isSummaryRow(row)) {
      break
    }

    const studentNumber =
      valueAt(
        row,
        header.columns.studentNumber
      )
    const studentName =
      valueAt(
        row,
        header.columns.studentName
      )

    if (
      !studentNumber &&
      !studentName
    ) {
      continue
    }

    const rowWarnings:
      string[] = []

    const domainValues =
      header.domainColumns.map(
        columnIndex =>
          row[columnIndex]
      )

    const parsed: ParsedUfcdFinalGradeRow = {
      sourceRow:
        rowIndex + 1,
      processNumber:
        valueAt(
          row,
          header.columns.processNumber
        ),
      studentNumber,
      studentName,
      finalGrade:
        parseOptionalIntegerGrade(
          row[
            header.columns.finalGrade ?? -1
          ],
          'A classificação final',
          rowWarnings
        ),
      selfAssessmentGrade:
        parseOptionalIntegerGrade(
          row[
            header.columns.selfAssessment ?? -1
          ],
          'A autoavaliação',
          rowWarnings
        ),
      usesAcs:
        header.columns.acs === undefined
          ? undefined
          : parseAcs(
              row[
                header.columns.acs
              ],
              domainValues,
              rowWarnings
            ),
      warnings:
        rowWarnings
    }

    if (!rowHasImportedValue(parsed)) {
      parsed.warnings.push(
        'A linha não contém ACS, autoavaliação ou classificação final importáveis.'
      )
    }

    parsedRows.push(parsed)
  }

  if (
    header.columns.automatic !== undefined ||
    header.domainColumns.length > 0
  ) {
    warnings.push(
      'Os domínios e o Nível Automático são apenas conferidos visualmente; não são importados como novas avaliações porque o MA-Professor calcula esses valores a partir das avaliações registadas.'
    )
  }

  if (!metadata.moduleCode) {
    warnings.push(
      'Não foi possível identificar o código da UFCD/módulo no cabeçalho do Excel.'
    )
  }

  if (!metadata.academicYearLabel) {
    warnings.push(
      'Não foi possível identificar o ano letivo no cabeçalho do Excel.'
    )
  }

  return {
    sheetName,
    headerScore:
      header.score,
    moduleCode:
      metadata.moduleCode,
    academicYearLabel:
      metadata.academicYearLabel,
    rows:
      parsedRows,
    warnings
  }
}

export function chooseUfcdFinalGradeSheet(
  candidates: ParsedUfcdFinalGradeSheet[]
) {
  return [...candidates]
    .sort(
      (left, right) => {
        const sheetPriority =
          (sheetName: string) => {
            const normalized =
              normalizeComparable(
                sheetName
              )

            if (normalized === 'printcfp') {
              return 3
            }

            if (
              normalized.includes('printcfp') ||
              normalized === 'cfp'
            ) {
              return 2
            }

            if (
              normalized.includes('grelha') ||
              normalized.includes('final')
            ) {
              return 1
            }

            return 0
          }

        return (
          right.headerScore -
            left.headerScore ||
          sheetPriority(
            right.sheetName
          ) -
            sheetPriority(
              left.sheetName
            ) ||
          right.rows.length -
            left.rows.length
        )
      }
    )[0] ?? null
}

function buildDraftChanges(
  row: ParsedUfcdFinalGradeRow
): UfcdFinalGradeImportDraftChanges {
  const changes:
    UfcdFinalGradeImportDraftChanges = {}

  if (row.finalGrade !== undefined) {
    changes.finalGrade =
      String(row.finalGrade)
  }

  if (
    row.selfAssessmentGrade !== undefined
  ) {
    changes.selfAssessmentGrade =
      String(row.selfAssessmentGrade)
  }

  if (row.usesAcs !== undefined) {
    changes.usesAcs =
      row.usesAcs
  }

  return changes
}

function hasDraftChanges(
  changes: UfcdFinalGradeImportDraftChanges
) {
  return Object.keys(changes).length > 0
}

function matchStudent(
  snapshot: AssessmentWorkspaceSnapshot,
  row: ParsedUfcdFinalGradeRow
) {
  const numberKey =
    normalizeStudentNumber(
      row.studentNumber
    )
  const nameKey =
    normalizeStudentName(
      row.studentName
    )

  const byNumber =
    numberKey
      ? snapshot.studentRows.filter(
          current =>
            normalizeStudentNumber(
              current.student.number
            ) === numberKey
        )
      : []

  const byName =
    nameKey
      ? snapshot.studentRows.filter(
          current =>
            normalizeStudentName(
              current.student.name
            ) === nameKey
        )
      : []

  if (
    byNumber.length > 1 ||
    byName.length > 1
  ) {
    return {
      status:
        'ambiguous' as const,
      studentId: null,
      matchedStudentName: null,
      matchedBy: null
    }
  }

  const numberMatch =
    byNumber[0] ?? null
  const nameMatch =
    byName[0] ?? null

  if (
    numberMatch &&
    nameMatch &&
    numberMatch.student.id !==
      nameMatch.student.id
  ) {
    return {
      status:
        'ambiguous' as const,
      studentId: null,
      matchedStudentName: null,
      matchedBy: null
    }
  }

  const match =
    numberMatch ??
    nameMatch

  if (!match) {
    return {
      status:
        'unmatched' as const,
      studentId: null,
      matchedStudentName: null,
      matchedBy: null
    }
  }

  return {
    status:
      'matched' as const,
    studentId:
      match.student.id,
    matchedStudentName:
      match.student.name,
    matchedBy:
      numberMatch && nameMatch
        ? 'both' as const
        : numberMatch
          ? 'number' as const
          : 'name' as const
  }
}

export function buildUfcdFinalGradeImportPreview(
  snapshot: AssessmentWorkspaceSnapshot,
  parsed: ParsedUfcdFinalGradeSheet,
  fileName: string
): UfcdFinalGradeImportPreview {
  const blockingErrors:
    string[] = []
  const warnings =
    [...parsed.warnings]

  const selectedModuleCode =
    snapshot.selectedModule
      ?.code?.trim() ?? ''

  if (
    parsed.moduleCode &&
    selectedModuleCode &&
    normalizeModuleCode(
      parsed.moduleCode
    ) !==
      normalizeModuleCode(
        selectedModuleCode
      )
  ) {
    blockingErrors.push(
      `O Excel refere a UFCD/módulo ${parsed.moduleCode}, mas está selecionado ${selectedModuleCode}.`
    )
  }

  if (
    parsed.academicYearLabel &&
    normalizeAcademicYear(
      parsed.academicYearLabel
    ) !==
      normalizeAcademicYear(
        snapshot.academicYear.name
      )
  ) {
    blockingErrors.push(
      `O Excel refere o ano letivo ${parsed.academicYearLabel}, mas está selecionado ${snapshot.academicYear.name}.`
    )
  }

  let previewRows:
    UfcdFinalGradeImportPreviewRow[] =
    parsed.rows.map(row => {
      const draftChanges =
        buildDraftChanges(row)

      if (!hasDraftChanges(draftChanges)) {
        return {
          ...row,
          status:
            'invalid' as const,
          studentId: null,
          matchedStudentName: null,
          matchedBy: null,
          draftChanges
        }
      }

      return {
        ...row,
        ...matchStudent(
          snapshot,
          row
        ),
        draftChanges
      }
    })

  const studentIdCounts =
    new Map<EntityId, number>()

  previewRows.forEach(row => {
    if (
      row.status === 'matched' &&
      row.studentId
    ) {
      studentIdCounts.set(
        row.studentId,
        (
          studentIdCounts.get(
            row.studentId
          ) ?? 0
        ) + 1
      )
    }
  })

  previewRows =
    previewRows.map(row => {
      if (
        row.status === 'matched' &&
        row.studentId &&
        (
          studentIdCounts.get(
            row.studentId
          ) ?? 0
        ) > 1
      ) {
        return {
          ...row,
          status:
            'ambiguous' as const,
          studentId: null,
          matchedStudentName: null,
          matchedBy: null,
          warnings: [
            ...row.warnings,
            'O mesmo aluno aparece mais de uma vez no Excel; nenhuma dessas linhas será aplicada automaticamente.'
          ]
        }
      }

      return row
    })

  const matchedCount =
    previewRows.filter(
      row =>
        row.status === 'matched'
    ).length
  const unmatchedCount =
    previewRows.filter(
      row =>
        row.status === 'unmatched'
    ).length
  const ambiguousCount =
    previewRows.filter(
      row =>
        row.status === 'ambiguous'
    ).length
  const invalidCount =
    previewRows.filter(
      row =>
        row.status === 'invalid'
    ).length

  if (unmatchedCount > 0) {
    warnings.push(
      `${unmatchedCount} linha(s) do Excel não correspondem a nenhum aluno da turma atual.`
    )
  }

  if (ambiguousCount > 0) {
    warnings.push(
      `${ambiguousCount} linha(s) têm correspondência ambígua e não serão aplicadas.`
    )
  }

  if (invalidCount > 0) {
    warnings.push(
      `${invalidCount} linha(s) não contêm campos de fecho válidos para importar.`
    )
  }

  return {
    fileName,
    sheetName:
      parsed.sheetName,
    moduleCode:
      parsed.moduleCode,
    academicYearLabel:
      parsed.academicYearLabel,
    rows:
      previewRows,
    blockingErrors,
    warnings,
    matchedCount,
    unmatchedCount,
    ambiguousCount,
    invalidCount
  }
}

export function isSupportedUfcdFinalGradeExcelFileName(
  fileName: string
) {
  return /\.(xlsx|xlsm|xls)$/i.test(
    fileName
  )
}

export async function readUfcdFinalGradeExcelFile(
  file: File,
  snapshot: AssessmentWorkspaceSnapshot
): Promise<UfcdFinalGradeImportPreview> {
  if (
    !isSupportedUfcdFinalGradeExcelFileName(
      file.name
    )
  ) {
    throw new Error(
      'Selecione um ficheiro Excel .xlsx, .xlsm ou .xls.'
    )
  }

  const XLSX =
    await import('xlsx')

  const workbook =
    XLSX.read(
      await file.arrayBuffer(),
      {
        type: 'array',
        cellDates: true
      }
    )

  const candidates:
    ParsedUfcdFinalGradeSheet[] = []

  workbook.SheetNames.forEach(
    sheetName => {
      const sheet =
        workbook.Sheets[
          sheetName
        ]

      if (!sheet) {
        return
      }

      const rows =
        XLSX.utils.sheet_to_json<unknown[]>(
          sheet,
          {
            header: 1,
            raw: true,
            defval: null,
            blankrows: false
          }
        )

      const parsed =
        parseUfcdFinalGradeSpreadsheetRows(
          rows,
          sheetName
        )

      if (parsed) {
        candidates.push(parsed)
      }
    }
  )

  const selected =
    chooseUfcdFinalGradeSheet(
      candidates
    )

  if (!selected) {
    throw new Error(
      'Não foi encontrada uma folha com a estrutura da grelha final de módulo/UFCD.'
    )
  }

  return buildUfcdFinalGradeImportPreview(
    snapshot,
    selected,
    file.name
  )
}
