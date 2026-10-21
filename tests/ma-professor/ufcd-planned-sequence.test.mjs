import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import 'fake-indexeddb/auto'

globalThis.window = { indexedDB: globalThis.indexedDB }
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/ufcd-planned-sequence-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/lessons/ufcdProgress'
export * from './src/components/ma-professor/lessons/ufcdProgressRepository'
export * from './src/components/ma-professor/lessons/lessonRepository'
export * from './src/components/ma-professor/lessons/scheduledLessonReconciliation'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const modules = [1, 2, 3].map(order => ({ ...audit, id: `m${order}`, academicYearId: 'y', teachingAssignmentId: 'a', code: String(order), name: `UFCD ${order}`, order, plannedPeriods: 30, active: true, plannedStartDate: null, plannedEndDate: null }))
const lesson = (id, date, changes = {}) => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm1', scheduleSlotId: null, origin: 'extra', status: 'planned', date, startTime: '15:00', endTime: '16:00', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: '', summarySource: 'manual', planificationItemIds: [], giaeStatus: 'pending', giaeSubmittedAt: null, notes: '', ...changes })
const priorLessons = Array.from({ length: 29 }, (_, i) => lesson(`prior-${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, { status: 'taught', summary: `Sumário já guardado ${i}`, plannedActivity: `Preparação ${i}`, notes: `Nota privada ${i}`, giaeStatus: i < 20 ? 'submitted' : 'pending', giaeSubmittedAt: i < 20 ? stamp : null }))
const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, (await table.toArray()).sort((a, b) => String(a.id).localeCompare(String(b.id)))])))
const numbering = async id => api.getLessonNumbering(await db.lessons.get(id), await db.lessons.toArray())
const confirmed = async () => api.buildUfcdModuleProgress(modules, await db.lessons.toArray()).map(row => row.periodsTaught)

beforeEach(async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-21T12:00:00Z') })
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: '10.º D fictício', courseName: 'Curso de teste', gradeLevel: '10', educationType: 'professional', active: true })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Expressão fictícia', shortName: 'EF', active: true })
  await db.teachingAssignments.put({ ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', displayName: 'EF · 10.º D', active: true })
  await db.modules.bulkPut(modules)
  await db.students.bulkPut([1, 2].map(number => ({ ...audit, id: `student-${number}`, academicYearId: 'y', groupId: 'g', number, name: `Aluno fictício ${number}`, active: true })))
  await db.lessons.bulkPut([...priorLessons, lesson('last', '2026-10-20'), lesson('next', '2026-10-20', { moduleId: 'm2', startTime: '16:00', endTime: '17:00' }), lesson('prepared', '2026-10-21', { moduleId: 'm2', summary: 'Apresentação dos conteúdos e objetivos da UFCD 2.', plannedActivity: 'Atividade preparada', notes: 'Preservar esta nota', planificationItemIds: ['item'] }), lesson('later', '2026-12-01', { moduleId: 'm3', summary: 'Sumário futuro já preparado.' })])
  await db.lessonAttendance.put({ ...audit, id: 'absence', academicYearId: 'y', lessonId: 'prior-0', studentId: 'student-1', status: 'absent', code: 'F', note: 'Falta já guardada.' })
  await db.lessonAssessments.put({ ...audit, id: 'assessment', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm1', lessonId: 'prior-0', criterionId: 'criterion', title: 'Avaliação já guardada', activityType: 'practical_work', description: '', absentScore: 0, exemptScore: null })
  await db.assessmentResults.put({ ...audit, id: 'result', assessmentId: 'assessment', studentId: 'student-1', status: 'evaluated', score: 16, note: 'Resultado a preservar' })
  await db.moduleFinalGrades.put({ ...audit, id: 'final', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm1', studentId: 'student-1', calculatedAverage: 16, suggestedGrade: 16, selfAssessmentGrade: 15, finalGrade: 16, confirmedAt: stamp, note: 'Nota final a preservar' })
  await db.planifications.put({ ...audit, id: 'plan', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm2', name: 'Planificação preparada', active: true })
  await db.planificationItems.put({ ...audit, id: 'item', planificationId: 'plan', order: 1, text: 'Apresentação', status: 'planned', usedLessonId: null })
})
after(async () => { db.close(); await rm(temp, { recursive: true, force: true }) })

test('a populated existing account keeps its same-day UFCD boundary and every stored record', async () => {
  const before = await snapshot()
  assert.deepEqual(await confirmed(), [20, 0, 0])
  for (const id of ['last', 'next', 'prepared', 'later', 'prior-0']) await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd(id)
  assert.deepEqual(await snapshot(), before, 'Opening lessons must not undo a valid allocation or rewrite existing account data.')
  db.close()
  await db.open()
  assert.deepEqual(await snapshot(), before, 'The populated account must remain unchanged after reopening.')
  assert.deepEqual(await confirmed(), [20, 0, 0])
})

test('pending and submitted lessons share stable planned numbering; only submission confirms progress', async () => {
  assert.equal((await numbering('last')).lessonNumber, '30')
  assert.equal((await numbering('next')).lessonNumber, '31')
  assert.equal((await numbering('next')).lessonNumberConfirmed, false)
  assert.equal((await numbering('prior-0')).lessonNumberConfirmed, true)
  const before = await snapshot()
  const last = await db.lessons.get('last')
  await db.lessons.update('last', { summary: 'Última aula da UFCD 1.' })
  await api.lessonRepository.markGIAESubmittedExplicit('last', last.updatedAt)
  assert.equal((await numbering('last')).lessonNumber, '30')
  assert.equal((await numbering('last')).lessonNumberConfirmed, true)
  assert.equal((await numbering('next')).lessonNumber, '31')
  assert.deepEqual(await confirmed(), [21, 0, 0], 'Other pending lessons do not become confirmed.')
  const after = await snapshot()
  assert.deepEqual({ ...after, lessons: before.lessons }, before, 'Submitting must not change attendance, grades, planifications or other tables.')
  assert.deepEqual(after.lessons.filter(row => row.id !== 'last'), before.lessons.filter(row => row.id !== 'last'))
})

for (const changes of [{ status: 'cancelled' }, { countTowardProgress: false }]) {
  test(`a blocked/excluded lesson releases its position without changing protected work: ${JSON.stringify(changes)}`, async () => {
    await db.lessons.update('last', changes)
    const before = await snapshot()
    await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd('next')
    await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd('prepared')
    assert.equal((await db.lessons.get('next')).moduleId, 'm1')
    assert.equal((await numbering('last')).lessonNumber, null)
    assert.equal((await numbering('next')).lessonNumber, '30')
    const expected = structuredClone(before)
    expected.lessons.find(row => row.id === 'next').moduleId = 'm1'
    assert.deepEqual(await snapshot(), expected)
  })
}

test('an added earlier lesson advances the boundary, changing only the empty lesson module', async () => {
  await db.lessons.put(lesson('added', '2026-10-19', { startTime: '16:00', endTime: '17:00' }))
  const before = await snapshot()
  await api.ufcdProgressRepository.ensureLessonUsesCurrentUfcd('last')
  const expected = structuredClone(before)
  expected.lessons.find(row => row.id === 'last').moduleId = 'm2'
  assert.deepEqual(await snapshot(), expected)
  assert.deepEqual(await confirmed(), [20, 0, 0])
})

test('multi-period numbering skips blocked/excluded lessons and ignores another assignment', async () => {
  const rows = [lesson('a', '2026-09-01', { periodCount: 2 }), lesson('blocked', '2026-09-02', { status: 'cancelled', periodCount: 10 }), lesson('excluded', '2026-09-03', { countTowardProgress: false, periodCount: 10 }), lesson('other', '2026-09-04', { teachingAssignmentId: 'other', periodCount: 10 })]
  const current = lesson('current', '2026-09-05', { periodCount: 2 })
  assert.equal(api.getLessonNumbering(current, rows).lessonNumber, '3–4')
  assert.equal(api.getLessonNumbering({ ...current, giaeStatus: 'submitted' }, rows).lessonNumberConfirmed, true)
})
