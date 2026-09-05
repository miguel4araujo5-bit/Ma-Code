import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'
import {
  unzlibSync,
  zlibSync
} from 'fflate'

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

function extractIntegerConstant(
  source,
  name
) {
  const match =
    source.match(
      new RegExp(
        `const\\s+${name}\\s*=\\s*([0-9_]+)`
      )
    )

  assert.ok(
    match,
    `Não foi possível localizar ${name}.`
  )

  return Number(
    match[1].replaceAll('_', '')
  )
}

const snapshotServiceSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/databaseSnapshotService.ts',
    import.meta.url
  ),
  'utf8'
)

const snapshotApiSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/snapshotApi.ts',
    import.meta.url
  ),
  'utf8'
)

const workerSnapshotSource = await readFile(
  new URL(
    '../../worker/maProfessorSnapshot.ts',
    import.meta.url
  ),
  'utf8'
)

const clientMaxBodyBytes =
  extractIntegerConstant(
    snapshotApiSource,
    'MAX_BODY_BYTES'
  )

const workerMaxBodyBytes =
  extractIntegerConstant(
    workerSnapshotSource,
    'MAX_BODY_BYTES'
  )

const workerMaxCiphertextCharacters =
  extractIntegerConstant(
    workerSnapshotSource,
    'MAX_CIPHERTEXT_CHARACTERS'
  )

assert.equal(
  clientMaxBodyBytes,
  workerMaxBodyBytes,
  'Cliente e Worker devem manter o mesmo limite de corpo JSON.'
)

globalThis.__maProfessorCapacityFflate = {
  unzlibSync,
  zlibSync
}

const dbStub = transpile(`
  export const MA_PROFESSOR_DATABASE_NAME = 'ma-professor';
  export const MA_PROFESSOR_DATABASE_VERSION = 1;
  export async function openMAProfessorDatabase() {
    throw new Error('unused in capacity test');
  }
`)

const cryptoDependencyStub = transpile(`
  export async function decryptMAProfessorRecord() { throw new Error('unused'); }
  export async function decryptMAProfessorRecordBytes() { throw new Error('unused'); }
  export async function encryptMAProfessorRecordBytes() { throw new Error('unused'); }
`)

const cryptoStorageStub = transpile(`
  export async function unlockMAProfessorLocalMasterKey() {
    throw new Error('unused');
  }
`)

const snapshotApiStub = transpile(`
  export async function getMAProfessorEncryptedSnapshot() { throw new Error('unused'); }
  export async function pushMAProfessorEncryptedSnapshot() { throw new Error('unused'); }
`)

const integrityStub = transpile(`
  export function assertMAProfessorSnapshotDataIntegrity() {}
`)

const snapshotServiceRuntime =
  snapshotServiceSource
    .replace(
      /import\s*\{\s*unzlibSync,\s*zlibSync\s*\}\s*from\s*'fflate'/,
      `const { unzlibSync, zlibSync } = globalThis.__maProfessorCapacityFflate`
    )
    .replaceAll(
      "'../db'",
      `'${dbStub}'`
    )
    .replaceAll(
      "'./cryptoService'",
      `'${cryptoDependencyStub}'`
    )
    .replaceAll(
      "'./cryptoStorage'",
      `'${cryptoStorageStub}'`
    )
    .replaceAll(
      "'./snapshotApi'",
      `'${snapshotApiStub}'`
    )
    .replaceAll(
      "'./snapshotIntegrityValidation'",
      `'${integrityStub}'`
    )
    .replace(
      'async function createCompressedSnapshotPayload(',
      'export async function createCompressedSnapshotPayload('
    )

const snapshotServiceModule = await import(
  transpile(snapshotServiceRuntime)
)

const cryptoSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/cryptoService.ts',
    import.meta.url
  ),
  'utf8'
)

const cryptoModule = await import(
  transpile(cryptoSource)
)

const cryptoMaterial =
  await cryptoModule.createMAProfessorCryptoMaterial(
    'capacity-test-device'
  )

const stamp =
  '2026-09-05T10:00:00.000Z'

function audit() {
  return {
    createdAt: stamp,
    updatedAt: stamp
  }
}

function deterministicText(
  seed,
  length
) {
  let state =
    (seed * 2654435761) >>> 0

  let output = ''

  while (
    output.length < length
  ) {
    state =
      (
        Math.imul(
          state ^ (state >>> 15),
          2246822519
        ) +
        3266489917
      ) >>> 0

    output +=
      `${state.toString(36)}-${(
        state ^ (seed * 97)
      ).toString(36)} `
  }

  return output.slice(0, length)
}

function createSnapshotScenario({
  name,
  groups,
  studentsPerGroup,
  lessonsPerGroup,
  assessmentsPerGroup,
  summaryChars,
  noteChars,
  planificationItemsPerGroup
}) {
  const tables = {
    teacherProfiles: [
      {
        id: 'teacher-1',
        displayName: 'Professor de teste',
        schoolName: 'Escola de teste',
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
        setupCompletedAt: stamp,
        ...audit()
      }
    ],
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
          'subjects',
          'modules',
          'assessment_criteria',
          'planifications',
          'weekly_schedule',
          'students',
          'confirmation'
        ],
        completedAt: stamp,
        ...audit()
      }
    ]
  }

  let textSeed = 1

  for (
    let groupIndex = 0;
    groupIndex < groups;
    groupIndex += 1
  ) {
    const groupId =
      `group-${groupIndex + 1}`
    const subjectId =
      `subject-${groupIndex + 1}`
    const assignmentId =
      `assignment-${groupIndex + 1}`
    const moduleId =
      `module-${groupIndex + 1}`
    const schemeId =
      `scheme-${groupIndex + 1}`
    const criterionId =
      `criterion-${groupIndex + 1}`
    const planificationId =
      `planification-${groupIndex + 1}`
    const scheduleId =
      `schedule-${groupIndex + 1}`

    tables.groups.push({
      id: groupId,
      academicYearId: 'year-1',
      name: `${10 + (groupIndex % 3)}.º ${String.fromCharCode(65 + (groupIndex % 26))}`,
      courseName:
        `Curso ${deterministicText(textSeed++, 42)}`,
      gradeLevel:
        String(10 + (groupIndex % 3)),
      active: true,
      ...audit()
    })

    tables.subjects.push({
      id: subjectId,
      academicYearId: 'year-1',
      name:
        `Disciplina ${deterministicText(textSeed++, 36)}`,
      shortName:
        `D${groupIndex + 1}`,
      code:
        `SUB-${groupIndex + 1}`,
      active: true,
      ...audit()
    })

    tables.teachingAssignments.push({
      id: assignmentId,
      academicYearId: 'year-1',
      groupId,
      subjectId,
      displayName:
        `Atribuição ${deterministicText(textSeed++, 44)}`,
      active: true,
      ...audit()
    })

    tables.modules.push({
      id: moduleId,
      academicYearId: 'year-1',
      teachingAssignmentId: assignmentId,
      code: `M${groupIndex + 1}`,
      name:
        `Módulo ${deterministicText(textSeed++, 48)}`,
      plannedPeriods:
        lessonsPerGroup,
      order: 1,
      plannedStartDate: '2026-09-01',
      plannedEndDate: '2027-06-30',
      active: true,
      ...audit()
    })

    tables.assessmentSchemes.push({
      id: schemeId,
      academicYearId: 'year-1',
      teachingAssignmentId: assignmentId,
      moduleId,
      scope: 'module',
      name: 'Avaliação do módulo',
      active: true,
      ...audit()
    })

    tables.assessmentCriteria.push({
      id: criterionId,
      schemeId,
      name: 'Desempenho',
      description:
        deterministicText(textSeed++, 90),
      weightPercent: 100,
      order: 1,
      active: true,
      ...audit()
    })

    tables.planifications.push({
      id: planificationId,
      academicYearId: 'year-1',
      teachingAssignmentId: assignmentId,
      moduleId,
      title:
        `Planificação ${deterministicText(textSeed++, 42)}`,
      description:
        deterministicText(textSeed++, 180),
      active: true,
      ...audit()
    })

    for (
      let itemIndex = 0;
      itemIndex < planificationItemsPerGroup;
      itemIndex += 1
    ) {
      tables.planificationItems.push({
        id:
          `plan-item-${groupIndex + 1}-${itemIndex + 1}`,
        planificationId,
        order:
          itemIndex + 1,
        content:
          deterministicText(textSeed++, 150),
        activity:
          deterministicText(textSeed++, 130),
        objectives:
          deterministicText(textSeed++, 120),
        suggestedSummary:
          deterministicText(textSeed++, summaryChars),
        status: 'planned',
        usedLessonId: null,
        usedAt: null,
        ...audit()
      })
    }

    tables.weeklyScheduleSlots.push({
      id: scheduleId,
      academicYearId: 'year-1',
      teachingAssignmentId: assignmentId,
      weekday:
        (groupIndex % 5) + 1,
      startTime: '09:00',
      endTime: '09:50',
      periodCount: 1,
      validFrom: '2026-09-01',
      validUntil: '2027-06-30',
      active: true,
      ...audit()
    })

    const studentIds = []

    for (
      let studentIndex = 0;
      studentIndex < studentsPerGroup;
      studentIndex += 1
    ) {
      const studentId =
        `student-${groupIndex + 1}-${studentIndex + 1}`

      studentIds.push(studentId)

      tables.students.push({
        id: studentId,
        academicYearId: 'year-1',
        groupId,
        number:
          String(studentIndex + 1),
        name:
          `Aluno ${groupIndex + 1}-${studentIndex + 1} ${deterministicText(textSeed++, 34)}`,
        active: true,
        notes:
          deterministicText(textSeed++, noteChars),
        ...audit()
      })
    }

    for (
      let lessonIndex = 0;
      lessonIndex < lessonsPerGroup;
      lessonIndex += 1
    ) {
      const lessonId =
        `lesson-${groupIndex + 1}-${lessonIndex + 1}`

      tables.lessons.push({
        id: lessonId,
        academicYearId: 'year-1',
        teachingAssignmentId: assignmentId,
        moduleId,
        scheduleSlotId: scheduleId,
        origin: 'scheduled',
        status: 'taught',
        date:
          `2026-${String(9 + ((lessonIndex / 28) | 0) % 4).padStart(2, '0')}-${String(1 + (lessonIndex % 28)).padStart(2, '0')}`,
        startTime: '09:00',
        endTime: '09:50',
        periodCount: 1,
        countTowardProgress: true,
        plannedActivity:
          deterministicText(textSeed++, 90),
        summary:
          deterministicText(textSeed++, summaryChars),
        summarySource: 'manual',
        planificationItemIds: [],
        giaeStatus:
          lessonIndex % 3 === 0
            ? 'submitted'
            : 'pending',
        giaeSubmittedAt:
          lessonIndex % 3 === 0
            ? stamp
            : null,
        notes:
          deterministicText(textSeed++, noteChars),
        ...audit()
      })

      if (
        lessonIndex % 4 === 0
      ) {
        tables.summarySuggestions.push({
          id:
            `suggestion-${groupIndex + 1}-${lessonIndex + 1}`,
          lessonId,
          text:
            deterministicText(textSeed++, summaryChars),
          variant: 'formal',
          generatedAt: stamp,
          acceptedAt:
            lessonIndex % 8 === 0
              ? stamp
              : null
        })
      }

      for (
        let studentIndex = 0;
        studentIndex < studentIds.length;
        studentIndex += 1
      ) {
        tables.lessonAttendance.push({
          id:
            `attendance-${groupIndex + 1}-${lessonIndex + 1}-${studentIndex + 1}`,
          lessonId,
          studentId:
            studentIds[studentIndex],
          status:
            (lessonIndex + studentIndex) % 17 === 0
              ? 'absent'
              : 'present',
          code:
            (lessonIndex + studentIndex) % 17 === 0
              ? 'F'
              : '',
          note:
            (lessonIndex + studentIndex) % 31 === 0
              ? deterministicText(textSeed++, noteChars)
              : '',
          ...audit()
        })
      }
    }

    for (
      let assessmentIndex = 0;
      assessmentIndex < assessmentsPerGroup;
      assessmentIndex += 1
    ) {
      const assessmentId =
        `assessment-${groupIndex + 1}-${assessmentIndex + 1}`
      const lessonId =
        `lesson-${groupIndex + 1}-${1 + (assessmentIndex % lessonsPerGroup)}`

      tables.lessonAssessments.push({
        id: assessmentId,
        academicYearId: 'year-1',
        lessonId,
        teachingAssignmentId: assignmentId,
        moduleId,
        criterionId,
        title:
          `Avaliação ${deterministicText(textSeed++, 48)}`,
        activityType:
          assessmentIndex % 2 === 0
            ? 'practical_work'
            : 'written_work',
        description:
          deterministicText(textSeed++, 150),
        absentScore: 0,
        exemptScore: 10,
        ...audit()
      })

      for (
        let studentIndex = 0;
        studentIndex < studentIds.length;
        studentIndex += 1
      ) {
        tables.assessmentResults.push({
          id:
            `result-${groupIndex + 1}-${assessmentIndex + 1}-${studentIndex + 1}`,
          assessmentId,
          studentId:
            studentIds[studentIndex],
          status: 'evaluated',
          score:
            8 + ((
              assessmentIndex * 3 +
              studentIndex * 5 +
              groupIndex
            ) % 13),
          note:
            studentIndex % 9 === 0
              ? deterministicText(textSeed++, noteChars)
              : '',
          ...audit()
        })
      }
    }

    for (
      let studentIndex = 0;
      studentIndex < studentIds.length;
      studentIndex += 1
    ) {
      tables.moduleFinalGrades.push({
        id:
          `final-${groupIndex + 1}-${studentIndex + 1}`,
        academicYearId: 'year-1',
        teachingAssignmentId: assignmentId,
        moduleId,
        studentId:
          studentIds[studentIndex],
        calculatedAverage:
          10 + (studentIndex % 10),
        suggestedGrade:
          10 + (studentIndex % 10),
        finalGrade:
          10 + (studentIndex % 10),
        confirmedAt: stamp,
        note:
          studentIndex % 7 === 0
            ? deterministicText(textSeed++, noteChars)
            : '',
        ...audit()
      })

      if (
        studentIndex % 8 === 0
      ) {
        tables.learningRecoveries.push({
          id:
            `recovery-${groupIndex + 1}-${studentIndex + 1}`,
          academicYearId: 'year-1',
          teachingAssignmentId: assignmentId,
          moduleId,
          studentId:
            studentIds[studentIndex],
          triggeredAt: stamp,
          lessonCountAtTrigger:
            lessonsPerGroup,
          absenceCountAtTrigger: 10,
          absencePercentAtTrigger: 10,
          contents:
            deterministicText(textSeed++, 180),
          activity:
            deterministicText(textSeed++, 160),
          plannedDate: '2027-01-15',
          status: 'in_progress',
          result: '',
          completedAt: null,
          ...audit()
        })
      }
    }
  }

  tables.schoolCalendarEvents.push({
    id: 'calendar-break-1',
    academicYearId: 'year-1',
    type: 'school_break',
    scope: 'all',
    groupId: null,
    teachingAssignmentId: null,
    title: 'Interrupção letiva',
    description:
      deterministicText(textSeed++, 120),
    startDate: '2026-12-20',
    endDate: '2027-01-02',
    blocksLessons: true,
    ...audit()
  })

  const recordCounts =
    Object.fromEntries(
      Object.entries(tables)
        .map(
          ([key, value]) => [
            key,
            value.length
          ]
        )
    )

  return {
    name,
    snapshot: {
      format:
        'ma-professor-database-snapshot',
      formatVersion: 1,
      databaseName: 'ma-professor',
      databaseVersion: 1,
      createdAt: stamp,
      tables,
      recordCounts
    }
  }
}

async function measureScenario(
  scenario
) {
  const {
    plaintextBytes,
    payload
  } =
    await snapshotServiceModule
      .createCompressedSnapshotPayload(
        scenario.snapshot
      )

  const encrypted =
    await cryptoModule.encryptMAProfessorRecordBytes(
      cryptoMaterial.masterKey,
      'database-v1',
      payload
    )

  const body = {
    token:
      't'.repeat(43),
    deviceId:
      '12345678-1234-4abc-8def-123456789abc',
    recordId:
      'database-v1',
    expectedServerRevision: 12,
    encrypted
  }

  const bodyBytes =
    new TextEncoder()
      .encode(
        JSON.stringify(body)
      )
      .byteLength

  const payloadBytes =
    payload.byteLength

  const totalRecords =
    Object.values(
      scenario.snapshot.recordCounts
    ).reduce(
      (total, value) =>
        total + value,
      0
    )

  return {
    name:
      scenario.name,
    totalRecords,
    plaintextBytes,
    compressedPayloadBytes:
      payloadBytes,
    compressionRatio:
      payloadBytes /
      plaintextBytes,
    ciphertextCharacters:
      encrypted.ciphertext.length,
    requestBodyBytes:
      bodyBytes,
    bodyLimitPercent:
      bodyBytes /
      clientMaxBodyBytes *
      100,
    ciphertextLimitPercent:
      encrypted.ciphertext.length /
      workerMaxCiphertextCharacters *
      100,
    withinBodyLimit:
      bodyBytes <=
        clientMaxBodyBytes,
    withinCiphertextLimit:
      encrypted.ciphertext.length <=
        workerMaxCiphertextCharacters
  }
}

const scenarioDefinitions = [
  {
    name: 'normal',
    groups: 5,
    studentsPerGroup: 28,
    lessonsPerGroup: 80,
    assessmentsPerGroup: 8,
    summaryChars: 180,
    noteChars: 70,
    planificationItemsPerGroup: 20
  },
  {
    name: 'heavy',
    groups: 10,
    studentsPerGroup: 32,
    lessonsPerGroup: 110,
    assessmentsPerGroup: 12,
    summaryChars: 260,
    noteChars: 120,
    planificationItemsPerGroup: 35
  },
  {
    name: 'extreme',
    groups: 18,
    studentsPerGroup: 34,
    lessonsPerGroup: 130,
    assessmentsPerGroup: 16,
    summaryChars: 360,
    noteChars: 180,
    planificationItemsPerGroup: 50
  }
]

const measurements = []

for (
  const definition of
  scenarioDefinitions
) {
  const scenario =
    createSnapshotScenario(
      definition
    )

  measurements.push(
    await measureScenario(
      scenario
    )
  )
}

test(
  'snapshot capacity measurement uses the current production limits and real compression/encryption primitives',
  () => {
    assert.equal(
      clientMaxBodyBytes,
      1_500_000
    )
    assert.equal(
      workerMaxBodyBytes,
      1_500_000
    )
    assert.equal(
      workerMaxCiphertextCharacters,
      1_480_000
    )

    for (
      const measurement of
      measurements
    ) {
      assert.ok(
        measurement.plaintextBytes > 0
      )
      assert.ok(
        measurement.compressedPayloadBytes > 0
      )
      assert.ok(
        measurement.requestBodyBytes >
          measurement.compressedPayloadBytes,
        'O corpo JSON deve incluir o overhead de base64 e metadados.'
      )
    }
  }
)

test(
  'snapshot capacity grows monotonically across normal, heavy and extreme fixtures',
  () => {
    const [
      normal,
      heavy,
      extreme
    ] = measurements

    assert.ok(
      heavy.totalRecords >
        normal.totalRecords
    )
    assert.ok(
      extreme.totalRecords >
        heavy.totalRecords
    )
    assert.ok(
      heavy.requestBodyBytes >
        normal.requestBodyBytes
    )
    assert.ok(
      extreme.requestBodyBytes >
        heavy.requestBodyBytes
    )
  }
)

test(
  'normal full-year fixture remains inside the current online snapshot limits',
  () => {
    const normal =
      measurements[0]

    assert.equal(
      normal.withinBodyLimit,
      true,
      `Cenário normal excedeu o limite: ${JSON.stringify(normal)}`
    )

    assert.equal(
      normal.withinCiphertextLimit,
      true,
      `Cenário normal excedeu o limite de ciphertext: ${JSON.stringify(normal)}`
    )
  }
)

test(
  'report MA-Professor snapshot capacity measurements',
  () => {
    console.log(
      `MA_PROFESSOR_SNAPSHOT_CAPACITY=${JSON.stringify({
        limits: {
          bodyBytes:
            clientMaxBodyBytes,
          ciphertextCharacters:
            workerMaxCiphertextCharacters
        },
        measurements
      })}`
    )

    assert.equal(
      measurements.length,
      3
    )
  }
)
