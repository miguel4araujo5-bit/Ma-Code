import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  Lesson,
  ModuleUnit
} from '../types'

import {
  setUfcdCompletionDate
} from './ufcdCfpModel'

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
      !lesson.countTowardProgress ||
      !Number.isFinite(lesson.periodCount) ||
      lesson.periodCount <= 0
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

  setUfcdCompletionDate(
    module.id,
    completionDate
  )

  return completionDate
}
