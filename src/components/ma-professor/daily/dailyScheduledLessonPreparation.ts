import {
  ensureInitialSchoolCalendar2026_2027
} from '../calendar/initialSchoolCalendar2026_2027'
import {
  moduleBoundaryWarningRepository
} from '../lessons/moduleBoundaryWarningRepository'
import type {
  ModuleBoundaryWarning
} from '../lessons/moduleBoundaryWarnings'
import {
  scheduledLessonReconciliationRepository
} from '../lessons/scheduledLessonReconciliationRepository'
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

export interface DailyScheduledLessonPreparationResult {
  moduleBoundaryWarnings:
    ModuleBoundaryWarning[]
}

async function readModuleBoundaryWarnings(
  academicYearId: EntityId
): Promise<DailyScheduledLessonPreparationResult> {
  return {
    moduleBoundaryWarnings:
      await moduleBoundaryWarningRepository.listWarnings(
        academicYearId
      )
  }
}

export async function ensureDailyScheduledLessonsForDate(
  academicYearId: EntityId,
  date: ISODate
): Promise<DailyScheduledLessonPreparationResult> {
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
    return {
      moduleBoundaryWarnings: []
    }
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

      return readModuleBoundaryWarnings(
        academicYearId
      )
    }
  }

  await scheduledLessonReconciliationRepository.reconcile({
    academicYearId,
    dateFrom: date,
    dateTo: date
  })

  return readModuleBoundaryWarnings(
    academicYearId
  )
}
