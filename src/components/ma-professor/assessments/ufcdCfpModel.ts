import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import {
  getCachedModuleCompletionDate
} from './ufcdCompletionDate'

export interface UfcdCfpCriterion {
  id: string
  label: string
  name: string
  weightPercent: number
}

export interface UfcdCfpStudentRow {
  processNumber: string
  studentNumber: string
  studentName: string
  usesAcs: boolean
  criterionScores: Array<number | null>
  acsScore: number | null
  automaticLevel: number | null
  selfAssessmentGrade: number | null
  finalGrade: number | null
}

export interface UfcdCfpGradeBand {
  label: string
  count: number
  percent: number
}

export interface UfcdCfpModel {
  academicYear: string
  subject: string
  course: string
  gradeLevel: string
  group: string
  moduleLabel: string
  criteria: UfcdCfpCriterion[]
  rows: UfcdCfpStudentRow[]
  gradeBands: UfcdCfpGradeBand[]
  negativeCount: number
  negativePercent: number
  positiveCount: number
  positivePercent: number
  evaluatedCount: number
  completionDate: string
  fileBaseName: string
}

function safeFilePart(
  value: string
) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function cleanModuleDisplayName(
  value: string
) {
  const normalized = value
    .replace(/\s+/g, ' ')
    .trim()

  const contaminationMarkers = [
    /\s+fichas?\s+de\s+avalia[cç][aã]o\b/i,
    /\s+avalia[cç][aã]o\s*[:–—-]/i
  ]

  let end = normalized.length

  for (const marker of contaminationMarkers) {
    const match = marker.exec(normalized)

    if (
      match &&
      match.index > 0
    ) {
      end = Math.min(
        end,
        match.index
      )
    }
  }

  return normalized
    .slice(0, end)
    .replace(/[\s–—:;-]+$/g, '')
    .trim()
}

function formatModuleLabel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const module = snapshot.selectedModule

  if (!module) {
    return ''
  }

  const code = module.code.trim()
  const name =
    cleanModuleDisplayName(
      module.name
    )

  return code
    ? `${code} ${name}`.trim()
    : name
}

function formatCompletionDate(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const module = snapshot.selectedModule

  if (!module) {
    return ''
  }

  const completionDate =
    getCachedModuleCompletionDate(
      module.id
    )

  const match =
    completionDate?.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    )

  if (!match) {
    return ''
  }

  return `${match[3]}/${match[2]}/${match[1]}`
}

function bandCount(
  grades: number[],
  minimum: number,
  maximum: number
) {
  return grades.filter(
    grade =>
      grade >= minimum &&
      grade <= maximum
  ).length
}

function percent(
  count: number,
  total: number
) {
  if (total === 0) {
    return 0
  }

  return Math.round(
    (count / total) * 100
  )
}

export function buildUfcdCfpModel(
  snapshot: AssessmentWorkspaceSnapshot
): UfcdCfpModel {
  if (
    !snapshot.selectedGroup ||
    !snapshot.selectedSubject ||
    !snapshot.selectedModule
  ) {
    throw new Error(
      'Selecione uma turma, disciplina e UFCD antes de preparar a folha CFP.'
    )
  }

  const criteria = snapshot.criteria
    .slice(0, 6)
    .map(
      (criterion, index) => ({
        id: criterion.id,
        label: `D${index + 1}`,
        name: criterion.name,
        weightPercent:
          criterion.weightPercent
      })
    )

  const rows = snapshot.studentRows.map(
    row => {
      const usesAcs =
        row.finalGradeRecord
          ?.usesAcs ?? false

      const criterionScores =
        criteria.map(
          criterion => {
            if (usesAcs) {
              return null
            }

            return (
              row.gradeSummary.criteria.find(
                current =>
                  current.criterionId ===
                  criterion.id
              )?.average ?? null
            )
          }
        )

      return {
        processNumber: '',
        studentNumber:
          row.student.number,
        studentName:
          row.student.name,
        usesAcs,
        criterionScores,
        acsScore:
          usesAcs
            ? row.gradeSummary
                .provisionalAverage
            : null,
        automaticLevel:
          row.gradeSummary
            .provisionalAverage,
        selfAssessmentGrade:
          row.finalGradeRecord
            ?.selfAssessmentGrade ?? null,
        finalGrade:
          row.gradeSummary
            .confirmedFinalGrade
      }
    }
  )

  const confirmedGrades = rows.flatMap(
    row =>
      row.finalGrade === null
        ? []
        : [row.finalGrade]
  )

  const evaluatedCount =
    confirmedGrades.length

  const rawBands = [
    ['1 - 6', 1, 6],
    ['7 - 9', 7, 9],
    ['10 - 13', 10, 13],
    ['14 - 17', 14, 17],
    ['18 - 20', 18, 20]
  ] as const

  const gradeBands = rawBands.map(
    ([label, minimum, maximum]) => {
      const count =
        bandCount(
          confirmedGrades,
          minimum,
          maximum
        )

      return {
        label,
        count,
        percent:
          percent(
            count,
            evaluatedCount
          )
      }
    }
  )

  const negativeCount =
    confirmedGrades.filter(
      grade => grade < 10
    ).length

  const positiveCount =
    confirmedGrades.filter(
      grade => grade >= 10
    ).length

  const modulePart =
    safeFilePart(
      snapshot.selectedModule.code ||
      snapshot.selectedModule.name
    ) || 'UFCD'

  const groupPart =
    safeFilePart(
      snapshot.selectedGroup.name
    ) || 'Turma'

  return {
    academicYear:
      snapshot.academicYear.name,
    subject:
      snapshot.selectedSubject.name,
    course:
      snapshot.selectedGroup.courseName,
    gradeLevel:
      snapshot.selectedGroup.gradeLevel,
    group:
      snapshot.selectedGroup.name,
    moduleLabel:
      formatModuleLabel(snapshot),
    criteria,
    rows,
    gradeBands,
    negativeCount,
    negativePercent:
      percent(
        negativeCount,
        evaluatedCount
      ),
    positiveCount,
    positivePercent:
      percent(
        positiveCount,
        evaluatedCount
      ),
    evaluatedCount,
    completionDate:
      formatCompletionDate(snapshot),
    fileBaseName:
      `Grelha-Avaliacao-${groupPart}-${modulePart}`
  }
}
