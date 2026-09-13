import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardFutureAgenda.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(input) {
  const output = ts.transpileModule(input, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors =
    (output.diagnostics || []).filter(
      diagnostic =>
        diagnostic.category ===
          ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    errors.map(diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

function module() {
  return {
    id: 'module-regular',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    code: '',
    name: 'Matemática',
    plannedPeriods: 0,
    order: 1,
    plannedStartDate: null,
    plannedEndDate: null,
    active: true,
    moduleKind: 'regular_annual'
  }
}

function snapshot() {
  const annualModule = module()

  const assignment = {
    id: 'assignment-1',
    academicYearId: 'year-1',
    groupId: 'group-1',
    subjectId: 'subject-1',
    displayName: 'Matemática · 5.º A'
  }

  const group = {
    id: 'group-1',
    name: '5.º A',
    educationType: 'regular'
  }

  const subject = {
    id: 'subject-1',
    name: 'Matemática',
    shortName: 'MAT'
  }

  const emptyProgress = {
    moduleId: annualModule.id,
    periodsTaught: 1,
    periodsRemaining: 0,
    completionPercent: 0,
    estimatedCompletionDate: null
  }

  return {
    academicYear: {
      id: 'year-1',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-07-31'
    },
    referenceDate: '2026-09-14',
    generatedAt: '2026-09-14T12:00:00.000Z',
    totals: {
      activeGroupCount: 1,
      activeStudentCount: 20,
      activeAssignmentCount: 1,
      activeModuleCount: 1,
      periodsPlanned: 0,
      periodsTaught: 1,
      periodsRemaining: 0,
      completionPercent: 0,
      plannedLessonCount: 0,
      taughtLessonCount: 1,
      cancelledLessonCount: 0,
      pendingSummaryCount: 0,
      pendingGIAECount: 0,
      attendanceWarningCount: 0,
      recoveryRequiredCount: 0
    },
    assignments: [
      {
        assignment,
        group,
        subject,
        modules: [
          {
            module: annualModule,
            progress: emptyProgress,
            isCurrent: true
          }
        ],
        currentModule: annualModule,
        currentModuleProgress: emptyProgress,
        periodsPlanned: 0,
        periodsTaught: 1,
        periodsRemaining: 0,
        completionPercent: 0,
        pendingSummaryCount: 0,
        pendingGIAECount: 0,
        nextLesson: null,
        nextPlanificationItem: null
      }
    ],
    upcomingLessons: [],
    pendingSummaries: [],
    attendanceAlerts: []
  }
}

function lesson(overrides = {}) {
  return {
    id: 'lesson-taught',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-regular',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status: 'taught',
    date: '2026-09-14',
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary: 'Aula dada.',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    notes: '',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    ...overrides
  }
}

function draft(date, slotId) {
  return {
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-regular',
    scheduleSlotId: slotId,
    origin: 'scheduled',
    status: 'planned',
    date,
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary: '',
    summarySource: 'manual',
    planificationItemIds: [],
    notes: ''
  }
}

test(
  'regular annual dashboard progress derives its denominator from the effective timetable instead of plannedPeriods zero',
  async () => {
    const projection = await import(
      transpile(source)
    )

    const result =
      projection.applyDashboardFutureAgendaProjection({
        snapshot: snapshot(),
        lessons: [lesson()],
        createLessons: [
          draft('2026-09-21', 'slot-1'),
          draft('2026-09-28', 'slot-1')
        ],
        deleteLessonIds: []
      })

    assert.equal(
      result.assignments[0].periodsPlanned,
      3
    )
    assert.equal(
      result.assignments[0].periodsTaught,
      1
    )
    assert.equal(
      result.assignments[0].periodsRemaining,
      2
    )
    assert.equal(
      result.assignments[0].completionPercent,
      33.33
    )
    assert.equal(
      result.assignments[0].currentModuleProgress?.estimatedCompletionDate,
      '2026-09-28'
    )

    assert.equal(
      result.totals.periodsPlanned,
      3
    )
    assert.equal(
      result.totals.periodsTaught,
      1
    )
    assert.equal(
      result.totals.periodsRemaining,
      2
    )
    assert.equal(
      result.totals.completionPercent,
      33.33
    )
  }
)

test(
  'cancelled or non-progress regular lessons do not inflate annual dashboard workload',
  async () => {
    const projection = await import(
      transpile(source)
    )

    const result =
      projection.applyDashboardFutureAgendaProjection({
        snapshot: snapshot(),
        lessons: [
          lesson(),
          lesson({
            id: 'cancelled',
            status: 'cancelled',
            date: '2026-09-15'
          }),
          lesson({
            id: 'not-progress',
            status: 'taught',
            date: '2026-09-16',
            countTowardProgress: false
          })
        ],
        createLessons: [],
        deleteLessonIds: []
      })

    assert.equal(
      result.assignments[0].periodsPlanned,
      1
    )
    assert.equal(
      result.assignments[0].periodsTaught,
      1
    )
    assert.equal(
      result.assignments[0].completionPercent,
      100
    )
  }
)
