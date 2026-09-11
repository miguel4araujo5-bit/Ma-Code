import {
  maProfessorDb
} from '../db'

import type {
  Score
} from '../types'

import {
  calculateStudentLessonGradeSummary
} from './lessonGradeCalculation'

import {
  AssessmentWorkspaceRepository as AssessmentWorkspaceRepositoryBase,
  type AssessmentWorkspaceFilters,
  type AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepositoryBase'

export type {
  AssessmentAssignmentOption,
  AssessmentModuleOption,
  AssessmentWorkspaceActivityRow,
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot,
  AssessmentWorkspaceStudentRow,
  AssessmentWorkspaceTotals,
  SaveModuleFinalGradeInput
} from './assessmentWorkspaceRepositoryBase'

function calculateAverage(
  scores: number[]
): Score | null {
  if (
    scores.length === 0
  ) {
    return null
  }

  return (
    Math.round(
      (
        scores.reduce(
          (
            total,
            score
          ) =>
            total + score,
          0
        ) /
        scores.length
      ) * 100
    ) / 100
  )
}

export class AssessmentWorkspaceRepository extends AssessmentWorkspaceRepositoryBase {
  async getWorkspace(
    academicYearId: string,
    filters:
      AssessmentWorkspaceFilters = {}
  ): Promise<AssessmentWorkspaceSnapshot> {
    const snapshot =
      await super.getWorkspace(
        academicYearId,
        filters
      )

    if (
      !snapshot.selectedModule ||
      snapshot.criteria.length === 0 ||
      snapshot.activities.length === 0 ||
      snapshot.studentRows.length === 0
    ) {
      return snapshot
    }

    const assessments =
      snapshot.activities.map(
        activity =>
          activity.assessment
      )

    const assessmentIds =
      assessments.map(
        assessment =>
          assessment.id
      )

    const results =
      assessmentIds.length === 0
        ? []
        : await maProfessorDb
            .assessmentResults
            .where(
              'assessmentId'
            )
            .anyOf(
              assessmentIds
            )
            .toArray()

    const studentRows =
      snapshot.studentRows.map(
        row => {
          const calculation =
            calculateStudentLessonGradeSummary(
              snapshot.criteria,
              assessments,
              results,
              row.student.id
            )

          return {
            ...row,
            gradeSummary: {
              ...row.gradeSummary,
              provisionalAverage:
                calculation.provisionalAverage,
              allActiveCriteriaAssessed:
                calculation.allEvaluatedLessonsComplete,
              suggestedGrade:
                calculation.suggestedGrade
            }
          }
        }
      )

    const provisionalAverages =
      studentRows.flatMap(
        row =>
          row.gradeSummary
            .provisionalAverage === null
            ? []
            : [
                row.gradeSummary
                  .provisionalAverage
              ]
      )

    return {
      ...snapshot,
      studentRows,
      totals: {
        ...snapshot.totals,
        studentsWithAssessment:
          provisionalAverages.length,
        classAverage:
          calculateAverage(
            provisionalAverages
          )
      }
    }
  }
}

export const assessmentWorkspaceRepository =
  new AssessmentWorkspaceRepository()
