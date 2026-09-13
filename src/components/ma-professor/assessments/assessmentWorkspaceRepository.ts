import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  listStudentRecoveryAssessmentGrades,
  listStudentRecoveryCriterionScores
} from '../attendance/recoveryAssessmentRepository'

import type {
  ClassGroup,
  EntityId,
  FirstCycleQualitativeGrade,
  ModuleFinalGrade,
  Score
} from '../types'

import {
  calculateStudentCriterionGradeBreakdown,
  calculateStudentLessonGradeSummary,
  isGradeBearingAssessmentResult
} from './lessonGradeCalculation'

import {
  AssessmentWorkspaceRepository as AssessmentWorkspaceRepositoryBase,
  type AssessmentWorkspaceFilters,
  type AssessmentWorkspaceSnapshot,
  type SaveModuleFinalGradeInput as BaseSaveModuleFinalGradeInput
} from './assessmentWorkspaceRepositoryBase'

import {
  getSummativeAssessmentScale,
  isFirstCycleQualitativeGrade,
  usesNumericSuggestion,
  validateSummativeNumericValue
} from './regularAssessmentScale'

export type {
  AssessmentAssignmentOption,
  AssessmentModuleOption,
  AssessmentWorkspaceActivityRow,
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot,
  AssessmentWorkspaceStudentRow,
  AssessmentWorkspaceTotals
} from './assessmentWorkspaceRepositoryBase'

export interface SaveModuleFinalGradeInput
  extends BaseSaveModuleFinalGradeInput {
  qualitativeFinalGrade?:
    FirstCycleQualitativeGrade | null
  descriptiveAssessment?: string
}

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

function normalizeMultilineText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line =>
      line
        .trim()
        .replace(/\s+/g, ' ')
    )
    .filter(Boolean)
    .join('\n')
}

async function getGroupForModule(
  moduleId: string
): Promise<ClassGroup | null> {
  const module =
    await maProfessorDb.modules.get(
      moduleId
    )

  if (!module) {
    return null
  }

  const assignment =
    await maProfessorDb.teachingAssignments.get(
      module.teachingAssignmentId
    )

  if (!assignment) {
    return null
  }

  return (
    await maProfessorDb.groups.get(
      assignment.groupId
    )
  ) ?? null
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
      return {
        ...snapshot,
        totals: {
          ...snapshot.totals,
          confirmedGradeCount:
            snapshot.studentRows.filter(
              row =>
                row.gradeSummary
                  .confirmedFinalGrade !== null ||
                row.finalGradeRecord
                  ?.qualitativeFinalGrade != null
            ).length
        }
      }
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

    const [
      results,
      recoveries
    ] = await Promise.all([
      assessmentIds.length === 0
        ? Promise.resolve([])
        : maProfessorDb
            .assessmentResults
            .where(
              'assessmentId'
            )
            .anyOf(
              assessmentIds
            )
            .toArray(),
      maProfessorDb
        .learningRecoveries
        .where('moduleId')
        .equals(
          snapshot.selectedModule.id
        )
        .toArray()
    ])

    const activities =
      snapshot.activities.map(
        activity => {
          const gradeBearingResults =
            results.filter(
              result =>
                result.assessmentId ===
                  activity.assessment.id &&
                isGradeBearingAssessmentResult(
                  result
                )
            )

          return {
            ...activity,
            average:
              calculateAverage(
                gradeBearingResults.map(
                  result =>
                    result.score
                )
              ),
            complete:
              activity.complete &&
              activity.absentCount === 0
          }
        }
      )

    const allowNumericSuggestion =
      usesNumericSuggestion(
        snapshot.selectedGroup
      )

    const studentRows =
      snapshot.studentRows.map(
        row => {
          const recoveryGrades =
            listStudentRecoveryAssessmentGrades(
              recoveries,
              snapshot.criteria,
              row.student.id
            )

          const recoveryCriterionScores =
            listStudentRecoveryCriterionScores(
              recoveries,
              snapshot.criteria,
              row.student.id
            )

          const calculation =
            calculateStudentLessonGradeSummary(
              snapshot.criteria,
              assessments,
              results,
              row.student.id,
              recoveryGrades
            )

          const criteria =
            calculateStudentCriterionGradeBreakdown(
              snapshot.criteria,
              assessments,
              results,
              row.student.id,
              recoveryCriterionScores
            )

          return {
            ...row,
            gradeSummary: {
              ...row.gradeSummary,
              criteria,
              provisionalAverage:
                calculation.provisionalAverage,
              allActiveCriteriaAssessed:
                calculation.allEvaluatedLessonsComplete,
              suggestedGrade:
                allowNumericSuggestion
                  ? calculation.suggestedGrade
                  : null
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

    const completeActivityCount =
      activities.filter(
        activity =>
          activity.complete
      ).length

    return {
      ...snapshot,
      activities,
      studentRows,
      totals: {
        ...snapshot.totals,
        completeActivityCount,
        incompleteActivityCount:
          activities.length -
          completeActivityCount,
        studentsWithAssessment:
          provisionalAverages.length,
        confirmedGradeCount:
          studentRows.filter(
            row =>
              row.gradeSummary
                .confirmedFinalGrade !== null ||
              row.finalGradeRecord
                ?.qualitativeFinalGrade != null
          ).length,
        classAverage:
          calculateAverage(
            provisionalAverages
          )
      }
    }
  }

  private async saveFirstCycleQualitativeFinalGrade(
    input: SaveModuleFinalGradeInput,
    group: ClassGroup
  ) {
    await openMAProfessorDatabase()

    if (
      getSummativeAssessmentScale(group)
        .kind !== 'qualitative'
    ) {
      throw new Error(
        'A avaliação qualitativa só pode ser usada em turmas do 1.º ciclo.'
      )
    }

    if (input.finalGrade !== null) {
      validateSummativeNumericValue(
        group,
        input.finalGrade,
        'classificação final'
      )
    }

    if (
      input.selfAssessmentGrade !== undefined &&
      input.selfAssessmentGrade !== null
    ) {
      validateSummativeNumericValue(
        group,
        input.selfAssessmentGrade,
        'autoavaliação'
      )
    }

    const module =
      await maProfessorDb.modules.get(
        input.moduleId
      )

    if (!module || !module.active) {
      throw new Error(
        'A componente anual indicada não existe ou está inativa.'
      )
    }

    const assignment =
      await maProfessorDb
        .teachingAssignments
        .get(
          module.teachingAssignmentId
        )

    if (
      !assignment ||
      !assignment.active ||
      assignment.groupId !== group.id
    ) {
      throw new Error(
        'A turma e disciplina associadas à componente anual já não existem ou estão inativas.'
      )
    }

    const student =
      await maProfessorDb.students.get(
        input.studentId
      )

    if (
      !student ||
      !student.active ||
      student.groupId !== group.id ||
      student.academicYearId !==
        module.academicYearId
    ) {
      throw new Error(
        'O aluno indicado não pertence a esta turma.'
      )
    }

    const existingRecords =
      await maProfessorDb
        .moduleFinalGrades
        .where(
          '[moduleId+studentId]'
        )
        .equals([
          module.id,
          student.id
        ])
        .toArray()

    const existing =
      [...existingRecords]
        .sort(
          (left, right) =>
            right.updatedAt.localeCompare(
              left.updatedAt
            )
        )[0] ?? null

    const qualitativeFinalGrade =
      input.qualitativeFinalGrade === undefined
        ? existing
            ?.qualitativeFinalGrade ?? null
        : input.qualitativeFinalGrade

    if (
      qualitativeFinalGrade !== null &&
      !isFirstCycleQualitativeGrade(
        qualitativeFinalGrade
      )
    ) {
      throw new Error(
        'Selecione uma menção qualitativa válida: Muito Bom, Bom, Suficiente ou Insuficiente.'
      )
    }

    const descriptiveAssessment =
      input.descriptiveAssessment === undefined
        ? existing
            ?.descriptiveAssessment ?? ''
        : normalizeMultilineText(
            input.descriptiveAssessment
          )

    if (
      qualitativeFinalGrade !== null &&
      !descriptiveAssessment
    ) {
      throw new Error(
        'Registe uma apreciação descritiva antes de confirmar a avaliação do 1.º ciclo.'
      )
    }

    if (
      qualitativeFinalGrade === null &&
      descriptiveAssessment
    ) {
      throw new Error(
        'Selecione uma menção qualitativa antes de guardar a apreciação descritiva.'
      )
    }

    if (
      qualitativeFinalGrade === null &&
      !descriptiveAssessment &&
      !existing
    ) {
      return null
    }

    const workspace =
      await this.getWorkspace(
        module.academicYearId,
        {
          teachingAssignmentId:
            assignment.id,
          moduleId:
            module.id
        }
      )

    const studentRow =
      workspace.studentRows.find(
        row =>
          row.student.id ===
            student.id
      )

    const timestamp = now()
    const sameConfirmation =
      existing
        ?.qualitativeFinalGrade ===
        qualitativeFinalGrade &&
      (
        existing
          ?.descriptiveAssessment ?? ''
      ) === descriptiveAssessment

    const confirmedAt =
      qualitativeFinalGrade === null
        ? null
        : sameConfirmation &&
            existing?.confirmedAt
          ? existing.confirmedAt
          : timestamp

    const record: ModuleFinalGrade = {
      id:
        existing?.id ??
        createEntityId(
          'module-final-grade'
        ),
      academicYearId:
        module.academicYearId,
      teachingAssignmentId:
        assignment.id,
      moduleId:
        module.id,
      studentId:
        student.id,
      calculatedAverage:
        studentRow?.gradeSummary
          .provisionalAverage ??
        existing?.calculatedAverage ??
        0,
      suggestedGrade:
        existing?.suggestedGrade ?? 0,
      selfAssessmentGrade: null,
      usesAcs:
        existing?.usesAcs ?? false,
      finalGrade: null,
      qualitativeFinalGrade,
      descriptiveAssessment,
      confirmedAt,
      note:
        existing?.note ?? '',
      createdAt:
        existing?.createdAt ?? timestamp,
      updatedAt: timestamp
    }

    const duplicateIds =
      existingRecords
        .filter(
          current =>
            current.id !== record.id
        )
        .map(current => current.id)

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.moduleFinalGrades,
      async () => {
        if (duplicateIds.length > 0) {
          await maProfessorDb
            .moduleFinalGrades
            .bulkDelete(
              duplicateIds
            )
        }

        await maProfessorDb
          .moduleFinalGrades
          .put(record)
      }
    )

    return record
  }

  async saveModuleFinalGrade(
    input: SaveModuleFinalGradeInput
  ) {
    const group =
      await getGroupForModule(
        input.moduleId
      )

    if (
      input.qualitativeFinalGrade !== undefined ||
      input.descriptiveAssessment !== undefined
    ) {
      if (
        !group ||
        getSummativeAssessmentScale(group)
          .kind !== 'qualitative'
      ) {
        throw new Error(
          'A avaliação qualitativa só pode ser usada em turmas do 1.º ciclo.'
        )
      }

      return this
        .saveFirstCycleQualitativeFinalGrade(
          input,
          group
        )
    }

    if (
      group?.educationType ===
      'regular'
    ) {
      if (
        getSummativeAssessmentScale(group)
          .kind === 'qualitative'
      ) {
        return this
          .saveFirstCycleQualitativeFinalGrade(
            input,
            group
          )
      }

      if (
        input.finalGrade !== null
      ) {
        validateSummativeNumericValue(
          group,
          input.finalGrade,
          'classificação final'
        )
      }

      if (
        input.selfAssessmentGrade !== undefined &&
        input.selfAssessmentGrade !== null
      ) {
        validateSummativeNumericValue(
          group,
          input.selfAssessmentGrade,
          'autoavaliação'
        )
      }
    }

    return super.saveModuleFinalGrade(
      input
    )
  }
}

export const assessmentWorkspaceRepository =
  new AssessmentWorkspaceRepository()
