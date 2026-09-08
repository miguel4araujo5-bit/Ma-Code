import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import type {
  AssessmentCriterion,
  AssessmentScheme,
  EntityId,
  TeachingAssignment
} from './types'

export interface SubjectAssessmentCriterionDraft {
  name: string
  description?: string
  weightPercent: number
  order?: number
  active?: boolean
}

export interface CreateSubjectAssessmentSchemesBatchInput {
  academicYearId: EntityId
  teachingAssignmentIds: EntityId[]
  name: string
  criteria: SubjectAssessmentCriterionDraft[]
  active?: boolean
}

export interface CreatedSubjectAssessmentScheme {
  scheme: AssessmentScheme
  criteria: AssessmentCriterion[]
}

const WEIGHT_TOLERANCE = 0.001

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

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
    .replace(
      /\s+/g,
      ' '
    )
}

function normalizeForComparison(
  value: string
) {
  return normalizeText(
    value
  ).toLocaleLowerCase(
    'pt-PT'
  )
}

function requireText(
  value: string,
  label: string
) {
  const normalized =
    normalizeText(
      value
    )

  if (!normalized) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function assertAssignmentIds(
  teachingAssignmentIds:
    EntityId[]
) {
  if (
    teachingAssignmentIds.length ===
    0
  ) {
    throw new Error(
      'Selecione pelo menos uma turma e disciplina.'
    )
  }

  const uniqueIds =
    new Set(
      teachingAssignmentIds
    )

  if (
    uniqueIds.size !==
    teachingAssignmentIds.length
  ) {
    throw new Error(
      'A mesma turma e disciplina não pode ser selecionada mais do que uma vez.'
    )
  }
}

function validateCriteria(
  criteria:
    SubjectAssessmentCriterionDraft[]
) {
  const activeCriteria =
    criteria.filter(
      criterion =>
        criterion.active !==
        false
    )

  if (
    activeCriteria.length ===
    0
  ) {
    throw new Error(
      'Adicione pelo menos um critério de avaliação ativo.'
    )
  }

  const names =
    new Set<string>()

  activeCriteria.forEach(
    criterion => {
      const name =
        requireText(
          criterion.name,
          'O nome do critério'
        )

      const normalizedName =
        normalizeForComparison(
          name
        )

      if (
        names.has(
          normalizedName
        )
      ) {
        throw new Error(
          `O critério “${name}” está repetido.`
        )
      }

      if (
        !Number.isFinite(
          criterion.weightPercent
        ) ||
        criterion.weightPercent <=
          0
      ) {
        throw new Error(
          'Cada critério ativo deve ter uma ponderação superior a 0%.'
        )
      }

      names.add(
        normalizedName
      )
    }
  )

  const total =
    activeCriteria.reduce(
      (
        sum,
        criterion
      ) =>
        sum +
        criterion.weightPercent,
      0
    )

  if (
    Math.abs(
      total -
      100
    ) >
    WEIGHT_TOLERANCE
  ) {
    throw new Error(
      `Os critérios ativos devem totalizar 100%. Total atual: ${total}%.`
    )
  }
}

function assertAssignments(
  assignments:
    Array<
      TeachingAssignment |
      undefined
    >,
  academicYearId:
    EntityId
) {
  if (
    assignments.some(
      assignment =>
        !assignment ||
        assignment.academicYearId !==
          academicYearId
    )
  ) {
    throw new Error(
      'Uma ou mais turmas e disciplinas selecionadas não pertencem ao ano letivo.'
    )
  }
}

async function assertNoExistingSubjectSchemes(
  teachingAssignmentIds:
    EntityId[]
) {
  const existingSchemes =
    await maProfessorDb
      .assessmentSchemes
      .where(
        'teachingAssignmentId'
      )
      .anyOf(
        teachingAssignmentIds
      )
      .toArray()

  if (
    existingSchemes.some(
      scheme =>
        scheme.active &&
        scheme.scope ===
          'subject'
    )
  ) {
    throw new Error(
      'Uma ou mais turmas e disciplinas selecionadas já possuem critérios gerais.'
    )
  }
}

function createScheme(
  input:
    CreateSubjectAssessmentSchemesBatchInput,
  teachingAssignmentId:
    EntityId,
  normalizedName:
    string
): AssessmentScheme {
  const timestamp =
    now()

  return {
    id:
      createEntityId(
        'scheme'
      ),
    academicYearId:
      input.academicYearId,
    teachingAssignmentId,
    moduleId: null,
    scope: 'subject',
    name:
      normalizedName,
    active:
      input.active ??
      true,
    createdAt:
      timestamp,
    updatedAt:
      timestamp
  }
}

function createCriteria(
  schemeId:
    EntityId,
  criteria:
    SubjectAssessmentCriterionDraft[]
): AssessmentCriterion[] {
  return criteria.map(
    (
      criterion,
      index
    ) => {
      const timestamp =
        now()

      return {
        id:
          createEntityId(
            'criterion'
          ),
        schemeId,
        name:
          requireText(
            criterion.name,
            'O nome do critério'
          ),
        description:
          normalizeText(
            criterion.description ??
            ''
          ),
        weightPercent:
          criterion.weightPercent,
        order:
          criterion.order ??
          index +
          1,
        active:
          criterion.active ??
          true,
        createdAt:
          timestamp,
        updatedAt:
          timestamp
      }
    }
  )
}

export class AssessmentCriteriaBatchRepository {
  async createSubjectSchemes(
    input:
      CreateSubjectAssessmentSchemesBatchInput
  ): Promise<
    CreatedSubjectAssessmentScheme[]
  > {
    await openMAProfessorDatabase()

    assertAssignmentIds(
      input.teachingAssignmentIds
    )

    validateCriteria(
      input.criteria
    )

    const normalizedName =
      requireText(
        input.name,
        'O nome do conjunto de critérios'
      )

    const assignments =
      await maProfessorDb
        .teachingAssignments
        .bulkGet(
          input.teachingAssignmentIds
        )

    assertAssignments(
      assignments,
      input.academicYearId
    )

    await assertNoExistingSubjectSchemes(
      input.teachingAssignmentIds
    )

    const created =
      input.teachingAssignmentIds.map(
        teachingAssignmentId => {
          const scheme =
            createScheme(
              input,
              teachingAssignmentId,
              normalizedName
            )

          return {
            scheme,
            criteria:
              createCriteria(
                scheme.id,
                input.criteria
              )
          }
        }
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.teachingAssignments,
      maProfessorDb.assessmentSchemes,
      maProfessorDb.assessmentCriteria,
      async () => {
        const currentAssignments =
          await maProfessorDb
            .teachingAssignments
            .bulkGet(
              input.teachingAssignmentIds
            )

        assertAssignments(
          currentAssignments,
          input.academicYearId
        )

        await assertNoExistingSubjectSchemes(
          input.teachingAssignmentIds
        )

        await maProfessorDb
          .assessmentSchemes
          .bulkAdd(
            created.map(
              item =>
                item.scheme
            )
          )

        await maProfessorDb
          .assessmentCriteria
          .bulkAdd(
            created.flatMap(
              item =>
                item.criteria
            )
          )
      }
    )

    return created
  }
}

export const assessmentCriteriaBatchRepository =
  new AssessmentCriteriaBatchRepository()
