import type { SetupSnapshot } from '../../repository'
import type { Lesson, LessonAttendance } from '../../types'

type Mark = { number: string; process: string; code: string }

export interface HistoryRow {
  page: number
  group: string
  subject: string
  unit: string
  date: string
  start: string
  end: string
  valid: boolean
  teacherId: string
  teacher: string
  number: string
  summary: string
  attendance: Mark[]
  unreadAttendance: boolean
}

export interface HistoryBook {
  name: string
  hash: string
  rows: HistoryRow[]
  students: Array<{ group: string; process: string; name: string; number: string }>
}

export type HistoryEntry = {
  row: HistoryRow
  file: string
  lesson: Pick<Lesson, 'academicYearId' | 'teachingAssignmentId' | 'moduleId' | 'scheduleSlotId' | 'origin' |
    'date' | 'startTime' | 'endTime' | 'periodCount' | 'status' | 'countTowardProgress' |
    'summary' | 'giaeStatus' | 'officialLessonNumber'>
  attendance: Array<Pick<LessonAttendance, 'studentId' | 'status' | 'code'>>
  rosterIssue: boolean
}

export function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function groupKey(value: string) {
  return normalize(value).replace(/^(\d+)\s*[º°o]?\s*/, '$1').replace(/ /g, '')
}

function unitKey(value: string) {
  return normalize(value).replace(/^(?:ufcd|u c|uc|modulo|mod)\s*/, '').replace(/^m\s*(?=\d)/, '')
    .replace(/^0+(?=\d)/, '').replace(/ /g, '')
}

function teacherMatches(profileName: string, officialName: string) {
  const actual = normalize(officialName).split(' ').filter(Boolean)
  const profile = normalize(profileName).split(' ').filter(Boolean)
  if (actual.length < 2 || profile.length < 2) return false
  if (actual.join(' ') === profile.join(' ')) return true
  if (actual[0] !== profile[0] || actual.at(-1) !== profile.at(-1)) return false
  const shorter = actual.length <= profile.length ? actual : profile
  const longer = shorter === actual ? profile : actual
  let cursor = 0
  for (const word of longer) if (shorter[cursor] === word) cursor++
  return cursor === shorter.length
}

export function identifyGiaeTeacher(books: HistoryBook[], profileName: string) {
  const rows = books.flatMap(book => book.rows)
  const matchingCodes = new Set(rows.filter(row => row.teacherId && teacherMatches(profileName, row.teacher)).map(row => row.teacherId))
  if (matchingCodes.size !== 1) return null
  const [code] = matchingCodes
  // Codes can repeat across independently configured instances of the official software.
  if (rows.some(row => row.teacherId === code && row.teacher && !teacherMatches(profileName, row.teacher))) return null
  return code
}

export function professionalAssignments(snapshot: SetupSnapshot) {
  const groups = new Set(snapshot.groups.filter(group => group.active && group.educationType !== 'regular').map(group => group.id))
  return snapshot.teachingAssignments.filter(assignment => assignment.active && groups.has(assignment.groupId))
}

export function hasEarlierProfessionalLessons(snapshot: SetupSnapshot, today: string) {
  const assignments = new Set(professionalAssignments(snapshot).map(assignment => assignment.id))
  return snapshot.weeklyScheduleSlots.some(slot => {
    if (!slot.active || !assignments.has(slot.teachingAssignmentId)) return false
    const start = new Date(Math.max(Date.parse(slot.validFrom), Date.parse(snapshot.academicYear.startDate)))
    const firstWeekday = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() + (slot.weekday - firstWeekday + 7) % 7)
    const last = [slot.validUntil, snapshot.academicYear.endDate, today].sort()[0]
    while (Number.isFinite(+start)) {
      const date = start.toISOString().slice(0, 10)
      if (date >= today || date > last) return false
      if (!slot.excludedDates?.includes(date)) return true
      start.setUTCDate(start.getUTCDate() + 7)
    }
    return false
  })
}

export function prepareGiaeHistory(books: HistoryBook[], profileName: string, snapshot: SetupSnapshot, today: string) {
  const assignments = professionalAssignments(snapshot)
  const teacher = identifyGiaeTeacher(books, profileName)
  const entries: HistoryEntry[] = []
  const issues: Array<{ row: HistoryRow; file: string; reason: string }> = []
  if (!teacher) return { teacher, entries, issues }

  for (const book of books) {
    for (const row of book.rows) {
      if (row.date < snapshot.academicYear.startDate || row.date > snapshot.academicYear.endDate || row.date >= today) continue
      if (row.teacherId !== teacher) {
        if (!row.teacherId && row.summary) issues.push({ row, file: book.name, reason: 'Docente sem código no PDF' })
        continue
      }
      if (row.number && !/^[1-9]\d*(?:\s*[-–]\s*[1-9]\d*)?$/.test(row.number)) {
        issues.push({ row, file: book.name, reason: 'Número de lição por confirmar' })
        continue
      }
      const candidates = assignments.filter(assignment => {
        const group = snapshot.groups.find(item => item.id === assignment.groupId)
        const subject = snapshot.subjects.find(item => item.id === assignment.subjectId)
        return group && subject?.active && groupKey(group.name) === groupKey(row.group) &&
          [subject.code, subject.shortName, subject.name].some(value => value && normalize(value) === normalize(row.subject))
      })
      const [assignment] = candidates
      const unit = unitKey(row.unit)
      const modules = snapshot.modules.filter(module => module.active && module.teachingAssignmentId === assignment?.id)
      const matchingUnits = modules.filter(module => [module.code, module.name].some(value => value && unitKey(value) === unit))
      const module = matchingUnits.length === 1 ? matchingUnits[0] : !unit && modules.length === 1 ? modules[0] : undefined

      if (!row.valid || candidates.length !== 1 || !assignment || !module) {
        issues.push({ row, file: book.name, reason: !row.valid ? 'Hora ou número de lição ilegível' :
          candidates.length !== 1 ? 'Turma ou disciplina por identificar' : 'Unidade curricular por identificar' })
        continue
      }
      const weekday = new Date(row.date).getUTCDay() || 7
      const slots = snapshot.weeklyScheduleSlots.filter(slot => slot.active && slot.teachingAssignmentId === assignment.id &&
        slot.weekday === weekday && slot.validFrom <= row.date && row.date <= slot.validUntil &&
        !slot.excludedDates?.includes(row.date) && slot.startTime === row.start && slot.endTime === row.end)
      const slot = slots.length === 1 ? slots[0] : undefined
      const attendance: HistoryEntry['attendance'] = []
      let rosterIssue = row.unreadAttendance
      for (const mark of row.attendance) {
        const roster = book.students.find(student => groupKey(student.group) === groupKey(row.group) &&
          student.number === mark.number && student.process === mark.process)
        const students = snapshot.students.filter(student => student.groupId === assignment.groupId &&
          (student.processNumber ? student.processNumber.trim() === mark.process :
            roster && student.number === mark.number && normalize(student.name) === normalize(roster.name)))
        if (students.length === 1) {
          attendance.push({ studentId: students[0].id, status: 'absent', code: mark.code })
        } else rosterIssue = true
      }
      const [first, last] = row.number.split(/\s*[-–]\s*/).map(Number)
      const periodCount = last >= first && first > 0 ? last - first + 1 : slot?.periodCount ?? 1
      entries.push({
        row, file: book.name, attendance, rosterIssue,
        lesson: {
          academicYearId: snapshot.academicYear.id, teachingAssignmentId: assignment.id, moduleId: module.id,
          scheduleSlotId: slot?.id ?? null, origin: slot ? 'scheduled' : 'extra',
          date: row.date, startTime: row.start, endTime: row.end, periodCount,
          status: row.number ? 'taught' : 'cancelled', countTowardProgress: Boolean(row.number),
          summary: row.summary, giaeStatus: row.number ? 'submitted' : 'pending',
          officialLessonNumber: row.number || undefined
        }
      })
    }
  }
  return { teacher, entries, issues }
}
