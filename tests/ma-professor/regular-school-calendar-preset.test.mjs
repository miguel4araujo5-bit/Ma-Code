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
  'S. Bento professional teaching starts on 14 September while regular groups remain outside this preset',
  () => {
    assert.match(
      source,
      /const PROFESSIONAL_START_DATE: ISODate = '2026-09-14'/
    )
    assert.doesNotMatch(
      source,
      /const SECONDARY_START_DATE/
    )
    assert.match(
      source,
      /group\.educationType ===\s*'regular'[\s\S]*continue/
    )
  }
)

test(
  'legacy S. Bento professional slots that still use the old 21 September preset are migrated to 14 September',
  () => {
    assert.match(
      source,
      /const LEGACY_PROFESSIONAL_START_DATE: ISODate = '2026-09-21'/
    )
    assert.match(
      source,
      /const stillUsesLegacyPresetBounds =[\s\S]*slot\.validFrom === LEGACY_PROFESSIONAL_START_DATE[\s\S]*slot\.validUntil === expectedEndDate/
    )
    assert.match(
      source,
      /!stillUsesGenericYearBounds &&[\s\S]*!stillUsesLegacyPresetBounds[\s\S]*continue/
    )
    assert.match(
      source,
      /updateScheduleSlot\(slot\.id, \{[\s\S]*validFrom: PROFESSIONAL_START_DATE,[\s\S]*validUntil: expectedEndDate/
    )
  }
)

test(
  'preset lesson generation is scoped to each professional assignment and its own end date',
  () => {
    assert.match(
      source,
      /async function generateProfessionalPresetLessons\([\s\S]*for \([\s\S]*teachingAssignmentId,[\s\S]*dateTo[\s\S]*of endDateByAssignment[\s\S]*lessonRepository\.generateScheduledLessons\(\{[\s\S]*academicYearId,[\s\S]*teachingAssignmentId,[\s\S]*dateFrom: PROFESSIONAL_START_DATE,[\s\S]*dateTo,[\s\S]*createCancelledForBlockedDates: false/
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
  'preset blockers recalculate regular annual capacity before professional lesson generation',
  () => {
    assert.match(
      source,
      /const createdEvents = await ensurePresetEvents\(academicYearId\)[\s\S]*const updatedScheduleSlots = await ensureScheduleValidity\([\s\S]*await syncRegularAnnualComponentsForAcademicYear\(\s*academicYearId\s*\)[\s\S]*await generateProfessionalPresetLessons\(/
    )
  }
)
