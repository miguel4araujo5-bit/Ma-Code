import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'
import { zipSync, strToU8 } from 'fflate'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'criteria-recognition-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)
const base = 'src/components/ma-professor/'
const extractorPath = base + 'planifications/planificationPdfExtractor.ts'
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

compile(base + 'setup/GuidedAssessmentCriteriaImportPanel.tsx')
compile(base + 'setup/AssessmentCriteriaPdfImportPanel.tsx')
compile(base + 'planifications/planificationPdfTableLayout.ts')
const extractorTarget = join(output, extractorPath.replace('.ts', '.js'))
mkdirSync(dirname(extractorTarget), { recursive: true })
writeFileSync(extractorTarget, '')
const extractorExports = {}
// Only Vite's worker URL import is adapted for Node. PDF.js and the real
// extraction, parser, React panels and Dexie persistence are all exercised.
Function('require', 'exports', javascript(readFileSync(join(root, extractorPath), 'utf8')))(request => {
  if (request === 'pdfjs-dist') return pdfjs
  if (request.includes('pdf.worker')) return { default: new URL(import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href }
  if (request === './planificationPdfTableLayout') return require(join(output, base, 'planifications/planificationPdfTableLayout.js'))
  throw new Error(`Unexpected dependency: ${request}`)
}, extractorExports)
require.cache[extractorTarget] = { id: extractorTarget, filename: extractorTarget, loaded: true, exports: extractorExports }

const dom = new JSDOM('', { url: 'https://criteria.test' })
const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
globalThis.window = dom.window
for (const name of ['document', 'Node', 'Element', 'HTMLElement', 'HTMLSelectElement', 'DOMParser', 'CustomEvent']) globalThis[name] = window[name]
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { createElement, act } = require('react')
const { createRoot } = require('react-dom/client')
const GuidedPanel = require(join(output, base, 'setup/GuidedAssessmentCriteriaImportPanel.js')).default
const DetailedPanel = require(join(output, base, 'setup/AssessmentCriteriaPdfImportPanel.js')).default
const { resolveAssessmentCriteriaDestinations: destinations } = require(join(output, base, 'setup/assessmentCriteriaDestinations.js'))
const { maProfessorDb: db } = require(join(output, base, 'db.js'))
const { maProfessorRepository: repository } = require(join(output, base, 'repository.js'))

const audit = { active: true, academicYearId: 'year', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
function state() {
  return {
    academicYear: { id: 'year', name: '2026/27', startDate: '2026-09-01', endDate: '2027-07-31', setupCompletedAt: null, ...audit },
    groups: [10, 11, 12].map(grade => ({ id: `g${grade}`, name: `${grade}.º D`, gradeLevel: `${grade}.º ano`, courseName: 'Técnico de Apoio Psicossocial', ...audit })),
    subjects: [
      { id: 'ae', name: 'Área de Expressões', shortName: 'AE', code: 'AEXP', ...audit },
      { id: 'as', name: 'Animação Sociocultural', shortName: 'AS', code: 'ASC', ...audit }
    ],
    teachingAssignments: [10, 11, 12].map(grade => ({ id: `a${grade}`, groupId: `g${grade}`, subjectId: 'ae', displayName: `AE · ${grade}.º D`, ...audit }))
      .concat([{ id: 'as10', groupId: 'g10', subjectId: 'as', displayName: 'AS · 10.º D', ...audit }]),
    assessmentSchemes: [], assessmentCriteria: [], modules: [], planifications: [], planificationItems: [], weeklyScheduleSlots: [], students: [], progress: null
  }
}

test('general criteria select all years of one recognized subject through names, codes and stored aliases', () => {
  for (const label of ['Área de Expressões', 'AREA DE EXPRESSOES', 'AEXP', 'A.E.']) {
    const result = destinations(state(), label)
    assert.deepEqual(result.suggestedAssignmentIds, ['a10', 'a11', 'a12'])
    assert.equal(result.confidence, 'high')
  }
})

test('missing or ambiguous subjects provide manual options without selecting an unrelated discipline', () => {
  for (const label of ['', 'Disciplina desconhecida']) {
    const result = destinations(state(), label)
    assert.deepEqual(result.suggestedAssignmentIds, [])
    assert.equal(result.available.length, 4)
  }
  const snapshot = state()
  snapshot.subjects.push({ ...snapshot.subjects[0], id: 'duplicate' })
  assert.equal(destinations(snapshot, 'Área de Expressões').suggestedAssignmentIds.length, 0)
})

test('inferred initials stay reviewable and inactive, foreign and already configured destinations are excluded', () => {
  const snapshot = state()
  snapshot.subjects[0].shortName = ''
  snapshot.subjects[0].code = ''
  assert.equal(destinations(snapshot, 'AE').confidence, 'medium')
  snapshot.groups[1].active = false
  snapshot.groups[2].academicYearId = 'previous-year'
  assert.deepEqual(destinations(snapshot, 'AE').suggestedAssignmentIds, ['a10'])
  snapshot.assessmentSchemes.push({ id: 'existing', scope: 'subject', teachingAssignmentId: 'a10', ...audit })
  const result = destinations(snapshot, 'AE')
  assert.deepEqual(result.suggestedAssignmentIds, [])
  assert.equal(result.preservedCount, 1)
})

function rows(subject = 'Área de Expressões', weights = [60, 20, 20]) {
  return [
    [`CRITÉRIOS DE AVALIAÇÃO DA DISCIPLINA DE ${subject} - PROFISSIONAIS`],
    ['Curso Profissional: Técnico de Apoio Psicossocial'],
    ['Turma: 12º D'],
    ['Domínio', 'Ponderação', 'Operacionalização', 'Indicadores', 'Instrumentos'],
    ['Desempenho nas aprendizagens', `${weights[0]}%`, 'Aplicação dos conhecimentos', 'Realiza as tarefas', 'Trabalhos'],
    ['Raciocínio e comunicação', `${weights[1]}%`, 'Mobilização de informação', 'Comunica com rigor', 'Apresentações'],
    ['Competências transversais', `${weights[2]}%`, 'Responsabilidade e autonomia', 'Cumpre compromissos', 'Observação']
  ]
}
const paragraph = value => `<w:p><w:r><w:t>${value}</w:t></w:r></w:p>`
function wordFile(subject, weights) {
  const values = rows(subject, weights)
  const xml = `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${values.slice(0, 3).map(value => paragraph(value[0])).join('')}<w:tbl>${values.slice(3).map(row => `<w:tr>${row.map(value => `<w:tc>${paragraph(value)}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl></w:body></w:document>`
  return new File([zipSync({ 'word/document.xml': strToU8(xml) })], 'criterios.docx')
}
async function pdfFile() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const page = pdf.addPage([1050, 700])
  rows().forEach((row, index) => row.forEach((text, column) => page.drawText(text, {
    x: [30, 240, 360, 600, 840][column], y: 660 - index * 45, size: index < 3 ? 10 : 8, font
  })))
  return new File([await pdf.save()], 'criterios.pdf', { type: 'application/pdf' })
}

async function seed(change = () => {}) {
  await db.delete()
  await db.open()
  const snapshot = state()
  change(snapshot)
  await db.academicYears.add(snapshot.academicYear)
  for (const name of ['groups', 'subjects', 'teachingAssignments', 'assessmentSchemes', 'assessmentCriteria']) if (snapshot[name].length) await db[name].bulkAdd(snapshot[name])
  // Existing teaching content must be untouched by criteria imports.
  await db.modules.add({ id: 'module', teachingAssignmentId: 'a10', code: '0349', name: 'Expressão', plannedPeriods: 30, order: 1, plannedStartDate: null, plannedEndDate: null, ...audit })
  await db.planifications.add({ id: 'plan', teachingAssignmentId: 'a10', moduleId: 'module', title: 'Planificação guardada', description: '', ...audit })
  await db.lessons.add({ id: 'lesson', teachingAssignmentId: 'a10', summary: 'Sumário preservado', ...audit })
  return repository.getSetupSnapshot('year')
}
async function mount(Panel, snapshot) {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  let confirmations = 0
  let refreshes = 0
  window.confirm = () => { confirmations++; return true }
  const render = current => root.render(createElement(Panel, { snapshot: current, onImported(next) { refreshes++; render(next) } }))
  await act(async () => render(snapshot))
  const button = name => [...host.querySelectorAll('button')].find(item => item.textContent.trim() === name)
  const click = async item => { assert.ok(item); await act(async () => item.click()) }
  async function settle(predicate) {
    for (let i = 0; i < 200 && !predicate(); i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) })
    assert.ok(predicate(), host.textContent)
  }
  async function drop(fileOrFiles) {
    const zone = [...host.querySelectorAll('div')].find(item => item.className.includes('border-dashed'))
    assert.ok(zone)
    const event = new window.Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', { value: { files: Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles] } })
    await act(async () => zone.dispatchEvent(event))
  }
  const readRows = () => [...host.querySelectorAll('article')].map(article => ({
    name: article.querySelector('input:not([type=checkbox]):not([type=number])').value,
    weight: article.querySelector('input[type=number]').value,
    description: article.querySelector('textarea').value
  }))
  return { host, button, click, settle, drop, readRows, confirmations: () => confirmations, refreshes: () => refreshes,
    close: async () => { await act(async () => root.unmount()); host.remove() }
  }
}

test('the same real PDF dropped in the detailed and guided panels yields identical criteria, descriptions and weights', async () => {
  const snapshot = await seed()
  const file = await pdfFile()
  let detailedRows
  const detailed = await mount(DetailedPanel, snapshot)
  try {
    await detailed.click(detailed.button('Importar documento'))
    await detailed.drop(file)
    await detailed.settle(() => detailed.host.querySelectorAll('article').length === 3)
    detailedRows = detailed.readRows()
    assert.deepEqual(detailedRows.map(row => row.weight), ['60', '20', '20'])
  } finally { await detailed.close() }
  const guided = await mount(GuidedPanel, snapshot)
  try {
    await guided.drop(file)
    await guided.settle(() => Boolean(guided.button('Editar critérios')))
    assert.equal(guided.button('Aplicar critérios').disabled, false)
    assert.match(guided.host.textContent, /10.º D, 11.º D, 12.º D/)
    await guided.click(guided.button('Editar critérios'))
    assert.deepEqual(guided.readRows(), detailedRows)
    assert.equal(await db.assessmentSchemes.count(), 0, 'Dropping only prepares a review')
  } finally { await guided.close() }
})

test('Word drop automatically prepares all years, a single apply saves identical criteria and preserves teaching content', async () => {
  const snapshot = await seed()
  const preserved = await Promise.all([db.modules.toArray(), db.planifications.toArray(), db.lessons.toArray()])
  const ui = await mount(GuidedPanel, snapshot)
  try {
    await ui.drop(wordFile())
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    assert.equal(ui.button('Aplicar critérios').disabled, false)
    assert.match(ui.host.textContent, /10.º D, 11.º D, 12.º D/)
    await ui.click(ui.button('Aplicar critérios'))
    await ui.settle(() => ui.refreshes() === 1)
    const schemes = await db.assessmentSchemes.toArray()
    const criteria = await db.assessmentCriteria.toArray()
    assert.deepEqual(schemes.map(item => item.teachingAssignmentId).sort(), ['a10', 'a11', 'a12'])
    assert.equal(criteria.length, 9)
    for (const scheme of schemes) assert.deepEqual(criteria.filter(item => item.schemeId === scheme.id).sort((a, b) => a.order - b.order).map(item => item.weightPercent), [60, 20, 20])
    assert.deepEqual(await Promise.all([db.modules.toArray(), db.planifications.toArray(), db.lessons.toArray()]), preserved)
    assert.equal(ui.confirmations(), 0)
    await ui.drop(wordFile())
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    assert.equal(ui.button('Aplicar critérios').disabled, true)
    assert.match(ui.host.textContent, /já estão configurados/)
    assert.deepEqual(await db.assessmentSchemes.toArray(), schemes)
    assert.deepEqual(await db.assessmentCriteria.toArray(), criteria)
  } finally { await ui.close() }
})

test('an unknown subject remains editable inside the guided flow and only the manually chosen destination is saved', async () => {
  const ui = await mount(GuidedPanel, await seed())
  try {
    await ui.drop(wordFile('Disciplina de teste'))
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    assert.equal(ui.button('Aplicar critérios').disabled, true)
    const label = [...ui.host.querySelectorAll('label')].find(item => item.textContent.includes('10.º D · Área de Expressões'))
    await ui.click(label.querySelector('input'))
    assert.equal(ui.button('Aplicar critérios').disabled, false)
    await ui.click(ui.button('Aplicar critérios'))
    await ui.settle(() => ui.refreshes() === 1)
    assert.deepEqual((await db.assessmentSchemes.toArray()).map(item => item.teachingAssignmentId), ['a10'])
  } finally { await ui.close() }
})

test('invalid totals remain visible and cannot be saved', async () => {
  const ui = await mount(GuidedPanel, await seed())
  try {
    await ui.drop(wordFile('Área de Expressões', [50, 20, 20]))
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    assert.equal(ui.button('Aplicar critérios').disabled, true)
    assert.match(ui.host.textContent, /Total 90%/)
    assert.equal(await db.assessmentSchemes.count(), 0)
  } finally { await ui.close() }
})

test('destination changes after analysis invalidate the proposal instead of silently moving criteria', async () => {
  const ui = await mount(GuidedPanel, await seed())
  try {
    await ui.drop(wordFile())
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    await db.groups.update('g12', { name: '12.º E' })
    await ui.click(ui.button('Aplicar critérios'))
    await ui.settle(() => ui.host.textContent.includes('configuração mudou'))
    assert.equal(await db.assessmentSchemes.count(), 0)
  } finally { await ui.close() }
})

test('already configured classes are preserved while remaining classes receive the recognized criteria', async () => {
  const snapshot = await seed(current => {
    current.assessmentSchemes = [{ id: 'existing', teachingAssignmentId: 'a10', scope: 'subject', moduleId: null, name: 'Original', ...audit }]
    current.assessmentCriteria = [{ id: 'original', schemeId: 'existing', name: 'Critério existente', description: '', weightPercent: 100, order: 1, ...audit }]
  })
  const original = await db.assessmentCriteria.get('original')
  const ui = await mount(GuidedPanel, snapshot)
  try {
    await ui.drop(wordFile())
    await ui.settle(() => Boolean(ui.button('Aplicar critérios')))
    assert.match(ui.host.textContent, /11.º D, 12.º D/)
    assert.match(ui.host.textContent, /1 turma já tem critérios/)
    await ui.click(ui.button('Aplicar critérios'))
    await ui.settle(() => ui.refreshes() === 1)
    assert.equal(await db.assessmentSchemes.count(), 3)
    assert.deepEqual(await db.assessmentCriteria.get('original'), original)
  } finally { await ui.close() }
})

test('multiple files are rejected instead of silently ignoring all but the first', async () => {
  const ui = await mount(GuidedPanel, await seed())
  try {
    await ui.drop([wordFile(), wordFile()])
    assert.match(ui.host.textContent, /um documento de critérios de cada vez/)
    assert.equal(ui.button('Aplicar critérios'), undefined)
    assert.equal(await db.assessmentSchemes.count(), 0)
  } finally { await ui.close() }
})

after(async () => {
  await db.delete()
  dom.window.close()
  if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator)
  globalThis.IS_REACT_ACT_ENVIRONMENT = false
  rmSync(output, { recursive: true, force: true })
})
