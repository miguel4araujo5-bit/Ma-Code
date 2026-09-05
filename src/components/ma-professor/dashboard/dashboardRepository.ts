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

    return dashboardFutureAgendaRepository.project(
      snapshot
    )
  }
}

export const dashboardRepository =
  new DashboardRepository()
