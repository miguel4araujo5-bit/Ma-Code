import {
  assessmentAtomicPersistenceRepository
} from '../assessmentAtomicPersistenceRepository'

import {
  assessmentRepository,
  type LessonAssessmentWorkspace
} from '../assessments/assessmentRepository'

import type {
  AssessmentCriterion,
  EntityId,
  Lesson,
  LessonAssessment,
  Score
} from '../types'

const DAILY_GRID_MARKER =
  'Registo diário'

export interface DailyCriteriaGridSnapshot {
  criteria: AssessmentCriterion[]
  scoresByStudentId: Record<
    EntityId,
    Record<EntityId, Score>
  >
  activity: string
}

export interface DailyCriteriaGridSaveRow {
  studentId: EntityId
  attendanceStatus:
    | 'present'
    | 'absent'
  scores: Record<EntityId, string>
}

export interface DailyCriteriaGridSaveInput {
  lesson: Lesson
  summary: string
  activity: string
  rows: DailyCriteriaGridSaveRow[]
}

function roundScore(
  value: number
) {
  return (
    Math.round(
      value * 100
    ) / 100
  )
}

function isDailyGridAssessment(
  assessment: LessonAssessment
) {
  return (
    assessment.activityType ===
      'other' &&
    assessment.title.includes(
      ` · ${DAILY_GRID_MARKER} · `
    )
  )
}

function listDailyGridAssessments(
  workspace: LessonAssessmentWorkspace,
  criterionId: EntityId
) {
  return workspace.assessments
    .map(item => item.assessment)
    .filter(
      assessment =>
        assessment.criterionId ===
          criterionId &&
        isDailyGridAssessment(
          assessment
        )
    )
}

function findDailyGridAssessment(
  workspace: LessonAssessmentWorkspace,
  criterionId: EntityId
) {
  const assessments =
    listDailyGridAssessments(
      workspace,
      criterionId
    )

  return assessments[
    assessments.length - 1
  ] ?? null
}

export function normalizeDailyCriterionScoreInput(
  value: string
) {
  const cleanedValue = value
    .replace(',', '.')
    .replace(
      /[^0-9.]/g,
      ''
    )

  const [
    integerPart = '',
    ...decimalParts
  ] = cleanedValue.split('.')

  return decimalParts.length > 0
    ? `${integerPart}.${decimalParts
        .join('')
        .slice(0, 2)}`
    : integerPart
}

export function parseDailyCriterionScore(
  value: string
): Score {
  const normalized =
    value.trim().replace(',', '.')

  const score =
    Number(normalized)

  if (
    normalized === '' ||
    !Number.isFinite(score) ||
    score < 0 ||
    score > 20
  ) {
    throw new Error(
      'A classificação deve estar entre 0 e 20 valores.'
    )
  }

  return roundScore(score)
}

export function calculateDailyCriteriaAverage(
  scores: Record<EntityId, string>,
  criteria: AssessmentCriterion[]
): Score | null {
  if (
    criteria.length === 0
  ) {
    return null
  }

  let weightedTotal = 0
  let assessedWeight = 0

  for (const criterion of criteria) {
    const raw =
      scores[criterion.id] ?? ''

    let score: Score

    try {
      score =
        parseDailyCriterionScore(
          raw
        )
    } catch {
      return null
    }

    weightedTotal +=
      score *
      criterion.weightPercent

    assessedWeight +=
      criterion.weightPercent
  }

  if (
    assessedWeight <= 0
  ) {
    return null
  }

  return roundScore(
    weightedTotal /
      assessedWeight
  )
}

function buildAssessmentTitle(
  input: DailyCriteriaGridSaveInput,
  criterion: AssessmentCriterion
) {
  const base =
    input.activity.trim() ||
    input.summary.trim() ||
    'Avaliação'

  return `${base} · ${DAILY_GRID_MARKER} · ${criterion.name}`
}

export class DailyCriteriaGridRepository {
  async getLessonGrid(
    lessonId: EntityId
  ): Promise<DailyCriteriaGridSnapshot> {
    const workspace =
      await assessmentRepository
        .getLessonAssessmentWorkspace(
          lessonId
        )

    const gridAssessments =
      workspace.criteria.map(
        criterion =>
          findDailyGridAssessment(
            workspace,
            criterion.id
          )
      )

    const registers =
      await Promise.all(
        gridAssessments.map(
          assessment =>
            assessment
              ? assessmentRepository
                  .getAssessmentRegister(
                    assessment.id
                  )
              : Promise.resolve(null)
        )
      )

    const scoresByStudentId:
      DailyCriteriaGridSnapshot['scoresByStudentId'] =
      Object.fromEntries(
        workspace.students.map(
          student => [
            student.id,
            {}
          ]
        )
      )

    workspace.criteria.forEach(
      (criterion, index) => {
        const register =
          registers[index]

        if (!register) {
          return
        }

        register.rows.forEach(
          row => {
            if (
              row.result?.status !==
              'evaluated'
            ) {
              return
            }

            const current =
              scoresByStudentId[
                row.student.id
              ] ?? {}

            current[criterion.id] =
              row.result.score

            scoresByStudentId[
              row.student.id
            ] = current
          }
        )
      }
    )

    const activity =
      gridAssessments.find(
        assessment =>
          Boolean(
            assessment
              ?.description
              .trim()
          )
      )?.description ?? ''

    return {
      criteria:
        workspace.criteria,
      scoresByStudentId,
      activity
    }
  }

  async saveLessonGrid(
    input: DailyCriteriaGridSaveInput
  ) {
    const workspace =
      await assessmentRepository
        .getLessonAssessmentWorkspace(
          input.lesson.id
        )

    if (
      input.lesson.status ===
      'cancelled'
    ) {
      return this.getLessonGrid(
        input.lesson.id
      )
    }

    const workspaceStudentIds =
      new Set(
        workspace.students.map(
          student =>
            student.id
        )
      )

    for (const row of input.rows) {
      if (
        !workspaceStudentIds.has(
          row.studentId
        )
      ) {
        throw new Error(
          'Um dos alunos da grelha já não pertence a esta aula.'
        )
      }
    }

    for (const row of input.rows) {
      if (
        row.attendanceStatus ===
        'absent'
      ) {
        continue
      }

      for (const criterion of workspace.criteria) {
        parseDailyCriterionScore(
          row.scores[
            criterion.id
          ] ?? ''
        )
      }
    }

    for (const criterion of workspace.criteria) {
      const entries =
        input.rows.flatMap(
          row => {
            if (
              row.attendanceStatus ===
              'absent'
            ) {
              return []
            }

            return [
              {
                studentId:
                  row.studentId,
                status:
                  'evaluated' as const,
                score:
                  parseDailyCriterionScore(
                    row.scores[
                      criterion.id
                    ] ?? ''
                  ),
                note: ''
              }
            ]
          }
        )

      const matchingAssessments =
        listDailyGridAssessments(
          workspace,
          criterion.id
        )

      const existing =
        matchingAssessments[
          matchingAssessments.length - 1
        ] ?? null

      if (
        entries.length === 0
      ) {
        for (const assessment of matchingAssessments) {
          await assessmentRepository
            .deleteLessonAssessment(
              assessment.id
            )
        }

        continue
      }

      const title =
        buildAssessmentTitle(
          input,
          criterion
        )

      if (existing) {
        await assessmentRepository
          .saveAssessmentResults(
            existing.id,
            entries
          )

        await assessmentRepository
          .updateLessonAssessment(
            existing.id,
            {
              title,
              activityType: 'other',
              description:
                input.activity
            }
          )

        for (
          const duplicate of
            matchingAssessments.slice(
              0,
              -1
            )
        ) {
          await assessmentRepository
            .deleteLessonAssessment(
              duplicate.id
            )
        }

        continue
      }

      await assessmentAtomicPersistenceRepository
        .createLessonAssessmentWithResults(
          {
            lessonId:
              input.lesson.id,
            criterionId:
              criterion.id,
            title,
            activityType: 'other',
            description:
              input.activity
          },
          entries
        )
    }

    return this.getLessonGrid(
      input.lesson.id
    )
  }
}

export const dailyCriteriaGridRepository =
  new DailyCriteriaGridRepository()
