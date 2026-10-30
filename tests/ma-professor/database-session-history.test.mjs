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
export * from './src/components/ma-professor/calendar/extraLessonRepository'
export { default as ProfessionalAssessmentWorkspaceView } from './src/components/ma-professor/assessments/ProfessionalAssessmentWorkspaceView'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', outfile,
  plugins: [{ name: 'assessment-ui-fixture', setup(builder) {
    builder.onLoad({ filter: /\/access\/AccessGate\.tsx$/ }, () => ({ contents: "export const useMAProfessorAccess=()=>({session:{email:'history@example.test'}})", loader: 'ts' }))
    builder.onLoad({ filter: /\/assessments\/UfcdFinalGradeGrid\.tsx$/ }, () => ({ contents: `import React from 'react'; export default function Grid(p) { return <div>{p.snapshot.studentRows.map(row=><div key={row.student.id}>
      <input data-student={row.student.id} value={p.gradeDrafts[row.student.id].finalGrade} onChange={e=>p.onDraftChange(row.student.id,{finalGrade:e.target.value})}/>
      <button data-save={row.student.id} onClick={()=>p.onSaveStudent(row.student.id,row.student.name)}>Guardar teste</button></div>)}</div> }`, loader: 'tsx' }))
  } }]
})
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

test('final grades undo and redo one student at a time, preserve averages and survive reopening', async () => {
  await repository.saveLesson(draft(), grid())
  history.clear()
  await db.students.put({ ...(await db.students.get('student')), id: 'student-b', number: '2', name: 'Outro aluno fictício' })
  await db.assessmentResults.put({ ...(await db.assessmentResults.toArray())[0], id: 'result-b', studentId: 'student-b', score: 12 })
  const save = (studentId, finalGrade, selfAssessmentGrade = null) => api.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'm', studentId, finalGrade, selfAssessmentGrade, usesAcs: false, note: 'Observação fictícia' })
  await save('student', 15, 14)
  const first = await snapshot()
  await save('student', 18, 16)
  const second = await snapshot()
  await save('student-b', 12, 13)
  const third = await snapshot()
  await history.undo()
  assert.deepEqual(await snapshot(), second)
  await history.undo()
  assert.deepEqual(await snapshot(), first)
  assert.equal((await api.assessmentWorkspaceRepository.getWorkspace('y', { teachingAssignmentId: 'a', moduleId: 'm' })).studentRows.find(row => row.student.id === 'student').gradeSummary.provisionalAverage, 17)
  await history.redo()
  assert.deepEqual(await snapshot(), second)
  await history.redo()
  assert.deepEqual(await snapshot(), third)
  db.close(); await db.open()
  assert.deepEqual(await snapshot(), third)
})

test('invalid or externally changed final grades never create or partially replay a history operation', async () => {
  await repository.saveLesson(draft(), grid())
  history.clear()
  const save = finalGrade => api.assessmentWorkspaceRepository.saveModuleFinalGrade({ moduleId: 'm', studentId: 'student', finalGrade })
  await assert.rejects(save(21))
  assert.equal(history.getState().canUndo, false)
  const record = await save(15)
  await db.moduleFinalGrades.update(record.id, { finalGrade: 19 })
  const before = await snapshot()
  await assert.rejects(history.undo(), /alterados entretanto/)
  assert.deepEqual(await snapshot(), before)
  assert.equal(history.getState().canRedo, false)
})

test('assessment UI reverses individual drafts and committed grades while preserving another pupil draft', async () => {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  dom.window.indexedDB = globalThis.indexedDB
  const globals = ['window', 'document', 'Node', 'HTMLElement', 'Element', 'HTMLInputElement', 'HTMLSelectElement', 'CustomEvent', 'IS_REACT_ACT_ENVIRONMENT']
  const previous = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key))
  for (const key of globals) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[key] })
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  const root = createRoot(document.getElementById('root'))
  let current, saving, refreshing, generation = 0
  const refresh = async () => {
    current = await api.assessmentWorkspaceRepository.getWorkspace('y', { teachingAssignmentId: 'a', moduleId: 'm' })
    current.generatedAt = String(++generation)
    render()
  }
  const render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(api.ProfessionalAssessmentWorkspaceView, {
    snapshot: current, onRefresh: refresh, onFiltersChange: () => {},
    onSaveFinalGrade: input => saving = (async () => { await api.assessmentWorkspaceRepository.saveModuleFinalGrade(input); await refresh() })()
  })))
  const onNavigate = () => { refreshing = refresh() }
  const input = id => document.querySelector('[data-student="' + id + '"]')
  const edit = async (id, value) => React.act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input(id), value)
    input(id).dispatchEvent(new dom.window.Event('input', { bubbles: true }))
  })
  const click = async label => React.act(async () => {
    [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label).click()
    while (history.getState().busy) await new Promise(resolve => setImmediate(resolve))
    if (refreshing) await refreshing
  })
  try {
    await repository.saveLesson(draft(), grid())
    await db.students.put({ ...(await db.students.get('student')), id: 'student-b', number: '2', name: 'Outro aluno fictício' })
    await React.act(refresh)
    window.addEventListener(api.HISTORY_NAVIGATE_EVENT, onNavigate)
    await React.act(async () => history.clear())
    const original = input('student').value
    await edit('student', '18')
    await edit('student-b', '13')
    await click('Desfazer')
    assert.equal(input('student-b').value, '')
    assert.equal(input('student').value, '18')
    await click('Refazer')
    assert.equal(input('student-b').value, '13')
    await React.act(async () => { document.querySelector('[data-save="student"]').click(); await saving })
    assert.equal((await db.moduleFinalGrades.toArray())[0].finalGrade, 18)
    await click('Desfazer')
    assert.equal(input('student').value, original)
    assert.equal(input('student-b').value, '13')
    await click('Refazer')
    assert.equal(input('student').value, '18')
    assert.equal(input('student-b').value, '13')
    assert.equal((await db.moduleFinalGrades.toArray())[0].finalGrade, 18)
  } finally {
    window.removeEventListener(api.HISTORY_NAVIGATE_EVENT, onNavigate)
    await React.act(async () => root.unmount())
    dom.window.close()
    globals.forEach((key, index) => previous[index] ? Object.defineProperty(globalThis, key, previous[index]) : delete globalThis[key])
  }
})


const prepareAnticipationSlot = () => db.weeklyScheduleSlots.put({ ...audit, id: 'slot', academicYearId: 'y', teachingAssignmentId: 'a', weekday: 1, startTime: '09:00', endTime: '09:50', periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', active: true })

test('anticipation undoes and redoes the complete move before an earlier saved lesson', async () => {
  await repository.saveLesson(draft(), grid())
  await prepareAnticipationSlot()
  await db.lessons.put(lesson('future', { scheduleSlotId: 'slot', origin: 'scheduled', date: '2026-11-02' }))
  const before = await snapshot()
  const moved = await api.extraLessonRepository.createExtraLesson({
    academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm',
    date: '2026-10-06', startTime: '10:00', endTime: '10:50', periodCount: 1
  })
  const after = await snapshot()
  assert.equal(moved.id, 'future')
  assert.equal(history.getState().undoLabel, 'Antecipar aula')
  assert.equal(await history.undo(), true)
  assert.deepEqual(await snapshot(), before)
  assert.equal(await history.redo(), true)
  assert.deepEqual(await snapshot(), after)
  await history.undo()
  await history.undo()
  assert.equal((await db.lessons.get('l')).summary, '')
  assert.equal((await db.lessons.get('future')).date, '2026-11-02')
})

test('anticipation reverses UFCD boundary changes atomically and preserves conflict protection', async () => {
  await prepareAnticipationSlot()
  await db.modules.put({ ...(await db.modules.get('m')), id: 'm2', order: 2 })
  await db.lessons.bulkPut([
    lesson('boundary', { scheduleSlotId: 'slot', origin: 'scheduled', date: '2026-10-19' }),
    lesson('future', { scheduleSlotId: 'slot', origin: 'scheduled', moduleId: 'm2', date: '2026-11-02' })
  ])
  const before = await snapshot()
  await api.extraLessonRepository.createExtraLesson({
    academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm',
    date: '2026-10-06', startTime: '10:00', endTime: '10:50', periodCount: 1
  })
  const after = await snapshot()
  assert.equal((await db.lessons.get('boundary')).moduleId, 'm2')
  await history.undo()
  assert.deepEqual(await snapshot(), before)
  await history.redo()
  assert.deepEqual(await snapshot(), after)
  await db.lessons.update('boundary', { notes: 'Alteração posterior noutra janela.' })
  const conflicted = await snapshot()
  await assert.rejects(history.undo(), /alterados entretanto/)
  assert.deepEqual(await snapshot(), conflicted)
  assert.equal(history.getState().canUndo, true)
})


test('failed anticipation leaves the previous undo entry and every table intact', async () => {
  await repository.saveLesson(draft(), grid())
  const before = await snapshot()
  await assert.rejects(api.extraLessonRepository.createExtraLesson({
    academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm',
    date: '2026-10-06', startTime: '10:00', endTime: '10:50', periodCount: 1
  }), /última aula futura/)
  assert.deepEqual(await snapshot(), before)
  assert.equal(history.getState().undoLabel, 'Guardar aula')
  assert.equal(history.getState().busy, false)
})
