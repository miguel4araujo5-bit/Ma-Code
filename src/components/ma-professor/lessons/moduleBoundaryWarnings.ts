import type {
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit
} from '../types'

export interface ModuleBoundaryWarning {
  lessonId: EntityId
  moduleId: EntityId
  teachingAssignmentId: EntityId
  scheduleSlotId: EntityId | null
  date: ISODate
  startTime: string
  plannedPeriods: number
  allocatedPeriodsBefore: number
  lessonPeriodCount: number
  overflowPeriods: number
}

interface DetectModuleBoundaryWarningsInput {
  modules: ModuleUnit[]
  lessons: Lesson[]
}

function compareLessons(
  left: Lesson,
  right: Lesson
) {
  return (
    left.date.localeCompare(
      right.date
    ) ||
    left.startTime.localeCompare(
      right.startTime
    ) ||
    left.createdAt.localeCompare(
      right.createdAt
    ) ||
    left.id.localeCompare(
      right.id
    )
  )
}

export function detectModuleBoundaryWarnings(
  input: DetectModuleBoundaryWarningsInput
): ModuleBoundaryWarning[] {
  const activeModuleById =
    new Map(
      input.modules
        .filter(module => module.active)
        .map(module => [
          module.id,
          module
        ])
    )

  const allocatedPeriodsByModule =
    new Map<EntityId, number>()
  const warnings:
    ModuleBoundaryWarning[] = []

  const progressLessons =
    [...input.lessons]
      .filter(
        lesson =>
          lesson.status !== 'cancelled' &&
          lesson.countTowardProgress &&
          activeModuleById.has(
            lesson.moduleId
          )
      )
      .sort(compareLessons)

  for (const lesson of progressLessons) {
    const module =
      activeModuleById.get(
        lesson.moduleId
      )

    if (!module) {
      continue
    }

    const allocatedBefore =
      allocatedPeriodsByModule.get(
        lesson.moduleId
      ) ?? 0

    const allocatedAfter =
      allocatedBefore +
      lesson.periodCount

    if (
      allocatedBefore <
        module.plannedPeriods &&
      allocatedAfter >
        module.plannedPeriods
    ) {
      warnings.push({
        lessonId: lesson.id,
        moduleId: lesson.moduleId,
        teachingAssignmentId:
          lesson.teachingAssignmentId,
        scheduleSlotId:
          lesson.scheduleSlotId,
        date: lesson.date,
        startTime: lesson.startTime,
        plannedPeriods:
          module.plannedPeriods,
        allocatedPeriodsBefore:
          allocatedBefore,
        lessonPeriodCount:
          lesson.periodCount,
        overflowPeriods:
          allocatedAfter -
          module.plannedPeriods
      })
    }

    allocatedPeriodsByModule.set(
      lesson.moduleId,
      allocatedAfter
    )
  }

  return warnings
}
