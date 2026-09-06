import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const warningSource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/moduleBoundaryWarnings.ts',
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

async function loadWarnings() {
  return import(
    transpile(warningSource)
  )
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

function lesson({
  id,
  date,
  moduleId = 'module-1',
  periodCount = 2,
  countTowardProgress = true,
  status = 'taught'
}) {
  return {
    id,
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId,
    scheduleSlotId: 'slot-1',
    origin: 'scheduled',
    status,
    date,
    startTime: '09:00',
    endTime: '10:40',
    periodCount,
    countTowardProgress,
    plannedActivity: '',
    summary: status === 'taught' ? 'Sumário.' : '',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'pending',
    giaeSubmittedAt: null,
    notes: '',
    createdAt: `${date}T11:00:00.000Z`,
    updatedAt: `${date}T11:05:00.000Z`
  }
}

test(
  'a persisted two-period block crossing a three-period UFCD boundary is detected without changing lesson data',
  async () => {
    const warnings = await loadWarnings()

    const first = lesson({
      id: 'lesson-1',
      date: '2026-09-07'
    })
    const crossing = lesson({
      id: 'lesson-2',
      date: '2026-09-14'
    })

    const result =
      warnings.detectModuleBoundaryWarnings({
        modules: [
          moduleUnit('module-1', 1, 3),
          moduleUnit('module-2', 2, 10)
        ],
        lessons: [
          first,
          crossing
        ]
      })

    assert.deepEqual(
      result,
      [
        {
          lessonId: 'lesson-2',
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

    assert.equal(
      crossing.moduleId,
      'module-1',
      'A deteção não deve reatribuir a aula.'
    )
    assert.equal(
      crossing.periodCount,
      2,
      'A deteção não deve dividir nem reduzir o bloco.'
    )
    assert.equal(
      crossing.countTowardProgress,
      true,
      'A deteção não deve alterar a contabilização existente.'
    )
  }
)

test(
  'cancelled and non-progress lessons do not create false UFCD boundary warnings',
  async () => {
    const warnings = await loadWarnings()

    const result =
      warnings.detectModuleBoundaryWarnings({
        modules: [
          moduleUnit('module-1', 1, 3)
        ],
        lessons: [
          lesson({
            id: 'lesson-1',
            date: '2026-09-07'
          }),
          lesson({
            id: 'lesson-cancelled',
            date: '2026-09-14',
            status: 'cancelled'
          }),
          lesson({
            id: 'lesson-no-progress',
            date: '2026-09-21',
            countTowardProgress: false
          })
        ]
      })

    assert.deepEqual(
      result,
      []
    )
  }
)

test(
  'Daily preparation returns persisted UFCD boundary warnings after both S. Bento bootstrap and generic reconciliation',
  () => {
    assert.match(
      dailyPreparationSource,
      /moduleBoundaryWarningRepository/
    )
    assert.match(
      dailyPreparationSource,
      /moduleBoundaryWarnings:\s*await moduleBoundaryWarningRepository\.listWarnings/
    )

    const sBentoPosition =
      dailyPreparationSource.indexOf(
        'if (preparation.applied)'
      )
    const sBentoWarningPosition =
      dailyPreparationSource.indexOf(
        'return readModuleBoundaryWarnings(',
        sBentoPosition
      )
    const reconcilePosition =
      dailyPreparationSource.indexOf(
        'await scheduledLessonReconciliationRepository.reconcile('
      )
    const genericWarningPosition =
      dailyPreparationSource.indexOf(
        'return readModuleBoundaryWarnings(',
        reconcilePosition
      )

    assert.ok(sBentoPosition >= 0)
    assert.ok(sBentoWarningPosition > sBentoPosition)
    assert.ok(reconcilePosition > sBentoWarningPosition)
    assert.ok(genericWarningPosition > reconcilePosition)
  }
)
