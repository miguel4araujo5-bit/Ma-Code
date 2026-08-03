import {
  MA_PROFESSOR_DATABASE_NAME,
  MA_PROFESSOR_DATABASE_VERSION,
  openMAProfessorDatabase
} from '../db'
import type {
  AcademicYear,
  AssessmentCriterion,
  AssessmentResult,
  AssessmentScheme,
  ClassGroup,
  LearningRecovery,
  Lesson,
  LessonAssessment,
  LessonAttendance,
  MAProfessorSettings,
  ModuleFinalGrade,
  ModuleUnit,
  Planification,
  PlanificationItem,
  SchoolCalendarEvent,
  SetupProgress,
  Student,
  Subject,
  SummarySuggestion,
  TeacherLocalProfile,
  TeachingAssignment,
  WeeklyScheduleSlot
} from '../types'
import {
  decryptMAProfessorRecord,
  encryptMAProfessorRecord,
  type MAProfessorEncryptedRecord
} from './cryptoService'
import {
  unlockMAProfessorLocalMasterKey
} from './cryptoStorage'
import {
  getMAProfessorEncryptedSnapshot,
  pushMAProfessorEncryptedSnapshot,
  type MAProfessorSnapshotGetResult,
  type MAProfessorSnapshotPushResult
} from './snapshotApi'

export const MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID =
  'database-v1'

const SNAPSHOT_FORMAT =
  'ma-professor-database-snapshot' as const

const SNAPSHOT_FORMAT_VERSION =
  1 as const

/*
 * O Worker aceita um pedido máximo de 1,5 MB.
 *
 * O limite local de 900 KB deixa margem para:
 * - autenticação;
 * - envelope JSON;
 * - tag AES-GCM;
 * - conversão Base64.
 */
const MAX_SNAPSHOT_PLAINTEXT_BYTES =
  900_000

export interface MAProfessorSnapshotTables {
  teacherProfiles:
    TeacherLocalProfile[]

  academicYears:
    AcademicYear[]

  groups:
    ClassGroup[]

  subjects:
    Subject[]

  teachingAssignments:
    TeachingAssignment[]

  modules:
    ModuleUnit[]

  students:
    Student[]

  assessmentSchemes:
    AssessmentScheme[]

  assessmentCriteria:
    AssessmentCriterion[]

  planifications:
    Planification[]

  planificationItems:
    PlanificationItem[]

  weeklyScheduleSlots:
    WeeklyScheduleSlot[]

  schoolCalendarEvents:
    SchoolCalendarEvent[]

  lessons:
    Lesson[]

  summarySuggestions:
    SummarySuggestion[]

  lessonAttendance:
    LessonAttendance[]

  lessonAssessments:
    LessonAssessment[]

  assessmentResults:
    AssessmentResult[]

  moduleFinalGrades:
    ModuleFinalGrade[]

  learningRecoveries:
    LearningRecovery[]

  settings:
    MAProfessorSettings[]

  setupProgress:
    SetupProgress[]
}

export type MAProfessorSnapshotRecordCounts = {
  [
    TableName in keyof
      MAProfessorSnapshotTables
  ]: number
}

export interface MAProfessorDatabaseSnapshot {
  format:
    typeof SNAPSHOT_FORMAT

  formatVersion:
    typeof SNAPSHOT_FORMAT_VERSION

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

export interface MAProfessorPreparedEncryptedSnapshot {
  recordId:
    typeof MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID

  plaintextBytes:
    number

  snapshot:
    MAProfessorDatabaseSnapshot

  encrypted:
    MAProfessorEncryptedRecord
}

export interface MAProfessorUploadSnapshotOptions {
  token:
    string

  email:
    string

  deviceId:
    string

  expectedServerRevision:
    number
}

export interface MAProfessorUploadSnapshotResult {
  snapshot:
    MAProfessorDatabaseSnapshot

  plaintextBytes:
    number

  remote:
    MAProfessorSnapshotPushResult
}

export interface MAProfessorDownloadSnapshotOptions {
  token:
    string

  email:
    string

  deviceId:
    string
}

export interface MAProfessorDownloadedSnapshotFound {
  found:
    true

  snapshot:
    MAProfessorDatabaseSnapshot

  remote:
    Extract<
      MAProfessorSnapshotGetResult,
      {
        found:
          true
      }
    >
}

export interface MAProfessorDownloadedSnapshotNotFound {
  found:
    false

  serverRevision:
    number
}

export type MAProfessorDownloadedSnapshot =
  | MAProfessorDownloadedSnapshotFound
  | MAProfessorDownloadedSnapshotNotFound

export interface MAProfessorRestoreSnapshotResult {
  snapshot:
    MAProfessorDatabaseSnapshot

  recordCounts:
    MAProfessorSnapshotRecordCounts

  totalRecords:
    number
}

const SNAPSHOT_TABLE_NAMES: Array<
  keyof MAProfessorSnapshotTables
> = [
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

function sortById<
  RecordType extends {
    id:
      string
  }
>(
  records:
    RecordType[]
) {
  return [
    ...records
  ].sort(
    (
      left,
      right
    ) =>
      left.id.localeCompare(
        right.id,
        'pt-PT',
        {
          numeric:
            true,

          sensitivity:
            'base'
        }
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

function getSnapshotPlaintextBytes(
  snapshot:
    MAProfessorDatabaseSnapshot
) {
  return new TextEncoder()
    .encode(
      JSON.stringify(
        snapshot
      )
    )
    .byteLength
}

function isObject(
  value:
    unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  )
}

function isValidDateString(
  value:
    unknown
) {
  return (
    typeof value ===
      'string' &&
    Boolean(
      value
    ) &&
    !Number.isNaN(
      new Date(
        value
      ).getTime()
    )
  )
}

function validateTableRecords(
  tableName:
    keyof MAProfessorSnapshotTables,

  records:
    unknown[]
) {
  const recordIds =
    new Set<string>()

  for (
    const record of
    records
  ) {
    if (
      !isObject(
        record
      ) ||
      typeof record.id !==
        'string' ||
      !record.id.trim()
    ) {
      throw new Error(
        `A tabela “${tableName}” contém um registo sem identificador válido.`
      )
    }

    if (
      recordIds.has(
        record.id
      )
    ) {
      throw new Error(
        `A tabela “${tableName}” contém o identificador repetido “${record.id}”.`
      )
    }

    recordIds.add(
      record.id
    )
  }
}

function validateDatabaseSnapshot(
  value:
    unknown
): MAProfessorDatabaseSnapshot {
  if (
    !isObject(
      value
    ) ||
    value.format !==
      SNAPSHOT_FORMAT ||
    value.formatVersion !==
      SNAPSHOT_FORMAT_VERSION ||
    value.databaseName !==
      MA_PROFESSOR_DATABASE_NAME ||
    value.databaseVersion !==
      MA_PROFESSOR_DATABASE_VERSION ||
    !isValidDateString(
      value.createdAt
    ) ||
    !isObject(
      value.tables
    ) ||
    !isObject(
      value.recordCounts
    )
  ) {
    throw new Error(
      'A cópia desencriptada não tem um formato válido.'
    )
  }

  for (
    const tableName of
    SNAPSHOT_TABLE_NAMES
  ) {
    const records =
      value.tables[
        tableName
      ]

    const count =
      value.recordCounts[
        tableName
      ]

    if (
      !Array.isArray(
        records
      ) ||
      typeof count !==
        'number' ||
      !Number.isInteger(
        count
      ) ||
      count <
        0 ||
      count !==
        records.length
    ) {
      throw new Error(
        `A tabela “${tableName}” da cópia desencriptada está incompleta.`
      )
    }

    validateTableRecords(
      tableName,
      records
    )
  }

  return value as unknown as
    MAProfessorDatabaseSnapshot
}

function countSnapshotRecords(
  recordCounts:
    MAProfessorSnapshotRecordCounts
) {
  return SNAPSHOT_TABLE_NAMES
    .reduce(
      (
        total,
        tableName
      ) =>
        total +
        recordCounts[
          tableName
        ],
      0
    )
}

export async function createMAProfessorDatabaseSnapshot():
  Promise<MAProfessorDatabaseSnapshot> {
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
          database.teacherProfiles
            .toArray(),

          database.academicYears
            .toArray(),

          database.groups
            .toArray(),

          database.subjects
            .toArray(),

          database.teachingAssignments
            .toArray(),

          database.modules
            .toArray(),

          database.students
            .toArray(),

          database.assessmentSchemes
            .toArray(),

          database.assessmentCriteria
            .toArray(),

          database.planifications
            .toArray(),

          database.planificationItems
            .toArray(),

          database.weeklyScheduleSlots
            .toArray(),

          database.schoolCalendarEvents
            .toArray(),

          database.lessons
            .toArray(),

          database.summarySuggestions
            .toArray(),

          database.lessonAttendance
            .toArray(),

          database.lessonAssessments
            .toArray(),

          database.assessmentResults
            .toArray(),

          database.moduleFinalGrades
            .toArray(),

          database.learningRecoveries
            .toArray(),

          database.settings
            .toArray(),

          database.setupProgress
            .toArray()
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
          SNAPSHOT_FORMAT,

        formatVersion:
          SNAPSHOT_FORMAT_VERSION,

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
  value:
    unknown
): Promise<MAProfessorRestoreSnapshotResult> {
  const snapshot =
    validateDatabaseSnapshot(
      value
    )

  const database =
    await openMAProfessorDatabase()

  await database.transaction(
    'rw',

    database.tables,

    async () => {
      await database.teacherProfiles
        .clear()

      await database.academicYears
        .clear()

      await database.groups
        .clear()

      await database.subjects
        .clear()

      await database.teachingAssignments
        .clear()

      await database.modules
        .clear()

      await database.students
        .clear()

      await database.assessmentSchemes
        .clear()

      await database.assessmentCriteria
        .clear()

      await database.planifications
        .clear()

      await database.planificationItems
        .clear()

      await database.weeklyScheduleSlots
        .clear()

      await database.schoolCalendarEvents
        .clear()

      await database.lessons
        .clear()

      await database.summarySuggestions
        .clear()

      await database.lessonAttendance
        .clear()

      await database.lessonAssessments
        .clear()

      await database.assessmentResults
        .clear()

      await database.moduleFinalGrades
        .clear()

      await database.learningRecoveries
        .clear()

      await database.settings
        .clear()

      await database.setupProgress
        .clear()

      if (
        snapshot.tables
          .teacherProfiles
          .length >
          0
      ) {
        await database.teacherProfiles
          .bulkAdd(
            snapshot.tables
              .teacherProfiles
          )
      }

      if (
        snapshot.tables
          .academicYears
          .length >
          0
      ) {
        await database.academicYears
          .bulkAdd(
            snapshot.tables
              .academicYears
          )
      }

      if (
        snapshot.tables
          .groups
          .length >
          0
      ) {
        await database.groups
          .bulkAdd(
            snapshot.tables
              .groups
          )
      }

      if (
        snapshot.tables
          .subjects
          .length >
          0
      ) {
        await database.subjects
          .bulkAdd(
            snapshot.tables
              .subjects
          )
      }

      if (
        snapshot.tables
          .teachingAssignments
          .length >
          0
      ) {
        await database.teachingAssignments
          .bulkAdd(
            snapshot.tables
              .teachingAssignments
          )
      }

      if (
        snapshot.tables
          .modules
          .length >
          0
      ) {
        await database.modules
          .bulkAdd(
            snapshot.tables
              .modules
          )
      }

      if (
        snapshot.tables
          .students
          .length >
          0
      ) {
        await database.students
          .bulkAdd(
            snapshot.tables
              .students
          )
      }

      if (
        snapshot.tables
          .assessmentSchemes
          .length >
          0
      ) {
        await database.assessmentSchemes
          .bulkAdd(
            snapshot.tables
              .assessmentSchemes
          )
      }

      if (
        snapshot.tables
          .assessmentCriteria
          .length >
          0
      ) {
        await database.assessmentCriteria
          .bulkAdd(
            snapshot.tables
              .assessmentCriteria
          )
      }

      if (
        snapshot.tables
          .planifications
          .length >
          0
      ) {
        await database.planifications
          .bulkAdd(
            snapshot.tables
              .planifications
          )
      }

      if (
        snapshot.tables
          .planificationItems
          .length >
          0
      ) {
        await database.planificationItems
          .bulkAdd(
            snapshot.tables
              .planificationItems
          )
      }

      if (
        snapshot.tables
          .weeklyScheduleSlots
          .length >
          0
      ) {
        await database.weeklyScheduleSlots
          .bulkAdd(
            snapshot.tables
              .weeklyScheduleSlots
          )
      }

      if (
        snapshot.tables
          .schoolCalendarEvents
          .length >
          0
      ) {
        await database.schoolCalendarEvents
          .bulkAdd(
            snapshot.tables
              .schoolCalendarEvents
          )
      }

      if (
        snapshot.tables
          .lessons
          .length >
          0
      ) {
        await database.lessons
          .bulkAdd(
            snapshot.tables
              .lessons
          )
      }

      if (
        snapshot.tables
          .summarySuggestions
          .length >
          0
      ) {
        await database.summarySuggestions
          .bulkAdd(
            snapshot.tables
              .summarySuggestions
          )
      }

      if (
        snapshot.tables
          .lessonAttendance
          .length >
          0
      ) {
        await database.lessonAttendance
          .bulkAdd(
            snapshot.tables
              .lessonAttendance
          )
      }

      if (
        snapshot.tables
          .lessonAssessments
          .length >
          0
      ) {
        await database.lessonAssessments
          .bulkAdd(
            snapshot.tables
              .lessonAssessments
          )
      }

      if (
        snapshot.tables
          .assessmentResults
          .length >
          0
      ) {
        await database.assessmentResults
          .bulkAdd(
            snapshot.tables
              .assessmentResults
          )
      }

      if (
        snapshot.tables
          .moduleFinalGrades
          .length >
          0
      ) {
        await database.moduleFinalGrades
          .bulkAdd(
            snapshot.tables
              .moduleFinalGrades
          )
      }

      if (
        snapshot.tables
          .learningRecoveries
          .length >
          0
      ) {
        await database.learningRecoveries
          .bulkAdd(
            snapshot.tables
              .learningRecoveries
          )
      }

      if (
        snapshot.tables
          .settings
          .length >
          0
      ) {
        await database.settings
          .bulkAdd(
            snapshot.tables
              .settings
          )
      }

      if (
        snapshot.tables
          .setupProgress
          .length >
          0
      ) {
        await database.setupProgress
          .bulkAdd(
            snapshot.tables
              .setupProgress
          )
      }
    }
  )

  return {
    snapshot,

    recordCounts:
      snapshot.recordCounts,

    totalRecords:
      countSnapshotRecords(
        snapshot.recordCounts
      )
  }
}

export async function prepareEncryptedMAProfessorDatabaseSnapshot(
  email:
    string,

  deviceId:
    string
): Promise<MAProfessorPreparedEncryptedSnapshot> {
  const [
    snapshot,
    masterKey
  ] =
    await Promise.all([
      createMAProfessorDatabaseSnapshot(),

      unlockMAProfessorLocalMasterKey(
        email,
        deviceId
      )
    ])

  const plaintextBytes =
    getSnapshotPlaintextBytes(
      snapshot
    )

  if (
    plaintextBytes >
      MAX_SNAPSHOT_PLAINTEXT_BYTES
  ) {
    throw new Error(
      'A cópia local já é demasiado grande para ser enviada como um único registo. Os dados não foram alterados.'
    )
  }

  const encrypted =
    await encryptMAProfessorRecord(
      masterKey,
      MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID,
      snapshot
    )

  return {
    recordId:
      MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID,

    plaintextBytes,

    snapshot,

    encrypted
  }
}

export async function uploadEncryptedMAProfessorDatabaseSnapshot(
  options:
    MAProfessorUploadSnapshotOptions
): Promise<MAProfessorUploadSnapshotResult> {
  const prepared =
    await prepareEncryptedMAProfessorDatabaseSnapshot(
      options.email,
      options.deviceId
    )

  const remote =
    await pushMAProfessorEncryptedSnapshot(
      options.token,
      options.deviceId,
      prepared.recordId,
      options.expectedServerRevision,
      prepared.encrypted
    )

  return {
    snapshot:
      prepared.snapshot,

    plaintextBytes:
      prepared.plaintextBytes,

    remote
  }
}

export async function downloadEncryptedMAProfessorDatabaseSnapshot(
  options:
    MAProfessorDownloadSnapshotOptions
): Promise<MAProfessorDownloadedSnapshot> {
  const remote =
    await getMAProfessorEncryptedSnapshot(
      options.token,
      options.deviceId,
      MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID
    )

  if (
    remote.found ===
      false
  ) {
    return {
      found:
        false,

      serverRevision:
        remote.serverRevision
    }
  }

  const masterKey =
    await unlockMAProfessorLocalMasterKey(
      options.email,
      options.deviceId
    )

  const decrypted =
    await decryptMAProfessorRecord<
      unknown
    >(
      masterKey,
      MA_PROFESSOR_DATABASE_SNAPSHOT_RECORD_ID,
      remote.encrypted
    )

  const snapshot =
    validateDatabaseSnapshot(
      decrypted
    )

  return {
    found:
      true,

    snapshot,

    remote
  }
}
