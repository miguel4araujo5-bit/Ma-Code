import type {
  ModuleUnit
} from '../types'

export const REGULAR_ANNUAL_MODULE_KIND =
  'regular_annual' as const

export type RegularAnnualModule =
  ModuleUnit & {
    moduleKind?:
      typeof REGULAR_ANNUAL_MODULE_KIND
  }

export function isRegularAnnualModule(
  module: ModuleUnit
) {
  return (
    module as RegularAnnualModule
  ).moduleKind ===
    REGULAR_ANNUAL_MODULE_KIND
}

export function moduleUsesPlannedCapacity(
  module: ModuleUnit
) {
  return !isRegularAnnualModule(
    module
  )
}

export function isModuleWithinPlannedCapacity(
  module: ModuleUnit,
  allocatedPeriods: number
) {
  return (
    !moduleUsesPlannedCapacity(
      module
    ) ||
    allocatedPeriods <
      module.plannedPeriods
  )
}
