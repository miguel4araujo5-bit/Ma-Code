import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const policySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/scheduledLessonReconciliation.ts',
    import.meta.url
  ),
  'utf8'
)

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
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

function pristineLesson(overrides = {}) {
  return {
    id: 'lesson-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status: 'planned',
    date: '2026-09-14',
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: '',
    summary: '',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    notes: '',
    createdAt: '2026-09-05T18:00:00.000Z',
    updatedAt: '2026-09-05T18:00:00.000Z',
    ...overrides
  }
}

test(
  'only untouched generated placeholders are eligible for automatic reconciliation',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    assert.equal(
      policy.isPristineScheduledLesson(
        pristineLesson(),
        false
      ),
      true
    )

    const protectedCases = [
      pristineLesson({
        updatedAt: '2026-09-05T18:01:00.000Z'
      }),
      pristineLesson({
        status: 'taught',
        summary: 'Conteúdo lecionado.'
      }),
      pristineLesson({
        status: 'cancelled'
      }),
      pristineLesson({
        plannedActivity: 'Trabalho preparado.'
      }),
      pristineLesson({
        notes: 'Nota do professor.'
      }),
      pristineLesson({
        planificationItemIds: ['item-1']
      }),
      pristineLesson({
        origin: 'extra',
        scheduleSlotId: null
      })
    ]

    for (const lesson of protectedCases) {
      assert.equal(
        policy.isPristineScheduledLesson(
          lesson,
          false
        ),
        false
      )
    }

    assert.equal(
      policy.isPristineScheduledLesson(
        pristineLesson(),
        true
      ),
      false
    )
  }
)

test(
  'schedule occurrence identity is stable across a week and changes on the following week',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    assert.equal(
      policy.getScheduleOccurrenceKey(
        'slot-1',
        '2026-09-14'
      ),
      'slot-1|2026-09-14'
    )

    assert.equal(
      policy.getScheduleOccurrenceKey(
        'slot-1',
        '2026-09-18'
      ),
      'slot-1|2026-09-14'
    )

    assert.equal(
      policy.getScheduleOccurrenceKey(
        'slot-1',
        '2026-09-21'
      ),
      'slot-1|2026-09-21'
    )
  }
)

test(
  'lesson repository reconciles only stale pristine scheduled lessons before generating missing occurrences',
  () => {
    assert.match(
      lessonRepositorySource,
      /async reconcileScheduledLessons\(/
    )
    assert.match(
      lessonRepositorySource,
      /isPristineScheduledLesson/
    )
    assert.match(
      lessonRepositorySource,
      /lessonAttendance/
    )
    assert.match(
      lessonRepositorySource,
      /lessonAssessments/
    )
    assert.match(
      lessonRepositorySource,
      /summarySuggestions/
    )
    assert.match(
      lessonRepositorySource,
      /deletePlannedLesson\(/
    )
    assert.match(
      lessonRepositorySource,
      /generateScheduledLessons\(/
    )
  }
)

test(
  'generator treats an existing protected lesson for the same schedule slot and week as the occupied occurrence',
  () => {
    assert.match(
      lessonRepositorySource,
      /getScheduleOccurrenceKey/
    )
    assert.match(
      lessonRepositorySource,
      /occupiedScheduleOccurrences/
    )
    assert.match(
      lessonRepositorySource,
      /lesson\.scheduleSlotId/
    )
  }
)

test(
  'calendar reconciles only today and future dates before reading lessons for the visible period',
  () => {
    const reconcilePosition =
      calendarRepositorySource.indexOf(
        'await lessonRepository.reconcileScheduledLessons('
      )
    const listPosition =
      calendarRepositorySource.indexOf(
        'lessonRepository.listLessons('
      )

    assert.ok(reconcilePosition >= 0)
    assert.ok(listPosition >= 0)
    assert.ok(
      reconcilePosition < listPosition,
      'A reconciliação deve terminar antes de o calendário ler as aulas.'
    )

    assert.match(
      calendarRepositorySource,
      /todayISO\(\)/
    )
    assert.match(
      calendarRepositorySource,
      /queryEndDate/
    )
  }
)
