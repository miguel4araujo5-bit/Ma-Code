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

async function loadPolicy() {
  return import(
    transpile(policySource)
  )
}

function assignment() {
  return {
    id: 'assignment-1',
    academicYearId: 'year-1',
    groupId: 'group-1',
    subjectId: 'subject-1',
    active: true
  }
}

function moduleUnit(
  id,
  order,
  plannedPeriods
) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    code: id === 'module-1' ? 'UFCD-1' : 'UFCD-2',
    name: id === 'module-1' ? 'UFCD 1' : 'UFCD 2',
    order,
    plannedPeriods,
    active: true,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  }
}

function existingProgressLesson() {
  return {
    id: 'lesson-existing',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status: 'taught',
    date: '2026-09-07',
    startTime: '09:00',
    endTime: '10:40',
    periodCount: 2,
    countTowardProgress: true,
    plannedActivity: '',
    summary: 'Primeiro bloco.',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    notes: '',
    createdAt: '2026-09-07T11:00:00.000Z',
    updatedAt: '2026-09-07T11:05:00.000Z'
  }
}

function input() {
  return {
    academicYear: {
      id: 'year-1',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-08-31'
    },
    assignments: [assignment()],
    slots: [
      {
        id: 'slot-1',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        weekday: 1,
        startTime: '09:00',
        endTime: '10:40',
        periodCount: 2,
        validFrom: '2026-09-01',
        validUntil: '2027-08-31',
        active: true
      }
    ],
    modules: [
      moduleUnit('module-1', 1, 3),
      moduleUnit('module-2', 2, 10)
    ],
    events: [],
    lessons: [existingProgressLesson()],
    relatedLessonIds: new Set(['lesson-existing']),
    dateFrom: '2026-09-14',
    dateTo: '2026-09-20'
  }
}

test(
  'a two-period block that starts inside a three-period UFCD is detected as crossing the module boundary without changing allocation',
  async () => {
    const policy = await loadPolicy()
    const plan =
      policy.planScheduledLessonReconciliation(
        input()
      )

    assert.equal(
      plan.createLessons.length,
      1
    )

    const created =
      plan.createLessons[0]

    assert.equal(
      created.moduleId,
      'module-1',
      'A deteção não deve alterar silenciosamente a regra atual de atribuição.'
    )
    assert.equal(
      created.periodCount,
      2
    )
    assert.equal(
      created.countTowardProgress,
      true
    )
    assert.equal(
      plan.createdOutsidePlannedCapacity,
      0,
      'A fronteira é distinta de uma aula criada quando a UFCD já estava cheia.'
    )

    assert.deepEqual(
      plan.moduleBoundaryWarnings,
      [
        {
          source: 'planned',
          lessonId: null,
          moduleId: 'module-1',
          teachingAssignmentId: 'assignment-1',
          scheduleSlotId: 'slot-1',
          date: '2026-09-14',
          startTime: '09:00',
          plannedPeriods: 3,
          allocatedPeriodsBefore: 2,
          lessonPeriodCount: 2,
          overflowPeriods: 1
        }
      ]
    )
  }
)
