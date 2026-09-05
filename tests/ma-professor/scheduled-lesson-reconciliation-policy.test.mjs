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

const reconciliationRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/scheduledLessonReconciliationRepository.ts',
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

const dailyPreparationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyScheduledLessonPreparation.ts',
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

function assignment(overrides = {}) {
  return {
    id: 'assignment-1',
    academicYearId: 'year-1',
    groupId: 'group-1',
    subjectId: 'subject-1',
    active: true,
    ...overrides
  }
}

function slot(overrides = {}) {
  return {
    id: 'slot-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    weekday: 1,
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    validFrom: '2026-09-01',
    validUntil: '2027-08-31',
    active: true,
    ...overrides
  }
}

function moduleUnit(overrides = {}) {
  return {
    id: 'module-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    order: 1,
    plannedPeriods: 30,
    active: true,
    ...overrides
  }
}

function input(overrides = {}) {
  return {
    academicYear: {
      id: 'year-1',
      startDate: '2026-09-01',
      endDate: '2027-08-31'
    },
    assignments: [assignment()],
    slots: [slot()],
    modules: [moduleUnit()],
    events: [],
    lessons: [],
    relatedLessonIds: new Set(),
    dateFrom: '2026-09-14',
    dateTo: '2026-09-20',
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
  'schedule occurrence identity follows the schedule slot and school week',
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
  'a pristine placeholder follows a time change without leaving a duplicate',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const plan =
      policy.planScheduledLessonReconciliation(
        input({
          slots: [
            slot({
              startTime: '10:00',
              endTime: '11:00'
            })
          ],
          lessons: [pristineLesson()]
        })
      )

    assert.deepEqual(
      plan.deleteLessonIds,
      ['lesson-1']
    )
    assert.equal(
      plan.createLessons.length,
      1
    )
    assert.equal(
      plan.createLessons[0].date,
      '2026-09-14'
    )
    assert.equal(
      plan.createLessons[0].startTime,
      '10:00'
    )
    assert.equal(
      plan.createLessons[0].endTime,
      '11:00'
    )
  }
)

test(
  'a pristine placeholder follows a weekday change within the same week',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const plan =
      policy.planScheduledLessonReconciliation(
        input({
          slots: [slot({ weekday: 2 })],
          lessons: [pristineLesson()]
        })
      )

    assert.deepEqual(
      plan.deleteLessonIds,
      ['lesson-1']
    )
    assert.equal(
      plan.createLessons.length,
      1
    )
    assert.equal(
      plan.createLessons[0].date,
      '2026-09-15'
    )
  }
)

test(
  'deactivation removes only a pristine future placeholder',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const pristinePlan =
      policy.planScheduledLessonReconciliation(
        input({
          slots: [slot({ active: false })],
          lessons: [pristineLesson()]
        })
      )

    assert.deepEqual(
      pristinePlan.deleteLessonIds,
      ['lesson-1']
    )
    assert.equal(
      pristinePlan.createLessons.length,
      0
    )

    const edited =
      pristineLesson({
        notes: 'Preparação já iniciada.',
        updatedAt: '2026-09-10T09:00:00.000Z'
      })

    const protectedPlan =
      policy.planScheduledLessonReconciliation(
        input({
          slots: [slot({ active: false })],
          lessons: [edited]
        })
      )

    assert.deepEqual(
      protectedPlan.deleteLessonIds,
      []
    )
    assert.deepEqual(
      protectedPlan.preservedLessonIds,
      ['lesson-1']
    )
  }
)

test(
  'a later blocking event removes only an untouched placeholder and does not recreate it',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const blockingEvent = {
      id: 'event-1',
      academicYearId: 'year-1',
      type: 'holiday',
      scope: 'all',
      groupId: null,
      teachingAssignmentId: null,
      title: 'Feriado',
      description: '',
      startDate: '2026-09-14',
      endDate: '2026-09-14',
      blocksLessons: true
    }

    const plan =
      policy.planScheduledLessonReconciliation(
        input({
          events: [blockingEvent],
          lessons: [pristineLesson()]
        })
      )

    assert.deepEqual(
      plan.deleteLessonIds,
      ['lesson-1']
    )
    assert.equal(
      plan.createLessons.length,
      0
    )
  }
)

test(
  'taught, cancelled, edited or related-data lessons are preserved and block replacement for the same schedule occurrence',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const protectedCases = [
      {
        lesson: pristineLesson({
          status: 'taught',
          summary: 'Aula dada.',
          updatedAt: '2026-09-14T12:00:00.000Z'
        }),
        related: new Set()
      },
      {
        lesson: pristineLesson({
          status: 'cancelled',
          updatedAt: '2026-09-14T12:00:00.000Z'
        }),
        related: new Set()
      },
      {
        lesson: pristineLesson({
          plannedActivity: 'Atividade preparada.',
          updatedAt: '2026-09-10T12:00:00.000Z'
        }),
        related: new Set()
      },
      {
        lesson: pristineLesson(),
        related: new Set(['lesson-1'])
      }
    ]

    for (const item of protectedCases) {
      const plan =
        policy.planScheduledLessonReconciliation(
          input({
            slots: [
              slot({
                startTime: '10:00',
                endTime: '11:00'
              })
            ],
            lessons: [item.lesson],
            relatedLessonIds:
              item.related
          })
        )

      assert.deepEqual(
        plan.deleteLessonIds,
        []
      )
      assert.deepEqual(
        plan.preservedLessonIds,
        ['lesson-1']
      )
      assert.equal(
        plan.createLessons.length,
        0
      )
    }
  }
)

test(
  'an already correct occurrence is idempotent',
  async () => {
    const policy = await import(
      transpile(policySource)
    )

    const plan =
      policy.planScheduledLessonReconciliation(
        input({
          lessons: [pristineLesson()]
        })
      )

    assert.deepEqual(
      plan.deleteLessonIds,
      []
    )
    assert.deepEqual(
      plan.createLessons,
      []
    )
    assert.deepEqual(
      plan.preservedLessonIds,
      ['lesson-1']
    )
  }
)

test(
  'the persistence layer rechecks related data before deleting and uses normal lesson validation when creating',
  () => {
    assert.match(
      reconciliationRepositorySource,
      /lessonAttendance/
    )
    assert.match(
      reconciliationRepositorySource,
      /lessonAssessments/
    )
    assert.match(
      reconciliationRepositorySource,
      /summarySuggestions/
    )
    assert.match(
      reconciliationRepositorySource,
      /lessonRepository\.deletePlannedLesson\(/
    )
    assert.match(
      reconciliationRepositorySource,
      /lessonRepository\.createLesson\(/
    )
  }
)

test(
  'calendar wraps the unchanged base repository and reconciles only today-forward visible dates before returning refreshed data',
  () => {
    assert.match(
      calendarRepositorySource,
      /calendarWorkspaceRepositoryBase/
    )
    assert.match(
      calendarRepositorySource,
      /scheduledLessonReconciliationRepository\.reconcile\(/
    )
    assert.match(
      calendarRepositorySource,
      /todayISO\(\)/
    )
    assert.match(
      calendarRepositorySource,
      /displayStartDate/
    )
    assert.match(
      calendarRepositorySource,
      /displayEndDate/
    )
    assert.match(
      calendarRepositorySource,
      /return super\.getWorkspace\(/
    )
  }
)

test(
  'initial Daily preparation uses the same safe reconciliation path after the S. Bento bootstrap',
  () => {
    assert.match(
      dailyPreparationSource,
      /ensureInitialSchoolCalendar2026_2027/
    )
    assert.match(
      dailyPreparationSource,
      /scheduledLessonReconciliationRepository\.reconcile\(/
    )
    assert.doesNotMatch(
      dailyPreparationSource,
      /lessonRepository\.generateScheduledLessons/
    )
  }
)
