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

export function assertLessonNotTaughtInFuture(
  lessonDate: ISODate,
  status: LessonStatus,
  referenceDate: ISODate =
    todayISO()
) {
  if (
    status === 'taught' &&
    isFutureLessonDate(
      lessonDate,
      referenceDate
    )
  ) {
    throw new Error(
      'Uma aula futura não pode ser marcada como dada. Pode preparar antecipadamente o sumário, a atividade e a planificação, mantendo a aula como planeada.'
    )
  }
}
