let dashboardDataRevision = 0

export function markDashboardDataDirty() {
  dashboardDataRevision += 1

  return dashboardDataRevision
}

export function getDashboardDataRevision() {
  return dashboardDataRevision
}
