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

const repositorySource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/backupRepository.ts',
    import.meta.url
  ),
  'utf8'
)

const dbSource = await readFile(
  new URL(
    '../../src/components/ma-professor/db.ts',
    import.meta.url
  ),
  'utf8'
)

const dbStubUrl = transpile(`
  const TABLE_NAMES = [
    'teacherProfiles',
    'academicYears',
    'groups',
    'subjects',
    'teachingAssignments',
    'modules',
    'students',
    'assessmentSchemes',
    'assessmentCriteria',
    'planifications',
    'planificationItems',
    'weeklyScheduleSlots',
    'schoolCalendarEvents',
    'lessons',
    'summarySuggestions',
    'lessonAttendance',
    'lessonAssessments',
    'assessmentResults',
    'moduleFinalGrades',
    'learningRecoveries',
    'settings',
    'setupProgress'
  ];

  function state() {
    const current = globalThis.__backupRepositoryDbTest;

    if (!current) {
      throw new Error('backup db test state not initialized');
    }

    return current;
  }

  function clone(value) {
    return structuredClone(value);
  }

  function table(name) {
    return {
      name,

      async toArray() {
        return clone(state().data[name] || []);
      },

      async clear() {
        const current = state();
        current.operations.push({
          kind: 'clear',
          table: name,
          inTransaction: current.transactionDepth > 0
        });
        current.data[name] = [];
      },

      async bulkPut(records) {
        const current = state();
        current.operations.push({
          kind: 'bulkPut',
          table: name,
          inTransaction: current.transactionDepth > 0
        });

        if (current.failBulkPutTable === name) {
          throw new Error('simulated bulkPut failure: ' + name);
        }

        const next = new Map(
          (current.data[name] || []).map(record => [record.id, clone(record)])
        );

        for (const record of records) {
          next.set(record.id, clone(record));
        }

        current.data[name] = [...next.values()];
      },

      async get(id) {
        const current = state();
        const found = (current.data[name] || [])
          .find(record => record.id === id);

        return typeof found === 'undefined'
          ? undefined
          : clone(found);
      },

      async put(record) {
        const current = state();
        const inTransaction = current.transactionDepth > 0;

        current.operations.push({
          kind: 'put',
          table: name,
          id: record.id,
          inTransaction
        });

        if (
          name === 'settings' &&
          record.id === 'default'
        ) {
          current.defaultSettingsPutCalls += 1;
          current.defaultSettingsPutInsideTransaction = inTransaction;

          if (current.failDefaultSettingsPut) {
            throw new Error('simulated default settings finalization failure');
          }
        }

        const next = new Map(
          (current.data[name] || []).map(item => [item.id, clone(item)])
        );

        next.set(record.id, clone(record));
        current.data[name] = [...next.values()];
      }
    };
  }

  export const MA_PROFESSOR_DEFAULT_SETTINGS_ID = 'default';

  export function createDefaultMAProfessorSettings(
    timestamp = '2026-09-06T12:00:00.000Z'
  ) {
    state().defaultSettingsCreateCalls += 1;

    return {
      id: MA_PROFESSOR_DEFAULT_SETTINGS_ID,
      defaultPeriodMinutes: 50,
      defaultAbsentAssessmentScore: 0,
      defaultExemptAssessmentScore: 10,
      absenceWarningPercent: 8,
      learningRecoveryThresholdPercent: 10,
      weekStartsOn: 1,
      locale: 'pt-PT',
      theme: 'dark',
      createdAt: timestamp,
      updatedAt: timestamp
    };
  }

  export const maProfessorDb = {};

  for (const name of TABLE_NAMES) {
    maProfessorDb[name] = table(name);
  }

  maProfessorDb.tables = TABLE_NAMES.map(
    name => maProfessorDb[name]
  );

  maProfessorDb.transaction = async function(
    mode,
    tables,
    callback
  ) {
    const current = state();
    const before = clone(current.data);

    current.transactionCalls += 1;
    current.transactionModes.push(mode);
    current.transactionDepth += 1;

    try {
      const result = await callback();
      current.commits += 1;
      return result;
    } catch (error) {
      current.data = before;
      current.rollbacks += 1;
      throw error;
    } finally {
      current.transactionDepth -= 1;
    }
  };

  export async function openMAProfessorDatabase() {
    state().openCalls += 1;
    return maProfessorDb;
  }
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

const tableNames = [
  'teacherProfiles',
  'academicYears',
  'groups',
  'subjects',
  'teachingAssignments',
  'modules',
  'students',
  'assessmentSchemes',
  'assessmentCriteria',
  'planifications',
  'planificationItems',
  'weeklyScheduleSlots',
  'schoolCalendarEvents',
  'lessons',
  'summarySuggestions',
  'lessonAttendance',
  'lessonAssessments',
  'assessmentResults',
  'moduleFinalGrades',
  'learningRecoveries',
  'settings',
  'setupProgress'
]

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

function emptyDatabaseData() {
  return Object.fromEntries(
    tableNames.map(name => [name, []])
  )
}

function resetDatabaseHarness({
  data = emptyDatabaseData(),
  failDefaultSettingsPut = false,
  failBulkPutTable = null
} = {}) {
  globalThis.__backupRepositoryDbTest = {
    data: structuredClone(data),
    operations: [],
    transactionCalls: 0,
    transactionModes: [],
    transactionDepth: 0,
    commits: 0,
    rollbacks: 0,
    openCalls: 0,
    defaultSettingsCreateCalls: 0,
    defaultSettingsPutCalls: 0,
    defaultSettingsPutInsideTransaction: false,
    failDefaultSettingsPut,
    failBulkPutTable
  }

  return globalThis.__backupRepositoryDbTest
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

test(
  'restore preserves valid backup data and existing backup settings exactly',
  async () => {
    const backupData =
      createValidData()

    backupData.settings[0] = {
      ...backupData.settings[0],
      defaultPeriodMinutes: 90,
      theme: 'system',
      updatedAt: '2026-09-05T09:30:00.000Z'
    }

    const harness =
      resetDatabaseHarness({
        data: {
          ...emptyDatabaseData(),
          students: [
            {
              id: 'old-student',
              marker: 'must-be-replaced'
            }
          ],
          settings: [
            {
              id: 'default',
              marker: 'old-settings'
            }
          ]
        }
      })

    await repository.restoreMAProfessorBackup(
      createBackup(backupData)
    )

    assert.deepEqual(
      harness.data,
      backupData,
      'Um backup válido deve ser restaurado sem substituir as settings que já vêm no próprio backup.'
    )
    assert.equal(
      harness.defaultSettingsCreateCalls,
      0,
      'Settings válidas presentes no backup não devem ser recriadas.'
    )
    assert.equal(
      harness.defaultSettingsPutCalls,
      0,
      'Settings válidas presentes no backup não devem ser sobrescritas por defaults.'
    )
    assert.equal(harness.commits, 1)
    assert.equal(harness.rollbacks, 0)
  }
)

test(
  'restore creates missing default settings inside the same transaction',
  async () => {
    const backupData =
      createValidData()

    backupData.settings = []

    const harness =
      resetDatabaseHarness()

    await repository.restoreMAProfessorBackup(
      createBackup(backupData)
    )

    assert.equal(harness.transactionCalls, 1)
    assert.deepEqual(
      harness.transactionModes,
      ['rw']
    )
    assert.equal(
      harness.defaultSettingsCreateCalls,
      1
    )
    assert.equal(
      harness.defaultSettingsPutCalls,
      1
    )
    assert.equal(
      harness.defaultSettingsPutInsideTransaction,
      true,
      'A criação das settings por defeito tem de participar na mesma transação do restauro.'
    )
    assert.equal(
      harness.data.settings.length,
      1
    )
    assert.equal(
      harness.data.settings[0].id,
      'default'
    )
    assert.deepEqual(
      harness.data.students,
      backupData.students,
      'A criação das settings em falta não pode alterar outros dados válidos do backup.'
    )
    assert.equal(harness.commits, 1)
    assert.equal(harness.rollbacks, 0)
  }
)

test(
  'restore rolls back completely when default-settings finalization fails',
  async () => {
    const initialData = {
      ...emptyDatabaseData(),
      students: [
        {
          id: 'local-before',
          marker: 'preserve-on-failure'
        }
      ],
      lessons: [
        {
          id: 'lesson-before',
          marker: 'preserve-on-failure'
        }
      ],
      settings: [
        {
          id: 'default',
          marker: 'settings-before'
        }
      ]
    }

    const backupData =
      createValidData()

    backupData.settings = []

    const harness =
      resetDatabaseHarness({
        data: initialData,
        failDefaultSettingsPut: true
      })

    await assert.rejects(
      () =>
        repository.restoreMAProfessorBackup(
          createBackup(backupData)
        ),
      /simulated default settings finalization failure/
    )

    assert.deepEqual(
      harness.data,
      initialData,
      'Uma falha na finalização não pode deixar o backup parcialmente aplicado nem destruir o estado anterior.'
    )
    assert.equal(
      harness.defaultSettingsPutInsideTransaction,
      true
    )
    assert.equal(harness.commits, 0)
    assert.equal(harness.rollbacks, 1)
  }
)

test(
  'restore rolls back completely when a backup table write fails midway',
  async () => {
    const initialData = {
      ...emptyDatabaseData(),
      teacherProfiles: [
        {
          id: 'teacher-before',
          marker: 'preserve-on-failure'
        }
      ],
      students: [
        {
          id: 'student-before',
          marker: 'preserve-on-failure'
        }
      ],
      settings: [
        {
          id: 'default',
          marker: 'settings-before'
        }
      ]
    }

    const harness =
      resetDatabaseHarness({
        data: initialData,
        failBulkPutTable: 'students'
      })

    await assert.rejects(
      () =>
        repository.restoreMAProfessorBackup(
          createBackup()
        ),
      /simulated bulkPut failure: students/
    )

    assert.deepEqual(
      harness.data,
      initialData,
      'Uma falha a meio dos bulkPut tem de reverter clears e escritas já efetuadas na transação.'
    )
    assert.equal(harness.commits, 0)
    assert.equal(harness.rollbacks, 1)
  }
)

test(
  'reset leaves one valid default settings record and no pedagogical data',
  async () => {
    const harness =
      resetDatabaseHarness({
        data: createValidData()
      })

    await repository.resetMAProfessorDatabase()

    for (const tableName of tableNames) {
      if (tableName === 'settings') {
        continue
      }

      assert.deepEqual(
        harness.data[tableName],
        [],
        `${tableName} deve ficar vazia após reset.`
      )
    }

    assert.equal(
      harness.data.settings.length,
      1
    )
    assert.deepEqual(
      harness.data.settings[0],
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
        createdAt: '2026-09-06T12:00:00.000Z',
        updatedAt: '2026-09-06T12:00:00.000Z'
      }
    )
    assert.equal(
      harness.defaultSettingsPutInsideTransaction,
      true
    )
    assert.equal(harness.commits, 1)
    assert.equal(harness.rollbacks, 0)
  }
)

test(
  'backup repository uses existing db exports without introducing a reverse dependency from db.ts',
  () => {
    assert.match(
      repositorySource,
      /createDefaultMAProfessorSettings/
    )
    assert.match(
      repositorySource,
      /MA_PROFESSOR_DEFAULT_SETTINGS_ID/
    )
    assert.doesNotMatch(
      dbSource,
      /settings\/backupRepository/
    )
    assert.doesNotMatch(
      dbSource,
      /backupRepository/
    )
  }
)
