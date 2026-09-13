import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb
} from '../db'

import {
  isStudentMemberOnDate
} from '../students/studentMembership'

import type {
  EntityId,
  LearningRecovery,
  LearningRecoveryOrigin,
  StudentAbsenceSummary
} from '../types'

import {
  AttendanceRepository as BaseAttendanceRepository
} from './attendanceRepositoryBase'

import type {
  LearningRecoveryChanges,
  LearningRecoveryDraft
} from './attendanceRepositoryBase'

import {
  calculateAttendancePeriodMetrics
} from './attendancePeriodMetrics'

import {
  canAutomaticallyRemoveRecovery
} from './learningRecoveryLifecycle'

export type {
  AttendanceEntryDraft,
  SaveLessonAttendanceOptions,
  LessonAttendanceRegisterRow,
  LessonAttendanceRegister,
  AttendanceSummaryFilters,
  LearningRecoveryDraft,
  LearningRecoveryChanges,
  LearningRecoveryFilters,
  AttendanceOverviewRow
} from './attendanceRepositoryBase'

export {
  getAttendanceStatusLabel,
  getAbsenceWarningLevelLabel,
  getLearningRecoveryStatusLabel
} from './attendanceRepositoryBase'

async function getActiveRecovery(
  moduleId: EntityId,
  studentId: EntityId
) {
  const recoveries =
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
        recovery =>
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

export class AttendanceRepository
  extends BaseAttendanceRepository {
  override async getStudentModuleAbsenceSummary(
    moduleId: EntityId,
    studentId: EntityId
  ) {
    const baseline =
      await super.getStudentModuleAbsenceSummary(
        moduleId,
        studentId
      )

    const [
      student,
      lessons,
      attendanceRecords,
      settings
    ] =
      await Promise.all([
        maProfessorDb
          .students
          .get(
            studentId
          ),
        maProfessorDb
          .lessons
          .where(
            'moduleId'
          )
          .equals(
            moduleId
          )
          .toArray(),
        maProfessorDb
          .lessonAttendance
          .where(
            'studentId'
          )
          .equals(
            studentId
          )
          .toArray(),
        ensureDefaultMAProfessorSettings()
      ])

    if (
      !student
    ) {
      return baseline
    }

    const attendanceByLesson =
      new Map(
        attendanceRecords
          .sort(
            (
              left,
              right
            ) =>
              left.updatedAt.localeCompare(
                right.updatedAt
              )
          )
          .map(
            attendance => [
              attendance.lessonId,
              attendance
            ] as const
          )
      )

    const metrics =
      calculateAttendancePeriodMetrics(
        lessons
          .filter(
            lesson =>
              lesson.status ===
                'taught' &&
              lesson.countTowardProgress &&
              (
                isStudentMemberOnDate(
                  student,
                  lesson.date
                ) ||
                attendanceByLesson.has(
                  lesson.id
                )
              )
          )
          .map(
            lesson => ({
              periodCount:
                lesson.periodCount,
              absent:
                attendanceByLesson.get(
                  lesson.id
                )?.status ===
                'absent'
            })
          )
      )

    const warningLevel:
      StudentAbsenceSummary['warningLevel'] =
      metrics.absencePercent >
      settings.learningRecoveryThresholdPercent
        ? 'recovery_required'
        : metrics.absencePercent >=
            settings.absenceWarningPercent
          ? 'warning'
          : 'regular'

    return {
      ...baseline,
      absencePercent:
        metrics.absencePercent,
      warningLevel
    }
  }

  private async createLearningRecoveryWithOrigin(
    input: LearningRecoveryDraft,
    origin: LearningRecoveryOrigin
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const recovery =
          await super.createLearningRecovery(
            input
          )

        const persisted:
          LearningRecovery = {
          ...recovery,
          origin,
          teacherTouchedAt:
            origin ===
            'manual'
              ? recovery.createdAt
              : null
        }

        await maProfessorDb
          .learningRecoveries
          .put(
            persisted
          )

        return persisted
      }
    )
  }

  override async createLearningRecovery(
    input: LearningRecoveryDraft
  ) {
    return this.createLearningRecoveryWithOrigin(
      input,
      'manual'
    )
  }

  override async ensureLearningRecovery(
    moduleId: EntityId,
    studentId: EntityId
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

    const module =
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

    return this.createLearningRecoveryWithOrigin(
      {
        academicYearId:
          module.academicYearId,
        teachingAssignmentId:
          module.teachingAssignmentId,
        moduleId:
          module.id,
        studentId,
        status:
          'pending'
      },
      'automatic_threshold'
    )
  }

  override async synchronizeRecoveriesForModule(
    moduleId: EntityId
  ) {
    await this.initialize()

    const created =
      await super.synchronizeRecoveriesForModule(
        moduleId
      )

    const candidates =
      await maProfessorDb
        .learningRecoveries
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray()

    for (
      const candidate
      of candidates
    ) {
      if (
        !canAutomaticallyRemoveRecovery(
          candidate
        )
      ) {
        continue
      }

      const summary =
        await this.getStudentModuleAbsenceSummary(
          moduleId,
          candidate.studentId
        )

      if (
        summary.warningLevel ===
        'recovery_required'
      ) {
        continue
      }

      const deleted =
        await maProfessorDb.transaction(
          'rw',
          maProfessorDb.learningRecoveries,
          async () => {
            const latest =
              await maProfessorDb
                .learningRecoveries
                .get(
                  candidate.id
                )

            if (
              !latest ||
              !canAutomaticallyRemoveRecovery(
                latest
              )
            ) {
              return false
            }

            await maProfessorDb
              .learningRecoveries
              .delete(
                latest.id
              )

            return true
          }
        )

      if (
        deleted
      ) {
        await this.ensureLearningRecovery(
          moduleId,
          candidate.studentId
        )
      }
    }

    return created
  }

  async synchronizeRecoveriesForActiveAcademicYear() {
    await this.initialize()

    const academicYears =
      await maProfessorDb
        .academicYears
        .toArray()

    const activeAcademicYear =
      academicYears
        .filter(
          academicYear =>
            academicYear.active
        )
        .sort(
          (
            left,
            right
          ) =>
            right.startDate.localeCompare(
              left.startDate
            )
        )[0] ??
      null

    if (
      !activeAcademicYear
    ) {
      return []
    }

    const [
      modules,
      assignments
    ] =
      await Promise.all([
        maProfessorDb
          .modules
          .where(
            'academicYearId'
          )
          .equals(
            activeAcademicYear.id
          )
          .toArray(),
        maProfessorDb
          .teachingAssignments
          .where(
            'academicYearId'
          )
          .equals(
            activeAcademicYear.id
          )
          .toArray()
      ])

    const activeAssignmentIds =
      new Set(
        assignments
          .filter(
            assignment =>
              assignment.active
          )
          .map(
            assignment =>
              assignment.id
          )
      )

    const created:
      LearningRecovery[] =
      []

    for (
      const module
      of modules
    ) {
      if (
        !module.active ||
        !activeAssignmentIds.has(
          module.teachingAssignmentId
        )
      ) {
        continue
      }

      const moduleCreated =
        await this.synchronizeRecoveriesForModule(
          module.id
        )

      created.push(
        ...moduleCreated
      )
    }

    return created
  }

  override async updateLearningRecovery(
    id: EntityId,
    changes: LearningRecoveryChanges
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const updated =
          await super.updateLearningRecovery(
            id,
            changes
          )

        const touched:
          LearningRecovery = {
          ...updated,
          teacherTouchedAt:
            updated.teacherTouchedAt ??
            updated.updatedAt
        }

        await maProfessorDb
          .learningRecoveries
          .put(
            touched
          )

        return touched
      }
    )
  }
}

export const attendanceRepository =
  new AttendanceRepository()
