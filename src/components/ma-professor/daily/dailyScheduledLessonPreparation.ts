import {
  ensureInitialSchoolCalendar2026_2027
} from '../calendar/initialSchoolCalendar2026_2027'
import {
  lessonRepository
} from '../lessons/lessonRepository'
import {
  maProfessorRepository
} from '../repository'
import {
  isSBentoSchoolName
} from '../setup/schoolDutyDatePolicy'
import type {
  EntityId,
  ISODate
} from '../types'

const preparedSBentoYears =
  new Set<EntityId>()

export async function ensureDailyScheduledLessonsForDate(
  academicYearId: EntityId,
  date: ISODate
) {
  const [
    academicYear,
    profile
  ] = await Promise.all([
    maProfessorRepository.getAcademicYear(
      academicYearId
    ),
    maProfessorRepository.getTeacherProfile()
  ])

  if (!academicYear) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  if (
    date < academicYear.startDate ||
    date > academicYear.endDate
  ) {
    return
  }

  if (
    isSBentoSchoolName(
      profile?.schoolName ?? ''
    ) &&
    !preparedSBentoYears.has(
      academicYearId
    )
  ) {
    const preparation =
      await ensureInitialSchoolCalendar2026_2027(
        academicYearId
      )

    if (preparation.applied) {
      preparedSBentoYears.add(
        academicYearId
      )
      return
    }
  }

  await lessonRepository.generateScheduledLessons({
    academicYearId,
    dateFrom:
      date,
    dateTo:
      date,
    createCancelledForBlockedDates:
      false
  })
}
