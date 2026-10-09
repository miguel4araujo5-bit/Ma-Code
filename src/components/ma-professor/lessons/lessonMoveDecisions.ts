import { maProfessorDb } from '../db'
import type { EntityId, Lesson } from '../types'

export interface LessonMoveOptions {
  submitted?: { action: 'skip' | 'clear'; confirmationKey: string }
  records?: { action: 'transfer' | 'delete'; confirmationKey: string; deletionConfirmed?: boolean }
}

export interface LessonMoveDestination {
  lesson: Lesson
  date: string
  startTime: string
  endTime: string
}

type MoveLessonLink = Pick<Lesson, 'id' | 'date' | 'startTime' | 'endTime'>

function lessonLinks(lessons: Lesson[]): MoveLessonLink[] {
  return lessons.map(({ id, date, startTime, endTime }) => ({ id, date, startTime, endTime }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
}

function sorted<T extends { id: string }>(rows: T[]) {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))
}

export class LessonMoveBlockedError extends Error {
  readonly lessons: MoveLessonLink[]
  constructor(lessons: Lesson[], readonly confirmationKey = '') {
    super('Uma ou mais aulas abrangidas estão submetidas no programa oficial. Escolha saltá-las ou retire primeiro os vistos locais com confirmação; nenhuma alteração foi aplicada.')
    this.name = 'LessonMoveBlockedError'
    this.lessons = lessonLinks(lessons)
  }
}

export class LessonMoveRecordsError extends Error {
  readonly lessons: MoveLessonLink[]
  constructor(lessons: Lesson[], readonly absenceCount: number, readonly assessmentCount: number, readonly confirmationKey: string) {
    super('Estas aulas têm faltas ou avaliações. Escolha mantê-las com cada aula ou eliminá-las antes de continuar; nenhuma alteração foi aplicada.')
    this.name = 'LessonMoveRecordsError'
    this.lessons = lessonLinks(lessons)
  }
}

export function selectLessonMoveDestinations(
  destinations: LessonMoveDestination[], sourceId: EntityId, options: LessonMoveOptions, context: string, allowSourceSkip = false
) {
  const submitted = destinations.map(row => row.lesson).filter(lesson => lesson.giaeStatus === 'submitted')
  if (!submitted.length) return destinations
  const confirmationKey = JSON.stringify({ context, destinations, submitted: sorted(submitted) })
  if (options.submitted?.confirmationKey !== confirmationKey ||
      (options.submitted.action === 'skip' && !allowSourceSkip && submitted.some(lesson => lesson.id === sourceId))) {
    throw new LessonMoveBlockedError(submitted, confirmationKey)
  }
  return options.submitted.action === 'skip'
    ? destinations.filter(row => row.lesson.giaeStatus !== 'submitted')
    : destinations
}

export async function validateLessonMovePositions(destinations: LessonMoveDestination[]) {
  const year = await maProfessorDb.academicYears.get(destinations[0].lesson.academicYearId)
  const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  for (const row of destinations) {
    const parsedDate = new Date(row.date + 'T00:00:00Z')
    if (!year || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
        Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== row.date ||
        row.date < year.startDate || row.date > year.endDate ||
        !timePattern.test(row.startTime) || !timePattern.test(row.endTime) || row.startTime >= row.endTime) {
      throw new Error('A data ou hora de destino da aula de ' + row.lesson.date + ' é inválida ou fica fora do ano letivo. Nenhuma alteração foi aplicada.')
    }
  }
}

export async function prepareLessonMoveRecords(
  destinations: LessonMoveDestination[], options: LessonMoveOptions, context: string, swapping: boolean
) {
  const affected = destinations.filter(row => swapping || row.date !== row.lesson.date)
  const lessonIds = affected.map(row => row.lesson.id)
  const [attendance, assessments, recoveries] = lessonIds.length ? await Promise.all([
    maProfessorDb.lessonAttendance.where('lessonId').anyOf(lessonIds).toArray(),
    maProfessorDb.lessonAssessments.where('lessonId').anyOf(lessonIds).toArray(),
    maProfessorDb.learningRecoveries.where('academicYearId').equals(affected[0].lesson.academicYearId).toArray()
  ]) : [[], [], []]
  const idSet = new Set(lessonIds)
  const absenceIds = new Set(attendance.filter(row => row.status === 'absent').map(row => row.id))
  const attendanceIds = new Set(attendance.map(row => row.id))
  const linkedRecoveries = recoveries.filter(row =>
    row.removedAbsences?.some(absence => idSet.has(absence.lessonId)) ||
    row.selectedAbsenceIds?.some(id => attendanceIds.has(id))
  )
  for (const recovery of linkedRecoveries) {
    for (const absence of recovery.removedAbsences ?? []) {
      if (idSet.has(absence.lessonId)) absenceIds.add(absence.attendanceId)
    }
  }
  const results = assessments.length
    ? await maProfessorDb.assessmentResults.where('assessmentId').anyOf(assessments.map(row => row.id)).toArray()
    : []
  if (absenceIds.size || assessments.length) {
    const confirmationKey = JSON.stringify({ context, affected, attendance: sorted(attendance), assessments: sorted(assessments), results: sorted(results), recoveries: sorted(linkedRecoveries) })
    if (options.records?.confirmationKey !== confirmationKey ||
        (options.records.action === 'delete' && options.records.deletionConfirmed !== true)) {
      const relatedIds = new Set([
        ...attendance.filter(row => absenceIds.has(row.id)).map(row => row.lessonId),
        ...assessments.map(row => row.lessonId),
        ...linkedRecoveries.flatMap(row => (row.removedAbsences ?? []).filter(absence => idSet.has(absence.lessonId)).map(absence => absence.lessonId))
      ])
      throw new LessonMoveRecordsError(affected.filter(row => relatedIds.has(row.lesson.id)).map(row => row.lesson), absenceIds.size, assessments.length, confirmationKey)
    }
  }
  return { affected, absenceIds, assessments, recoveries: linkedRecoveries }
}

export async function applyLessonMoveRecords(
  prepared: Awaited<ReturnType<typeof prepareLessonMoveRecords>>, options: LessonMoveOptions, timestamp: string
) {
  const deleting = options.records?.action === 'delete'
  if (deleting) {
    if (prepared.assessments.length) {
      await maProfessorDb.assessmentResults.where('assessmentId').anyOf(prepared.assessments.map(row => row.id)).delete()
      await maProfessorDb.lessonAssessments.bulkDelete(prepared.assessments.map(row => row.id))
    }
    await maProfessorDb.lessonAttendance.bulkDelete([...prepared.absenceIds])
  }
  const dateByLessonId = new Map(prepared.affected.map(row => [row.lesson.id, row.date]))
  for (const recovery of prepared.recoveries) {
    const selectedAbsenceIds = deleting
      ? recovery.selectedAbsenceIds?.filter(id => !prepared.absenceIds.has(id))
      : recovery.selectedAbsenceIds
    const removedAbsences = recovery.removedAbsences?.flatMap(absence => {
      const date = dateByLessonId.get(absence.lessonId)
      if (!date) return [absence]
      return deleting ? [] : [{ ...absence, date }]
    })
    if (JSON.stringify(selectedAbsenceIds) !== JSON.stringify(recovery.selectedAbsenceIds) ||
        JSON.stringify(removedAbsences) !== JSON.stringify(recovery.removedAbsences)) {
      await maProfessorDb.learningRecoveries.put({ ...recovery, selectedAbsenceIds, removedAbsences, updatedAt: timestamp })
    }
  }
}
