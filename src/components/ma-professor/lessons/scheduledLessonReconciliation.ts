import type {
  EntityId,
  ISODate,
  Lesson
} from '../types'

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function formatISODate(
  value: Date
): ISODate {
  return [
    String(
      value.getUTCFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      value.getUTCMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      value.getUTCDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function getStartOfWeek(
  value: ISODate
): ISODate {
  const date =
    parseISODate(
      value
    )

  const weekday =
    date.getUTCDay()

  const isoWeekday =
    weekday === 0
      ? 7
      : weekday

  date.setUTCDate(
    date.getUTCDate() -
      (isoWeekday - 1)
  )

  return formatISODate(
    date
  )
}

export function getScheduleOccurrenceKey(
  scheduleSlotId: EntityId,
  date: ISODate
) {
  return `${scheduleSlotId}|${getStartOfWeek(
    date
  )}`
}

export function isPristineScheduledLesson(
  lesson: Lesson,
  hasRelatedData: boolean
) {
  return (
    lesson.origin ===
      'scheduled' &&
    lesson.status ===
      'planned' &&
    Boolean(
      lesson.scheduleSlotId
    ) &&
    lesson.createdAt ===
      lesson.updatedAt &&
    !lesson.plannedActivity.trim() &&
    !lesson.summary.trim() &&
    lesson.planificationItemIds.length ===
      0 &&
    lesson.giaeStatus ===
      'pending' &&
    lesson.giaeSubmittedAt ===
      null &&
    !lesson.notes.trim() &&
    !hasRelatedData
  )
}
