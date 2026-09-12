import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyDutyWeekPanel.tsx',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceWithDuties.tsx',
    import.meta.url
  ),
  'utf8'
)

const productSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/MAProfessorProduct.tsx',
    import.meta.url
  ),
  'utf8'
)

const dutyHelperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/dutyEvent.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'Daily Cargo panel reads only school-activity occurrences in the selected school week',
  () => {
    assert.match(
      panelSource,
      /calendarRepository\.listEvents\(\{[\s\S]*academicYearId[\s\S]*dateFrom:[\s\S]*weekStart[\s\S]*dateTo:[\s\S]*weekEnd[\s\S]*type:[\s\S]*'school_activity'/
    )
    assert.match(
      panelSource,
      /getDutyEventDetails\([\s\S]*event/
    )
  }
)

test(
  'Cargo summary save updates only the selected calendar occurrence description',
  () => {
    assert.match(
      panelSource,
      /calendarRepository\.updateEvent\([\s\S]*selected\.event\.id[\s\S]*description:[\s\S]*summary/
    )
    assert.doesNotMatch(
      panelSource,
      /teachingAssignmentId\s*:/
    )
    assert.doesNotMatch(
      panelSource,
      /moduleId\s*:/
    )
    assert.doesNotMatch(
      panelSource,
      /assessmentId\s*:/
    )
  }
)

test(
  'Cargo summary editor protects unsaved text and detects concurrent edits',
  () => {
    assert.match(
      panelSource,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedSummary/
    )
    assert.match(
      panelSource,
      /current\.updatedAt\s*!==[\s\S]*selected\.event\.updatedAt/
    )
    assert.match(
      panelSource,
      /current\.description\s*!==[\s\S]*selected\.event\.description/
    )
  }
)

test(
  'Daily wrapper keeps the existing lesson workspace and adds the Cargo week panel without a second persistence model',
  () => {
    assert.match(
      wrapperSource,
      /<DailyDutyWeekPanel/
    )
    assert.match(
      wrapperSource,
      /<DailyWorkspaceView/
    )
    assert.match(
      productSource,
      /import DailyWorkspaceView from '\.\.\/daily\/DailyWorkspaceWithDuties'/
    )
  }
)

test(
  'Cargo parser recognises only imported Cargo calendar events and preserves the visible time range',
  () => {
    assert.match(
      dutyHelperSource,
      /event\.type\s*!==[\s\S]*'school_activity'/
    )
    assert.match(
      dutyHelperSource,
      /event\.scope\s*!==\s*'all'/
    )
    assert.match(
      dutyHelperSource,
      /event\.title\.startsWith\([\s\S]*DUTY_TITLE_PREFIX/
    )
    assert.match(
      dutyHelperSource,
      /DUTY_TIME_RANGE/
    )
  }
)

test(
  'Daily Cargo UI uses only the agreed visible terminology',
  () => {
    assert.match(
      panelSource,
      />\s*Cargo\s*</
    )
    assert.match(
      panelSource,
      />\s*Sumário\s*</
    )
    assert.match(
      panelSource,
      /Guardar sumário/
    )
    assert.doesNotMatch(
      panelSource,
      /componente não letiva/i
    )
    assert.doesNotMatch(
      panelSource,
      /ligad[oa] à avaliação/i
    )
  }
)
