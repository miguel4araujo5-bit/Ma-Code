import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const dom = new JSDOM('<div id="root"></div>', { url: 'https://lesson.test' })
for (const key of ['window', 'document', 'Element', 'Node', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Event']) {
  globalThis[key] = key === 'window' ? dom.window : dom.window[key]
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
window.indexedDB = globalThis.indexedDB
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/blocked-links-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export { default as Editor } from './src/components/ma-professor/calendar/LessonEditorDialog'
export * from './src/components/ma-professor/calendar/calendarWorkspaceRepository'
export * from './src/components/ma-professor/lessons/lessonRepository'
export * from './src/components/ma-professor/db'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const lesson = (id, date, submitted = false) => ({
  ...audit, id, date, academicYearId: 'y', teachingAssignmentId: 'a', moduleId: 'm', scheduleSlotId: 'slot',
  origin: 'scheduled', status: submitted ? 'taught' : 'planned', startTime: '09:00', endTime: '09:50', periodCount: 1,
  countTowardProgress: true, plannedActivity: '', summary: submitted ? 'Sumário preservado' : '', summarySource: 'manual',
  planificationItemIds: [], notes: '', giaeStatus: submitted ? 'submitted' : 'pending', giaeSubmittedAt: submitted ? stamp : null
})
let root
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const links = () => [...document.querySelectorAll('[role="alert"] button')].filter(node => node.textContent.startsWith('Abrir aula de'))
const delay = () => new Promise(resolve => setTimeout(resolve, 10))
async function until(check) {
  for (let i = 0; i < 100 && !check(); i++) await act(delay)
  assert.ok(check(), 'The lesson editor did not reach its expected state.')
}
async function click(node) {
  assert.ok(node)
  await act(async () => node.click())
}
async function changeDate(value) {
  const input = document.querySelector('input[type="date"]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  assert.equal(input.value, value)
}
async function mount(id, onOpenLesson) {
  const context = await api.calendarWorkspaceRepository.getLessonEditorContext(id)
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(createElement(api.Editor, { context, onClose() {}, onSaved() {}, onOpenLesson })))
  await until(() => button('Guardar aula completa'))
}
beforeEach(async () => {
  window.confirm = () => true
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: '10 D', courseName: 'TAP', gradeLevel: '10', educationType: 'professional', active: true })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Expressões', shortName: 'AE', active: true })
  await db.teachingAssignments.put({ ...audit, id: 'a', academicYearId: 'y', groupId: 'g', subjectId: 's', displayName: 'AE', active: true })
  await db.modules.put({ ...audit, id: 'm', academicYearId: 'y', teachingAssignmentId: 'a', code: '1', name: 'Expressões', order: 1, plannedPeriods: 30, plannedStartDate: null, plannedEndDate: null, active: true })
  await db.weeklyScheduleSlots.put({ ...audit, id: 'slot', academicYearId: 'y', teachingAssignmentId: 'a', weekday: 1, startTime: '09:00', endTime: '09:50', periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', active: true })
  await db.lessons.bulkPut([lesson('current', '2026-09-14'), lesson('blocked', '2026-09-21', true)])
})
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null } })
after(async () => { db.close(); dom.window.close(); await rm(temp, { recursive: true, force: true }) })

test('blocked schedule notice opens the exact lesson and respects cancellation of unsaved changes', async () => {
  const opened = []
  const confirmations = []
  await mount('current', id => opened.push(id))
  await changeDate('2026-09-15')
  await click(document.querySelector('input[name="lesson-move-scope"][value="from_here"]'))
  const before = await db.lessons.toArray()
  await click(button('Guardar aula completa'))
  await until(() => links().length === 1)
  assert.match(links()[0].textContent, /21.*setembro.*2026.*09:00–09:50/)
  assert.deepEqual(await db.lessons.toArray(), before)
  assert.equal(await db.weeklyScheduleSlots.count(), 1)
  window.confirm = message => { confirmations.push(message); return false }
  await click(links()[0])
  assert.deepEqual(opened, [])
  assert.match(confirmations[0], /alterações por guardar/)
  assert.equal(document.querySelector('input[type="date"]').value, '2026-09-15')
  window.confirm = () => true
  await click(links()[0])
  assert.deepEqual(opened, ['blocked'])
  assert.deepEqual(await db.lessons.toArray(), before)
})

test('moving a submitted source links to that source without clearing its GIAE tick', async () => {
  const opened = []
  await mount('blocked', id => opened.push(id))
  const before = await db.lessons.get('blocked')
  await changeDate('2026-09-22')
  await click(button('Guardar aula completa'))
  await until(() => links().length === 1)
  await click(links()[0])
  assert.deepEqual(opened, ['blocked'])
  assert.deepEqual(await db.lessons.get('blocked'), before)
})

test('the whole schedule lists every submitted lesson even when the selected source is submitted', async () => {
  await db.lessons.put(lesson('current', '2026-09-14', true))
  await mount('current', () => {})
  await changeDate('2026-09-15')
  await click(document.querySelector('input[name="lesson-move-scope"][value="whole_schedule"]'))
  await click(button('Guardar aula completa'))
  await until(() => links().length === 2)
  assert.match(links()[0].textContent, /14.*setembro/)
  assert.match(links()[1].textContent, /21.*setembro/)
})
