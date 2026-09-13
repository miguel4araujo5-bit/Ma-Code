import {
  lessonRepository
} from '../lessons/lessonRepository'
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

function formatLocalISODate(
  date: Date
): ISODate {
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

function todayISO(): ISODate {
  return formatLocalISODate(
    new Date()
  )
}

function previousDate(
  value: ISODate
): ISODate {
  const [
    year,
    month,
    day
  ] = value.split('-').map(Number)

  const date =
    new Date(
      year,
      month - 1,
      day
    )

  date.setDate(
    date.getDate() - 1
  )

  return formatLocalISODate(
    date
  )
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
  override async getLessonEditorContext(
    lessonId: EntityId
  ) {
    const context =
      await super.getLessonEditorContext(
        lessonId
      )

    const nextPlanificationItem =
      await lessonRepository.getNextPlanificationItem(
        context.lessonRow.lesson.moduleId,
        lessonId
      )

    return {
      ...context,
      nextPlanificationItem
    }
  }

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
        initialSnapshot.academicYear.startDate
      )

    const dateTo =
      minDate(
        initialSnapshot.displayEndDate,
        initialSnapshot.academicYear.endDate
      )

    if (dateFrom > dateTo) {
      return initialSnapshot
    }

    const today =
      todayISO()

    let changed =
      false

    if (dateFrom < today) {
      const historicalDateTo =
        minDate(
          dateTo,
          previousDate(today)
        )

      if (
        dateFrom <=
        historicalDateTo
      ) {
        const historicalReconciliation =
          await scheduledLessonReconciliationRepository.reconcile({
            academicYearId,
            dateFrom,
            dateTo:
              historicalDateTo,
            preserveExistingLessons:
              true
          })

        changed =
          changed ||
          historicalReconciliation.createdLessonIds.length > 0 ||
          historicalReconciliation.deletedLessonIds.length > 0
      }
    }

    const currentDateFrom =
      maxDate(
        dateFrom,
        today
      )

    if (
      currentDateFrom <=
      dateTo
    ) {
      const reconciliation =
        await scheduledLessonReconciliationRepository.reconcile({
          academicYearId,
          dateFrom:
            currentDateFrom,
          dateTo
        })

      changed =
        changed ||
        reconciliation.createdLessonIds.length > 0 ||
        reconciliation.deletedLessonIds.length > 0
    }

    if (!changed) {
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
