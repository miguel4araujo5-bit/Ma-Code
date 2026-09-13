import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AssessmentCriterion,
  AssessmentScheme,
  EntityId,
  LearningRecovery,
  Score
} from '../types'

export type RecoveryAssessmentScores =
  Record<EntityId, Score>

export type LearningRecoveryAssessmentRecord =
  LearningRecovery & {
    assessmentScores?:
      RecoveryAssessmentScores | null
    assessmentRecordedAt?:
      string | null
  }

export interface AdditionalCriterionScore {
  criterionId: EntityId
  score: Score
}

function now() {
  return new Date().toISOString()
}

function roundScore(
  value: number
): Score {
  return Math.round(value * 100) / 100
}

function sortCriteria(
  criteria: AssessmentCriterion[]
) {
  return [...criteria].sort(
    (left, right) =>
      left.order - right.order ||
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

export function resolveRecoveryAssessmentCriteria(
  teachingAssignmentId: EntityId,
  moduleId: EntityId,
  schemes: AssessmentScheme[],
  criteria: AssessmentCriterion[]
) {
  const activeSchemes =
    schemes.filter(
      scheme =>
        scheme.active &&
        scheme.teachingAssignmentId ===
          teachingAssignmentId
    )

  const moduleSchemes =
    activeSchemes.filter(
      scheme =>
        scheme.scope === 'module' &&
        scheme.moduleId === moduleId
    )

  if (moduleSchemes.length > 1) {
    throw new Error(
      'Existem vários conjuntos de critérios ativos para esta componente curricular.'
    )
  }

  const subjectSchemes =
    activeSchemes.filter(
      scheme =>
        scheme.scope === 'subject' &&
        scheme.moduleId === null
    )

  if (subjectSchemes.length > 1) {
    throw new Error(
      'Existem vários conjuntos de critérios gerais ativos para esta turma e disciplina.'
    )
  }

  const scheme =
    moduleSchemes[0] ??
    subjectSchemes[0] ??
    null

  if (!scheme) {
    return []
  }

  return sortCriteria(
    criteria.filter(
      criterion =>
        criterion.active &&
        criterion.schemeId === scheme.id
    )
  )
}

export function validateRecoveryAssessmentScore(
  value: number
): Score {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 20
  ) {
    throw new Error(
      'Cada classificação da recuperação deve estar entre 0 e 20 valores.'
    )
  }

  return roundScore(value)
}

export function normalizeRecoveryAssessmentScores(
  criteria: AssessmentCriterion[],
  scores: RecoveryAssessmentScores
): RecoveryAssessmentScores {
  if (criteria.length === 0) {
    throw new Error(
      'Não existem critérios de avaliação ativos para esta turma e disciplina.'
    )
  }

  const criterionIds =
    new Set(
      criteria.map(
        criterion => criterion.id
      )
    )

  const unknownIds =
    Object.keys(scores).filter(
      criterionId =>
        !criterionIds.has(criterionId)
    )

  if (unknownIds.length > 0) {
    throw new Error(
      'A recuperação contém classificações para critérios que já não estão ativos.'
    )
  }

  const normalized:
    RecoveryAssessmentScores = {}

  for (const criterion of criteria) {
    const value =
      scores[criterion.id]

    if (value === undefined) {
      throw new Error(
        'Preencha todos os critérios antes de usar a recuperação como avaliação adicional.'
      )
    }

    normalized[criterion.id] =
      validateRecoveryAssessmentScore(
        value
      )
  }

  return normalized
}

export function calculateRecoveryAssessmentGrade(
  criteria: AssessmentCriterion[],
  scores:
    RecoveryAssessmentScores | null | undefined
): Score | null {
  if (!scores || criteria.length === 0) {
    return null
  }

  let normalized:
    RecoveryAssessmentScores

  try {
    normalized =
      normalizeRecoveryAssessmentScores(
        criteria,
        scores
      )
  } catch {
    return null
  }

  const activeWeight =
    criteria.reduce(
      (total, criterion) =>
        total + criterion.weightPercent,
      0
    )

  if (activeWeight <= 0) {
    return null
  }

  const weightedTotal =
    criteria.reduce(
      (total, criterion) =>
        total +
        normalized[criterion.id] *
          criterion.weightPercent,
      0
    )

  return roundScore(
    weightedTotal / activeWeight
  )
}

function isCurrentRecoveryAssessment(
  recovery: LearningRecoveryAssessmentRecord,
  criteria: AssessmentCriterion[]
) {
  if (
    recovery.status !== 'completed' ||
    !recovery.completedAt ||
    !recovery.assessmentRecordedAt ||
    recovery.assessmentRecordedAt <
      recovery.completedAt
  ) {
    return false
  }

  return calculateRecoveryAssessmentGrade(
    criteria,
    recovery.assessmentScores
  ) !== null
}

export function listStudentRecoveryAssessmentGrades(
  recoveries: LearningRecovery[],
  criteria: AssessmentCriterion[],
  studentId: EntityId
): Score[] {
  return recoveries.flatMap(
    recovery => {
      const record =
        recovery as
          LearningRecoveryAssessmentRecord

      if (
        record.studentId !== studentId ||
        !isCurrentRecoveryAssessment(
          record,
          criteria
        )
      ) {
        return []
      }

      const grade =
        calculateRecoveryAssessmentGrade(
          criteria,
          record.assessmentScores
        )

      return grade === null
        ? []
        : [grade]
    }
  )
}

export function listStudentRecoveryCriterionScores(
  recoveries: LearningRecovery[],
  criteria: AssessmentCriterion[],
  studentId: EntityId
): AdditionalCriterionScore[] {
  return recoveries.flatMap(
    recovery => {
      const record =
        recovery as
          LearningRecoveryAssessmentRecord

      if (
        record.studentId !== studentId ||
        !isCurrentRecoveryAssessment(
          record,
          criteria
        ) ||
        !record.assessmentScores
      ) {
        return []
      }

      return criteria.map(
        criterion => ({
          criterionId: criterion.id,
          score:
            record.assessmentScores![
              criterion.id
            ]
        })
      )
    }
  )
}

async function readRecoveryAssessmentContext(
  recovery:
    LearningRecoveryAssessmentRecord
) {
  const [
    module,
    assignment,
    schemes,
    criteria
  ] = await Promise.all([
    maProfessorDb.modules.get(
      recovery.moduleId
    ),
    maProfessorDb.teachingAssignments.get(
      recovery.teachingAssignmentId
    ),
    maProfessorDb.assessmentSchemes
      .where('academicYearId')
      .equals(recovery.academicYearId)
      .toArray(),
    maProfessorDb.assessmentCriteria
      .toArray()
  ])

  if (
    !module ||
    !module.active ||
    module.academicYearId !==
      recovery.academicYearId ||
    module.teachingAssignmentId !==
      recovery.teachingAssignmentId
  ) {
    throw new Error(
      'A componente curricular associada à recuperação já não existe ou está inativa.'
    )
  }

  if (
    !assignment ||
    !assignment.active ||
    assignment.academicYearId !==
      recovery.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina associadas à recuperação já não existem ou estão inativas.'
    )
  }

  return resolveRecoveryAssessmentCriteria(
    assignment.id,
    module.id,
    schemes,
    criteria
  )
}

export class RecoveryAssessmentRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async listCriteria(
    teachingAssignmentId: EntityId,
    moduleId: EntityId
  ) {
    await this.initialize()

    const [
      module,
      assignment,
      schemes,
      criteria
    ] = await Promise.all([
      maProfessorDb.modules.get(moduleId),
      maProfessorDb.teachingAssignments.get(
        teachingAssignmentId
      ),
      maProfessorDb.assessmentSchemes
        .toArray(),
      maProfessorDb.assessmentCriteria
        .toArray()
    ])

    if (
      !module ||
      !module.active ||
      module.teachingAssignmentId !==
        teachingAssignmentId
    ) {
      throw new Error(
        'A componente curricular selecionada não pertence à turma e disciplina indicadas.'
      )
    }

    if (
      !assignment ||
      !assignment.active ||
      assignment.id !==
        module.teachingAssignmentId
    ) {
      throw new Error(
        'A turma e disciplina selecionadas já não existem ou estão inativas.'
      )
    }

    return resolveRecoveryAssessmentCriteria(
      assignment.id,
      module.id,
      schemes,
      criteria
    )
  }

  async saveAssessment(
    recoveryId: EntityId,
    scores: RecoveryAssessmentScores
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      [
        maProfessorDb.learningRecoveries,
        maProfessorDb.modules,
        maProfessorDb.teachingAssignments,
        maProfessorDb.assessmentSchemes,
        maProfessorDb.assessmentCriteria
      ],
      async () => {
        const current =
          await maProfessorDb
            .learningRecoveries
            .get(recoveryId) as
              LearningRecoveryAssessmentRecord |
              undefined

        if (!current) {
          throw new Error(
            'A recuperação indicada não existe.'
          )
        }

        if (
          current.status !== 'completed' ||
          !current.completedAt
        ) {
          throw new Error(
            'Conclua a recuperação antes de a usar como avaliação adicional.'
          )
        }

        const criteria =
          await readRecoveryAssessmentContext(
            current
          )

        const normalized =
          normalizeRecoveryAssessmentScores(
            criteria,
            scores
          )

        const timestamp = now()

        const updated:
          LearningRecoveryAssessmentRecord = {
          ...current,
          assessmentScores:
            normalized,
          assessmentRecordedAt:
            timestamp,
          teacherTouchedAt:
            timestamp,
          updatedAt:
            timestamp
        }

        await maProfessorDb
          .learningRecoveries
          .put(updated)

        return updated
      }
    )
  }

  async clearAssessment(
    recoveryId: EntityId
  ) {
    await this.initialize()

    return maProfessorDb.transaction(
      'rw',
      maProfessorDb.learningRecoveries,
      async () => {
        const current =
          await maProfessorDb
            .learningRecoveries
            .get(recoveryId) as
              LearningRecoveryAssessmentRecord |
              undefined

        if (!current) {
          throw new Error(
            'A recuperação indicada não existe.'
          )
        }

        const timestamp = now()

        const updated:
          LearningRecoveryAssessmentRecord = {
          ...current,
          assessmentScores: null,
          assessmentRecordedAt: null,
          teacherTouchedAt:
            timestamp,
          updatedAt:
            timestamp
        }

        await maProfessorDb
          .learningRecoveries
          .put(updated)

        return updated
      }
    )
  }
}

export const recoveryAssessmentRepository =
  new RecoveryAssessmentRepository()
