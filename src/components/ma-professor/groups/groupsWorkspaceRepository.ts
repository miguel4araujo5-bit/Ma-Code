import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  maProfessorRepository,
  type StudentDraft
} from '../repository'

import {
  closeStudentMembership,
  getLocalISODate,
  reopenStudentMembership
} from '../students/studentMembership'

import type {
  AcademicYear,
  ClassGroup,
  EntityId,
  ModuleUnit,
  Student,
  Subject,
  TeachingAssignment
} from '../types'

export interface GroupsWorkspaceFilters {
  groupId?: EntityId | null
}

export interface GroupWorkspaceRow {
  group: ClassGroup
  activeStudentCount: number
  inactiveStudentCount: number
  assignmentCount: number
  moduleCount: number
}

export interface GroupTeachingRow {
  assignment: TeachingAssignment
  subject: Subject
  modules: ModuleUnit[]
  label: string
}

export interface GroupsWorkspaceSnapshot {
  academicYear: AcademicYear

  filters: {
    groupId: EntityId | null
  }

  groups: GroupWorkspaceRow[]
  selectedGroup: ClassGroup | null
  students: Student[]
  teachingRows: GroupTeachingRow[]

  totals: {
    groupCount: number
    activeGroupCount: number
    activeStudentCount: number
    inactiveStudentCount: number
    assignmentCount: number
    moduleCount: number
  }

  generatedAt: string
}

export interface CreateGroupWorkspaceInput {
  academicYearId: EntityId
  name: string
  courseName?: string
  gradeLevel?: string
}

export interface UpdateGroupWorkspaceInput {
  name?: string
  courseName?: string
  gradeLevel?: string
  active?: boolean
}

export interface UpdateStudentWorkspaceInput {
  number?: string
  name?: string
  notes?: string
  active?: boolean
}

function now() {
  return new Date().toISOString()
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

function normalizeForComparison(
  value: string
) {
  return normalizeText(
    value
  ).toLocaleLowerCase(
    'pt-PT'
  )
}

function requireText(
  value: string,
  label: string
) {
  const normalized =
    normalizeText(
      value
    )

  if (
    !normalized
  ) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function sortGroups(
  groups: ClassGroup[]
) {
  return [
    ...groups
  ].sort(
    (
      left,
      right
    ) =>
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function sortStudents(
  students: Student[]
) {
  return [
    ...students
  ].sort(
    (
      left,
      right
    ) => {
      const numberComparison =
        left.number.localeCompare(
          right.number,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )

      if (
        numberComparison !==
        0
      ) {
        return numberComparison
      }

      return left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
    }
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
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  )
}

function getSubjectLabel(
  subject: Subject
) {
  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function buildTeachingRows(
  groupId: EntityId,
  assignments: TeachingAssignment[],
  subjects: Subject[],
  modules: ModuleUnit[]
) {
  const subjectById =
    new Map(
      subjects.map(
        subject => [
          subject.id,
          subject
        ]
      )
    )

  return assignments
    .filter(
      assignment =>
        assignment.groupId ===
          groupId &&
        assignment.active
    )
    .flatMap(
      assignment => {
        const subject =
          subjectById.get(
            assignment.subjectId
          )

        if (
          !subject
        ) {
          return []
        }

        return [
          {
            assignment,
            subject,

            modules:
              sortModules(
                modules.filter(
                  module =>
                    module.teachingAssignmentId ===
                      assignment.id &&
                    module.active
                )
              ),

            label:
              assignment.displayName.trim() ||
              getSubjectLabel(
                subject
              )
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
}

export class GroupsWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getWorkspace(
    academicYearId: EntityId,
    filters: GroupsWorkspaceFilters = {}
  ): Promise<GroupsWorkspaceSnapshot> {
    await this.initialize()

    const setup =
      await maProfessorRepository.getSetupSnapshot(
        academicYearId
      )

    const groups =
      sortGroups(
        setup.groups
      )

    const selectedGroup =
      filters.groupId
        ? groups.find(
            group =>
              group.id ===
              filters.groupId
          ) ??
          null
        : groups.find(
            group =>
              group.active
          ) ??
          groups[0] ??
          null

    if (
      filters.groupId &&
      !selectedGroup
    ) {
      throw new Error(
        'A turma selecionada não pertence ao ano letivo.'
      )
    }

    const groupRows =
      groups.map(
        (
          group
        ): GroupWorkspaceRow => {
          const groupStudents =
            setup.students.filter(
              student =>
                student.groupId ===
                group.id
            )

          const groupAssignments =
            setup.teachingAssignments.filter(
              assignment =>
                assignment.groupId ===
                  group.id &&
                assignment.active
            )

          const assignmentIds =
            new Set(
              groupAssignments.map(
                assignment =>
                  assignment.id
              )
            )

          return {
            group,

            activeStudentCount:
              groupStudents.filter(
                student =>
                  student.active
              ).length,

            inactiveStudentCount:
              groupStudents.filter(
                student =>
                  !student.active
              ).length,

            assignmentCount:
              groupAssignments.length,

            moduleCount:
              setup.modules.filter(
                module =>
                  assignmentIds.has(
                    module.teachingAssignmentId
                  ) &&
                  module.active
              ).length
          }
        }
      )

    const students =
      selectedGroup
        ? sortStudents(
            setup.students.filter(
              student =>
                student.groupId ===
                selectedGroup.id
            )
          )
        : []

    const teachingRows =
      selectedGroup
        ? buildTeachingRows(
            selectedGroup.id,
            setup.teachingAssignments,
            setup.subjects,
            setup.modules
          )
        : []

    return {
      academicYear:
        setup.academicYear,

      filters: {
        groupId:
          selectedGroup?.id ??
          null
      },

      groups:
        groupRows,

      selectedGroup,
      students,
      teachingRows,

      totals: {
        groupCount:
          groups.length,

        activeGroupCount:
          groups.filter(
            group =>
              group.active
          ).length,

        activeStudentCount:
          setup.students.filter(
            student =>
              student.active
          ).length,

        inactiveStudentCount:
          setup.students.filter(
            student =>
              !student.active
          ).length,

        assignmentCount:
          setup.teachingAssignments.filter(
            assignment =>
              assignment.active
          ).length,

        moduleCount:
          setup.modules.filter(
            module =>
              module.active
          ).length
      },

      generatedAt:
        now()
    }
  }

  async createGroup(
    input: CreateGroupWorkspaceInput
  ) {
    return maProfessorRepository.createGroup({
      academicYearId:
        input.academicYearId,

      name:
        input.name,

      courseName:
        input.courseName ??
        '',

      gradeLevel:
        input.gradeLevel ??
        '',

      active:
        true
    })
  }

  async updateGroup(
    groupId: EntityId,
    changes: UpdateGroupWorkspaceInput
  ) {
    return maProfessorRepository.updateGroup(
      groupId,
      changes
    )
  }

  async saveStudents(
    academicYearId: EntityId,
    groupId: EntityId,
    drafts: StudentDraft[]
  ) {
    return maProfessorRepository.saveStudentsForGroup(
      academicYearId,
      groupId,
      drafts
    )
  }

  async updateStudent(
    studentId: EntityId,
    changes: UpdateStudentWorkspaceInput
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.students.get(
        studentId
      )

    if (
      !current
    ) {
      throw new Error(
        'O aluno indicado não existe.'
      )
    }

    const number =
      changes.number ===
      undefined
        ? current.number
        : requireText(
            changes.number,
            'O número do aluno'
          )

    const name =
      changes.name ===
      undefined
        ? current.name
        : requireText(
            changes.name,
            'O nome do aluno'
          )

    const students =
      await maProfessorDb.students
        .where(
          'groupId'
        )
        .equals(
          current.groupId
        )
        .toArray()

    if (
      students.some(
        student =>
          student.id !==
            current.id &&
          normalizeForComparison(
            student.number
          ) ===
            normalizeForComparison(
              number
            )
      )
    ) {
      throw new Error(
        'Já existe outro aluno com este número na turma.'
      )
    }

    const updated: Student = {
      ...current,
      number,
      name,

      notes:
        changes.notes ===
        undefined
          ? current.notes
          : normalizeText(
              changes.notes
            ),

      active:
        changes.active ??
        current.active,

      updatedAt:
        now()
    }

    await maProfessorDb.students.put(
      updated
    )

    return updated
  }

  async setStudentActive(
    studentId: EntityId,
    active: boolean
  ) {
    await this.initialize()

    const current =
      await maProfessorDb.students.get(
        studentId
      )

    if (
      !current
    ) {
      throw new Error(
        'O aluno indicado não existe.'
      )
    }

    if (
      current.active ===
      active
    ) {
      return current
    }

    const membershipPeriods =
      current.membershipPeriods &&
      current.membershipPeriods.length >
        0
        ? active
          ? reopenStudentMembership(
              current.membershipPeriods,
              getLocalISODate()
            )
          : closeStudentMembership(
              current.membershipPeriods,
              getLocalISODate()
            )
        : current.membershipPeriods

    const updated: Student = {
      ...current,
      active,
      membershipPeriods,
      updatedAt:
        now()
    }

    await maProfessorDb.students.put(
      updated
    )

    return updated
  }
}

export const groupsWorkspaceRepository =
  new GroupsWorkspaceRepository()
