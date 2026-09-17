import {
  MA_PROFESSOR_DATABASE_NAME,
  MA_PROFESSOR_DATABASE_VERSION,
  openMAProfessorDatabase
} from '../db'

import type {
  MAProfessorBackupData
} from '../types'

import {
  assertMAProfessorSnapshotDataIntegrity
} from './snapshotIntegrityValidation'

const FORMAT =
  'ma-professor-database-snapshot' as const

const FORMAT_VERSION =
  1 as const

const EXPECTED_TABLE_NAMES:
  Array<keyof MAProfessorBackupData> = [
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

export type MAProfessorSnapshotTables =
  MAProfessorBackupData

export type MAProfessorSnapshotRecordCounts = {
  [K in keyof MAProfessorBackupData]: number
}

export interface MAProfessorDatabaseSnapshot {
  format:
    typeof FORMAT

  formatVersion:
    typeof FORMAT_VERSION

  databaseName:
    typeof MA_PROFESSOR_DATABASE_NAME

  databaseVersion:
    typeof MA_PROFESSOR_DATABASE_VERSION

  createdAt:
    string

  tables:
    MAProfessorSnapshotTables

  recordCounts:
    MAProfessorSnapshotRecordCounts
}

export interface MAProfessorRestoreSnapshotResult {
  snapshot:
    MAProfessorDatabaseSnapshot

  restoredTables:
    Array<keyof MAProfessorBackupData>

  restoredRecords:
    number

  restoredAt:
    string
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function isRecordArray(
  value: unknown
) {
  return (
    Array.isArray(
      value
    ) &&
    value.every(
      item =>
        isObject(
          item
        )
    )
  )
}

function sortById<
  T extends {
    id: string
  }
>(
  records: T[]
) {
  return [
    ...records
  ].sort(
    (
      left,
      right
    ) =>
      left.id.localeCompare(
        right.id
      )
  )
}

function createRecordCounts(
  tables:
    MAProfessorSnapshotTables
): MAProfessorSnapshotRecordCounts {
  return {
    teacherProfiles:
      tables.teacherProfiles.length,
    academicYears:
      tables.academicYears.length,
    groups:
      tables.groups.length,
    subjects:
      tables.subjects.length,
    teachingAssignments:
      tables.teachingAssignments.length,
    modules:
      tables.modules.length,
    students:
      tables.students.length,
    assessmentSchemes:
      tables.assessmentSchemes.length,
    assessmentCriteria:
      tables.assessmentCriteria.length,
    planifications:
      tables.planifications.length,
    planificationItems:
      tables.planificationItems.length,
    weeklyScheduleSlots:
      tables.weeklyScheduleSlots.length,
    schoolCalendarEvents:
      tables.schoolCalendarEvents.length,
    lessons:
      tables.lessons.length,
    summarySuggestions:
      tables.summarySuggestions.length,
    lessonAttendance:
      tables.lessonAttendance.length,
    lessonAssessments:
      tables.lessonAssessments.length,
    assessmentResults:
      tables.assessmentResults.length,
    moduleFinalGrades:
      tables.moduleFinalGrades.length,
    learningRecoveries:
      tables.learningRecoveries.length,
    settings:
      tables.settings.length,
    setupProgress:
      tables.setupProgress.length
  }
}

function countSnapshotRecords(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  return EXPECTED_TABLE_NAMES
    .reduce(
      (
        total,
        tableName
      ) =>
        total +
        snapshot.recordCounts[
          tableName
        ],
      0
    )
}

function parseRecordCounts(
  value: unknown
): MAProfessorSnapshotRecordCounts {
  if (!isObject(value)) {
    throw new Error(
      'A cópia local não contém a contagem esperada dos registos.'
    )
  }

  for (
    const tableName of
      EXPECTED_TABLE_NAMES
  ) {
    const count =
      value[tableName]

    if (
      typeof count !==
        'number' ||
      !Number.isInteger(
        count
      ) ||
      count < 0
    ) {
      throw new Error(
        `A cópia local contém uma contagem inválida em “${tableName}”.`
      )
    }
  }

  return value as
    MAProfessorSnapshotRecordCounts
}

function assertRecordCountsMatch(
  tables:
    MAProfessorSnapshotTables,
  recordCounts:
    MAProfessorSnapshotRecordCounts
) {
  for (
    const tableName of
      EXPECTED_TABLE_NAMES
  ) {
    if (
      tables[tableName].length !==
      recordCounts[tableName]
    ) {
      throw new Error(
        `A cópia local não corresponde à contagem declarada em “${tableName}”.`
      )
    }
  }
}

function assertSnapshot(
  value: unknown
): MAProfessorDatabaseSnapshot {
  if (
    !isObject(value) ||
    value.format !==
      FORMAT ||
    value.formatVersion !==
      FORMAT_VERSION ||
    value.databaseName !==
      MA_PROFESSOR_DATABASE_NAME ||
    value.databaseVersion !==
      MA_PROFESSOR_DATABASE_VERSION ||
    typeof value.createdAt !==
      'string' ||
    !value.createdAt ||
    Number.isNaN(
      Date.parse(
        value.createdAt
      )
    ) ||
    !isObject(
      value.tables
    )
  ) {
    throw new Error(
      'A cópia local não tem um formato de base de dados suportado.'
    )
  }

  for (
    const tableName of
      EXPECTED_TABLE_NAMES
  ) {
    if (
      !isRecordArray(
        value.tables[
          tableName
        ]
      )
    ) {
      throw new Error(
        `A cópia local não contém uma tabela válida em “${tableName}”.`
      )
    }
  }

  const tables =
    value.tables as unknown as
      MAProfessorSnapshotTables

  const recordCounts =
    parseRecordCounts(
      value.recordCounts
    )

  assertRecordCountsMatch(
    tables,
    recordCounts
  )

  assertMAProfessorSnapshotDataIntegrity(
    tables
  )

  return {
    format:
      FORMAT,
    formatVersion:
      FORMAT_VERSION,
    databaseName:
      MA_PROFESSOR_DATABASE_NAME,
    databaseVersion:
      MA_PROFESSOR_DATABASE_VERSION,
    createdAt:
      value.createdAt,
    tables,
    recordCounts
  }
}

export async function createMAProfessorDatabaseSnapshot(): Promise<
  MAProfessorDatabaseSnapshot
> {
  const database =
    await openMAProfessorDatabase()

  return database.transaction(
    'r',
    database.tables,
    async () => {
      const [
        teacherProfiles,
        academicYears,
        groups,
        subjects,
        teachingAssignments,
        modules,
        students,
        assessmentSchemes,
        assessmentCriteria,
        planifications,
        planificationItems,
        weeklyScheduleSlots,
        schoolCalendarEvents,
        lessons,
        summarySuggestions,
        lessonAttendance,
        lessonAssessments,
        assessmentResults,
        moduleFinalGrades,
        learningRecoveries,
        settings,
        setupProgress
      ] =
        await Promise.all([
          database.teacherProfiles.toArray(),
          database.academicYears.toArray(),
          database.groups.toArray(),
          database.subjects.toArray(),
          database.teachingAssignments.toArray(),
          database.modules.toArray(),
          database.students.toArray(),
          database.assessmentSchemes.toArray(),
          database.assessmentCriteria.toArray(),
          database.planifications.toArray(),
          database.planificationItems.toArray(),
          database.weeklyScheduleSlots.toArray(),
          database.schoolCalendarEvents.toArray(),
          database.lessons.toArray(),
          database.summarySuggestions.toArray(),
          database.lessonAttendance.toArray(),
          database.lessonAssessments.toArray(),
          database.assessmentResults.toArray(),
          database.moduleFinalGrades.toArray(),
          database.learningRecoveries.toArray(),
          database.settings.toArray(),
          database.setupProgress.toArray()
        ])

      const tables:
        MAProfessorSnapshotTables = {
        teacherProfiles:
          sortById(
            teacherProfiles
          ),
        academicYears:
          sortById(
            academicYears
          ),
        groups:
          sortById(
            groups
          ),
        subjects:
          sortById(
            subjects
          ),
        teachingAssignments:
          sortById(
            teachingAssignments
          ),
        modules:
          sortById(
            modules
          ),
        students:
          sortById(
            students
          ),
        assessmentSchemes:
          sortById(
            assessmentSchemes
          ),
        assessmentCriteria:
          sortById(
            assessmentCriteria
          ),
        planifications:
          sortById(
            planifications
          ),
        planificationItems:
          sortById(
            planificationItems
          ),
        weeklyScheduleSlots:
          sortById(
            weeklyScheduleSlots
          ),
        schoolCalendarEvents:
          sortById(
            schoolCalendarEvents
          ),
        lessons:
          sortById(
            lessons
          ),
        summarySuggestions:
          sortById(
            summarySuggestions
          ),
        lessonAttendance:
          sortById(
            lessonAttendance
          ),
        lessonAssessments:
          sortById(
            lessonAssessments
          ),
        assessmentResults:
          sortById(
            assessmentResults
          ),
        moduleFinalGrades:
          sortById(
            moduleFinalGrades
          ),
        learningRecoveries:
          sortById(
            learningRecoveries
          ),
        settings:
          sortById(
            settings
          ),
        setupProgress:
          sortById(
            setupProgress
          )
      }

      return {
        format:
          FORMAT,
        formatVersion:
          FORMAT_VERSION,
        databaseName:
          MA_PROFESSOR_DATABASE_NAME,
        databaseVersion:
          MA_PROFESSOR_DATABASE_VERSION,
        createdAt:
          new Date()
            .toISOString(),
        tables,
        recordCounts:
          createRecordCounts(
            tables
          )
      }
    }
  )
}

export async function restoreMAProfessorDatabaseSnapshot(
  snapshotCandidate:
    MAProfessorDatabaseSnapshot
): Promise<MAProfessorRestoreSnapshotResult> {
  const snapshot =
    assertSnapshot(
      snapshotCandidate
    )

  const database =
    await openMAProfessorDatabase()

  await database.transaction(
    'rw',
    database.tables,
    async () => {
      await database.teacherProfiles.clear()
      await database.academicYears.clear()
      await database.groups.clear()
      await database.subjects.clear()
      await database.teachingAssignments.clear()
      await database.modules.clear()
      await database.students.clear()
      await database.assessmentSchemes.clear()
      await database.assessmentCriteria.clear()
      await database.planifications.clear()
      await database.planificationItems.clear()
      await database.weeklyScheduleSlots.clear()
      await database.schoolCalendarEvents.clear()
      await database.lessons.clear()
      await database.summarySuggestions.clear()
      await database.lessonAttendance.clear()
      await database.lessonAssessments.clear()
      await database.assessmentResults.clear()
      await database.moduleFinalGrades.clear()
      await database.learningRecoveries.clear()
      await database.settings.clear()
      await database.setupProgress.clear()

      if (
        snapshot.tables
          .teacherProfiles
          .length > 0
      ) {
        await database.teacherProfiles.bulkPut(
          snapshot.tables.teacherProfiles
        )
      }

      if (
        snapshot.tables
          .academicYears
          .length > 0
      ) {
        await database.academicYears.bulkPut(
          snapshot.tables.academicYears
        )
      }

      if (
        snapshot.tables.groups
          .length > 0
      ) {
        await database.groups.bulkPut(
          snapshot.tables.groups
        )
      }

      if (
        snapshot.tables.subjects
          .length > 0
      ) {
        await database.subjects.bulkPut(
          snapshot.tables.subjects
        )
      }

      if (
        snapshot.tables
          .teachingAssignments
          .length > 0
      ) {
        await database.teachingAssignments.bulkPut(
          snapshot.tables.teachingAssignments
        )
      }

      if (
        snapshot.tables.modules
          .length > 0
      ) {
        await database.modules.bulkPut(
          snapshot.tables.modules
        )
      }

      if (
        snapshot.tables.students
          .length > 0
      ) {
        await database.students.bulkPut(
          snapshot.tables.students
        )
      }

      if (
        snapshot.tables
          .assessmentSchemes
          .length > 0
      ) {
        await database.assessmentSchemes.bulkPut(
          snapshot.tables.assessmentSchemes
        )
      }

      if (
        snapshot.tables
          .assessmentCriteria
          .length > 0
      ) {
        await database.assessmentCriteria.bulkPut(
          snapshot.tables.assessmentCriteria
        )
      }

      if (
        snapshot.tables
          .planifications
          .length > 0
      ) {
        await database.planifications.bulkPut(
          snapshot.tables.planifications
        )
      }

      if (
        snapshot.tables
          .planificationItems
          .length > 0
      ) {
        await database.planificationItems.bulkPut(
          snapshot.tables.planificationItems
        )
      }

      if (
        snapshot.tables
          .weeklyScheduleSlots
          .length > 0
      ) {
        await database.weeklyScheduleSlots.bulkPut(
          snapshot.tables.weeklyScheduleSlots
        )
      }

      if (
        snapshot.tables
          .schoolCalendarEvents
          .length > 0
      ) {
        await database.schoolCalendarEvents.bulkPut(
          snapshot.tables.schoolCalendarEvents
        )
      }

      if (
        snapshot.tables.lessons
          .length > 0
      ) {
        await database.lessons.bulkPut(
          snapshot.tables.lessons
        )
      }

      if (
        snapshot.tables
          .summarySuggestions
          .length > 0
      ) {
        await database.summarySuggestions.bulkPut(
          snapshot.tables.summarySuggestions
        )
      }

      if (
        snapshot.tables
          .lessonAttendance
          .length > 0
      ) {
        await database.lessonAttendance.bulkPut(
          snapshot.tables.lessonAttendance
        )
      }

      if (
        snapshot.tables
          .lessonAssessments
          .length > 0
      ) {
        await database.lessonAssessments.bulkPut(
          snapshot.tables.lessonAssessments
        )
      }

      if (
        snapshot.tables
          .assessmentResults
          .length > 0
      ) {
        await database.assessmentResults.bulkPut(
          snapshot.tables.assessmentResults
        )
      }

      if (
        snapshot.tables
          .moduleFinalGrades
          .length > 0
      ) {
        await database.moduleFinalGrades.bulkPut(
          snapshot.tables.moduleFinalGrades
        )
      }

      if (
        snapshot.tables
          .learningRecoveries
          .length > 0
      ) {
        await database.learningRecoveries.bulkPut(
          snapshot.tables.learningRecoveries
        )
      }

      if (
        snapshot.tables.settings
          .length > 0
      ) {
        await database.settings.bulkPut(
          snapshot.tables.settings
        )
      }

      if (
        snapshot.tables
          .setupProgress
          .length > 0
      ) {
        await database.setupProgress.bulkPut(
          snapshot.tables.setupProgress
        )
      }
    }
  )

  const restoredSnapshot =
    await createMAProfessorDatabaseSnapshot()

  for (
    const tableName of
      EXPECTED_TABLE_NAMES
  ) {
    const expected =
      JSON.stringify(
        snapshot.tables[
          tableName
        ]
      )

    const actual =
      JSON.stringify(
        restoredSnapshot.tables[
          tableName
        ]
      )

    if (
      expected !==
      actual
    ) {
      throw new Error(
        `Os dados foram restaurados, mas a verificação local não corresponde à cópia em “${tableName}”.`
      )
    }
  }

  return {
    snapshot:
      restoredSnapshot,
    restoredTables:
      EXPECTED_TABLE_NAMES.filter(
        tableName =>
          snapshot.recordCounts[
            tableName
          ] > 0
      ),
    restoredRecords:
      countSnapshotRecords(
        snapshot
      ),
    restoredAt:
      new Date()
        .toISOString()
  }
}
