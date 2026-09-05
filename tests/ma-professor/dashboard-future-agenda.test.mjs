import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const projectionSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardFutureAgenda.ts',
    import.meta.url
  ),
  'utf8'
).catch(() => '')

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const viewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/DashboardView.tsx',
    import.meta.url
  ),
  'utf8'
)

const planificationRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const refreshSignalSource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardRefreshSignal.ts',
    import.meta.url
  ),
  'utf8'
).catch(() => '')

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

function snapshot() {
  const academicYear = {
    id: 'year-1',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-08-31'
  }

  const group = {
    id: 'group-1',
    name: '10.º A',
    courseName: ''
  }

  const subject = {
    id: 'subject-1',
    name: 'Área de Estudo',
    shortName: 'AE'
  }

  const assignment = {
    id: 'assignment-1',
    academicYearId: 'year-1',
    groupId: 'group-1',
    subjectId: 'subject-1',
    displayName: '10.º A · AE'
  }

  const module = {
    id: 'module-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    code: 'UFCD 1',
    name: 'Módulo 1'
  }

  return {
    academicYear,
    referenceDate: '2026-09-05',
    generatedAt: '2026-09-05T12:00:00.000Z',
    totals: {
      activeGroupCount: 1,
      activeStudentCount: 20,
      activeAssignmentCount: 1,
      activeModuleCount: 1,
      periodsPlanned: 30,
      periodsTaught: 2,
      periodsRemaining: 28,
      completionPercent: 6.67,
      plannedLessonCount: 0,
      taughtLessonCount: 1,
      cancelledLessonCount: 0,
      pendingSummaryCount: 0,
      pendingGIAECount: 1,
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
            module,
            progress: {
              moduleId: 'module-1',
              periodsTaught: 2,
              periodsRemaining: 28,
              completionPercent: 6.67,
              estimatedCompletionDate: '2026-12-01'
            },
            isCurrent: true
          }
        ],
        currentModule: module,
        currentModuleProgress: {
          moduleId: 'module-1',
          periodsTaught: 2,
          periodsRemaining: 28,
          completionPercent: 6.67,
          estimatedCompletionDate: '2026-12-01'
        },
        periodsPlanned: 30,
        periodsTaught: 2,
        periodsRemaining: 28,
        completionPercent: 6.67,
        pendingSummaryCount: 0,
        pendingGIAECount: 1,
        nextLesson: null,
        nextPlanificationItem: null
      }
    ],
    upcomingLessons: [],
    pendingSummaries: [],
    attendanceAlerts: []
  }
}

function projectedDraft(overrides = {}) {
  return {
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status: 'planned',
    date: '2026-09-07',
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary: '',
    summarySource: 'manual',
    planificationItemIds: [],
    notes: '',
    ...overrides
  }
}

test(
  'dashboard projection shows future timetable lessons without mutating pedagogical progress',
  async () => {
    assert.ok(projectionSource)

    const projection = await import(
      transpile(projectionSource)
    )

    const original = snapshot()
    const result =
      projection.applyDashboardFutureAgendaProjection({
        snapshot: original,
        lessons: [],
        createLessons: [projectedDraft()],
        deleteLessonIds: []
      })

    assert.equal(result.upcomingLessons.length, 1)
    assert.equal(result.upcomingLessons[0].lesson.date, '2026-09-07')
    assert.equal(
      result.assignments[0].nextLesson?.date,
      '2026-09-07'
    )
    assert.equal(result.totals.plannedLessonCount, 1)

    assert.equal(result.totals.periodsTaught, 2)
    assert.equal(result.totals.periodsRemaining, 28)
    assert.equal(result.totals.completionPercent, 6.67)
    assert.equal(result.assignments[0].periodsTaught, 2)
    assert.equal(original.upcomingLessons.length, 0)
    assert.equal(original.totals.plannedLessonCount, 0)
  }
)

test(
  'dashboard projection is stable and removes only reconciliation delete candidates from the agenda view',
  async () => {
    const projection = await import(
      transpile(projectionSource)
    )

    const staleLesson = {
      ...projectedDraft({
        date: '2026-09-08',
        startTime: '08:00',
        endTime: '09:00'
      }),
      id: 'lesson-stale',
      giaeStatus: 'pending',
      giaeSubmittedAt: null,
      createdAt: '2026-09-01T08:00:00.000Z',
      updatedAt: '2026-09-01T08:00:00.000Z'
    }

    const input = {
      snapshot: snapshot(),
      lessons: [staleLesson],
      createLessons: [projectedDraft()],
      deleteLessonIds: ['lesson-stale']
    }

    const first =
      projection.applyDashboardFutureAgendaProjection(input)
    const second =
      projection.applyDashboardFutureAgendaProjection(input)

    assert.deepEqual(
      first.upcomingLessons.map(row => row.lesson.id),
      second.upcomingLessons.map(row => row.lesson.id)
    )
    assert.equal(first.upcomingLessons.length, 1)
    assert.notEqual(first.upcomingLessons[0].lesson.id, 'lesson-stale')
  }
)

test(
  'dashboard repository projects the full academic year in memory and does not persist the projection',
  () => {
    assert.match(
      repositorySource,
      /dashboardRepositoryBase/
    )
    assert.match(
      repositorySource,
      /dashboardFutureAgendaRepository\.project\(/
    )
    assert.doesNotMatch(
      repositorySource,
      /scheduledLessonReconciliationRepository\.reconcile\(/
    )
  }
)

test(
  'planification mutations mark dashboard data dirty and dashboard refreshes when mounted again',
  async () => {
    assert.ok(refreshSignalSource)

    const signal = await import(
      transpile(refreshSignalSource)
    )

    const before =
      signal.getDashboardDataRevision()

    signal.markDashboardDataDirty()

    assert.equal(
      signal.getDashboardDataRevision(),
      before + 1
    )

    for (const method of [
      'createPlanification',
      'updatePlanification',
      'addPlanificationItem',
      'updatePlanificationItem',
      'setPlanificationItemStatus',
      'deletePlanificationItem',
      'reorderPlanificationItems',
      'importPlanificationLines'
    ]) {
      assert.match(
        planificationRepositorySource,
        new RegExp(`${method}[\\s\\S]*markDashboardDataDirty\\(`)
      )
    }

    assert.match(
      viewSource,
      /DashboardViewBase/
    )
    assert.match(
      viewSource,
      /getDashboardDataRevision\(\)/
    )
    assert.match(
      viewSource,
      /onRefresh/
    )
  }
)
