import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId,
  ISODate,
  PlanificationItem
} from '../types'

export type MAProfessorSearchKind =
  | 'student'
  | 'lesson'
  | 'module'
  | 'planification'
  | 'assessment'
  | 'recovery'
  | 'grade'

export interface MAProfessorSearchFilters {
  query: string
  academicYearId?: EntityId | null
  kind?: MAProfessorSearchKind | 'all'
  dateFrom?: ISODate | null
  dateTo?: ISODate | null
}

export interface MAProfessorSearchResult {
  id: string
  kind: MAProfessorSearchKind
  title: string
  subtitle: string
  detail: string
  date: ISODate | null
  searchText: string
}

const SEARCH_LIMIT = 150

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function tokenizeQuery(value: string) {
  return normalize(value)
    .split(/\s+/)
    .filter(Boolean)
}

function includesQuery(
  result: MAProfessorSearchResult,
  tokens: string[]
) {
  if (tokens.length === 0) {
    return true
  }

  const searchable = normalize(result.searchText)

  return tokens.every(token => searchable.includes(token))
}

function inDateRange(
  date: ISODate | null,
  from: ISODate | null,
  to: ISODate | null
) {
  if (!date) {
    return !from && !to
  }

  if (from && date < from) {
    return false
  }

  if (to && date > to) {
    return false
  }

  return true
}

function joinSearchText(
  values: Array<string | number | null | undefined>
) {
  return values
    .filter(
      (value): value is string | number =>
        value !== null &&
        value !== undefined &&
        String(value).trim().length > 0
    )
    .map(value => String(value))
    .join(' ')
}

function describePlanificationItem(item: PlanificationItem) {
  return [
    item.content,
    item.activity,
    item.objectives,
    item.resources,
    item.evaluation,
    item.suggestedSummary
  ]
    .filter(Boolean)
    .join(' · ')
}

export async function searchMAProfessor(
  filters: MAProfessorSearchFilters
): Promise<MAProfessorSearchResult[]> {
  await openMAProfessorDatabase()

  const [
    academicYears,
    students,
    groups,
    subjects,
    assignments,
    modules,
    lessons,
    planifications,
    planificationItems,
    lessonAssessments,
    assessmentResults,
    recoveries,
    finalGrades
  ] = await Promise.all([
    maProfessorDb.academicYears.toArray(),
    maProfessorDb.students.toArray(),
    maProfessorDb.groups.toArray(),
    maProfessorDb.subjects.toArray(),
    maProfessorDb.teachingAssignments.toArray(),
    maProfessorDb.modules.toArray(),
    maProfessorDb.lessons.toArray(),
    maProfessorDb.planifications.toArray(),
    maProfessorDb.planificationItems.toArray(),
    maProfessorDb.lessonAssessments.toArray(),
    maProfessorDb.assessmentResults.toArray(),
    maProfessorDb.learningRecoveries.toArray(),
    maProfessorDb.moduleFinalGrades.toArray()
  ])

  const academicYearId =
    filters.academicYearId ??
    academicYears.find(year => year.active)?.id ??
    null

  const queryTokens = tokenizeQuery(filters.query)
  const groupById = new Map(groups.map(group => [group.id, group]))
  const subjectById = new Map(
    subjects.map(subject => [subject.id, subject])
  )
  const assignmentById = new Map(
    assignments.map(assignment => [assignment.id, assignment])
  )
  const moduleById = new Map(
    modules.map(module => [module.id, module])
  )
  const studentById = new Map(
    students.map(student => [student.id, student])
  )
  const lessonById = new Map(
    lessons.map(lesson => [lesson.id, lesson])
  )
  const assessmentById = new Map(
    lessonAssessments.map(assessment => [assessment.id, assessment])
  )

  const planificationItemsByPlanificationId = new Map<
    EntityId,
    PlanificationItem[]
  >()

  for (const item of planificationItems) {
    const current =
      planificationItemsByPlanificationId.get(item.planificationId) ?? []

    current.push(item)
    planificationItemsByPlanificationId.set(item.planificationId, current)
  }

  const assignmentLabel = (assignmentId: EntityId) => {
    const assignment = assignmentById.get(assignmentId)

    if (!assignment) {
      return 'Turma/disciplina não encontrada'
    }

    const group = groupById.get(assignment.groupId)
    const subject = subjectById.get(assignment.subjectId)

    return [
      group?.name,
      subject?.shortName || subject?.name,
      assignment.displayName
    ]
      .filter(Boolean)
      .join(' · ')
  }

  const moduleLabel = (moduleId: EntityId) => {
    const module = moduleById.get(moduleId)
    return module
      ? [module.code, module.name].filter(Boolean).join(' · ')
      : 'Módulo não encontrado'
  }

  const results: MAProfessorSearchResult[] = []

  for (const student of students) {
    if (academicYearId && student.academicYearId !== academicYearId) {
      continue
    }

    const group = groupById.get(student.groupId)
    results.push({
      id: `student:${student.id}`,
      kind: 'student',
      title: student.name,
      subtitle: `${group?.name || 'Turma'} · N.º ${student.number || '—'}`,
      detail: student.notes || 'Sem notas adicionais.',
      date: null,
      searchText: joinSearchText([
        'aluno estudante',
        student.name,
        student.number,
        student.notes,
        group?.name,
        group?.courseName
      ])
    })
  }

  for (const module of modules) {
    if (academicYearId && module.academicYearId !== academicYearId) {
      continue
    }

    results.push({
      id: `module:${module.id}`,
      kind: 'module',
      title: moduleLabel(module.id),
      subtitle: assignmentLabel(module.teachingAssignmentId),
      detail: `${module.plannedPeriods} tempos planeados`,
      date: module.plannedStartDate,
      searchText: joinSearchText([
        'ufcd módulo modulo',
        module.code,
        module.name,
        assignmentLabel(module.teachingAssignmentId)
      ])
    })
  }

  for (const lesson of lessons) {
    if (academicYearId && lesson.academicYearId !== academicYearId) {
      continue
    }

    results.push({
      id: `lesson:${lesson.id}`,
      kind: 'lesson',
      title: lesson.summary || lesson.plannedActivity || 'Aula sem sumário',
      subtitle: `${lesson.date} · ${assignmentLabel(
        lesson.teachingAssignmentId
      )}`,
      detail: `${moduleLabel(lesson.moduleId)} · ${lesson.periodCount} tempo(s)`,
      date: lesson.date,
      searchText: joinSearchText([
        'aula sumário sumario',
        lesson.summary,
        lesson.plannedActivity,
        lesson.notes,
        lesson.giaeStatus,
        moduleLabel(lesson.moduleId),
        assignmentLabel(lesson.teachingAssignmentId)
      ])
    })
  }

  for (const planification of planifications) {
    if (
      academicYearId &&
      planification.academicYearId !== academicYearId
    ) {
      continue
    }

    const items =
      planificationItemsByPlanificationId.get(planification.id) ?? []
    const itemSearchTexts = items.map(describePlanificationItem)
    const matchingItem =
      queryTokens.length === 0
        ? null
        : items.find(item => {
            const searchable = normalize(describePlanificationItem(item))
            return queryTokens.every(token => searchable.includes(token))
          }) ?? null

    results.push({
      id: `planification:${planification.id}`,
      kind: 'planification',
      title: planification.title,
      subtitle: moduleLabel(planification.moduleId),
      detail:
        (matchingItem && describePlanificationItem(matchingItem)) ||
        planification.description ||
        assignmentLabel(planification.teachingAssignmentId),
      date: null,
      searchText: joinSearchText([
        'planificação planificacao',
        planification.title,
        planification.description,
        moduleLabel(planification.moduleId),
        assignmentLabel(planification.teachingAssignmentId),
        ...itemSearchTexts
      ])
    })
  }

  for (const assessment of lessonAssessments) {
    if (
      academicYearId &&
      assessment.academicYearId !== academicYearId
    ) {
      continue
    }

    const lesson = lessonById.get(assessment.lessonId)
    results.push({
      id: `assessment:${assessment.id}`,
      kind: 'assessment',
      title: assessment.title || 'Avaliação',
      subtitle: `${moduleLabel(assessment.moduleId)} · ${assignmentLabel(
        assessment.teachingAssignmentId
      )}`,
      detail: assessment.description || assessment.activityType,
      date: lesson?.date ?? null,
      searchText: joinSearchText([
        'avaliação avaliacao',
        assessment.title,
        assessment.description,
        assessment.activityType,
        lesson?.summary,
        moduleLabel(assessment.moduleId),
        assignmentLabel(assessment.teachingAssignmentId)
      ])
    })
  }

  for (const result of assessmentResults) {
    const assessment = assessmentById.get(result.assessmentId)

    if (!assessment) {
      continue
    }

    if (
      academicYearId &&
      assessment.academicYearId !== academicYearId
    ) {
      continue
    }

    const student = studentById.get(result.studentId)
    const lesson = lessonById.get(assessment.lessonId)
    const statusLabel =
      result.status === 'absent'
        ? 'Falta'
        : result.status === 'exempt'
          ? 'Dispensa'
          : `${result.score} valores`

    results.push({
      id: `grade-result:${result.id}`,
      kind: 'grade',
      title: `${student?.name || 'Aluno'} · ${statusLabel}`,
      subtitle: `${assessment.title || 'Avaliação'} · ${moduleLabel(
        assessment.moduleId
      )}`,
      detail: result.note || assignmentLabel(assessment.teachingAssignmentId),
      date: lesson?.date ?? null,
      searchText: joinSearchText([
        'classificação classificacao nota avaliação avaliacao',
        student?.name,
        student?.number,
        result.score,
        result.status,
        result.note,
        assessment.title,
        assessment.description,
        moduleLabel(assessment.moduleId),
        assignmentLabel(assessment.teachingAssignmentId)
      ])
    })
  }

  for (const recovery of recoveries) {
    if (
      academicYearId &&
      recovery.academicYearId !== academicYearId
    ) {
      continue
    }

    const student = studentById.get(recovery.studentId)
    results.push({
      id: `recovery:${recovery.id}`,
      kind: 'recovery',
      title: `Recuperação · ${student?.name || 'Aluno'}`,
      subtitle: moduleLabel(recovery.moduleId),
      detail:
        [recovery.contents, recovery.activity, recovery.result]
          .filter(Boolean)
          .join(' · ') || 'Sem descrição.',
      date: recovery.plannedDate,
      searchText: joinSearchText([
        'recuperação recuperacao',
        student?.name,
        student?.number,
        recovery.contents,
        recovery.activity,
        recovery.result,
        recovery.status,
        moduleLabel(recovery.moduleId),
        assignmentLabel(recovery.teachingAssignmentId)
      ])
    })
  }

  for (const grade of finalGrades) {
    if (academicYearId && grade.academicYearId !== academicYearId) {
      continue
    }

    const student = studentById.get(grade.studentId)
    const gradeLabel =
      grade.qualitativeFinalGrade ||
      `${grade.finalGrade ?? grade.suggestedGrade} valores`

    results.push({
      id: `grade:${grade.id}`,
      kind: 'grade',
      title: `${student?.name || 'Aluno'} · ${gradeLabel}`,
      subtitle: moduleLabel(grade.moduleId),
      detail:
        grade.descriptiveAssessment ||
        grade.note ||
        'Classificação final do módulo.',
      date: grade.confirmedAt?.slice(0, 10) ?? null,
      searchText: joinSearchText([
        'classificação classificacao nota final',
        student?.name,
        student?.number,
        grade.note,
        grade.descriptiveAssessment,
        grade.qualitativeFinalGrade,
        moduleLabel(grade.moduleId),
        assignmentLabel(grade.teachingAssignmentId),
        grade.finalGrade,
        grade.suggestedGrade,
        grade.calculatedAverage
      ])
    })
  }

  const kind = filters.kind ?? 'all'
  const from = filters.dateFrom ?? null
  const to = filters.dateTo ?? null

  return results
    .filter(result => kind === 'all' || result.kind === kind)
    .filter(result => includesQuery(result, queryTokens))
    .filter(result => inDateRange(result.date, from, to))
    .sort((left, right) => {
      const dateComparison = (right.date || '').localeCompare(
        left.date || ''
      )
      return (
        dateComparison ||
        left.title.localeCompare(right.title, 'pt-PT', {
          numeric: true,
          sensitivity: 'base'
        })
      )
    })
    .slice(0, SEARCH_LIMIT)
}
