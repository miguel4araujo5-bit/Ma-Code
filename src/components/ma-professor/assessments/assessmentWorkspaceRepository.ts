import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'

import type {
  AcademicYear,
  AssessmentCriterion,
  AssessmentResult,
  AssessmentScheme,
  ClassGroup,
  EntityId,
  Lesson,
  LessonAssessment,
  ModuleFinalGrade,
  ModuleUnit,
  Score,
  Student,
  StudentModuleGradeSummary,
  Subject,
  TeachingAssignment
} from '../types'

export interface AssessmentWorkspaceFilters {
  teachingAssignmentId?: EntityId | null
  moduleId?: EntityId | null
}

export interface AssessmentAssignmentOption {
  assignment: TeachingAssignment
  group: ClassGroup
  subject: Subject
  label: string
}

export interface AssessmentModuleOption {
  module: ModuleUnit
  label: string
}

export interface AssessmentWorkspaceActivityRow {
  assessment: LessonAssessment
  lesson: Lesson
  criterion: AssessmentCriterion
  resultCount: number
  evaluatedCount: number
  absentCount: number
  exemptCount: number
  average: Score | null
  complete: boolean
}

export interface AssessmentWorkspaceStudentRow {
  student: Student
  gradeSummary: StudentModuleGradeSummary
  finalGradeRecord: ModuleFinalGrade | null
}

export interface AssessmentWorkspaceTotals {
  activityCount: number
  completeActivityCount: number
  incompleteActivityCount: number
  studentCount: number
  studentsWithAssessment: number
  confirmedGradeCount: number
  classAverage: Score | null
}

export interface AssessmentWorkspaceSnapshot {
  academicYear: AcademicYear

  filters: {
    teachingAssignmentId: EntityId | null
    moduleId: EntityId | null
  }

  assignmentOptions: AssessmentAssignmentOption[]
  moduleOptions: AssessmentModuleOption[]

  selectedAssignment: TeachingAssignment | null
  selectedGroup: ClassGroup | null
  selectedSubject: Subject | null
  selectedModule: ModuleUnit | null

  scheme: AssessmentScheme | null
  criteria: AssessmentCriterion[]

  activities: AssessmentWorkspaceActivityRow[]
  studentRows: AssessmentWorkspaceStudentRow[]

  totals: AssessmentWorkspaceTotals
  generatedAt: string
}

export interface SaveModuleFinalGradeInput {
  moduleId: EntityId
  studentId: EntityId
  finalGrade: Score | null
  note?: string
}

interface WorkspaceContext {
  academicYear: AcademicYear
  groups: ClassGroup[]
  subjects: Subject[]
  assignments: TeachingAssignment[]
  modules: ModuleUnit[]
  students: Student[]
  schemes: AssessmentScheme[]
  criteria: AssessmentCriterion[]
  lessons: Lesson[]
  assessments: LessonAssessment[]
  results: AssessmentResult[]
  finalGrades: ModuleFinalGrade[]
}

interface ResolvedAssessmentScheme {
  scheme: AssessmentScheme | null
  criteria: AssessmentCriterion[]
}

const MIN_SCORE = 0
const MAX_SCORE = 20

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

function roundScore(
  value: number
) {
  return (
    Math.round(
      value *
        100
    ) /
    100
  )
}

function calculateAverage(
  scores: number[]
): Score | null {
  if (
    scores.length ===
    0
  ) {
    return null
  }

  return roundScore(
    scores.reduce(
      (
        total,
        score
      ) =>
        total +
        score,
      0
    ) /
      scores.length
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

function validateFinalGrade(
  value: Score
) {
  if (
    !Number.isInteger(
      value
    ) ||
    value <
      MIN_SCORE ||
    value >
      MAX_SCORE
  ) {
    throw new Error(
      'A classificação final deve ser um número inteiro entre 0 e 20 valores.'
    )
  }

  return value
}

function getSubjectLabel(
  subject: Subject
) {
  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function getModuleLabel(
  module: ModuleUnit
) {
  const code =
    module.code.trim()

  return code
    ? `${code} · ${module.name}`
    : module.name
}

function sortGroups(
  groups: ClassGroup[]
) {
  return groups.sort(
    (
      left,
      right
    ) =>
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
  )
}

function sortSubjects(
  subjects: Subject[]
) {
  return subjects.sort(
    (
      left,
      right
    ) =>
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
  )
}

function sortModules(
  modules: ModuleUnit[]
) {
  return modules.sort(
    (
      left,
      right
    ) => {
      if (
        left.order !==
        right.order
      ) {
        return (
          left.order -
          right.order
        )
      }

      return getModuleLabel(
        left
      ).localeCompare(
        getModuleLabel(
          right
        ),
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

function sortStudents(
  students: Student[]
) {
  return students.sort(
    (
      left,
      right
    ) => {
      const numberComparison =
        left.number.localeCompare(
          right.number,
          'pt-PT',
          {
            numeric: true,
            sensitivity:
              'base'
          }
        )

      if (
        numberComparison !==
        0
      ) {
        return numberComparison
      }

      return left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          sensitivity:
            'base'
        }
      )
    }
  )
}

function sortCriteria(
  criteria: AssessmentCriterion[]
) {
  return criteria.sort(
    (
      left,
      right
    ) => {
      if (
        left.order !==
        right.order
      ) {
        return (
          left.order -
          right.order
        )
      }

      return left.name.localeCompare(
        right.name,
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

function sortActivities(
  activities:
    AssessmentWorkspaceActivityRow[]
) {
  return activities.sort(
    (
      left,
      right
    ) => {
      const dateComparison =
        left.lesson.date.localeCompare(
          right.lesson.date
        )

      if (
        dateComparison !==
        0
      ) {
        return dateComparison
      }

      const timeComparison =
        left.lesson.startTime.localeCompare(
          right.lesson.startTime
        )

      if (
        timeComparison !==
        0
      ) {
        return timeComparison
      }

      return left.assessment.title.localeCompare(
        right.assessment.title,
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

function buildAssignmentOptions(
  context: WorkspaceContext
) {
  const groupById =
    new Map(
      context.groups.map(
        (
          group
        ) => [
          group.id,
          group
        ]
      )
    )

  const subjectById =
    new Map(
      context.subjects.map(
        (
          subject
        ) => [
          subject.id,
          subject
        ]
      )
    )

  const options =
    context.assignments
      .filter(
        (
          assignment
        ) =>
          assignment.active
      )
      .flatMap(
        (
          assignment
        ): AssessmentAssignmentOption[] => {
          const group =
            groupById.get(
              assignment.groupId
            )

          const subject =
            subjectById.get(
              assignment.subjectId
            )

          if (
            !group ||
            !subject ||
            !group.active ||
            !subject.active
          ) {
            return []
          }

          return [
            {
              assignment,
              group,
              subject,

              label:
                `${group.name} · ${getSubjectLabel(
                  subject
                )}`
            }
          ]
        }
      )

  return options.sort(
    (
      left,
      right
    ) => {
      const groupComparison =
        left.group.name.localeCompare(
          right.group.name,
          'pt-PT',
          {
            numeric: true,
            sensitivity:
              'base'
          }
        )

      if (
        groupComparison !==
        0
      ) {
        return groupComparison
      }

      return left.label.localeCompare(
        right.label,
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

function resolveSelectedAssignment(
  options:
    AssessmentAssignmentOption[],
  requestedId:
    EntityId | null
) {
  if (
    requestedId
  ) {
    const selected =
      options.find(
        (
          option
        ) =>
          option.assignment.id ===
          requestedId
      )

    if (
      !selected
    ) {
      throw new Error(
        'A turma e disciplina selecionadas não pertencem ao ano letivo.'
      )
    }

    return selected
  }

  return (
    options[0] ??
    null
  )
}

function resolveSelectedModule(
  modules: ModuleUnit[],
  requestedId:
    EntityId | null
) {
  if (
    requestedId
  ) {
    const selected =
      modules.find(
        (
          module
        ) =>
          module.id ===
          requestedId
      )

    if (
      !selected
    ) {
      throw new Error(
        'A UFCD ou módulo selecionado não pertence à turma e disciplina indicadas.'
      )
    }

    return selected
  }

  return (
    modules[0] ??
    null
  )
}

function resolveAssessmentScheme(
  assignmentId:
    EntityId,
  moduleId:
    EntityId,
  schemes:
    AssessmentScheme[],
  criteria:
    AssessmentCriterion[]
): ResolvedAssessmentScheme {
  const activeSchemes =
    schemes.filter(
      (
        scheme
      ) =>
        scheme.active &&
        scheme.teachingAssignmentId ===
          assignmentId
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

  return {
    scheme,

    criteria:
      sortCriteria(
        criteria.filter(
          (
            criterion
          ) =>
            criterion.schemeId ===
              scheme.id &&
            criterion.active
        )
      )
  }
}

function buildActivityRows(
  assessments:
    LessonAssessment[],
  lessons:
    Lesson[],
  criteria:
    AssessmentCriterion[],
  results:
    AssessmentResult[],
  students:
    Student[]
) {
  const lessonById =
    new Map(
      lessons.map(
        (
          lesson
        ) => [
          lesson.id,
          lesson
        ]
      )
    )

  const criterionById =
    new Map(
      criteria.map(
        (
          criterion
        ) => [
          criterion.id,
          criterion
        ]
      )
    )

  const resultsByAssessmentId =
    new Map<
      EntityId,
      AssessmentResult[]
    >()

  results.forEach(
    (
      result
    ) => {
      const current =
        resultsByAssessmentId.get(
          result.assessmentId
        ) ??
        []

      current.push(
        result
      )

      resultsByAssessmentId.set(
        result.assessmentId,
        current
      )
    }
  )

  const activeStudentIds =
    new Set(
      students.map(
        (
          student
        ) =>
          student.id
      )
    )

  const rows =
    assessments.map(
      (
        assessment
      ): AssessmentWorkspaceActivityRow => {
        const lesson =
          lessonById.get(
            assessment.lessonId
          )

        if (
          !lesson
        ) {
          throw new Error(
            `A avaliação “${assessment.title}” está associada a uma aula que já não existe.`
          )
        }

        const criterion =
          criterionById.get(
            assessment.criterionId
          )

        if (
          !criterion
        ) {
          throw new Error(
            `A avaliação “${assessment.title}” está associada a um critério que já não existe ou está inativo.`
          )
        }

        const assessmentResults =
          (
            resultsByAssessmentId.get(
              assessment.id
            ) ??
            []
          ).filter(
            (
              result
            ) =>
              activeStudentIds.has(
                result.studentId
              )
          )

        const resultStudentIds =
          new Set(
            assessmentResults.map(
              (
                result
              ) =>
                result.studentId
            )
          )

        return {
          assessment,
          lesson,
          criterion,

          resultCount:
            assessmentResults.length,

          evaluatedCount:
            assessmentResults.filter(
              (
                result
              ) =>
                result.status ===
                'evaluated'
            ).length,

          absentCount:
            assessmentResults.filter(
              (
                result
              ) =>
                result.status ===
                'absent'
            ).length,

          exemptCount:
            assessmentResults.filter(
              (
                result
              ) =>
                result.status ===
                'exempt'
            ).length,

          average:
            calculateAverage(
              assessmentResults.map(
                (
                  result
                ) =>
                  result.score
              )
            ),

          complete:
            students.length >
              0 &&
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

  return sortActivities(
    rows
  )
}

function buildFinalGradeMap(
  finalGrades:
    ModuleFinalGrade[]
) {
  const sorted =
    [
      ...finalGrades
    ].sort(
      (
        left,
        right
      ) =>
        left.updatedAt.localeCompare(
          right.updatedAt
        )
    )

  const finalGradeByStudentId =
    new Map<
      EntityId,
      ModuleFinalGrade
    >()

  sorted.forEach(
    (
      finalGrade
    ) => {
      finalGradeByStudentId.set(
        finalGrade.studentId,
        finalGrade
      )
    }
  )

  return finalGradeByStudentId
}

function buildStudentRows(
  students:
    Student[],
  module:
    ModuleUnit,
  criteria:
    AssessmentCriterion[],
  assessments:
    LessonAssessment[],
  results:
    AssessmentResult[],
  finalGrades:
    ModuleFinalGrade[]
) {
  const assessmentsByCriterionId =
    new Map<
      EntityId,
      LessonAssessment[]
    >()

  assessments.forEach(
    (
      assessment
    ) => {
      const current =
        assessmentsByCriterionId.get(
          assessment.criterionId
        ) ??
        []

      current.push(
        assessment
      )

      assessmentsByCriterionId.set(
        assessment.criterionId,
        current
      )
    }
  )

  const assessmentById =
    new Map(
      assessments.map(
        (
          assessment
        ) => [
          assessment.id,
          assessment
        ]
      )
    )

  const resultsByStudentId =
    new Map<
      EntityId,
      AssessmentResult[]
    >()

  results.forEach(
    (
      result
    ) => {
      if (
        !assessmentById.has(
          result.assessmentId
        )
      ) {
        return
      }

      const current =
        resultsByStudentId.get(
          result.studentId
        ) ??
        []

      current.push(
        result
      )

      resultsByStudentId.set(
        result.studentId,
        current
      )
    }
  )

  const finalGradeByStudentId =
    buildFinalGradeMap(
      finalGrades
    )

  return students.map(
    (
      student
    ): AssessmentWorkspaceStudentRow => {
      const studentResults =
        resultsByStudentId.get(
          student.id
        ) ??
        []

      const resultByAssessmentId =
        new Map(
          studentResults.map(
            (
              result
            ) => [
              result.assessmentId,
              result
            ]
          )
        )

      const criterionBreakdowns =
        criteria.map(
          (
            criterion
          ) => {
            const criterionAssessments =
              assessmentsByCriterionId.get(
                criterion.id
              ) ??
              []

            const criterionScores =
              criterionAssessments.flatMap(
                (
                  assessment
                ) => {
                  const result =
                    resultByAssessmentId.get(
                      assessment.id
                    )

                  return result
                    ? [
                        result.score
                      ]
                    : []
                }
              )

            const average =
              calculateAverage(
                criterionScores
              )

            return {
              criterionId:
                criterion.id,

              criterionName:
                criterion.name,

              weightPercent:
                criterion.weightPercent,

              assessmentCount:
                criterionAssessments.length,

              average,

              weightedContribution:
                average ===
                null
                  ? null
                  : roundScore(
                      average *
                        (
                          criterion.weightPercent /
                          100
                        )
                    )
            }
          }
        )

      const assessedCriteria =
        criterionBreakdowns.filter(
          (
            criterion
          ) =>
            criterion.average !==
            null
        )

      const assessedWeight =
        assessedCriteria.reduce(
          (
            total,
            criterion
          ) =>
            total +
            criterion.weightPercent,
          0
        )

      const weightedTotal =
        assessedCriteria.reduce(
          (
            total,
            criterion
          ) =>
            total +
            (
              criterion.weightedContribution ??
              0
            ),
          0
        )

      const provisionalAverage =
        assessedWeight >
        0
          ? roundScore(
              weightedTotal /
                (
                  assessedWeight /
                  100
                )
            )
          : null

      const allActiveCriteriaAssessed =
        criteria.length >
          0 &&
        criteria.every(
          (
            criterion
          ) =>
            criterionBreakdowns.some(
              (
                breakdown
              ) =>
                breakdown.criterionId ===
                  criterion.id &&
                breakdown.average !==
                  null
            )
        )

      const suggestedGrade =
        allActiveCriteriaAssessed &&
        provisionalAverage !==
          null
          ? Math.max(
              MIN_SCORE,
              Math.min(
                MAX_SCORE,
                Math.round(
                  provisionalAverage
                )
              )
            )
          : null

      const finalGradeRecord =
        finalGradeByStudentId.get(
          student.id
        ) ??
        null

      const gradeSummary:
        StudentModuleGradeSummary = {
        studentId:
          student.id,

        moduleId:
          module.id,

        criteria:
          criterionBreakdowns,

        provisionalAverage,

        allActiveCriteriaAssessed,

        suggestedGrade,

        confirmedFinalGrade:
          finalGradeRecord
            ?.finalGrade ??
          null
      }

      return {
        student,
        gradeSummary,
        finalGradeRecord
      }
    }
  )
}

async function loadWorkspaceContext(
  academicYearId:
    EntityId
): Promise<WorkspaceContext> {
  const [
    academicYear,
    groups,
    subjects,
    assignments,
    modules,
    students,
    schemes,
    criteria,
    lessons,
    assessments,
    results,
    finalGrades
  ] =
    await Promise.all([
      maProfessorDb
        .academicYears
        .get(
          academicYearId
        ),

      maProfessorDb
        .groups
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .subjects
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .teachingAssignments
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .modules
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .students
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .assessmentSchemes
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .assessmentCriteria
        .toArray(),

      maProfessorDb
        .lessons
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .lessonAssessments
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray(),

      maProfessorDb
        .assessmentResults
        .toArray(),

      maProfessorDb
        .moduleFinalGrades
        .where(
          'academicYearId'
        )
        .equals(
          academicYearId
        )
        .toArray()
    ])

  if (
    !academicYear
  ) {
    throw new Error(
      'O ano letivo indicado não existe.'
    )
  }

  return {
    academicYear,

    groups:
      sortGroups(
        groups
      ),

    subjects:
      sortSubjects(
        subjects
      ),

    assignments,

    modules,

    students,

    schemes,

    criteria,

    lessons,

    assessments,

    results,

    finalGrades
  }
}

export class AssessmentWorkspaceRepository {
  async initialize() {
    await openMAProfessorDatabase()
  }

  async getWorkspace(
    academicYearId:
      EntityId,
    filters:
      AssessmentWorkspaceFilters = {}
  ): Promise<AssessmentWorkspaceSnapshot> {
    await this.initialize()

    const context =
      await loadWorkspaceContext(
        academicYearId
      )

    const assignmentOptions =
      buildAssignmentOptions(
        context
      )

    const selectedAssignmentOption =
      resolveSelectedAssignment(
        assignmentOptions,
        filters.teachingAssignmentId ??
          null
      )

    const selectedAssignment =
      selectedAssignmentOption
        ?.assignment ??
      null

    const selectedGroup =
      selectedAssignmentOption
        ?.group ??
      null

    const selectedSubject =
      selectedAssignmentOption
        ?.subject ??
      null

    const selectedAssignmentModules =
      selectedAssignment
        ? sortModules(
            context.modules.filter(
              (
                module
              ) =>
                module.active &&
                module.teachingAssignmentId ===
                  selectedAssignment.id
            )
          )
        : []

    const moduleOptions =
      selectedAssignmentModules.map(
        (
          module
        ): AssessmentModuleOption => ({
          module,
          label:
            getModuleLabel(
              module
            )
        })
      )

    const selectedModule =
      resolveSelectedModule(
        selectedAssignmentModules,
        filters.moduleId ??
          null
      )

    if (
      !selectedAssignment ||
      !selectedGroup ||
      !selectedSubject ||
      !selectedModule
    ) {
      return {
        academicYear:
          context.academicYear,

        filters: {
          teachingAssignmentId:
            selectedAssignment
              ?.id ??
            null,

          moduleId:
            selectedModule
              ?.id ??
            null
        },

        assignmentOptions,
        moduleOptions,

        selectedAssignment,
        selectedGroup,
        selectedSubject,
        selectedModule,

        scheme:
          null,

        criteria:
          [],

        activities:
          [],

        studentRows:
          [],

        totals: {
          activityCount:
            0,

          completeActivityCount:
            0,

          incompleteActivityCount:
            0,

          studentCount:
            0,

          studentsWithAssessment:
            0,

          confirmedGradeCount:
            0,

          classAverage:
            null
        },

        generatedAt:
          now()
      }
    }

    const schemeContext =
      resolveAssessmentScheme(
        selectedAssignment.id,
        selectedModule.id,
        context.schemes,
        context.criteria
      )

    const students =
      sortStudents(
        context.students.filter(
          (
            student
          ) =>
            student.active &&
            student.groupId ===
              selectedGroup.id
        )
      )

    const assessments =
      context.assessments.filter(
        (
          assessment
        ) =>
          assessment.teachingAssignmentId ===
            selectedAssignment.id &&
          assessment.moduleId ===
            selectedModule.id
      )

    const assessmentIds =
      new Set(
        assessments.map(
          (
            assessment
          ) =>
            assessment.id
        )
      )

    const results =
      context.results.filter(
        (
          result
        ) =>
          assessmentIds.has(
            result.assessmentId
          )
      )

    const finalGrades =
      context.finalGrades.filter(
        (
          finalGrade
        ) =>
          finalGrade.teachingAssignmentId ===
            selectedAssignment.id &&
          finalGrade.moduleId ===
            selectedModule.id
      )

    const activities =
      buildActivityRows(
        assessments,
        context.lessons,
        schemeContext.criteria,
        results,
        students
      )

    const studentRows =
      buildStudentRows(
        students,
        selectedModule,
        schemeContext.criteria,
        assessments,
        results,
        finalGrades
      )

    const provisionalAverages =
      studentRows.flatMap(
        (
          row
        ) =>
          row.gradeSummary
            .provisionalAverage ===
          null
            ? []
            : [
                row.gradeSummary
                  .provisionalAverage
              ]
      )

    const completeActivityCount =
      activities.filter(
        (
          activity
        ) =>
          activity.complete
      ).length

    return {
      academicYear:
        context.academicYear,

      filters: {
        teachingAssignmentId:
          selectedAssignment.id,

        moduleId:
          selectedModule.id
      },

      assignmentOptions,
      moduleOptions,

      selectedAssignment,
      selectedGroup,
      selectedSubject,
      selectedModule,

      scheme:
        schemeContext.scheme,

      criteria:
        schemeContext.criteria,

      activities,

      studentRows,

      totals: {
        activityCount:
          activities.length,

        completeActivityCount,

        incompleteActivityCount:
          activities.length -
          completeActivityCount,

        studentCount:
          studentRows.length,

        studentsWithAssessment:
          provisionalAverages.length,

        confirmedGradeCount:
          studentRows.filter(
            (
              row
            ) =>
              row.gradeSummary
                .confirmedFinalGrade !==
              null
          ).length,

        classAverage:
          calculateAverage(
            provisionalAverages
          )
      },

      generatedAt:
        now()
    }
  }

  async saveModuleFinalGrade(
    input:
      SaveModuleFinalGradeInput
  ) {
    await this.initialize()

    const module =
      await maProfessorDb
        .modules
        .get(
          input.moduleId
        )

    if (
      !module ||
      !module.active
    ) {
      throw new Error(
        'A UFCD ou módulo indicado não existe ou está inativo.'
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
      !assignment.active
    ) {
      throw new Error(
        'A turma e disciplina associadas à UFCD já não existem ou estão inativas.'
      )
    }

    const student =
      await maProfessorDb
        .students
        .get(
          input.studentId
        )

    if (
      !student ||
      !student.active ||
      student.groupId !==
        assignment.groupId ||
      student.academicYearId !==
        module.academicYearId
    ) {
      throw new Error(
        'O aluno indicado não pertence à turma desta UFCD.'
      )
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
        (
          row
        ) =>
          row.student.id ===
          student.id
      )

    if (
      !studentRow
    ) {
      throw new Error(
        'Não foi possível calcular a classificação deste aluno.'
      )
    }

    const provisionalAverage =
      studentRow.gradeSummary
        .provisionalAverage

    const suggestedGrade =
      studentRow.gradeSummary
        .suggestedGrade

    if (
      input.finalGrade !==
        null &&
      (
        provisionalAverage ===
          null ||
        suggestedGrade ===
          null
      )
    ) {
      throw new Error(
        'Ainda não existem classificações suficientes para confirmar a nota final deste aluno.'
      )
    }

    const finalGrade =
      input.finalGrade ===
      null
        ? null
        : validateFinalGrade(
            input.finalGrade
          )

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
      [
        ...existingRecords
      ]
        .sort(
          (
            left,
            right
          ) =>
            right.updatedAt.localeCompare(
              left.updatedAt
            )
        )[0] ??
      null

    if (
      finalGrade ===
        null &&
      !existing
    ) {
      return null
    }

    const timestamp =
      now()

    const record:
      ModuleFinalGrade = {
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
        provisionalAverage ??
        existing
          ?.calculatedAverage ??
        0,

      suggestedGrade:
        suggestedGrade ??
        existing
          ?.suggestedGrade ??
        0,

      finalGrade,

      confirmedAt:
        finalGrade ===
        null
          ? null
          : timestamp,

      note:
        normalizeMultilineText(
          input.note
        ),

      createdAt:
        existing?.createdAt ??
        timestamp,

      updatedAt:
        timestamp
    }

    const duplicateIds =
      existingRecords
        .filter(
          (
            current
          ) =>
            current.id !==
            record.id
        )
        .map(
          (
            current
          ) =>
            current.id
        )

    await maProfessorDb.transaction(
      'rw',

      maProfessorDb.moduleFinalGrades,

      async () => {
        if (
          duplicateIds.length >
          0
        ) {
          await maProfessorDb
            .moduleFinalGrades
            .bulkDelete(
              duplicateIds
            )
        }

        await maProfessorDb
          .moduleFinalGrades
          .put(
            record
          )
      }
    )

    return record
  }
}

export const assessmentWorkspaceRepository =
  new AssessmentWorkspaceRepository()
