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
    assert.match(
      calendarWrapperSource,
      /extends BaseCalendarWorkspaceRepository/
    )
    assert.match(
      calendarWrapperSource,
      /export \* from '\.\/calendarWorkspaceRepositoryBase'/
    )

    assert.match(
      calendarBaseSource,
      /export class CalendarWorkspaceRepository/
    )
    assert.match(
      calendarBaseSource,
      /lessonRepository\.listLessons\(/
    )
  }
)

test(
  'calendar reconciles the visible historical slice without deleting existing lessons and keeps normal reconciliation for today or future',
  () => {
    assert.match(
      calendarWrapperSource,
      /dateFrom < today/
    )
    assert.match(
      calendarWrapperSource,
      /historicalDateTo/
    )
    assert.match(
      calendarWrapperSource,
      /preserveExistingLessons:\s*true/
    )
    assert.match(
      calendarWrapperSource,
      /currentDateFrom[\s\S]*scheduledLessonReconciliationRepository\.reconcile\(\{[\s\S]*dateFrom:\s*currentDateFrom/[\s\S]*dateTo/
    )
    assert.match(
      calendarWrapperSource,
      /if \(!changed\)[\s\S]*return initialSnapshot/
    )
    assert.match(
      calendarWrapperSource,
      /return super\.getWorkspace\(/
    )
  }
)

test(
  'historical reconciliation protects every existing scheduled lesson in the requested range while still allowing genuinely missing occurrences to be planned',
  () => {
    assert.match(
      reconciliationRepositorySource,
      /preserveExistingLessons\?: boolean/
    )
    assert.match(
      reconciliationRepositorySource,
      /if \([\s\S]*input\.preserveExistingLessons[\s\S]*lesson\.origin ===[\s\S]*'scheduled'[\s\S]*lesson\.date >=[\s\S]*input\.dateFrom[\s\S]*lesson\.date <=[\s\S]*input\.dateTo[\s\S]*relatedLessonIds\.add/
    )
    assert.match(
      reconciliationRepositorySource,
      /planScheduledLessonReconciliation\(\{[\s\S]*relatedLessonIds/
    )
  }
)

test(
  'Daily initial preparation uses the same preserve-history policy for past dates and no longer calls the add-only generator directly',
  () => {
    assert.match(
      dailyPreparationSource,
      /scheduledLessonReconciliationRepository\.reconcile\(/
    )
    assert.match(
      dailyPreparationSource,
      /preserveExistingLessons:[\s\S]*date < todayISO\(\)/
    )
    assert.doesNotMatch(
      dailyPreparationSource,
      /lessonRepository\.generateScheduledLessons/
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
