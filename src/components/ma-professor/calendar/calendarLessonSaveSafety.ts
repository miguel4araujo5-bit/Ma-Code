import type {
  LessonStatus
} from '../types'

export function assertCalendarLessonRelatedDataCompatibility(
  status: LessonStatus,
  attendanceCount: number,
  assessmentCount: number
) {
  if (
    status === 'taught' ||
    (
      attendanceCount === 0 &&
      assessmentCount === 0
    )
  ) {
    return
  }

  throw new Error(
    'Esta aula já possui faltas ou avaliações. Mantenha-a marcada como dada para preservar esses registos.'
  )
}
