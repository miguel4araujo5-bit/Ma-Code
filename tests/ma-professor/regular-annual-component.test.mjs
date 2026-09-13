import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const repositoryUrl = new URL(
  '../../src/components/ma-professor/curriculum/regularAnnualComponentRepository.ts',
  import.meta.url
)

const setupWizardUrl = new URL(
  '../../src/components/ma-professor/setup/SetupWizard.tsx',
  import.meta.url
)

const scheduleWorkspaceUrl = new URL(
  '../../src/components/ma-professor/product/ScheduleProductWorkspace.tsx',
  import.meta.url
)

const repositorySource = await readFile(
  repositoryUrl,
  'utf8'
)

const setupWizardSource = await readFile(
  setupWizardUrl,
  'utf8'
)

const scheduleWorkspaceSource = await readFile(
  scheduleWorkspaceUrl,
  'utf8'
)

const runtimeSource = repositorySource
  .replace(
    /import\s*\{[\s\S]*?\}\s*from\s*'\.\.\/db'\s*/,
    ''
  )
  .replace(
    /import\s+type\s*\{[\s\S]*?\}\s*from\s*'\.\.\/types'\s*/,
    ''
  )

const transpiled = ts.transpileModule(
  runtimeSource,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }
).outputText

const runtime = await import(
  `data:text/javascript;base64,${Buffer.from(
    transpiled
  ).toString('base64')}`
)

const academicYear = {
  id: 'year',
  name: '2026/2027',
  startDate: '2026-09-14',
  endDate: '2026-09-20'
}

const assignment = {
  id: 'assignment',
  academicYearId: 'year',
  groupId: 'group',
  subjectId: 'subject',
  displayName: '5.º A · Teatro',
  active: true
}

function slot({
  id,
  weekday,
  periodCount,
  teachingAssignmentId = 'assignment',
  active = true,
  validFrom = academicYear.startDate,
  validUntil = academicYear.endDate
}) {
  return {
    id,
    academicYearId: academicYear.id,
    teachingAssignmentId,
    weekday,
    startTime: '09:00',
    endTime: '09:50',
    periodCount,
    validFrom,
    validUntil,
    active
  }
}

function event({
  id,
  date,
  scope = 'all',
  groupId = null,
  teachingAssignmentId = null,
  blocksLessons = true
}) {
  return {
    id,
    academicYearId: academicYear.id,
    type: 'holiday',
    scope,
    groupId,
    teachingAssignmentId,
    title: 'Evento',
    description: '',
    startDate: date,
    endDate: date,
    blocksLessons
  }
}

test(
  'regular education is explicit and legacy groups remain professional-compatible',
  () => {
    assert.equal(
      runtime.isRegularEducationGroup({ educationType: 'regular' }),
      true
    )
    assert.equal(
      runtime.isRegularEducationGroup({ educationType: 'professional' }),
      false
    )
    assert.equal(
      runtime.isRegularEducationGroup({}),
      false
    )
  }
)

test(
  'annual component is identified only by its explicit technical flag',
  () => {
    assert.equal(
      runtime.isRegularAnnualComponent({ regularAnnual: true }),
      true
    )
    assert.equal(
      runtime.isRegularAnnualComponent({ regularAnnual: false }),
      false
    )
    assert.equal(
      runtime.isRegularAnnualComponent({}),
      false
    )
  }
)

test(
  'annual planned periods come from active schedule slots inside their validity window',
  () => {
    const plannedPeriods =
      runtime.calculateRegularAnnualPlannedPeriods({
        academicYear,
        assignment,
        slots: [
          slot({ id: 'mon', weekday: 1, periodCount: 2 }),
          slot({ id: 'wed', weekday: 3, periodCount: 1 }),
          slot({
            id: 'inactive',
            weekday: 5,
            periodCount: 9,
            active: false
          }),
          slot({
            id: 'other-assignment',
            weekday: 2,
            periodCount: 7,
            teachingAssignmentId: 'other'
          }),
          slot({
            id: 'outside-validity',
            weekday: 4,
            periodCount: 8,
            validFrom: '2026-09-21',
            validUntil: '2026-09-30'
          })
        ],
        events: []
      })

    assert.equal(plannedPeriods, 3)
  }
)

test(
  'blocking calendar events remove only affected teaching days from annual capacity',
  () => {
    const slots = [
      slot({ id: 'mon', weekday: 1, periodCount: 2 }),
      slot({ id: 'wed', weekday: 3, periodCount: 1 })
    ]

    assert.equal(
      runtime.calculateRegularAnnualPlannedPeriods({
        academicYear,
        assignment,
        slots,
        events: [
          event({
            id: 'holiday',
            date: '2026-09-14'
          })
        ]
      }),
      1
    )

    assert.equal(
      runtime.calculateRegularAnnualPlannedPeriods({
        academicYear,
        assignment,
        slots,
        events: [
          event({
            id: 'other-group',
            date: '2026-09-14',
            scope: 'group',
            groupId: 'another-group'
          })
        ]
      }),
      3
    )

    assert.equal(
      runtime.calculateRegularAnnualPlannedPeriods({
        academicYear,
        assignment,
        slots,
        events: [
          event({
            id: 'non-blocking',
            date: '2026-09-14',
            blocksLessons: false
          })
        ]
      }),
      3
    )
  }
)

test(
  'sync never creates annual components for professional or legacy groups',
  () => {
    assert.match(
      repositorySource,
      /!isRegularEducationGroup\(group\)[\s\S]*continue/
    )
  }
)

test(
  'sync preserves assignments that already contain explicit modules instead of converting them',
  () => {
    assert.match(
      repositorySource,
      /if \(\s*!annualComponent\s*\) \{[\s\S]*assignmentModules\.length > 0[\s\S]*skippedExplicitAssignments\.push[\s\S]*continue/
    )
    assert.doesNotMatch(
      repositorySource,
      /maProfessorDb\.modules\.(delete|clear|bulkDelete)\(/
    )
  }
)

test(
  'resync never reduces annual capacity below periods already taught',
  () => {
    assert.match(
      repositorySource,
      /Math\.max\([\s\S]*plannedFromSchedule[\s\S]*taughtPeriodsForModule\([\s\S]*annualComponent\.id[\s\S]*lessons[\s\S]*\)[\s\S]*1[\s\S]*\)/
    )
  }
)

test(
  'setup prepares regular curriculum after complete schedule coverage before progressing',
  () => {
    assert.match(
      setupWizardSource,
      /async function prepareRegularCurriculumAfterSchedule/
    )
    assert.match(
      setupWizardSource,
      /hasCompleteScheduleCoverage\(snapshot\)[\s\S]*syncRegularAnnualComponentsForAcademicYear/
    )
    assert.match(
      setupWizardSource,
      /handleStepCompleted[\s\S]*prepareRegularCurriculumAfterSchedule\([\s\S]*reconcileImportedScheduleProgress/
    )
    assert.match(
      setupWizardSource,
      /handleGuidedScheduleImported[\s\S]*prepareRegularCurriculumAfterSchedule\([\s\S]*reconcileImportedScheduleProgress/
    )
  }
)

test(
  'later schedule and calendar mutations recalculate regular annual capacity locally',
  () => {
    assert.match(
      scheduleWorkspaceSource,
      /await operation\(\)[\s\S]*await syncRegularAnnualComponentsForAcademicYear\([\s\S]*academicYearId[\s\S]*\)[\s\S]*await load\(\)/
    )
  }
)
