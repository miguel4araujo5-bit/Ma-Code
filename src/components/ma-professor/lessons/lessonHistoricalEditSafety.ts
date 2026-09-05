import type {
  ISODate
} from '../types'

export function assertLessonHistoricalDateChangeAllowed(
  previousDate: ISODate,
  nextDate: ISODate,
  attendanceCount: number,
  assessmentCount: number
) {
  if (
    previousDate === nextDate ||
    (
      attendanceCount === 0 &&
      assessmentCount === 0
    )
  ) {
    return
  }

  throw new Error(
    'Esta aula já possui faltas ou avaliações. Para preservar o histórico, não é possível alterar a data através da edição normal da aula.'
  )
}
