import type {
  AssessmentCriterion,
  AssessmentResult,
  EntityId,
  LessonAssessment,
  Score
} from '../types'

export interface LessonCriterionAverage {
  criterionId: EntityId
  average: Score | null
}

export interface StudentLessonGrade {
  lessonId: EntityId
  complete: boolean
  grade: Score | null
  criteria: LessonCriterionAverage[]
}

export interface StudentLessonGradeSummary {
  lessons: StudentLessonGrade[]
  provisionalAverage: Score | null
  allEvaluatedLessonsComplete: boolean
  suggestedGrade: Score | null
}

const MIN_SCORE = 0
const MAX_SCORE = 20

function roundScore(
  value: number
): Score {
  return (
    Math.round(
      value * 100
    ) / 100
  )
}

function calculateAverage(
  values: number[]
): Score | null {
  if (
    values.length === 0
  ) {
    return null
  }

  return roundScore(
    values.reduce(
      (
        total,
        value
      ) => total + value,
      0
    ) / values.length
  )
}

export function calculateStudentLessonGradeSummary(
  criteria: AssessmentCriterion[],
  assessments: LessonAssessment[],
  results: AssessmentResult[],
  studentId: EntityId
): StudentLessonGradeSummary {
  if (
    criteria.length === 0
  ) {
    return {
      lessons: [],
      provisionalAverage: null,
      allEvaluatedLessonsComplete: false,
      suggestedGrade: null
    }
  }

  const criterionById =
    new Map(
      criteria.map(
        criterion => [
          criterion.id,
          criterion
        ]
      )
    )

  const assessmentById =
    new Map(
      assessments
        .filter(
          assessment =>
            criterionById.has(
              assessment.criterionId
            )
        )
        .map(
          assessment => [
            assessment.id,
            assessment
          ]
        )
    )

  const scoresByLessonAndCriterion =
    new Map<
      EntityId,
      Map<EntityId, Score[]>
    >()

  results.forEach(
    result => {
      if (
        result.studentId !== studentId
      ) {
        return
      }

      const assessment =
        assessmentById.get(
          result.assessmentId
        )

      if (
        !assessment
      ) {
        return
      }

      let scoresByCriterion =
        scoresByLessonAndCriterion.get(
          assessment.lessonId
        )

      if (
        !scoresByCriterion
      ) {
        scoresByCriterion =
          new Map<
            EntityId,
            Score[]
          >()

        scoresByLessonAndCriterion.set(
          assessment.lessonId,
          scoresByCriterion
        )
      }

      const scores =
        scoresByCriterion.get(
          assessment.criterionId
        ) ?? []

      scores.push(
        result.score
      )

      scoresByCriterion.set(
        assessment.criterionId,
        scores
      )
    }
  )

  const activeWeight =
    criteria.reduce(
      (
        total,
        criterion
      ) =>
        total +
        criterion.weightPercent,
      0
    )

  const lessons =
    [...scoresByLessonAndCriterion.entries()]
      .map(
        ([
          lessonId,
          scoresByCriterion
        ]): StudentLessonGrade => {
          const criterionAverages =
            criteria.map(
              criterion => ({
                criterionId:
                  criterion.id,
                average:
                  calculateAverage(
                    scoresByCriterion.get(
                      criterion.id
                    ) ?? []
                  )
              })
            )

          const complete =
            activeWeight > 0 &&
            criterionAverages.every(
              criterion =>
                criterion.average !== null
            )

          if (
            !complete
          ) {
            return {
              lessonId,
              complete: false,
              grade: null,
              criteria:
                criterionAverages
            }
          }

          const weightedTotal =
            criterionAverages.reduce(
              (
                total,
                criterionAverage
              ) => {
                const criterion =
                  criterionById.get(
                    criterionAverage.criterionId
                  )

                return (
                  total +
                  (
                    criterionAverage.average ?? 0
                  ) *
                    (
                      criterion?.weightPercent ?? 0
                    )
                )
              },
              0
            )

          return {
            lessonId,
            complete: true,
            grade:
              roundScore(
                weightedTotal /
                  activeWeight
              ),
            criteria:
              criterionAverages
          }
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          left.lessonId.localeCompare(
            right.lessonId
          )
      )

  const completeLessonGrades =
    lessons.flatMap(
      lesson =>
        lesson.grade === null
          ? []
          : [lesson.grade]
    )

  const provisionalAverage =
    calculateAverage(
      completeLessonGrades
    )

  const allEvaluatedLessonsComplete =
    lessons.length > 0 &&
    completeLessonGrades.length ===
      lessons.length

  const suggestedGrade =
    allEvaluatedLessonsComplete &&
    provisionalAverage !== null
      ? Math.max(
          MIN_SCORE,
          Math.min(
            MAX_SCORE,
            Math.round(
              provisionalAverage
            )
          )
        )
      : null

  return {
    lessons,
    provisionalAverage,
    allEvaluatedLessonsComplete,
    suggestedGrade
  }
}
