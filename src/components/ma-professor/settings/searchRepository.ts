import {
  maProfessorDb,
  openMAProfessorDatabase
} from '../db'
import type {
  EntityId,
  ISODate
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

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .trim()
}

function includesQuery(
  result: MAProfessorSearchResult,
  query: string
) {
  if (!query) {
    return true
  }

  return normalize(result.searchText).includes(query)
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

export async function searchMAProfessor(
  filters: MAProfessorSearchFilters
): Promise<MAProfessorSearchResult[]> {
  await openMAProfessorDatabase()

  const [
    students,
    groups,
    subjects,
    assignments,
    modules,
    lessons,
    planifications,
    lessonAssessments,
    recoveries,
    finalGrades
  ] = await Promise.all([
    maProfessorDb.students.toArray(),
    maProfessorDb.groups.toArray(),
    maProfessorDb.subjects.toArray(),
    maProfessorDb.teachingAssignments.toArray(),
    maProfessorDb.modules.toArray(),
    maProfessorDb.lessons.toArray(),
    maProfessorDb.planifications.toArray(),
    maProfessorDb.lessonAssessments.toArray(),
    maProfessorDb.learningRecoveries.toArray(),
    maProfessorDb.moduleFinalGrades.toArray()
  ])

  const academicYearId = filters.academicYearId ?? null
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
      searchText: [
        student.name,
        student.number,
        student.notes,
        group?.name,
        group?.courseName
      ]
        .filter(Boolean)
        .join(' ')
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
      searchText: [
        module.code,
        module.name,
        assignmentLabel(module.teachingAssignmentId)
      ].join(' ')
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
      searchText: [
        lesson.summary,
        lesson.plannedActivity,
        lesson.notes,
        moduleLabel(lesson.moduleId),
        assignmentLabel(lesson.teachingAssignmentId)
      ].join(' ')
    })
  }

  for (const planification of planifications) {
    if (
      academicYearId &&
      planification.academicYearId !== academicYearId
    ) {
      continue
    }

    results.push({
      id: `planification:${planification.id}`,
      kind: 'planification',
      title: planification.title,
      subtitle: moduleLabel(planification.moduleId),
      detail:
        planification.description ||
        assignmentLabel(planification.teachingAssignmentId),
      date: null,
      searchText: [
        planification.title,
        planification.description,
        moduleLabel(planification.moduleId),
        assignmentLabel(planification.teachingAssignmentId)
      ].join(' ')
    })
  }

  for (const assessment of lessonAssessments) {
    if (
      academicYearId &&
      assessment.academicYearId !== academicYearId
    ) {
      continue
    }

    const lesson = lessons.find(item => item.id === assessment.lessonId)
    results.push({
      id: `assessment:${assessment.id}`,
      kind: 'assessment',
      title: assessment.title,
      subtitle: `${moduleLabel(assessment.moduleId)} · ${assignmentLabel(
        assessment.teachingAssignmentId
      )}`,
      detail: assessment.description || assessment.activityType,
      date: lesson?.date ?? null,
      searchText: [
        assessment.title,
        assessment.description,
        assessment.activityType,
        moduleLabel(assessment.moduleId)
      ].join(' ')
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
      detail: [recovery.contents, recovery.activity, recovery.result]
        .filter(Boolean)
        .join(' · ') || 'Sem descrição.',
      date: recovery.plannedDate,
      searchText: [
        student?.name,
        recovery.contents,
        recovery.activity,
        recovery.result,
        moduleLabel(recovery.moduleId)
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  for (const grade of finalGrades) {
    if (academicYearId && grade.academicYearId !== academicYearId) {
      continue
    }

    const student = studentById.get(grade.studentId)
    results.push({
      id: `grade:${grade.id}`,
      kind: 'grade',
      title: `${student?.name || 'Aluno'} · ${
        grade.finalGrade ?? grade.suggestedGrade
      } valores`,
      subtitle: moduleLabel(grade.moduleId),
      detail: grade.note || 'Classificação final do módulo.',
      date: grade.confirmedAt?.slice(0, 10) ?? null,
      searchText: [
        student?.name,
        grade.note,
        moduleLabel(grade.moduleId),
        String(grade.finalGrade ?? grade.suggestedGrade)
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  const normalizedQuery = normalize(filters.query)
  const kind = filters.kind ?? 'all'
  const from = filters.dateFrom ?? null
  const to = filters.dateTo ?? null

  return results
    .filter(result => kind === 'all' || result.kind === kind)
    .filter(result => includesQuery(result, normalizedQuery))
    .filter(result => inDateRange(result.date, from, to))
    .sort((left, right) => {
      const dateComparison = (right.date || '').localeCompare(
        left.date || ''
      )
      return dateComparison || left.title.localeCompare(
        right.title,
        'pt-PT',
        { numeric: true, sensitivity: 'base' }
      )
    })
    .slice(0, 150)
}
