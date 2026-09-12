import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const reservationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationItemReservation.ts',
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

const dashboardRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/dashboard/dashboardRepository.ts',
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

const reservation = await import(
  transpile(reservationSource)
)

function lesson(overrides = {}) {
  return {
    id: 'lesson-default',
    moduleId: 'module-1',
    status: 'planned',
    planificationItemIds: [],
    ...overrides
  }
}

function item(overrides = {}) {
  return {
    id: 'item-default',
    status: 'planned',
    usedLessonId: null,
    order: 0,
    ...overrides
  }
}

test(
  'planned lessons reserve their planification items while cancelled and taught lessons do not',
  () => {
    const reservedIds =
      reservation.getReservedPlanificationItemIds(
        [
          lesson({
            id: 'planned-a',
            planificationItemIds: ['item-1']
          }),
          lesson({
            id: 'cancelled-a',
            status: 'cancelled',
            planificationItemIds: ['item-2']
          }),
          lesson({
            id: 'taught-a',
            status: 'taught',
            planificationItemIds: ['item-3']
          }),
          lesson({
            id: 'other-module',
            moduleId: 'module-2',
            planificationItemIds: ['item-4']
          })
        ],
        'module-1'
      )

    assert.deepEqual(
      [...reservedIds],
      ['item-1']
    )
  }
)

test(
  'the current lesson can keep seeing its own reserved planification item',
  () => {
    const lessons = [
      lesson({
        id: 'lesson-current',
        planificationItemIds: ['item-1']
      }),
      lesson({
        id: 'lesson-other',
        planificationItemIds: ['item-2']
      })
    ]

    const reservedIds =
      reservation.getReservedPlanificationItemIds(
        lessons,
        'module-1',
        'lesson-current'
      )

    assert.equal(
      reservedIds.has('item-1'),
      false
    )
    assert.equal(
      reservedIds.has('item-2'),
      true
    )
  }
)

test(
  'the next planification suggestion skips both used and reserved items in planification order',
  () => {
    const next =
      reservation.selectNextAvailablePlanificationItem(
        [
          item({
            id: 'item-1',
            order: 1
          }),
          item({
            id: 'item-2',
            order: 2
          }),
          item({
            id: 'item-3',
            order: 3,
            status: 'used',
            usedLessonId: 'lesson-taught'
          }),
          item({
            id: 'item-4',
            order: 4
          })
        ],
        new Set(['item-1', 'item-2'])
      )

    assert.equal(
      next?.id,
      'item-4'
    )
  }
)

test(
  'reservation conflicts are scoped to another planned lesson in the same module',
  () => {
    const lessons = [
      lesson({
        id: 'lesson-current',
        planificationItemIds: ['item-1']
      }),
      lesson({
        id: 'lesson-other',
        planificationItemIds: ['item-2']
      })
    ]

    assert.equal(
      reservation.findPlanificationReservationConflict(
        lessons,
        'module-1',
        ['item-1'],
        'lesson-current'
      ),
      null
    )

    assert.equal(
      reservation.findPlanificationReservationConflict(
        lessons,
        'module-1',
        ['item-2'],
        'lesson-current'
      )?.id,
      'lesson-other'
    )
  }
)

test(
  'lesson persistence checks new reservations inside the existing local transaction boundary',
  () => {
    assert.match(
      lessonRepositorySource,
      /findPlanificationReservationConflict/
    )
    assert.match(
      lessonRepositorySource,
      /maProfessorDb\.transaction\([\s\S]*assertPlanificationItemsAvailable[\s\S]*super\.createLesson/
    )
    assert.match(
      lessonRepositorySource,
      /existingReservationIds[\s\S]*newReservationIds[\s\S]*assertPlanificationItemsAvailable[\s\S]*super\.updateLesson/
    )
    assert.match(
      lessonRepositorySource,
      /getReservedPlanificationItemIds[\s\S]*selectNextAvailablePlanificationItem/
    )
  }
)

test(
  'Calendar and Daily editor context exclude the current lesson from reservation filtering',
  () => {
    assert.match(
      calendarRepositorySource,
      /getLessonEditorContext\([\s\S]*super\.getLessonEditorContext\([\s\S]*lessonRepository\.getNextPlanificationItem\([\s\S]*context\.lessonRow\.lesson\.moduleId,[\s\S]*lessonId/
    )
  }
)

test(
  'Dashboard refreshes next-planification suggestions through the same reservation-aware repository',
  () => {
    assert.match(
      dashboardRepositorySource,
      /dashboardFutureAgendaRepository\.project/
    )
    assert.match(
      dashboardRepositorySource,
      /projectedSnapshot\.assignments\.map[\s\S]*lessonRepository\.getNextPlanificationItem\([\s\S]*row\.currentModule\.id/
    )
  }
)
