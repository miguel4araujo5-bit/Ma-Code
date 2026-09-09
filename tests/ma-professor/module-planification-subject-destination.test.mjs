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
import 'fake-indexeddb/auto'

const root = resolve(new URL('../..', import.meta.url).pathname)
const cache = join(root, 'node_modules', '.cache')
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(join(cache, 'module-subject-destination-'))
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

    if (existsSync(dependency)) {
      compile(dependency.slice(root.length + 1))
    }
  }
}

const base = 'src/components/ma-professor/'
compile(base + 'setup/modulePlanificationImportRepository.ts')
const { maProfessorDb } = require(join(output, base, 'db.js'))
const {
  commitModulePlanificationImport,
  readModuleImportState
} = require(join(output, base, 'setup/modulePlanificationImportRepository.js'))

const audit = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}

const sourceDocument = {
  name: 'planificacao-area-expressoes.pdf',
  sha256: 'a'.repeat(64),
  subjectLabel: 'Área de Expressões',
  courseLabel: 'Técnico de Apoio Psicossocial',
  periodMinutes: 50,
  warnings: [],
  sections: [
    {
      sourceDocumentName: 'planificacao-area-expressoes.pdf',
      sourcePages: [1, 2],
      code: '10388',
      name: 'Fundamentos do desenvolvimento saudável',
      durationHours: 50,
      plannedLessons: 60,
      periodLabel: '1.º período',
      contentsText: 'Causas e consequências\nAlimentação\nNutrição',
      objectivesText: 'Definir os âmbitos e limites.',
      methodologyText: 'Expositivo e interrogativo.',
      resourcesText: '',
      evaluationText: '',
      warnings: []
    }
  ]
}

async function seed({ includeCorrectSubject = false } = {}) {
  await maProfessorDb.delete()
  await maProfessorDb.open()

  await maProfessorDb.academicYears.add({
    id: 'year',
    name: '2026/2027',
    startDate: '2026-09-01',
    endDate: '2027-08-31',
    active: true,
    setupCompletedAt: null,
    ...audit
  })

  await maProfessorDb.groups.add({
    id: 'g1',
    academicYearId: 'year',
    name: '12.º E',
    courseName: '',
    gradeLevel: '12',
    active: true,
    ...audit
  })

  await maProfessorDb.subjects.add({
    id: 'bad-ap',
    academicYearId: 'year',
    name: 'AP',
    shortName: 'AP',
    code: '',
    active: true,
    ...audit
  })

  if (includeCorrectSubject) {
    await maProfessorDb.subjects.add({
      id: 'area-expressoes',
      academicYearId: 'year',
      name: 'Área de Expressões',
      shortName: 'AE',
      code: '',
      active: true,
      ...audit
    })
  }
}

async function editableRequest() {
  return {
    confirmed: true,
    academicYearId: 'year',
    subjectName: 'Área de Expressões',
    groupIds: ['g1'],
    courseName: 'Técnico de Apoio Psicossocial',
    expectedFingerprint: (await readModuleImportState()).fingerprint,
    document: sourceDocument,
    selections: [
      {
        sectionIndex: 0,
        code: '10388',
        name: 'Fundamentos do desenvolvimento saudável',
        plannedPeriods: 60,
        reviewed: true
      }
    ]
  }
}

after(async () => {
  await maProfessorDb.delete()
  rmSync(output, { recursive: true, force: true })
})

test('editable destination ignores an unrelated AP subject and creates Área de Expressões atomically', async () => {
  await seed()

  assert.deepEqual(
    await commitModulePlanificationImport(await editableRequest()),
    { created: 1, skipped: 0 }
  )

  const subjects = await maProfessorDb.subjects.toArray()
  assert.equal(subjects.filter(subject => subject.name === 'AP').length, 1)
  assert.equal(subjects.filter(subject => subject.name === 'Área de Expressões').length, 1)

  const area = subjects.find(subject => subject.name === 'Área de Expressões')
  const assignments = await maProfessorDb.teachingAssignments.toArray()
  assert.equal(assignments.length, 1)
  assert.equal(assignments[0].subjectId, area.id)
  assert.equal(assignments[0].groupId, 'g1')

  const modules = await maProfessorDb.modules.toArray()
  assert.equal(modules.length, 1)
  assert.equal(modules[0].teachingAssignmentId, assignments[0].id)
  assert.equal(modules[0].code, '10388')
  assert.equal((await maProfessorDb.groups.get('g1')).courseName, 'Técnico de Apoio Psicossocial')
})

test('editable destination reuses the exact existing subject instead of creating a duplicate', async () => {
  await seed({ includeCorrectSubject: true })

  await commitModulePlanificationImport(await editableRequest())

  const subjects = await maProfessorDb.subjects.toArray()
  assert.equal(subjects.filter(subject => subject.name === 'Área de Expressões').length, 1)
  const assignment = (await maProfessorDb.teachingAssignments.toArray())[0]
  assert.equal(assignment.subjectId, 'area-expressoes')
})

test('failure while writing the planification rolls back a newly created subject, assignment and course correction', async () => {
  await seed()
  const fail = () => { throw new Error('injected write failure') }
  maProfessorDb.planificationItems.hook('creating', fail)

  try {
    await assert.rejects(
      commitModulePlanificationImport(await editableRequest()),
      /injected write failure/
    )
  } finally {
    maProfessorDb.planificationItems.hook('creating').unsubscribe(fail)
  }

  assert.equal(
    (await maProfessorDb.subjects.toArray())
      .filter(subject => subject.name === 'Área de Expressões').length,
    0
  )
  assert.equal(await maProfessorDb.teachingAssignments.count(), 0)
  assert.equal(await maProfessorDb.modules.count(), 0)
  assert.equal(await maProfessorDb.planifications.count(), 0)
  assert.equal((await maProfessorDb.groups.get('g1')).courseName, '')
})

test('planification import UI exposes an editable subject destination instead of a closed subject select', () => {
  const source = readFileSync(
    join(root, base, 'setup/ModulePlanificationImportPanel.tsx'),
    'utf8'
  )

  assert.match(source, /setSubjectName\(parsed\.subjectLabel\)/)
  assert.match(
    source,
    /Disciplina de destino[\s\S]{0,500}<input[\s\S]{0,400}value=\{subjectName\}/
  )
  assert.doesNotMatch(
    source,
    /Disciplina de destino[\s\S]{0,500}<select/
  )
  assert.match(source, /caso contrário será criada apenas ao confirmar a importação/)
})
