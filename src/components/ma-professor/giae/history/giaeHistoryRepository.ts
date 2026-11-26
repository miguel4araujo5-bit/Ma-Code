import { maProfessorDb, openMAProfessorDatabase } from '../../db'
import type { Lesson, LessonAttendance } from '../../types'
import type { HistoryEntry } from './giaeHistory'

export type HistoryChoice = 'keep' | 'official'
export type HistoryConflict = { key: string; current: Lesson; entry: HistoryEntry; version: string }

function keyOf(lesson: Pick<Lesson, 'teachingAssignmentId' | 'date' | 'startTime'>) {
  return JSON.stringify([lesson.teachingAssignmentId, lesson.date, lesson.startTime])
}

function marksSignature(marks: Array<Pick<LessonAttendance, 'studentId' | 'status' | 'code'>>) {
  return JSON.stringify(marks.filter(mark => mark.status === 'absent').map(mark => [mark.studentId, mark.code]).sort())
}

function versionOf(lesson: Lesson, marks: LessonAttendance[]) {
  return JSON.stringify([lesson, marksSignature(marks)])
}

export function selectUniqueHistoryEntries(entries: HistoryEntry[]) {
  const unique = new Map<string, HistoryEntry>()
  const divergent = new Set<string>()
  for (const entry of entries) {
    const key = keyOf(entry.lesson)
    const previous = unique.get(key)
    if (!previous) unique.set(key, entry)
    else if (JSON.stringify(previous.lesson) !== JSON.stringify(entry.lesson) ||
      marksSignature(previous.attendance) !== marksSignature(entry.attendance)) divergent.add(key)
  }
  return { entries: [...unique].filter(([key]) => !divergent.has(key)).map(([, entry]) => entry), divergent: divergent.size }
}

async function inspect(academicYearId: string, entries: HistoryEntry[]) {
  const lessons = await maProfessorDb.lessons.where('academicYearId').equals(academicYearId).toArray()
  const indexed = new Map<string, Lesson[]>()
  for (const lesson of lessons) {
    const key = keyOf(lesson)
    indexed.set(key, [...(indexed.get(key) ?? []), lesson])
  }
  return Promise.all(entries.map(async entry => {
    const key = keyOf(entry.lesson)
    const matches = indexed.get(key) ?? []
    const [lesson] = matches
    const [marks, assessments] = lesson
      ? await Promise.all([
        maProfessorDb.lessonAttendance.where('lessonId').equals(lesson.id).toArray(),
        maProfessorDb.lessonAssessments.where('lessonId').equals(lesson.id).count()
      ])
      : [[], 0] as const
    const existingMarks = [...marks]
    const unchanged = lesson && lesson.summary.trim() === entry.lesson.summary.trim() &&
      lesson.moduleId === entry.lesson.moduleId && lesson.endTime === entry.lesson.endTime &&
      lesson.status === entry.lesson.status && lesson.giaeStatus === entry.lesson.giaeStatus &&
      lesson.officialLessonNumber === entry.lesson.officialLessonNumber &&
      lesson.countTowardProgress === entry.lesson.countTowardProgress &&
      lesson.periodCount === entry.lesson.periodCount && marksSignature(existingMarks) === marksSignature(entry.attendance)
    const hasConflict = lesson && !unchanged && (
      lesson.status !== 'planned' || lesson.giaeStatus === 'submitted' || Boolean(lesson.summary || lesson.notes ||
        lesson.plannedActivity || lesson.planificationItemIds.length || assessments || existingMarks.length || lesson.anticipation)
    )
    const conflict = hasConflict
      ? { key, current: lesson, entry, version: versionOf(lesson, existingMarks) }
      : null
    return { key, lesson, entry, marks: existingMarks, unchanged, conflict, ambiguous: matches.length > 1 }
  }))
}

export async function reviewGiaeHistory(academicYearId: string, entries: HistoryEntry[]) {
  await openMAProfessorDatabase()
  const rows = await inspect(academicYearId, entries)
  return {
    conflicts: rows.flatMap(row => row.conflict && !row.ambiguous ? [row.conflict] : []),
    ambiguous: rows.filter(row => row.ambiguous).length
  }
}

export async function deferGiaeHistory(academicYearId: string) {
  await openMAProfessorDatabase()
  await maProfessorDb.transaction('rw', maProfessorDb.academicYears, async () => {
    const year = await maProfessorDb.academicYears.get(academicYearId)
    if (year?.giaeHistoryImport === 'pending') {
      await maProfessorDb.academicYears.update(academicYearId, { giaeHistoryImport: 'deferred', updatedAt: new Date().toISOString() })
    }
  })
}

export async function closeGiaeHistoryOffer(academicYearId: string) {
  await openMAProfessorDatabase()
  await maProfessorDb.transaction('rw', maProfessorDb.academicYears, async () => {
    const year = await maProfessorDb.academicYears.get(academicYearId)
    if (year?.giaeHistoryImport === 'pending') {
      await maProfessorDb.academicYears.update(academicYearId, { giaeHistoryImport: 'completed', updatedAt: new Date().toISOString() })
    }
  })
}

export async function saveGiaeHistory(
  academicYearId: string,
  entries: HistoryEntry[],
  choices: Record<string, { choice: HistoryChoice; version: string }>
) {
  await openMAProfessorDatabase()
  return maProfessorDb.transaction('rw', [
    maProfessorDb.academicYears, maProfessorDb.lessons, maProfessorDb.lessonAttendance,
    maProfessorDb.lessonAssessments, maProfessorDb.modules, maProfessorDb.students, maProfessorDb.teachingAssignments,
    maProfessorDb.weeklyScheduleSlots, maProfessorDb.groups, maProfessorDb.subjects
  ], async () => {
    const year = await maProfessorDb.academicYears.get(academicYearId)
    if (!year?.active || !['pending', 'deferred'].includes(year.giaeHistoryImport ?? '')) {
      throw new Error('O estado da importação mudou. Reabra o Diário para atualizar a página.')
    }
    const rows = await inspect(academicYearId, entries)
    const now = new Date().toISOString()
    const localToday = [new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate()]
      .map((part, i) => String(part).padStart(i === 0 ? 4 : 2, '0')).join('-')
    let saved = 0
    for (const { key, lesson, entry, marks, unchanged, conflict, ambiguous } of rows) {
      if (unchanged || ambiguous) continue
      const choice = choices[key]
      if (conflict && (!choice || conflict.version !== choice.version)) {
        throw new Error('Há aulas que mudaram desde a revisão. Volte a comparar os registos antes de guardar.')
      }
      if (choice?.choice === 'keep') continue
      const data = entry.lesson
      if (data.academicYearId !== academicYearId || data.date < year.startDate || data.date > year.endDate || data.date >= localToday) {
        throw new Error('O PDF contém uma data fora do histórico deste ano letivo.')
      }
      const [unit, assignment, slot] = await Promise.all([
        maProfessorDb.modules.get(data.moduleId),
        maProfessorDb.teachingAssignments.get(data.teachingAssignmentId),
        data.scheduleSlotId ? maProfessorDb.weeklyScheduleSlots.get(data.scheduleSlotId) : undefined
      ])
      const [group, subject] = await Promise.all([
        assignment ? maProfessorDb.groups.get(assignment.groupId) : undefined,
        assignment ? maProfessorDb.subjects.get(assignment.subjectId) : undefined
      ])
      if (unit?.teachingAssignmentId !== data.teachingAssignmentId || !unit?.active ||
        assignment?.academicYearId !== academicYearId || !assignment.active || !group?.active ||
        group.educationType === 'regular' || !subject?.active ||
        (data.scheduleSlotId && (!slot?.active || slot.teachingAssignmentId !== data.teachingAssignmentId ||
          slot.startTime !== data.startTime || slot.endTime !== data.endTime))) {
        throw new Error('A configuração das aulas mudou. Carregue novamente os PDFs para atualizar a revisão.')
      }
      const target: Lesson = {
        ...lesson, ...data,
        plannedActivity: lesson?.plannedActivity ?? '', notes: lesson?.notes ?? '',
        planificationItemIds: lesson?.planificationItemIds ?? [], summarySource: 'manual',
        id: lesson?.id ?? crypto.randomUUID(),
        // O PDF comprova a submissão, mas não fornece a sua data.
        giaeSubmittedAt: data.giaeStatus === 'submitted' ? lesson?.giaeSubmittedAt ?? null : null,
        createdAt: lesson?.createdAt ?? now, updatedAt: now
      }
      const importedByStudent = new Map(entry.attendance.map(mark => [mark.studentId, mark]))
      const currentByStudent = new Map(marks.map(mark => [mark.studentId, mark]))
      for (const mark of importedByStudent.values()) {
        const student = await maProfessorDb.students.get(mark.studentId)
        if (!student || student.academicYearId !== academicYearId || student.groupId !== assignment.groupId) {
          throw new Error('A lista de alunos mudou. Carregue novamente os PDFs para atualizar a revisão.')
        }
        const current = currentByStudent.get(mark.studentId)
        await maProfessorDb.lessonAttendance.put({
          id: current?.id ?? crypto.randomUUID(), lessonId: target.id, ...mark,
          note: current?.note ?? '', createdAt: current?.createdAt ?? now, updatedAt: now
        })
      }
      if (!entry.rosterIssue) {
        await maProfessorDb.lessonAttendance.bulkDelete(marks.filter(mark =>
          mark.status === 'absent' && !importedByStudent.has(mark.studentId)).map(mark => mark.id))
      }
      await maProfessorDb.lessons.put(target)
      saved++
    }
    await maProfessorDb.academicYears.update(academicYearId, { giaeHistoryImport: 'completed', updatedAt: now })
    return saved
  })
}
