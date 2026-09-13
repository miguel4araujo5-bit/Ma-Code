import type {
  LessonStatus
} from '../types'

export function assertCalendarLessonRelatedDataCompatibility(
  status: LessonStatus,
  attendanceCount: number,
  assessmentCount: number
) {
  if (status === 'taught') {
    return
  }

  if (
    status === 'planned' &&
    attendanceCount === 0
  ) {
    return
  }

  if (
    attendanceCount > 0
  ) {
    throw new Error(
      'Esta aula já possui faltas. Mantenha-a marcada como dada para preservar esses registos.'
    )
  }

  if (
    status === 'cancelled' &&
    assessmentCount > 0
  ) {
    throw new Error(
      'Esta aula já possui avaliações. Elimine primeiro as avaliações associadas antes de a cancelar.'
    )
  }
}
