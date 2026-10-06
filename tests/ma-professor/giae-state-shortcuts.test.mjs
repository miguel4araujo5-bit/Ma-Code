import assert from 'node:assert/strict'
import { after, afterEach, beforeEach, test } from 'node:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' })
for (const key of ['window', 'document', 'Element', 'Node', 'HTMLElement', 'Event', 'CustomEvent']) {
  globalThis[key] = key === 'window' ? dom.window : dom.window[key]
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
window.indexedDB = globalThis.indexedDB
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const require = createRequire(import.meta.url)
const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/giae-shortcuts-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export { default as View } from './src/components/ma-professor/giae/GIAEWorkspaceView'
export * from './src/components/ma-professor/giae/giaeWorkspaceRepository'
export * from './src/components/ma-professor/db'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const audit = { createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }
const empty = { query: '', dateFrom: null, dateTo: null, groupId: null, teachingAssignmentId: null, moduleId: null, state: null }
const restricted = { query: 'sem correspondência', dateFrom: '2026-09-01', dateTo: '2026-09-02', groupId: 'g1', teachingAssignmentId: 'a1', moduleId: 'm1', state: 'submitted' }
const shortcuts = [['Sem sumário', 'missing_summary', 'missingSummary'], ['Por submeter', 'pending', 'pending'], ['Submetidos', 'submitted', 'submitted'], ['Total', null, 'total']]
let root, props, requests, opened, scrolled
HTMLElement.prototype.scrollIntoView = function () { scrolled.push(this) }
const card = label => [...document.querySelectorAll('button[aria-controls]')].find(node => node.firstElementChild.textContent === label)
const heading = () => document.querySelector('h2[tabindex="-1"]')
const workspace = filters => api.giaeWorkspaceRepository.getWorkspace('y', filters, '2026-10-06')
async function render(changes = {}) {
  props = { ...props, ...changes }
  await act(async () => root.render(createElement(api.View, props)))
}
async function click(node) { assert.ok(node); await act(async () => node.click()) }
async function mount(filters = restricted, overrides = {}) {
  root = createRoot(document.getElementById('root'))
  props = { snapshot: await workspace(filters), onFiltersChange: filters => requests.push(filters), onLessonSelect: id => opened.push(id), ...overrides }
  await render()
}
async function finishNavigation() {
  const filters = requests.at(-1)
  // Reproduce MAProfessorApp: filters change first, old rows remain until the read completes.
  await render({ snapshot: { ...props.snapshot, filters } })
  assert.equal(scrolled.length, 0, 'must not jump to stale results')
  await render({ loading: true })
  assert.ok(shortcuts.every(([label]) => card(label).disabled))
  await render({ snapshot: await workspace(filters), loading: false })
}

beforeEach(async () => {
  requests = []; opened = []; scrolled = []
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true, setupCompletedAt: null })
  await db.subjects.put({ ...audit, id: 's', academicYearId: 'y', name: 'Disciplina fictícia', shortName: 'DF', code: '', active: true })
  for (const n of [1, 2]) {
    await db.groups.put({ ...audit, id: `g${n}`, academicYearId: 'y', name: `Turma ${n}`, courseName: 'Curso fictício', gradeLevel: '10', active: true })
    await db.teachingAssignments.put({ ...audit, id: `a${n}`, academicYearId: 'y', groupId: `g${n}`, subjectId: 's', displayName: `Turma ${n} · DF`, active: true })
    await db.modules.put({ ...audit, id: `m${n}`, academicYearId: 'y', teachingAssignmentId: `a${n}`, code: `00${n}`, name: `Módulo ${n}`, plannedPeriods: 20, order: 1, plannedStartDate: null, plannedEndDate: null, active: true })
    for (const [state, hour] of [['missing_summary', '09'], ['pending', '10'], ['submitted', '11']]) {
      await db.lessons.put({ ...audit, id: `${state}-${n}`, academicYearId: 'y', teachingAssignmentId: `a${n}`, moduleId: `m${n}`, scheduleSlotId: null, origin: 'extra', status: 'taught', date: '2026-10-05', startTime: `${hour}:00`, endTime: `${hour}:50`, periodCount: 1, countTowardProgress: true, plannedActivity: '', summary: state === 'missing_summary' ? '' : `Sumário ${state} ${n}`, summarySource: 'manual', planificationItemIds: [], giaeStatus: state === 'submitted' ? 'submitted' : 'pending', giaeSubmittedAt: state === 'submitted' ? audit.updatedAt : null, notes: '' })
    }
  }
})
afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null } })
after(async () => { db.close(); dom.window.close(); await rm(temp, { recursive: true, force: true }) })

for (const [label, state, totalKey] of shortcuts) {
  test(`${label} clears every earlier filter, matches its global count and focuses the new results`, async () => {
    const before = await db.lessons.toArray()
    await mount()
    assert.equal(props.snapshot.rows.length, 0)
    assert.equal(scrolled.length, 0)
    await click(card(label))
    assert.deepEqual(requests, [{ ...empty, state }])
    await finishNavigation()
    assert.equal(props.snapshot.rows.length, props.snapshot.totals[totalKey])
    assert.equal(props.snapshot.rows.length, state === null ? 6 : 2)
    assert.equal(scrolled.length, 1)
    assert.equal(scrolled[0], heading())
    assert.equal(document.activeElement, heading())
    assert.equal(document.getElementById(card(label).getAttribute('aria-controls')).contains(heading()), true)
    for (const [other] of shortcuts) assert.equal(card(other).getAttribute('aria-pressed'), String(other === label))
    const editor = [...document.querySelectorAll('button')].find(node => ['Preencher', 'Editar'].includes(node.textContent.trim()))
    await click(editor)
    assert.deepEqual(opened, [props.snapshot.rows[0].lesson.id])
    assert.deepEqual(await db.lessons.toArray(), before, 'navigation must not write or submit lessons')
  })
}

test('an already selected shortcut focuses the list without another read; loading blocks navigation', async () => {
  await mount(empty)
  await render({ loading: true })
  for (const [label] of shortcuts) await click(card(label))
  assert.equal(requests.length, 0)
  assert.equal(scrolled.length, 0)
  await render({ loading: false })
  await click(card('Total'))
  assert.equal(requests.length, 0)
  assert.equal(document.activeElement, heading())
  assert.equal(scrolled.length, 1)
})

test('a zero-count shortcut opens the empty result list and remains selected', async () => {
  await db.lessons.bulkDelete(['submitted-1', 'submitted-2'])
  await mount()
  await click(card('Submetidos'))
  await finishNavigation()
  assert.equal(props.snapshot.rows.length, 0)
  assert.equal(card('Submetidos').getAttribute('aria-pressed'), 'true')
  assert.equal(heading().textContent.trim(), '0 aulas encontradas')
  assert.ok(document.body.textContent.includes('Nenhum registo encontrado'))
  assert.equal(document.activeElement, heading())
})

test('a failed filter read does not jump to stale rows or steal focus on a later refresh', async () => {
  await mount()
  await click(card('Por submeter'))
  await render({ snapshot: { ...props.snapshot, filters: requests[0] }, loading: true })
  await render({ loading: false, error: 'Falha simulada' })
  assert.equal(scrolled.length, 0)
  await render({ snapshot: await workspace(requests[0]), error: '' })
  assert.equal(scrolled.length, 0)
  assert.notEqual(document.activeElement, heading())
})
