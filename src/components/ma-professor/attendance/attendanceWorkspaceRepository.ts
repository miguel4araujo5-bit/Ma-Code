import {
  ensureDefaultMAProfessorSettings,
  openMAProfessorDatabase
} from '../db'

import {
  maProfessorRepository
} from '../repository'

import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  LearningRecovery,
  LearningRecoveryStatus,
  MAProfessorSettings,
  ModuleUnit,
  StudentAbsenceSummary,
  Subject,
  TeachingAssignment
} from '../types'

import {
  attendanceRepository,
  type AttendanceOverviewRow,
  type LearningRecoveryChanges,
  type LearningRecoveryDraft
} from './attendanceRepository'

export interface AttendanceWorkspaceFilters {
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
}

export interface AttendanceAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface AttendanceModuleOption {
  module: ModuleUnit
  label: string
}

export interface AttendanceWorkspaceStudentRow {
  student: AttendanceOverviewRow['student']
  summary: StudentAbsenceSummary
  recovery: LearningRecovery | null
  recoveryHistory: LearningRecovery[]
}

export interface AttendanceWorkspaceAlertRow {
  student: AttendanceOverviewRow['student']
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  module: ModuleUnit
  summary: StudentAbsenceSummary
  recovery: LearningRecovery | null
}

export interface AttendanceWorkspaceSnapshot {
  academicYear: AcademicYear
  settings: MAProfessorSettings

  filters: {
    teachingAssignmentId: EntityId | null
    moduleId: EntityId | null
  }

  assignmentOptions: AttendanceAssignmentOption[]
  moduleOptions: AttendanceModuleOption[]

  selectedAssignment: TeachingAssignment | null
  selectedGroup: ClassGroup | null
  selectedSubject: Subject | null
  selectedModule: ModuleUnit | null

  alertRows: AttendanceWorkspaceAlertRow[]
  rows: AttendanceWorkspaceStudentRow[]

  totals: {
    studentCount: number
    regularCount: number
    warningCount: number
    recoveryRequiredCount: number
    activeRecoveryCount: number
    completedRecoveryCount: number
    averageAbsencePercent: number
  }

  generatedAt: string
}

export interface CreateWorkspaceRecoveryInput {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  studentId: EntityId
  contents?: string
  activity?: string
  plannedDate?: string | null
  status?: LearningRecoveryStatus
  result?: string
}

function now() {
  return new Date().toISOString()
}

function moduleLabel(
  module: ModuleUnit
) {
  return module.code.trim()
    ? `${module.code.trim()} · ${module.name}`
    : module.name
}

function subjectLabel(
  subject: Subject
) {
  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function sortModules(
  modules: ModuleUnit[]
) {
  return [
    ...modules
  ].sort(
    (
      left,
      right
    ) =>
      left.order -
        right.order ||
      moduleLabel(
        left
      ).localeCompare(
        moduleLabel(
          right
        ),
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function sortRecoveries(
  recoveries: LearningRecovery[]
) {
  const statusOrder: Record<
    LearningRecoveryStatus,
    number
  > = {
    pending: 0,
    in_progress: 1,
    completed: 2
  }

  return [
    ...recoveries
  ].sort(
    (
      left,
      right
    ) =>
      statusOrder[left.status] -
        statusOrder[right.status] ||
      (
        left.plannedDate ??
        '9999-12-31'
      ).localeCompare(
        right.plannedDate ??
          '9999-12-31'
      ) ||
      right.triggeredAt.localeCompare(
        left.triggeredAt
      )
  )
}

function average(
  values: number[]
) {
  if (
    values.length === 0
  ) {
    return 0
  }

  return Math.round(
    (
      values.reduce(
        (
          total,
          value
        ) =>
          total + value,
        0
      ) /
      values.length
    ) * 100
  ) / 100
}

export class AttendanceWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getWorkspace(
    academicYearId: EntityId,
    filters: AttendanceWorkspaceFilters = {}
  ): Promise<AttendanceWorkspaceSnapshot> {
    await this.initialize()

    const [
      setup,
      settings
    ] = await Promise.all([
      maProfessorRepository.getSetupSnapshot(
        academicYearId
      ),
      ensureDefaultMAProfessorSettings()
    ])

    const groupById = new Map(
      setup.groups.map(
        group => [
          group.id,
          group
        ]
      )
    )

    const subjectById = new Map(
      setup.subjects.map(
        subject => [
          subject.id,
          subject
        ]
      )
    )

    const assignmentOptions =
      setup.teachingAssignments
        .filter(
          assignment =>
            assignment.active
        )
        .flatMap(
          assignment => {
            const group = groupById.get(
              assignment.groupId
            )

            const subject = subjectById.get(
              assignment.subjectId
            )

            if (
              !group?.active ||
              !subject?.active
            ) {
              return []
            }

            return [
              {
                assignment,
                group,
                subject,
                label:
                  `${group.name} · ${subjectLabel(
                    subject
                  )}`
              }
            ]
          }
        )
        .sort(
          (
            left,
            right
          ) =>
            left.label.localeCompare(
              right.label,
              'pt-PT',
              {
                numeric: true,
                sensitivity: 'base'
              }
            )
        )

    const selectedOption =
      filters.teachingAssignmentId
        ? assignmentOptions.find(
            option =>
              option.assignment.id ===
              filters.teachingAssignmentId
          ) ?? null
        : assignmentOptions.find(
            option =>
              setup.modules.some(
                module =>
                  module.active &&
                  module.teachingAssignmentId ===
                    option.assignment.id
              )
          ) ??
          assignmentOptions[0] ??
          null

    if (
      filters.teachingAssignmentId &&
      !selectedOption
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    const selectedAssignment =
      selectedOption?.assignment ??
      null

    const selectedGroup =
      selectedOption?.group ??
      null

    const selectedSubject =
      selectedOption?.subject ??
      null

    const modules = selectedAssignment
      ? sortModules(
          setup.modules.filter(
            module =>
              module.active &&
              module.teachingAssignmentId ===
                selectedAssignment.id
          )
        )
      : []

    const moduleOptions =
      modules.map(
        module => ({
          module,
          label: moduleLabel(
            module
          )
        })
      )

    const selectedModule =
      filters.moduleId
        ? modules.find(
            module =>
              module.id ===
              filters.moduleId
          ) ?? null
        : modules[0] ?? null

    if (
      filters.moduleId &&
      !selectedModule
    ) {
      throw new Error(
        'A UFCD selecionada não pertence à turma e disciplina indicadas.'
      )
    }

    if (
      !selectedAssignment ||
      !selectedGroup ||
      !selectedSubject ||
      !selectedModule
    ) {
      return {
        academicYear:
          setup.academicYear,
        settings,
        filters: {
          teachingAssignmentId:
            selectedAssignment?.id ??
            null,
          moduleId:
            selectedModule?.id ??
            null
        },
        assignmentOptions,
        moduleOptions,
        selectedAssignment,
        selectedGroup,
        selectedSubject,
        selectedModule,
        alertRows: [],
        rows: [],
        totals: {
          studentCount: 0,
          regularCount: 0,
          warningCount: 0,
          recoveryRequiredCount: 0,
          activeRecoveryCount: 0,
          completedRecoveryCount: 0,
          averageAbsencePercent: 0
        },
        generatedAt: now()
      }
    }

    const [
      allOverview,
      allRecoveries
    ] = await Promise.all([
      attendanceRepository.listAbsenceOverview({
        academicYearId
      }),
      attendanceRepository.listLearningRecoveries({
        academicYearId
      })
    ])

    const overview =
      allOverview.filter(
        row =>
          row.assignment.id ===
            selectedAssignment.id &&
          row.module.id ===
            selectedModule.id
      )

    const recoveries =
      allRecoveries.filter(
        recovery =>
          recovery.teachingAssignmentId ===
            selectedAssignment.id &&
          recovery.moduleId ===
            selectedModule.id
      )

    const assignmentOptionById =
      new Map(
        assignmentOptions.map(
          option => [
            option.assignment.id,
            option
          ] as const
        )
      )

    const alertRowsByAssignmentStudent =
      new Map<
        string,
        AttendanceWorkspaceAlertRow
      >()

    allOverview.forEach(
      row => {
        if (
          row.summary.warningLevel ===
          'regular'
        ) {
          return
        }

        const option =
          assignmentOptionById.get(
            row.assignment.id
          )

        if (
          !option
        ) {
          return
        }

        const nextRow:
          AttendanceWorkspaceAlertRow = {
          student:
            row.student,
          assignment:
            row.assignment,
          group:
            option.group,
          subject:
            option.subject,
          module:
            row.module,
          summary:
            row.summary,
          recovery:
            row.recovery
        }

        const key =
          `${row.assignment.id}::${row.student.id}`

        const current =
          alertRowsByAssignmentStudent.get(
            key
          )

        if (
          !current
        ) {
          alertRowsByAssignmentStudent.set(
            key,
            nextRow
          )
          return
        }

        const currentHasActiveRecovery =
          Boolean(
            current.recovery &&
            current.recovery.status !==
              'completed'
          )

        const nextHasActiveRecovery =
          Boolean(
            nextRow.recovery &&
            nextRow.recovery.status !==
              'completed'
          )

        const currentHasAbsence =
          current.summary.absences > 0

        const nextHasAbsence =
          nextRow.summary.absences > 0

        const shouldReplace =
          (
            nextHasActiveRecovery &&
            !currentHasActiveRecovery
          ) ||
          (
            nextHasActiveRecovery ===
              currentHasActiveRecovery &&
            nextHasAbsence &&
            !currentHasAbsence
          ) ||
          (
            nextHasActiveRecovery ===
              currentHasActiveRecovery &&
            nextHasAbsence ===
              currentHasAbsence &&
            nextRow.module.order <
              current.module.order
          )

        if (
          shouldReplace
        ) {
          alertRowsByAssignmentStudent.set(
            key,
            nextRow
          )
        }
      }
    )

    const alertRows =
      [
        ...alertRowsByAssignmentStudent.values()
      ].sort(
        (
          left,
          right
        ) => {
          const warningOrder = {
            recovery_required: 0,
            warning: 1,
            regular: 2
          } as const

          return (
            warningOrder[
              left.summary.warningLevel
            ] -
              warningOrder[
                right.summary.warningLevel
              ] ||
            right.summary.absencePercent -
              left.summary.absencePercent ||
            left.group.name.localeCompare(
              right.group.name,
              'pt-PT',
              {
                numeric: true,
                sensitivity: 'base'
              }
            ) ||
            subjectLabel(
              left.subject
            ).localeCompare(
              subjectLabel(
                right.subject
              ),
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
            )
          )
        }
      )

    const recoveriesByStudent =
      new Map<
        EntityId,
        LearningRecovery[]
      >()

    recoveries.forEach(
      recovery => {
        const current =
          recoveriesByStudent.get(
            recovery.studentId
          ) ?? []

        current.push(
          recovery
        )

        recoveriesByStudent.set(
          recovery.studentId,
          current
        )
      }
    )

    const rows = overview
      .map(
        row => {
          const history = sortRecoveries(
            recoveriesByStudent.get(
              row.student.id
            ) ?? []
          )

          const activeRecovery =
            history.find(
              recovery =>
                recovery.status !==
                'completed'
            ) ?? null

          const latestCompletedRecovery =
            history
              .filter(
                recovery =>
                  recovery.status ===
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

          return {
            student: row.student,
            summary: row.summary,
            recovery:
              activeRecovery ??
              latestCompletedRecovery,
            recoveryHistory:
              history
          }
        }
      )
      .sort(
        (
          left,
          right
        ) =>
          left.student.number.localeCompare(
            right.student.number,
            'pt-PT',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
      )

    const regularCount = rows.filter(
      row =>
        row.summary.warningLevel ===
        'regular'
    ).length

    const warningCount = rows.filter(
      row =>
        row.summary.warningLevel ===
        'warning'
    ).length

    const recoveryRequiredCount =
      rows.filter(
        row =>
          row.summary.warningLevel ===
          'recovery_required'
      ).length

    const activeRecoveryCount =
      recoveries.filter(
        recovery =>
          recovery.status !==
          'completed'
      ).length

    const completedRecoveryCount =
      recoveries.filter(
        recovery =>
          recovery.status ===
          'completed'
      ).length

    return {
      academicYear:
        setup.academicYear,
      settings,
      filters: {
        teachingAssignmentId:
          selectedAssignment.id,
        moduleId:
          selectedModule.id
      },
      assignmentOptions,
      moduleOptions,
      selectedAssignment,
      selectedGroup,
      selectedSubject,
      selectedModule,
      alertRows,
      rows,
      totals: {
        studentCount:
          rows.length,
        regularCount,
        warningCount,
        recoveryRequiredCount,
        activeRecoveryCount,
        completedRecoveryCount,
        averageAbsencePercent:
          average(
            rows.map(
              row =>
                row.summary.absencePercent
            )
          )
      },
      generatedAt: now()
    }
  }

  async createRecovery(
    input: CreateWorkspaceRecoveryInput
  ) {
    const draft: LearningRecoveryDraft = {
      ...input,
      plannedDate:
        input.plannedDate ??
        null
    }

    return attendanceRepository.createLearningRecovery(
      draft
    )
  }

  async updateRecovery(
    recoveryId: EntityId,
    changes: LearningRecoveryChanges
  ) {
    return attendanceRepository.updateLearningRecovery(
      recoveryId,
      changes
    )
  }

  async deletePendingRecovery(
    recoveryId: EntityId
  ) {
    return attendanceRepository.deletePendingLearningRecovery(
      recoveryId
    )
  }

  async synchronizeAcademicYearRecoveries(
    academicYearId: EntityId
  ) {
    const setup =
      await maProfessorRepository.getSetupSnapshot(
        academicYearId
      )

    const activeAssignmentIds =
      new Set(
        setup.teachingAssignments
          .filter(
            assignment =>
              assignment.active
          )
          .map(
            assignment =>
              assignment.id
          )
      )

    const modules =
      sortModules(
        setup.modules.filter(
          module =>
            module.active &&
            activeAssignmentIds.has(
              module.teachingAssignmentId
            )
        )
      )

    const created:
      LearningRecovery[] = []

    for (
      const module
      of modules
    ) {
      const moduleCreated =
        await attendanceRepository.synchronizeRecoveriesForModule(
          module.id
        )

      created.push(
        ...moduleCreated
      )
    }

    return created
  }

  async synchronizeModuleRecoveries(
    moduleId: EntityId
  ) {
    return attendanceRepository.synchronizeRecoveriesForModule(
      moduleId
    )
  }
}

export function getRecoveryStatusLabel(
  status: LearningRecoveryStatus
) {
  const labels: Record<
    LearningRecoveryStatus,
    string
  > = {
    pending: 'Pendente',
    in_progress: 'Em curso',
    completed: 'Concluída'
  }

  return labels[status]
}

export const attendanceWorkspaceRepository =
  new AttendanceWorkspaceRepository()
