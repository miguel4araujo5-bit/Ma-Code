import type { SetupSnapshot } from '../repository'

function words(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT').replace(/[^a-z0-9]+/g, ' ').trim()
}

function key(value: string) {
  return words(value).replace(/\s+/g, '')
}

function initials(value: string) {
  return words(value).split(' ')
    .filter(word => word && !['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o'].includes(word))
    .map(word => word[0]).join('')
}

/** General criteria belong to a subject across classes; document grades are context only. */
export function resolveAssessmentCriteriaDestinations(snapshot: SetupSnapshot, subjectLabel: string) {
  const yearId = snapshot.academicYear.id
  const blocked = new Set(snapshot.assessmentSchemes
    .filter(scheme => scheme.active && scheme.scope === 'subject')
    .map(scheme => scheme.teachingAssignmentId))
  const destinations = snapshot.teachingAssignments.flatMap(assignment => {
    const subject = snapshot.subjects.find(item => item.id === assignment.subjectId && item.active && item.academicYearId === yearId)
    const group = snapshot.groups.find(item => item.id === assignment.groupId && item.active && item.academicYearId === yearId)
    return assignment.active && assignment.academicYearId === yearId && group && subject
      ? [{ assignment, subject, group, label: `${group.name} · ${subject.name}${group.courseName ? ` · ${group.courseName}` : ''}` }]
      : []
  }).sort((left, right) => left.label.localeCompare(right.label, 'pt-PT', { numeric: true, sensitivity: 'base' }))

  const subjectKey = key(subjectLabel)
  const exact = subjectKey ? snapshot.subjects.filter(subject =>
    subject.active && subject.academicYearId === yearId &&
    [subject.name, subject.shortName, subject.code].some(label => label && key(label) === subjectKey)) : []
  const inferred = !subjectKey || exact.length ? [] : snapshot.subjects.filter(subject =>
    subject.active && subject.academicYearId === yearId &&
    (initials(subject.name) === subjectKey || key(subject.name) === initials(subjectLabel)))
  const matches = exact.length ? exact : inferred
  const subjectIds = new Set(matches.map(subject => subject.id))
  const matched = destinations.filter(item => subjectIds.has(item.subject.id))
  const available = destinations.filter(item => !blocked.has(item.assignment.id))
  const candidates = matched.filter(item => !blocked.has(item.assignment.id))
  const uniqueSubject = matches.length === 1

  return {
    available,
    candidates,
    preservedCount: matched.length - candidates.length,
    suggestedAssignmentIds: uniqueSubject ? candidates.map(item => item.assignment.id) : [],
    confidence: uniqueSubject ? (exact.length ? 'high' : 'medium') : 'unresolved',
    subjectName: uniqueSubject ? matches[0].name : ''
  } as const
}
