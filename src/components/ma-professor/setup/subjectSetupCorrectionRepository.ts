import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId
} from '../types'

async function hasProtectedTeachingAssignmentData(
  teachingAssignmentId: EntityId
) {
  const counts =
    await Promise.all([
      maProfessorDb.modules
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.assessmentSchemes
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.planifications
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.schoolCalendarEvents
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.lessons
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.lessonAssessments
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.moduleFinalGrades
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count(),
      maProfessorDb.learningRecoveries
        .where('teachingAssignmentId')
        .equals(teachingAssignmentId)
        .count()
    ])

  return counts.some(count => count > 0)
}

async function assertAssignmentsCanBeRemoved(
  teachingAssignmentIds: EntityId[]
) {
  const protectedFlags =
    await Promise.all(
      teachingAssignmentIds.map(
        hasProtectedTeachingAssignmentData
      )
    )

  if (protectedFlags.some(Boolean)) {
    throw new Error(
      'Não é possível retirar esta disciplina porque uma das associações já tem módulos, planificações, avaliações, calendário pedagógico ou aulas. Corrija primeiro esses dados; o MA-Professor não os apaga automaticamente.'
    )
  }
}

async function deleteSetupAssignments(
  teachingAssignmentIds: EntityId[]
) {
  if (teachingAssignmentIds.length === 0) {
    return
  }

  for (const id of teachingAssignmentIds) {
    await maProfessorDb.weeklyScheduleSlots
      .where('teachingAssignmentId')
      .equals(id)
      .delete()
  }

  await maProfessorDb.teachingAssignments
    .bulkDelete(teachingAssignmentIds)
}

export async function removeSubjectAssignmentsFromSetup(
  subjectId: EntityId,
  retainedGroupIds: EntityId[]
) {
  await openMAProfessorDatabase()

  const retained =
    new Set(retainedGroupIds)

  const assignments =
    await maProfessorDb.teachingAssignments
      .where('subjectId')
      .equals(subjectId)
      .toArray()

  const toRemove =
    assignments.filter(
      assignment =>
        !retained.has(assignment.groupId)
    )

  if (toRemove.length === 0) {
    return 0
  }

  const ids =
    toRemove.map(assignment => assignment.id)

  await assertAssignmentsCanBeRemoved(ids)

  await maProfessorDb.transaction(
    'rw',
    maProfessorDb.weeklyScheduleSlots,
    maProfessorDb.teachingAssignments,
    async () => {
      await deleteSetupAssignments(ids)
    }
  )

  return ids.length
}

export async function removeSubjectFromSetup(
  subjectId: EntityId
) {
  await openMAProfessorDatabase()

  const subject =
    await maProfessorDb.subjects.get(subjectId)

  if (!subject) {
    throw new Error(
      'A disciplina indicada já não existe.'
    )
  }

  const assignments =
    await maProfessorDb.teachingAssignments
      .where('subjectId')
      .equals(subjectId)
      .toArray()

  const ids =
    assignments.map(
      assignment => assignment.id
    )

  await assertAssignmentsCanBeRemoved(ids)

  await maProfessorDb.transaction(
    'rw',
    maProfessorDb.weeklyScheduleSlots,
    maProfessorDb.teachingAssignments,
    maProfessorDb.subjects,
    async () => {
      await deleteSetupAssignments(ids)
      await maProfessorDb.subjects.delete(subjectId)
    }
  )

  return {
    removedAssignments: ids.length
  }
}
