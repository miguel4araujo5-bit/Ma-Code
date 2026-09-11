import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const calendarWrapperSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const calendarBaseSource = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/calendarWorkspaceRepositoryBase.ts',
    import.meta.url
  ),
  'utf8'
)

const scheduleRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/schedule/scheduleWorkspaceRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const lessonRepositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/lessons/lessonRepositoryBase.ts',
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

const dailyPreparationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/dailyScheduledLessonPreparation.ts',
    import.meta.url
  ),
  'utf8'
)

function getSection(
  source,
  startMarker,
  endMarker
) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(
    endMarker,
    start
  )

  assert.notEqual(
    start,
    -1,
    `Não foi encontrado ${startMarker}`
  )
  assert.notEqual(
    end,
    -1,
    `Não foi encontrado ${endMarker}`
  )

  return source.slice(start, end)
}

test(
  'calendar keeps the former workspace implementation intact behind a small reconciliation wrapper',
  () => {
    assert.ok(
      calendarWrapperSource.includes(
        'extends BaseCalendarWorkspaceRepository'
      )
    )
    assert.ok(
      calendarWrapperSource.includes(
        "export * from './calendarWorkspaceRepositoryBase'"
      )
    )
    assert.ok(
      calendarBaseSource.includes(
        'export class CalendarWorkspaceRepository'
      )
    )
    assert.ok(
      calendarBaseSource.includes(
        'lessonRepository.listLessons('
      )
    )
  }
)

test(
  'calendar reconciles past dates in preserve mode and keeps normal reconciliation for today or future',
  () => {
    assert.ok(
      calendarWrapperSource.includes(
        'if (dateFrom < today)'
      )
    )
    assert.ok(
      calendarWrapperSource.includes(
        'historicalDateTo'
      )
    )
    assert.ok(
      calendarWrapperSource.includes(
        'preserveExistingLessons:'
      )
    )
    assert.ok(
      calendarWrapperSource.includes(
        'const currentDateFrom ='
      )
    )
    assert.ok(
      calendarWrapperSource.includes(
        'if (!changed)'
      )
    )
  }
)

test(
  'historical reconciliation can protect existing scheduled lessons while still planning missing occurrences',
  () => {
    assert.ok(
      reconciliationRepositorySource.includes(
        'preserveExistingLessons?: boolean'
      )
    )
    assert.ok(
      reconciliationRepositorySource.includes(
        'input.preserveExistingLessons'
      )
    )
    assert.ok(
      reconciliationRepositorySource.includes(
        "lesson.origin ===\n              'scheduled'"
      )
    )
    assert.ok(
      reconciliationRepositorySource.includes(
        'relatedLessonIds.add('
      )
    )
    assert.ok(
      reconciliationRepositorySource.includes(
        'planScheduledLessonReconciliation({'
      )
    )
  }
)

test(
  'Daily initial preparation uses preserve-history policy for past dates and no longer calls the add-only generator directly',
  () => {
    assert.ok(
      dailyPreparationSource.includes(
        'scheduledLessonReconciliationRepository.reconcile({'
      )
    )
    assert.ok(
      dailyPreparationSource.includes(
        'preserveExistingLessons:'
      )
    )
    assert.ok(
      dailyPreparationSource.includes(
        'date < todayISO()'
      )
    )
    assert.ok(
      !dailyPreparationSource.includes(
        'lessonRepository.generateScheduledLessons'
      )
    )
  }
)

test(
  'editing a weekly schedule slot remains non-destructive and defers lesson cleanup to lazy reconciliation',
  () => {
    const updateSlot = getSection(
      scheduleRepositorySource,
      'async updateScheduleSlot(',
      'async deleteScheduleSlot('
    )

    assert.match(
      updateSlot,
      /weeklyScheduleSlots\.put\(/
    )
    assert.doesNotMatch(
      updateSlot,
      /maProfessorDb\.lessons|deletePlannedLesson/
    )
  }
)

test(
  'deleting a schedule slot with linked lessons stays blocked to preserve pedagogical history',
  () => {
    const deleteSlot = getSection(
      scheduleRepositorySource,
      'async deleteScheduleSlot(',
      'async createSchoolCalendarEvent('
    )

    assert.match(
      deleteSlot,
      /maProfessorDb\.lessons/
    )
    assert.match(
      deleteSlot,
      /scheduleSlotId/
    )
    assert.match(
      deleteSlot,
      /já possui aulas associadas[\s\S]*Desative-o para preservar o histórico/
    )
  }
)

test(
  'legacy annual generation remains add-only and is isolated from the new reconciliation path',
  () => {
    const generate = getSection(
      lessonRepositorySource,
      'async generateScheduledLessons(',
      '\n}\n\nexport function formatLessonSummaryForGIAE('
    )

    assert.match(
      generate,
      /occupiedPositions/
    )
    assert.match(
      generate,
      /bulkAdd\(/
    )
    assert.doesNotMatch(
      generate,
      /deletePlannedLesson\(|reconcileScheduled/
    )
  }
)
