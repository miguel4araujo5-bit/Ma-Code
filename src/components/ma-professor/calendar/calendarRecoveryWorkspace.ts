import {
  maProfessorDb
} from '../db'
import {
  sortLearningRecoveryAttempts,
  type LearningRecoveryAttemptRecord
} from '../attendance/learningRecoveryAttempts'
import type {
  ClassGroup,
  EntityId,
  LearningRecovery,
  ModuleUnit,
  Student,
  Subject,
  TeachingAssignment
} from '../types'
import type {
  CalendarWorkspaceSnapshot
} from './calendarWorkspaceRepositoryBase'

export interface CalendarRecoveryRow {
  recovery: LearningRecoveryAttemptRecord
  attemptNumber: number
  student: Student
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  module: ModuleUnit
}

export type CalendarRecoveryDayRow =
  CalendarWorkspaceSnapshot['days'][number] & {
    recoveries: CalendarRecoveryRow[]
  }

export type CalendarRecoveryWorkspaceSnapshot =
  Omit<
    CalendarWorkspaceSnapshot,
    'days' | 'totals'
  > & {
    days: CalendarRecoveryDayRow[]
    totals: CalendarWorkspaceSnapshot['totals'] & {
      recoveryCount: number
    }
  }

function sortRecoveryRows(
  rows: CalendarRecoveryRow[]
) {
  return rows.sort(
    (left, right) =>
      (left.recovery.plannedDate ?? '')
        .localeCompare(
          right.recovery.plannedDate ?? ''
        ) ||
      left.group.name.localeCompare(
        right.group.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      ) ||
      left.student.number.localeCompare(
        right.student.number,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      ) ||
      left.student.name.localeCompare(
        right.student.name,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
  )
}

function buildAttemptNumberById(
  recoveries: LearningRecovery[]
) {
  const historiesByStudentModule =
    new Map<string, LearningRecovery[]>()

  recoveries.forEach(
    recovery => {
      const key =
        `${recovery.moduleId}\u0000${recovery.studentId}`

      const history =
        historiesByStudentModule.get(key) ?? []

      history.push(recovery)
      historiesByStudentModule.set(
        key,
        history
      )
    }
  )

  const attemptNumberById =
    new Map<EntityId, number>()

  historiesByStudentModule.forEach(
    history => {
      sortLearningRecoveryAttempts(
        history
      ).forEach(
        (recovery, index) => {
          attemptNumberById.set(
            recovery.id,
            index + 1
          )
        }
      )
    }
  )

  return attemptNumberById
}

export function buildCalendarRecoveryRows(
  snapshot: CalendarWorkspaceSnapshot,
  recoveries: LearningRecovery[],
  students: Student[],
  modules: ModuleUnit[]
) {
  const assignmentById =
    new Map(
      snapshot.assignmentOptions.map(
        option => [
          option.assignment.id,
          option.assignment
        ] as const
      )
    )

  const groupByAssignmentId =
    new Map(
      snapshot.assignmentOptions.map(
        option => [
          option.assignment.id,
          option.group
        ] as const
      )
    )

  const subjectByAssignmentId =
    new Map(
      snapshot.assignmentOptions.map(
        option => [
          option.assignment.id,
          option.subject
        ] as const
      )
    )

  const studentById =
    new Map(
      students.map(
        student => [
          student.id,
          student
        ] as const
      )
    )

  const moduleById =
    new Map(
      modules.map(
        module => [
          module.id,
          module
        ] as const
      )
    )

  const attemptNumberById =
    buildAttemptNumberById(
      recoveries
    )

  const rows:
    CalendarRecoveryRow[] = []

  for (const recovery of recoveries) {
    if (
      !recovery.plannedDate ||
      recovery.plannedDate <
        snapshot.displayStartDate ||
      recovery.plannedDate >
        snapshot.displayEndDate
    ) {
      continue
    }

    if (
      snapshot.filters
        .teachingAssignmentId &&
      recovery.teachingAssignmentId !==
        snapshot.filters
          .teachingAssignmentId
    ) {
      continue
    }

    const assignment =
      assignmentById.get(
        recovery.teachingAssignmentId
      )

    const group =
      groupByAssignmentId.get(
        recovery.teachingAssignmentId
      )

    const subject =
      subjectByAssignmentId.get(
        recovery.teachingAssignmentId
      )

    const student =
      studentById.get(
        recovery.studentId
      )

    const module =
      moduleById.get(
        recovery.moduleId
      )

    if (
      !assignment ||
      !group ||
      !subject ||
      !student ||
      !module
    ) {
      continue
    }

    if (
      snapshot.filters.groupId &&
      group.id !==
        snapshot.filters.groupId
    ) {
      continue
    }

    if (
      module.teachingAssignmentId !==
        assignment.id ||
      student.groupId !==
        group.id
    ) {
      continue
    }

    rows.push({
      recovery:
        recovery as LearningRecoveryAttemptRecord,
      attemptNumber:
        attemptNumberById.get(
          recovery.id
        ) ?? 1,
      student,
      assignment,
      group,
      subject,
      module
    })
  }

  return sortRecoveryRows(rows)
}

export async function enrichCalendarSnapshotWithRecoveries(
  snapshot: CalendarWorkspaceSnapshot
): Promise<CalendarRecoveryWorkspaceSnapshot> {
  const [
    recoveries,
    students,
    modules
  ] = await Promise.all([
    maProfessorDb.learningRecoveries
      .where('academicYearId')
      .equals(snapshot.academicYear.id)
      .toArray(),
    maProfessorDb.students
      .where('academicYearId')
      .equals(snapshot.academicYear.id)
      .toArray(),
    maProfessorDb.modules
      .where('academicYearId')
      .equals(snapshot.academicYear.id)
      .toArray()
  ])

  const recoveryRows =
    buildCalendarRecoveryRows(
      snapshot,
      recoveries,
      students,
      modules
    )

  const recoveriesByDate =
    new Map<
      string,
      CalendarRecoveryRow[]
    >()

  recoveryRows.forEach(
    row => {
      const date =
        row.recovery.plannedDate

      if (!date) {
        return
      }

      const current =
        recoveriesByDate.get(date) ?? []

      current.push(row)
      recoveriesByDate.set(
        date,
        current
      )
    }
  )

  return {
    ...snapshot,
    days:
      snapshot.days.map(
        day => ({
          ...day,
          recoveries:
            recoveriesByDate.get(
              day.date
            ) ?? []
        })
      ),
    totals: {
      ...snapshot.totals,
      recoveryCount:
        recoveryRows.length
    }
  }
}
