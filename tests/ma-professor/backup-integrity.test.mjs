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

const validationModule =
  await import(validationUrl)

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/backupRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dbStubUrl = transpile(`
  export const maProfessorDb = {};
  export async function openMAProfessorDatabase() {}
  export async function ensureDefaultMAProfessorSettings() {}
`)

const repositoryRuntimeSource =
  repositorySource
    .replaceAll(
      "'../db'",
      `'${dbStubUrl}'`
    )
    .replaceAll(
      "'./backupValidation'",
      `'${validationUrl}'`
    )

const repository = await import(
  transpile(repositoryRuntimeSource)
)

const stamp =
  '2026-09-05T08:00:00.000Z'

function audit() {
  return {
    createdAt: stamp,
    updatedAt: stamp
  }
}

function createValidData() {
  return {
    teacherProfiles: [
      {
        id: 'teacher-1',
        displayName: 'Professor',
        schoolName: 'Escola',
        ...audit()
      }
    ],
    academicYears: [
      {
        id: 'year-1',
        name: '2026/2027',
        startDate: '2026-09-01',
        endDate: '2027-07-31',
        active: true,
        setupCompletedAt: null,
        ...audit()
      }
    ],
    groups: [
      {
        id: 'group-1',
        academicYearId: 'year-1',
        name: '10.º D',
        courseName: 'TAP',
        gradeLevel: '10',
        active: true,
        ...audit()
      }
    ],
    subjects: [
      {
        id: 'subject-1',
        academicYearId: 'year-1',
        name: 'Animação',
        shortName: 'AE',
        code: 'AE',
        active: true,
        ...audit()
      }
    ],
    teachingAssignments: [
      {
        id: 'assignment-1',
        academicYearId: 'year-1',
        groupId: 'group-1',
        subjectId: 'subject-1',
        displayName: '10.º D — AE',
        active: true,
        ...audit()
      }
    ],
    modules: [
      {
        id: 'module-1',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        code: 'M1',
        name: 'Módulo 1',
        plannedPeriods: 20,
        order: 1,
        plannedStartDate: null,
        plannedEndDate: null,
        active: true,
        ...audit()
      }
    ],
    students: [
      {
        id: 'student-1',
        academicYearId: 'year-1',
        groupId: 'group-1',
        number: '1',
        name: 'Ana',
        active: true,
        notes: '',
        ...audit()
      }
    ],
    assessmentSchemes: [
      {
        id: 'scheme-1',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        moduleId: 'module-1',
        scope: 'module',
        name: 'Avaliação',
        active: true,
        ...audit()
      }
    ],
    assessmentCriteria: [
      {
        id: 'criterion-1',
        schemeId: 'scheme-1',
        name: 'Desempenho',
        description: '',
        weightPercent: 100,
        order: 1,
        active: true,
        ...audit()
      }
    ],
    planifications: [],
    planificationItems: [],
    weeklyScheduleSlots: [],
    schoolCalendarEvents: [],
    lessons: [
      {
        id: 'lesson-1',
        academicYearId: 'year-1',
        teachingAssignmentId: 'assignment-1',
        moduleId: 'module-1',
        scheduleSlotId: null,
        origin: 'extra',
        status: 'taught',
        date: '2026-09-05',
        startTime: '09:00',
        endTime: '10:00',
        periodCount: 1,
        countTowardProgress: true,
        plannedActivity: '',
        summary: 'Conteúdos da aula.',
        summarySource: 'manual',
        planificationItemIds: [],
        giaeStatus: 'pending',
        giaeSubmittedAt: null,
        notes: '',
        ...audit()
      }
    ],
    summarySuggestions: [],
    lessonAttendance: [
      {
        id: 'attendance-1',
        lessonId: 'lesson-1',
        studentId: 'student-1',
        status: 'present',
        code: '',
        note: '',
        ...audit()
      }
    ],
    lessonAssessments: [
      {
        id: 'assessment-1',
        academicYearId: 'year-1',
        lessonId: 'lesson-1',
        teachingAssignmentId: 'assignment-1',
        moduleId: 'module-1',
        criterionId: 'criterion-1',
        title: 'Trabalho',
        activityType: 'practical_work',
        description: '',
        absentScore: 0,
        exemptScore: 10,
        ...audit()
      }
    ],
    assessmentResults: [
      {
        id: 'result-1',
        assessmentId: 'assessment-1',
        studentId: 'student-1',
        status: 'evaluated',
        score: 18,
        note: '',
        ...audit()
      }
    ],
    moduleFinalGrades: [],
    learningRecoveries: [],
    settings: [
      {
        id: 'default',
        defaultPeriodMinutes: 50,
        defaultAbsentAssessmentScore: 0,
        defaultExemptAssessmentScore: 10,
        absenceWarningPercent: 8,
        learningRecoveryThresholdPercent: 10,
        weekStartsOn: 1,
        locale: 'pt-PT',
        theme: 'dark',
        ...audit()
      }
    ],
    setupProgress: [
      {
        id: 'setup-1',
        academicYearId: 'year-1',
        currentStep: 'confirmation',
        completedSteps: [
          'academic_year',
          'groups',
          'subjects'
        ],
        completedAt: null,
        ...audit()
      }
    ]
  }
}

function createBackup(data = createValidData()) {
  return {
    product: 'ma-professor',
    schemaVersion: 1,
    exportedAt: stamp,
    data
  }
}

function errorMessages(result) {
  return result.issues
    .filter(issue => issue.severity === 'error')
    .map(issue => `${issue.path}: ${issue.message}`)
}

test(
  'a coherent schema v1 backup passes deep validation',
  () => {
    const result =
      repository.validateMAProfessorBackup(
        createBackup()
      )

    assert.equal(
      result.valid,
      true,
      errorMessages(result).join('\n')
    )
  }
)

test(
  'duplicate primary IDs block restore validation',
  () => {
    const data = createValidData()
    data.students.push({
      ...structuredClone(data.students[0]),
      name: 'Outro aluno'
    })

    const result =
      repository.validateMAProfessorBackup(
        createBackup(data)
      )

    assert.equal(result.valid, false)
    assert.match(
      errorMessages(result).join('\n'),
      /duplicado/i
    )
  }
)

test(
  'broken foreign references block restore validation',
  () => {
    const data = createValidData()
    data.students[0].groupId =
      'group-inexistente'

    const result =
      repository.validateMAProfessorBackup(
        createBackup(data)
      )

    assert.equal(result.valid, false)
    assert.match(
      errorMessages(result).join('\n'),
      /não existe em turmas/i
    )
  }
)

test(
  'invalid grades, enums and taught lessons without summary are rejected',
  () => {
    const data = createValidData()
    data.assessmentResults[0].score = 25
    data.assessmentResults[0].status =
      'invented'
    data.lessons[0].summary = '   '

    const result =
      repository.validateMAProfessorBackup(
        createBackup(data)
      )

    const errors =
      errorMessages(result).join('\n')

    assert.equal(result.valid, false)
    assert.match(errors, /entre 0 e 20/i)
    assert.match(errors, /Valor inválido/i)
    assert.match(errors, /aula dada tem de ter sumário/i)
  }
)

test(
  'duplicate lesson-student attendance pairs are rejected',
  () => {
    const data = createValidData()
    data.lessonAttendance.push({
      ...structuredClone(
        data.lessonAttendance[0]
      ),
      id: 'attendance-2'
    })

    const result =
      repository.validateMAProfessorBackup(
        createBackup(data)
      )

    assert.equal(result.valid, false)
    assert.match(
      errorMessages(result).join('\n'),
      /mesma aula e o mesmo aluno/i
    )
  }
)

test(
  'restore still validates before opening or clearing the local database',
  () => {
    const validationPosition =
      repositorySource.indexOf(
        'const validation = validateMAProfessorBackup(backup)'
      )
    const openPosition =
      repositorySource.indexOf(
        'await openMAProfessorDatabase()',
        repositorySource.indexOf(
          'export async function restoreMAProfessorBackup'
        )
      )
    const clearPosition =
      repositorySource.indexOf(
        'await clearAllTables()',
        repositorySource.indexOf(
          'export async function restoreMAProfessorBackup'
        )
      )

    assert.ok(validationPosition >= 0)
    assert.ok(openPosition >= 0)
    assert.ok(clearPosition >= 0)
    assert.ok(validationPosition < openPosition)
    assert.ok(validationPosition < clearPosition)
    assert.match(
      repositorySource,
      /validateMAProfessorBackupDataIntegrity/
    )
  }
)
