import type {
  PlanificationItemDraft
} from '../repository'
import type {
  EntityId,
  PlanificationItemStatus
} from '../types'
import {
  markDashboardDataDirty
} from '../dashboard/dashboardRefreshSignal'
import {
  PlanificationWorkspaceRepository as BasePlanificationWorkspaceRepository
} from './planificationWorkspaceRepositoryBase'
import type {
  CreatePlanificationWorkspaceInput,
  UpdatePlanificationItemInput,
  UpdatePlanificationWorkspaceInput
} from './planificationWorkspaceRepositoryBase'

export * from './planificationWorkspaceRepositoryBase'

function markChanged() {
  markDashboardDataDirty()
}

export class PlanificationWorkspaceRepository
  extends BasePlanificationWorkspaceRepository {
  async createPlanification(
    input: CreatePlanificationWorkspaceInput
  ) {
    const result =
      await super.createPlanification(
        input
      )

    markChanged()
    return result
  }

  async updatePlanification(
    planificationId: EntityId,
    changes: UpdatePlanificationWorkspaceInput
  ) {
    const result =
      await super.updatePlanification(
        planificationId,
        changes
      )

    markChanged()
    return result
  }

  async addPlanificationItem(
    planificationId: EntityId,
    draft: PlanificationItemDraft
  ) {
    const result =
      await super.addPlanificationItem(
        planificationId,
        draft
      )

    markChanged()
    return result
  }

  async updatePlanificationItem(
    itemId: EntityId,
    changes: UpdatePlanificationItemInput
  ) {
    const result =
      await super.updatePlanificationItem(
        itemId,
        changes
      )

    markChanged()
    return result
  }

  async setPlanificationItemStatus(
    itemId: EntityId,
    status: Extract<
      PlanificationItemStatus,
      'planned' | 'skipped'
    >
  ) {
    const result =
      await super.setPlanificationItemStatus(
        itemId,
        status
      )

    markChanged()
    return result
  }

  async deletePlanificationItem(
    itemId: EntityId
  ) {
    const result =
      await super.deletePlanificationItem(
        itemId
      )

    markChanged()
    return result
  }

  async reorderPlanificationItems(
    planificationId: EntityId,
    orderedIds: EntityId[]
  ) {
    const result =
      await super.reorderPlanificationItems(
        planificationId,
        orderedIds
      )

    markChanged()
    return result
  }

  async importPlanificationLines(
    planificationId: EntityId,
    text: string
  ) {
    const result =
      await super.importPlanificationLines(
        planificationId,
        text
      )

    markChanged()
    return result
  }
}

export const planificationWorkspaceRepository =
  new PlanificationWorkspaceRepository()
