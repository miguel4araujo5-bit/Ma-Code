import type {
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit
} from '../types'

export interface UfcdModuleProgress {
  moduleId: EntityId
  periodsTaught: number
  periodsRemaining: number
  completionPercent: number
}

export function todayISO(): ISODate {
  const date = new Date()

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-')
}

export function lessonCountsTowardUfcdProgress(
  lesson: Lesson,
  _referenceToday: ISODate = todayISO()
) {
  if (
    lesson.giaeStatus !== 'submitted' ||
    lesson.status === 'cancelled' ||
    !lesson.countTowardProgress
  ) {
    return false
  }

  return true
}

export function compareLessonsChronologically(
  left: Lesson,
  right: Lesson
) {
  return (
    left.date.localeCompare(right.date) ||
    left.startTime.localeCompare(right.startTime) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  )
}

export function lessonOccursBefore(
  candidate: Lesson,
  lesson: Lesson
) {
  return compareLessonsChronologically(
    candidate,
    lesson
  ) < 0
}

export function calculateCompletionPercent(
  periodsTaught: number,
  plannedPeriods: number
) {
  if (plannedPeriods <= 0) {
    return 0
  }

  return Math.round(
    Math.min(
      100,
      Math.max(
        0,
        (periodsTaught / plannedPeriods) * 100
      )
    ) * 100
  ) / 100
}

export function buildUfcdModuleProgress(
  modules: ModuleUnit[],
  lessons: Lesson[],
  referenceToday: ISODate = todayISO()
) {
  const periodsTaughtByModuleId =
    new Map<EntityId, number>()

  lessons
    .filter(lesson =>
      lessonCountsTowardUfcdProgress(
        lesson,
        referenceToday
      )
    )
    .forEach(lesson => {
      periodsTaughtByModuleId.set(
        lesson.moduleId,
        (
          periodsTaughtByModuleId.get(
            lesson.moduleId
          ) ?? 0
        ) + lesson.periodCount
      )
    })

  return modules.map(
    (module): UfcdModuleProgress => {
      const periodsTaught =
        periodsTaughtByModuleId.get(
          module.id
        ) ?? 0

      return {
        moduleId: module.id,
        periodsTaught,
        periodsRemaining: Math.max(
          0,
          module.plannedPeriods -
            periodsTaught
        ),
        completionPercent:
          calculateCompletionPercent(
            periodsTaught,
            module.plannedPeriods
          )
      }
    }
  )
}

export function selectCurrentUfcd(
  modules: ModuleUnit[],
  progress: Pick<UfcdModuleProgress, 'moduleId' | 'periodsRemaining'>[]
) {
  const progressByModuleId =
    new Map(
      progress.map(row => [
        row.moduleId,
        row
      ])
    )

  const orderedModules =
    [...modules].sort(
      (left, right) =>
        left.order - right.order ||
        left.name.localeCompare(
          right.name,
          'pt-PT',
          {
            sensitivity: 'base'
          }
        )
    )

  return (
    orderedModules.find(
      module =>
        (
          progressByModuleId.get(
            module.id
          )?.periodsRemaining ?? 0
        ) > 0
    ) ?? null
  )
}

export function lessonReservesUfcdPeriods(lesson: Lesson) {
  return lesson.status !== 'cancelled' && lesson.countTowardProgress &&
    Number.isFinite(lesson.periodCount) && lesson.periodCount > 0
}

// A sequência planeada inclui aulas pendentes. Não altera o progresso
// efetivo, que continua a depender exclusivamente do visto GIAE.
export function buildUfcdModuleAllocation(modules: ModuleUnit[], lessons: Lesson[]) {
  const allocated = new Map<EntityId, number>()
  for (const lesson of lessons.filter(lessonReservesUfcdPeriods)) {
    allocated.set(lesson.moduleId, (allocated.get(lesson.moduleId) ?? 0) + lesson.periodCount)
  }
  return modules.map(module => ({
    moduleId: module.id,
    periodsRemaining: Math.max(0, module.plannedPeriods - (allocated.get(module.id) ?? 0))
  }))
}

export function getLessonNumbering(lesson: Lesson, lessons: Lesson[]) {
  const previous = lessons.filter(candidate => candidate.teachingAssignmentId === lesson.teachingAssignmentId && candidate.academicYearId === lesson.academicYearId && lessonOccursBefore(candidate, lesson))
  const first = previous.filter(lessonReservesUfcdPeriods).reduce((sum, candidate) => sum + candidate.periodCount, 0) + 1
  return {
    lessonNumber: lessonReservesUfcdPeriods(lesson) ? (lesson.periodCount > 1 ? `${first}–${first + lesson.periodCount - 1}` : String(first)) : null,
    lessonNumberConfirmed: lessonReservesUfcdPeriods(lesson) && lessonCountsTowardUfcdProgress(lesson),
    hasUnsubmittedLessons: previous.some(candidate => lessonReservesUfcdPeriods(candidate) && candidate.giaeStatus !== 'submitted')
  }
}
