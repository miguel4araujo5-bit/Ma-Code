import {
  scheduledLessonReconciliationRepository
} from '../lessons/scheduledLessonReconciliationRepository'
import type {
  EntityId,
  ISODate
} from '../types'
import {
  CalendarWorkspaceRepository as BaseCalendarWorkspaceRepository
} from './calendarWorkspaceRepositoryBase'
import type {
  CalendarViewMode,
  CalendarWorkspaceFilters,
  CalendarWorkspaceSnapshot
} from './calendarWorkspaceRepositoryBase'

export * from './calendarWorkspaceRepositoryBase'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(
      date.getFullYear()
    ).padStart(4, '0'),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0')
  ].join('-')
}

function maxDate(
  ...values: ISODate[]
) {
  return values.reduce(
    (maximum, value) =>
      value > maximum
        ? value
        : maximum
  )
}

function minDate(
  ...values: ISODate[]
) {
  return values.reduce(
    (minimum, value) =>
      value < minimum
        ? value
        : minimum
  )
}

export class CalendarWorkspaceRepository
  extends BaseCalendarWorkspaceRepository {
  async getWorkspace(
    academicYearId: EntityId,
    mode: CalendarViewMode = 'week',
    requestedAnchorDate?: ISODate,
    filters: CalendarWorkspaceFilters = {}
  ): Promise<CalendarWorkspaceSnapshot> {
    const initialSnapshot =
      await super.getWorkspace(
        academicYearId,
        mode,
        requestedAnchorDate,
        filters
      )

    const dateFrom =
      maxDate(
        initialSnapshot.displayStartDate,
        initialSnapshot.academicYear.startDate,
        todayISO()
      )

    const dateTo =
      minDate(
        initialSnapshot.displayEndDate,
        initialSnapshot.academicYear.endDate
      )

    if (dateFrom > dateTo) {
      return initialSnapshot
    }

    const reconciliation =
      await scheduledLessonReconciliationRepository.reconcile({
        academicYearId,
        dateFrom,
        dateTo
      })

    if (
      reconciliation.deletedLessonIds.length === 0 &&
      reconciliation.createdLessonIds.length === 0
    ) {
      return initialSnapshot
    }

    return super.getWorkspace(
      academicYearId,
      mode,
      requestedAnchorDate,
      filters
    )
  }
}

export const calendarWorkspaceRepository =
  new CalendarWorkspaceRepository()
