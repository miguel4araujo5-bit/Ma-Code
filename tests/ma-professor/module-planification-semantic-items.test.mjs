import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'module-plan-semantic-'))
writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}')
const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)

  const source = readFileSync(join(root, relative), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText
  const target = join(output, relative.replace(/\.tsx?$/, '.js'))
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, code)

  for (const match of code.matchAll(/require\(["'](\.[^"']+)["']\)/g)) {
    const dependencyBase = resolve(dirname(join(root, relative)), match[1])
    const dependency = existsSync(dependencyBase + '.ts')
      ? dependencyBase + '.ts'
      : dependencyBase + '.tsx'
    compile(dependency.slice(root.length + 1))
  }
}

const base = 'src/components/ma-professor/'
compile(base + 'setup/modulePlanificationImportRepository.ts')

const dom = new JSDOM('', { url: 'https://example.test' })
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
globalThis.window = dom.window
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: dom.window.navigator
})
Object.defineProperty(window, 'indexedDB', { value: globalThis.indexedDB })
globalThis.CustomEvent = dom.window.CustomEvent

const { maProfessorDb } = require(join(output, base, 'db.js'))
const { readModuleImportState, commitModulePlanificationImport } = require(
  join(output, base, 'setup/modulePlanificationImportRepository.js')
)

after(async () => {
  await maProfessorDb.delete()
  dom.window.close()
  rmSync(output, { recursive: true, force: true })

  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor)
  } else {
    delete globalThis.navigator
  }
})

const timestamp = '2026-09-01T00:00:00.000Z'

async function seed() {
  await maProfessorDb.delete()
  await maProfessorDb.open()

  const audit = {
    createdAt: timestamp,
    updatedAt: timestamp,
    active: true,
    academicYearId: 'year'
  }

  await maProfessorDb.academicYears.add({
    id: 'year',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-06-30',
    ...audit
  })
  await maProfessorDb.groups.add({
    id: 'group',
    name: '10.º D',
    courseName: 'TAP',
    ...audit
  })
  await maProfessorDb.subjects.add({
    id: 'subject',
    name: 'Área de Expressões',
    ...audit
  })
  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Área de Expressões · 10.º D',
    ...audit
  })
}

function moduleDocument(overrides = {}) {
  return {
    name: 'planificacao.docx',
    sha256: 'b'.repeat(64),
    subjectLabel: 'Área de Expressões',
    courseLabel: 'TAP',
    gradeLabel: '10.º',
    groupLabel: '10.º D',
    periodMinutes: 50,
    sections: [
      {
        code: '0349',
        name: 'Ambiente, Segurança, Higiene e Saúde no Trabalho',
        durationHours: 25,
        plannedLessons: 30,
        periodLabel: '1.º Período',
        contentsText: 'Conteúdo A\nConteúdo B',
        objectivesText: 'Objetivo 1\nObjetivo 2\nObjetivo 3',
        methodologyText: 'Debate orientado e trabalho de grupo.',
        resourcesText: 'Projetor; fichas de trabalho.',
        evaluationText: 'Observação direta e trabalho prático.',
        sourcePages: [2, 3],
        warnings: [],
        ...overrides
      }
    ]
  }
}

async function request(document) {
  return {
    confirmed: true,
    academicYearId: 'year',
    assignmentIds: ['assignment'],
    expectedFingerprint: (await readModuleImportState()).fingerprint,
    document,
    selections: [
      {
        sectionIndex: 0,
        code: '0349',
        name: document.sections[0].name,
        plannedPeriods: 30,
        reviewed: true
      }
    ]
  }
}

test('new module import creates one lesson item per content and keeps general teaching context out of lesson activity', async () => {
  await seed()
  const document = moduleDocument()

  assert.deepEqual(
    await commitModulePlanificationImport(await request(document)),
    { created: 1, skipped: 0 }
  )

  const planification = (await maProfessorDb.planifications.toArray())[0]
  const items = (await maProfessorDb.planificationItems.toArray())
    .sort((left, right) => left.order - right.order)

  assert.equal(items.length, 2)
  assert.deepEqual(items.map(item => item.content), ['Conteúdo A', 'Conteúdo B'])
  assert.deepEqual(items.map(item => item.suggestedSummary), ['Conteúdo A', 'Conteúdo B'])
  assert.deepEqual(items.map(item => item.objectives), [
    'Objetivo 1',
    'Objetivo 2\nObjetivo 3'
  ])
  assert.ok(items.every(item => item.activity === ''))
  assert.ok(items.every(item => (item.resources ?? '') === ''))
  assert.ok(items.every(item => (item.evaluation ?? '') === ''))
  assert.ok(items.every(item => item.sourceImportKey.startsWith('module-plan-v4:')))

  assert.match(planification.description, /Metodologia\/estratégias:\nDebate orientado e trabalho de grupo\./)
  assert.match(planification.description, /Recursos:\nProjetor; fichas de trabalho\./)
  assert.match(planification.description, /Avaliação:\nObservação direta e trabalho prático\./)
  assert.equal(
    planification.description.split('Debate orientado e trabalho de grupo.').length - 1,
    1
  )
})

test('objective-only source remains usable without inventing methodology as a lesson', async () => {
  await seed()
  const document = moduleDocument({
    contentsText: '',
    objectivesText: 'Objetivo A\nObjetivo B'
  })

  assert.deepEqual(
    await commitModulePlanificationImport(await request(document)),
    { created: 1, skipped: 0 }
  )

  const items = (await maProfessorDb.planificationItems.toArray())
    .sort((left, right) => left.order - right.order)

  assert.deepEqual(items.map(item => item.content), ['Objetivo A', 'Objetivo B'])
  assert.deepEqual(items.map(item => item.objectives), ['', ''])
  assert.ok(items.every(item => item.activity === ''))
})
