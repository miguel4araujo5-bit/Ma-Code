import {
  ensureDefaultMAProfessorSettings,
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import {
  isStudentMemberOnDate
} from '../students/studentMembership'

import type {
  AssessmentActivityType,
  AssessmentCriterion,
  AssessmentResult,
  AssessmentResultStatus,
  AssessmentScheme,
  ClassGroup,
  EntityId,
  Lesson,
  LessonAssessment,
  ModuleUnit,
  Score,
  Student,
  TeachingAssignment
} from '../types'

export interface LessonAssessmentDraft {
  lessonId: EntityId
  criterionId: EntityId
  title: string
  activityType: AssessmentActivityType
  description?: string
  absentScore?: Score
  exemptScore?: Score
}

export interface LessonAssessmentChanges {
  criterionId?: EntityId
  title?: string
  activityType?: AssessmentActivityType
  description?: string
  absentScore?: Score
  exemptScore?: Score
}

export interface AssessmentResultDraft {
  studentId: EntityId
  status: AssessmentResultStatus
  score?: Score | null
  note?: string
}

export interface LessonAssessmentWorkspaceItem {
  assessment: LessonAssessment
  criterion: AssessmentCriterion
  resultCount: number
  evaluatedCount: number
  absentCount: number
  exemptCount: number
  average: Score | null
  complete: boolean
}

export interface LessonAssessmentWorkspace {
  lesson: Lesson
  assignment: TeachingAssignment
  group: ClassGroup
  module: ModuleUnit
  scheme: AssessmentScheme | null
  criteria: AssessmentCriterion[]
  students: Student[]
  assessments: LessonAssessmentWorkspaceItem[]
}

export interface AssessmentRegisterRow {
  student: Student
  result: AssessmentResult | null
  effectiveStatus: AssessmentResultStatus
  effectiveScore: Score | null
  effectiveNote: string
}

export interface AssessmentRegister {
  lesson: Lesson
  assignment: TeachingAssignment
  group: ClassGroup
  module: ModuleUnit
  scheme: AssessmentScheme
  criterion: AssessmentCriterion
  assessment: LessonAssessment
  rows: AssessmentRegisterRow[]
  evaluatedCount: number
  absentCount: number
  exemptCount: number
  average: Score | null
  complete: boolean
}

const MIN_SCORE = 0
const MAX_SCORE = 20

const validActivityTypes = new Set<AssessmentActivityType>([
  'participation',
  'practical_work',
  'presentation',
  'written_work',
  'test',
  'other'
])

function now() {
  return new Date().toISOString()
}

function createEntityId(
  prefix: string
): EntityId {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (
    uuid
  ) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

function normalizeText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    )
}

function normalizeMultilineText(
  value: string | undefined
) {
  return (
    value ??
    ''
  )
    .replace(
      /\r\n/g,
      '\n'
    )
    .split('\n')
    .map(
      (
        line
      ) =>
        line
          .trim()
          .replace(
            /\s+/g,
            ' '
          )
    )
    .filter(Boolean)
    .join('\n')
}

function requireText(
  value: string,
  label: string
) {
  const normalized =
    normalizeText(
      value
    )

  if (
    !normalized
  ) {
    throw new Error(
      `${label} é obrigatório.`
    )
  }

  return normalized
}

function validateScore(
  value: number,
  label: string
) {
  if (
    !Number.isFinite(
      value
    ) ||
    value <
      MIN_SCORE ||
    value >
      MAX_SCORE
  ) {
    throw new Error(
      `${label} deve estar entre ${MIN_SCORE} e ${MAX_SCORE} valores.`
    )
  }

  return (
    Math.round(
      value *
        100
    ) /
    100
  )
}

function validateActivityType(
  value:
    AssessmentActivityType
) {
  if (
    !validActivityTypes.has(
      value
    )
  ) {
    throw new Error(
      'O tipo de atividade de avaliação não é válido.'
    )
  }

  return value
}

function sortStudents(
  students: Student[]
) {
  return students.sort(
    (
      left,
      right
    ) =>
      left.number.localeCompare(
        right.number,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
  )
}

function sortCriteria(
  criteria:
    AssessmentCriterion[]
) {
  return criteria.sort(
    (
      left,
      right
    ) =>
      left.order -
      right.order
  )
}

function sortAssessments(
  assessments:
    LessonAssessment[]
) {
  return assessments.sort(
    (
      left,
      right
    ) => {
      const dateComparison =
        left.createdAt.localeCompare(
          right.createdAt
        )

      if (
        dateComparison !==
        0
      ) {
        return dateComparison
      }

      return left.title.localeCompare(
        right.title,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
    }
  )
}

function calculateAverage(
  results:
    AssessmentResult[]
): Score | null {
  if (
    results.length ===
    0
  ) {
    return null
  }

  const total =
    results.reduce(
      (
        sum,
        result
      ) =>
        sum +
        result.score,
      0
    )

  return (
    Math.round(
      (
        total /
        results.length
      ) *
        100
    ) /
    100
  )
}

async function getLessonContext(
  lessonId:
    EntityId
) {
  const lesson =
    await maProfessorDb
      .lessons
      .get(
        lessonId
      )

  if (
    !lesson
  ) {
    throw new Error(
      'A aula indicada não existe.'
    )
  }

  const [
    assignment,
    module
  ] =
    await Promise.all([
      maProfessorDb
        .teachingAssignments
        .get(
          lesson.teachingAssignmentId
        ),

      maProfessorDb
        .modules
        .get(
          lesson.moduleId
        )
    ])

  if (
    !assignment ||
    assignment.academicYearId !==
      lesson.academicYearId
  ) {
    throw new Error(
      'A turma e disciplina associadas à aula já não existem.'
    )
  }

  if (
    !module ||
    module.academicYearId !==
      lesson.academicYearId ||
    module.teachingAssignmentId !==
      assignment.id
  ) {
    throw new Error(
      'A UFCD ou módulo associado à aula já não existe.'
    )
  }

  const group =
    await maProfessorDb
      .groups
      .get(
        assignment.groupId
      )

  if (
    !group ||
    group.academicYearId !==
      lesson.academicYearId
  ) {
    throw new Error(
      'A turma associada à aula já não existe.'
    )
  }

  return {
    lesson,
    assignment,
    group,
    module
  }
}

async function getAssessmentContext(
  assessmentId:
    EntityId
) {
  const assessment =
    await maProfessorDb
      .lessonAssessments
      .get(
        assessmentId
      )

  if (
    !assessment
  ) {
    throw new Error(
      'A atividade de avaliação indicada não existe.'
    )
  }

  const lessonContext =
    await getLessonContext(
      assessment.lessonId
    )

  if (
    assessment.academicYearId !==
      lessonContext.lesson.academicYearId ||
    assessment.teachingAssignmentId !==
      lessonContext.assignment.id ||
    assessment.moduleId !==
      lessonContext.module.id
  ) {
    throw new Error(
      'A atividade de avaliação já não corresponde à aula associada.'
    )
  }

  return {
    assessment,
    ...lessonContext
  }
}

async function listStudentsForGroup(
  groupId:
    EntityId
) {
  const students =
    await maProfessorDb
      .students
      .where(
        'groupId'
      )
      .equals(
        groupId
      )
      .toArray()

  return sortStudents(
    students
  )
}

async function listStudentsForLesson(
  groupId: EntityId,
  lesson: Lesson,
  evidenceStudentIds:
    Set<EntityId> = new Set()
) {
  const students =
    await listStudentsForGroup(
      groupId
    )

  return sortStudents(
    students.filter(
      student =>
        isStudentMemberOnDate(
          student,
          lesson.date
        ) ||
        evidenceStudentIds.has(
          student.id
        )
    )
  )
}

async function resolveActiveScheme(
  teachingAssignmentId:
    EntityId,
  moduleId:
    EntityId
): Promise<{
  scheme: AssessmentScheme | null
  criteria: AssessmentCriterion[]
}> {
  const schemes =
    await maProfessorDb
      .assessmentSchemes
      .where(
        'teachingAssignmentId'
      )
      .equals(
        teachingAssignmentId
      )
      .toArray()

  const activeSchemes =
    schemes.filter(
      (
        scheme
      ) =>
        scheme.active
    )

  const moduleSchemes =
    activeSchemes.filter(
      (
        scheme
      ) =>
        scheme.scope ===
          'module' &&
        scheme.moduleId ===
          moduleId
    )

  if (
    moduleSchemes.length >
    1
  ) {
    throw new Error(
      'Existem vários conjuntos de critérios ativos para esta UFCD.'
    )
  }

  const subjectSchemes =
    activeSchemes.filter(
      (
        scheme
      ) =>
        scheme.scope ===
          'subject' &&
        scheme.moduleId ===
          null
    )

  if (
    subjectSchemes.length >
    1
  ) {
    throw new Error(
      'Existem vários conjuntos de critérios gerais ativos para esta turma e disciplina.'
    )
  }

  const scheme =
    moduleSchemes[0] ??
    subjectSchemes[0] ??
    null

  if (
    !scheme
  ) {
    return {
      scheme: null,
      criteria: []
    }
  }

  const criteria =
    await maProfessorDb
      .assessmentCriteria
      .where(
        'schemeId'
      )
      .equals(
        scheme.id
      )
      .toArray()

  return {
    scheme,

    criteria:
      sortCriteria(
        criteria.filter(
          (
            criterion
          ) =>
            criterion.active
        )
      )
  }
}

async function getCriterionAndScheme(
  criterionId:
    EntityId
) {
  const criterion =
    await maProfessorDb
      .assessmentCriteria
      .get(
        criterionId
      )

  if (
    !criterion
  ) {
    throw new Error(
      'O critério de avaliação indicado já não existe.'
    )
  }

  const scheme =
    await maProfessorDb
      .assessmentSchemes
      .get(
        criterion.schemeId
      )

  if (
    !scheme
  ) {
    throw new Error(
      'O conjunto de critérios associado à avaliação já não existe.'
    )
  }

  return {
    criterion,
    scheme
  }
}

async function assertCriterionAvailable(
  criterionId:
    EntityId,
  teachingAssignmentId:
    EntityId,
  moduleId:
    EntityId
) {
  const {
    scheme,
    criteria
  } =
    await resolveActiveScheme(
      teachingAssignmentId,
      moduleId
    )

  if (
    !scheme
  ) {
    throw new Error(
      'Não existem critérios de avaliação configurados para esta turma, disciplina e UFCD.'
    )
  }

  const criterion =
    criteria.find(
      (
        item
      ) =>
        item.id ===
        criterionId
    )

  if (
    !criterion
  ) {
    throw new Error(
      'O critério selecionado não está ativo para esta aula.'
    )
  }

  return {
    criterion,
    scheme
  }
}

async function getResults(
  assessmentId:
    EntityId
) {
  return maProfessorDb
    .assessmentResults
    .where(
      'assessmentId'
    )
    .equals(
      assessmentId
    )
    .toArray()
}

function resolveResultScore(
  assessment:
    LessonAssessment,
  draft:
    AssessmentResultDraft
) {
  if (
    draft.status ===
    'absent'
  ) {
    return assessment.absentScore
  }

  if (
    draft.status ===
    'exempt'
  ) {
    return assessment.exemptScore
  }

  if (
    draft.score ===
      null ||
    draft.score ===
      undefined
  ) {
    throw new Error(
      'Indique a classificação dos alunos avaliados.'
    )
  }

  return validateScore(
    draft.score,
    'A classificação'
  )
}

function createResultRecord(
  assessment:
    LessonAssessment,
  draft:
    AssessmentResultDraft,
  existing:
    AssessmentResult | undefined,
  timestamp:
    string
): AssessmentResult {
  return {
    id:
      existing?.id ??
      createEntityId(
        'assessment-result'
      ),

    assessmentId:
      assessment.id,

    studentId:
      draft.studentId,

    status:
      draft.status,

    score:
      resolveResultScore(
        assessment,
        draft
      ),

    note:
      normalizeMultilineText(
        draft.note
      ),

    createdAt:
      existing?.createdAt ??
      timestamp,

    updatedAt:
      timestamp
  }
}

export class AssessmentRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getLessonAssessmentWorkspace(
    lessonId:
      EntityId
  ): Promise<LessonAssessmentWorkspace> {
    await this.initialize()

    const {
      lesson,
      assignment,
      group,
      module
    } =
      await getLessonContext(
        lessonId
      )

    const [
      schemeContext,
      assessments
    ] =
      await Promise.all([
        resolveActiveScheme(
          assignment.id,
          module.id
        ),

        maProfessorDb
          .lessonAssessments
          .where(
            'lessonId'
          )
          .equals(
            lesson.id
          )
          .toArray()
      ])

    const resultLists =
      await Promise.all(
        assessments.map(
          assessment =>
            getResults(
              assessment.id
            )
        )
      )

    const resultsByAssessmentId =
      new Map(
        assessments.map(
          (
            assessment,
            index
          ) => [
            assessment.id,
            resultLists[index]
          ]
        )
      )

    const evidenceStudentIds =
      new Set(
        resultLists.flatMap(
          results =>
            results.map(
              result =>
                result.studentId
            )
        )
      )

    const students =
      await listStudentsForLesson(
        group.id,
        lesson,
        evidenceStudentIds
      )

    const assessmentItems =
      await Promise.all(
        sortAssessments(
          assessments
        ).map(
          async (
            assessment
          ): Promise<LessonAssessmentWorkspaceItem> => {
            const {
              criterion,
              scheme
            } =
              await getCriterionAndScheme(
                assessment.criterionId
              )

            const results =
              resultsByAssessmentId.get(
                assessment.id
              ) ??
              []

            if (
              scheme.teachingAssignmentId !==
              assignment.id
            ) {
              throw new Error(
                'Uma avaliação desta aula está ligada a critérios de outra turma ou disciplina.'
              )
            }

            const resultStudentIds =
              new Set(
                results.map(
                  (
                    result
                  ) =>
                    result.studentId
                )
              )

            return {
              assessment,
              criterion,

              resultCount:
                results.length,

              evaluatedCount:
                results.filter(
                  (
                    result
                  ) =>
                    result.status ===
                    'evaluated'
                ).length,

              absentCount:
                results.filter(
                  (
                    result
                  ) =>
                    result.status ===
                    'absent'
                ).length,

              exemptCount:
                results.filter(
                  (
                    result
                  ) =>
                    result.status ===
                    'exempt'
                ).length,

              average:
                calculateAverage(
                  results
                ),

              complete:
                students.every(
                  (
                    student
                  ) =>
                    resultStudentIds.has(
                      student.id
                    )
                )
            }
          }
        )
      )

    return {
      lesson,
      assignment,
      group,
      module,

      scheme:
        schemeContext.scheme,

      criteria:
        schemeContext.criteria,

      students,

      assessments:
        assessmentItems
    }
  }

  async createLessonAssessment(
    input:
      LessonAssessmentDraft
  ) {
    await this.initialize()

    const context =
      await getLessonContext(
        input.lessonId
      )

    if (
      context.lesson.status !==
      'taught'
    ) {
      throw new Error(
        'A avaliação só pode ser registada depois de a aula ser marcada como dada.'
      )
    }

    await assertCriterionAvailable(
      input.criterionId,
      context.assignment.id,
      context.module.id
    )

    const settings =
      await ensureDefaultMAProfessorSettings()

    const timestamp =
      now()

    const assessment:
      LessonAssessment = {
      id:
        createEntityId(
          'assessment'
        ),

      academicYearId:
        context.lesson.academicYearId,

      lessonId:
        context.lesson.id,

      teachingAssignmentId:
        context.assignment.id,

      moduleId:
        context.module.id,

      criterionId:
        input.criterionId,

      title:
        requireText(
          input.title,
          'O título da avaliação'
        ),

      activityType:
        validateActivityType(
          input.activityType
        ),

      description:
        normalizeMultilineText(
          input.description
        ),

      absentScore:
        validateScore(
          input.absentScore ??
            settings.defaultAbsentAssessmentScore,
          'A classificação por falta'
        ),

      exemptScore:
        validateScore(
          input.exemptScore ??
            settings.defaultExemptAssessmentScore,
          'A classificação por dispensa'
        ),

      createdAt:
        timestamp,

      updatedAt:
        timestamp
    }

    await maProfessorDb
      .lessonAssessments
      .add(
        assessment
      )

    return assessment
  }

  async updateLessonAssessment(
    assessmentId:
      EntityId,
    changes:
      LessonAssessmentChanges
  ) {
    await this.initialize()

    const {
      assessment,
      lesson,
      assignment,
      module
    } =
      await getAssessmentContext(
        assessmentId
      )

    if (
      lesson.status !==
      'taught'
    ) {
      throw new Error(
        'A avaliação só pode ser alterada enquanto a aula estiver marcada como dada.'
      )
    }

    const criterionId =
      changes.criterionId ??
      assessment.criterionId

    if (
      criterionId !==
      assessment.criterionId
    ) {
      await assertCriterionAvailable(
        criterionId,
        assignment.id,
        module.id
      )
    }

    const absentScore =
      changes.absentScore ===
      undefined
        ? assessment.absentScore
        : validateScore(
            changes.absentScore,
            'A classificação por falta'
          )

    const exemptScore =
      changes.exemptScore ===
      undefined
        ? assessment.exemptScore
        : validateScore(
            changes.exemptScore,
            'A classificação por dispensa'
          )

    const timestamp =
      now()

    const updated:
      LessonAssessment = {
      ...assessment,

      criterionId,

      title:
        changes.title ===
        undefined
          ? assessment.title
          : requireText(
              changes.title,
              'O título da avaliação'
            ),

      activityType:
        changes.activityType ===
        undefined
          ? assessment.activityType
          : validateActivityType(
              changes.activityType
            ),

      description:
        changes.description ===
        undefined
          ? assessment.description
          : normalizeMultilineText(
              changes.description
            ),

      absentScore,

      exemptScore,

      updatedAt:
        timestamp
    }

    const adjustedResults =
      (
        await getResults(
          assessment.id
        )
      )
        .filter(
          (
            result
          ) =>
            result.status ===
              'absent' ||
            result.status ===
              'exempt'
        )
        .map(
          (
            result
          ): AssessmentResult => ({
            ...result,

            score:
              result.status ===
              'absent'
                ? absentScore
                : exemptScore,

            updatedAt:
              timestamp
          })
        )

    await maProfessorDb.transaction(
      'rw',

      maProfessorDb.lessonAssessments,

      maProfessorDb.assessmentResults,

      async () => {
        await maProfessorDb
          .lessonAssessments
          .put(
            updated
          )

        if (
          adjustedResults.length >
          0
        ) {
          await maProfessorDb
            .assessmentResults
            .bulkPut(
              adjustedResults
            )
        }
      }
    )

    return updated
  }

  async getAssessmentRegister(
    assessmentId:
      EntityId
  ): Promise<AssessmentRegister> {
    await this.initialize()

    const {
      assessment,
      lesson,
      assignment,
      group,
      module
    } =
      await getAssessmentContext(
        assessmentId
      )

    const [
      {
        criterion,
        scheme
      },
      results
    ] =
      await Promise.all([
        getCriterionAndScheme(
          assessment.criterionId
        ),

        getResults(
          assessment.id
        )
      ])

    const students =
      await listStudentsForLesson(
        group.id,
        lesson,
        new Set(
          results.map(
            result =>
              result.studentId
          )
        )
      )

    if (
      scheme.teachingAssignmentId !==
      assignment.id
    ) {
      throw new Error(
        'O critério desta avaliação não pertence à turma e disciplina da aula.'
      )
    }

    const resultByStudent =
      new Map(
        results.map(
          (
            result
          ) => [
            result.studentId,
            result
          ]
        )
      )

    const rows =
      students.map(
        (
          student
        ): AssessmentRegisterRow => {
          const result =
            resultByStudent.get(
              student.id
            ) ??
            null

          return {
            student,
            result,

            effectiveStatus:
              result?.status ??
              'evaluated',

            effectiveScore:
              result?.score ??
              null,

            effectiveNote:
              result?.note ??
              ''
          }
        }
      )

    return {
      lesson,
      assignment,
      group,
      module,
      scheme,
      criterion,
      assessment,
      rows,

      evaluatedCount:
        results.filter(
          (
            result
          ) =>
            result.status ===
            'evaluated'
        ).length,

      absentCount:
        results.filter(
          (
            result
          ) =>
            result.status ===
            'absent'
        ).length,

      exemptCount:
        results.filter(
          (
            result
          ) =>
            result.status ===
            'exempt'
        ).length,

      average:
        calculateAverage(
          results
        ),

      complete:
        rows.every(
          (
            row
          ) =>
            Boolean(
              row.result
            )
        )
    }
  }

  async saveAssessmentResults(
    assessmentId:
      EntityId,
    entries:
      AssessmentResultDraft[]
  ) {
    await this.initialize()

    const {
      assessment,
      lesson,
      group
    } =
      await getAssessmentContext(
        assessmentId
      )

    if (
      lesson.status !==
      'taught'
    ) {
      throw new Error(
        'As classificações só podem ser guardadas numa aula marcada como dada.'
      )
    }

    const existingResults =
      await getResults(
        assessment.id
      )

    const students =
      await listStudentsForLesson(
        group.id,
        lesson,
        new Set(
          existingResults.map(
            result =>
              result.studentId
          )
        )
      )

    const studentById =
      new Map(
        students.map(
          (
            student
          ) => [
            student.id,
            student
          ]
        )
      )

    const memberStudentIds =
      new Set(
        students
          .filter(
            student =>
              isStudentMemberOnDate(
                student,
                lesson.date
              )
          )
          .map(
            student =>
              student.id
          )
      )

    const entryByStudent =
      new Map<
        EntityId,
        AssessmentResultDraft
      >()

    entries.forEach(
      (
        entry
      ) => {
        if (
          entryByStudent.has(
            entry.studentId
          )
        ) {
          throw new Error(
            'O mesmo aluno aparece mais do que uma vez na lista de classificações.'
          )
        }

        if (
          !studentById.has(
            entry.studentId
          )
        ) {
          throw new Error(
            'Um dos alunos indicados não pertence à turma desta aula.'
          )
        }

        entryByStudent.set(
          entry.studentId,
          entry
        )
      }
    )

    const existingByStudent =
      new Map(
        existingResults.map(
          (
            result
          ) => [
            result.studentId,
            result
          ]
        )
      )

    const timestamp =
      now()

    const records =
      entries.map(
        (
          entry
        ) =>
          createResultRecord(
            assessment,
            entry,
            existingByStudent.get(
              entry.studentId
            ),
            timestamp
          )
      )

    const idsToDelete =
      existingResults
        .filter(
          (
            result
          ) =>
            memberStudentIds.has(
              result.studentId
            ) &&
            !entryByStudent.has(
              result.studentId
            )
        )
        .map(
          (
            result
          ) =>
            result.id
        )

    await maProfessorDb.transaction(
      'rw',

      maProfessorDb.lessonAssessments,

      maProfessorDb.assessmentResults,

      async () => {
        if (
          idsToDelete.length >
          0
        ) {
          await maProfessorDb
            .assessmentResults
            .bulkDelete(
              idsToDelete
            )
        }

        if (
          records.length >
          0
        ) {
          await maProfessorDb
            .assessmentResults
            .bulkPut(
              records
            )
        }

        await maProfessorDb
          .lessonAssessments
          .put({
            ...assessment,

            updatedAt:
              timestamp
          })
      }
    )

    return this.getAssessmentRegister(
      assessment.id
    )
  }

  async deleteLessonAssessment(
    assessmentId:
      EntityId
  ) {
    await this.initialize()

    const assessment =
      await maProfessorDb
        .lessonAssessments
        .get(
          assessmentId
        )

    if (
      !assessment
    ) {
      return false
    }

    await maProfessorDb.transaction(
      'rw',

      maProfessorDb.lessonAssessments,

      maProfessorDb.assessmentResults,

      async () => {
        await maProfessorDb
          .assessmentResults
          .where(
            'assessmentId'
          )
          .equals(
            assessment.id
          )
          .delete()

        await maProfessorDb
          .lessonAssessments
          .delete(
            assessment.id
          )
      }
    )

    return true
  }
}

export function getAssessmentActivityTypeLabel(
  activityType:
    AssessmentActivityType
) {
  const labels:
    Record<
      AssessmentActivityType,
      string
    > = {
      participation:
        'Participação',

      practical_work:
        'Trabalho prático',

      presentation:
        'Apresentação',

      written_work:
        'Trabalho escrito',

      test:
        'Teste',

      other:
        'Outra atividade'
    }

  return labels[
    activityType
  ]
}

export function getAssessmentResultStatusLabel(
  status:
    AssessmentResultStatus
) {
  const labels:
    Record<
      AssessmentResultStatus,
      string
    > = {
      evaluated:
        'Avaliado',

      absent:
        'Faltou',

      exempt:
        'Dispensado'
    }

  return labels[
    status
  ]
}

export const assessmentRepository =
  new AssessmentRepository()
