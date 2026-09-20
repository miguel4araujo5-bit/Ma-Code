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
  confirmedFinalGradeCount: number
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

export interface AssessmentSubjectCriteriaContext {
  subjectId: EntityId
  teachingAssignmentIds: EntityId[]
  coveredTeachingAssignmentIds: EntityId[]
  scheme: AssessmentScheme | null
  criteria: AssessmentCriterion[]
  aligned: boolean
}

export interface UpdateAssessmentSubjectCriteriaInput {
  academicYearId: EntityId
  subjectId: EntityId
  referenceSchemeId: EntityId
  name: string
  criteria: AssessmentCriteriaManagementCriterionInput[]
}

export class AssessmentCriteriaDeletionBlockedError extends Error {
  constructor() {
    super(
      'Não é possível remover um critério que já tenha avaliações associadas, porque isso quebraria o histórico. Pode alterar o nome, a descrição e a ponderação desse critério.'
    )
    this.name =
      'AssessmentCriteriaDeletionBlockedError'
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

  const finalGrades =
    scheme.scope === 'module' &&
    scheme.moduleId
      ? await maProfessorDb
          .moduleFinalGrades
          .where('moduleId')
          .equals(scheme.moduleId)
          .toArray()
      : await maProfessorDb
          .moduleFinalGrades
          .where('teachingAssignmentId')
          .equals(
            scheme.teachingAssignmentId
          )
          .toArray()

  return {
    lessonAssessmentCount:
      lessonAssessments.length,
    assessmentResultCount,
    finalGradeCount:
      finalGrades.length,
    confirmedFinalGradeCount:
      finalGrades.filter(
        grade =>
          grade.confirmedAt !== null
      ).length
  }
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

async function assertDeletedCriteriaHaveNoAssessments(
  deletedIds: EntityId[]
) {
  if (deletedIds.length === 0) {
    return
  }

  const usedAssessment =
    await maProfessorDb
      .lessonAssessments
      .where('criterionId')
      .anyOf(deletedIds)
      .first()

  if (usedAssessment) {
    throw new AssessmentCriteriaDeletionBlockedError()
  }
}

function sortCriteria(
  criteria: AssessmentCriterion[]
) {
  return [
    ...criteria
  ]
    .filter(
      criterion =>
        criterion.active
    )
    .sort(
      (left, right) =>
        left.order -
        right.order
    )
}

function criterionIdentity(
  criterion: AssessmentCriterion
) {
  return normalizeText(
    criterion.name
  ).toLocaleLowerCase(
    'pt-PT'
  )
}

function sameCriterionIdentity(
  reference: AssessmentCriterion[],
  candidate: AssessmentCriterion[]
) {
  const left =
    sortCriteria(
      reference
    )
      .map(
        criterionIdentity
      )

  const right =
    sortCriteria(
      candidate
    )
      .map(
        criterionIdentity
      )

  return (
    left.length ===
      right.length &&
    left.every(
      (value, index) =>
        value ===
        right[index]
    )
  )
}

function sameCriterionConfiguration(
  reference: AssessmentCriterion[],
  candidate: AssessmentCriterion[]
) {
  const left =
    sortCriteria(
      reference
    )

  const right =
    sortCriteria(
      candidate
    )

  return (
    left.length ===
      right.length &&
    left.every(
      (criterion, index) => {
        const other =
          right[index]

        return (
          Boolean(other) &&
          criterionIdentity(
            criterion
          ) ===
            criterionIdentity(
              other
            ) &&
          normalizeText(
            criterion.description
          ) ===
            normalizeText(
              other.description
            ) &&
          Math.abs(
            criterion.weightPercent -
              other.weightPercent
          ) <=
            WEIGHT_TOLERANCE
        )
      }
    )
  )
}

async function readSubjectSchemeGroup(
  academicYearId: EntityId,
  subjectId: EntityId
) {
  const assignments =
    (
      await maProfessorDb
        .teachingAssignments
        .where('academicYearId')
        .equals(
          academicYearId
        )
        .toArray()
    )
      .filter(
        assignment =>
          assignment.active &&
          assignment.subjectId ===
            subjectId
      )

  const teachingAssignmentIds =
    assignments.map(
      assignment =>
        assignment.id
    )

  if (
    teachingAssignmentIds.length ===
    0
  ) {
    return {
      teachingAssignmentIds,
      schemes:
        [] as AssessmentScheme[],
      criteriaByScheme:
        new Map<
          EntityId,
          AssessmentCriterion[]
        >()
    }
  }

  const schemes =
    (
      await maProfessorDb
        .assessmentSchemes
        .where(
          'teachingAssignmentId'
        )
        .anyOf(
          teachingAssignmentIds
        )
        .toArray()
    )
      .filter(
        scheme =>
          scheme.active &&
          scheme.scope ===
            'subject' &&
          scheme.moduleId ===
            null
      )

  const schemeCountByAssignment =
    new Map<
      EntityId,
      number
    >()

  schemes.forEach(
    scheme => {
      const count =
        schemeCountByAssignment.get(
          scheme.teachingAssignmentId
        ) ??
        0

      schemeCountByAssignment.set(
        scheme.teachingAssignmentId,
        count +
          1
      )
    }
  )

  if (
    [
      ...schemeCountByAssignment
        .values()
    ].some(
      count =>
        count >
        1
    )
  ) {
    throw new Error(
      'Existem vários conjuntos de critérios gerais ativos para a mesma turma e disciplina. Corrija primeiro a configuração inicial.'
    )
  }

  const schemeIds =
    schemes.map(
      scheme =>
        scheme.id
    )

  const allCriteria =
    schemeIds.length ===
    0
      ? []
      : await maProfessorDb
          .assessmentCriteria
          .where('schemeId')
          .anyOf(
            schemeIds
          )
          .toArray()

  const criteriaByScheme =
    new Map<
      EntityId,
      AssessmentCriterion[]
    >()

  schemes.forEach(
    scheme => {
      criteriaByScheme.set(
        scheme.id,
        sortCriteria(
          allCriteria.filter(
            criterion =>
              criterion.schemeId ===
              scheme.id
          )
        )
      )
    }
  )

  return {
    teachingAssignmentIds,
    schemes,
    criteriaByScheme
  }
}

async function readSubjectEvidence(
  schemes: AssessmentScheme[],
  criteriaByScheme:
    Map<
      EntityId,
      AssessmentCriterion[]
    >
): Promise<AssessmentCriteriaEvidence> {
  const items =
    await Promise.all(
      schemes.map(
        scheme =>
          readEvidence(
            scheme,
            criteriaByScheme.get(
              scheme.id
            ) ??
              []
          )
      )
    )

  return items.reduce(
    (
      total,
      evidence
    ) => ({
      lessonAssessmentCount:
        total.lessonAssessmentCount +
        evidence.lessonAssessmentCount,
      assessmentResultCount:
        total.assessmentResultCount +
        evidence.assessmentResultCount,
      finalGradeCount:
        total.finalGradeCount +
        evidence.finalGradeCount,
      confirmedFinalGradeCount:
        total.confirmedFinalGradeCount +
        evidence.confirmedFinalGradeCount
    }),
    {
      lessonAssessmentCount: 0,
      assessmentResultCount: 0,
      finalGradeCount: 0,
      confirmedFinalGradeCount: 0
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
      editable: true,
      evidence
    }
  }

  async getSubjectContext(
    academicYearId: EntityId,
    subjectId: EntityId
  ): Promise<AssessmentSubjectCriteriaContext> {
    await openMAProfessorDatabase()

    const group =
      await readSubjectSchemeGroup(
        academicYearId,
        subjectId
      )

    const referenceScheme =
      [
        ...group.schemes
      ]
        .sort(
          (left, right) =>
            left.teachingAssignmentId
              .localeCompare(
                right.teachingAssignmentId,
                'pt-PT',
                {
                  numeric: true,
                  sensitivity:
                    'base'
                }
              )
        )[0] ??
      null

    const referenceCriteria =
      referenceScheme
        ? group.criteriaByScheme.get(
            referenceScheme.id
          ) ??
          []
        : []

    const aligned =
      !referenceScheme ||
      group.schemes.every(
        scheme =>
          sameCriterionConfiguration(
            referenceCriteria,
            group.criteriaByScheme.get(
              scheme.id
            ) ??
              []
          )
      )

    return {
      subjectId,
      teachingAssignmentIds:
        group.teachingAssignmentIds,
      coveredTeachingAssignmentIds:
        group.schemes.map(
          scheme =>
            scheme.teachingAssignmentId
        ),
      scheme:
        referenceScheme,
      criteria:
        referenceCriteria,
      aligned
    }
  }

  async getSubjectEditability(
    academicYearId: EntityId,
    subjectId: EntityId
  ): Promise<AssessmentCriteriaEditability> {
    await openMAProfessorDatabase()

    const group =
      await readSubjectSchemeGroup(
        academicYearId,
        subjectId
      )

    return {
      editable: true,
      evidence:
        await readSubjectEvidence(
          group.schemes,
          group.criteriaByScheme
        )
    }
  }

  async updateSubjectSchemes(
    input: UpdateAssessmentSubjectCriteriaInput
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
        maProfessorDb.teachingAssignments,
        maProfessorDb.assessmentSchemes,
        maProfessorDb.assessmentCriteria,
        maProfessorDb.lessonAssessments,
        maProfessorDb.assessmentResults,
        maProfessorDb.moduleFinalGrades
      ],
      async () => {
        const group =
          await readSubjectSchemeGroup(
            input.academicYearId,
            input.subjectId
          )

        const referenceScheme =
          group.schemes.find(
            scheme =>
              scheme.id ===
              input.referenceSchemeId
          )

        if (!referenceScheme) {
          throw new Error(
            'O conjunto de critérios gerais selecionado já não pertence a esta disciplina.'
          )
        }

        const referenceCriteria =
          group.criteriaByScheme.get(
            referenceScheme.id
          ) ??
          []

        if (
          !group.schemes.every(
            scheme =>
              sameCriterionConfiguration(
                referenceCriteria,
                group.criteriaByScheme.get(
                  scheme.id
                ) ??
                  []
              )
          )
        ) {
          throw new Error(
            'Os critérios gerais desta disciplina diferem entre turmas. Para proteger o histórico, resolva primeiro essas diferenças na gestão avançada por turma/UFCD.'
          )
        }

        assertInputCriterionIdsBelongToScheme(
          {
            schemeId:
              referenceScheme.id,
            name:
              input.name,
            criteria:
              input.criteria
          },
          referenceCriteria
        )

        const referenceById =
          new Map(
            referenceCriteria.map(
              criterion => [
                criterion.id,
                criterion
              ]
            )
          )

        const timestamp =
          now()

        const updatedSchemes =
          group.schemes.map(
            scheme => ({
              ...scheme,
              name:
                normalizedName,
              updatedAt:
                timestamp
            })
          )

        const nextCriteriaByScheme =
          new Map<
            EntityId,
            AssessmentCriterion[]
          >()

        const deletedIds:
          EntityId[] =
          []

        for (
          const scheme of
          group.schemes
        ) {
          const existingCriteria =
            group.criteriaByScheme.get(
              scheme.id
            ) ??
            []

          const existingByIdentity =
            new Map(
              existingCriteria.map(
                criterion => [
                  criterionIdentity(
                    criterion
                  ),
                  criterion
                ]
              )
            )

          const targetInput =
            input.criteria.map(
              criterion => {
                if (
                  !criterion.id
                ) {
                  return criterion
                }

                const reference =
                  referenceById.get(
                    criterion.id
                  )

                if (!reference) {
                  throw new Error(
                    'Um dos critérios indicados já não pertence ao conjunto selecionado.'
                  )
                }

                const existing =
                  existingByIdentity.get(
                    criterionIdentity(
                      reference
                    )
                  )

                if (!existing) {
                  throw new Error(
                    'Não foi possível relacionar com segurança um critério entre as turmas desta disciplina.'
                  )
                }

                return {
                  ...criterion,
                  id:
                    existing.id
                }
              }
            )

          const nextCriteria =
            buildCriteria(
              scheme.id,
              targetInput,
              existingCriteria
            )

          const nextIds =
            new Set(
              nextCriteria.map(
                criterion =>
                  criterion.id
              )
            )

          deletedIds.push(
            ...existingCriteria
              .filter(
                criterion =>
                  criterion.active &&
                  !nextIds.has(
                    criterion.id
                  )
              )
              .map(
                criterion =>
                  criterion.id
              )
          )

          nextCriteriaByScheme.set(
            scheme.id,
            nextCriteria
          )
        }

        await assertDeletedCriteriaHaveNoAssessments(
          deletedIds
        )

        await maProfessorDb
          .assessmentSchemes
          .bulkPut(
            updatedSchemes
          )

        if (
          deletedIds.length >
          0
        ) {
          await maProfessorDb
            .assessmentCriteria
            .bulkDelete(
              deletedIds
            )
        }

        await maProfessorDb
          .assessmentCriteria
          .bulkPut(
            [
              ...nextCriteriaByScheme
                .values()
            ].flat()
          )

        const updatedReferenceScheme =
          updatedSchemes.find(
            scheme =>
              scheme.id ===
              referenceScheme.id
          ) ??
          referenceScheme

        return {
          scheme:
            updatedReferenceScheme,
          criteria:
            nextCriteriaByScheme.get(
              referenceScheme.id
            ) ??
            []
        }
      }
    )
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

        // O histórico é relido dentro da transação para que a interface
        // possa avisar com dados atuais, sem transformar esse histórico
        // num bloqueio à edição de nomes, descrições ou ponderações.
        await readEvidence(
          scheme,
          existingCriteria
        )

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
                criterion.active &&
                !nextIds.has(
                  criterion.id
                )
            )
            .map(
              criterion => criterion.id
            )

        await assertDeletedCriteriaHaveNoAssessments(
          deletedIds
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
