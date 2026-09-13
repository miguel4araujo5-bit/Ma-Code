import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/calendar/initialSchoolCalendar2026_2027.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'S. Bento secondary preset skips explicit regular groups before professional grade validation',
  () => {
    assert.match(
      source,
      /const group = activeGroupById\.get\(assignment\.groupId\)[\s\S]*group\.educationType ===\s*'regular'[\s\S]*continue[\s\S]*endDateByAssignment\.set\(assignment\.id, getGroupEndDate\(group\)\)/
    )
  }
)

test(
  'preset lesson generation is scoped to each professional assignment and its own end date',
  () => {
    assert.match(
      source,
      /async function generateProfessionalPresetLessons\([\s\S]*for \([\s\S]*teachingAssignmentId,[\s\S]*dateTo[\s\S]*of endDateByAssignment[\s\S]*lessonRepository\.generateScheduledLessons\(\{[\s\S]*academicYearId,[\s\S]*teachingAssignmentId,[\s\S]*dateFrom: SECONDARY_START_DATE,[\s\S]*dateTo,[\s\S]*createCancelledForBlockedDates: false/
    )
  }
)

test(
  'regular schedule slots are not rewritten by the professional preset',
  () => {
    assert.match(
      source,
      /const expectedEndDate = endDateByAssignment\.get\(slot\.teachingAssignmentId\)[\s\S]*if \(!expectedEndDate\) continue/
    )
  }
)

test(
  'preset event creation resynchronizes regular annual capacity before professional lesson generation',
  () => {
    assert.match(
      source,
      /syncRegularAnnualComponentsForAcademicYear/
    )

    const eventIndex =
      source.indexOf(
        'const createdEvents = await ensurePresetEvents(academicYearId)'
      )
    const syncIndex =
      source.indexOf(
        'await syncRegularAnnualComponentsForAcademicYear('
      )
    const generationIndex =
      source.indexOf(
        'await generateProfessionalPresetLessons('
      )

    assert.ok(eventIndex >= 0)
    assert.ok(syncIndex > eventIndex)
    assert.ok(generationIndex > syncIndex)
  }
)
