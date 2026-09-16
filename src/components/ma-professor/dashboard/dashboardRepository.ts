import {
  lessonRepository
} from '../lessons/lessonRepository'
import {
  ufcdProgressRepository
} from '../lessons/ufcdProgressRepository'
import type {
  EntityId,
  ISODate
} from '../types'
import {
  dashboardFutureAgendaRepository
} from './dashboardFutureAgendaRepository'
import {
  DashboardRepository as BaseDashboardRepository
} from './dashboardRepositoryBase'

export * from './dashboardRepositoryBase'

export class DashboardRepository
  extends BaseDashboardRepository {
  async getDashboard(
    academicYearId: EntityId,
    requestedReferenceDate?: ISODate
  ) {
    const snapshot =
      await super.getDashboard(
        academicYearId,
        requestedReferenceDate
      )

    const projectedSnapshot =
      await dashboardFutureAgendaRepository.project(
        snapshot
      )

    const progressSnapshot =
      await ufcdProgressRepository
        .applyActualProgressToDashboard(
          projectedSnapshot
        )

    const assignments =
      await Promise.all(
        progressSnapshot.assignments.map(
          async row => ({
            ...row,
            nextPlanificationItem:
              row.currentModule
                ? await lessonRepository.getNextPlanificationItem(
                    row.currentModule.id
                  )
                : null
          })
        )
      )

    return {
      ...progressSnapshot,
      assignments
    }
  }
}

export const dashboardRepository =
  new DashboardRepository()
