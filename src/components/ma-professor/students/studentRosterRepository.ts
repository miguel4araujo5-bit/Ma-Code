import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  maProfessorRepository,
  type StudentDraft
} from '../repository'

import type {
  EntityId,
  ISODate,
  Student
} from '../types'

import {
  createInitialStudentMembership,
  getLocalISODate
} from './studentMembership'

function clampToAcademicYear(
  date: ISODate,
  startDate: ISODate,
  endDate: ISODate
) {
  if (
    date <
    startDate
  ) {
    return startDate
  }

  if (
    date >
    endDate
  ) {
    return endDate
  }

  return date
}

export async function saveStudentsForGroupWithMembership(
  academicYearId: EntityId,
  groupId: EntityId,
  drafts: StudentDraft[]
) {
  await openMAProfessorDatabase()

  const [
    academicYear,
    group,
    existingStudents,
    assignments,
    lessons
  ] =
    await Promise.all([
      maProfessorDb
        .academicYears
        .get(
          academicYearId
        ),
      maProfessorDb
        .groups
        .get(
          groupId
        ),
      maProfessorDb
        .students
        .where(
          'groupId'
        )
        .equals(
          groupId
        )
        .toArray(),
      maProfessorDb
        .teachingAssignments
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),
      maProfessorDb
        .lessons
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()
    ])

  if (
    !academicYear ||
    !group ||
    group.academicYearId !==
      academicYearId
  ) {
    throw new Error(
      'A turma indicada não pertence ao ano letivo selecionado.'
    )
  }

  const existingStudentIds =
    new Set(
      existingStudents.map(
        student =>
          student.id
      )
    )

  const groupAssignmentIds =
    new Set(
      assignments
        .filter(
          assignment =>
            assignment.groupId ===
              groupId
        )
        .map(
          assignment =>
            assignment.id
        )
    )

  const hasTaughtLesson =
    lessons.some(
      lesson =>
        lesson.status ===
          'taught' &&
        groupAssignmentIds.has(
          lesson.teachingAssignmentId
        )
    )

  const membershipStartDate =
    hasTaughtLesson
      ? clampToAcademicYear(
          getLocalISODate(),
          academicYear.startDate,
          academicYear.endDate
        )
      : academicYear.startDate

  const saved =
    await maProfessorRepository
      .saveStudentsForGroup(
        academicYearId,
        groupId,
        drafts
      )

  const timestamp =
    new Date().toISOString()

  const updated:
    Student[] =
    saved.map(
      student => {
        if (
          existingStudentIds.has(
            student.id
          )
        ) {
          return student
        }

        return {
          ...student,
          membershipPeriods:
            createInitialStudentMembership(
              membershipStartDate
            ),
          updatedAt:
            timestamp
        }
      }
    )

  const newStudents =
    updated.filter(
      student =>
        !existingStudentIds.has(
          student.id
        )
    )

  if (
    newStudents.length >
    0
  ) {
    await maProfessorDb
      .students
      .bulkPut(
        newStudents
      )
  }

  return updated
}
