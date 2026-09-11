import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const stepSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
    import.meta.url
  ),
  'utf8'
)

const atomicSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportAtomicRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function compact(source) {
  return source
    .replace(/\/\/.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const step = compact(stepSource)
const atomic = compact(atomicSource)

test(
  'schedule import keeps the proven production parser and only delegates the confirmed commit',
  () => {
    assert.match(
      step,
      /const proposal = parsePages\( extracted\.pages, settings\.defaultPeriodMinutes \)/
    )
    assert.match(
      step,
      /commitScheduleImportAtomically\(\{ academicYearId, expectedFingerprint, lessons: included, duties: includedDuties \}\)/
    )
    assert.doesNotMatch(
      step,
      /extractScheduleGridAnalysisFromPdf|interpretScheduleGridDocument/
    )
  }
)

test(
  'confirmed schedule writes run inside one Dexie transaction with a stale-state guard before mutations',
  () => {
    assert.match(
      atomic,
      /maProfessorDb\.transaction\( 'rw', relevantTables\(\), async \(\) => \{/
    )
    assert.match(
      atomic,
      /currentFingerprint !== input\.expectedFingerprint/
    )

    const fingerprintGuard = atomic.indexOf(
      'currentFingerprint !== input.expectedFingerprint'
    )
    const firstMutation = Math.min(
      ...[
        'maProfessorDb .groups .add(',
        'maProfessorDb .groups .put(',
        'maProfessorDb .subjects .add(',
        'maProfessorDb .teachingAssignments .add(',
        'maProfessorDb .weeklyScheduleSlots .add(',
        'maProfessorDb .schoolCalendarEvents .add('
      ]
        .map(token => atomic.indexOf(token))
        .filter(index => index >= 0)
    )

    assert.ok(fingerprintGuard >= 0)
    assert.ok(Number.isFinite(firstMutation))
    assert.ok(fingerprintGuard < firstMutation)
  }
)

test(
  'atomic transaction covers every table mutated by the schedule import',
  () => {
    for (const table of [
      'groups',
      'subjects',
      'teachingAssignments',
      'weeklyScheduleSlots',
      'schoolCalendarEvents'
    ]) {
      assert.match(
        atomicSource,
        new RegExp(`maProfessorDb\\.${table}`)
      )
    }

    assert.match(
      atomicSource,
      /relevantTables\(\)/
    )
  }
)

test(
  'existing non-empty course is preserved when the PDF proposes a different course',
  () => {
    assert.match(
      atomic,
      /existingCourse && normalize\(existingCourse\) !== normalize\(courseName\)/
    )
    assert.match(
      atomic,
      /preservedCourseConflicts \+= 1/
    )
    assert.match(
      atomic,
      /else if \(!existingCourse\)/
    )
    assert.doesNotMatch(
      atomic,
      /existingCourse && normalize\(existingCourse\) !== normalize\(courseName\)[\s\S]{0,300}courseName, updatedAt/
    )
  }
)

test(
  'schedule PDF import rejects files above 20 MB before extraction',
  () => {
    assert.match(
      step,
      /MAX_SCHEDULE_PDF_BYTES = 20 \* 1024 \* 1024/
    )
    assert.match(
      step,
      /file\.size > MAX_SCHEDULE_PDF_BYTES/
    )

    const sizeGuard = step.indexOf(
      'file.size > MAX_SCHEDULE_PDF_BYTES'
    )
    const extraction = step.indexOf(
      'await extractTextFromPdf('
    )

    assert.ok(sizeGuard >= 0)
    assert.ok(extraction > sizeGuard)
  }
)

test(
  'atomic schedule import does not touch cloud sync, D1, workers or encryption',
  () => {
    assert.doesNotMatch(
      atomicSource + stepSource,
      /snapshotApi|manualSyncService|MA_PROFESSOR_DB|DurableObject|AES-256-GCM|Cloudflare/i
    )
  }
)
