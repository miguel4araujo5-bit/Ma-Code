import { lessonCountsTowardUfcdProgress } from '../lessons/ufcdProgress'
import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb
} from '../db'

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
  calculateAnnualAttendancePeriodMetrics,
  getAttendanceWarningLevel
} from './attendancePeriodMetrics'

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
    return 'Limite ultrapassado'
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
            lessonCountsTowardUfcdProgress(lesson)
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
  async listRecoverableAbsences(teachingAssignmentId: EntityId, studentId: EntityId) {
    await this.initialize()
    const [lessons, records] = await Promise.all([
      maProfessorDb.lessons.where('teachingAssignmentId').equals(teachingAssignmentId).toArray(),
      maProfessorDb.lessonAttendance.where('studentId').equals(studentId).toArray()
    ])
    const lessonById = new Map(lessons.filter(lesson => lessonCountsTowardUfcdProgress(lesson)).map(lesson => [lesson.id, lesson]))
    return records.filter(record => record.status === 'absent' && lessonById.has(record.lessonId)).map(record => {
      const lesson = lessonById.get(record.lessonId)!
      return { attendanceId: record.id, lessonId: lesson.id, date: lesson.date, startTime: lesson.startTime, periods: lesson.periodCount, updatedAt: record.updatedAt }
    }).sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  }

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
              lessonCountsTowardUfcdProgress(lesson) &&
              attendanceByLesson.has(
                lesson.id
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

    const nextPlannedLesson =
      lessons
        .filter(
          lesson =>
            lesson.status ===
              'planned' &&
            lesson.countTowardProgress &&
            lesson.periodCount > 0 &&
            !attendanceByLesson.has(
              lesson.id
            )
        )
        .sort(
          (
            left,
            right
          ) =>
            left.date.localeCompare(
              right.date
            ) ||
            left.startTime.localeCompare(
              right.startTime
            )
        )[0] ??
      lessons
        .filter(
          lesson =>
            lessonCountsTowardUfcdProgress(lesson) &&
            lesson.countTowardProgress &&
            lesson.periodCount > 0
        )
        .sort(
          (
            left,
            right
          ) =>
            right.date.localeCompare(
              left.date
            ) ||
            right.startTime.localeCompare(
              left.startTime
            )
        )[0] ??
      null

    const warningLevel:
      StudentAbsenceSummary['warningLevel'] =
      getAttendanceWarningLevel({
        plannedPeriods:
          annualPlannedPeriods,
        absencePeriods:
          metrics.absencePeriods,
        nextLessonPeriods:
          nextPlannedLesson?.periodCount ??
          1,
        warningPercent:
          settings.absenceWarningPercent,
        recoveryThresholdPercent:
          settings.learningRecoveryThresholdPercent
      })

    return {
      ...baseline,
      absencePercent:
        metrics.absencePercent,
      annualAbsencePeriods:
        metrics.absencePeriods,
      annualPlannedPeriods:
        metrics.plannedPeriods,
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
            { ...input, status: input.status === 'completed' ? 'pending' : input.status }
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

        return input.status === 'completed'
          ? this.updateLearningRecovery(persisted.id, { ...input, status: 'completed' })
          : persisted
      }
    )
  }

  override async createLearningRecovery(
    input: LearningRecoveryDraft
  ) {
    await this.initialize()

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
      return activeAssignmentRecovery
    }

    const moduleHistory = await listRecoveryHistory(moduleId, studentId)
    const latestCompleted = moduleHistory.filter(row => row.status === 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (latestCompleted) {
      const absences = await this.listRecoverableAbsences(module.teachingAssignmentId, studentId)
      if (!absences.some(row => row.updatedAt > (latestCompleted.completedAt ?? latestCompleted.updatedAt))) return latestCompleted
    }

    const assignmentModules =
      await maProfessorDb
        .modules
        .where(
          'teachingAssignmentId'
        )
        .equals(
          module.teachingAssignmentId
        )
        .toArray()

    const orderedModules = [
      module,
      ...assignmentModules
        .filter(
          candidate =>
            candidate.active &&
            candidate.id !== module.id
        )
        .sort(
          (
            left,
            right
          ) =>
            left.order - right.order
        )
    ]

    let recoveryModule =
      module

    for (const candidate of orderedModules) {
      if (
        await hasStudentAbsenceInModule(
          candidate.id,
          studentId
        )
      ) {
        recoveryModule =
          candidate
        break
      }
    }

    return this.createLearningRecoveryWithOrigin(
      {
        academicYearId:
          recoveryModule.academicYearId,
        teachingAssignmentId:
          recoveryModule.teachingAssignmentId,
        moduleId:
          recoveryModule.id,
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

    const module =
      await maProfessorDb
        .modules
        .get(
          moduleId
        )

    if (!module) {
      return []
    }

    const recoveryRowsBefore =
      await maProfessorDb
        .learningRecoveries
        .where(
          'teachingAssignmentId'
        )
        .equals(
          module.teachingAssignmentId
        )
        .toArray()

    const recoveryIdsBefore =
      new Set(
        recoveryRowsBefore.map(
          recovery =>
            recovery.id
        )
      )

    const created =
      (
        await super.synchronizeRecoveriesForModule(
          moduleId
        )
      ).filter(
        recovery =>
          recovery.status !== 'completed' &&
          !recoveryIdsBefore.has(
            recovery.id
          )
      )

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
        const latest = await maProfessorDb.learningRecoveries.get(id)
        if (!latest) throw new Error('A recuperação indicada não existe.')
        if (latest.status === 'completed' && latest.recoveryDate && changes.status && changes.status !== 'completed') {
          throw new Error('Para corrigir faltas, abra a aula correspondente. A recuperação concluída mantém o seu registo.')
        }
        const completing = latest.status !== 'completed' && changes.status === 'completed'
        let removedAbsences = latest.removedAbsences
        if (completing) {
          const ids = [...new Set(changes.selectedAbsenceIds ?? latest.selectedAbsenceIds ?? [])]
          const available = await this.listRecoverableAbsences(latest.teachingAssignmentId, latest.studentId)
          if (!ids.length && !(latest.origin === 'manual' && available.length === 0)) throw new Error('Selecione as faltas que pretende remover antes de concluir a recuperação.')
          const selected = ids.map(id => available.find(row => row.attendanceId === id))
          if (selected.some(row => !row)) throw new Error('Uma das faltas selecionadas foi alterada entretanto. Atualize a lista antes de concluir.')
          removedAbsences = selected.map(row => ({ attendanceId: row!.attendanceId, lessonId: row!.lessonId, date: row!.date, periods: row!.periods }))
        }
        const updated =
          await super.updateLearningRecovery(
            id,
            latest.status === 'completed' && latest.recoveryDate
              ? { ...changes, selectedAbsenceIds: latest.selectedAbsenceIds }
              : changes
          ) as LearningRecoveryAttemptRecord

        const touched:
          LearningRecoveryAttemptRecord = {
          ...updated,
          removedAbsences,
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

        if (completing) {
          for (const absence of removedAbsences ?? []) {
            await maProfessorDb.lessonAttendance.update(absence.attendanceId, { status: 'present', code: '', updatedAt: touched.updatedAt })
          }
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
