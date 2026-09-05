import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category ===
      ts.DiagnosticCategory.Error
  )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
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

const validationSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/backupValidation.ts',
    import.meta.url
  ),
  'utf8'
)

const validationUrl =
  transpile(validationSource)

const integritySource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/snapshotIntegrityValidation.ts',
    import.meta.url
  ),
  'utf8'
)

const integrityRuntime =
  integritySource.replaceAll(
    "'../settings/backupValidation'",
    `'${validationUrl}'`
  )

const integrityModule = await import(
  transpile(integrityRuntime)
)

const {
  assertMAProfessorSnapshotDataIntegrity,
  MAProfessorSnapshotIntegrityError
} = integrityModule

function createEmptyTables() {
  return {
    teacherProfiles: [],
    academicYears: [],
    groups: [],
    subjects: [],
    teachingAssignments: [],
    modules: [],
    students: [],
    assessmentSchemes: [],
    assessmentCriteria: [],
    planifications: [],
    planificationItems: [],
    weeklyScheduleSlots: [],
    schoolCalendarEvents: [],
    lessons: [],
    summarySuggestions: [],
    lessonAttendance: [],
    lessonAssessments: [],
    assessmentResults: [],
    moduleFinalGrades: [],
    learningRecoveries: [],
    settings: [],
    setupProgress: []
  }
}

const stamp =
  '2026-09-05T09:00:00.000Z'

test(
  'structurally complete snapshot data with no blocking integrity issues is accepted',
  () => {
    assert.doesNotThrow(() =>
      assertMAProfessorSnapshotDataIntegrity(
        createEmptyTables()
      )
    )
  }
)

test(
  'a broken foreign reference blocks an online snapshot',
  () => {
    const tables =
      createEmptyTables()

    tables.groups.push({
      id: 'group-1',
      academicYearId: 'missing-year',
      name: '10.º D',
      courseName: 'TAP',
      gradeLevel: '10',
      active: true,
      createdAt: stamp,
      updatedAt: stamp
    })

    assert.throws(
      () =>
        assertMAProfessorSnapshotDataIntegrity(
          tables
        ),
      error => {
        assert.ok(
          error instanceof
            MAProfessorSnapshotIntegrityError
        )
        assert.ok(
          error.issues.some(
            issue =>
              issue.path.includes(
                'groups[0].academicYearId'
              )
          )
        )
        return true
      }
    )
  }
)

test(
  'an invalid score in snapshot settings is rejected',
  () => {
    const tables =
      createEmptyTables()

    tables.settings.push({
      id: 'default',
      defaultPeriodMinutes: 50,
      defaultAbsentAssessmentScore: 21,
      defaultExemptAssessmentScore: 10,
      absenceWarningPercent: 8,
      learningRecoveryThresholdPercent: 10,
      weekStartsOn: 1,
      locale: 'pt-PT',
      theme: 'dark',
      createdAt: stamp,
      updatedAt: stamp
    })

    assert.throws(
      () =>
        assertMAProfessorSnapshotDataIntegrity(
          tables
        ),
      error => {
        assert.ok(
          error instanceof
            MAProfessorSnapshotIntegrityError
        )
        assert.ok(
          error.issues.some(
            issue =>
              issue.path.includes(
                'defaultAbsentAssessmentScore'
              )
          )
        )
        return true
      }
    )
  }
)

test(
  'warning-only backup integrity findings do not block an online snapshot',
  () => {
    const tables =
      createEmptyTables()

    tables.teacherProfiles.push({
      id: 'teacher-1',
      displayName: 'Professor',
      schoolName: 'Escola'
    })

    assert.doesNotThrow(() =>
      assertMAProfessorSnapshotDataIntegrity(
        tables
      )
    )
  }
)

const snapshotServiceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/databaseSnapshotService.ts',
    import.meta.url
  ),
  'utf8'
)

test(
  'database snapshot validation applies deep integrity checks before accepting or restoring data',
  () => {
    const integrityPosition =
      snapshotServiceSource.indexOf(
        'assertMAProfessorSnapshotDataIntegrity('
      )

    const acceptedPosition =
      snapshotServiceSource.indexOf(
        'return snapshot',
        integrityPosition
      )

    const restoreFunctionPosition =
      snapshotServiceSource.indexOf(
        'export async function restoreMAProfessorDatabaseSnapshot('
      )

    const restoreValidationPosition =
      snapshotServiceSource.indexOf(
        'validateDatabaseSnapshot(',
        restoreFunctionPosition
      )

    const restoreDatabaseOpenPosition =
      snapshotServiceSource.indexOf(
        'openMAProfessorDatabase()',
        restoreValidationPosition
      )

    assert.ok(integrityPosition >= 0)
    assert.ok(acceptedPosition > integrityPosition)
    assert.ok(restoreFunctionPosition >= 0)
    assert.ok(restoreValidationPosition > restoreFunctionPosition)
    assert.ok(
      restoreDatabaseOpenPosition >
        restoreValidationPosition,
      'A integridade deve ser validada antes de abrir a base para restauro.'
    )
  }
)
