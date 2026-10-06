import type { AssessmentProfile, AssessmentScheme, EntityId, Student } from '../types'

export function schemeAssessmentProfile(scheme: AssessmentScheme): AssessmentProfile {
  return scheme.profile === 'acs' ? 'acs' : 'general'
}

export function studentAssessmentProfile(student: Student, moduleId: EntityId): AssessmentProfile {
  const preserved = student.assessmentProfilesByModule?.[moduleId]
  if (preserved === 'general' || preserved === 'acs') return preserved
  return student.usesAcs === true ? 'acs' : 'general'
}
