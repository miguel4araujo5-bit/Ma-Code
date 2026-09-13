import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AssessmentCriterion,
  AssessmentScheme,
  EntityId
} from '../types'

export interface AssessmentCriteriaEvidence {
  lessonAssessmentCount: number
  assessmentResultCount: number
  finalGradeCount: number
}

export interface AssessmentCriteriaEditability {
  editable: boolean
  evidence: AssessmentCriteriaEvidence
}

export interface AssessmentCriteriaManagementCriterionInput {
  id?: EntityId
  name: string
  description?: string
  weightPercent: number
}

export interface UpdateAssessmentCriteriaSchemeInput {
  schemeId: EntityId
  name: string
  criteria: AssessmentCriteriaManagementCriterionInput[]
}

export interface UpdatedAssessmentCriteriaScheme {
  scheme: AssessmentScheme
  criteria: AssessmentCriterion[]
}

export class AssessmentCriteriaHistoryError extends Error {
  readonly code = 'ASSESSMENT_CRITERIA_HISTORY_EXISTS'

  constructor(
    readonly evidence: AssessmentCriteriaEvidence
  ) {
    super(
      'Este conjunto de critérios já é usado por avaliações ou classificações. Para preservar o histórico, pode consultá-lo mas já não pode alterar nomes ou ponderações.'
    )

    this.name = 'AssessmentCriteriaHistoryError'
  }
}

const WEIGHT_TOLERANCE = 0.001

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeText(
  value: string
) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function requireText(
  value: string,
  label: string
) {
  const normalized =
    normalizeText(value)

  if (!normalized) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function validateCriteria(
  criteria: AssessmentCriteriaManagementCriterionInput[]
) {
  if (criteria.length === 0) {
    throw new Error(
      'Adicione pelo menos um critério de avaliação.'
    )
  }

  const names = new Set<string>()
  const ids = new Set<EntityId>()

  criteria.forEach(criterion => {
    const name =
      requireText(
        criterion.name,
        'O nome do critério'
      )

    const normalizedName =
      name.toLocaleLowerCase('pt-PT')

    if (names.has(normalizedName)) {
      throw new Error(
        `O critério “${name}” está repetido.`
      )
    }

    if (
      criterion.id &&
      ids.has(criterion.id)
    ) {
      throw new Error(
        'O mesmo critério não pode ser enviado mais do que uma vez.'
      )
    }

    if (
      !Number.isFinite(
        criterion.weightPercent
      ) ||
      criterion.weightPercent <= 0 ||
      criterion.weightPercent > 100
    ) {
      throw new Error(
        `A ponderação do critério “${name}” deve estar entre 0 e 100%.`
      )
    }

    names.add(normalizedName)

    if (criterion.id) {
      ids.add(criterion.id)
    }
  })

  const total =
    criteria.reduce(
      (sum, criterion) =>
        sum + criterion.weightPercent,
      0
    )

  if (
    Math.abs(total - 100) >
    WEIGHT_TOLERANCE
  ) {
    throw new Error(
      `Os critérios devem totalizar 100%. Total atual: ${total}%.`
    )
  }
}

async function readScheme(
  schemeId: EntityId
) {
  const scheme =
    await maProfessorDb
      .assessmentSchemes
      .get(schemeId)

  if (!scheme || !scheme.active) {
    throw new Error(
      'O conjunto de critérios selecionado já não existe ou está inativo.'
    )
  }

  const criteria =
    await maProfessorDb
      .assessmentCriteria
      .where('schemeId')
      .equals(schemeId)
      .toArray()

  return {
    scheme,
    criteria
  }
}

async function readEvidence(
  scheme: AssessmentScheme,
  criteria: AssessmentCriterion[]
): Promise<AssessmentCriteriaEvidence> {
  const criterionIds =
    criteria.map(
      criterion => criterion.id
    )

  const lessonAssessments =
    criterionIds.length === 0
      ? []
      : await maProfessorDb
          .lessonAssessments
          .where('criterionId')
          .anyOf(criterionIds)
          .toArray()

  const assessmentResultCount =
    lessonAssessments.length === 0
      ? 0
      : await maProfessorDb
          .assessmentResults
          .where('assessmentId')
          .anyOf(
            lessonAssessments.map(
              assessment =>
                assessment.id
            )
          )
          .count()

  const finalGradeCount =
    scheme.scope === 'module' &&
    scheme.moduleId
      ? await maProfessorDb
          .moduleFinalGrades
          .where('moduleId')
          .equals(scheme.moduleId)
          .count()
      : await maProfessorDb
          .moduleFinalGrades
          .where('teachingAssignmentId')
          .equals(
            scheme.teachingAssignmentId
          )
          .count()

  return {
    lessonAssessmentCount:
      lessonAssessments.length,
    assessmentResultCount,
    finalGradeCount
  }
}

function hasEvidence(
  evidence: AssessmentCriteriaEvidence
) {
  return (
    evidence.lessonAssessmentCount > 0 ||
    evidence.assessmentResultCount > 0 ||
    evidence.finalGradeCount > 0
  )
}

function assertInputCriterionIdsBelongToScheme(
  input: UpdateAssessmentCriteriaSchemeInput,
  existingCriteria: AssessmentCriterion[]
) {
  const existingIds =
    new Set(
      existingCriteria.map(
        criterion => criterion.id
      )
    )

  const invalidId =
    input.criteria.find(
      criterion =>
        criterion.id &&
        !existingIds.has(
          criterion.id
        )
    )?.id

  if (invalidId) {
    throw new Error(
      'Um dos critérios indicados não pertence ao conjunto selecionado.'
    )
  }
}

function buildCriteria(
  schemeId: EntityId,
  input: AssessmentCriteriaManagementCriterionInput[],
  existingCriteria: AssessmentCriterion[]
) {
  const existingById =
    new Map(
      existingCriteria.map(
        criterion => [
          criterion.id,
          criterion
        ]
      )
    )

  const timestamp = now()

  return input.map(
    (criterion, index): AssessmentCriterion => {
      const existing =
        criterion.id
          ? existingById.get(
              criterion.id
            )
          : undefined

      return {
        id:
          existing?.id ??
          createEntityId('criterion'),
        schemeId,
        name:
          requireText(
            criterion.name,
            'O nome do critério'
          ),
        description:
          normalizeText(
            criterion.description ?? ''
          ),
        weightPercent:
          criterion.weightPercent,
        order: index + 1,
        active: true,
        createdAt:
          existing?.createdAt ??
          timestamp,
        updatedAt: timestamp
      }
    }
  )
}

export class AssessmentCriteriaManagementRepository {
  async getEditability(
    schemeId: EntityId
  ): Promise<AssessmentCriteriaEditability> {
    await openMAProfessorDatabase()

    const {
      scheme,
      criteria
    } = await readScheme(schemeId)

    const evidence =
      await readEvidence(
        scheme,
        criteria
      )

    return {
      editable:
        !hasEvidence(evidence),
      evidence
    }
  }

  async updateScheme(
    input: UpdateAssessmentCriteriaSchemeInput
  ): Promise<UpdatedAssessmentCriteriaScheme> {
    await openMAProfessorDatabase()

    validateCriteria(
      input.criteria
    )

    const normalizedName =
      requireText(
        input.name,
        'O nome do conjunto de critérios'
      )

    return maProfessorDb.transaction(
      'rw',
      [
        maProfessorDb.assessmentSchemes,
        maProfessorDb.assessmentCriteria,
        maProfessorDb.lessonAssessments,
        maProfessorDb.assessmentResults,
        maProfessorDb.moduleFinalGrades
      ],
      async () => {
        const {
          scheme,
          criteria: existingCriteria
        } = await readScheme(
          input.schemeId
        )

        assertInputCriterionIdsBelongToScheme(
          input,
          existingCriteria
        )

        const evidence =
          await readEvidence(
            scheme,
            existingCriteria
          )

        if (hasEvidence(evidence)) {
          throw new AssessmentCriteriaHistoryError(
            evidence
          )
        }

        const timestamp = now()
        const updatedScheme: AssessmentScheme = {
          ...scheme,
          name: normalizedName,
          updatedAt: timestamp
        }

        const nextCriteria =
          buildCriteria(
            scheme.id,
            input.criteria,
            existingCriteria
          )

        const nextIds =
          new Set(
            nextCriteria.map(
              criterion => criterion.id
            )
          )

        const deletedIds =
          existingCriteria
            .filter(
              criterion =>
                !nextIds.has(
                  criterion.id
                )
            )
            .map(
              criterion => criterion.id
            )

        await maProfessorDb
          .assessmentSchemes
          .put(updatedScheme)

        if (deletedIds.length > 0) {
          await maProfessorDb
            .assessmentCriteria
            .bulkDelete(deletedIds)
        }

        await maProfessorDb
          .assessmentCriteria
          .bulkPut(nextCriteria)

        return {
          scheme: updatedScheme,
          criteria: nextCriteria
        }
      }
    )
  }
}

export const assessmentCriteriaManagementRepository =
  new AssessmentCriteriaManagementRepository()
