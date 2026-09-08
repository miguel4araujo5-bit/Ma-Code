import {
  maProfessorDb,
  openMAProfessorDatabase
} from './db'

import type {
  AssessmentCriterionDraft
} from './repository'

import type {
  AssessmentCriterion,
  AssessmentScheme,
  EntityId,
  ModuleUnit,
  TeachingAssignment
} from './types'

export interface CreateModuleAssessmentSchemeInput {
  academicYearId: EntityId
  teachingAssignmentId: EntityId
  moduleId: EntityId
  name: string
  active?: boolean
}

export interface CreatedModuleAssessmentScheme {
  scheme: AssessmentScheme
  criteria: AssessmentCriterion[]
}

export interface ModuleAssessmentEvidence {
  lessonAssessmentCount: number
  assessmentResultCount: number
  finalGradeCount: number
}

export class ModuleAssessmentEvidenceError extends Error {
  readonly code =
    'MODULE_ASSESSMENT_EVIDENCE_EXISTS'

  constructor(
    readonly evidence:
      ModuleAssessmentEvidence
  ) {
    super(
      'Esta UFCD já tem avaliações ou classificações registadas. Para preservar o histórico, não é possível personalizar agora os critérios desta UFCD.'
    )

    this.name =
      'ModuleAssessmentEvidenceError'
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

function validateCriteria(
  criteria:
    AssessmentCriterionDraft[]
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

function assertModuleContext(
  assignment:
    TeachingAssignment |
    undefined,
  module:
    ModuleUnit |
    undefined,
  input:
    CreateModuleAssessmentSchemeInput
) {
  if (
    !assignment ||
    assignment.academicYearId !==
      input.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina selecionadas não pertencem ao ano letivo.'
    )
  }

  if (
    !module ||
    module.academicYearId !==
      input.academicYearId ||
    module.teachingAssignmentId !==
      input.teachingAssignmentId
  ) {
    throw new Error(
      'A UFCD indicada não pertence à turma e disciplina selecionadas.'
    )
  }
}

async function assertNoExistingModuleScheme(
  teachingAssignmentId:
    EntityId,
  moduleId:
    EntityId
) {
  const existingSchemes =
    await maProfessorDb
      .assessmentSchemes
      .where(
        '[teachingAssignmentId+moduleId]'
      )
      .equals([
        teachingAssignmentId,
        moduleId
      ])
      .toArray()

  if (
    existingSchemes.some(
      scheme =>
        scheme.active &&
        scheme.scope ===
          'module'
    )
  ) {
    throw new Error(
      'Esta UFCD já possui critérios personalizados ativos.'
    )
  }
}

async function readModuleAssessmentEvidence(
  moduleId:
    EntityId
): Promise<ModuleAssessmentEvidence> {
  const [
    lessonAssessments,
    finalGradeCount
  ] =
    await Promise.all([
      maProfessorDb
        .lessonAssessments
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .toArray(),
      maProfessorDb
        .moduleFinalGrades
        .where(
          'moduleId'
        )
        .equals(
          moduleId
        )
        .count()
    ])

  const assessmentResultCount =
    lessonAssessments.length ===
      0
      ? 0
      : await maProfessorDb
          .assessmentResults
          .where(
            'assessmentId'
          )
          .anyOf(
            lessonAssessments.map(
              assessment =>
                assessment.id
            )
          )
          .count()

  return {
    lessonAssessmentCount:
      lessonAssessments.length,
    assessmentResultCount,
    finalGradeCount
  }
}

async function assertNoModuleAssessmentEvidence(
  moduleId:
    EntityId
) {
  const evidence =
    await readModuleAssessmentEvidence(
      moduleId
    )

  if (
    evidence.lessonAssessmentCount >
      0 ||
    evidence.assessmentResultCount >
      0 ||
    evidence.finalGradeCount >
      0
  ) {
    throw new ModuleAssessmentEvidenceError(
      evidence
    )
  }
}

function createScheme(
  input:
    CreateModuleAssessmentSchemeInput,
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
    teachingAssignmentId:
      input.teachingAssignmentId,
    moduleId:
      input.moduleId,
    scope: 'module',
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
    AssessmentCriterionDraft[]
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

export class AssessmentCriteriaModuleRepository {
  async createModuleScheme(
    input:
      CreateModuleAssessmentSchemeInput,
    criteria:
      AssessmentCriterionDraft[]
  ): Promise<
    CreatedModuleAssessmentScheme
  > {
    await openMAProfessorDatabase()

    validateCriteria(
      criteria
    )

    const normalizedName =
      requireText(
        input.name,
        'O nome do conjunto de critérios'
      )

    const [
      assignment,
      module
    ] =
      await Promise.all([
        maProfessorDb
          .teachingAssignments
          .get(
            input.teachingAssignmentId
          ),
        maProfessorDb
          .modules
          .get(
            input.moduleId
          )
      ])

    assertModuleContext(
      assignment,
      module,
      input
    )

    await assertNoExistingModuleScheme(
      input.teachingAssignmentId,
      input.moduleId
    )

    await assertNoModuleAssessmentEvidence(
      input.moduleId
    )

    const scheme =
      createScheme(
        input,
        normalizedName
      )

    const criterionRecords =
      createCriteria(
        scheme.id,
        criteria
      )

    await maProfessorDb.transaction(
      'rw',
      maProfessorDb.teachingAssignments,
      maProfessorDb.modules,
      maProfessorDb.lessonAssessments,
      maProfessorDb.assessmentResults,
      maProfessorDb.moduleFinalGrades,
      maProfessorDb.assessmentSchemes,
      maProfessorDb.assessmentCriteria,
      async () => {
        const [
          currentAssignment,
          currentModule
        ] =
          await Promise.all([
            maProfessorDb
              .teachingAssignments
              .get(
                input.teachingAssignmentId
              ),
            maProfessorDb
              .modules
              .get(
                input.moduleId
              )
          ])

        assertModuleContext(
          currentAssignment,
          currentModule,
          input
        )

        await assertNoExistingModuleScheme(
          input.teachingAssignmentId,
          input.moduleId
        )

        await assertNoModuleAssessmentEvidence(
          input.moduleId
        )

        await maProfessorDb
          .assessmentSchemes
          .add(
            scheme
          )

        await maProfessorDb
          .assessmentCriteria
          .bulkAdd(
            criterionRecords
          )
      }
    )

    return {
      scheme,
      criteria:
        criterionRecords
    }
  }
}

export const assessmentCriteriaModuleRepository =
  new AssessmentCriteriaModuleRepository()
