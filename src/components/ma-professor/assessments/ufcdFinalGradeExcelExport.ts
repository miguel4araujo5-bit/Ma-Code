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
  resolveModuleCompletionDate
} from './ufcdCompletionDate'

import {
  buildUfcdCfpModel
} from './ufcdCfpModel'

import {
  clearWorksheetCell,
  loadOfficialUfcdXlsmTemplate,
  setWorksheetFormula,
  setWorksheetNumber,
  setWorksheetString,
  writeOfficialUfcdXlsm,
  type OfficialXlsmFiles
} from './ufcdOfficialXlsmTemplate'

const XLSM_MIME =
  'application/vnd.ms-excel.sheet.macroEnabled.12'

const HOME_SHEET =
  'xl/worksheets/sheet1.xml'
const CFP_SHEET =
  'xl/worksheets/sheet14.xml'

const OFFICIAL_MOMENT_SHEETS = [
  { name: 'P1I1', path: 'xl/worksheets/sheet2.xml' },
  { name: 'P1I2', path: 'xl/worksheets/sheet17.xml' },
  { name: 'P1I3', path: 'xl/worksheets/sheet18.xml' },
  { name: 'P1I4', path: 'xl/worksheets/sheet19.xml' },
  { name: 'P1I5', path: 'xl/worksheets/sheet20.xml' },
  { name: 'P2I1', path: 'xl/worksheets/sheet3.xml' },
  { name: 'P2I2', path: 'xl/worksheets/sheet4.xml' },
  { name: 'P2I3', path: 'xl/worksheets/sheet5.xml' },
  { name: 'P2I4', path: 'xl/worksheets/sheet6.xml' },
  { name: 'P2I5', path: 'xl/worksheets/sheet7.xml' },
  { name: 'P3I1', path: 'xl/worksheets/sheet8.xml' },
  { name: 'P3I2', path: 'xl/worksheets/sheet9.xml' },
  { name: 'P3I3', path: 'xl/worksheets/sheet10.xml' },
  { name: 'P3I4', path: 'xl/worksheets/sheet11.xml' },
  { name: 'P3I5', path: 'xl/worksheets/sheet12.xml' }
] as const

type EvaluationMoment = {
  lessonId: EntityId
  date: string
  title: string
  resultsByCriterion: Map<
    EntityId,
    Map<EntityId, AssessmentResult>
  >
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

  for (const result of results) {
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

  const orderedActivities =
    [...snapshot.activities].sort(
      (left, right) =>
        left.lesson.date.localeCompare(
          right.lesson.date
        ) ||
        left.lesson.startTime.localeCompare(
          right.lesson.startTime
        ) ||
        left.assessment.title.localeCompare(
          right.assessment.title,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    )

  const moments =
    new Map<EntityId, EvaluationMoment>()

  for (const activity of orderedActivities) {
    const resultsForCriterion =
      new Map<EntityId, AssessmentResult>(
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

    const title =
      activity.assessment.description
        .trim() ||
      cleanMomentTitle(
        activity.assessment.title
      ) ||
      activity.assessment.title

    const existing =
      moments.get(
        activity.lesson.id
      )

    if (existing) {
      existing.resultsByCriterion.set(
        activity.criterion.id,
        resultsForCriterion
      )
      continue
    }

    moments.set(
      activity.lesson.id,
      {
        lessonId:
          activity.lesson.id,
        date:
          activity.lesson.date,
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

  return [...moments.values()]
}

function columnName(
  zeroBasedColumn: number
) {
  let value =
    zeroBasedColumn + 1
  let result = ''

  while (value > 0) {
    const remainder =
      (value - 1) % 26

    result =
      String.fromCharCode(
        65 + remainder
      ) + result

    value =
      Math.floor(
        (value - 1) / 26
      )
  }

  return result
}

function excelSerialFromIsoDate(
  value: string | null
) {
  const match =
    value?.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    )

  if (!match) {
    return null
  }

  const timestamp =
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    )
  const excelEpoch =
    Date.UTC(1899, 11, 30)

  return (
    timestamp - excelEpoch
  ) / 86_400_000
}

function formatIsoDate(
  value: string | null
) {
  const match =
    value?.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    )

  return match
    ? `${match[3]}/${match[2]}/${match[1]}`
    : ''
}

function clearHomeInputs(
  files: OfficialXlsmFiles
) {
  for (
    let row = 6;
    row <= 35;
    row += 1
  ) {
    for (const column of [
      'H',
      'I',
      'J',
      'K',
      'L'
    ]) {
      clearWorksheetCell(
        files,
        HOME_SHEET,
        `${column}${row}`
      )
    }
  }

  for (
    let row = 15;
    row <= 20;
    row += 1
  ) {
    for (const column of [
      'C',
      'E',
      'F'
    ]) {
      clearWorksheetCell(
        files,
        HOME_SHEET,
        `${column}${row}`
      )
    }
  }
}

function populateHome(
  files: OfficialXlsmFiles,
  snapshot: AssessmentWorkspaceSnapshot,
  completionDate: string | null
) {
  const model =
    buildUfcdCfpModel(snapshot)

  clearHomeInputs(files)

  const fields: Array<
    [string, string]
  > = [
    ['D6', model.academicYear],
    ['D7', model.subject],
    ['D8', model.gradeLevel],
    ['D9', model.group],
    ['D10', model.course],
    ['D11', model.moduleLabel]
  ]

  for (const [address, value] of fields) {
    setWorksheetString(
      files,
      HOME_SHEET,
      address,
      value
    )
  }

  const formattedCompletionDate =
    formatIsoDate(completionDate)

  model.rows.forEach(
    (student, index) => {
      const row = 6 + index

      // Nº Processo fica intencionalmente em branco
      // até existir uma fonte segura para este dado.
      setWorksheetString(
        files,
        HOME_SHEET,
        `I${row}`,
        student.studentNumber
      )
      setWorksheetString(
        files,
        HOME_SHEET,
        `J${row}`,
        student.studentName
      )

      if (student.usesAcs) {
        setWorksheetString(
          files,
          HOME_SHEET,
          `K${row}`,
          'sim'
        )
      }

      if (formattedCompletionDate) {
        setWorksheetString(
          files,
          HOME_SHEET,
          `L${row}`,
          formattedCompletionDate
        )
      }
    }
  )

  model.criteria.forEach(
    (criterion, index) => {
      const row = 15 + index

      setWorksheetString(
        files,
        HOME_SHEET,
        `C${row}`,
        criterion.name
      )
      setWorksheetString(
        files,
        HOME_SHEET,
        `E${row}`,
        criterion.label
      )
      setWorksheetNumber(
        files,
        HOME_SHEET,
        `F${row}`,
        criterion.weightPercent
      )
    }
  )

  const acsRow =
    15 + model.criteria.length

  setWorksheetString(
    files,
    HOME_SHEET,
    `C${acsRow}`,
    'Medidas para Adaptações Curriculares Significativas'
  )
  setWorksheetString(
    files,
    HOME_SHEET,
    `E${acsRow}`,
    'ACS'
  )
  setWorksheetNumber(
    files,
    HOME_SHEET,
    `F${acsRow}`,
    100
  )
}

function clearMomentInputs(
  files: OfficialXlsmFiles,
  sheetPath: string
) {
  clearWorksheetCell(
    files,
    sheetPath,
    'G2'
  )

  for (
    let columnIndex = 4;
    columnIndex <= 49;
    columnIndex += 1
  ) {
    const column =
      columnName(columnIndex)

    for (const row of [8, 9, 12, 13]) {
      clearWorksheetCell(
        files,
        sheetPath,
        `${column}${row}`
      )
    }

    for (
      let row = 14;
      row <= 43;
      row += 1
    ) {
      clearWorksheetCell(
        files,
        sheetPath,
        `${column}${row}`
      )
    }
  }
}

function populateMoment(
  files: OfficialXlsmFiles,
  sheetPath: string,
  moment: EvaluationMoment,
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(snapshot)
  const criteriaById =
    new Map(
      model.criteria.map(
        (criterion, index) => [
          criterion.id,
          {
            criterion,
            index
          }
        ]
      )
    )

  const criterionEntries =
    [...moment.resultsByCriterion.entries()]
      .flatMap(
        ([criterionId, results]) => {
          const resolved =
            criteriaById.get(
              criterionId
            )

          return resolved
            ? [
                {
                  ...resolved,
                  criterionId,
                  results
                }
              ]
            : []
        }
      )
      .sort(
        (left, right) =>
          left.index - right.index
      )

  setWorksheetString(
    files,
    sheetPath,
    'G2',
    moment.title || moment.date
  )

  const acsInternalDomain =
    `D${model.criteria.length + 1}`

  criterionEntries.forEach(
    (entry, itemIndex) => {
      const column =
        columnName(
          4 + itemIndex
        )

      setWorksheetString(
        files,
        sheetPath,
        `${column}8`,
        entry.criterion.label
      )
      setWorksheetNumber(
        files,
        sheetPath,
        `${column}9`,
        20
      )
      setWorksheetString(
        files,
        sheetPath,
        `${column}12`,
        acsInternalDomain
      )
      setWorksheetNumber(
        files,
        sheetPath,
        `${column}13`,
        20
      )

      snapshot.studentRows.forEach(
        (studentRow, studentIndex) => {
          const result =
            entry.results.get(
              studentRow.student.id
            )

          if (
            result?.status !==
            'evaluated'
          ) {
            return
          }

          setWorksheetNumber(
            files,
            sheetPath,
            `${column}${14 + studentIndex}`,
            result.score
          )
        }
      )
    }
  )
}

function populateCfpInputs(
  files: OfficialXlsmFiles,
  snapshot: AssessmentWorkspaceSnapshot,
  completionDate: string | null
) {
  const model =
    buildUfcdCfpModel(snapshot)

  model.rows.forEach(
    (student, index) => {
      const row = 12 + index

      clearWorksheetCell(
        files,
        CFP_SHEET,
        `AI${row}`
      )

      if (
        student.selfAssessmentGrade !== null
      ) {
        setWorksheetNumber(
          files,
          CFP_SHEET,
          `AI${row}`,
          student.selfAssessmentGrade
        )
      }

      if (student.finalGrade !== null) {
        setWorksheetNumber(
          files,
          CFP_SHEET,
          `BW${row}`,
          student.finalGrade
        )
      }
    }
  )

  const serial =
    excelSerialFromIsoDate(
      completionDate
    )

  if (serial === null) {
    clearWorksheetCell(
      files,
      CFP_SHEET,
      'AI80'
    )
  } else {
    setWorksheetNumber(
      files,
      CFP_SHEET,
      'AI80',
      serial
    )
  }
}

export async function exportUfcdFinalGradeExcel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  if (
    !snapshot.selectedModule ||
    !snapshot.selectedGroup ||
    !snapshot.selectedSubject
  ) {
    throw new Error(
      'Selecione uma turma, disciplina e UFCD/UC antes de exportar.'
    )
  }

  if (snapshot.studentRows.length > 30) {
    throw new Error(
      'O modelo oficial XLSM suporta até 30 formandos nesta grelha.'
    )
  }

  if (snapshot.criteria.length > 5) {
    throw new Error(
      'O modelo oficial XLSM suporta até cinco domínios regulares mais ACS.'
    )
  }

  const [
    completionDate,
    moments,
    files
  ] = await Promise.all([
    resolveModuleCompletionDate(
      snapshot.selectedModule
    ),
    loadEvaluationMoments(snapshot),
    loadOfficialUfcdXlsmTemplate()
  ])

  if (
    moments.length >
    OFFICIAL_MOMENT_SHEETS.length
  ) {
    throw new Error(
      'O modelo oficial XLSM suporta até 15 instrumentos de avaliação (cinco por período).'
    )
  }

  populateHome(
    files,
    snapshot,
    completionDate
  )

  OFFICIAL_MOMENT_SHEETS.forEach(
    sheet =>
      clearMomentInputs(
        files,
        sheet.path
      )
  )

  moments.forEach(
    (moment, index) =>
      populateMoment(
        files,
        OFFICIAL_MOMENT_SHEETS[
          index
        ].path,
        moment,
        snapshot
      )
  )

  populateCfpInputs(
    files,
    snapshot,
    completionDate
  )

  const model =
    buildUfcdCfpModel(snapshot)
  const bytes =
    writeOfficialUfcdXlsm(files)

  downloadBlob(
    new Blob(
      [bytes],
      {
        type: XLSM_MIME
      }
    ),
    `${model.fileBaseName}-Completo.xlsm`
  )
}
