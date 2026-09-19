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
    assert.match(
      wrapperSource,
      /dashboardRepository\.getDashboard/
    )
    assert.match(
      wrapperSource,
      /<DashboardDutyPendingPanel/
    )
    assert.match(
      wrapperSource,
      /<DashboardViewBase[\s\S]*showDailyWorkspace=[\s\S]*false/
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


test(
  'unified Daily week highlights the lesson that is running now until the user selects another lesson',
  () => {
    assert.match(
      unifiedSource,
      /const highlightedLessonId =[\s\S]*selectedLessonId[\s\S]*date !== todayISO\(\)[\s\S]*getCurrentSlotProgress\([\s\S]*row\.lesson\.startTime[\s\S]*row\.lesson\.endTime[\s\S]*currentMinute/
    )
    assert.match(
      unifiedSource,
      /row\.lesson\.id ===[\s\S]*highlightedLessonId/
    )
  }
)

test(
  'Today timetable shows a live red line descending through the current time cell',
  () => {
    assert.match(
      unifiedSource,
      /window\.setInterval\([\s\S]*updateCurrentMinute[\s\S]*15_000/
    )
    assert.match(
      unifiedSource,
      /date ===[\s\S]*todayISO\(\)[\s\S]*day\.isToday[\s\S]*getCurrentSlotProgress\([\s\S]*slot[\s\S]*currentMinute/
    )
    assert.match(
      unifiedSource,
      /currentSlotProgress !==[\s\S]*null[\s\S]*bg-rose-300/
    )
    assert.match(
      unifiedSource,
      /border-t-2 border-rose-400[\s\S]*currentSlotProgress \*[\s\S]*100/
    )
  }
)


test(
  'Today timeline can be tested locally with a URL date and time override without backend calls',
  () => {
    assert.match(
      unifiedSource,
      /URLSearchParams\([\s\S]*window\.location\.search[\s\S]*maProfessorNow/
    )
    assert.match(
      unifiedSource,
      /day\.date ===[\s\S]*todayISO\(\)[\s\S]*getCurrentSlotProgress/
    )
    assert.doesNotMatch(
      unifiedSource,
      /maProfessorNow[\s\S]{0,500}fetch\(/
    )
  }
)



test(
  'Daily wrapper honors the local maProfessorNow test date too',
  () => {
    assert.match(
      wrapperSource,
      /URLSearchParams\([\s\S]*window\.location\.search[\s\S]*maProfessorNow/
    )
    assert.match(
      wrapperSource,
      /initialDate \?\? todayISO\(\)/
    )
  }
)

test(
  'weekend users can preview the Today time line locally without changing persisted data',
  () => {
    assert.match(
      unifiedSource,
      /const canPreviewTimeline =[\s\S]*!weekDays\.some\([\s\S]*todayISO\(\)/
    )
    assert.match(
      unifiedSource,
      /function toggleTimelinePreview\(\)[\s\S]*setTimelinePreview\([\s\S]*minute:[\s\S]*start[\s\S]*end/
    )
    assert.match(
      unifiedSource,
      /Testar linha/
    )
    assert.match(
      unifiedSource,
      /timelinePreview\?\.date[\s\S]*timelinePreview\?\.minute[\s\S]*getCurrentSlotProgress/
    )
  }
)
