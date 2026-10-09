import type { AssessmentProfile, AssessmentScheme, EntityId, Student } from '../types'

export function schemeAssessmentProfile(scheme: AssessmentScheme): AssessmentProfile {
  return scheme.profile === 'acs' ? 'acs' : 'general'
}

export function studentAssignmentAssessmentProfile(student: Student | undefined, teachingAssignmentId: EntityId): AssessmentProfile {
  return student?.assessmentProfilesByAssignment?.[teachingAssignmentId] ??
    (student?.usesAcs === true ? 'acs' : 'general')
}

export function studentAssessmentProfile(student: Student, moduleId: EntityId, teachingAssignmentId: EntityId): AssessmentProfile {
  const preserved = student.assessmentProfilesByModule?.[moduleId]
  if (preserved === 'general' || preserved === 'acs') return preserved
  return studentAssignmentAssessmentProfile(student, teachingAssignmentId)
}

export function canRestoreStudentAssessmentDraft(student: Student, moduleId: EntityId, draftUpdatedAt: string) {
  const resetAt = student.assessmentResetAtByModule?.[moduleId]
  return !resetAt || draftUpdatedAt > resetAt
}
