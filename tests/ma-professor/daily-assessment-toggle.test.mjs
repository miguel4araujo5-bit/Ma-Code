import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'
import React, { act } from 'react'

const project = fileURLToPath(new URL('../../', import.meta.url))
await mkdir(join(project, 'node_modules/.cache'), { recursive: true })
const temporary = await mkdtemp(join(project, 'node_modules/.cache/daily-toggle-'))
const dom = new JSDOM('<div id="root"></div>', { url: 'https://daily-toggle.test' })
const originals = new Map()
for (const [key, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  CustomEvent: dom.window.CustomEvent, HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
  fetch: () => { throw new Error('This local evaluation flow must not call the network') }
})) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
}
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
window.scrollTo = () => {}
window.Element.prototype.scrollIntoView = () => {}
const bundle = await build({
  stdin: { contents: `
    export {default as View} from './src/components/ma-professor/daily/DailyWorkspaceView';
    export {maProfessorDb as db} from './src/components/ma-professor/db';
    export {dailyCriteriaGridRepository as grid} from './src/components/ma-professor/daily/dailyCriteriaGridRepository';
    export {assessmentWorkspaceRepository as assessments} from './src/components/ma-professor/assessments/assessmentWorkspaceRepository';
    export {assessmentCriteriaBatchRepository as schemes} from './src/components/ma-professor/assessmentCriteriaBatchRepository';
    export {maProfessorHistory as history} from './src/components/ma-professor/history/sessionHistory';
  `, resolveDir: project, loader: 'ts' },
  jsx: 'automatic', platform: 'node', format: 'cjs', bundle: true, write: false, packages: 'external',
  plugins: [{ name: 'isolated-account', setup(builder) {
    builder.onLoad({ filter: /\/AccessGate\.tsx$/ }, () => ({
      loader: 'js', contents: "export const useMAProfessorAccess=()=>({session:{email:'toggle@example.test'}})"
    }))
  }}]
})
const runtimePath = join(temporary, 'runtime.cjs')
await writeFile(runtimePath, bundle.outputFiles[0].text)
const require = createRequire(import.meta.url)
const { View, db, grid, assessments, schemes, history } = require(runtimePath)
const { createRoot } = require('react-dom/client')
test.after(async () => {
  db.close()
  dom.window.close()
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else delete globalThis[key]
  }
  await rm(temporary, { recursive: true, force: true })
})

test('the real daily button cancels general and ACS grades, persists cancellation and supports undo/redo', async t => {
  await db.open()
  const stamp = { createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }
  await db.academicYears.add({ id: 'year', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-08-31', active: true, setupCompletedAt: stamp.createdAt, ...stamp })
  await db.groups.add({ id: 'group', academicYearId: 'year', name: '10.º D', educationType: 'professional', gradeLevel: '10', courseName: 'TAP', active: true, ...stamp })
  await db.subjects.add({ id: 'subject', academicYearId: 'year', name: 'Expressões', shortName: 'AE', code: 'AE', active: true, ...stamp })
  await db.teachingAssignments.add({ id: 'assignment', academicYearId: 'year', groupId: 'group', subjectId: 'subject', displayName: 'AE · 10.º D', active: true, ...stamp })
  await db.modules.add({ id: 'module', academicYearId: 'year', teachingAssignmentId: 'assignment', code: '10385', name: 'Expressão', plannedPeriods: 50, order: 1, active: true, ...stamp })
  await db.students.bulkAdd([
    { id: 'ana', number: '1', name: 'Ana fictícia' },
    { id: 'bruno', number: '2', name: 'Bruno fictício', assessmentProfilesByAssignment: { assignment: 'acs' } }
  ].map(student => ({ ...student, academicYearId: 'year', groupId: 'group', active: true, notes: '', ...stamp })))
  const general = (await schemes.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'Gerais', criteria: [{ name: 'Conhecimentos', weightPercent: 100 }] }))[0]
  const acs = (await schemes.createSubjectSchemes({ academicYearId: 'year', teachingAssignmentIds: ['assignment'], name: 'ACS', profile: 'acs', criteria: [{ name: 'Interação', weightPercent: 100 }] }))[0]
  await db.assessmentCriteria.update(acs.criteria[0].id, { absenceGrade: 0 })
  const lesson = { id: 'lesson', academicYearId: 'year', teachingAssignmentId: 'assignment', moduleId: 'module', scheduleSlotId: null, origin: 'extra', status: 'taught', date: '2026-09-07', startTime: '09:00', endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: 'Sumário a preservar.', summarySource: 'manual', planificationItemIds: [], giaeStatus: 'submitted', giaeSubmittedAt: stamp.createdAt, notes: 'Nota privada', ...stamp }
  await db.lessons.bulkAdd([lesson, { ...lesson, id: 'other-lesson', date: '2026-09-08' }])
  await db.lessonAttendance.add({ id: 'absence', lessonId: 'lesson', studentId: 'bruno', status: 'absent', code: 'F', note: 'Preservar falta', ...stamp })
  const attendanceBefore = await db.lessonAttendance.toArray()
  let root
  let saves = 0
  const mount = async () => {
    root = createRoot(document.getElementById('root'))
    await act(async () => root.render(React.createElement(React.StrictMode, null,
      React.createElement(View, { academicYearId: 'year', initialDate: lesson.date, initialLessonId: 'lesson', onSaved: () => { saves++ } }))))
    await waitFor(() => button('Avaliação'))
  }
  const unmount = async () => { if (root) { await act(async () => root.unmount()); root = null } }
  t.after(unmount)
  const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.replace(/\s+/g, ' ').trim() === text)
  const inputs = () => [...document.querySelectorAll('[data-daily-quick-grade-input]')]
  const click = node => act(async () => node.click())
  const save = async () => {
    const previous = saves
    await click(button('Guardar aula'))
    await waitFor(() => saves > previous)
  }
  const average = async () => (await assessments.getWorkspace('year', { teachingAssignmentId: 'assignment', moduleId: 'module' })).studentRows.find(row => row.student.id === 'ana').gradeSummary.provisionalAverage
  async function waitFor(predicate) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (predicate()) return
      await act(async () => new Promise(resolve => setTimeout(resolve, 10)))
    }
    throw new Error('Daily UI did not settle: ' + document.body.textContent)
  }

  await mount()
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'false')
  await click(button('Avaliação'))
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'true')
  const first = inputs().find(input => !input.disabled)
  await act(async () => { first.value = '18'; first.dispatchEvent(new window.Event('change', { bubbles: true })) })
  await click(button('Avaliação'))
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'false')
  assert.ok(inputs().every(input => input.disabled && input.value === ''))
  assert.ok(button('Aula guardada'), 'Cancelling the attempt must restore the saved draft state')
  const summary = document.querySelector('textarea[aria-label="Sumário da aula"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(summary, 'Sumário alterado sem avaliação.')
    summary.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  await save()
  assert.equal(await db.lessonAssessments.count(), 0)
  assert.equal(await db.assessmentResults.count(), 0)
  assert.equal(await average(), null)
  assert.equal((await db.lessons.get('lesson')).summary, 'Sumário alterado sem avaliação.')
  assert.equal((await db.lessonAttendance.get('absence')).note, 'Preservar falta')
  await unmount()

  // A saved evaluation must also be removed, including absence grades; other activities stay intact.
  await db.lessons.put(lesson)
  const row = (id, scores, absent = false) => ({ studentId: id, attendanceStatus: absent ? 'absent' : 'present', scores })
  for (const current of [lesson, { ...lesson, id: 'other-lesson', date: '2026-09-08' }]) {
    await grid.saveLessonGrid({ lesson: current, summary: current.summary, activity: '', rows: [row('ana', { [general.criteria[0].id]: current.id === 'lesson' ? '18' : '12' }), row('bruno', {}, true)] })
  }
  await db.lessonAssessments.add({ id: 'manual', academicYearId: 'year', lessonId: 'lesson', teachingAssignmentId: 'assignment', moduleId: 'module', criterionId: general.criteria[0].id, title: 'Outra atividade', activityType: 'practical_work', description: '', ...stamp })
  await db.assessmentResults.add({ id: 'manual-result', assessmentId: 'manual', studentId: 'ana', status: 'evaluated', score: 6, note: 'Preservar', ...stamp })
  const otherBefore = await db.lessonAssessments.where('lessonId').equals('other-lesson').toArray()
  assert.equal(await average(), 12)
  await mount()
  await click(button('Avaliação'))
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'false')
  await act(async () => new Promise(resolve => setTimeout(resolve, 350)))
  await unmount()
  await mount()
  await waitFor(() => document.body.textContent.includes('Rascunho não guardado recuperado'))
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'false', 'Recovered cancellation must not reactivate persisted grades')
  await save()
  assert.deepEqual((await db.lessonAssessments.where('lessonId').equals('lesson').toArray()).map(item => item.id), ['manual'])
  assert.equal(await average(), 9)
  assert.deepEqual(await db.lessonAssessments.where('lessonId').equals('other-lesson').toArray(), otherBefore)
  assert.equal((await db.assessmentResults.get('manual-result')).note, 'Preservar')
  assert.equal((await db.lessons.get('lesson')).giaeStatus, 'submitted')
  assert.equal((await db.lessonAttendance.get('absence')).note, attendanceBefore[0].note)
  await unmount()
  db.close()
  await db.open()
  await mount()
  assert.equal(button('Avaliação').getAttribute('aria-pressed'), 'false')
  assert.equal(await average(), 9)
  await act(async () => { assert.equal(await history.undo(), true) })
  await waitFor(() => button('Avaliação')?.getAttribute('aria-pressed') === 'true')
  assert.equal(await average(), 12)
  await act(async () => { assert.equal(await history.redo(), true) })
  await waitFor(() => button('Avaliação')?.getAttribute('aria-pressed') === 'false')
  assert.equal(await average(), 9)
})
