import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'
import { zipSync, strToU8 } from 'fflate'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'planification-destination-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const compiled = new Set()
function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)
  // Exercise the real DOCX reader and persistence; PDF extraction has separate tests.
  const source = readFileSync(join(root, relative), 'utf8').replace(
    "await import('../planifications/planificationPdfExtractor')",
    "Promise.reject(new Error('PDF worker tested separately'))"
  )
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
  } }).outputText
  const target = join(output, relative.replace(/\.tsx?$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)
  for (const match of code.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const base = resolve(dirname(join(root, relative)), match[1])
    compile((existsSync(base + '.ts') ? base + '.ts' : base + '.tsx').slice(root.length + 1))
  }
}
const base = 'src/components/ma-professor/'
compile(base + 'setup/ModulePlanificationImportPanel.tsx')
const require = createRequire(import.meta.url)
const { resolvePlanificationDestination, planificationDestinations } = require(join(output, base, 'setup/planificationDestination.js'))
const { parseModuleDocxXml } = require(join(output, base, 'setup/planificationModuleDocument.js'))
const { maProfessorDb: db } = require(join(output, base, 'db.js'))
const dom = new JSDOM('', { url: 'https://test.example' })
const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
globalThis.window = dom.window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.DOMParser = window.DOMParser
globalThis.CustomEvent = window.CustomEvent
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
const Panel = require(join(output, base, 'setup/ModulePlanificationImportPanel.js')).default

const audit = { academicYearId: 'year', active: true, createdAt: '2026-01-01', updatedAt: '2026-01-01' }
function snapshot() {
  return {
    academicYear: { id: 'year', name: '2026/27', ...audit }, progress: null,
    subjects: [{ id: 'ae', name: 'Área de Expressões', shortName: 'AEXP', code: 'AE', ...audit }],
    groups: [10, 12].map(grade => ({ id: `g${grade}`, name: `${grade}.º D`, gradeLevel: `${grade}.º ano`, courseName: 'Técnico de Apoio Psicossocial', ...audit })),
    teachingAssignments: [10, 12].map(grade => ({ id: `a${grade}`, subjectId: 'ae', groupId: `g${grade}`, displayName: `AE · ${grade}.º D`, ...audit })),
    weeklyScheduleSlots: [[10, 1], [10, 2], [12, 1], [12, 2]].map(([grade, day]) => ({ id: `s${grade}-${day}`, teachingAssignmentId: `a${grade}`, weekday: day, startTime: grade === 10 ? '09:00' : '10:00', endTime: grade === 10 ? '09:50' : '10:50', periodCount: 1, validFrom: '2026-09-01', validUntil: '2027-07-31', ...audit })),
    modules: [], students: [], assessmentSchemes: [{ id: 'scheme', teachingAssignmentId: 'a10', scope: 'subject', moduleId: null, name: 'Critérios comuns', ...audit }],
    assessmentCriteria: [{ id: 'criterion', schemeId: 'scheme', name: 'Participação', description: '', order: 1, weightPercent: 100, ...audit }],
    planifications: [], planificationItems: []
  }
}
const metadata = changes => ({ subjectLabel: 'Área de Expressões', gradeLabel: '10.º ano', groupLabel: '', courseLabel: '', ...changes })

test('same subject resolves separately for 10th and 12th grade, including class typography', () => {
  for (const grade of [10, 12]) {
    assert.equal(resolvePlanificationDestination(snapshot(), metadata({ gradeLabel: `${grade}º ano` })).destination.assignment.id, `a${grade}`)
    assert.equal(resolvePlanificationDestination(snapshot(), metadata({ gradeLabel: '', groupLabel: `${grade}ºD` })).destination.assignment.id, `a${grade}`)
  }
})

test('a single remaining assignment never overrides the document year or class', () => {
  const state = snapshot()
  state.teachingAssignments = state.teachingAssignments.filter(item => item.id === 'a12')
  assert.equal(resolvePlanificationDestination(state, metadata({})).destination, null)
  assert.equal(resolvePlanificationDestination(state, metadata({ gradeLabel: '12.º ano', groupLabel: '12.º C' })).destination, null)
})

test('unknown year, ambiguous same-year classes and contradictory courses are never auto-assigned', () => {
  assert.equal(resolvePlanificationDestination(snapshot(), metadata({ gradeLabel: '11.º ano' })).destination, null)
  assert.equal(resolvePlanificationDestination(snapshot(), metadata({ gradeLabel: '' })).destination, null)
  assert.equal(resolvePlanificationDestination(snapshot(), metadata({ courseLabel: 'Outro curso' })).destination, null)
  const state = snapshot()
  state.groups.push({ ...state.groups[0], id: 'g10c', name: '10.º C' })
  state.teachingAssignments.push({ ...state.teachingAssignments[0], id: 'a10c', groupId: 'g10c' })
  assert.equal(resolvePlanificationDestination(state, metadata({})).destination, null)
})

test('persisted aliases are reused, inferred initials are marked for review and inactive or foreign destinations are excluded', () => {
  for (const subjectLabel of ['AE', 'AEXP', 'Area de Expressoes']) {
    assert.equal(resolvePlanificationDestination(snapshot(), metadata({ subjectLabel })).destination.assignment.id, 'a10')
  }
  const state = snapshot()
  state.subjects[0].shortName = ''
  state.subjects[0].code = ''
  assert.ok(resolvePlanificationDestination(state, metadata({ subjectLabel: 'AE' })).warnings.length)
  state.teachingAssignments[0].active = false
  assert.equal(resolvePlanificationDestination(state, metadata({})).destination, null)
  state.teachingAssignments[0].active = true
  state.groups[0].academicYearId = 'old-year'
  assert.equal(planificationDestinations(state).length, 1)
})

test('an explicit cell keeps its exact assignment with a nonblocking mismatch warning', () => {
  const result = resolvePlanificationDestination(snapshot(), metadata({}), 'a12')
  assert.equal(result.destination.assignment.id, 'a12')
  assert.match(result.warnings.join(' '), /10.º ano.*12.º D/)
  assert.equal(resolvePlanificationDestination(snapshot(), metadata({}), 'deleted').destination, null)
})

const cell = value => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`
const row = values => `<w:tr>${values.map(cell).join('')}</w:tr>`
function xml(grade, content, heading = true) {
  return `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:r><w:t>PLANIFICAÇÃO DE Área de Expressões</w:t></w:r></w:p>
    ${heading ? `<w:p><w:r><w:t>${grade}º ANO</w:t></w:r></w:p>` : ''}
    <w:tbl>${row(['Período Letivo', 'UFCD (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Aulas previstas (50 min)'])}
    ${row(['1º Período', 'UFCD 0349 (25h) – Expressão', content, 'Objetivo', 'Método', '30'])}</w:tbl>
    </w:body></w:document>`
}
const file = (grade, content) => new File([zipSync({ 'word/document.xml': strToU8(xml(grade, content)) })], `AE-${grade}.docx`)

test('metadata reads primary grades and ordinal class/year markers in filenames', () => {
  assert.equal(parseModuleDocxXml(xml(5, 'Expressão corporal e improvisação'), 'plano.docx').gradeLabel, '5.º ano')
  assert.equal(parseModuleDocxXml(xml(12, 'Expressão corporal e improvisação', false), 'Planificação 12.º D.docx').groupLabel, '12.º D')
  assert.equal(parseModuleDocxXml(xml(10, 'Expressão corporal e improvisação', false), 'Planificação 10º ANO.docx').gradeLabel, '10.º ano')
})

async function seed() {
  await db.delete()
  await db.open()
  const state = snapshot()
  await db.academicYears.add(state.academicYear)
  for (const name of ['groups', 'subjects', 'teachingAssignments', 'weeklyScheduleSlots', 'assessmentSchemes', 'assessmentCriteria']) await db[name].bulkAdd(state[name])
  return state
}
async function harness() {
  let state = await seed()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let confirmations = 0
  window.confirm = () => { confirmations++; return true }
  let disabled = false
  const render = () => root.render(createElement(Panel, { snapshot: state, disabled, guided: true, onActiveChange() {}, onImported: refresh }))
  async function refresh() {
    for (const name of ['modules', 'planifications', 'planificationItems']) state = { ...state, [name]: await db[name].toArray() }
    render()
  }
  await act(async () => render())
  const button = label => [...host.querySelectorAll('button')].find(item => item.textContent === label)
  const cells = id => [...host.querySelectorAll(`[data-planification-assignment="${id}"]`)]
  async function settle(predicate) {
    for (let i = 0; i < 100 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.ok(predicate(), host.textContent)
  }
  async function drop(id, files) {
    const event = new window.Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { files } })
    await act(async () => cells(id)[0].dispatchEvent(event))
  }
  async function save() {
    assert.equal(button('Importar 1 planificação').disabled, false)
    await act(async () => button('Importar 1 planificação').click())
    await settle(() => host.textContent.includes('Importação concluída') && !host.textContent.includes('A processar a planificação'))
  }
  return { host, cells, button, drop, settle, save, confirmations: () => confirmations,
    disable: async () => { disabled = true; await act(async () => render()) },
    close: async () => { await act(async () => root.unmount()); host.remove() }
  }
}

test('dropping two different plans persists only each exact class, updates every matching cell and preserves criteria on reimport', async () => {
  const ui = await harness()
  const originalCriteria = await db.assessmentCriteria.toArray()
  const originalSchemes = await db.assessmentSchemes.toArray()
  try {
    await ui.drop('a10', [file(10, 'Conteúdo do décimo')])
    await ui.settle(() => Boolean(ui.button('Importar 1 planificação')))
    assert.ok(ui.cells('a10').every(item => item.getAttribute('aria-pressed') === 'true'))
    assert.ok(ui.cells('a12').every(item => item.getAttribute('aria-pressed') === 'false'))
    await ui.save()
    assert.ok(ui.cells('a10').every(item => item.textContent.includes('Planificação associada')))
    assert.ok(ui.cells('a12').every(item => item.textContent.includes('Sem planificação')))
    await ui.drop('a12', [file(12, 'Conteúdo do décimo segundo')])
    await ui.settle(() => Boolean(ui.button('Importar 1 planificação')))
    await ui.save()
    const plans = await db.planifications.toArray()
    const items = await db.planificationItems.toArray()
    assert.equal(plans.length, 2)
    for (const [id, content] of [['a10', 'Conteúdo do décimo'], ['a12', 'Conteúdo do décimo segundo']]) {
      const plan = plans.find(item => item.teachingAssignmentId === id)
      assert.equal(items.find(item => item.planificationId === plan.id).content, content)
    }
    await ui.drop('a10', [file(10, 'Conteúdo do décimo')])
    await ui.settle(() => Boolean(ui.button('Importar 1 planificação')))
    await ui.save()
    assert.equal(await db.modules.count(), 2)
    assert.deepEqual(await db.planifications.toArray(), plans)
    assert.deepEqual(await db.planificationItems.toArray(), items)
    assert.deepEqual(await db.assessmentSchemes.toArray(), originalSchemes)
    assert.deepEqual(await db.assessmentCriteria.toArray(), originalCriteria)
    assert.equal(await db.subjects.count(), 1)
    assert.equal(await db.teachingAssignments.count(), 2)
    assert.equal(ui.confirmations(), 0, 'Import is confirmed by its button, without another modal')
    await db.close()
    await db.open()
    assert.deepEqual(await db.planifications.toArray(), plans)
  } finally { await ui.close() }
})

test('mismatch is amber but permits import, and clicking another cell corrects the destination without rereading', async () => {
  const ui = await harness()
  try {
    await ui.drop('a12', [file(10, 'Expressão corporal e improvisação')])
    await ui.settle(() => Boolean(ui.button('Importar 1 planificação')))
    assert.match(ui.host.textContent, /Destino a rever/)
    assert.equal(ui.button('Importar 1 planificação').disabled, false)
    assert.ok(ui.cells('a12').every(item => item.className.includes('amber')))
    await act(async () => ui.cells('a10')[0].click())
    assert.ok(ui.cells('a10').every(item => item.getAttribute('aria-pressed') === 'true'))
    await ui.save()
    assert.equal((await db.planifications.toArray())[0].teachingAssignmentId, 'a10')
    assert.equal(ui.confirmations(), 0)
  } finally { await ui.close() }
})

test('multiple files and disabled cells never start an import', async () => {
  const ui = await harness()
  try {
    await ui.drop('a10', [file(10, 'A'), file(12, 'B')])
    assert.match(ui.host.textContent, /uma planificação de cada vez/)
    assert.equal(ui.button('Importar 1 planificação'), undefined)
    await ui.disable()
    await ui.drop('a10', [file(10, 'A')])
    assert.equal(ui.button('Importar 1 planificação'), undefined)
    assert.equal(await db.modules.count(), 0)
  } finally { await ui.close() }
})

test('a file selected without a cell resolves the document year and imports only that class', async () => {
  const ui = await harness()
  try {
    const input = ui.host.querySelector('input[type=file]:not(.hidden)')
    Object.defineProperty(input, 'files', { value: [file(12, 'Trabalho do décimo segundo')] })
    await act(async () => input.dispatchEvent(new window.Event('change', { bubbles: true })))
    await ui.settle(() => Boolean(ui.button('Importar 1 planificação')))
    assert.ok(ui.cells('a12').every(item => item.getAttribute('aria-pressed') === 'true'))
    assert.ok(ui.cells('a10').every(item => item.getAttribute('aria-pressed') === 'false'))
    await ui.save()
    assert.equal((await db.planifications.toArray())[0].teachingAssignmentId, 'a12')
    assert.equal(ui.confirmations(), 0)
  } finally { await ui.close() }
})

after(async () => {
  await db.delete()
  dom.window.close()
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
  globalThis.IS_REACT_ACT_ENVIRONMENT = false
  rmSync(output, { recursive: true, force: true })
})
