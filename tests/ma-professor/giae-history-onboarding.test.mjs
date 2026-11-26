import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import 'fake-indexeddb/auto'

globalThis.window = { indexedDB: globalThis.indexedDB }
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temporary = await mkdtemp(resolve('node_modules/.tmp/giae-history-'))
const outfile = resolve(temporary, 'runtime.mjs')
await build({ stdin: { contents: `
  export * from './src/components/ma-professor/db'
  export * from './src/components/ma-professor/giae/history/giaeHistory'
  export * from './src/components/ma-professor/giae/history/giaeHistoryRepository'
  export * from './src/components/ma-professor/lessons/ufcdProgress'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node',
  format: 'esm', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-11-01T12:00:00Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const today = '2026-11-26'
const year = { ...audit, id: 'y', active: true, startDate: '2026-09-01', endDate: '2027-08-31', giaeHistoryImport: 'pending' }
const group = { ...audit, id: 'g', academicYearId: 'y', name: '10.º Z', educationType: 'professional', active: true }
const subject = { ...audit, id: 's', academicYearId: 'y', code: 'TESTE', shortName: 'TESTE', name: 'Área fictícia', active: true }
const assignment = { ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', active: true }
const module = { ...audit, id: 'm', academicYearId: 'y', teachingAssignmentId: 'a', code: '33', name: 'Unidade fictícia', plannedPeriods: 60, active: true }
const student = { ...audit, id: 'p', academicYearId: 'y', groupId: 'g', number: '5', name: 'Aluno de teste', processNumber: '2222', active: true }
const slot = { ...audit, id: 't', academicYearId: 'y', teachingAssignmentId: 'a', weekday: 3, startTime: '13:20', endTime: '14:10', periodCount: 1, active: true, validFrom: '2026-09-01', validUntil: '2027-08-31' }
const snapshot = { academicYear: year, groups: [group], subjects: [subject], teachingAssignments: [assignment], modules: [module], students: [student], weeklyScheduleSlots: [slot] }
const row = (changes = {}) => ({
  page: 4, group: '10º Z', subject: 'TESTE', unit: 'UC00033', date: '2026-11-18',
  start: '13:20', end: '14:10', valid: true, teacherId: 'f001', teacher: 'Rita Vale',
  number: '89', summary: 'Sumário fictício', attendance: [], unreadAttendance: false, ...changes
})
const book = (...rows) => ({ name: 'Livro de ponto fictício.pdf', hash: 'synthetic', rows, students: [] })
const prepare = (books, name = 'Rita Gomes Vale') => api.prepareGiaeHistory(books, name, snapshot, today)
const draft = (changes = {}) => ({
  ...audit, id: 'initial', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm',
  scheduleSlotId: 't', origin: 'scheduled', date: '2026-11-18', startTime: '13:20', endTime: '14:10',
  status: 'planned', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: '',
  summarySource: 'manual', planificationItemIds: [], giaeStatus: 'pending', giaeSubmittedAt: null, notes: '',
  ...changes
})

beforeEach(async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-26T12:00:00Z') })
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await Promise.all([
    db.academicYears.put(year), db.groups.put(group), db.subjects.put(subject),
    db.teachingAssignments.put(assignment), db.modules.put(module), db.students.put(student),
    db.weeklyScheduleSlots.put(slot)
  ])
})
after(async () => { db.close(); await rm(temporary, { recursive: true, force: true }) })

test('uses the official teacher code even with another teacher in the same class and time', () => {
  const result = prepare([book(row(), row({ teacherId: 'f002', teacher: 'Outro Professor', summary: 'Sumário alheio' }),
    row({ teacherId: '', teacher: '' }), row({ date: today }), row({ number: '0' }))])
  assert.equal(result.entries.length, 1)
  assert.equal(result.entries[0].lesson.summary, 'Sumário fictício')
  assert.equal(result.entries[0].lesson.scheduleSlotId, 't')
  assert.equal(result.issues.length, 2)
  assert.equal(prepare([book(row(), row({ teacherId: 'f002' }))]).teacher, null)
  assert.equal(prepare([book(row())], ' ').teacher, null)
  assert.equal(api.hasEarlierProfessionalLessons(snapshot, today), true)
  assert.equal(api.hasEarlierProfessionalLessons(snapshot, year.startDate), false)
})

test('stores submitted, blocked and off-schedule classes, attendance and continued numbering', async () => {
  await db.lessons.put(draft())
  await api.deferGiaeHistory('y')
  assert.equal((await db.academicYears.get('y')).giaeHistoryImport, 'deferred')
  const result = prepare([book(
    row({ attendance: [{ number: '5', process: '2222', code: 'FI' }] }),
    row({ date: '2026-11-19', number: '', summary: 'Atividade não contabilizada' }),
    row({ date: '2026-11-20', start: '09:30', end: '10:20', number: '90' })
  )])
  assert.equal(await api.saveGiaeHistory('y', result.entries, {}), 3)
  const lessons = await db.lessons.toArray()
  const submitted = await db.lessons.get('initial')
  const blocked = lessons.find(lesson => lesson.date === '2026-11-19')
  const moved = lessons.find(lesson => lesson.date === '2026-11-20')
  assert.equal(submitted.giaeStatus, 'submitted')
  assert.equal(blocked.status, 'cancelled')
  assert.equal(blocked.countTowardProgress, false)
  assert.equal(blocked.summary, 'Atividade não contabilizada')
  assert.equal(moved.origin, 'extra')
  assert.equal(moved.startTime, '09:30')
  assert.equal(api.getLessonNumbering(blocked, lessons).lessonNumber, null)
  assert.equal(api.getLessonNumbering(submitted, lessons).lessonNumber, '89')
  assert.equal(api.getLessonNumbering(draft({ date: today }), lessons).lessonNumber, '91')
  assert.equal(api.buildUfcdModuleProgress([module], lessons)[0].periodsTaught, 2)
  assert.equal((await db.lessonAttendance.where('lessonId').equals('initial').first()).code, 'FI')
  assert.equal((await db.academicYears.get('y')).giaeHistoryImport, 'completed')
  await assert.rejects(api.saveGiaeHistory('y', result.entries, {}), /estado da importação mudou/)
})

test('requires a current conflict decision and does not modify the database on an invalid review', async () => {
  await db.lessons.put(draft({ summary: 'Sumário guardado' }))
  const { entries } = prepare([book(row(), row({ date: '2026-11-17' }))])
  const { conflicts } = await api.reviewGiaeHistory('y', entries)
  assert.equal(conflicts.length, 1)
  await assert.rejects(api.saveGiaeHistory('y', entries, {}), /desde a revisão/)
  assert.equal(await db.lessons.count(), 1)
  assert.equal((await db.lessons.get('initial')).summary, 'Sumário guardado')
  await api.saveGiaeHistory('y', entries, { [conflicts[0].key]: { choice: 'keep', version: conflicts[0].version } })
  assert.equal(await db.lessons.count(), 2)
  assert.equal((await db.lessons.get('initial')).summary, 'Sumário guardado')
})

test('collapses identical entries and excludes conflicting versions of the same lesson', () => {
  const { entries } = prepare([book(row()), book(row()), book(row({ date: '2026-11-19' })), book(row({ date: '2026-11-19', summary: 'Outro texto' }))])
  const result = api.selectUniqueHistoryEntries(entries)
  assert.equal(result.entries.length, 1)
  assert.equal(result.divergent, 1)
})
