import type { SetupSnapshot } from '../repository'
import type { ModuleDocument } from './planificationModuleDocument'

type DocumentDestination = Pick<ModuleDocument, 'subjectLabel' | 'courseLabel' | 'gradeLabel' | 'groupLabel'>

export function normalizePlanificationLabel(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function planificationGrade(value: string) {
  return value.match(/(?:^|\D)(1[0-2]|[1-9])(?=\D|$)/)?.[1] ?? ''
}

function classKey(value: string) {
  return normalizePlanificationLabel(value.replace(/(\d)\s*\.?\s*[º°o](?=\s|[A-Z]|$)/gi, '$1'))
    .replace(/\s+/g, '')
}

function acronym(value: string) {
  return normalizePlanificationLabel(value).split(' ')
    .filter(word => word && !['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'].includes(word))
    .map(word => word[0]).join('')
}

function equivalentCourse(left: string, right: string) {
  const a = normalizePlanificationLabel(left)
  const b = normalizePlanificationLabel(right)
  return a === b || a === acronym(right) || b === acronym(left)
}

export function planificationDestinations(snapshot: SetupSnapshot) {
  const yearId = snapshot.academicYear.id
  return snapshot.teachingAssignments.flatMap(assignment => {
    const group = snapshot.groups.find(item => item.id === assignment.groupId && item.active && item.academicYearId === yearId)
    const subject = snapshot.subjects.find(item => item.id === assignment.subjectId && item.active && item.academicYearId === yearId)
    return assignment.active && assignment.academicYearId === yearId && group && subject
      ? [{ assignment, group, subject, label: `${subject.name} · ${group.name}${group.courseName ? ` · ${group.courseName}` : ''}` }]
      : []
  })
}

export function matchingPlanificationSubjects(snapshot: SetupSnapshot, label: string) {
  const key = normalizePlanificationLabel(label)
  if (!key) return []
  return snapshot.subjects.filter(subject => subject.active && subject.academicYearId === snapshot.academicYear.id &&
    [subject.name, subject.shortName, subject.code].some(value => normalizePlanificationLabel(value || '') === key))
}

export function resolvePlanificationDestination(
  snapshot: SetupSnapshot,
  document: DocumentDestination,
  targetAssignmentId?: string
) {
  const destinations = planificationDestinations(snapshot)
  const key = normalizePlanificationLabel(document.subjectLabel)
  const exact = matchingPlanificationSubjects(snapshot, document.subjectLabel)
  const inferred = exact.length || !key ? [] : snapshot.subjects.filter(subject =>
    subject.active && subject.academicYearId === snapshot.academicYear.id &&
    (acronym(subject.name) === key || normalizePlanificationLabel(subject.name) === acronym(document.subjectLabel)))
  const subjects = exact.length ? exact : inferred
  const grade = planificationGrade(document.gradeLabel || document.groupLabel)
  const warnings: string[] = []

  if (targetAssignmentId) {
    const destination = destinations.find(item => item.assignment.id === targetAssignmentId) ?? null
    if (!destination) return { destination: null, warnings: ['O destino já não está disponível. Escolha outra célula.'] }
    if (!key || !exact.some(subject => subject.id === destination.subject.id)) {
      warnings.push(document.subjectLabel
        ? `O documento indica “${document.subjectLabel}”. O destino escolhido é “${destination.subject.name}”.`
        : 'O documento não identifica a disciplina. Foi usada a célula escolhida.')
    }
    if (document.groupLabel && classKey(document.groupLabel) !== classKey(destination.group.name)) {
      warnings.push(`O documento indica ${document.groupLabel}; o destino escolhido é ${destination.group.name}.`)
    } else if (grade && grade !== planificationGrade(destination.group.gradeLevel || destination.group.name)) {
      warnings.push(`O documento indica ${grade}.º ano; o destino escolhido é ${destination.group.name}.`)
    }
    if (document.courseLabel && destination.group.courseName && !equivalentCourse(document.courseLabel, destination.group.courseName)) {
      warnings.push(`O curso indicado no documento difere do curso da turma ${destination.group.name}.`)
    }
    return { destination, warnings }
  }

  // An explicit year/class is a constraint, even when there is only one assignment.
  let candidates = destinations.filter(item => subjects.some(subject => subject.id === item.subject.id))
  if (document.groupLabel) candidates = candidates.filter(item => classKey(item.group.name) === classKey(document.groupLabel))
  if (grade) candidates = candidates.filter(item => planificationGrade(item.group.gradeLevel || item.group.name) === grade)
  if (document.courseLabel) candidates = candidates.filter(item =>
    !item.group.courseName || equivalentCourse(item.group.courseName, document.courseLabel))

  const destination = candidates.length === 1 ? candidates[0] : null
  if (destination && !exact.length) warnings.push('Correspondência provável pela sigla da disciplina. Pode corrigir o destino.')
  if (destination && !grade && !document.groupLabel) warnings.push('O documento não identifica o ano/turma. Foi usado o único destino correspondente no horário.')
  if (!destination) warnings.push('Não foi possível identificar um único destino. Escolha a célula correspondente no horário ou continue e trate desta planificação mais tarde.')
  return { destination, warnings }
}
