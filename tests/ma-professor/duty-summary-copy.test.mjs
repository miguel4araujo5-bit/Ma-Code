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
for (const key of ['window', 'document', 'Element', 'Node', 'HTMLElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Event']) {
  globalThis[key] = key === 'window' ? dom.window : dom.window[key]
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator })
window.indexedDB = globalThis.indexedDB
window.confirm = () => true
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const require = createRequire(import.meta.url)
const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
await mkdir(resolve('node_modules/.tmp'), { recursive: true })
const temp = await mkdtemp(resolve('node_modules/.tmp/duty-copy-'))
const outfile = resolve(temp, 'runtime.mjs')
await build({ stdin: { contents: `
export { default as View } from './src/components/ma-professor/daily/DailyUnifiedWeekOverview'
export * from './src/components/ma-professor/db'
export * from './src/components/ma-professor/calendar/calendarRepository'
export * from './src/components/ma-professor/calendar/dutyEvent'
export * from './src/components/ma-professor/settings/backupRepository'
export * from './src/components/ma-professor/sync/databaseSnapshotService'
`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', packages: 'external', outfile })
const api = await import(pathToFileURL(outfile).href)
const db = api.maProfessorDb
const audit = { createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z' }
const cargo = (id, date, extras = {}) => ({ ...audit, id, academicYearId: 'y', type: 'school_activity', scope: 'all', groupId: null, teachingAssignmentId: null, title: 'Cargo · Coordenação · 09:00–09:50', description: 'Sumário do Cargo.', startDate: date, endDate: date, blocksLessons: false, ...extras })
let root = null
let copied = []
const delay = () => new Promise(resolve => setTimeout(resolve, 10))
const button = text => [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text)
const cargoButton = name => [...document.querySelectorAll('button[title]')].find(node => node.title.startsWith(name + ' ·'))
const iconPaths = node => node.querySelectorAll('svg path').length

async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return
    await act(delay)
  }
  assert.ok(check(), 'The Cargo editor did not reach its expected state.')
}

async function mount() {
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(createElement(api.View, { academicYearId: 'y', date: '2026-10-05', onSelectDate: () => {}, onSelectLesson: () => {} })))
  await until(() => cargoButton('Coordenação'))
}

async function click(node) {
  assert.ok(node)
  await act(async () => node.click())
}

async function edit(text) {
  const textarea = document.querySelector('textarea')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(textarea, text)
    textarea.dispatchEvent(new window.Event('input', { bubbles: true }))
  })
  assert.equal(textarea.value, text)
}

beforeEach(async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-06T12:00:00Z') })
  copied = []
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { copied.push(text) } } })
  window.localStorage.clear()
  await db.open()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.academicYears.put({ ...audit, id: 'y', name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31', active: true })
  await db.schoolCalendarEvents.bulkPut([
    cargo('cargo', '2026-10-05'), cargo('next', '2026-10-06'),
    cargo('empty', '2026-10-05', { title: 'Cargo · Sem sumário · 10:00–10:50', description: '' }),
    cargo('untimed', '2026-10-05', { title: 'Cargo · Sem hora' })
  ])
  await api.ensureDefaultMAProfessorSettings()
})

afterEach(async () => { if (root) { await act(async () => root.unmount()); root = null } })
after(async () => { db.close(); dom.window.close(); await rm(temp, { recursive: true, force: true }) })

test('copying a Cargo marks only that occurrence and keeps the green state after reopening', async () => {
  const other = await db.schoolCalendarEvents.get('next')
  await mount()
  assert.equal(iconPaths(cargoButton('Coordenação')), 1)
  assert.equal(iconPaths(cargoButton('Sem sumário')), 0)
  await click(cargoButton('Coordenação'))
  await click(button('Copiar para o programa oficial'))
  await until(() => document.querySelector('[role="status"]'))
  assert.deepEqual(copied, ['Sumário do Cargo.'])
  assert.equal(api.isDutySummaryCopied(await db.schoolCalendarEvents.get('cargo')), true)
  assert.deepEqual(await db.schoolCalendarEvents.get('next'), other)
  assert.equal(iconPaths(cargoButton('Coordenação')), 2)
  await act(async () => root.unmount())
  root = null
  await mount()
  assert.equal(iconPaths(cargoButton('Coordenação')), 2)
  for (const name of ['lessons', 'lessonAttendance', 'lessonAssessments']) assert.equal(await db[name].count(), 0)
})

test('copying the edited draft saves the exact summary and the copied state together', async () => {
  await mount()
  await click(cargoButton('Coordenação'))
  await edit('Novo sumário do Cargo.')
  await click(button('Copiar para o programa oficial'))
  await until(() => document.querySelector('[role="status"]'))
  assert.deepEqual(copied, ['Novo sumário do Cargo.'])
  const saved = await db.schoolCalendarEvents.get('cargo')
  assert.equal(saved.description, copied[0])
  assert.equal(api.isDutySummaryCopied(saved), true)
})

test('a clipboard failure keeps the saved occurrence unchanged and does not set green', async () => {
  const before = await db.schoolCalendarEvents.toArray()
  navigator.clipboard.writeText = async () => { throw new Error('Cópia recusada') }
  await mount()
  await click(cargoButton('Coordenação'))
  await click(button('Copiar para o programa oficial'))
  await until(() => document.body.textContent.includes('Não foi possível copiar o sumário.'))
  assert.deepEqual(await db.schoolCalendarEvents.toArray(), before)
  assert.equal(iconPaths(cargoButton('Coordenação')), 1)
})

test('an edit in another tab during copying cannot be overwritten or marked copied', async () => {
  navigator.clipboard.writeText = async text => {
    copied.push(text)
    await api.calendarRepository.updateEvent('cargo', { description: 'Alterado noutra aba.' })
  }
  await mount()
  await click(cargoButton('Coordenação'))
  await click(button('Copiar para o programa oficial'))
  await until(() => document.body.textContent.includes('não foi possível guardar o visto'))
  const saved = await db.schoolCalendarEvents.get('cargo')
  assert.equal(saved.description, 'Alterado noutra aba.')
  assert.equal(api.isDutySummaryCopied(saved), false)
})

test('editing a copied Cargo through the calendar removes green without affecting other weeks', async () => {
  const other = await db.schoolCalendarEvents.get('next')
  await api.calendarRepository.updateEvent('cargo', { dutySummaryCopiedAt: new Date().toISOString() })
  await api.calendarRepository.updateEvent('cargo', { description: 'Sumário revisto.' })
  assert.equal(api.isDutySummaryCopied(await db.schoolCalendarEvents.get('cargo')), false)
  assert.deepEqual(await db.schoolCalendarEvents.get('next'), other)
})

test('Cargos without a time also expose the copy flow, while empty summaries cannot be copied', async () => {
  await mount()
  await click(cargoButton('Sem sumário'))
  assert.equal(button('Copiar para o programa oficial').disabled, true)
  await click(document.querySelector('[aria-label="Fechar sumário do Cargo"]'))
  await click(cargoButton('Sem hora'))
  await click(button('Copiar para o programa oficial'))
  await until(() => document.querySelector('[role="status"]'))
  assert.equal(api.isDutySummaryCopied(await db.schoolCalendarEvents.get('untimed')), true)
  assert.equal(iconPaths(cargoButton('Sem hora')), 2)
})

test('local JSON and online snapshots retain the copied state through real restore operations', async () => {
  await api.calendarRepository.updateEvent('cargo', { dutySummaryCopiedAt: new Date().toISOString() })
  const backup = JSON.parse(JSON.stringify(await api.createMAProfessorBackup()))
  assert.equal(api.validateMAProfessorBackup(backup).valid, true)
  const snapshot = JSON.parse(JSON.stringify(await api.createMAProfessorDatabaseSnapshot()))
  await db.schoolCalendarEvents.clear()
  await api.restoreMAProfessorBackup(backup)
  assert.equal(api.isDutySummaryCopied(await db.schoolCalendarEvents.get('cargo')), true)
  await db.schoolCalendarEvents.clear()
  await api.restoreMAProfessorDatabaseSnapshot(snapshot)
  assert.equal(api.isDutySummaryCopied(await db.schoolCalendarEvents.get('cargo')), true)
  assert.equal((await db.schoolCalendarEvents.get('next')).dutySummaryCopiedAt, undefined)
})
