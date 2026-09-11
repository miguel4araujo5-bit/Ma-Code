import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const parserSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/schedulePdfParser.ts',
    import.meta.url
  ),
  'utf8'
)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/scheduleImportRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const stepSource = await readFile(
  new URL(
    '../../src/components/ma-professor/setup/SchedulePdfImportStep.tsx',
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

const parser = compact(parserSource)
const repository = compact(repositorySource)
const step = compact(stepSource)

test(
  'schedule parser never uses the old multiword duty fallback and tries lessons before duties',
  () => {
    assert.doesNotMatch(
      parser,
      /split\(\/\\s\+\/\).*length\s*>=\s*2/
    )

    const classifyStart = parser.indexOf('function classifyCandidate')
    const lessonCall = parser.indexOf('addLesson(', classifyStart)
    const dutyCall = parser.indexOf('addDuty(', classifyStart)
    const unresolvedCall = parser.indexOf('addUnresolved(', classifyStart)

    assert.ok(classifyStart >= 0)
    assert.ok(lessonCall > classifyStart)
    assert.ok(dutyCall > lessonCall)
    assert.ok(unresolvedCall > dutyCall)
  }
)

test(
  'unclassified timetable cells are preserved for explicit review instead of disappearing',
  () => {
    assert.match(
      parser,
      /type ScheduleUnresolvedDraft/
    )
    assert.match(
      parser,
      /const unresolved:\s*ScheduleUnresolvedDraft\[\]/
    )
    assert.match(
      parser,
      /return \{ lessons, duties, unresolved \}/
    )

    assert.match(
      step,
      /Elementos por rever/
    )
    assert.match(
      step,
      /Tratar como aula/
    )
    assert.match(
      step,
      /Tratar como cargo/
    )
    assert.match(
      step,
      /Ignorar/
    )
    assert.match(
      step,
      /unresolved\.length > 0/
    )
  }
)

test(
  'schedule commit is one Dexie transaction guarded by a reviewed-state fingerprint',
  () => {
    assert.match(
      repository,
      /maProfessorDb\.transaction\( 'rw', tables\(\), async \(\) => \{/
    )
    assert.match(
      repository,
      /await state\(\) !== request\.expectedFingerprint/
    )

    const fingerprintCheck = repository.indexOf(
      'await state() !== request.expectedFingerprint'
    )
    const firstGroupWrite = repository.indexOf(
      'maProfessorDb.groups.add('
    )
    const firstSlotWrite = repository.indexOf(
      'maProfessorDb .weeklyScheduleSlots .add('
    )

    assert.ok(fingerprintCheck >= 0)
    assert.ok(firstGroupWrite === -1 || fingerprintCheck < firstGroupWrite)
    assert.ok(firstSlotWrite === -1 || fingerprintCheck < firstSlotWrite)

    assert.match(
      repository,
      /maProfessorDb\.schoolCalendarEvents/
    )
  }
)

test(
  'existing confirmed course wins over an incompatible PDF inference',
  () => {
    assert.match(
      repository,
      /existingCourse && normalizeScheduleText\( existingCourse \) !== normalizeScheduleText\( courseName \)/
    )
    assert.match(
      repository,
      /preservedCourses \+= 1/
    )

    const conflictBranch = repository.indexOf(
      'existingCourse && normalizeScheduleText( existingCourse ) !== normalizeScheduleText( courseName )'
    )
    const fillBlankCourse = repository.indexOf(
      'else if (!existingCourse)'
    )

    assert.ok(conflictBranch >= 0)
    assert.ok(fillBlankCourse > conflictBranch)
  }
)

test(
  'professional group identifiers can contain a short alphanumeric suffix without becoming arbitrary text',
  () => {
    assert.match(
      parserSource,
      /\(\[A-Za-z\]\[A-Za-z0-9\]\{0,3\}\)/
    )
  }
)

test(
  'schedule PDF import has an explicit 20 MB guard and does not touch cloud sync code',
  () => {
    assert.match(
      step,
      /MAX_SCHEDULE_PDF_BYTES\s*=\s*20 \* 1024 \* 1024/
    )
    assert.doesNotMatch(
      parserSource + repositorySource + stepSource,
      /snapshotApi|manualSyncService|MA_PROFESSOR_DB|DurableObject|Cloudflare/i
    )
  }
)
