import type {
  EntityId,
  ISODate,
  Lesson,
  ModuleUnit
} from '../types'
import type {
  ScheduledLessonCreationPlan
} from './scheduledLessonReconciliation'

export interface ModuleBoundaryWarning {
  source: 'existing' | 'planned'
  lessonId: EntityId | null
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
  existingLessons: Lesson[]
  plannedLessons: ScheduledLessonCreationPlan[]
}

type ProgressCandidate = {
  source: 'existing' | 'planned'
  lessonId: EntityId | null
  moduleId: EntityId
  teachingAssignmentId: EntityId
  scheduleSlotId: EntityId | null
  date: ISODate
  startTime: string
  periodCount: number
  countTowardProgress: boolean
  stableOrder: number
}

function compareCandidates(
  left: ProgressCandidate,
  right: ProgressCandidate
) {
  return (
    left.date.localeCompare(
      right.date
    ) ||
    left.startTime.localeCompare(
      right.startTime
    ) ||
    left.stableOrder -
      right.stableOrder
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

  const candidates:
    ProgressCandidate[] = []

  input.existingLessons.forEach(
    (lesson, index) => {
      if (
        lesson.status === 'cancelled' ||
        !lesson.countTowardProgress ||
        !activeModuleById.has(
          lesson.moduleId
        )
      ) {
        return
      }

      candidates.push({
        source: 'existing',
        lessonId: lesson.id,
        moduleId: lesson.moduleId,
        teachingAssignmentId:
          lesson.teachingAssignmentId,
        scheduleSlotId:
          lesson.scheduleSlotId,
        date: lesson.date,
        startTime: lesson.startTime,
        periodCount: lesson.periodCount,
        countTowardProgress: true,
        stableOrder: index
      })
    }
  )

  const plannedOffset =
    candidates.length

  input.plannedLessons.forEach(
    (lesson, index) => {
      if (
        !lesson.countTowardProgress ||
        !activeModuleById.has(
          lesson.moduleId
        )
      ) {
        return
      }

      candidates.push({
        source: 'planned',
        lessonId: null,
        moduleId: lesson.moduleId,
        teachingAssignmentId:
          lesson.teachingAssignmentId,
        scheduleSlotId:
          lesson.scheduleSlotId,
        date: lesson.date,
        startTime: lesson.startTime,
        periodCount: lesson.periodCount,
        countTowardProgress: true,
        stableOrder:
          plannedOffset + index
      })
    }
  )

  candidates.sort(
    compareCandidates
  )

  const allocatedPeriodsByModule =
    new Map<EntityId, number>()
  const warnings:
    ModuleBoundaryWarning[] = []

  for (const candidate of candidates) {
    const module =
      activeModuleById.get(
        candidate.moduleId
      )

    if (!module) {
      continue
    }

    const allocatedBefore =
      allocatedPeriodsByModule.get(
        candidate.moduleId
      ) ?? 0

    const allocatedAfter =
      allocatedBefore +
      candidate.periodCount

    if (
      allocatedBefore <
        module.plannedPeriods &&
      allocatedAfter >
        module.plannedPeriods
    ) {
      warnings.push({
        source: candidate.source,
        lessonId:
          candidate.lessonId,
        moduleId:
          candidate.moduleId,
        teachingAssignmentId:
          candidate.teachingAssignmentId,
        scheduleSlotId:
          candidate.scheduleSlotId,
        date: candidate.date,
        startTime:
          candidate.startTime,
        plannedPeriods:
          module.plannedPeriods,
        allocatedPeriodsBefore:
          allocatedBefore,
        lessonPeriodCount:
          candidate.periodCount,
        overflowPeriods:
          allocatedAfter -
          module.plannedPeriods
      })
    }

    if (
      candidate.countTowardProgress
    ) {
      allocatedPeriodsByModule.set(
        candidate.moduleId,
        allocatedAfter
      )
    }
  }

  return warnings
}
