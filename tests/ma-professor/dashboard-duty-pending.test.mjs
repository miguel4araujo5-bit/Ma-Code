import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/DashboardDutyPendingPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const dashboardViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/DashboardView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'dashboard pending Cargo panel reuses the existing local calendar events',
  () => {
    assert.match(
      panelSource,
      /calendarRepository\.listEvents/
    )
    assert.match(
      panelSource,
      /type:\s*'school_activity'/
    )
    assert.match(
      panelSource,
      /getDutyEventDetails\(\s*event\s*\)/
    )
    assert.match(
      panelSource,
      /!details\s*\|\|\s*event\.description\.trim\(\)/
    )
    assert.doesNotMatch(
      panelSource,
      /snapshotApi|manualSyncService|DurableObject|wrangler|cloudflare|fetch\(/i
    )
  }
)

test(
  'dashboard only considers Cargo occurrences up to the dashboard reference date',
  () => {
    assert.match(
      panelSource,
      /dateFrom:\s*academicYearStartDate/
    )
    assert.match(
      panelSource,
      /dateTo:\s*referenceDate/
    )
    assert.match(
      panelSource,
      /Sumários por preencher/
    )
    assert.match(
      panelSource,
      /Abrir Diário/
    )
  }
)

test(
  'dashboard wrapper mounts the Cargo pending panel without replacing the existing dashboard',
  () => {
    assert.match(
      dashboardViewSource,
      /<DashboardDutyPendingPanel/
    )
    assert.match(
      dashboardViewSource,
      /academicYearId=\{[\s\S]*props\.snapshot\.academicYear\.id/
    )
    assert.match(
      dashboardViewSource,
      /academicYearStartDate=\{[\s\S]*props\.snapshot\.academicYear\.startDate/
    )
    assert.match(
      dashboardViewSource,
      /referenceDate=\{[\s\S]*props\.snapshot\.referenceDate/
    )
    assert.match(
      dashboardViewSource,
      /refreshToken=\{[\s\S]*dashboardRevision/
    )
    assert.match(
      dashboardViewSource,
      /<DashboardViewBase[\s\S]*\{\.\.\.props\}/
    )
  }
)
