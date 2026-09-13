import type {
  ISODate,
  LessonStatus
} from '../types'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(
      date.getFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    ),
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

export function isFutureLessonDate(
  lessonDate: ISODate,
  referenceDate: ISODate =
    todayISO()
) {
  return lessonDate > referenceDate
}

export function resolveLessonStatusForDate(
  _lessonDate: ISODate,
  status: LessonStatus,
  _referenceDate: ISODate =
    todayISO()
): LessonStatus {
  return status
}

export function assertLessonNotTaughtInFuture(
  _lessonDate: ISODate,
  _status: LessonStatus,
  _referenceDate: ISODate =
    todayISO()
) {
  return
}
