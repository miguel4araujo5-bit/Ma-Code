import type {
  GIAEStatus,
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
  lessonDate: ISODate,
  status: LessonStatus,
  referenceDate: ISODate =
    todayISO()
): LessonStatus {
  if (
    status === 'taught' &&
    isFutureLessonDate(
      lessonDate,
      referenceDate
    )
  ) {
    return 'planned'
  }

  return status
}

export function resolveLessonStatusFromEvidence(
  lessonDate: ISODate,
  requestedStatus: LessonStatus,
  summary: string,
  giaeStatus: GIAEStatus,
  referenceDate: ISODate =
    todayISO()
): LessonStatus {
  if (
    requestedStatus ===
    'cancelled'
  ) {
    return 'cancelled'
  }

  if (!summary.trim()) {
    return 'planned'
  }

  if (
    !isFutureLessonDate(
      lessonDate,
      referenceDate
    )
  ) {
    return 'taught'
  }

  return giaeStatus ===
    'submitted'
    ? 'taught'
    : 'planned'
}

export function assertLessonNotTaughtInFuture(
  _lessonDate: ISODate,
  _status: LessonStatus,
  _referenceDate: ISODate =
    todayISO()
) {
  return
}
