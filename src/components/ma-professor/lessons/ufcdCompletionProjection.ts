import type {
  EntityId,
  ISODate,
  ModuleUnit
} from '../types'
import type {
  UfcdModuleProgress
} from './ufcdProgress'

export interface UfcdProjectedLesson {
  date: ISODate
  startTime: string
  periodCount: number
}

export interface UfcdCompletionProjectionRow {
  moduleId: EntityId
  estimatedCompletionDate: ISODate | null
}

export interface UfcdCompletionProjection {
  modules: UfcdCompletionProjectionRow[]
  disciplineCompletionDate: ISODate | null
}

export interface ProjectSequentialUfcdCompletionDatesInput {
  modules: ModuleUnit[]
  progress: UfcdModuleProgress[]
  actualCompletionDateByModuleId:
    ReadonlyMap<EntityId, ISODate | null>
  futureLessons: UfcdProjectedLesson[]
}

export function projectSequentialUfcdCompletionDates(
  input:
    ProjectSequentialUfcdCompletionDatesInput
): UfcdCompletionProjection {
  const orderedModules =
    [...input.modules].sort(
      (left, right) =>
        left.order -
          right.order ||
        left.name.localeCompare(
          right.name,
          'pt-PT',
          {
            sensitivity:
              'base'
          }
        )
    )

  const progressByModuleId =
    new Map(
      input.progress.map(
        row => [
          row.moduleId,
          row
        ]
      )
    )

  const remainingByModuleId =
    new Map<EntityId, number>(
      orderedModules.map(
        module => [
          module.id,
          Math.max(
            0,
            progressByModuleId.get(
              module.id
            )?.periodsRemaining ??
              module.plannedPeriods
          )
        ]
      )
    )

  const completionDateByModuleId =
    new Map<
      EntityId,
      ISODate | null
    >(
      orderedModules.map(
        module => {
          const remaining =
            remainingByModuleId.get(
              module.id
            ) ?? 0

          return [
            module.id,
            remaining <= 0
              ? input
                  .actualCompletionDateByModuleId
                  .get(
                    module.id
                  ) ??
                null
              : null
          ]
        }
      )
    )

  const futureLessons =
    [...input.futureLessons]
      .filter(
        lesson =>
          Number.isFinite(
            lesson.periodCount
          ) &&
          lesson.periodCount >
            0
      )
      .sort(
        (left, right) =>
          left.date.localeCompare(
            right.date
          ) ||
          left.startTime.localeCompare(
            right.startTime
          )
      )

  let moduleIndex =
    0

  for (
    const lesson of
      futureLessons
  ) {
    while (
      moduleIndex <
      orderedModules.length
    ) {
      const module =
        orderedModules[
          moduleIndex
        ]

      if (
        (
          remainingByModuleId.get(
            module.id
          ) ?? 0
        ) >
        0
      ) {
        break
      }

      moduleIndex +=
        1
    }

    if (
      moduleIndex >=
      orderedModules.length
    ) {
      break
    }

    const module =
      orderedModules[
        moduleIndex
      ]

    const remaining =
      (
        remainingByModuleId.get(
          module.id
        ) ?? 0
      ) -
      lesson.periodCount

    remainingByModuleId.set(
      module.id,
      Math.max(
        0,
        remaining
      )
    )

    if (
      remaining <=
      0
    ) {
      completionDateByModuleId.set(
        module.id,
        lesson.date
      )

      moduleIndex +=
        1
    }
  }

  const modules =
    orderedModules.map(
      module => ({
        moduleId:
          module.id,
        estimatedCompletionDate:
          completionDateByModuleId.get(
            module.id
          ) ??
          null
      })
    )

  return {
    modules,
    disciplineCompletionDate:
      modules.at(-1)
        ?.estimatedCompletionDate ??
      null
  }
}
