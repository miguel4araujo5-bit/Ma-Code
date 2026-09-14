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
  AttendanceRepository as BaseAttendanceRepository,
  getAbsenceWarningLevelLabel as getBaseAbsenceWarningLevelLabel
} from './attendanceRepositoryBase'

import type {
  AttendanceSummaryFilters,
  LearningRecoveryChanges,
  LearningRecoveryDraft
} from './attendanceRepositoryBase'

import {
  calculateAnnualAttendancePeriodMetrics
} from './attendancePeriodMetrics'

import {
  canAutomaticallyRemoveRecovery
} from './learningRecoveryLifecycle'

import {
  MAX_LEARNING_RECOVERY_ATTEMPTS,
  sortLearningRecoveryAttempts,
  summarizeLearningRecoveryAttempts,
  type LearningRecoveryAttemptRecord,
  type LearningRecoveryOutcome
} from './learningRecoveryAttempts'

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
  getLearningRecoveryStatusLabel
} from './attendanceRepositoryBase'

export function getAbsenceWarningLevelLabel(
  warningLevel:
    StudentAbsenceSummary['warningLevel']
) {
  if (
    warningLevel ===
    'recovery_required'
  ) {
    return '🚨 Recuperação necessária'
  }

  return getBaseAbsenceWarningLevelLabel(
    warningLevel
  )
}

async function listRecoveryHistory(
  moduleId: EntityId,
  studentId: EntityId
) {
  return maProfessorDb
    .learningRecoveries
    .where(
      '[moduleId+studentId]'
    )
    .equals([
      moduleId,
      studentId
    ])
    .toArray()
}

async function listRecoveryHistoryForAssignment(
  teachingAssignmentId: EntityId,
  studentId: EntityId
) {
  const recoveries =
    await maProfessorDb
      .learningRecoveries
      .where(
        'teachingAssignmentId'
      )
      .equals(
        teachingAssignmentId
      )
      .toArray()

  return recoveries.filter(
    recovery =>
      recovery.studentId ===
      studentId
  )
}

async function getActiveRecovery(
  moduleId: EntityId,
  studentId: EntityId
) {
  const recoveries =
    await listRecoveryHistory(
      moduleId,
      studentId
    )

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

async function getActiveRecoveryForAssignment(
  teachingAssignmentId: EntityId,
  studentId: EntityId
) {
  const recoveries =
    await listRecoveryHistoryForAssignment(
      teachingAssignmentId,
      studentId
    )

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

async function hasStudentAbsenceInModule(
  moduleId: EntityId,
  studentId: EntityId
) {
  const [
    lessons,
    attendanceRecords
  ] = await Promise.all([
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
      .toArray()
  ])

  const countedLessonIds =
    new Set(
      lessons
        .filter(
          lesson =>
            lesson.status ===
              'taught' &&
            lesson.countTowardProgress
        )
        .map(
          lesson =>
            lesson.id
        )
    )

  return attendanceRecords.some(
    attendance =>
      attendance.status ===
        'absent' &&
      countedLessonIds.has(
        attendance.lessonId
      )
  )
}

function now() {
  return new Date().toISOString()
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

    const module =
      await maProfessorDb
        .modules
        .get(
          moduleId
        )

    if (!module) {
      return baseline
    }

    const [
      student,
      lessons,
      assignmentModules,
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
            'teachingAssignmentId'
          )
          .equals(
            module.teachingAssignmentId
          )
          .toArray(),
        maProfessorDb
          .modules
          .where(
            'teachingAssignmentId'
          )
          .equals(
            module.teachingAssignmentId
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

    if (!student) {
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

    const annualPlannedPeriods =
      assignmentModules
        .filter(
          assignmentModule =>
            assignmentModule.active
        )
        .reduce(
          (
            total,
            assignmentModule
          ) =>
            total +
            assignmentModule.plannedPeriods,
          0
        )

    const metrics =
      calculateAnnualAttendancePeriodMetrics(
        annualPlannedPeriods,
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
      metrics.absencePercent >=
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

  override async listModuleAbsenceSummaries(
    moduleId: EntityId
  ) {
    const baseline =
      await super.listModuleAbsenceSummaries(
        moduleId
      )

    return Promise.all(
      baseline.map(
        summary =>
          this.getStudentModuleAbsenceSummary(
            moduleId,
            summary.studentId
          )
      )
    )
  }

  override async listAbsenceOverview(
    filters: AttendanceSummaryFilters
  ) {
    const baselineRows =
      await super.listAbsenceOverview({
        ...filters,
        warningLevel: null
      })

    const rows =
      await Promise.all(
        baselineRows.map(
          async row => ({
            ...row,
            summary:
              await this.getStudentModuleAbsenceSummary(
                row.module.id,
                row.student.id
              )
          })
        )
      )

    if (!filters.warningLevel) {
      return rows
    }

    return rows.filter(
      row =>
        row.summary.warningLevel ===
        filters.warningLevel
    )
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
          LearningRecoveryAttemptRecord = {
          ...recovery,
          origin,
          teacherTouchedAt:
            origin ===
            'manual'
              ? recovery.createdAt
              : null,
          outcome: null,
          referredToExamAt: null
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
    await this.initialize()

    const activeAssignmentRecovery =
      await getActiveRecoveryForAssignment(
        input.teachingAssignmentId,
        input.studentId
      )

    if (activeAssignmentRecovery) {
      throw new Error(
        'Este aluno já possui uma recuperação pendente ou em curso nesta disciplina.'
      )
    }

    const history =
      await listRecoveryHistory(
        input.moduleId,
        input.studentId
      )

    if (history.length > 0) {
      const summary =
        summarizeLearningRecoveryAttempts(
          history
        )

      if (
        summary.attemptCount >=
        MAX_LEARNING_RECOVERY_ATTEMPTS
      ) {
        throw new Error(
          'Já foram registadas três tentativas de recuperação para este aluno nesta UFCD. Não é possível criar uma quarta tentativa.'
        )
      }

      if (summary.hasSuccessfulAttempt) {
        throw new Error(
          'A recuperação deste aluno já foi concluída com sucesso.'
        )
      }

      if (summary.referredToExamAt) {
        throw new Error(
          'Este aluno já foi encaminhado para exame.'
        )
      }

      if (!summary.canCreateNextAttempt) {
        throw new Error(
          'Conclua e classifique a tentativa anterior como “Sem sucesso” antes de iniciar uma nova tentativa.'
        )
      }
    }

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

    const module =
      await maProfessorDb
        .modules
        .get(
          moduleId
        )

    if (!module) {
      throw new Error(
        'A UFCD ou módulo indicado não existe.'
      )
    }

    const activeAssignmentRecovery =
      await getActiveRecoveryForAssignment(
        module.teachingAssignmentId,
        studentId
      )

    if (activeAssignmentRecovery) {
      return activeAssignmentRecovery.moduleId ===
        moduleId
        ? activeAssignmentRecovery
        : null
    }

    const history =
      await listRecoveryHistory(
        moduleId,
        studentId
      )

    if (history.length > 0) {
      return sortLearningRecoveryAttempts(
        history
      )[history.length - 1]!
    }

    const assignmentHistory =
      await listRecoveryHistoryForAssignment(
        module.teachingAssignmentId,
        studentId
      )

    if (assignmentHistory.length > 0) {
      return null
    }

    if (
      !(
        await hasStudentAbsenceInModule(
          moduleId,
          studentId
        )
      )
    ) {
      return null
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
      (
        await super.synchronizeRecoveriesForModule(
          moduleId
        )
      ).filter(
        recovery =>
          recovery.status !== 'completed'
      )

    const module =
      await maProfessorDb
        .modules
        .get(
          moduleId
        )

    if (!module) {
      return created
    }

    const candidates =
      await maProfessorDb
        .learningRecoveries
        .where(
          'teachingAssignmentId'
        )
        .equals(
          module.teachingAssignmentId
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
          candidate.moduleId,
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

      if (deleted) {
        await this.ensureLearningRecovery(
          candidate.moduleId,
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

    if (!activeAcademicYear) {
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

    const current =
      await maProfessorDb
        .learningRecoveries
        .get(id) as
          LearningRecoveryAttemptRecord |
          undefined

    if (
      current?.referredToExamAt &&
      changes.status !== undefined &&
      changes.status !== 'completed'
    ) {
      throw new Error(
        'Uma recuperação já encaminhada para exame não pode ser reaberta.'
      )
    }

    if (
      current?.status === 'completed' &&
      changes.status !== undefined &&
      changes.status !== 'completed'
    ) {
      const history =
        sortLearningRecoveryAttempts(
          await listRecoveryHistory(
            current.moduleId,
            current.studentId
          )
        )

      const currentIndex =
        history.findIndex(
          recovery =>
            recovery.id === current.id
        )

      if (
        currentIndex >= 0 &&
        currentIndex < history.length - 1
      ) {
        throw new Error(
          'Não pode reabrir uma tentativa anterior depois de já ter iniciado uma tentativa seguinte.'
        )
      }
    }

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.tables,
      async () => {
        const updated =
          await super.updateLearningRecovery(
            id,
            changes
          ) as LearningRecoveryAttemptRecord

        const touched:
          LearningRecoveryAttemptRecord = {
          ...updated,
          outcome:
            updated.status === 'completed'
              ? updated.outcome ?? null
              : null,
          referredToExamAt:
            updated.referredToExamAt ?? null,
          teacherTouchedAt:
            updated.teacherTouchedAt ??
            updated.updatedAt
        }

        await maProfessorDb
          .learningRecoveries
          .put(touched)

        return touched
      }
    )
  }

  async setLearningRecoveryOutcome(
    id: EntityId,
    outcome: LearningRecoveryOutcome
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.learningRecoveries,
      async () => {
        const current =
          await maProfessorDb
            .learningRecoveries
            .get(id) as
              LearningRecoveryAttemptRecord |
              undefined

        if (!current) {
          throw new Error(
            'A tentativa de recuperação indicada não existe.'
          )
        }

        if (current.status !== 'completed') {
          throw new Error(
            'Conclua a tentativa antes de registar o respetivo resultado.'
          )
        }

        if (
          current.referredToExamAt &&
          current.outcome !== outcome
        ) {
          throw new Error(
            'O resultado já não pode ser alterado depois do encaminhamento para exame.'
          )
        }

        const history =
          sortLearningRecoveryAttempts(
            await listRecoveryHistory(
              current.moduleId,
              current.studentId
            )
          )

        const currentIndex =
          history.findIndex(
            recovery =>
              recovery.id === current.id
          )

        if (
          outcome === 'successful' &&
          currentIndex >= 0 &&
          currentIndex < history.length - 1
        ) {
          throw new Error(
            'Não pode marcar uma tentativa anterior com sucesso depois de já ter iniciado uma tentativa seguinte.'
          )
        }

        const timestamp = now()
        const updated:
          LearningRecoveryAttemptRecord = {
          ...current,
          outcome,
          teacherTouchedAt:
            current.teacherTouchedAt ??
            timestamp,
          updatedAt: timestamp
        }

        await maProfessorDb
          .learningRecoveries
          .put(updated)

        return updated
      }
    )
  }

  async referLearningRecoveryToExam(
    moduleId: EntityId,
    studentId: EntityId
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.learningRecoveries,
      async () => {
        const history =
          await listRecoveryHistory(
            moduleId,
            studentId
          )

        const summary =
          summarizeLearningRecoveryAttempts(
            history
          )

        if (summary.referredToExamAt) {
          return summary.attempts.find(
            attempt =>
              Boolean(
                attempt.referredToExamAt
              )
          ) ?? null
        }

        if (!summary.canReferToExam) {
          throw new Error(
            'O encaminhamento para exame só fica disponível depois de três tentativas concluídas sem sucesso.'
          )
        }

        const target =
          summary.attempts[
            MAX_LEARNING_RECOVERY_ATTEMPTS - 1
          ]

        if (!target) {
          throw new Error(
            'Não foi possível identificar a terceira tentativa de recuperação.'
          )
        }

        const timestamp = now()
        const updated:
          LearningRecoveryAttemptRecord = {
          ...target,
          referredToExamAt: timestamp,
          teacherTouchedAt:
            target.teacherTouchedAt ??
            timestamp,
          updatedAt: timestamp
        }

        await maProfessorDb
          .learningRecoveries
          .put(updated)

        return updated
      }
    )
  }
}

export const attendanceRepository =
  new AttendanceRepository()
