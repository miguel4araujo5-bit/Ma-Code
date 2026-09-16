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
  referenceToday: ISODate = todayISO()
) {
  if (
    lesson.status !== 'taught' ||
    !lesson.countTowardProgress
  ) {
    return false
  }

  if (lesson.date <= referenceToday) {
    return true
  }

  return lesson.giaeStatus === 'submitted'
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
  progress: UfcdModuleProgress[]
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

  const startedIncomplete =
    orderedModules.find(module => {
      const row =
        progressByModuleId.get(
          module.id
        )

      return Boolean(
        row &&
        row.periodsTaught > 0 &&
        row.periodsRemaining > 0
      )
    })

  if (startedIncomplete) {
    return startedIncomplete
  }

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
