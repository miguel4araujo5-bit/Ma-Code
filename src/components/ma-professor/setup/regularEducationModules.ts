import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  ClassGroup,
  EntityId,
  ModuleUnit,
  Subject,
  TeachingAssignment
} from '../types'

export const REGULAR_ANNUAL_MODULE_KIND =
  'regular_annual' as const

type RegularAnnualModule =
  ModuleUnit & {
    moduleKind?:
      typeof REGULAR_ANNUAL_MODULE_KIND
  }

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
}

export function isRegularAnnualModule(
  module: ModuleUnit
) {
  return (
    module as RegularAnnualModule
  ).moduleKind ===
    REGULAR_ANNUAL_MODULE_KIND
}

export function isRegularEducationGroup(
  group: ClassGroup
) {
  return group.educationType ===
    'regular'
}

export function isProfessionalEducationGroup(
  group: ClassGroup
) {
  return !isRegularEducationGroup(
    group
  )
}

export function getProfessionalAssignments(
  assignments:
    TeachingAssignment[],
  groups:
    ClassGroup[]
) {
  const groupById =
    new Map(
      groups.map(group => [
        group.id,
        group
      ])
    )

  return assignments.filter(
    assignment => {
      const group =
        groupById.get(
          assignment.groupId
        )

      return Boolean(
        assignment.active &&
        group?.active &&
        isProfessionalEducationGroup(
          group
        )
      )
    }
  )
}

export async function ensureRegularAnnualModules(
  academicYearId: EntityId
) {
  await openMAProfessorDatabase()

  return maProfessorDb.transaction(
    'rw',
    [
      maProfessorDb.groups,
      maProfessorDb.subjects,
      maProfessorDb.teachingAssignments,
      maProfessorDb.modules
    ],
    async () => {
      const [
        groups,
        subjects,
        assignments,
        modules
      ] = await Promise.all([
        maProfessorDb.groups
          .where('academicYearId')
          .equals(academicYearId)
          .toArray(),
        maProfessorDb.subjects
          .where('academicYearId')
          .equals(academicYearId)
          .toArray(),
        maProfessorDb.teachingAssignments
          .where('academicYearId')
          .equals(academicYearId)
          .toArray(),
        maProfessorDb.modules
          .where('academicYearId')
          .equals(academicYearId)
          .toArray()
      ])

      const groupById =
        new Map<EntityId, ClassGroup>(
          groups.map(group => [
            group.id,
            group
          ])
        )

      const subjectById =
        new Map<EntityId, Subject>(
          subjects.map(subject => [
            subject.id,
            subject
          ])
        )

      const modulesByAssignment =
        new Map<
          EntityId,
          ModuleUnit[]
        >()

      modules.forEach(module => {
        const assignmentModules =
          modulesByAssignment.get(
            module.teachingAssignmentId
          ) ?? []

        assignmentModules.push(
          module
        )

        modulesByAssignment.set(
          module.teachingAssignmentId,
          assignmentModules
        )
      })

      const created:
        ModuleUnit[] = []

      for (const assignment of assignments) {
        if (!assignment.active) {
          continue
        }

        const group =
          groupById.get(
            assignment.groupId
          )

        const subject =
          subjectById.get(
            assignment.subjectId
          )

        if (
          !group?.active ||
          !subject?.active ||
          !isRegularEducationGroup(
            group
          )
        ) {
          continue
        }

        const assignmentModules =
          modulesByAssignment.get(
            assignment.id
          ) ?? []

        const existingRegular =
          assignmentModules.find(
            isRegularAnnualModule
          )

        if (existingRegular) {
          if (
            !existingRegular.active ||
            existingRegular.name !==
              subject.name ||
            existingRegular.code !== '' ||
            existingRegular.plannedPeriods !==
              0
          ) {
            const updated = {
              ...existingRegular,
              code: '',
              name: subject.name,
              plannedPeriods: 0,
              order: 1,
              plannedStartDate: null,
              plannedEndDate: null,
              active: true,
              updatedAt: now()
            } satisfies RegularAnnualModule

            await maProfessorDb.modules.put(
              updated
            )
          }

          continue
        }

        if (
          assignmentModules.some(
            module => module.active
          )
        ) {
          continue
        }

        const timestamp = now()

        const annualModule = {
          id:
            createEntityId(
              'module'
            ),
          academicYearId,
          teachingAssignmentId:
            assignment.id,
          code: '',
          name: subject.name,
          plannedPeriods: 0,
          order: 1,
          plannedStartDate: null,
          plannedEndDate: null,
          active: true,
          moduleKind:
            REGULAR_ANNUAL_MODULE_KIND,
          createdAt:
            timestamp,
          updatedAt:
            timestamp
        } satisfies RegularAnnualModule

        await maProfessorDb.modules.add(
          annualModule
        )

        created.push(
          annualModule
        )
      }

      return created
    }
  )
}
