import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const recoveryWorkspaceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarRecoveryWorkspace.ts',
    import.meta.url
  ),
  'utf8'
)

const calendarRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const recoveryPanelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/CalendarRecoveriesPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'calendar recoveries are derived only from recoveries with a planned date inside the visible period',
  () => {
    assert.match(
      recoveryWorkspaceSource,
      /!recovery\.plannedDate/
    )
    assert.match(
      recoveryWorkspaceSource,
      /recovery\.plannedDate <\s*snapshot\.displayStartDate/
    )
    assert.match(
      recoveryWorkspaceSource,
      /recovery\.plannedDate >\s*snapshot\.displayEndDate/
    )
    assert.match(
      recoveryWorkspaceSource,
      /recoveriesByDate\.get\(\s*day\.date/
    )
  }
)

test(
  'calendar recovery rows respect the existing group and teaching-assignment filters',
  () => {
    assert.match(
      recoveryWorkspaceSource,
      /snapshot\.filters\s*\.teachingAssignmentId/
    )
    assert.match(
      recoveryWorkspaceSource,
      /snapshot\.filters\.groupId/
    )
    assert.match(
      recoveryWorkspaceSource,
      /student\.groupId !==\s*group\.id/
    )
    assert.match(
      recoveryWorkspaceSource,
      /module\.teachingAssignmentId !==\s*assignment\.id/
    )
  }
)

test(
  'calendar loads recovery data locally and does not convert it into school calendar events',
  () => {
    assert.match(
      recoveryWorkspaceSource,
      /maProfessorDb\.learningRecoveries/
    )
    assert.match(
      recoveryWorkspaceSource,
      /maProfessorDb\.students/
    )
    assert.match(
      recoveryWorkspaceSource,
      /maProfessorDb\.modules/
    )

    const combined = [
      recoveryWorkspaceSource,
      calendarRepositorySource,
      recoveryPanelSource,
      productSource
    ].join('\n')

    assert.doesNotMatch(
      combined,
      /fetch\(|snapshotApi|wrangler|cloudflare|Durable Object/i
    )
    assert.doesNotMatch(
      recoveryWorkspaceSource,
      /calendarRepository\.(createEvent|updateEvent)/
    )
  }
)

test(
  'calendar product enriches the reconciled snapshot without changing the shared calendar repository contract',
  () => {
    assert.match(
      productSource,
      /const baseSnapshot =\s*await calendarWorkspaceRepository\.getWorkspace\(/
    )
    assert.match(
      productSource,
      /const nextSnapshot =\s*await enrichCalendarSnapshotWithRecoveries\(\s*baseSnapshot/
    )
    assert.doesNotMatch(
      calendarRepositorySource,
      /enrichCalendarSnapshotWithRecoveries/
    )
    assert.match(
      calendarRepositorySource,
      /return super\.getWorkspace\(/
    )
    assert.match(
      productSource,
      /<CalendarRecoveriesPanel\s+[\s\S]*snapshot=\{snapshot\}/
    )
  }
)

test(
  'recovery calendar panel exposes date, attempt, student context, result and exam referral',
  () => {
    assert.match(
      recoveryPanelSource,
      /Datas previstas de recuperação/
    )
    assert.match(
      recoveryPanelSource,
      /Tentativa \{row\.attemptNumber\}/
    )
    assert.match(
      recoveryPanelSource,
      /row\.student\.name/
    )
    assert.match(
      recoveryPanelSource,
      /getModuleLabel\(row\)/
    )
    assert.match(
      recoveryPanelSource,
      /getLearningRecoveryOutcomeLabel/
    )
    assert.match(
      recoveryPanelSource,
      /Encaminhado para exame/
    )
  }
)
