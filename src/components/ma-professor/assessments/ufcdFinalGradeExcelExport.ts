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
  prepareOfficialEvaluationMomentSheets,
  type EvaluationMomentSheetLocation
} from './ufcdDynamicMomentSheets'

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

const CFP_DOMAIN_COLUMNS = [
  'H',
  'K',
  'N',
  'Q',
  'T',
  'W'
] as const

type MomentSheetDefinition = {
  name: string
  path: string
  titleCell: string
  firstItemColumn: number
  lastItemColumn: number
}

const P1_LAYOUT = {
  titleCell: 'G2',
  firstItemColumn: 4,
  lastItemColumn: 49
} as const

const P23_LAYOUT = {
  titleCell: 'F2',
  firstItemColumn: 3,
  lastItemColumn: 48
} as const

type EvaluationMoment = {
  key: string
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
      activity => activity.assessment.id
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
    new Map<string, EvaluationMoment>()

  for (const activity of orderedActivities) {
    const title =
      activity.assessment.description
        .trim() ||
      cleanMomentTitle(
        activity.assessment.title
      ) ||
      activity.assessment.title

    // Uma aula pode conter mais do que um momento. O título/descrição
    // mantém juntos apenas os registos dos vários critérios do mesmo momento.
    const key =
      `${activity.lesson.id}::${title}`

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

    const existing =
      moments.get(key)

    if (existing) {
      existing.resultsByCriterion.set(
        activity.criterion.id,
        resultsForCriterion
      )
      continue
    }

    moments.set(
      key,
      {
        key,
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

  return [...moments.values()]
}

function materializeMomentSheets(
  files: OfficialXlsmFiles,
  count: number
): MomentSheetDefinition[] {
  return prepareOfficialEvaluationMomentSheets(
    files,
    count
  ).map(
    (
      location: EvaluationMomentSheetLocation
    ) => ({
      name: location.name,
      path: location.path,
      ...(
        location.layout === 'p1'
          ? P1_LAYOUT
          : P23_LAYOUT
      )
    })
  )
}

function columnName(
  zeroBasedColumn: number
) {
  let value = zeroBasedColumn + 1
  let result = ''

  while (value > 0) {
    const remainder =
      (value - 1) % 26

    result =
      String.fromCharCode(
        65 + remainder
      ) + result

    value = Math.floor(
      (value - 1) / 26
    )
  }

  return result
}

function excelSerialFromIsoDate(
  value: string | null
) {
  const match = value?.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  )

  if (!match) {
    return null
  }

  const timestamp = Date.UTC(
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
  const match = value?.match(
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
      'H', 'I', 'J', 'K', 'L'
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
      'C', 'E', 'F'
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

      // Nº Processo fica vazio até existir uma fonte segura.
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
  sheet: MomentSheetDefinition
) {
  clearWorksheetCell(
    files,
    sheet.path,
    sheet.titleCell
  )

  for (
    let columnIndex = sheet.firstItemColumn;
    columnIndex <= sheet.lastItemColumn;
    columnIndex += 1
  ) {
    const column =
      columnName(columnIndex)

    for (const row of [8, 9, 12, 13]) {
      clearWorksheetCell(
        files,
        sheet.path,
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
        sheet.path,
        `${column}${row}`
      )
    }
  }
}

function populateMoment(
  files: OfficialXlsmFiles,
  sheet: MomentSheetDefinition,
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
          { criterion, index }
        ]
      )
    )

  const criterionEntries =
    [...moment.resultsByCriterion.entries()]
      .flatMap(
        ([criterionId, results]) => {
          const resolved =
            criteriaById.get(criterionId)

          return resolved
            ? [{
                ...resolved,
                criterionId,
                results
              }]
            : []
        }
      )
      .sort(
        (left, right) =>
          left.index - right.index
      )

  setWorksheetString(
    files,
    sheet.path,
    sheet.titleCell,
    moment.title || moment.date
  )

  if (criterionEntries.length === 0) {
    return
  }

  const requiredColumns =
    criterionEntries.length * 2
  const availableColumns =
    sheet.lastItemColumn -
    sheet.firstItemColumn +
    1

  if (requiredColumns > availableColumns) {
    throw new Error(
      `O momento "${moment.title}" tem mais critérios do que cabem na folha oficial.`
    )
  }

  const acsInternalDomain =
    `D${model.criteria.length + 1}`
  const adaptationStartColumn =
    sheet.firstItemColumn +
    criterionEntries.length

  criterionEntries.forEach(
    (entry, itemIndex) => {
      const generalColumn =
        columnName(
          sheet.firstItemColumn + itemIndex
        )
      const adaptationColumn =
        columnName(
          adaptationStartColumn + itemIndex
        )

      setWorksheetString(
        files,
        sheet.path,
        `${generalColumn}8`,
        entry.criterion.label
      )
      setWorksheetNumber(
        files,
        sheet.path,
        `${generalColumn}9`,
        20
      )
      setWorksheetString(
        files,
        sheet.path,
        `${adaptationColumn}12`,
        acsInternalDomain
      )
      setWorksheetNumber(
        files,
        sheet.path,
        `${adaptationColumn}13`,
        20
      )

      snapshot.studentRows.forEach(
        (studentRow, studentIndex) => {
          const result =
            entry.results.get(
              studentRow.student.id
            )

          if (
            result?.status !== 'evaluated'
          ) {
            return
          }

          const usesAcs =
            studentRow.finalGradeRecord
              ?.usesAcs ?? false
          const targetColumn =
            usesAcs
              ? adaptationColumn
              : generalColumn

          setWorksheetNumber(
            files,
            sheet.path,
            `${targetColumn}${14 + studentIndex}`,
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

  for (
    let index = 0;
    index < 30;
    index += 1
  ) {
    const row = 12 + index

    for (const column of CFP_DOMAIN_COLUMNS) {
      clearWorksheetCell(
        files,
        CFP_SHEET,
        `${column}${row}`
      )
    }

    clearWorksheetCell(
      files,
      CFP_SHEET,
      `AA${row}`
    )
    clearWorksheetCell(
      files,
      CFP_SHEET,
      `AI${row}`
    )

    // A avaliação final deixa de depender do limite histórico de 5 instrumentos
    // por período. A CFP recebe diretamente os resultados agregados do MA-Professor.
    setWorksheetFormula(
      files,
      CFP_SHEET,
      `BW${row}`,
      `IF(AA${row}="","",ROUNDUP(AA${row},0))`
    )
  }

  model.rows.forEach(
    (student, index) => {
      const row = 12 + index

      student.criterionScores.forEach(
        (score, criterionIndex) => {
          if (score === null) {
            return
          }

          const column =
            CFP_DOMAIN_COLUMNS[
              criterionIndex
            ]

          if (column) {
            setWorksheetNumber(
              files,
              CFP_SHEET,
              `${column}${row}`,
              score
            )
          }
        }
      )

      if (
        student.usesAcs &&
        student.acsScore !== null
      ) {
        const acsColumn =
          CFP_DOMAIN_COLUMNS[
            model.criteria.length
          ]

        if (acsColumn) {
          setWorksheetNumber(
            files,
            CFP_SHEET,
            `${acsColumn}${row}`,
            student.acsScore
          )
        }
      }

      if (student.automaticLevel !== null) {
        setWorksheetNumber(
          files,
          CFP_SHEET,
          `AA${row}`,
          student.automaticLevel
        )
      }

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

  populateHome(
    files,
    snapshot,
    completionDate
  )

  const momentSheets =
    materializeMomentSheets(
      files,
      moments.length
    )

  momentSheets.forEach(
    sheet =>
      clearMomentInputs(
        files,
        sheet
      )
  )

  moments.forEach(
    (moment, index) =>
      populateMoment(
        files,
        momentSheets[index],
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
