import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'
import { zipSync, strToU8 } from 'fflate'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'module-import-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)
const compiled = new Set()
function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)
  const source = readFileSync(join(root, relative), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const target = join(output, relative.replace(/\.tsx?$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)
  for (const match of code.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const dependencyBase = resolve(dirname(join(root, relative)), match[1])
    const dependency = existsSync(dependencyBase + '.ts') ? dependencyBase + '.ts' : dependencyBase + '.tsx'
    compile(dependency.slice(root.length + 1))
  }
}
const base = 'src/components/ma-professor/'
// The PDF worker URL is resolved by Vite in the application. This suite exercises
// DOCX extraction and the shared positioned-text parser without starting a worker.
compile(base + 'setup/modulePlanificationImportRepository.ts')
let documentSource = readFileSync(join(root, base, 'setup/planificationModuleDocument.ts'), 'utf8')
documentSource = documentSource.replace(
  "await import('../planifications/planificationPdfExtractor')",
  "Promise.reject(new Error('PDF extraction is tested separately'))"
)
compile(base + 'planifications/planificationPdfParser.ts')
compile(base + 'planifications/planificationPdfTableLayout.ts')
const documentTarget = join(output, base, 'setup/planificationModuleDocument.js')
mkdirSync(dirname(documentTarget), { recursive: true })
writeFileSync(documentTarget, ts.transpileModule(documentSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)
compiled.add(base + 'setup/planificationModuleDocument.ts')
compile(base + 'setup/ModulePlanificationImportPanel.tsx')

const dom = new JSDOM('', { url: 'https://example.test' })
const originalNavigatorDescriptor =
  Object.getOwnPropertyDescriptor(globalThis, 'navigator')
globalThis.window = dom.window
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator
})
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.DOMParser = dom.window.DOMParser
globalThis.CustomEvent = dom.window.CustomEvent
const { readModuleDocument, parseModuleDocxXml, durationWarning } = require(documentTarget)
const { parsePlanificationPdfDocument } = require(join(output, base, 'planifications/planificationPdfParser.js'))
const { readRuledPlanificationTable } = require(join(output, base, 'planifications/planificationPdfTableLayout.js'))
const { maProfessorDb } = require(join(output, base, 'db.js'))
const { readModuleImportState, commitModulePlanificationImport } =
  require(join(output, base, 'setup/modulePlanificationImportRepository.js'))

after(async () => {
  await maProfessorDb.delete()
  dom.window.close()
  rmSync(output, { recursive: true, force: true })

  if (originalNavigatorDescriptor) {
    Object.defineProperty(
      globalThis,
      'navigator',
      originalNavigatorDescriptor
    )
  } else {
    delete globalThis.navigator
  }
})
const xmlText = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const paragraph = value => '<w:p><w:r><w:t>' + xmlText(value) + '</w:t></w:r></w:p>'
const cell = value => '<w:tc>' + value.split('\n').map(paragraph).join('') + '</w:tc>'
const row = values => '<w:tr>' + values.map(cell).join('') + '</w:tr>'
const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
  '<w:p><w:r><w:t>PLANIFICAÇÃO DE Disciplina de teste</w:t></w:r></w:p><w:tbl>' +
  row(['Período Letivo', 'UFCD (Horas)', 'Temas/Conteúdos', 'Objetivos/Competências', 'Estratégias/Metodologias', 'Nº de aulas Previstas (50 min)']) +
  row(['1º Período', 'UFCD 0349 (25h) – Módulo A', 'Conteúdo A 1\nConteúdo A 2', 'Objetivo A 1\nObjetivo A 2', 'Métodos: ativo.\nUso de: livro.', '30']) +
  row(['Avaliação', 'Observação A']) +
  row(['2º Período', 'UFCD 10384 (50 Horas) – Módulo B', 'Conteúdo B', 'Objetivo B', 'Métodos: debate. Uso de: filme.', '30']) +
  row(['Avaliação', 'Observação B']) + '</w:tbl></w:body></w:document>'
const courseXml = xml.replace(
  '<w:p><w:r><w:t>PLANIFICAÇÃO DE Disciplina de teste</w:t></w:r></w:p>',
  '<w:p><w:r><w:t>PLANIFICAÇÃO DE Área de Expressões</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Curso Profissional – Técnico de Apoio Psicossocial 12º ANO</w:t></w:r></w:p>'
)
let document

test('DOCX reads all UFCD after evaluation rows, keeps paragraph order, leading zeros, 25h, provenance and discrepancy', async () => {
  const bytes = zipSync({ 'word/document.xml': strToU8(xml) })
  document = await readModuleDocument(new File([bytes], 'fixture.docx'))
  assert.equal(document.sections.length, 2)
  assert.equal(document.sections[0].code, '0349')
  assert.equal(document.sections[0].name, 'Módulo A')
  assert.equal(document.sections[0].durationHours, 25)
  assert.equal(document.sections[0].periodLabel, '1º Período')
  assert.equal(document.sections[1].periodLabel, '2º Período')
  assert.equal(document.sections[0].contentsText, 'Conteúdo A 1\nConteúdo A 2')
  assert.equal(document.sections[0].objectivesText, 'Objetivo A 1\nObjetivo A 2')
  assert.equal(document.sections[0].evaluationText, 'Observação A')
  assert.equal(document.sections[1].evaluationText, 'Observação B')
  assert.equal(document.sections[0].resourcesText, 'livro.')
  assert.deepEqual(document.sections[0].sourcePages, [])
  assert.equal(document.periodMinutes, 50)
  assert.equal(durationWarning(document.sections[0], 50), '')
  assert.match(durationWarning(document.sections[1], 50), /não correspondem/)
  assert.equal(document.sections[1].plannedLessons, 30)
})

test('planification metadata keeps Área de Expressões separate from Técnico de Apoio Psicossocial', () => {
  const parsed = parseModuleDocxXml(courseXml, 'area-expressoes.docx')
  assert.equal(parsed.subjectLabel, 'Área de Expressões')
  assert.equal(parsed.courseLabel, 'Técnico de Apoio Psicossocial')
})

test('malformed, unsupported and duplicate Word sections fail without inventing fields', () => {
  assert.throws(() => parseModuleDocxXml('<invalid', 'bad.docx'))
  assert.throws(() => parseModuleDocxXml(xml.replace('10384', '0349'), 'duplicate.docx'))
  assert.throws(() => parseModuleDocxXml('<!DOCTYPE x>' + xml, 'entity.docx'))
})

test('ruled PDF tables preserve content above vertically centred module labels and headerless continuation', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y], width: 20 })
  const rules = [0, 100, 200, 300, 400, 500, 600].map(x => [x, 100, x, 700])
  rules.push([0, 100, 600, 100], [0, 700, 600, 700])
  const items = [
    item('UFCD 0349 (25h) — Test', 110, 350),
    item('Conteúdo acima da etiqueta UFCD', 210, 650),
    item('Objetivo acima da etiqueta UFCD', 310, 650),
    item('Métodos: ativo', 410, 400), item('30', 510, 300)
  ]
  const lines = readRuledPlanificationTable(items, rules, true)
  const parsed = parsePlanificationPdfDocument({ pages: [{ pageNumber: 2, lines }], pageCount: 1, characterCount: 200 }, 'test.pdf')
  assert.equal(parsed.sections[0].code, '0349')
  assert.match(parsed.sections[0].contentsText, /Conteúdo acima/)
  assert.match(parsed.sections[0].objectivesText, /Objetivo acima/)
  assert.equal(parsed.sections[0].plannedLessons, 30)
  assert.equal(readRuledPlanificationTable(items, [], true), null)
})

async function seed() {
  await maProfessorDb.delete()
  await maProfessorDb.open()
  const audit = { createdAt: '2026-01-01', updatedAt: '2026-01-01', active: true, academicYearId: 'year' }
  await maProfessorDb.academicYears.add({ id: 'year', name: 'Test', ...audit })
  await maProfessorDb.groups.bulkAdd([
    { id: 'g1', name: 'A', courseName: '', ...audit },
    { id: 'g2', name: 'B', courseName: '', ...audit }
  ])
  await maProfessorDb.subjects.add({ id: 's1', name: 'Test', ...audit })
  await maProfessorDb.teachingAssignments.bulkAdd([
    { id: 'a1', groupId: 'g1', subjectId: 's1', ...audit },
    { id: 'a2', groupId: 'g2', subjectId: 's1', ...audit }
  ])
}
async function request(ids = ['a1', 'a2']) {
  return {
    confirmed: true, academicYearId: 'year', assignmentIds: ids,
    expectedFingerprint: (await readModuleImportState()).fingerprint, document,
    selections: document.sections.map((s, sectionIndex) => ({
      sectionIndex, code: s.code, name: s.name, plannedPeriods: sectionIndex ? 60 : 30, reviewed: true
    }))
  }
}
test('creates modules and plans with one lesson item per content and objectives attached to those contents', async () => {
  await seed()
  assert.equal(await maProfessorDb.modules.count(), 0)
  const result = await commitModulePlanificationImport(await request())
  assert.deepEqual(result, { created: 4, skipped: 0 })
  assert.equal(await maProfessorDb.planifications.count(), 4)
  const items = await maProfessorDb.planificationItems.toArray()
  assert.equal(items.length, 6)
  assert.ok(items.every(item => item.suggestedSummary && item.usedAt === null))
  assert.ok(items.every(item => item.activity === ''))
  const modules = await maProfessorDb.modules.toArray()
  const moduleA = modules.find(module => module.teachingAssignmentId === 'a1' && module.code === '0349')
  const planificationA = (await maProfessorDb.planifications.toArray())
    .find(planification => planification.moduleId === moduleA.id)
  const sequence = items
    .filter(item => item.planificationId === planificationA.id)
    .sort((left, right) => left.order - right.order)
  assert.deepEqual(sequence.map(item => item.suggestedSummary), [
    'Conteúdo A 1', 'Conteúdo A 2'
  ])
  assert.deepEqual(sequence.map(item => item.content), ['Conteúdo A 1', 'Conteúdo A 2'])
  assert.deepEqual(sequence.map(item => item.objectives), ['Objetivo A 1', 'Objetivo A 2'])
  assert.deepEqual(sequence.map(item => item.order), [1, 2])
  assert.ok(sequence.every(item => item.sourceImportKey.startsWith('module-plan-v4:')))
  assert.match(planificationA.description, /Metodologia\/estratégias:/)
  assert.match(planificationA.description, /Recursos:/)
  assert.match(planificationA.description, /Avaliação:/)
  assert.ok(modules.filter(m => m.code === '10384').every(m => m.plannedPeriods === 60))
  assert.ok((await maProfessorDb.planifications.toArray()).some(p => p.description.includes('Aulas previstas no documento: 30')))
  for (const table of ['lessons', 'lessonAttendance', 'assessmentResults', 'setupProgress']) assert.equal(await maProfessorDb[table].count(), 0)
  maProfessorDb.close()
  await maProfessorDb.open()
  assert.equal(await maProfessorDb.modules.count(), 4)
})

test('confirmed course corrects only the selected destination group', async () => {
  await seed()
  const input = await request(['a1'])
  input.courseName = 'Técnico de Apoio Psicossocial'
  assert.deepEqual(await commitModulePlanificationImport(input), { created: 2, skipped: 0 })
  assert.equal((await maProfessorDb.groups.get('g1')).courseName, 'Técnico de Apoio Psicossocial')
  assert.equal((await maProfessorDb.groups.get('g2')).courseName, '')
})

test('reimport preserves existing modules and plans, even after a file rename', async () => {
  await seed()
  assert.deepEqual(await commitModulePlanificationImport(await request()), { created: 4, skipped: 0 })
  const before = await maProfessorDb.planificationItems.toArray()
  const input = await request()
  input.document = { ...input.document, name: 'renamed.docx' }
  assert.deepEqual(await commitModulePlanificationImport(input), { created: 0, skipped: 4 })
  assert.deepEqual(await maProfessorDb.planificationItems.toArray(), before)
})

test('reimport repairs one untouched legacy aggregate into the alternating pending sequence', async () => {
  await seed()
  const source = document.sections[0]
  const timestamp = '2026-01-02'
  await maProfessorDb.modules.add({
    id: 'legacy-module', academicYearId: 'year', teachingAssignmentId: 'a1',
    code: '0349', name: 'Módulo A', plannedPeriods: 30, order: 1,
    plannedStartDate: null, plannedEndDate: null, active: true,
    createdAt: timestamp, updatedAt: timestamp
  })
  await maProfessorDb.planifications.add({
    id: 'legacy-plan', academicYearId: 'year', teachingAssignmentId: 'a1', moduleId: 'legacy-module',
    active: true, title: 'Legacy', description: '', sourceDocumentName: document.name, sourcePages: [],
    createdAt: timestamp, updatedAt: timestamp
  })
  await maProfessorDb.planificationItems.add({
    id: 'legacy-item', planificationId: 'legacy-plan', order: 1,
    content: source.contentsText.replaceAll('\n', ' '), objectives: source.objectivesText,
    activity: source.methodologyText, resources: source.resourcesText,
    evaluation: source.evaluationText, suggestedSummary: '', status: 'planned',
    usedLessonId: null, usedAt: null, sourceDocumentName: document.name, sourcePages: [],
    sourceImportKey: `module-plan-v1:${document.sha256}:0:a1`,
    createdAt: timestamp, updatedAt: timestamp
  })
  const input = await request(['a1'])
  input.selections = [input.selections[0]]
  input.expectedFingerprint = (await readModuleImportState()).fingerprint
  assert.deepEqual(await commitModulePlanificationImport(input), { created: 0, skipped: 1 })
  const repaired = (await maProfessorDb.planificationItems.where('planificationId').equals('legacy-plan').toArray())
    .sort((left, right) => left.order - right.order)
  assert.deepEqual(repaired.map(item => item.suggestedSummary), [
    'Conteúdo A 1', 'Objetivo A 1', 'Conteúdo A 2', 'Objetivo A 2'
  ])
  assert.deepEqual(repaired.map(item => item.status), ['planned', 'planned', 'planned', 'planned'])
  assert.equal(repaired.some(item => item.id === 'legacy-item'), false)
})

test('reimport preserves a used legacy aggregate and restores the objective that must follow it', async () => {
  await seed()
  const source = document.sections[0]
  const timestamp = '2026-01-02'
  await maProfessorDb.modules.add({
    id: 'legacy-module', academicYearId: 'year', teachingAssignmentId: 'a1',
    code: '0349', name: 'Módulo A', plannedPeriods: 30, order: 1,
    plannedStartDate: null, plannedEndDate: null, active: true,
    createdAt: timestamp, updatedAt: timestamp
  })
  await maProfessorDb.planifications.add({
    id: 'legacy-plan', academicYearId: 'year', teachingAssignmentId: 'a1', moduleId: 'legacy-module',
    active: true, title: 'Legacy', description: '', sourceDocumentName: document.name, sourcePages: [],
    createdAt: timestamp, updatedAt: timestamp
  })
  const legacyContent = source.contentsText.replaceAll('\n', ' ')
  await maProfessorDb.planificationItems.add({
    id: 'legacy-item', planificationId: 'legacy-plan', order: 1,
    content: legacyContent, objectives: source.objectivesText,
    activity: source.methodologyText, resources: source.resourcesText,
    evaluation: source.evaluationText, suggestedSummary: '', status: 'used',
    usedLessonId: 'historic-lesson', usedAt: timestamp, sourceDocumentName: document.name, sourcePages: [],
    sourceImportKey: `module-plan-v1:${document.sha256}:0:a1`,
    createdAt: timestamp, updatedAt: timestamp
  })
  const input = await request(['a1'])
  input.selections = [input.selections[0]]
  input.expectedFingerprint = (await readModuleImportState()).fingerprint
  assert.deepEqual(await commitModulePlanificationImport(input), { created: 0, skipped: 1 })
  const repaired = (await maProfessorDb.planificationItems.where('planificationId').equals('legacy-plan').toArray())
    .sort((left, right) => left.order - right.order)
  assert.equal(repaired[0].id, 'legacy-item')
  assert.equal(repaired[0].content, legacyContent)
  assert.equal(repaired[0].status, 'used')
  assert.deepEqual(repaired.slice(1).map(item => item.suggestedSummary), [
    'Objetivo A 1', 'Conteúdo A 2', 'Objetivo A 2'
  ])
  assert.deepEqual(repaired.map(item => item.order), [1, 2, 3, 4])
  assert.ok(repaired.slice(1).every(item => item.status === 'planned' && item.usedLessonId === null))
})

test('reimport migrates the content-only v2 fix without rewriting content already used', async () => {
  await seed()
  const source = document.sections[0]
  const timestamp = '2026-01-02'
  await maProfessorDb.modules.add({
    id: 'v2-module', academicYearId: 'year', teachingAssignmentId: 'a1',
    code: '0349', name: 'Módulo A', plannedPeriods: 30, order: 1,
    plannedStartDate: null, plannedEndDate: null, active: true,
    createdAt: timestamp, updatedAt: timestamp
  })
  await maProfessorDb.planifications.add({
    id: 'v2-plan', academicYearId: 'year', teachingAssignmentId: 'a1', moduleId: 'v2-module',
    active: true, title: 'V2', description: '', sourceDocumentName: document.name, sourcePages: [],
    createdAt: timestamp, updatedAt: timestamp
  })
  await maProfessorDb.planificationItems.bulkAdd([
    {
      id: 'v2-used', planificationId: 'v2-plan', order: 1,
      content: 'Conteúdo A 1', objectives: source.objectivesText,
      activity: source.methodologyText, resources: source.resourcesText,
      evaluation: source.evaluationText, suggestedSummary: '', status: 'used',
      usedLessonId: 'historic-lesson', usedAt: timestamp, sourceDocumentName: document.name, sourcePages: [],
      sourceImportKey: `module-plan-v2:${document.sha256}:0:a1:1`, createdAt: timestamp, updatedAt: timestamp
    },
    {
      id: 'v2-planned', planificationId: 'v2-plan', order: 2,
      content: 'Conteúdo A 2', objectives: source.objectivesText,
      activity: source.methodologyText, resources: source.resourcesText,
      evaluation: source.evaluationText, suggestedSummary: '', status: 'planned',
      usedLessonId: null, usedAt: null, sourceDocumentName: document.name, sourcePages: [],
      sourceImportKey: `module-plan-v2:${document.sha256}:0:a1:2`, createdAt: timestamp, updatedAt: timestamp
    }
  ])
  const input = await request(['a1'])
  input.selections = [input.selections[0]]
  input.expectedFingerprint = (await readModuleImportState()).fingerprint
  assert.deepEqual(await commitModulePlanificationImport(input), { created: 0, skipped: 1 })
  const repaired = (await maProfessorDb.planificationItems.where('planificationId').equals('v2-plan').toArray())
    .sort((left, right) => left.order - right.order)
  assert.equal(repaired[0].id, 'v2-used')
  assert.equal(repaired[0].content, 'Conteúdo A 1')
  assert.equal(repaired[0].status, 'used')
  assert.deepEqual(repaired.slice(1).map(item => item.suggestedSummary), [
    'Objetivo A 1', 'Conteúdo A 2', 'Objetivo A 2'
  ])
  assert.ok(repaired.slice(1).every(item => item.sourceImportKey.startsWith('module-plan-v3:')))
})

test('a late destination failure rolls back earlier modules, plans, items and course correction', async () => {
  await seed()
  const input = await request(['a1', 'missing'])
  input.courseName = 'Técnico de Apoio Psicossocial'
  await assert.rejects(commitModulePlanificationImport(input), /destino/)
  for (const table of ['modules', 'planifications', 'planificationItems']) assert.equal(await maProfessorDb[table].count(), 0)
  assert.equal((await maProfessorDb.groups.get('g1')).courseName, '')
})
test('failed item persistence rolls back module and plan creation', async () => {
  await seed()
  const fail = () => { throw new Error('injected write failure') }
  maProfessorDb.planificationItems.hook('creating', fail)
  try { await assert.rejects(commitModulePlanificationImport(await request()), /injected/) }
  finally { maProfessorDb.planificationItems.hook('creating').unsubscribe(fail) }
  for (const table of ['modules', 'planifications', 'planificationItems']) assert.equal(await maProfessorDb[table].count(), 0)
})
test('stale reviews, duplicate selection and unconfirmed rows write nothing', async () => {
  await seed()
  const stale = await request()
  await maProfessorDb.groups.update('g1', { name: 'Changed' })
  await assert.rejects(commitModulePlanificationImport(stale), /alterados/)
  const duplicate = await request()
  duplicate.selections.push(duplicate.selections[0])
  await assert.rejects(commitModulePlanificationImport(duplicate), /repetidas/)
  const unreviewed = await request()
  unreviewed.selections[0].reviewed = false
  await assert.rejects(commitModulePlanificationImport(unreviewed), /Reveja/)
  assert.equal(await maProfessorDb.modules.count(), 0)
})
test('concurrent confirmations cannot create duplicate records', async () => {
  await seed()
  const input = await request()
  const results = await Promise.allSettled([commitModulePlanificationImport(input), commitModulePlanificationImport(input)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(await maProfessorDb.modules.count(), 4)
})

test('React interface selects a document, requires review and imports the course extracted from the document', async () => {
  await seed()
  globalThis.document = window.document
  globalThis.HTMLElement = window.HTMLElement
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  const { createElement, act } = require('react')
  const { createRoot } = require('react-dom/client')
  const Panel = require(join(output, base, 'setup/ModulePlanificationImportPanel.js')).default
  const host = window.document.createElement('div')
  window.document.body.append(host)
  const root = createRoot(host)
  let refreshed = 0
  const snapshot = {
    academicYear: { id: 'year' }, subjects: await maProfessorDb.subjects.toArray(),
    groups: await maProfessorDb.groups.toArray(), teachingAssignments: await maProfessorDb.teachingAssignments.toArray(), modules: []
  }
  const findButton = text => [...host.querySelectorAll('button')].find(button => button.textContent === text)
  const click = async element => { await act(async () => element.click()) }
  try {
    await act(async () => root.render(createElement(Panel, {
      snapshot, disabled: false, onActiveChange: () => {}, onImported: async () => { refreshed++ }
    })))
    await click(findButton('Importar PDF ou Word'))
    const input = host.querySelector('input[type=file]')
    Object.defineProperty(input, 'files', { value: [new File([zipSync({ 'word/document.xml': strToU8(courseXml) })], 'area-expressoes.docx')] })
    await act(async () => {
      input.dispatchEvent(new window.Event('change', { bubbles: true }))
      for (let i = 0; i < 30 && host.querySelectorAll('article').length !== 2; i++) await new Promise(resolve => setTimeout(resolve, 10))
    })
    assert.equal(host.querySelectorAll('article').length, 2)
    assert.match(host.textContent, /Curso indicado no documento:\s*Técnico de Apoio Psicossocial/)
    assert.ok(findButton('Confirmar importação').disabled)

    const subjectDestination = [...host.querySelectorAll('label')]
      .find(label => label.textContent.includes('Disciplina de destino'))
      ?.querySelector('input')
    assert.ok(subjectDestination)
    assert.equal(subjectDestination.value, 'Área de Expressões')

    const destination = [...host.querySelectorAll('label')].find(label => label.textContent.trim() === 'A · curso não indicado')
    await click(destination.querySelector('input'))
    for (const article of host.querySelectorAll('article')) {
      const review = [...article.querySelectorAll('label')].find(label => label.textContent.includes('Revi os dados'))
      await click(review.querySelector('input'))
    }
    assert.equal(findButton('Confirmar importação').disabled, false)
    window.confirm = () => true
    await act(async () => {
      findButton('Confirmar importação').click()
      for (let i = 0; i < 100 && !refreshed; i++) await new Promise(resolve => setTimeout(resolve, 10))
    })
    assert.equal(await maProfessorDb.modules.count(), 2)
    assert.equal(await maProfessorDb.planifications.count(), 2)
    assert.equal((await maProfessorDb.groups.get('g1')).courseName, 'Técnico de Apoio Psicossocial')
    const importedSubject = (await maProfessorDb.subjects.toArray())
      .find(subject => subject.name === 'Área de Expressões')
    assert.ok(importedSubject)
    const importedAssignment = (await maProfessorDb.teachingAssignments.toArray())
      .find(assignment => assignment.groupId === 'g1' && assignment.subjectId === importedSubject.id)
    assert.ok(importedAssignment)
    assert.equal(refreshed, 1)
    assert.match(host.textContent, /Importação concluída/)
  } finally {
    await act(async () => root.unmount())
    host.remove()
    globalThis.IS_REACT_ACT_ENVIRONMENT = false
  }
})

if (process.env.MA_IMPORT_PRIVATE_DOCX_DIR) {
  test('private real documents: all six UFCD and the 10384 discrepancy', async () => {
    const sections = []
    for (const name of readdirSync(process.env.MA_IMPORT_PRIVATE_DOCX_DIR).filter(name => name.endsWith('.docx'))) {
      const file = new File([readFileSync(join(process.env.MA_IMPORT_PRIVATE_DOCX_DIR, name))], name)
      sections.push(...(await readModuleDocument(file)).sections)
    }
    assert.deepEqual(sections.map(s => s.code).sort(), ['10371', '10372', '10380', '10382', '10383', '10384'])
    assert.ok(sections.every(s => s.contentsText && s.objectivesText && s.methodologyText && s.evaluationText))
    assert.equal(sections.find(s => s.code === '10371').durationHours, 25)
    assert.match(durationWarning(sections.find(s => s.code === '10384'), 50), /não correspondem/)
  })
}

if (process.env.MA_IMPORT_PRIVATE_PDF_DIR) {
  test('private exported PDFs: six modules, hours, lesson counts and all planning columns', async () => {
    const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const exports = {}
    const extractor = ts.transpileModule(readFileSync(join(root, base, 'planifications/planificationPdfExtractor.ts'), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
    }).outputText
    new Function('require', 'exports', extractor)(id => {
      if (id === 'pdfjs-dist') return pdf
      if (id === './planificationPdfTableLayout') return { readRuledPlanificationTable }
      return { default: new URL(import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href }
    }, exports)
    const sections = []
    for (const name of readdirSync(process.env.MA_IMPORT_PRIVATE_PDF_DIR).filter(name => name.endsWith('.pdf'))) {
      const file = new File([readFileSync(join(process.env.MA_IMPORT_PRIVATE_PDF_DIR, name))], name, { type: 'application/pdf' })
      const extracted = await exports.extractPlanificationPdf(file)
      sections.push(...parsePlanificationPdfDocument(extracted, name).sections)
    }
    assert.deepEqual(sections.map(s => s.code).sort(), ['10371', '10372', '10380', '10382', '10383', '10384'])
    assert.ok(sections.every(s => s.contentsText && s.objectivesText && s.methodologyText && s.resourcesText && s.evaluationText))
    assert.equal(sections.find(s => s.code === '10371').durationHours, 25)
    assert.equal(sections.find(s => s.code === '10384').plannedLessons, 30)
  })
}
