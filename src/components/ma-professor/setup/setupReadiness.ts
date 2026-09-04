import type {
  SetupSnapshot
} from '../repository'

import type {
  EntityId
} from '../types'

export interface MAProfessorSetupReadiness {
  operationalReady: boolean
  fullSetupCompleted: boolean
  activeAssignmentIds: EntityId[]
  assignmentsWithoutModules: EntityId[]
  assignmentsWithoutSchedule: EntityId[]
}

function getActiveAssignmentIds(
  snapshot: SetupSnapshot
) {
  const activeGroupIds =
    new Set(
      snapshot.groups
        .filter(group => group.active)
        .map(group => group.id)
    )

  const activeSubjectIds =
    new Set(
      snapshot.subjects
        .filter(subject => subject.active)
        .map(subject => subject.id)
    )

  return snapshot.teachingAssignments
    .filter(
      assignment =>
        assignment.active &&
        activeGroupIds.has(
          assignment.groupId
        ) &&
        activeSubjectIds.has(
          assignment.subjectId
        )
    )
    .map(assignment => assignment.id)
}

export function hasCompleteScheduleCoverage(
  snapshot: SetupSnapshot
) {
  const activeAssignmentIds =
    getActiveAssignmentIds(
      snapshot
    )

  if (
    activeAssignmentIds.length ===
    0
  ) {
    return false
  }

  const scheduledAssignmentIds =
    new Set(
      snapshot.weeklyScheduleSlots
        .filter(slot => slot.active)
        .map(
          slot =>
            slot.teachingAssignmentId
        )
    )

  return activeAssignmentIds.every(
    assignmentId =>
      scheduledAssignmentIds.has(
        assignmentId
      )
  )
}

export function getMAProfessorSetupReadiness(
  snapshot: SetupSnapshot
): MAProfessorSetupReadiness {
  const activeAssignmentIds =
    getActiveAssignmentIds(
      snapshot
    )

  const moduleAssignmentIds =
    new Set(
      snapshot.modules
        .filter(module => module.active)
        .map(
          module =>
            module.teachingAssignmentId
        )
    )

  const scheduledAssignmentIds =
    new Set(
      snapshot.weeklyScheduleSlots
        .filter(slot => slot.active)
        .map(
          slot =>
            slot.teachingAssignmentId
        )
    )

  const assignmentsWithoutModules =
    activeAssignmentIds.filter(
      assignmentId =>
        !moduleAssignmentIds.has(
          assignmentId
        )
    )

  const assignmentsWithoutSchedule =
    activeAssignmentIds.filter(
      assignmentId =>
        !scheduledAssignmentIds.has(
          assignmentId
        )
    )

  return {
    operationalReady:
      activeAssignmentIds.length >
        0 &&
      assignmentsWithoutModules.length ===
        0 &&
      assignmentsWithoutSchedule.length ===
        0,
    fullSetupCompleted:
      Boolean(
        snapshot.progress?.completedAt
      ),
    activeAssignmentIds,
    assignmentsWithoutModules,
    assignmentsWithoutSchedule
  }
}

export function isMAProfessorOperationallyReady(
  snapshot: SetupSnapshot
) {
  return getMAProfessorSetupReadiness(
    snapshot
  ).operationalReady
}
