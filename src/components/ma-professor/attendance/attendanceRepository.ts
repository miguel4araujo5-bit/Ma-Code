import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AttendanceStatus,
  EntityId,
  ISODate,
  LearningRecovery,
  LearningRecoveryStatus,
  Lesson,
  LessonAttendance,
  MAProfessorSettings,
  ModuleUnit,
  Student,
  StudentAbsenceSummary,
  TeachingAssignment
} from '../types'

export interface AttendanceEntryDraft {
  studentId: EntityId
  status: AttendanceStatus
  code?: string
  note?: string
}

export interface SaveLessonAttendanceOptions {
  fillMissingAsPresent?: boolean
  synchronizeRecoveries?: boolean
}

export interface LessonAttendanceRegisterRow {
  student: Student
  attendance: LessonAttendance | null
  effectiveStatus: AttendanceStatus
  effectiveCode: string
  effectiveNote: string
}

export interface LessonAttendanceRegister {
  lesson: Lesson
  assignment: TeachingAssignment
  module: ModuleUnit
  rows: LessonAttendanceRegisterRow[]
  presentCount: number
  absentCount: number
  complete: boolean
}

export interface AttendanceSummaryFilters {
  academicYearId: EntityId
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
  studentId?: EntityId | null
  warningLevel?: StudentAbsenceSummary['warningLevel'] | null
}

export interface LearningRecoveryDraft {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  studentId: EntityId
  contents?: string
  activity?: string
  plannedDate?: ISODate | null
  status?: LearningRecoveryStatus
  result?: string
}

export interface LearningRecoveryChanges {
  contents?: string
  activity?: string
  plannedDate?: ISODate | null
  status?: LearningRecoveryStatus
  result?: string
}

export interface LearningRecoveryFilters {
  academicYearId: EntityId
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
  studentId?: EntityId | null
  status?: LearningRecoveryStatus | null
  plannedFrom?: ISODate | null
  plannedTo?: ISODate | null
}

export interface AttendanceOverviewRow {
  student: Student
  assignment: TeachingAssignment
  module: ModuleUnit
  summary: StudentAbsenceSummary
  recovery: LearningRecovery | null
}

const DEFAULT_ABSENCE_CODE = 'F'

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
}

function normalizeMultilineText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .replace(
      /\r\n/g,
      '\n'
    )
    .split('\n')
    .map(
      (
        line
      ) =>
        line
          .trim()
          .replace(
            /\s+/g,
            ' '
          )
    )
    .filter(Boolean)
    .join('\n')
}

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] =
    value
      .split('-')
      .map(Number)

  return new Date(
    Date.UTC(
      year,
      month -
        1,
      day
    )
  )
}

function formatISODate(
  value: Date
): ISODate {
  return [
    String(
      value.getUTCFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      value.getUTCMonth() +
        1
    ).padStart(
      2,
      '0'
    ),
    String(
      value.getUTCDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function assertISODate(
  value: ISODate,
  label: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }

  if (
    formatISODate(
      parseISODate(
        value
      )
    ) !==
    value
  ) {
    throw new Error(
      `${label} não é uma data válida.`
    )
  }
}

function roundPercentage(
  value: number
) {
  return (
    Math.round(
      value *
        100
    ) /
    100
  )
}

function sortStudents(
  students: Student[]
) {
  return students.sort(
    (
      left,
      right
    ) =>
      left.number.localeCompare(
        right.number,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
  )
}

function sortRecoveries(
  recoveries:
    LearningRecovery[]
) {
  return recoveries.sort(
    (
      left,
      right
    ) => {
      const statusOrder:
        Record<
          LearningRecoveryStatus,
          number
        > = {
          pending: 0,
          in_progress: 1,
          completed: 2
        }

      const statusComparison =
        statusOrder[
          left.status
        ] -
        statusOrder[
          right.status
        ]

      if (
        statusComparison !==
        0
      ) {
        return statusComparison
      }

      const plannedDateComparison =
        (
          left.plannedDate ??
          '9999-12-31'
        ).localeCompare(
          right.plannedDate ??
            '9999-12-31'
        )

      if (
        plannedDateComparison !==
        0
      ) {
        return plannedDateComparison
      }

      return right.triggeredAt.localeCompare(
        left.triggeredAt
      )
    }
  )
}

function getWarningLevel(
  absencePercent:
    number,
  settings:
    MAProfessorSettings
): StudentAbsenceSummary['warningLevel'] {
  if (
    absencePercent >
    settings.learningRecoveryThresholdPercent
  ) {
    return 'recovery_required'
  }

  if (
    absencePercent >=
    settings.absenceWarningPercent
  ) {
    return 'warning'
  }

  return 'regular'
}

function effectiveAttendanceCode(
  status:
    AttendanceStatus,
  code?: string
) {
  if (
    status ===
    'present'
  ) {
    return ''
  }

  return (
    normalizeText(
      code
    ) ||
    DEFAULT_ABSENCE_CODE
  )
}

function createAttendanceRecord(
  lessonId:
    EntityId,
  draft:
    AttendanceEntryDraft,
  existing:
    LessonAttendance | undefined,
  timestamp:
    string
): LessonAttendance {
  return {
    id:
      existing?.id ??
      createEntityId(
        'attendance'
      ),
    lessonId,
    studentId:
      draft.studentId,
    status:
      draft.status,
    code:
      effectiveAttendanceCode(
        draft.status,
        draft.code
      ),
    note:
      normalizeMultilineText(
        draft.note
      ),
    createdAt:
      existing?.createdAt ??
      timestamp,
    updatedAt:
      timestamp
  }
}

function createRecoveryRecord(
  input:
    LearningRecoveryDraft,
  summary:
    StudentAbsenceSummary,
  timestamp:
    string
): LearningRecovery {
  const status =
    input.status ??
    'pending'

  return {
    id:
      createEntityId(
        'recovery'
      ),
    academicYearId:
      input.academicYearId,
    teachingAssignmentId:
      input.teachingAssignmentId,
    moduleId:
      input.moduleId,
    studentId:
      input.studentId,
    triggeredAt:
      timestamp,
    lessonCountAtTrigger:
      summary.lessonsTaught,
    absenceCountAtTrigger:
      summary.absences,
    absencePercentAtTrigger:
      summary.absencePercent,
    contents:
      normalizeMultilineText(
        input.contents
      ),
    activity:
      normalizeMultilineText(
        input.activity
      ),
    plannedDate:
      input.plannedDate ??
      null,
    status,
    result:
      normalizeMultilineText(
        input.result
      ),
    completedAt:
      status ===
      'completed'
        ? timestamp
        : null,
    createdAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

async function getLessonContext(
  lessonId:
    EntityId
) {
  const lesson:
    Lesson | undefined =
    await maProfessorDb
      .lessons
      .get(
        lessonId
      )

  if (
    !lesson
  ) {
    throw new Error(
      'A aula indicada não existe.'
    )
  }

  const [
    assignment,
    module
  ] =
    await Promise.all([
      maProfessorDb
        .teachingAssignments
        .get(
          lesson.teachingAssignmentId
        ),
      maProfessorDb
        .modules
        .get(
          lesson.moduleId
        )
    ])

  if (
    !assignment ||
    assignment.academicYearId !==
      lesson.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina associadas à aula já não existem.'
    )
  }

  if (
    !module ||
    module.academicYearId !==
      lesson.academicYearId ||
    module.teachingAssignmentId !==
      assignment.id
  ) {
    throw new Error(
      'A UFCD ou módulo associado à aula já não existe.'
    )
  }

  return {
    lesson,
    assignment,
    module
  }
}

async function getModuleContext(
  moduleId:
    EntityId
) {
  const module:
    ModuleUnit | undefined =
    await maProfessorDb
      .modules
      .get(
        moduleId
      )

  if (
    !module
  ) {
    throw new Error(
      'A UFCD ou módulo indicado não existe.'
    )
  }

  const assignment:
    TeachingAssignment | undefined =
    await maProfessorDb
      .teachingAssignments
      .get(
        module.teachingAssignmentId
      )

  if (
    !assignment ||
    assignment.academicYearId !==
      module.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina associadas à UFCD já não existem.'
    )
  }

  return {
    module,
    assignment
  }
}

async function getStudentInGroup(
  studentId:
    EntityId,
  groupId:
    EntityId
) {
  const student:
    Student | undefined =
    await maProfessorDb
      .students
      .get(
        studentId
      )

  if (
    !student ||
    student.groupId !==
      groupId
  ) {
    throw new Error(
      'O aluno indicado não pertence à turma desta aula.'
    )
  }

  return student
}

async function listActiveStudentsForGroup(
  groupId:
    EntityId
) {
  const students:
    Student[] =
    await maProfessorDb
      .students
      .where(
        'groupId'
      )
      .equals(
        groupId
      )
      .toArray()

  return sortStudents(
    students.filter(
      (
        student
      ) =>
        student.active
    )
  )
}

async function getAttendanceMapForLesson(
  lessonId:
    EntityId
) {
  const records:
    LessonAttendance[] =
    await maProfessorDb
      .lessonAttendance
      .where(
        'lessonId'
      )
      .equals(
        lessonId
      )
      .toArray()

  const result =
    new Map<
      EntityId,
      LessonAttendance
    >()

  records
    .sort(
      (
        left,
        right
      ) =>
        left.updatedAt.localeCompare(
          right.updatedAt
        )
    )
    .forEach(
      (
        record
      ) => {
        result.set(
          record.studentId,
          record
        )
      }
    )

  return result
}

async function getActiveRecovery(
  moduleId:
    EntityId,
  studentId:
    EntityId
) {
  const recoveries:
    LearningRecovery[] =
    await maProfessorDb
      .learningRecoveries
      .where(
        '[moduleId+studentId]'
      )
      .equals([
        moduleId,
        studentId
      ])
      .toArray()

  return (
    recoveries
      .filter(
        (
          recovery
        ) =>
          recovery.status !==
          'completed'
      )
      .sort(
        (
          left,
          right
        ) =>
          right.triggeredAt.localeCompare(
            left.triggeredAt
          )
      )[0] ??
    null
  )
}

async function getLatestRecovery(
  moduleId:
    EntityId,
  studentId:
    EntityId
) {
  const recoveries:
    LearningRecovery[] =
    await maProfessorDb
      .learningRecoveries
      .where(
        '[moduleId+studentId]'
      )
      .equals([
        moduleId,
        studentId
      ])
      .toArray()

  return (
    recoveries
      .sort(
        (
          left,
          right
        ) =>
          right.triggeredAt.localeCompare(
            left.triggeredAt
          )
      )[0] ??
    null
  )
}

async function calculateStudentModuleSummary(
  module:
    ModuleUnit,
  assignment:
    TeachingAssignment,
  studentId:
    EntityId,
  settings:
    MAProfessorSettings
): Promise<StudentAbsenceSummary> {
  await getStudentInGroup(
    studentId,
    assignment.groupId
  )

  const lessons:
    Lesson[] =
    await maProfessorDb
      .lessons
      .where(
        'moduleId'
      )
      .equals(
        module.id
      )
      .toArray()

  const taughtLessons =
    lessons.filter(
      (
        lesson
      ) =>
        lesson.status ===
          'taught' &&
        lesson.countTowardProgress
    )

  const taughtLessonIds =
    new Set(
      taughtLessons.map(
        (
          lesson
        ) =>
          lesson.id
      )
    )

  const attendanceRecords:
    LessonAttendance[] =
    await maProfessorDb
      .lessonAttendance
      .where(
        'studentId'
      )
      .equals(
        studentId
      )
      .toArray()

  const attendanceByLesson =
    new Map<
      EntityId,
      LessonAttendance
    >()

  attendanceRecords
    .filter(
      (
        record
      ) =>
        taughtLessonIds.has(
          record.lessonId
        )
    )
    .sort(
      (
        left,
        right
      ) =>
        left.updatedAt.localeCompare(
          right.updatedAt
        )
    )
    .forEach(
      (
        record
      ) => {
        attendanceByLesson.set(
          record.lessonId,
          record
        )
      }
    )

  const absences =
    taughtLessons.reduce(
      (
        total,
        lesson
      ) => {
        const attendance =
          attendanceByLesson.get(
            lesson.id
          )

        return (
          total +
          (
            attendance?.status ===
            'absent'
              ? 1
              : 0
          )
        )
      },
      0
    )

  const lessonsTaught =
    taughtLessons.length

  const absencePercent =
    lessonsTaught ===
    0
      ? 0
      : roundPercentage(
          (
            absences /
            lessonsTaught
          ) *
            100
        )

  const activeRecovery =
    await getActiveRecovery(
      module.id,
      studentId
    )

  return {
    studentId,
    moduleId:
      module.id,
    lessonsTaught,
    absences,
    absencePercent,
    warningLevel:
      getWarningLevel(
        absencePercent,
        settings
      ),
    recoveryId:
      activeRecovery?.id ??
      null
  }
}

async function validateRecoveryContext(
  input: {
    academicYearId:
      EntityId
    teachingAssignmentId:
      EntityId
    moduleId:
      EntityId
    studentId:
      EntityId
    plannedDate?:
      ISODate | null
  }
) {
  const [
    academicYear,
    assignment,
    module,
    student
  ] =
    await Promise.all([
      maProfessorDb
        .academicYears
        .get(
          input.academicYearId
        ),
      maProfessorDb
        .teachingAssignments
        .get(
          input.teachingAssignmentId
        ),
      maProfessorDb
        .modules
        .get(
          input.moduleId
        ),
      maProfessorDb
        .students
        .get(
          input.studentId
        )
    ])

  if (
    !academicYear
  ) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  if (
    !assignment ||
    assignment.academicYearId !==
      academicYear.id
  ) {
    throw new Error(
      'A turma e disciplina indicadas não pertencem ao ano letivo.'
    )
  }

  if (
    !module ||
    module.academicYearId !==
      academicYear.id ||
    module.teachingAssignmentId !==
      assignment.id
  ) {
    throw new Error(
      'A UFCD ou módulo não pertence à turma e disciplina indicadas.'
    )
  }

  if (
    !student ||
    student.academicYearId !==
      academicYear.id ||
    student.groupId !==
      assignment.groupId
  ) {
    throw new Error(
      'O aluno indicado não pertence à turma selecionada.'
    )
  }

  if (
    input.plannedDate
  ) {
    assertISODate(
      input.plannedDate,
      'A data prevista da recuperação'
    )

    if (
      input.plannedDate <
        academicYear.startDate ||
      input.plannedDate >
        academicYear.endDate
    ) {
      throw new Error(
        'A data prevista da recuperação deve ficar dentro do ano letivo.'
      )
    }
  }

  return {
    academicYear,
    assignment,
    module,
    student
  }
}

function validateRecoveryCompletion(
  recovery:
    LearningRecovery
) {
  if (
    recovery.status !==
    'completed'
  ) {
    return
  }

  if (
    !recovery.activity.trim()
  ) {
    throw new Error(
      'Indique a atividade de recuperação realizada.'
    )
  }

  if (
    !recovery.result.trim()
  ) {
    throw new Error(
      'Indique o resultado da recuperação antes de a concluir.'
    )
  }
}

export class AttendanceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getLessonAttendanceRegister(
    lessonId:
      EntityId
  ): Promise<LessonAttendanceRegister> {
    await this.initialize()

    const {
      lesson,
      assignment,
      module
    } =
      await getLessonContext(
        lessonId
      )

    const students =
      await listActiveStudentsForGroup(
        assignment.groupId
      )

    const attendanceByStudent =
      await getAttendanceMapForLesson(
        lesson.id
      )

    const rows =
      students.map(
        (
          student
        ): LessonAttendanceRegisterRow => {
          const attendance =
            attendanceByStudent.get(
              student.id
            ) ??
            null

          return {
            student,
            attendance,
            effectiveStatus:
              attendance?.status ??
              'present',
            effectiveCode:
              attendance?.code ??
              '',
            effectiveNote:
              attendance?.note ??
              ''
          }
        }
      )

    const absentCount =
      rows.filter(
        (
          row
        ) =>
          row.effectiveStatus ===
          'absent'
      ).length

    return {
      lesson,
      assignment,
      module,
      rows,
      presentCount:
        rows.length -
        absentCount,
      absentCount,
      complete:
        rows.every(
          (
            row
          ) =>
            Boolean(
              row.attendance
            )
        )
    }
  }

  async saveLessonAttendance(
    lessonId:
      EntityId,
    entries:
      AttendanceEntryDraft[],
    options:
      SaveLessonAttendanceOptions = {}
  ) {
    await this.initialize()

    const {
      lesson,
      assignment
    } =
      await getLessonContext(
        lessonId
      )

    if (
      lesson.status !==
      'taught'
    ) {
      throw new Error(
        'A assiduidade só pode ser guardada depois de a aula ser marcada como dada.'
      )
    }

    const students =
      await listActiveStudentsForGroup(
        assignment.groupId
      )

    const studentById =
      new Map(
        students.map(
          (
            student
          ) => [
            student.id,
            student
          ]
        )
      )

    const entryByStudent =
      new Map<
        EntityId,
        AttendanceEntryDraft
      >()

    entries.forEach(
      (
        entry
      ) => {
        if (
          entryByStudent.has(
            entry.studentId
          )
        ) {
          throw new Error(
            'O mesmo aluno aparece mais do que uma vez na lista de assiduidade.'
          )
        }

        if (
          !studentById.has(
            entry.studentId
          )
        ) {
          throw new Error(
            'Um dos alunos indicados não pertence à turma desta aula.'
          )
        }

        entryByStudent.set(
          entry.studentId,
          entry
        )
      }
    )

    const fillMissingAsPresent =
      options.fillMissingAsPresent ??
      true

    if (
      !fillMissingAsPresent &&
      entryByStudent.size ===
        0
    ) {
      throw new Error(
        'Indique pelo menos um registo de assiduidade.'
      )
    }

    const existingByStudent =
      await getAttendanceMapForLesson(
        lesson.id
      )

    const timestamp =
      now()

    const records =
      students
        .map(
          (
            student
          ) => {
            const entry =
              entryByStudent.get(
                student.id
              )

            if (
              !entry &&
              !fillMissingAsPresent
            ) {
              return null
            }

            return createAttendanceRecord(
              lesson.id,
              entry ?? {
                studentId:
                  student.id,
                status:
                  'present'
              },
              existingByStudent.get(
                student.id
              ),
              timestamp
            )
          }
        )
        .filter(
          (
            record
          ): record is LessonAttendance =>
            Boolean(
              record
            )
        )

    if (
      records.length >
      0
    ) {
      await maProfessorDb
        .lessonAttendance
        .bulkPut(
          records
        )
    }

    if (
      options.synchronizeRecoveries ??
      true
    ) {
      await this.synchronizeRecoveriesForModule(
        lesson.moduleId
      )
    }

    return this.getLessonAttendanceRegister(
      lesson.id
    )
  }

  async setStudentAttendance(
    lessonId:
      EntityId,
    entry:
      AttendanceEntryDraft
  ) {
    return this.saveLessonAttendance(
      lessonId,
      [
        entry
      ],
      {
        fillMissingAsPresent:
          false,
        synchronizeRecoveries:
          true
      }
    )
  }

  async markAllPresent(
    lessonId:
      EntityId
  ) {
    await this.initialize()

    const {
      assignment
    } =
      await getLessonContext(
        lessonId
      )

    const students =
      await listActiveStudentsForGroup(
        assignment.groupId
      )

    return this.saveLessonAttendance(
      lessonId,
      students.map(
        (
          student
        ) => ({
          studentId:
            student.id,
          status:
            'present' as const
        })
      )
    )
  }

  async clearLessonAttendance(
    lessonId:
      EntityId
  ) {
    await this.initialize()

    const {
      lesson
    } =
      await getLessonContext(
        lessonId
      )

    const records:
      LessonAttendance[] =
      await maProfessorDb
        .lessonAttendance
        .where(
          'lessonId'
        )
        .equals(
          lesson.id
        )
        .toArray()

    if (
      records.length ===
      0
    ) {
      return 0
    }

    await maProfessorDb
      .lessonAttendance
      .bulkDelete(
        records.map(
          (
            record
          ) =>
            record.id
        )
      )

    await this.synchronizeRecoveriesForModule(
      lesson.moduleId
    )

    return records.length
  }

  async getStudentModuleAbsenceSummary(
    moduleId:
      EntityId,
    studentId:
      EntityId
  ) {
    await this.initialize()

    const [
      {
        module,
        assignment
      },
      settings
    ] =
      await Promise.all([
        getModuleContext(
          moduleId
        ),
        ensureDefaultMAProfessorSettings()
      ])

    return calculateStudentModuleSummary(
      module,
      assignment,
      studentId,
      settings
    )
  }

  async listModuleAbsenceSummaries(
    moduleId:
      EntityId
  ) {
    await this.initialize()

    const [
      {
        module,
        assignment
      },
      settings
    ] =
      await Promise.all([
        getModuleContext(
          moduleId
        ),
        ensureDefaultMAProfessorSettings()
      ])

    const students =
      await listActiveStudentsForGroup(
        assignment.groupId
      )

    return Promise.all(
      students.map(
        (
          student
        ) =>
          calculateStudentModuleSummary(
            module,
            assignment,
            student.id,
            settings
          )
      )
    )
  }

  async listAbsenceOverview(
    filters:
      AttendanceSummaryFilters
  ) {
    await this.initialize()

    const [
      assignments,
      modules,
      students,
      settings
    ] =
      await Promise.all([
        maProfessorDb
          .teachingAssignments
          .where(
            'academicYearId'
          )
          .equals(
            filters.academicYearId
          )
          .toArray(),
        maProfessorDb
          .modules
          .where(
            'academicYearId'
          )
          .equals(
            filters.academicYearId
          )
          .toArray(),
        maProfessorDb
          .students
          .where(
            'academicYearId'
          )
          .equals(
            filters.academicYearId
          )
          .toArray(),
        ensureDefaultMAProfessorSettings()
      ])

    const activeAssignments =
      (
        assignments as
          TeachingAssignment[]
      ).filter(
        (
          assignment
        ) =>
          assignment.active &&
          (
            !filters.teachingAssignmentId ||
            assignment.id ===
              filters.teachingAssignmentId
          )
      )

    const assignmentById =
      new Map(
        activeAssignments.map(
          (
            assignment
          ) => [
            assignment.id,
            assignment
          ]
        )
      )

    const activeModules =
      (
        modules as
          ModuleUnit[]
      ).filter(
        (
          module
        ) =>
          module.active &&
          assignmentById.has(
            module.teachingAssignmentId
          ) &&
          (
            !filters.moduleId ||
            module.id ===
              filters.moduleId
          )
      )

    const activeStudents =
      (
        students as
          Student[]
      ).filter(
        (
          student
        ) =>
          student.active &&
          (
            !filters.studentId ||
            student.id ===
              filters.studentId
          )
      )

    const studentsByGroup =
      new Map<
        EntityId,
        Student[]
      >()

    activeStudents.forEach(
      (
        student
      ) => {
        const current =
          studentsByGroup.get(
            student.groupId
          ) ??
          []

        current.push(
          student
        )

        studentsByGroup.set(
          student.groupId,
          current
        )
      }
    )

    const rows:
      AttendanceOverviewRow[] =
      []

    for (
      const module
      of activeModules.sort(
        (
          left,
          right
        ) =>
          left.order -
          right.order
      )
    ) {
      const assignment =
        assignmentById.get(
          module.teachingAssignmentId
        )

      if (
        !assignment
      ) {
        continue
      }

      const moduleStudents =
        sortStudents([
          ...(
            studentsByGroup.get(
              assignment.groupId
            ) ??
            []
          )
        ])

      for (
        const student
        of moduleStudents
      ) {
        const summary =
          await calculateStudentModuleSummary(
            module,
            assignment,
            student.id,
            settings
          )

        if (
          filters.warningLevel &&
          summary.warningLevel !==
            filters.warningLevel
        ) {
          continue
        }

        rows.push({
          student,
          assignment,
          module,
          summary,
          recovery:
            await getLatestRecovery(
              module.id,
              student.id
            )
        })
      }
    }

    return rows
  }

  async createLearningRecovery(
    input:
      LearningRecoveryDraft
  ) {
    await this.initialize()

    await validateRecoveryContext(
      input
    )

    const activeRecovery =
      await getActiveRecovery(
        input.moduleId,
        input.studentId
      )

    if (
      activeRecovery
    ) {
      throw new Error(
        'Este aluno já possui uma recuperação pendente ou em curso nesta UFCD.'
      )
    }

    const summary =
      await this.getStudentModuleAbsenceSummary(
        input.moduleId,
        input.studentId
      )

    const timestamp =
      now()

    const recovery =
      createRecoveryRecord(
        input,
        summary,
        timestamp
      )

    validateRecoveryCompletion(
      recovery
    )

    await maProfessorDb
      .learningRecoveries
      .add(
        recovery
      )

    return recovery
  }

  async ensureLearningRecovery(
    moduleId:
      EntityId,
    studentId:
      EntityId
  ) {
    await this.initialize()

    const summary =
      await this.getStudentModuleAbsenceSummary(
        moduleId,
        studentId
      )

    if (
      summary.warningLevel !==
      'recovery_required'
    ) {
      return getActiveRecovery(
        moduleId,
        studentId
      )
    }

    const existing =
      await getActiveRecovery(
        moduleId,
        studentId
      )

    if (
      existing
    ) {
      return existing
    }

    const {
      module,
      assignment
    } =
      await getModuleContext(
        moduleId
      )

    return this.createLearningRecovery({
      academicYearId:
        module.academicYearId,
      teachingAssignmentId:
        assignment.id,
      moduleId:
        module.id,
      studentId,
      status:
        'pending'
    })
  }

  async synchronizeRecoveriesForModule(
    moduleId:
      EntityId
  ) {
    await this.initialize()

    const {
      assignment
    } =
      await getModuleContext(
        moduleId
      )

    const students =
      await listActiveStudentsForGroup(
        assignment.groupId
      )

    const created:
      LearningRecovery[] =
      []

    for (
      const student
      of students
    ) {
      const summary =
        await this.getStudentModuleAbsenceSummary(
          moduleId,
          student.id
        )

      if (
        summary.warningLevel !==
        'recovery_required'
      ) {
        continue
      }

      const existing =
        await getActiveRecovery(
          moduleId,
          student.id
        )

      if (
        !existing
      ) {
        const recovery =
          await this.ensureLearningRecovery(
            moduleId,
            student.id
          )

        if (
          recovery
        ) {
          created.push(
            recovery
          )
        }
      }
    }

    return created
  }

  async listLearningRecoveries(
    filters:
      LearningRecoveryFilters
  ) {
    await this.initialize()

    if (
      filters.plannedFrom
    ) {
      assertISODate(
        filters.plannedFrom,
        'A data inicial do filtro'
      )
    }

    if (
      filters.plannedTo
    ) {
      assertISODate(
        filters.plannedTo,
        'A data final do filtro'
      )
    }

    if (
      filters.plannedFrom &&
      filters.plannedTo &&
      filters.plannedFrom >
        filters.plannedTo
    ) {
      throw new Error(
        'A data inicial do filtro não pode ser posterior à data final.'
      )
    }

    let recoveries:
      LearningRecovery[] =
      await maProfessorDb
        .learningRecoveries
        .where(
          'academicYearId'
        )
        .equals(
          filters.academicYearId
        )
        .toArray()

    if (
      filters.teachingAssignmentId
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            recovery.teachingAssignmentId ===
            filters.teachingAssignmentId
        )
    }

    if (
      filters.moduleId
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            recovery.moduleId ===
            filters.moduleId
        )
    }

    if (
      filters.studentId
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            recovery.studentId ===
            filters.studentId
        )
    }

    if (
      filters.status
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            recovery.status ===
            filters.status
        )
    }

    if (
      filters.plannedFrom
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            Boolean(
              recovery.plannedDate &&
              recovery.plannedDate >=
                filters.plannedFrom!
            )
        )
    }

    if (
      filters.plannedTo
    ) {
      recoveries =
        recoveries.filter(
          (
            recovery
          ) =>
            Boolean(
              recovery.plannedDate &&
              recovery.plannedDate <=
                filters.plannedTo!
            )
        )
    }

    return sortRecoveries(
      recoveries
    )
  }

  async getLearningRecovery(
    id:
      EntityId
  ) {
    await this.initialize()

    return maProfessorDb
      .learningRecoveries
      .get(
        id
      )
  }

  async updateLearningRecovery(
    id:
      EntityId,
    changes:
      LearningRecoveryChanges
  ) {
    await this.initialize()

    const current:
      LearningRecovery | undefined =
      await maProfessorDb
        .learningRecoveries
        .get(
          id
        )

    if (
      !current
    ) {
      throw new Error(
        'A recuperação indicada não existe.'
      )
    }

    const plannedDate =
      changes.plannedDate ===
      undefined
        ? current.plannedDate
        : changes.plannedDate

    await validateRecoveryContext({
      academicYearId:
        current.academicYearId,
      teachingAssignmentId:
        current.teachingAssignmentId,
      moduleId:
        current.moduleId,
      studentId:
        current.studentId,
      plannedDate
    })

    const timestamp =
      now()

    const status =
      changes.status ??
      current.status

    const updated:
      LearningRecovery = {
      ...current,
      contents:
        changes.contents ===
        undefined
          ? current.contents
          : normalizeMultilineText(
              changes.contents
            ),
      activity:
        changes.activity ===
        undefined
          ? current.activity
          : normalizeMultilineText(
              changes.activity
            ),
      plannedDate,
      status,
      result:
        changes.result ===
        undefined
          ? current.result
          : normalizeMultilineText(
              changes.result
            ),
      completedAt:
        status ===
        'completed'
          ? current.completedAt ??
            timestamp
          : null,
      updatedAt:
        timestamp
    }

    validateRecoveryCompletion(
      updated
    )

    await maProfessorDb
      .learningRecoveries
      .put(
        updated
      )

    return updated
  }

  async startLearningRecovery(
    id:
      EntityId,
    changes:
      Pick<
        LearningRecoveryChanges,
        | 'contents'
        | 'activity'
        | 'plannedDate'
      > = {}
  ) {
    return this.updateLearningRecovery(
      id,
      {
        ...changes,
        status:
          'in_progress'
      }
    )
  }

  async completeLearningRecovery(
    id:
      EntityId,
    input: {
      contents?: string
      activity: string
      result: string
      plannedDate?:
        ISODate | null
    }
  ) {
    return this.updateLearningRecovery(
      id,
      {
        ...input,
        status:
          'completed'
      }
    )
  }

  async reopenLearningRecovery(
    id:
      EntityId
  ) {
    return this.updateLearningRecovery(
      id,
      {
        status:
          'in_progress'
      }
    )
  }

  async deletePendingLearningRecovery(
    id:
      EntityId
  ) {
    await this.initialize()

    const recovery:
      LearningRecovery | undefined =
      await maProfessorDb
        .learningRecoveries
        .get(
          id
        )

    if (
      !recovery
    ) {
      return false
    }

    if (
      recovery.status !==
      'pending'
    ) {
      throw new Error(
        'Apenas recuperações ainda pendentes podem ser eliminadas.'
      )
    }

    await maProfessorDb
      .learningRecoveries
      .delete(
        id
      )

    return true
  }
}

export function getAttendanceStatusLabel(
  status:
    AttendanceStatus
) {
  return status ===
    'present'
    ? 'Presente'
    : 'Faltou'
}

export function getAbsenceWarningLevelLabel(
  warningLevel:
    StudentAbsenceSummary['warningLevel']
) {
  const labels:
    Record<
      StudentAbsenceSummary['warningLevel'],
      string
    > = {
      regular:
        'Regular',
      warning:
        'Atenção',
      recovery_required:
        'Recuperação necessária'
    }

  return labels[
    warningLevel
  ]
}

export function getLearningRecoveryStatusLabel(
  status:
    LearningRecoveryStatus
) {
  const labels:
    Record<
      LearningRecoveryStatus,
      string
    > = {
      pending:
        'Pendente',
      in_progress:
        'Em curso',
      completed:
        'Concluída'
    }

  return labels[
    status
  ]
}

export const attendanceRepository =
  new AttendanceRepository()
