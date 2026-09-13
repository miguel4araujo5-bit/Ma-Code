import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'schedule-recovery-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)
const base = 'src/components/ma-professor/'
const extractorPath = 'src/lib/maPdf/extractPdfText.ts'
const compiled = new Set([extractorPath])
const javascript = source => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
} }).outputText

function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)
  const code = javascript(readFileSync(join(root, relative), 'utf8'))
  const target = join(output, relative.replace(/\.tsx?$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)
  for (const match of code.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const dependency = resolve(dirname(join(root, relative)), match[1])
    compile((existsSync(dependency + '.ts') ? dependency + '.ts' : dependency + '.tsx').slice(root.length + 1))
  }
}

compile(base + 'setup/SchedulePdfImportStep.tsx')
const extractorTarget = join(output, extractorPath.replace('.ts', '.js'))
mkdirSync(dirname(extractorTarget), { recursive: true })
writeFileSync(extractorTarget, '')
const fixture = JSON.parse(readFileSync(join(root, 'tests/ma-professor/fixtures/schedule-text-items-2026.json'), 'utf8'))
const extractorExports = {}
// Replay the existing real PDF.js text-position fixture through the unchanged
// production extractor and parser. Only PDF transport/worker setup is stubbed.
Function('require', 'exports', javascript(readFileSync(join(root, extractorPath), 'utf8')))(request => {
  if (request.includes('pdf.worker')) return { default: 'test-worker.mjs' }
  if (request === './pdfPasswordError') return { normalizePdfPasswordError: error => error }
  if (request === 'pdfjs-dist') return {
    GlobalWorkerOptions: {},
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 1, getPage: async () => ({
        streamTextContent: () => new ReadableStream({ start(controller) { controller.enqueue({ items: fixture }); controller.close() } }),
        cleanup() {}
      }) }),
      destroy: async () => {}
    })
  }
  throw new Error(`Unexpected dependency: ${request}`)
}, extractorExports)
require.cache[extractorTarget] = { id: extractorTarget, filename: extractorTarget, loaded: true, exports: extractorExports }

const dom = new JSDOM('', { url: 'https://schedule.test' })
const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
globalThis.window = dom.window
for (const name of ['document', 'Node', 'Element', 'HTMLElement', 'HTMLSelectElement', 'CustomEvent']) globalThis[name] = window[name]
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
const Panel = require(join(output, base, 'setup/SchedulePdfImportStep.js')).default
const { maProfessorDb: db } = require(join(output, base, 'db.js'))
const { maProfessorRepository: repository } = require(join(output, base, 'repository.js'))
const audit = { active: true, academicYearId: 'year', createdAt: '2026-09-01', updatedAt: '2026-09-01' }

async function seed(legacy = true) {
  await db.delete()
  await db.open()
  await db.academicYears.add({ id: 'year', name: '2026/27', startDate: '2026-09-01', endDate: '2027-07-31', setupCompletedAt: null, ...audit })
  await repository.saveTeacherProfile({ displayName: 'Professor', schoolName: 'EBS S. Bento' })
  if (legacy) {
    await db.groups.add({ id: 'group', name: '11.º E', gradeLevel: '11.º ano', courseName: 'Técnico de Apoio Psicossocial', ...audit })
    await db.subjects.add({ id: 'subject', name: 'AS REO', shortName: 'AS REO', code: '', ...audit })
    await db.teachingAssignments.add({ id: 'assignment', groupId: 'group', subjectId: 'subject', displayName: 'AS REO · 11.º E', ...audit })
    await db.weeklyScheduleSlots.add({ id: 'slot', teachingAssignmentId: 'assignment', weekday: 2, startTime: '09:25', endTime: '10:15', periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', ...audit })
    await db.modules.add({ id: 'module', teachingAssignmentId: 'assignment', code: '0349', name: 'Módulo guardado', plannedPeriods: 20, order: 1, ...audit })
    await db.planifications.add({ id: 'plan', moduleId: 'module', teachingAssignmentId: 'assignment', title: 'Planificação guardada', ...audit })
    await db.assessmentSchemes.add({ id: 'scheme', teachingAssignmentId: 'assignment', moduleId: null, scope: 'subject', name: 'Critérios guardados', ...audit })
    await db.lessons.add({ id: 'lesson', teachingAssignmentId: 'assignment', summary: 'Sumário guardado', ...audit })
  }
  await repository.getSettings()
  return repository.getSetupSnapshot('year')
}
const stored = async () => Object.fromEntries(await Promise.all(db.tables.map(async table => [table.name, await table.toArray()])))

async function mount(snapshot, imported = () => {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const view = createRoot(host)
  let confirmations = 0
  let acceptDiscard = true
  let skipped = 0
  let returned
  window.confirm = () => { confirmations++; return acceptDiscard }
  // Like detailed setup, callbacks deliberately leave the panel mounted.
  await act(async () => view.render(createElement(Panel, { snapshot,
    onImported: async next => { await imported(next); returned = next },
    onContinueWithoutPdf: () => { skipped++ }
  })))
  const button = name => [...host.querySelectorAll('button')].find(item => item.textContent.trim() === name)
  const click = async item => { assert.ok(item, host.textContent); await act(async () => item.click()) }
  async function settle(predicate) {
    for (let i = 0; i < 300 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.ok(predicate(), host.textContent)
  }
  async function read() {
    const input = host.querySelector('input[type=file]')
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture'], 'horario.pdf', { type: 'application/pdf' })] })
    await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })))
    await settle(() => Boolean(button('Confirmar 25 blocos')) && !button('Confirmar 25 blocos').disabled)
  }
  async function conflict() {
    await read()
    await click(button('Confirmar 25 blocos'))
    await settle(() => host.textContent.includes('sobrepõe-se a AS REO · 11.º E'))
  }
  const protectsNavigation = () => {
    const event = new window.Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }
  return { host, button, click, settle, read, conflict, protectsNavigation,
    accept: value => { acceptDiscard = value }, confirmations: () => confirmations,
    skipped: () => skipped, returned: () => returned,
    close: async () => { await act(async () => view.unmount()); host.remove() }
  }
}

test('the reported AS REO collision can be discarded in a mounted panel without touching any saved data', async () => {
  const ui = await mount(await seed())
  try {
    const before = await stored()
    await ui.conflict()
    assert.equal(ui.protectsNavigation(), true)
    ui.accept(false)
    await ui.click(ui.button('Ignorar importação'))
    assert.equal(ui.skipped(), 0)
    assert.ok(ui.button('Confirmar 25 blocos'))
    ui.accept(true)
    await ui.click(ui.button('Ignorar importação'))
    assert.equal(ui.skipped(), 1)
    assert.equal(ui.protectsNavigation(), false)
    assert.ok(ui.host.querySelector('input[type=file]'))
    assert.doesNotMatch(ui.host.textContent, /sobrepõe-se|horario.pdf|Proposta extraída/)
    assert.deepEqual(await stored(), before)
    await ui.read()
    assert.equal(ui.protectsNavigation(), true, 'a new proposal gets its own discard protection')
  } finally { await ui.close() }
})

test('use saved timetable escapes the conflict with fresh data and no extra question or writes', async () => {
  const ui = await mount(await seed())
  try {
    await ui.conflict()
    await db.groups.update('group', { courseName: 'Curso atualizado' })
    const before = await stored()
    await ui.click(ui.button('Usar horário guardado'))
    await ui.settle(() => Boolean(ui.returned()))
    assert.equal(ui.returned().groups[0].courseName, 'Curso atualizado')
    assert.equal(ui.returned().weeklyScheduleSlots[0].id, 'slot')
    assert.equal(ui.confirmations(), 0)
    assert.equal(ui.protectsNavigation(), false)
    assert.doesNotMatch(ui.host.textContent, /sobrepõe-se|Proposta extraída/)
    assert.deepEqual(await stored(), before)
  } finally { await ui.close() }
})

test('a removed saved timetable does not silently accept a stale snapshot', async () => {
  const ui = await mount(await seed())
  try {
    await ui.conflict()
    await db.weeklyScheduleSlots.update('slot', { active: false })
    await ui.click(ui.button('Usar horário guardado'))
    await ui.settle(() => ui.host.textContent.includes('já não está disponível'))
    assert.equal(ui.returned(), undefined)
    assert.ok(ui.button('Ignorar importação'))
    await ui.click(ui.button('Ignorar importação'))
    assert.equal(ui.protectsNavigation(), false)
  } finally { await ui.close() }
})

test('callback failure leaves a recoverable proposal and releases the busy state', async () => {
  const ui = await mount(await seed(), async () => { throw new Error('Falha ao avançar') })
  try {
    await ui.conflict()
    await ui.click(ui.button('Usar horário guardado'))
    await ui.settle(() => ui.host.textContent.includes('Falha ao avançar'))
    assert.equal(ui.button('Ignorar importação').disabled, false)
    assert.ok(ui.button('Confirmar 25 blocos'))
    await ui.click(ui.button('Ignorar importação'))
    assert.equal(ui.protectsNavigation(), false)
  } finally { await ui.close() }
})

test('a successful import in detailed setup closes the saved proposal and navigation guard', async () => {
  const ui = await mount(await seed(false))
  try {
    assert.equal(ui.button('Usar horário guardado'), undefined)
    await ui.read()
    await ui.click(ui.button('Confirmar 25 blocos'))
    await ui.settle(() => Boolean(ui.returned()))
    assert.equal(ui.returned().weeklyScheduleSlots.length, 22)
    assert.equal(ui.protectsNavigation(), false)
    assert.ok(ui.host.querySelector('input[type=file]'))
    assert.equal(ui.button('Confirmar 25 blocos'), undefined)
    assert.equal(ui.returned().subjects.length, 3)
    assert.ok(ui.returned().subjects.every(subject => !/REO|A2\./.test(subject.name)))
  } finally { await ui.close() }
})

after(async () => {
  await db.delete()
  dom.window.close()
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
  rmSync(output, { recursive: true, force: true })
})
