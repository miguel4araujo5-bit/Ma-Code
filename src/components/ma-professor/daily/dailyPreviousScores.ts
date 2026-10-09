import { maProfessorDb } from '../db'
import type {
  AssessmentCriterion,
  AssessmentResult,
  AssessmentScheme,
  EntityId,
  Lesson,
  LessonAssessment,
  Score,
  Student
} from '../types'

export interface DailyPreviousScoreHistory {
  currentLesson: Lesson
  students: Student[]
  targetCriteria: AssessmentCriterion[]
  targetAcsCriterionIds: EntityId[]
  applicableCriterionIdsByStudent?: Record<EntityId, EntityId[]>
  earlierLessons: Lesson[]
  assessments: LessonAssessment[]
  results: AssessmentResult[]
  sourceCriteria: AssessmentCriterion[]
  sourceSchemes: AssessmentScheme[]
}

function criterionKey(name: string, profile: string) {
  return profile + '\u0000' + name.trim().normalize('NFC').toLocaleLowerCase('pt-PT').replace(/\s+/g, ' ')
}

/**
 * Proposes the last saved DAILY grade for each student and compatible criterion.
 * No previously stored grade is changed; an inherited value only becomes a new
 * assessment when the teacher deliberately saves the current lesson.
 */
export function chooseDailyPreviousScores(
  history: DailyPreviousScoreHistory
): Record<EntityId, Record<EntityId, Score>> {
  const {
    currentLesson, students, targetCriteria, targetAcsCriterionIds,
    applicableCriterionIdsByStudent, earlierLessons, assessments, results,
    sourceCriteria, sourceSchemes
  } = history

  const studentById = new Map(students.map(student => [student.id, student]))
  const lessonById = new Map(earlierLessons.map(lesson => [lesson.id, lesson]))
  const sourceCriterionById = new Map(sourceCriteria.map(criterion => [criterion.id, criterion]))
  const schemeById = new Map(sourceSchemes.map(scheme => [scheme.id, scheme]))
  const acsTargetIds = new Set(targetAcsCriterionIds)
  const targetKeyToIds = new Map<string, EntityId[]>()

  for (const criterion of targetCriteria) {
    const key = criterionKey(criterion.name, acsTargetIds.has(criterion.id) ? 'acs' : 'general')
    targetKeyToIds.set(key, [...(targetKeyToIds.get(key) ?? []), criterion.id])
  }

  const resultsByAssessment = new Map<EntityId, AssessmentResult[]>()
  for (const result of results) {
    resultsByAssessment.set(result.assessmentId, [
      ...(resultsByAssessment.get(result.assessmentId) ?? []), result
    ])
  }

  const orderedAssessments = [...assessments]
    .filter(assessment => {
      const lesson = lessonById.get(assessment.lessonId)
      return Boolean(
        lesson &&
        lesson.academicYearId === currentLesson.academicYearId &&
        lesson.teachingAssignmentId === currentLesson.teachingAssignmentId &&
        lesson.status !== 'cancelled' &&
        (lesson.date < currentLesson.date ||
          (lesson.date === currentLesson.date && lesson.startTime < currentLesson.startTime)) &&
        assessment.activityType === 'other' &&
        assessment.title.includes(' · Registo diário · ')
      )
    })
    .sort((a, b) => {
      const first = lessonById.get(a.lessonId)!
      const second = lessonById.get(b.lessonId)!
      return second.date.localeCompare(first.date) ||
        second.startTime.localeCompare(first.startTime) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        b.id.localeCompare(a.id)
    })

  const selected: Record<EntityId, Record<EntityId, Score>> = {}
  for (const assessment of orderedAssessments) {
    const sourceCriterion = sourceCriterionById.get(assessment.criterionId)
    const scheme = sourceCriterion ? schemeById.get(sourceCriterion.schemeId) : null
    if (!sourceCriterion || !scheme) continue

    const profile = scheme.profile === 'acs' ? 'acs' : 'general'
    const key = criterionKey(sourceCriterion.name, profile)
    const eligibleTargets = targetKeyToIds.get(key) ?? []
    // Never guess between two criteria with the same name/profile.
    if (eligibleTargets.length !== 1) continue
    const targetId = eligibleTargets[0]

    for (const result of resultsByAssessment.get(assessment.id) ?? []) {
      if (result.status !== 'evaluated' ||
          typeof result.score !== 'number' ||
          !Number.isFinite(result.score) ||
          result.score < 0 || result.score > 20) continue

      const student = studentById.get(result.studentId)
      if (!student) continue
      if (applicableCriterionIdsByStudent?.[student.id] &&
          !applicableCriterionIdsByStudent[student.id].includes(targetId)) continue

      // Switching an active UFCD to ACS clears its prior assessments.
      // Such cleared marks must never return as suggestions.
      const resetAt = student.assessmentResetAtByModule?.[currentLesson.moduleId]
      if (resetAt && result.updatedAt <= resetAt) continue

      const scores = selected[student.id] ?? {}
      if (!Object.prototype.hasOwnProperty.call(scores, targetId)) {
        scores[targetId] = result.score
        selected[student.id] = scores
      }
    }
  }

  return selected
}

export async function loadDailyPreviousScores(
  lesson: Lesson,
  students: Student[],
  targetCriteria: AssessmentCriterion[],
  targetAcsCriterionIds: EntityId[],
  applicableCriterionIdsByStudent?: Record<EntityId, EntityId[]>
): Promise<Record<EntityId, Record<EntityId, Score>>> {
  if (!students.length || !targetCriteria.length) return {}

  const earlierLessons = (await maProfessorDb.lessons
    .where('teachingAssignmentId').equals(lesson.teachingAssignmentId)
    .toArray())
    .filter(previous =>
      previous.academicYearId === lesson.academicYearId &&
      previous.id !== lesson.id &&
      previous.status !== 'cancelled' &&
      (previous.date < lesson.date ||
        (previous.date === lesson.date && previous.startTime < lesson.startTime))
    )

  if (!earlierLessons.length) return {}

  const assessments = (await maProfessorDb.lessonAssessments
    .where('lessonId').anyOf(earlierLessons.map(item => item.id)).toArray())
    .filter(item =>
      item.activityType === 'other' &&
      item.title.includes(' · Registo diário · ') &&
      item.teachingAssignmentId === lesson.teachingAssignmentId &&
      item.academicYearId === lesson.academicYearId
    )

  if (!assessments.length) return {}

  const sourceCriteria = (await maProfessorDb.assessmentCriteria
    .bulkGet([...new Set(assessments.map(item => item.criterionId))]))
    .filter((criterion): criterion is AssessmentCriterion => Boolean(criterion))
  if (!sourceCriteria.length) return {}

  const [sourceSchemes, results] = await Promise.all([
    maProfessorDb.assessmentSchemes.bulkGet(
      [...new Set(sourceCriteria.map(criterion => criterion.schemeId))]
    ),
    maProfessorDb.assessmentResults
      .where('assessmentId').anyOf(assessments.map(item => item.id)).toArray()
  ])

  return chooseDailyPreviousScores({
    currentLesson: lesson,
    students,
    targetCriteria,
    targetAcsCriterionIds,
    applicableCriterionIdsByStudent,
    earlierLessons,
    assessments,
    results,
    sourceCriteria,
    sourceSchemes: sourceSchemes.filter((scheme): scheme is AssessmentScheme => Boolean(scheme))
  })
}
