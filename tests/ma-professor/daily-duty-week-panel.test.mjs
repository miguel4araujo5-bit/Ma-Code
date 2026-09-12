import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const unifiedSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyUnifiedWeekOverview.tsx',
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

const cssSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyUnifiedWeek.css',
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

const legacyDailySource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'unified Daily week reads lessons and Cargo occurrences for one shared school week',
  () => {
    assert.match(
      unifiedSource,
      /calendarWorkspaceRepository\.getWorkspace\([\s\S]*academicYearId[\s\S]*'week'[\s\S]*date/
    )
    assert.match(
      unifiedSource,
      /calendarRepository\.listEvents\(\{[\s\S]*dateFrom:[\s\S]*nextSnapshot\.primaryStartDate[\s\S]*dateTo:[\s\S]*nextSnapshot\.primaryEndDate[\s\S]*type:[\s\S]*'school_activity'/
    )
    assert.match(
      unifiedSource,
      /getDutyEventDetails\([\s\S]*event/
    )
    assert.match(
      unifiedSource,
      /day\.lessons\.filter/
    )
    assert.match(
      unifiedSource,
      /duties\.filter/
    )
  }
)

test(
  'one timetable exposes only the agreed Componente letiva and Cargo terminology',
  () => {
    assert.match(
      unifiedSource,
      /Componente letiva/
    )
    assert.match(
      unifiedSource,
      />\s*Cargo\s*</
    )
    assert.match(
      unifiedSource,
      />\s*Sumário\s*</
    )
    assert.match(
      unifiedSource,
      /Guardar sumário/
    )
    assert.doesNotMatch(
      unifiedSource,
      /componente não letiva/i
    )
    assert.doesNotMatch(
      unifiedSource,
      /ligad[oa] à avaliação/i
    )
  }
)

test(
  'Cargo summary save still updates only the selected occurrence and remains outside pedagogical entities',
  () => {
    assert.match(
      unifiedSource,
      /calendarRepository\.updateEvent\([\s\S]*selectedDuty\.event\.id[\s\S]*description:[\s\S]*summary/
    )
    assert.doesNotMatch(
      unifiedSource,
      /teachingAssignmentId\s*:/
    )
    assert.doesNotMatch(
      unifiedSource,
      /moduleId\s*:/
    )
    assert.doesNotMatch(
      unifiedSource,
      /assessmentId\s*:/
    )
    assert.doesNotMatch(
      unifiedSource,
      /snapshotApi|manualSyncService|DurableObject|wrangler|cloudflare|fetch\(/i
    )
  }
)

test(
  'Cargo summary editor keeps unsaved-work and concurrent-edit protections',
  () => {
    assert.match(
      unifiedSource,
      /useMAProfessorUnsavedWorkspaceProtection\([\s\S]*hasUnsavedSummary/
    )
    assert.match(
      unifiedSource,
      /current\.updatedAt\s*!==[\s\S]*selectedDuty\.event\.updatedAt/
    )
    assert.match(
      unifiedSource,
      /current\.description\s*!==[\s\S]*selectedDuty\.event\.description/
    )
  }
)

test(
  'Daily wrapper owns one week navigation and reuses the existing lesson editor below it',
  () => {
    assert.match(
      wrapperSource,
      /<DailyUnifiedWeekOverview/
    )
    assert.match(
      wrapperSource,
      /<DailyWorkspaceView/
    )
    assert.doesNotMatch(
      wrapperSource,
      /DailyDutyWeekPanel/
    )
    assert.match(
      wrapperSource,
      /key=\{`\$\{activeDate\}-\$\{[\s\S]*activeLessonId/
    )
    assert.match(
      productSource,
      /import DailyWorkspaceView from '\.\.\/daily\/DailyWorkspaceWithDuties'/
    )
  }
)

test(
  'legacy duplicate week overview is hidden only inside the unified wrapper',
  () => {
    assert.match(
      cssSource,
      /\.ma-professor-unified-daily\s*>\s*main\s*>\s*div\s*>\s*section:first-child/
    )
    assert.match(
      legacyDailySource,
      /<main className="min-h-\[calc\(100vh-58px\)\][\s\S]*<div className="mx-auto max-w-\[1600px\] space-y-2">[\s\S]*<section className="rounded-2xl/
    )
  }
)

test(
  'Cargo parser remains the single contract for imported Cargo events',
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
