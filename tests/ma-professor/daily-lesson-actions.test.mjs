import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const dom = new JSDOM('<div id="root"></div>', { url: 'https://lesson-actions.test' })
for (const key of ['window', 'document', 'Element', 'Node', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Event']) {
  globalThis[key] = key === 'window' ? dom.window : dom.window[key]
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
window.indexedDB = globalThis.indexedDB
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
const { createElement: h, act, useState } = require('react')
const { createRoot } = require('react-dom/client')
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/lesson-actions-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export { default as Grid } from './src/components/ma-professor/daily/DailyUnifiedWeekOverview'
export * from './src/components/ma-professor/product/useCalendarExtraLesson'
export * from './src/components/ma-professor/calendar/calendarWorkspaceRepository'
export * from './src/components/ma-professor/db'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const stamp = '2026-09-01T08:00:00.000Z'
const audit = { createdAt: stamp, updatedAt: stamp }
const lesson = (id, assignment, date, overrides = {}) => ({ ...audit, id, academicYearId: 'y', teachingAssignmentId: assignment,
  moduleId: assignment, scheduleSlotId: assignment, origin: 'scheduled', status: 'planned', date, startTime: '09:00',
  endTime: '09:50', periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: '', summarySource: 'manual',
  planificationItemIds: [], notes: '', giaeStatus: 'pending', giaeSubmittedAt: null, ...overrides })
let root
const selected = []
function Harness() {
  const [revision, setRevision] = useState(0)
  const actions = api.useCalendarExtraLesson('y', '2026-09-21', 'a', () => setRevision(value => value + 1))
  return h('div', null, actions.dialog, h(api.Grid, { academicYearId: 'y', date: '2026-09-21', refreshToken: revision,
    onSelectDate() {}, onSelectLesson: (...args) => selected.push(args), onCreateLesson: actions.createLesson, onMoveLesson: actions.openMoveLesson }))
}
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const cell = date => document.querySelector(`[data-lesson-cell="${date}T09:00"]`)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(check) {
  for (let i = 0; i < 150 && !check(); i++) await act(() => delay(10))
  assert.ok(check(), 'The real lesson-action UI did not reach its expected state.')
}
async function click(node) { assert.ok(node); await act(async () => node.click()) }
async function context(node) { await act(async () => node.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }))) }
async function pointer(node, type, x = 0) {
  const event = new window.Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { pointerType: 'touch', clientX: x, clientY: 0 })
  await act(async () => node.dispatchEvent(event))
}
async function mount() {
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(h(Harness)))
  await until(() => cell('2026-09-23'))
}
async function chooseDestination(date = '2026-09-22') {
  await context(cell('2026-09-21').querySelector('[data-lesson-id]'))
  await click(button('Mover ou permutar'))
  await click(cell(date))
  await until(() => document.getElementById('lesson-editor-title')?.textContent === (date === '2026-09-22' ? 'Deseja permutar?' : 'Mover esta aula?'))
}
beforeEach(async () => {
  selected.length = 0
  window.confirm = () => true
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.groups.put({ ...audit, id: 'g', academicYearId: 'y', name: '10 D', courseName: 'TAP', gradeLevel: '10', educationType: 'professional', active: true })
  for (const [id, weekday] of [['a', 1], ['b', 2]]) {
    await db.subjects.put({ ...audit, id, academicYearId: 'y', name: id === 'a' ? 'Expressões' : 'Animação', shortName: id.toUpperCase(), active: true })
    await db.teachingAssignments.put({ ...audit, id, academicYearId: 'y', groupId: 'g', subjectId: id, displayName: id, active: true })
    await db.modules.put({ ...audit, id, academicYearId: 'y', teachingAssignmentId: id, code: id, name: id, order: 1, plannedPeriods: 4, plannedStartDate: null, plannedEndDate: null, active: true })
    await db.weeklyScheduleSlots.put({ ...audit, id, academicYearId: 'y', teachingAssignmentId: id, weekday, startTime: '09:00', endTime: '09:50', periodCount: 1, validFrom: '2026-09-21', validUntil: '2026-10-13', active: true })
  }
  await db.lessons.bulkPut([
    ...['2026-09-21', '2026-09-28', '2026-10-05', '2026-10-12'].map((date, i) => lesson(`a${i}`, 'a', date)),
    ...['2026-09-22', '2026-09-29', '2026-10-06', '2026-10-13'].map((date, i) => lesson(`b${i}`, 'b', date))
  ])
})
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null } })
after(async () => { db.close(); dom.window.close(); await rm(temp, { recursive: true, force: true }) })

test('a blank daily cell anticipates the last occurrence into its exact date and time without creating an extra period', async () => {
  await mount()
  await click(cell('2026-09-23').querySelector('button'))
  await click(button('Antecipar aula'))
  await until(() => button('Criar antecipação') && !button('Criar antecipação').disabled)
  assert.equal(document.querySelector('input[type="date"][required]').value, '2026-09-23')
  const times = [...document.querySelectorAll('input[type="time"]')].map(node => node.value)
  assert.deepEqual(times, ['09:00', '09:50'])
  const before = await db.lessons.count()
  await click(button('Criar antecipação'))
  await until(() => !document.getElementById('extra-lesson-title'))
  const moved = await db.lessons.get('a3')
  assert.equal(moved.date, '2026-09-23')
  assert.deepEqual(moved.scheduleOriginalPosition, { date: '2026-10-12', startTime: '09:00' })
  assert.equal(await db.lessons.count(), before)
  await api.calendarWorkspaceRepository.getWorkspace('y', 'week', '2026-10-12')
  assert.equal((await db.lessons.toArray()).filter(row => row.teachingAssignmentId === 'a' && row.date === '2026-10-12').length, 0)
})

test('right-click, origin then destination, swaps only once after explicit confirmation', async () => {
  await mount()
  await chooseDestination()
  assert.equal((await db.lessons.get('a0')).date, '2026-09-21')
  await click(button('Só desta vez'))
  await until(() => !document.getElementById('lesson-editor-title'))
  assert.equal((await db.lessons.get('a0')).date, '2026-09-22')
  assert.equal((await db.lessons.get('b0')).date, '2026-09-21')
  assert.equal((await db.lessons.get('a1')).date, '2026-09-28')
  assert.equal(selected.length, 0)
})

test('the same direct grid swap can apply through the remaining timetable', async () => {
  await mount()
  await chooseDestination()
  await click(button('Daqui até ao final do ano'))
  await until(() => !document.getElementById('lesson-editor-title'))
  assert.equal((await db.lessons.get('a1')).date, '2026-09-29')
  assert.equal((await db.lessons.get('b1')).date, '2026-09-28')
  assert.equal((await db.lessons.get('a3')).date, '2026-10-13')
  assert.equal((await db.lessons.get('b3')).date, '2026-10-12')
})

test('moving into an empty cell leaves the source free and cancellation changes no lessons', async () => {
  await mount()
  await chooseDestination('2026-09-23')
  const before = await db.lessons.toArray()
  window.confirm = () => { throw new Error('A move preview has no edited fields to discard.') }
  await click(button('Cancelar'))
  assert.deepEqual(await db.lessons.toArray(), before)
  window.confirm = () => true
  await chooseDestination('2026-09-23')
  await click(button('Só desta vez'))
  await until(() => !document.getElementById('lesson-editor-title'))
  assert.equal((await db.lessons.get('a0')).date, '2026-09-23')
  assert.equal((await db.lessons.toArray()).filter(row => row.date === '2026-09-21').length, 0)
})

test('touch long press opens the menu, suppresses the tap, and scrolling cancels the gesture', async () => {
  await mount()
  const source = cell('2026-09-21').querySelector('[data-lesson-id]')
  // Some touch browsers emit contextmenu before the custom hold timer.
  await pointer(source, 'pointerdown')
  await context(source)
  await pointer(source, 'pointerup')
  await click(source)
  assert.equal(selected.length, 0)
  await click(button('Cancelar'))
  await act(() => delay(850))
  await pointer(source, 'pointerdown')
  await act(() => delay(600))
  assert.ok(button('Mover ou permutar'))
  await pointer(source, 'pointerup')
  await click(source)
  assert.equal(selected.length, 0)
  await click(button('Cancelar'))
  await pointer(source, 'pointerdown')
  await pointer(source, 'pointermove', 30)
  await act(() => delay(600))
  assert.equal(document.getElementById('lesson-cell-menu-title'), null)
})

test('the last UFCD being worked on is suggested, and the selectable counters follow the selected unit', async () => {
  await db.modules.update('a', { plannedPeriods: 30 })
  await db.modules.put({ ...await db.modules.get('a'), id: 'a-next', code: 'Seguinte', order: 2, plannedPeriods: 40 })
  await db.lessons.bulkPut(Array.from({ length: 29 }, (_, i) => lesson(`count${i}`, 'a', '2026-09-01', { startTime: '08:00', endTime: '08:50', status: 'taught', giaeStatus: 'submitted', giaeSubmittedAt: stamp, summary: 'Registo anterior' })))
  await db.lessons.put(lesson('last-worked', 'a', '2026-09-20', { moduleId: 'a-next', status: 'taught', giaeStatus: 'submitted', giaeSubmittedAt: stamp, summary: 'UFCD em curso' }))
  await mount()
  await click(cell('2026-09-23').querySelector('button'))
  await click(button('Antecipar aula'))
  await until(() => button('Criar antecipação') && !button('Criar antecipação').disabled)
  const select = document.querySelector('select[value]') ?? [...document.querySelectorAll('select')].find(node => [...node.options].some(option => option.value === 'a-next'))
  assert.equal(select.value, 'a-next')
  assert.match(select.textContent, /29 de 30 tempos — falta 1/)
  await act(async () => { select.value = 'a'; select.dispatchEvent(new window.Event('change', { bubbles: true })) })
  assert.match(document.querySelector('#extra-lesson-title').closest('section').textContent, /29 de 30 tempos — falta 1/)
  assert.equal(select.value, 'a')
})
