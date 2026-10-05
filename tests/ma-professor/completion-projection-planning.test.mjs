import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import 'fake-indexeddb/auto'

globalThis.window = { indexedDB: globalThis.indexedDB }
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/completion-planning-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/lessons/ufcdProgress'
export * from './src/components/ma-professor/lessons/ufcdProgressRepository'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const year = { ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-14', endDate: '2027-07-31', active: true }
const modules = ['A', 'B'].map((id, i) => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: 'a', code: id, name: id, order: i + 1, plannedPeriods: 20, plannedStartDate: null, plannedEndDate: null, active: true }))
const slot = (weekday, extras = {}) => ({ ...audit, id: `slot-${weekday}`, academicYearId: 'y', teachingAssignmentId: 'a', weekday, startTime: '09:00', endTime: '10:40', periodCount: 2, validFrom: year.startDate, validUntil: year.endDate, active: true, ...extras })
const lesson = (id, date, extras = {}) => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'A', scheduleSlotId: null, origin: 'extra', status: 'taught', date, startTime: '09:00', endTime: '10:40', periodCount: 2, countTowardProgress: true, plannedActivity: '', summary: 'Sumário de teste', summarySource: 'manual', planificationItemIds: [], giaeStatus: 'pending', giaeSubmittedAt: null, notes: '', ...extras })
const pendingLessons = ['14', '16', '21', '23', '28', '30'].map((day, i) => lesson(`lesson-${i}`, `2026-09-${day}`))
const laterModuleLessons = ['14', '15', '16', '17', '18', '21', '22', '23', '24', '25'].map((day, i) => lesson(`B-${i}`, `2026-09-${day}`, { moduleId: 'B', startTime: '13:00', endTime: '14:40', giaeStatus: 'submitted', giaeSubmittedAt: stamp }))
const projection = () => api.ufcdProgressRepository.getAssignmentCompletionProjection('a')
const confirmedProgress = async () => api.buildUfcdModuleProgress(modules, await db.lessons.toArray())
const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, await table.toArray()])))

beforeEach(async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-05T12:00:00Z') })
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put(year)
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: 'Turma de teste', courseName: 'Curso de teste', gradeLevel: '10', educationType: 'professional', active: true })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Disciplina de teste', shortName: 'Teste', active: true })
  await db.teachingAssignments.put({ ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', displayName: 'Teste', active: true })
  await db.modules.bulkPut(modules)
  await db.weeklyScheduleSlots.bulkPut([slot(1), slot(3)])
  await db.lessons.bulkPut(pendingLessons)
  await api.ensureDefaultMAProfessorSettings()
})
after(async () => { db.close(); await rm(temp, { recursive: true, force: true }) })

test('past pending lessons stay in the forecast while GIAE alone validates actual progress', async () => {
  for (const submitted of [0, 2, 6]) {
    await db.lessons.bulkPut(pendingLessons.map((row, i) => ({ ...row, giaeStatus: i < submitted ? 'submitted' : 'pending', giaeSubmittedAt: i < submitted ? stamp : null })))
    const before = await snapshot()
    const result = await projection()
    assert.deepEqual(result.modules.map(row => row.estimatedCompletionDate), ['2026-10-14', '2026-11-18'])
    assert.equal(result.disciplineCompletionDate, '2026-11-18')
    assert.equal((await confirmedProgress())[0].periodsTaught, submitted * 2)
    assert.deepEqual(await snapshot(), before, 'Forecasting must not create, reschedule or validate lessons.')
  }
})

test('time passing without timetable or lesson changes does not move the planning forecast', async t => {
  const before = await snapshot()
  const first = await projection()
  t.mock.timers.tick(7 * 24 * 60 * 60 * 1000)
  assert.deepEqual(await projection(), first)
  assert.equal((await confirmedProgress())[0].periodsTaught, 0)
  assert.deepEqual(await snapshot(), before)
})

test('unregistered timetable occurrences are forecast without adding persisted lessons or actual progress', async () => {
  await db.lessons.clear()
  const before = await snapshot()
  assert.equal((await projection()).disciplineCompletionDate, '2026-11-18')
  assert.equal((await confirmedProgress())[0].periodsTaught, 0)
  assert.deepEqual(await snapshot(), before)
})

test('a cancelled past occurrence remains cancelled and delays the forecast without regeneration', async () => {
  await db.lessons.update('lesson-0', { status: 'cancelled' })
  const before = await snapshot()
  const result = await projection()
  assert.deepEqual(result.modules.map(row => row.estimatedCompletionDate), ['2026-10-19', '2026-11-23'])
  assert.equal((await db.lessons.get('lesson-0')).status, 'cancelled')
  assert.deepEqual(await snapshot(), before)
})

test('a saved explicit exclusion from progress does not reappear as a virtual timetable lesson', async () => {
  await db.lessons.update('lesson-0', { countTowardProgress: false })
  const before = await snapshot()
  assert.equal((await projection()).disciplineCompletionDate, '2026-11-23')
  assert.deepEqual(await snapshot(), before)
})

test('past and future calendar breaks remain excluded from the planning forecast', async () => {
  await db.schoolCalendarEvents.bulkPut(['2026-09-21', '2026-10-12'].map((date, i) => ({ ...audit, id: `blocked-${i}`, academicYearId: 'y', title: 'Interrupção', description: '', type: 'school_break', scope: 'all', groupId: null, teachingAssignmentId: null, startDate: date, endDate: date, blocksLessons: true })))
  const before = await snapshot()
  assert.deepEqual((await projection()).modules.map(row => row.estimatedCompletionDate), ['2026-10-21', '2026-11-25'])
  assert.deepEqual(await snapshot(), before)
})

test('dated timetable changes preserve old planned occurrences and use the new future schedule', async () => {
  await db.weeklyScheduleSlots.bulkPut([slot(1, { validUntil: '2026-09-30' }), slot(3, { validUntil: '2026-09-30' }), slot(2, { validFrom: '2026-10-01' }), slot(4, { validFrom: '2026-10-01' })])
  const before = await snapshot()
  // A aula prevista para quinta-feira, 01/10, também permanece no planeamento.
  assert.deepEqual((await projection()).modules.map(row => row.estimatedCompletionDate), ['2026-10-13', '2026-11-17'])
  assert.deepEqual(await snapshot(), before)
})

test('forecasting still extends the last timetable beyond the configured year without persisting those lessons', async () => {
  await db.academicYears.update('y', { endDate: '2026-10-05' })
  await db.weeklyScheduleSlots.bulkPut([slot(1, { validUntil: '2026-10-05' }), slot(3, { validUntil: '2026-10-05' })])
  const before = await snapshot()
  assert.equal((await projection()).disciplineCompletionDate, '2026-11-18')
  assert.deepEqual(await snapshot(), before)
})

test('a later UFCD completed early cannot make the discipline finish before its unfinished earlier UFCD', async () => {
  await db.lessons.bulkPut(laterModuleLessons)
  const result = await projection()
  assert.deepEqual(result.modules.map(row => row.estimatedCompletionDate), ['2026-10-14', '2026-09-25'])
  assert.equal(result.disciplineCompletionDate, '2026-10-14')
  assert.equal(api.selectCurrentUfcd(modules, await confirmedProgress()).id, 'A')
})

test('a completed last UFCD cannot hide an earlier UFCD with no forecastable completion date', async () => {
  await db.lessons.bulkPut(laterModuleLessons)
  await db.weeklyScheduleSlots.clear()
  const result = await projection()
  assert.deepEqual(result.modules.map(row => row.estimatedCompletionDate), [null, '2026-09-25'])
  assert.equal(result.disciplineCompletionDate, null)
})
