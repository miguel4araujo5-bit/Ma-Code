import {
  downloadBlob
} from '../../../lib/maPdf/fileUtils'

import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AssessmentResult,
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  buildUfcdCfpModel
} from './ufcdCfpModel'

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const OFFICIAL_MOMENT_SHEETS = [
  'P1I1',
  'P1I2',
  'P1I3',
  'P1I4',
  'P1I5',
  'P2I1',
  'P2I2',
  'P2I3',
  'P2I4',
  'P2I5',
  'P3I1',
  'P3I2',
  'P3I3',
  'P3I4',
  'P3I5'
] as const

type XlsxModule =
  typeof import('xlsx')

type MatrixValue =
  string | number | null

interface EvaluationMoment {
  sheetName: string
  lessonId: EntityId
  date: string
  title: string
  resultsByCriterion: Map<
    EntityId,
    Map<EntityId, AssessmentResult>
  >
}

function createMatrix(
  rows: number,
  columns: number
): MatrixValue[][] {
  return Array.from(
    { length: rows },
    () =>
      Array.from(
        { length: columns },
        () => ''
      )
  )
}

function put(
  XLSX: XlsxModule,
  matrix: MatrixValue[][],
  address: string,
  value: MatrixValue
) {
  const cell =
    XLSX.utils.decode_cell(address)

  while (
    matrix.length <= cell.r
  ) {
    matrix.push([])
  }

  while (
    matrix[cell.r].length <= cell.c
  ) {
    matrix[cell.r].push('')
  }

  matrix[cell.r][cell.c] = value
}

function setCellNumberFormat(
  XLSX: XlsxModule,
  sheet: import('xlsx').WorkSheet,
  address: string,
  format: string
) {
  const cell = sheet[address]

  if (cell) {
    cell.z = format
  }
}

function momentSheetName(
  index: number
) {
  const period =
    Math.floor(index / 5) + 1
  const instrument =
    (index % 5) + 1

  return `P${period}I${instrument}`
}

function cleanMomentTitle(
  value: string
) {
  return value
    .replace(
      /\s*·\s*Registo diário\s*·.*$/i,
      ''
    )
    .trim()
}

async function loadEvaluationMoments(
  snapshot: AssessmentWorkspaceSnapshot
): Promise<EvaluationMoment[]> {
  await openMAProfessorDatabase()

  const assessmentIds =
    snapshot.activities.map(
      activity =>
        activity.assessment.id
    )

  const results =
    assessmentIds.length === 0
      ? []
      : await maProfessorDb
          .assessmentResults
          .where('assessmentId')
          .anyOf(assessmentIds)
          .toArray()

  const resultsByAssessment =
    new Map<
      EntityId,
      AssessmentResult[]
    >()

  results.forEach(
    result => {
      const current =
        resultsByAssessment.get(
          result.assessmentId
        ) ?? []

      current.push(result)

      resultsByAssessment.set(
        result.assessmentId,
        current
      )
    }
  )

  const orderedActivities =
    [...snapshot.activities].sort(
      (left, right) => {
        const date =
          left.lesson.date.localeCompare(
            right.lesson.date
          )

        if (date !== 0) {
          return date
        }

        const time =
          left.lesson.startTime.localeCompare(
            right.lesson.startTime
          )

        if (time !== 0) {
          return time
        }

        return left.assessment.title.localeCompare(
          right.assessment.title,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
      }
    )

  const groups =
    new Map<
      EntityId,
      Omit<EvaluationMoment, 'sheetName'>
    >()

  orderedActivities.forEach(
    activity => {
      const key =
        activity.lesson.id

      const existing =
        groups.get(key)

      const title =
        activity.assessment.description
          .trim() ||
        cleanMomentTitle(
          activity.assessment.title
        ) ||
        activity.assessment.title

      const resultsForCriterion =
        new Map<
          EntityId,
          AssessmentResult
        >(
          (
            resultsByAssessment.get(
              activity.assessment.id
            ) ?? []
          ).map(
            result => [
              result.studentId,
              result
            ]
          )
        )

      if (existing) {
        existing.resultsByCriterion.set(
          activity.criterion.id,
          resultsForCriterion
        )
        return
      }

      groups.set(
        key,
        {
          lessonId: key,
          date: activity.lesson.date,
          title,
          resultsByCriterion:
            new Map([
              [
                activity.criterion.id,
                resultsForCriterion
              ]
            ])
        }
      )
    }
  )

  return Array.from(
    groups.values()
  ).map(
    (moment, index) => ({
      ...moment,
      sheetName:
        momentSheetName(index)
    })
  )
}

function buildHomeSheet(
  XLSX: XlsxModule,
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)
  const matrix =
    createMatrix(40, 16)

  put(XLSX, matrix, 'N2', 'Designação')
  put(
    XLSX,
    matrix,
    'N3',
    'Instrumentos de recolha de dados'
  )
  put(XLSX, matrix, 'H4', 'DADOS DA TURMA')
  put(XLSX, matrix, 'H5', 'Nº PROCESSO')
  put(XLSX, matrix, 'I5', 'Nº')
  put(XLSX, matrix, 'J5', 'Nome do aluno')
  put(XLSX, matrix, 'K5', 'Medidas')

  put(XLSX, matrix, 'B6', 'Ano letivo')
  put(XLSX, matrix, 'D6', model.academicYear)
  put(XLSX, matrix, 'B7', 'Disciplina')
  put(XLSX, matrix, 'D7', model.subject)
  put(XLSX, matrix, 'B8', 'Ano do curso')
  put(XLSX, matrix, 'D8', model.gradeLevel)
  put(XLSX, matrix, 'B9', 'Turma')
  put(XLSX, matrix, 'D9', model.group)
  put(XLSX, matrix, 'B10', 'Curso')
  put(XLSX, matrix, 'D10', model.course)
  put(XLSX, matrix, 'B11', 'Módulo / UFCD')
  put(XLSX, matrix, 'D11', model.moduleLabel)

  put(
    XLSX,
    matrix,
    'B13',
    'Domínios / Temas da disciplina'
  )
  put(XLSX, matrix, 'B14', 'Nº')
  put(XLSX, matrix, 'C14', 'Designação')
  put(XLSX, matrix, 'E14', 'Abreviatura')
  put(XLSX, matrix, 'F14', 'Ponderação')

  model.criteria.forEach(
    (criterion, index) => {
      const row = 15 + index
      put(
        XLSX,
        matrix,
        `B${row}`,
        index + 1
      )
      put(
        XLSX,
        matrix,
        `C${row}`,
        criterion.name
      )
      put(
        XLSX,
        matrix,
        `E${row}`,
        criterion.label
      )
      put(
        XLSX,
        matrix,
        `F${row}`,
        criterion.weightPercent
      )
    }
  )

  const acsRow =
    15 + model.criteria.length

  put(XLSX, matrix, `B${acsRow}`, model.criteria.length + 1)
  put(
    XLSX,
    matrix,
    `C${acsRow}`,
    'Medidas para Adaptações Curriculares Significativas'
  )
  put(XLSX, matrix, `E${acsRow}`, 'ACS')
  put(XLSX, matrix, `F${acsRow}`, 100)

  model.rows.forEach(
    (row, index) => {
      const targetRow = 6 + index
      put(
        XLSX,
        matrix,
        `H${targetRow}`,
        row.processNumber
      )
      put(
        XLSX,
        matrix,
        `I${targetRow}`,
        row.studentNumber
      )
      put(
        XLSX,
        matrix,
        `J${targetRow}`,
        row.studentName
      )
      put(
        XLSX,
        matrix,
        `K${targetRow}`,
        row.usesAcs
          ? 'sim'
          : ''
      )
    }
  )

  const sheet =
    XLSX.utils.aoa_to_sheet(matrix)

  sheet['!cols'] = [
    { wch: 3 },
    { wch: 18 },
    { wch: 42 },
    { wch: 4 },
    { wch: 12 },
    { wch: 12 },
    { wch: 3 },
    { wch: 14 },
    { wch: 7 },
    { wch: 38 },
    { wch: 12 }
  ]

  return sheet
}

function buildMomentSheet(
  XLSX: XlsxModule,
  snapshot: AssessmentWorkspaceSnapshot,
  moment: EvaluationMoment | null,
  fallbackName: string
) {
  const model =
    buildUfcdCfpModel(snapshot)
  const matrix =
    createMatrix(
      Math.max(55, 15 + model.rows.length),
      36
    )

  put(
    XLSX,
    matrix,
    'E1',
    'DESIGNAÇÃO DO INSTRUMENTO DE AVALIAÇÃO'
  )
  put(XLSX, matrix, 'P1', 'CURSO')
  put(XLSX, matrix, 'Z1', 'MÓDULO / UFCD')
  put(XLSX, matrix, 'E2', 'Nome:')
  put(
    XLSX,
    matrix,
    'G2',
    moment?.title ||
      `${fallbackName} · sem avaliação registada`
  )
  put(XLSX, matrix, 'P2', model.course)
  put(XLSX, matrix, 'Z2', model.moduleLabel)
  put(
    XLSX,
    matrix,
    'E5',
    `Disciplina: ${model.subject}`
  )
  put(
    XLSX,
    matrix,
    'Z5',
    `Ano: ${model.gradeLevel}`
  )
  put(
    XLSX,
    matrix,
    'AD5',
    `Turma: ${model.group}`
  )
  put(
    XLSX,
    matrix,
    'AH5',
    `Ano Letivo: ${model.academicYear}`
  )
  put(XLSX, matrix, 'B7', 'Geral')
  put(XLSX, matrix, 'C7', 'Nº do item')
  put(XLSX, matrix, 'D7', 'MEDIDAS')
  put(XLSX, matrix, 'C8', 'Nº do domínio / tema')
  put(XLSX, matrix, 'C9', 'Pontuação')

  model.criteria.forEach(
    (criterion, index) => {
      const column =
        XLSX.utils.encode_col(
          4 + index
        )
      put(
        XLSX,
        matrix,
        `${column}8`,
        criterion.label
      )
      put(
        XLSX,
        matrix,
        `${column}9`,
        criterion.weightPercent
      )
    }
  )

  model.rows.forEach(
    (student, studentIndex) => {
      const row = 14 + studentIndex

      put(
        XLSX,
        matrix,
        `A${row}`,
        student.processNumber
      )
      put(
        XLSX,
        matrix,
        `B${row}`,
        student.studentNumber
      )
      put(
        XLSX,
        matrix,
        `C${row}`,
        student.studentName
      )
      put(
        XLSX,
        matrix,
        `D${row}`,
        student.usesAcs
          ? 'sim'
          : ''
      )

      model.criteria.forEach(
        (criterion, criterionIndex) => {
          const column =
            XLSX.utils.encode_col(
              4 + criterionIndex
            )

          const result =
            moment
              ?.resultsByCriterion
              .get(criterion.id)
              ?.get(
                snapshot.studentRows[
                  studentIndex
                ]?.student.id ?? ''
              )

          let value:
            MatrixValue = ''

          if (
            result?.status ===
            'evaluated'
          ) {
            value =
              Math.round(
                (
                  result.score /
                  20 *
                  criterion.weightPercent
                ) * 100
              ) / 100
          } else if (
            result?.status ===
            'absent'
          ) {
            value = 'F'
          } else if (
            result?.status ===
            'exempt'
          ) {
            value = '—'
          }

          put(
            XLSX,
            matrix,
            `${column}${row}`,
            value
          )
        }
      )
    }
  )

  put(
    XLSX,
    matrix,
    'E45',
    'SOMA DAS PONTUAÇÕES POR DOMÍNIO + TOTAL (informação para o professor)'
  )

  if (moment?.date) {
    put(
      XLSX,
      matrix,
      'E46',
      `Data: ${moment.date}`
    )
  }

  const sheet =
    XLSX.utils.aoa_to_sheet(matrix)

  sheet['!cols'] = [
    { wch: 13 },
    { wch: 7 },
    { wch: 38 },
    { wch: 12 },
    ...model.criteria.map(
      () => ({ wch: 11 })
    )
  ]

  sheet['!merges'] = [
    {
      s: { r: 0, c: 4 },
      e: { r: 0, c: 13 }
    },
    {
      s: { r: 0, c: 15 },
      e: { r: 0, c: 23 }
    },
    {
      s: { r: 0, c: 25 },
      e: { r: 0, c: 34 }
    }
  ]

  return sheet
}

function buildCfpSheet(
  XLSX: XlsxModule,
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)

  const headers = [
    'Nº Processo',
    'Nº',
    'Aluno / Domínio',
    ...model.criteria.map(
      criterion =>
        criterion.label
    ),
    'ACS',
    'Nível Automático',
    'Autoavaliação',
    'Nível Final',
    'Assinatura do Formando'
  ]

  const weights = [
    '',
    '',
    '',
    ...model.criteria.map(
      criterion =>
        criterion.weightPercent /
        100
    ),
    1,
    '',
    '',
    '',
    ''
  ]

  const rows:
    MatrixValue[][] = [
      [
        'CÁLCULOS DE FINAL DE MÓDULO/UFCD',
        '',
        '',
        `CURSO: ${model.course}`,
        '',
        '',
        `MÓDULO/UFCD: ${model.moduleLabel}`
      ],
      [
        `Disciplina: ${model.subject}`,
        '',
        '',
        `Ano: ${model.gradeLevel}`,
        '',
        `Turma: ${model.group}`,
        '',
        `Ano letivo: ${model.academicYear}`
      ],
      weights,
      headers
    ]

  model.rows.forEach(
    row => {
      rows.push([
        row.processNumber,
        row.studentNumber,
        row.studentName,
        ...row.criterionScores,
        row.acsScore,
        row.automaticLevel,
        row.selfAssessmentGrade,
        row.finalGrade,
        ''
      ])
    }
  )

  const studentRowCount =
    Math.max(
      25,
      model.rows.length
    )

  while (
    rows.length <
    4 + studentRowCount
  ) {
    rows.push(
      Array.from(
        { length: headers.length },
        () => ''
      )
    )
  }

  rows.push([])
  rows.push([
    'AVALIAÇÃO GLOBAL',
    ...model.gradeBands.map(
      band => band.label
    ),
    'NEGATIVO',
    'POSITIVO'
  ])
  rows.push([
    'Nº',
    ...model.gradeBands.map(
      band => band.count
    ),
    model.negativeCount,
    model.positiveCount
  ])
  rows.push([
    '%',
    ...model.gradeBands.map(
      band =>
        band.percent /
        100
    ),
    model.negativePercent / 100,
    model.positivePercent / 100
  ])
  rows.push([])
  rows.push([
    'Formandos Avaliados',
    model.evaluatedCount,
    '',
    'Data de Conclusão do Módulo',
    model.completionDate,
    '',
    '',
    'O/A Professor(a)'
  ])

  const sheet =
    XLSX.utils.aoa_to_sheet(rows)

  sheet['!cols'] = [
    { wch: 13 },
    { wch: 7 },
    { wch: 38 },
    ...model.criteria.map(
      () => ({ wch: 11 })
    ),
    { wch: 11 },
    { wch: 16 },
    { wch: 15 },
    { wch: 13 },
    { wch: 24 }
  ]

  model.criteria.forEach(
    (_, index) =>
      setCellNumberFormat(
        XLSX,
        sheet,
        XLSX.utils.encode_cell({
          r: 2,
          c: 3 + index
        }),
        '0%'
      )
  )

  setCellNumberFormat(
    XLSX,
    sheet,
    XLSX.utils.encode_cell({
      r: 2,
      c: 3 + model.criteria.length
    }),
    '0%'
  )

  const percentRow =
    rows.findIndex(
      row => row[0] === '%'
    )

  if (percentRow >= 0) {
    for (
      let column = 1;
      column <= 7;
      column += 1
    ) {
      setCellNumberFormat(
        XLSX,
        sheet,
        XLSX.utils.encode_cell({
          r: percentRow,
          c: column
        }),
        '0%'
      )
    }
  }

  return sheet
}

function buildPrintSheet(
  XLSX: XlsxModule,
  moments: EvaluationMoment[]
) {
  return XLSX.utils.aoa_to_sheet([
    [
      'INSTRUMENTOS DE AVALIAÇÃO',
      'Data',
      'Designação'
    ],
    ...moments.map(
      moment => [
        moment.sheetName,
        moment.date,
        moment.title
      ]
    )
  ])
}

function buildPrintCfpSheet(
  XLSX: XlsxModule,
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)

  return XLSX.utils.aoa_to_sheet([
    ['INFORMAÇÃO DE FINAL DE MÓDULO/UFCD'],
    ['Turma:', model.group],
    ['Disciplina:', model.subject],
    ['Módulo / UFCD:', model.moduleLabel],
    ['Ano letivo:', model.academicYear],
    [],
    [
      'A impressão oficial corresponde à folha CFP.'
    ]
  ])
}

function buildAutoSheet(
  XLSX: XlsxModule,
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)

  return XLSX.utils.aoa_to_sheet([
    [
      'Nº',
      'Aluno',
      'Nível Automático',
      'Autoavaliação',
      'Nível Final'
    ],
    ...model.rows.map(
      row => [
        row.studentNumber,
        row.studentName,
        row.automaticLevel,
        row.selfAssessmentGrade,
        row.finalGrade
      ]
    )
  ])
}

export async function exportUfcdFinalGradeExcel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)
  const moments =
    await loadEvaluationMoments(
      snapshot
    )
  const XLSX =
    await import('xlsx')

  const workbook =
    XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    workbook,
    buildHomeSheet(
      XLSX,
      snapshot
    ),
    'HOME'
  )

  const momentByName =
    new Map(
      moments.map(
        moment => [
          moment.sheetName,
          moment
        ]
      )
    )

  const momentNames = [
    ...OFFICIAL_MOMENT_SHEETS,
    ...moments
      .slice(
        OFFICIAL_MOMENT_SHEETS.length
      )
      .map(
        moment =>
          moment.sheetName
      )
  ]

  momentNames.forEach(
    sheetName => {
      XLSX.utils.book_append_sheet(
        workbook,
        buildMomentSheet(
          XLSX,
          snapshot,
          momentByName.get(
            sheetName
          ) ?? null,
          sheetName
        ),
        sheetName
      )
    }
  )

  XLSX.utils.book_append_sheet(
    workbook,
    buildPrintSheet(
      XLSX,
      moments
    ),
    'PRINT'
  )

  XLSX.utils.book_append_sheet(
    workbook,
    buildCfpSheet(
      XLSX,
      snapshot
    ),
    'CFP'
  )

  XLSX.utils.book_append_sheet(
    workbook,
    buildPrintCfpSheet(
      XLSX,
      snapshot
    ),
    'PRINTCFP'
  )

  XLSX.utils.book_append_sheet(
    workbook,
    buildAutoSheet(
      XLSX,
      snapshot
    ),
    'AUTO'
  )

  const hiddenSheets =
    new Set([
      'P2I1',
      'P2I2',
      'P2I3',
      'P2I4',
      'P2I5',
      'P3I1',
      'P3I2',
      'P3I3',
      'P3I4',
      'P3I5',
      'PRINT',
      'PRINTCFP',
      'AUTO'
    ])

  workbook.Workbook = {
    Sheets:
      workbook.SheetNames.map(
        name => ({
          Hidden:
            hiddenSheets.has(name)
              ? 1
              : 0
        })
      )
  }

  const bytes =
    XLSX.write(
      workbook,
      {
        bookType: 'xlsx',
        type: 'array',
        compression: true
      }
    )

  downloadBlob(
    new Blob(
      [bytes],
      {
        type: XLSX_MIME
      }
    ),
    `${model.fileBaseName}-Completo.xlsx`
  )
}
