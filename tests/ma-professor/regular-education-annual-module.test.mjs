import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const [
  regularEducationSource,
  regularPolicySource,
  guardSource,
  reconciliationSource,
  initialCalendarSource
] = await Promise.all([
  readFile(
    new URL(
      '../../src/components/ma-professor/setup/regularEducationModules.ts',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/modules/regularAnnualModule.ts',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/setup/ModulesSetupCourseSubjectGuard.tsx',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/lessons/scheduledLessonReconciliation.ts',
      import.meta.url
    ),
    'utf8'
  ),
  readFile(
    new URL(
      '../../src/components/ma-professor/calendar/initialSchoolCalendar2026_2027.ts',
      import.meta.url
    ),
    'utf8'
  )
])

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors =
    (output.diagnostics || []).filter(
      diagnostic =>
        diagnostic.category ===
          ts.DiagnosticCategory.Error
    )

  assert.equal(
    errors.length,
    0,
    errors.map(diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
    ).join('\n')
  )

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

async function loadReconciliationPolicy() {
  return import(
    transpile(
      reconciliationSource
    )
  )
}

function assignment() {
  return {
    id: 'assignment-1',
    academicYearId: 'year-1',
    groupId: 'group-1',
    subjectId: 'subject-1',
    displayName: 'Matemática · 5.º A',
    active: true
  }
}

function slot() {
  return {
    id: 'slot-1',
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    weekday: 1,
    startTime: '09:00',
    endTime: '10:00',
    periodCount: 1,
    validFrom: '2026-09-01',
    validUntil: '2027-07-31',
    active: true
  }
}

function reconciliationInput(module) {
  return {
    academicYear: {
      id: 'year-1',
      startDate: '2026-09-01',
      endDate: '2027-07-31'
    },
    assignments: [assignment()],
    slots: [slot()],
    modules: [module],
    events: [],
    lessons: [],
    relatedLessonIds: new Set(),
    dateFrom: '2026-09-14',
    dateTo: '2026-09-27'
  }
}

test(
  'regular education uses an explicit internal annual component without inventing a planned workload',
  () => {
    assert.match(
      regularPolicySource,
      /'regular_annual'/
    )
    assert.match(
      regularEducationSource,
      /moduleKind:\s*REGULAR_ANNUAL_MODULE_KIND/
    )
    assert.match(
      regularEducationSource,
      /plannedPeriods:\s*0/
    )
    assert.match(
      regularEducationSource,
      /group\.educationType ===\s*'regular'/
    )
  }
)

test(
  'existing active curricular modules are preserved instead of being replaced or duplicated',
  () => {
    assert.match(
      regularEducationSource,
      /assignmentModules\.some\(\s*module => module\.active\s*\)[\s\S]*?continue/
    )
    assert.doesNotMatch(
      regularEducationSource,
      /modules\.clear\(|modules\.delete\(/
    )
  }
)

test(
  'the module setup guard removes regular assignments from the visible UFCD workflow and auto-completes regular-only setups',
  () => {
    assert.match(
      guardSource,
      /getProfessionalAssignments\(/
    )
    assert.match(
      guardSource,
      /Ensino regular não precisa de criar UFCD ou módulos|No ensino regular não precisa de criar UFCD ou módulos/
    )
    assert.match(
      guardSource,
      /completeSetupStep\([\s\S]*?'modules'/
    )
    assert.match(
      guardSource,
      /professionalAssignmentIds\.has\([\s\S]*?assignment\.id/
    )
  }
)

test(
  'a regular annual component is unbounded for scheduled lesson progress',
  async () => {
    const policy =
      await loadReconciliationPolicy()

    const plan =
      policy.planScheduledLessonReconciliation(
        reconciliationInput({
          id: 'module-regular',
          academicYearId: 'year-1',
          teachingAssignmentId: 'assignment-1',
          code: '',
          name: 'Matemática',
          plannedPeriods: 0,
          order: 1,
          plannedStartDate: null,
          plannedEndDate: null,
          active: true,
          moduleKind: 'regular_annual'
        })
      )

    assert.equal(
      plan.createLessons.length,
      2
    )
    assert.equal(
      plan.skippedWithoutModule,
      0
    )
    assert.equal(
      plan.createdOutsidePlannedCapacity,
      0
    )
    assert.deepEqual(
      plan.createLessons.map(
        lesson =>
          lesson.countTowardProgress
      ),
      [true, true]
    )
    assert.deepEqual(
      plan.createLessons.map(
        lesson =>
          lesson.moduleId
      ),
      [
        'module-regular',
        'module-regular'
      ]
    )
  }
)

test(
  'professional module capacity semantics remain unchanged',
  async () => {
    const policy =
      await loadReconciliationPolicy()

    const plan =
      policy.planScheduledLessonReconciliation(
        reconciliationInput({
          id: 'module-professional',
          academicYearId: 'year-1',
          teachingAssignmentId: 'assignment-1',
          code: '10385',
          name: 'UFCD 10385',
          plannedPeriods: 1,
          order: 1,
          plannedStartDate: null,
          plannedEndDate: null,
          active: true
        })
      )

    assert.equal(
      plan.createLessons.length,
      2
    )
    assert.equal(
      plan.createdOutsidePlannedCapacity,
      1
    )
    assert.deepEqual(
      plan.createLessons.map(
        lesson =>
          lesson.countTowardProgress
      ),
      [true, false]
    )
  }
)

test(
  'the S. Bento secondary preset skips regular groups and generates only assignment-scoped professional lessons',
  () => {
    assert.match(
      initialCalendarSource,
      /group\.educationType ===\s*'regular'[\s\S]*?continue/
    )
    assert.match(
      initialCalendarSource,
      /generateProfessionalPresetLessons/
    )
    assert.match(
      initialCalendarSource,
      /lessonRepository\.generateScheduledLessons\(\{[\s\S]*?teachingAssignmentId/[\s\S]*?dateTo/
    )
  }
)
