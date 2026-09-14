import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  Lesson,
  ModuleUnit
} from '../types'

const completionDateCache =
  new Map<string, string | null>()

export function completionDateFromLessons(
  plannedPeriods: number,
  lessons: Lesson[]
) {
  if (
    !Number.isInteger(plannedPeriods) ||
    plannedPeriods <= 0
  ) {
    return null
  }

  let completedPeriods = 0

  const orderedLessons = [
    ...lessons
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.startTime.localeCompare(
        right.startTime
      ) ||
      left.id.localeCompare(right.id)
  )

  for (const lesson of orderedLessons) {
    if (
      lesson.status !== 'taught' ||
      !lesson.countTowardProgress
    ) {
      continue
    }

    completedPeriods +=
      lesson.periodCount

    if (
      completedPeriods >= plannedPeriods
    ) {
      return lesson.date
    }
  }

  return null
}

export function getCachedModuleCompletionDate(
  moduleId: string
) {
  return completionDateCache.get(
    moduleId
  ) ?? null
}

export async function resolveModuleCompletionDate(
  module: ModuleUnit | null
) {
  if (!module) {
    return null
  }

  await openMAProfessorDatabase()

  const lessons =
    await maProfessorDb.lessons
      .where('moduleId')
      .equals(module.id)
      .toArray()

  const completionDate =
    completionDateFromLessons(
      module.plannedPeriods,
      lessons
    )

  completionDateCache.set(
    module.id,
    completionDate
  )

  return completionDate
}
