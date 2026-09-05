import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const dailyViewSource = await readFile(
  new URL(
    '../../src/components/ma-professor/daily/DailyWorkspaceView.tsx',
    import.meta.url
  ),
  'utf8'
)

const calendarProductSource = await readFile(
  new URL(
    '../../src/components/ma-professor/product/CalendarProductWorkspace.tsx',
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
    '../../src/components/ma-professor/lessons/lessonRepository.ts',
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
  'characterization: Daily date navigation currently loads persisted lessons without materializing the target date',
  () => {
    const loadDate = getSection(
      dailyViewSource,
      'const loadDate = useCallback(',
      'useEffect(() => {'
    )

    assert.match(
      loadDate,
      /dailyWorkspaceRepository\.getDateWorkspace\(/
    )

    assert.doesNotMatch(
      loadDate,
      /ensureDailyScheduledLessonsForDate|generateScheduledLessons/
    )
  }
)

test(
  'characterization: Calendar navigation currently reads the requested period without materializing scheduled lessons first',
  () => {
    const loadCalendar = getSection(
      calendarProductSource,
      'const loadCalendar = useCallback(',
      'useEffect(() => {'
    )

    assert.match(
      loadCalendar,
      /calendarWorkspaceRepository\.getWorkspace\(/
    )

    assert.doesNotMatch(
      loadCalendar,
      /ensureDailyScheduledLessonsForDate|generateScheduledLessons|reconcile/
    )
  }
)

test(
  'characterization: editing a weekly schedule slot does not reconcile already linked lessons',
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
      /maProfessorDb\.lessons|lessonRepository|scheduleSlotId|reconcil/
    )
  }
)

test(
  'characterization: deleting a schedule slot with linked lessons is deliberately blocked to preserve history',
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
  'characterization: scheduled generation deduplicates by assignment, date and start time instead of schedule-slot identity',
  () => {
    const positionKey = getSection(
      lessonRepositorySource,
      'function lessonPositionKey(',
      'function eventBlocksAssignment('
    )

    assert.match(
      positionKey,
      /teachingAssignmentId/
    )
    assert.match(
      positionKey,
      /date/
    )
    assert.match(
      positionKey,
      /startTime/
    )
    assert.doesNotMatch(
      positionKey,
      /scheduleSlotId/
    )
  }
)

test(
  'characterization: scheduled generation only adds missing lessons and does not update or remove stale generated placeholders',
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
      /\.bulkPut\(|\.delete\(|deletePlannedLesson\(|reconcil/
    )
  }
)

test(
  'characterization: no central pristine-scheduled-placeholder policy exists yet',
  () => {
    assert.doesNotMatch(
      lessonRepositorySource,
      /isPristineScheduled|isSafeScheduledPlaceholder|reconcileScheduled/
    )

    assert.doesNotMatch(
      scheduleRepositorySource,
      /isPristineScheduled|isSafeScheduledPlaceholder|reconcileScheduled/
    )
  }
)

test.todo(
  'future contract: a pristine scheduled placeholder follows a schedule time change without creating a duplicate lesson'
)

test.todo(
  'future contract: a pristine scheduled placeholder moves with a weekday change while taught, cancelled or edited lessons remain untouched'
)

test.todo(
  'future contract: deactivating a schedule slot removes only pristine future placeholders and preserves pedagogical history'
)

test.todo(
  'future contract: a later blocking school event removes only pristine placeholders that have not acquired teacher work'
)

test.todo(
  'future contract: Daily materializes the requested date before reading its workspace'
)

test.todo(
  'future contract: Calendar materializes the requested visible period before reading its workspace'
)

test.todo(
  'future contract: repeated reconciliation is idempotent and never creates duplicate scheduled lessons'
)
