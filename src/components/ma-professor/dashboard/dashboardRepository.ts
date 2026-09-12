import {
  lessonRepository
} from '../lessons/lessonRepository'
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

    const assignments =
      await Promise.all(
        projectedSnapshot.assignments.map(
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
      ...projectedSnapshot,
      assignments
    }
  }
}

export const dashboardRepository =
  new DashboardRepository()
