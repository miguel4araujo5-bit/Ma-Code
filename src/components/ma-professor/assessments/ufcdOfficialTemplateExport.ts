import {
  gunzipSync,
  strFromU8,
  strToU8,
  unzipSync,
  zipSync
} from 'fflate'

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

const XLSM_MIME =
  'application/vnd.ms-excel.sheet.macroEnabled.12'

const TEMPLATE_GZIP_URL =
  '/ma-professor/templates/ufcd-cfp-template.xlsm.gz'

const SPREADSHEET_NS =
  'http://schemas.openxmlformats.org/spreadsheetml/2006/main'

const OFFICE_REL_NS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const PACKAGE_REL_NS =
  'http://schemas.openxmlformats.org/package/2006/relationships'

const XML_NS =
  'http://www.w3.org/XML/1998/namespace'

const MAX_TEMPLATE_STUDENTS = 30

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

const GENERAL_COLUMNS = [
  'E',
  'F',
  'G'
] as const

const ACS_COLUMNS = [
  'G',
  'H',
  'I',
  'J',
  'K'
] as const

const ACS_WEIGHTS = [
  25,
  25,
  10,
  20,
  20
] as const

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

type WorkbookFiles =
  Record<string, Uint8Array>

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
      Omit<
        EvaluationMoment,
        'sheetName'
      >
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

  const moments =
    Array.from(
      groups.values()
    )

  if (
    moments.length >
    OFFICIAL_MOMENT_SHEETS.length
  ) {
    throw new Error(
      `O modelo oficial suporta até ${OFFICIAL_MOMENT_SHEETS.length} momentos de avaliação por UFCD.`
    )
  }

  return moments.map(
    (moment, index) => ({
      ...moment,
      sheetName:
        OFFICIAL_MOMENT_SHEETS[
          index
        ]
    })
  )
}

function parseXml(
  bytes: Uint8Array,
  label: string
) {
  const document =
    new DOMParser().parseFromString(
      strFromU8(bytes),
      'application/xml'
    )

  const parserError =
    document.getElementsByTagName(
      'parsererror'
    )[0]

  if (parserError) {
    throw new Error(
      `O modelo Excel contém XML inválido em ${label}.`
    )
  }

  return document
}

function serializeXml(
  document: Document
) {
  return strToU8(
    new XMLSerializer()
      .serializeToString(
        document
      )
  )
}

function worksheetPathMap(
  files: WorkbookFiles
) {
  const workbookBytes =
    files['xl/workbook.xml']

  const relsBytes =
    files[
      'xl/_rels/workbook.xml.rels'
    ]

  if (
    !workbookBytes ||
    !relsBytes
  ) {
    throw new Error(
      'O modelo Excel oficial está incompleto.'
    )
  }

  const workbook =
    parseXml(
      workbookBytes,
      'xl/workbook.xml'
    )

  const relationships =
    parseXml(
      relsBytes,
      'xl/_rels/workbook.xml.rels'
    )

  const targetById =
    new Map<string, string>()

  Array.from(
    relationships.getElementsByTagNameNS(
      PACKAGE_REL_NS,
      'Relationship'
    )
  ).forEach(
    relationship => {
      const id =
        relationship.getAttribute(
          'Id'
        )

      const target =
        relationship.getAttribute(
          'Target'
        )

      if (
        id &&
        target
      ) {
        const normalized =
          target.startsWith('/')
            ? target.slice(1)
            : `xl/${target.replace(
                /^\.?\//,
                ''
              )}`

        targetById.set(
          id,
          normalized
        )
      }
    }
  )

  const pathBySheet =
    new Map<string, string>()

  Array.from(
    workbook.getElementsByTagNameNS(
      SPREADSHEET_NS,
      'sheet'
    )
  ).forEach(
    sheet => {
      const name =
        sheet.getAttribute(
          'name'
        )

      const relationshipId =
        sheet.getAttributeNS(
          OFFICE_REL_NS,
          'id'
        )

      const path =
        relationshipId
          ? targetById.get(
              relationshipId
            )
          : null

      if (
        name &&
        path
      ) {
        pathBySheet.set(
          name,
          path
        )
      }
    }
  )

  return pathBySheet
}

function findCell(
  document: Document,
  reference: string
) {
  return Array.from(
    document.getElementsByTagNameNS(
      SPREADSHEET_NS,
      'c'
    )
  ).find(
    cell =>
      cell.getAttribute('r') ===
      reference
  ) ?? null
}

function requireCell(
  document: Document,
  reference: string,
  sheetName: string
) {
  const cell =
    findCell(
      document,
      reference
    )

  if (!cell) {
    throw new Error(
      `O modelo oficial não contém a célula ${sheetName}!${reference}.`
    )
  }

  return cell
}

function removeChildren(
  cell: Element,
  localNames: string[]
) {
  Array.from(
    cell.children
  ).forEach(
    child => {
      if (
        localNames.includes(
          child.localName
        )
      ) {
        cell.removeChild(child)
      }
    }
  )
}

function clearEditableCell(
  cell: Element
) {
  removeChildren(
    cell,
    [
      'f',
      'v',
      'is'
    ]
  )

  cell.removeAttribute('t')
}

function setInlineString(
  document: Document,
  cell: Element,
  value: string
) {
  clearEditableCell(cell)

  if (!value) {
    return
  }

  cell.setAttribute(
    't',
    'inlineStr'
  )

  const inline =
    document.createElementNS(
      SPREADSHEET_NS,
      'is'
    )

  const text =
    document.createElementNS(
      SPREADSHEET_NS,
      't'
    )

  if (
    value !== value.trim()
  ) {
    text.setAttributeNS(
      XML_NS,
      'xml:space',
      'preserve'
    )
  }

  text.textContent = value
  inline.appendChild(text)
  cell.appendChild(inline)
}

function setNumber(
  document: Document,
  cell: Element,
  value: number | null
) {
  clearEditableCell(cell)

  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return
  }

  const node =
    document.createElementNS(
      SPREADSHEET_NS,
      'v'
    )

  node.textContent =
    String(
      Math.round(
        value * 100
      ) / 100
    )

  cell.appendChild(node)
}

function setCell(
  document: Document,
  sheetName: string,
  reference: string,
  value:
    | string
    | number
    | null
) {
  const cell =
    requireCell(
      document,
      reference,
      sheetName
    )

  if (
    typeof value ===
    'number'
  ) {
    setNumber(
      document,
      cell,
      value
    )
    return
  }

  setInlineString(
    document,
    cell,
    value ?? ''
  )
}

function clearCellIfPresent(
  document: Document,
  reference: string
) {
  const cell =
    findCell(
      document,
      reference
    )

  if (cell) {
    clearEditableCell(cell)
  }
}

function editSheet(
  files: WorkbookFiles,
  paths: Map<string, string>,
  sheetName: string,
  edit: (
    document: Document
  ) => void
) {
  const path =
    paths.get(sheetName)

  if (
    !path ||
    !files[path]
  ) {
    throw new Error(
      `O modelo oficial não contém a folha ${sheetName}.`
    )
  }

  const document =
    parseXml(
      files[path],
      path
    )

  edit(document)

  files[path] =
    serializeXml(document)
}

function configureHomeSheet(
  files: WorkbookFiles,
  paths: Map<string, string>,
  snapshot: AssessmentWorkspaceSnapshot
) {
  if (
    snapshot.criteria.length >
    3
  ) {
    throw new Error(
      'O modelo CFP atual suporta D1, D2 e D3, mais ACS como via de avaliação específica.'
    )
  }

  if (
    snapshot.studentRows.length >
    MAX_TEMPLATE_STUDENTS
  ) {
    throw new Error(
      `O modelo oficial suporta até ${MAX_TEMPLATE_STUDENTS} alunos por turma.`
    )
  }

  const model =
    buildUfcdCfpModel(
      snapshot
    )

  editSheet(
    files,
    paths,
    'HOME',
    document => {
      setCell(
        document,
        'HOME',
        'D6',
        model.academicYear
      )
      setCell(
        document,
        'HOME',
        'D7',
        model.subject
      )
      setCell(
        document,
        'HOME',
        'D8',
        model.gradeLevel
      )
      setCell(
        document,
        'HOME',
        'D9',
        model.group
      )
      setCell(
        document,
        'HOME',
        'D10',
        model.course
      )
      setCell(
        document,
        'HOME',
        'D11',
        model.moduleLabel
      )

      for (
        let index = 0;
        index < 3;
        index += 1
      ) {
        const row =
          15 + index

        const criterion =
          snapshot.criteria[index]

        setCell(
          document,
          'HOME',
          `B${row}`,
          index + 1
        )

        setCell(
          document,
          'HOME',
          `C${row}`,
          criterion?.name ?? ''
        )

        setCell(
          document,
          'HOME',
          `E${row}`,
          criterion
            ? `D${index + 1}`
            : ''
        )

        setCell(
          document,
          'HOME',
          `F${row}`,
          criterion
            ?.weightPercent ??
            null
        )
      }

      setCell(
        document,
        'HOME',
        'B18',
        4
      )

      setCell(
        document,
        'HOME',
        'C18',
        'Medidas para Adaptações Curriculares Significativas'
      )

      setCell(
        document,
        'HOME',
        'E18',
        'ACS'
      )

      setCell(
        document,
        'HOME',
        'F18',
        100
      )

      for (
        let index = 0;
        index <
        MAX_TEMPLATE_STUDENTS;
        index += 1
      ) {
        const row =
          6 + index

        const studentRow =
          snapshot.studentRows[
            index
          ]

        setCell(
          document,
          'HOME',
          `H${row}`,
          ''
        )

        setCell(
          document,
          'HOME',
          `I${row}`,
          studentRow
            ?.student.number ??
            ''
        )

        setCell(
          document,
          'HOME',
          `J${row}`,
          studentRow
            ?.student.name ??
            ''
        )

        setCell(
          document,
          'HOME',
          `K${row}`,
          studentRow
            ?.finalGradeRecord
            ?.usesAcs
            ? 'sim'
            : ''
        )
      }
    }
  )
}

function resultFor(
  moment: EvaluationMoment,
  criterionId: EntityId,
  studentId: EntityId
) {
  return moment
    .resultsByCriterion
    .get(criterionId)
    ?.get(studentId) ??
    null
}

function regularMomentValue(
  result: AssessmentResult | null,
  weightPercent: number
):
  | number
  | string
  | null {
  if (!result) {
    return null
  }

  if (
    result.status ===
    'exempt'
  ) {
    return '—'
  }

  if (
    result.status ===
    'absent'
  ) {
    return result.score === 0
      ? 0
      : (
          result.score /
          20 *
          weightPercent
        )
  }

  return (
    result.score /
    20 *
    weightPercent
  )
}

function acsMomentScore(
  snapshot: AssessmentWorkspaceSnapshot,
  moment: EvaluationMoment,
  studentId: EntityId
) {
  let weightedScore = 0
  let activeWeight = 0

  snapshot.criteria
    .slice(0, 3)
    .forEach(
      criterion => {
        const result =
          resultFor(
            moment,
            criterion.id,
            studentId
          )

        if (
          !result ||
          result.status ===
            'exempt'
        ) {
          return
        }

        weightedScore +=
          result.score *
          criterion.weightPercent

        activeWeight +=
          criterion.weightPercent
      }
    )

  if (
    activeWeight ===
    0
  ) {
    return null
  }

  return (
    weightedScore /
    activeWeight
  )
}

function configureMomentSheet(
  files: WorkbookFiles,
  paths: Map<string, string>,
  snapshot: AssessmentWorkspaceSnapshot,
  sheetName: string,
  moment: EvaluationMoment | null
) {
  editSheet(
    files,
    paths,
    sheetName,
    document => {
      setCell(
        document,
        sheetName,
        'G2',
        moment?.title ?? ''
      )

      for (
        let index = 0;
        index < 3;
        index += 1
      ) {
        const column =
          GENERAL_COLUMNS[
            index
          ]

        const criterion =
          snapshot.criteria[
            index
          ]

        setCell(
          document,
          sheetName,
          `${column}8`,
          criterion
            ? `D${index + 1}`
            : ''
        )

        setCell(
          document,
          sheetName,
          `${column}9`,
          criterion
            ?.weightPercent ??
            null
        )
      }

      ACS_COLUMNS.forEach(
        (
          column,
          index
        ) => {
          setCell(
            document,
            sheetName,
            `${column}12`,
            'D4'
          )

          setCell(
            document,
            sheetName,
            `${column}13`,
            ACS_WEIGHTS[index]
          )
        }
      )

      for (
        let studentIndex = 0;
        studentIndex <
        MAX_TEMPLATE_STUDENTS;
        studentIndex += 1
      ) {
        const excelRow =
          14 + studentIndex

        for (
          let columnIndex = 5;
          columnIndex <= 50;
          columnIndex += 1
        ) {
          let number =
            columnIndex

          let column = ''

          while (number > 0) {
            const remainder =
              (
                number -
                1
              ) %
              26

            column =
              String.fromCharCode(
                65 + remainder
              ) +
              column

            number =
              Math.floor(
                (
                  number -
                  1
                ) /
                26
              )
          }

          clearCellIfPresent(
            document,
            `${column}${excelRow}`
          )
        }

        const studentRow =
          snapshot.studentRows[
            studentIndex
          ]

        if (
          !studentRow ||
          !moment
        ) {
          continue
        }

        const usesAcs =
          studentRow
            .finalGradeRecord
            ?.usesAcs ??
          false

        if (usesAcs) {
          const score =
            acsMomentScore(
              snapshot,
              moment,
              studentRow.student.id
            )

          if (
            score ===
            null
          ) {
            continue
          }

          ACS_COLUMNS.forEach(
            (
              column,
              index
            ) => {
              const points =
                score /
                20 *
                ACS_WEIGHTS[index]

              setCell(
                document,
                sheetName,
                `${column}${excelRow}`,
                points
              )
            }
          )

          continue
        }

        snapshot.criteria
          .slice(0, 3)
          .forEach(
            (
              criterion,
              criterionIndex
            ) => {
              const value =
                regularMomentValue(
                  resultFor(
                    moment,
                    criterion.id,
                    studentRow.student.id
                  ),
                  criterion.weightPercent
                )

              setCell(
                document,
                sheetName,
                `${GENERAL_COLUMNS[
                  criterionIndex
                ]}${excelRow}`,
                value
              )
            }
          )
      }
    }
  )
}

function forceWorkbookRecalculation(
  files: WorkbookFiles
) {
  const path =
    'xl/workbook.xml'

  const bytes =
    files[path]

  if (!bytes) {
    throw new Error(
      'O modelo Excel oficial não contém xl/workbook.xml.'
    )
  }

  const document =
    parseXml(
      bytes,
      path
    )

  let calcPr =
    document.getElementsByTagNameNS(
      SPREADSHEET_NS,
      'calcPr'
    )[0]

  if (!calcPr) {
    calcPr =
      document.createElementNS(
        SPREADSHEET_NS,
        'calcPr'
      )

    document.documentElement
      .appendChild(calcPr)
  }

  calcPr.setAttribute(
    'calcMode',
    'auto'
  )
  calcPr.setAttribute(
    'fullCalcOnLoad',
    '1'
  )
  calcPr.setAttribute(
    'forceFullCalc',
    '1'
  )

  files[path] =
    serializeXml(document)
}

async function loadOfficialTemplate() {
  const response =
    await fetch(
      TEMPLATE_GZIP_URL,
      {
        cache: 'no-store'
      }
    )

  if (!response.ok) {
    throw new Error(
      'Não foi possível carregar o modelo oficial CFP.'
    )
  }

  const compressed =
    new Uint8Array(
      await response.arrayBuffer()
    )

  const xlsmBytes =
    gunzipSync(
      compressed
    )

  const files =
    unzipSync(
      xlsmBytes
    )

  if (
    !files[
      'xl/vbaProject.bin'
    ]
  ) {
    throw new Error(
      'O modelo oficial perdeu o projeto VBA. A exportação foi cancelada para não entregar um ficheiro incompleto.'
    )
  }

  return files
}

export async function exportUfcdFinalGradeExcel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const model =
    buildUfcdCfpModel(
      snapshot
    )

  const moments =
    await loadEvaluationMoments(
      snapshot
    )

  const files =
    await loadOfficialTemplate()

  const paths =
    worksheetPathMap(
      files
    )

  configureHomeSheet(
    files,
    paths,
    snapshot
  )

  const momentBySheet =
    new Map(
      moments.map(
        moment => [
          moment.sheetName,
          moment
        ]
      )
    )

  OFFICIAL_MOMENT_SHEETS.forEach(
    sheetName =>
      configureMomentSheet(
        files,
        paths,
        snapshot,
        sheetName,
        momentBySheet.get(
          sheetName
        ) ?? null
      )
  )

  forceWorkbookRecalculation(
    files
  )

  const bytes =
    zipSync(
      files,
      {
        level: 6
      }
    )

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
