import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import 'fake-indexeddb/auto'

globalThis.window = { indexedDB: globalThis.indexedDB }
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/session-history-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/history/sessionHistory'
export * from './src/components/ma-professor/history/databaseHistory'
export * from './src/components/ma-professor/daily/dailyWorkspaceRepository'
export * from './src/components/ma-professor/assessments/assessmentWorkspaceRepository'
export * from './src/components/ma-professor/lessons/lessonRepository'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const history = api.maProfessorHistory
const repository = api.dailyWorkspaceRepository
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const lesson = (id = 'l', extra = {}) => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm', scheduleSlotId: null, origin: 'extra', date: '2026-10-05', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, status: 'planned', summary: '', plannedActivity: '', summarySource: 'manual', planificationItemIds: [], notes: '', giaeStatus: 'pending', giaeSubmittedAt: null, ...extra })
const row = (extra = {}) => ({ studentId: 'student', attendanceStatus: 'present', attendanceCode: '', attendanceNote: '', assessmentStatus: 'not_evaluated', assessmentScore: null, assessmentNote: '', ...extra })
const draft = (extra = {}) => ({ lessonId: 'l', status: 'taught', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, summary: 'Sumário fictício.', plannedActivity: 'Atividade prevista.', summarySource: 'manual', planificationItemIds: [], notes: 'Nota privada fictícia.', giaeStatus: 'submitted', assessment: { mode: 'none', assessmentId: null, criterionId: '', title: '', activityType: 'other', description: '' }, students: [row()], ...extra })
const grid = (score = '17') => ({ summary: 'Sumário fictício.', activity: 'Avaliação fictícia.', rows: [{ studentId: 'student', attendanceStatus: 'present', expectedAssessmentResetAt: '', scores: { criterion: score } }] })
const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, (await table.toArray()).sort((a,b) => a.id.localeCompare(b.id))])))

beforeEach(async () => {
  await db.open()
  history.clear()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.settings.put(api.createDefaultMAProfessorSettings(stamp))
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: '10.º D', courseName: 'TAP', gradeLevel: '10', educationType: 'professional', active: true })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Expressões', shortName: 'AE', active: true })
  await db.teachingAssignments.put({ ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', displayName: 'AE', active: true })
  await db.modules.put({ ...audit, id: 'm', academicYearId: 'y', teachingAssignmentId: 'a', code: 'UC00033', name: 'Comunicar', order: 1, plannedPeriods: 30, plannedStartDate: null, plannedEndDate: null, active: true })
  await db.students.put({ ...audit, id: 'student', academicYearId: 'y', groupId: 'g', number: '1', name: 'Aluno fictício', active: true, notes: '', membershipPeriods: [{startDate:'2026-09-01',endDate:null}] })
  await db.assessmentSchemes.put({ ...audit, id: 'scheme', academicYearId: 'y', teachingAssignmentId: 'a', moduleId: null, scope: 'subject', name: 'Critérios', active: true })
  await db.assessmentCriteria.put({ ...audit, id: 'criterion', schemeId: 'scheme', name: 'Desempenho', weightPercent: 100, order: 1, active: true })
  await db.lessons.put(lesson())
  await repository.getLessonWorkspace('y', 'l')
})
after(async () => { db.close(); await rm(temp, { recursive: true, force: true }) })

test('Guardar aula reverts summary, private note, planning, GIAE, attendance and all criteria scores together', async () => {
  const before = await snapshot()
  await repository.saveLesson(draft(), grid())
  const after = await snapshot()
  assert.equal(after.lessons[0].giaeStatus, 'submitted')
  assert.equal(after.lessonAttendance.length, 1)
  assert.equal(after.assessmentResults[0].score, 17)
  assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y', {teachingAssignmentId:'a',moduleId:'m'})).studentRows[0].gradeSummary.provisionalAverage, 17)
  assert.equal(history.getState().canUndo, true)
  assert.equal(await history.undo(), true)
  assert.deepEqual(await snapshot(), before)
  assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y', {teachingAssignmentId:'a',moduleId:'m'})).studentRows[0].gradeSummary.provisionalAverage, null)
  assert.equal(await history.redo(), true)
  assert.deepEqual(await snapshot(), after)
  db.close(); await db.open()
  assert.equal((await db.assessmentResults.toArray())[0].score, 17)
})

test('a failed criteria grid rolls back summary and attendance, leaving no history operation', async () => {
  const before = await snapshot()
  await assert.rejects(repository.saveLesson(draft(), grid('invalid')))
  assert.deepEqual(await snapshot(), before)
  assert.equal(history.getState().canUndo, false)
  await repository.getLessonWorkspace('y','l')
  await repository.saveLesson(draft(), grid())
  assert.equal(history.getState().canUndo,true)
})

test('a score changed in another tab aborts the whole reversal even when updatedAt is unchanged', async () => {
  await repository.saveLesson(draft(), grid())
  const result = (await db.assessmentResults.toArray())[0]
  await db.assessmentResults.update(result.id, { score: 19 })
  const before = await snapshot()
  await assert.rejects(history.undo(), /alterados entretanto/)
  assert.deepEqual(await snapshot(), before)
  assert.equal(history.getState().canUndo,true)
  assert.equal(history.getState().canRedo,false)
})

test('a new related score cannot be orphaned by undoing creation of its assessment', async () => {
  await repository.saveLesson(draft(), grid())
  const assessment = (await db.lessonAssessments.toArray())[0]
  await db.assessmentResults.put({ ...audit, id: 'external-result', assessmentId: assessment.id, studentId: 'external-student', status: 'evaluated', score: 15, note: '' })
  const before = await snapshot()
  await assert.rejects(history.undo(), /novos registos relacionados/)
  assert.deepEqual(await snapshot(), before)
})

test('student ACS changes invalidate a reversal without changing school records', async () => {
  await repository.saveLesson(draft(), grid())
  await db.students.update('student', { assessmentResetAtByModule: {m:'2026-10-13T12:00:00.000Z'} })
  const before = await snapshot()
  await assert.rejects(history.undo(), /contexto.*alterado/)
  assert.deepEqual(await snapshot(), before)
})

test('unrelated records and background writes are preserved and do not become history entries', async () => {
  await repository.saveLesson(draft(), grid())
  await db.lessons.put(lesson('other',{date:'2026-10-06',summary:'Outra aula.'}))
  const other = await db.lessons.get('other')
  await history.undo()
  assert.deepEqual(await db.lessons.get('other'), other)
  assert.equal(history.getState().canUndo,false)
  await history.redo()
  assert.deepEqual(await db.lessons.get('other'), other)
})

test('nested changes are one operation and a new edit after undo discards redo', async () => {
  const location = { workspace:'daily', academicYearId:'y', lessonId:'l', date:'2026-10-05' }
  await api.runWithDatabaseHistory('Conjunto',location,async () => {
    await db.lessons.update('l',{notes:'Primeira nota'})
    await api.runWithDatabaseHistory('Interior',location,async () => {
      await db.lessons.update('l',{summary:'Sumário'})
    })
  })
  await history.undo()
  assert.equal(history.getState().canUndo,false)
  await api.runWithDatabaseHistory('Outra',location,async () => { await db.lessons.update('l',{notes:'Outra nota'}) })
  assert.equal(history.getState().canRedo,false)
})

test('failure after a real delete restores its data and does not record rolled back changes', async () => {
  const before = await snapshot()
  await assert.rejects(api.runWithDatabaseHistory('Falha',{workspace:'daily'},async () => {
    await db.lessons.delete('l')
    throw Error('Falha de escrita')
  }),/Falha de escrita/)
  assert.deepEqual(await snapshot(),before)
  assert.equal(history.getState().canUndo,false)
})


test('changing account or academic year during a save does not move that save into the next history', async () => {
  history.setScope('account-a:y')
  await api.runWithDatabaseHistory('Guardar aula',{workspace:'daily',lessonId:'l'},async()=>{
    await db.lessons.update('l',{notes:'Nota guardada.'})
    history.setScope('account-b:y')
  })
  assert.equal((await db.lessons.get('l')).notes,'Nota guardada.')
  assert.equal(history.getState().canUndo,false)
})
