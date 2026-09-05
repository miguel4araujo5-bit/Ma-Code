import Dexie, {
  type Table
} from 'dexie'

import {
  getLocalISODate,
  reopenStudentMembership
} from './students/studentMembership'

import type {
  AcademicYear,
  AssessmentCriterion,
  AssessmentResult,
  AssessmentScheme,
  ClassGroup,
  EntityId,
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
  StudentMembershipPeriod,
  Subject,
  SummarySuggestion,
  TeacherLocalProfile,
  TeachingAssignment,
  WeeklyScheduleSlot
} from './types'

export const MA_PROFESSOR_DATABASE_NAME =
  'ma-professor'

export const MA_PROFESSOR_DATABASE_VERSION =
  1

export const MA_PROFESSOR_DEFAULT_SETTINGS_ID =
  'default'

export function createDefaultMAProfessorSettings(
  timestamp = new Date().toISOString()
): MAProfessorSettings {
  return {
    id:
      MA_PROFESSOR_DEFAULT_SETTINGS_ID,
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
  }
}

export class MAProfessorDatabase extends Dexie {
  teacherProfiles!:
    Table<
      TeacherLocalProfile,
      EntityId
    >

  academicYears!:
    Table<
      AcademicYear,
      EntityId
    >

  groups!:
    Table<
      ClassGroup,
      EntityId
    >

  subjects!:
    Table<
      Subject,
      EntityId
    >

  teachingAssignments!:
    Table<
      TeachingAssignment,
      EntityId
    >

  modules!:
    Table<
      ModuleUnit,
      EntityId
    >

  students!:
    Table<
      Student,
      EntityId
    >

  assessmentSchemes!:
    Table<
      AssessmentScheme,
      EntityId
    >

  assessmentCriteria!:
    Table<
      AssessmentCriterion,
      EntityId
    >

  planifications!:
    Table<
      Planification,
      EntityId
    >

  planificationItems!:
    Table<
      PlanificationItem,
      EntityId
    >

  weeklyScheduleSlots!:
    Table<
      WeeklyScheduleSlot,
      EntityId
    >

  schoolCalendarEvents!:
    Table<
      SchoolCalendarEvent,
      EntityId
    >

  lessons!:
    Table<
      Lesson,
      EntityId
    >

  summarySuggestions!:
    Table<
      SummarySuggestion,
      EntityId
    >

  lessonAttendance!:
    Table<
      LessonAttendance,
      EntityId
    >

  lessonAssessments!:
    Table<
      LessonAssessment,
      EntityId
    >

  assessmentResults!:
    Table<
      AssessmentResult,
      EntityId
    >

  moduleFinalGrades!:
    Table<
      ModuleFinalGrade,
      EntityId
    >

  learningRecoveries!:
    Table<
      LearningRecovery,
      EntityId
    >

  settings!:
    Table<
      MAProfessorSettings,
      EntityId
    >

  setupProgress!:
    Table<
      SetupProgress,
      EntityId
    >

  constructor() {
    super(
      MA_PROFESSOR_DATABASE_NAME
    )

    this.version(
      MA_PROFESSOR_DATABASE_VERSION
    ).stores({
      teacherProfiles:
        '&id',

      academicYears:
        '&id, name, active, startDate, endDate',

      groups:
        '&id, academicYearId, [academicYearId+name], active',

      subjects:
        '&id, academicYearId, [academicYearId+name], [academicYearId+code], active',

      teachingAssignments:
        '&id, academicYearId, groupId, subjectId, [academicYearId+groupId], [groupId+subjectId], active',

      modules:
        '&id, academicYearId, teachingAssignmentId, [teachingAssignmentId+order], [teachingAssignmentId+code], active',

      students:
        '&id, academicYearId, groupId, [groupId+number], [groupId+name], active',

      assessmentSchemes:
        '&id, academicYearId, teachingAssignmentId, moduleId, scope, [teachingAssignmentId+scope], [teachingAssignmentId+moduleId], active',

      assessmentCriteria:
        '&id, schemeId, [schemeId+order], active',

      planifications:
        '&id, academicYearId, teachingAssignmentId, moduleId, [teachingAssignmentId+moduleId], active',

      planificationItems:
        '&id, planificationId, [planificationId+order], status, usedLessonId, usedAt',

      weeklyScheduleSlots:
        '&id, academicYearId, teachingAssignmentId, weekday, [academicYearId+weekday], [teachingAssignmentId+weekday], validFrom, validUntil, active',

      schoolCalendarEvents:
        '&id, academicYearId, type, scope, groupId, teachingAssignmentId, startDate, endDate, [academicYearId+startDate], blocksLessons',

      lessons:
        '&id, academicYearId, teachingAssignmentId, moduleId, scheduleSlotId, date, startTime, status, origin, giaeStatus, [academicYearId+date], [teachingAssignmentId+date], [moduleId+date], [date+startTime]',

      summarySuggestions:
        '&id, lessonId, variant, generatedAt, acceptedAt',

      lessonAttendance:
        '&id, lessonId, studentId, [lessonId+studentId], [studentId+lessonId], status',

      lessonAssessments:
        '&id, academicYearId, lessonId, teachingAssignmentId, moduleId, criterionId, activityType, [lessonId+criterionId], [moduleId+criterionId]',

      assessmentResults:
        '&id, assessmentId, studentId, [assessmentId+studentId], [studentId+assessmentId], status, score',

      moduleFinalGrades:
        '&id, academicYearId, teachingAssignmentId, moduleId, studentId, [moduleId+studentId], [studentId+moduleId], confirmedAt',

      learningRecoveries:
        '&id, academicYearId, teachingAssignmentId, moduleId, studentId, status, plannedDate, [moduleId+studentId], [studentId+status]',

      settings:
        '&id',

      setupProgress:
        '&id, academicYearId, currentStep, completedAt'
    })

    this.students.hook(
      'updating',
      (
        modifications,
        _primaryKey,
        object
      ) => {
        const student =
          object as Student

        const studentChanges =
          modifications as Partial<Student>

        if (
          student.active !==
            false ||
          studentChanges.active !==
            true
        ) {
          return
        }

        const requestedPeriods =
          studentChanges.membershipPeriods

        if (
          requestedPeriods?.some(
            period =>
              period.endDate ===
              null
          )
        ) {
          return
        }

        return {
          membershipPeriods:
            reopenStudentMembership(
              requestedPeriods ??
                student.membershipPeriods,
              getLocalISODate()
            )
        }
      }
    )

    this.on(
      'populate',
      () =>
        this.settings.add(
          createDefaultMAProfessorSettings()
        )
    )
  }
}

export const maProfessorDb =
  new MAProfessorDatabase()

export function isMAProfessorDatabaseSupported() {
  return (
    typeof window !==
      'undefined' &&
    'indexedDB' in window
  )
}

export async function openMAProfessorDatabase() {
  if (
    !isMAProfessorDatabaseSupported()
  ) {
    throw new Error(
      'Este browser não suporta o armazenamento local necessário para utilizar o MA-Professor.'
    )
  }

  if (
    !maProfessorDb.isOpen()
  ) {
    await maProfessorDb.open()
  }

  return maProfessorDb
}

export function closeMAProfessorDatabase() {
  if (
    maProfessorDb.isOpen()
  ) {
    maProfessorDb.close()
  }
}

export async function ensureDefaultMAProfessorSettings() {
  const database =
    await openMAProfessorDatabase()

  const existingSettings =
    await database.settings.get(
      MA_PROFESSOR_DEFAULT_SETTINGS_ID
    )

  if (
    existingSettings
  ) {
    return existingSettings
  }

  const defaultSettings =
    createDefaultMAProfessorSettings()

  await database.settings.put(
    defaultSettings
  )

  return defaultSettings
}
