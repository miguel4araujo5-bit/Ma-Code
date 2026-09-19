import type {
  LessonStatus
} from '../types'

export function assertCalendarLessonRelatedDataCompatibility(
  status: LessonStatus,
  attendanceCount: number,
  assessmentCount: number,
  hasSummary: boolean
) {
  if (
    status !== 'cancelled' &&
    (
      attendanceCount === 0 ||
      hasSummary
    )
  ) {
    return
  }

  if (
    attendanceCount > 0
  ) {
    throw new Error(
      status === 'cancelled'
        ? 'Esta aula já possui faltas. Remova esses registos antes de cancelar a aula.'
        : 'Esta aula já possui faltas. Mantenha um sumário guardado para preservar esses registos.'
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
