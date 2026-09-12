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
import {
  dirname,
  join,
  resolve
} from 'node:path'
import test, { after } from 'node:test'
import ts from 'typescript'
import { JSDOM } from 'jsdom'
import 'fake-indexeddb/auto'

const root = resolve(
  new URL('../..', import.meta.url).pathname
)
const cache = join(
  root,
  'node_modules',
  '.cache'
)
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(
  join(cache, 'module-existing-plan-')
)
writeFileSync(
  join(output, 'package.json'),
  '{"type":"commonjs"}'
)
const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) return
  compiled.add(relative)

  const source = readFileSync(
    join(root, relative),
    'utf8'
  )
  const code = ts.transpileModule(
    source,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX
      }
    }
  ).outputText
  const target = join(
    output,
    relative.replace(/\.tsx?$/, '.js')
  )

  mkdirSync(
    dirname(target),
    { recursive: true }
  )
  writeFileSync(target, code)

  for (
    const match of code.matchAll(
      /require\(["'](\.[^"']+)["']\)/g
    )
  ) {
    const dependencyBase = resolve(
      dirname(join(root, relative)),
      match[1]
    )
    const dependency =
      existsSync(dependencyBase + '.ts')
        ? dependencyBase + '.ts'
        : dependencyBase + '.tsx'

    compile(
      dependency.slice(root.length + 1)
    )
  }
}

const base = 'src/components/ma-professor/'
compile(
  base +
    'setup/modulePlanificationImportRepository.ts'
)

const dom = new JSDOM('', {
  url: 'https://example.test'
})
const originalNavigatorDescriptor =
  Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  )

globalThis.window = dom.window
Object.defineProperty(
  globalThis,
  'navigator',
  {
    configurable: true,
    value: dom.window.navigator
  }
)
Object.defineProperty(
  window,
  'indexedDB',
  { value: globalThis.indexedDB }
)
globalThis.CustomEvent =
  dom.window.CustomEvent

const { maProfessorDb } = require(
  join(output, base, 'db.js')
)
const {
  readModuleImportState,
  commitModulePlanificationImport
} = require(
  join(
    output,
    base,
    'setup/modulePlanificationImportRepository.js'
  )
)

after(async () => {
  await maProfessorDb.delete()
  dom.window.close()
  rmSync(
    output,
    {
      recursive: true,
      force: true
    }
  )

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

const timestamp = '2026-01-01T00:00:00.000Z'
const document = {
  name: 'planificacao.docx',
  sha256: 'a'.repeat(64),
  subjectLabel: 'Disciplina de teste',
  courseLabel: '',
  gradeLabel: '',
  groupLabel: '',
  periodMinutes: 50,
  sections: [
    {
      code: '0349',
      name: 'Módulo importado',
      durationHours: 25,
      plannedLessons: 30,
      periodLabel: '1.º Período',
      contentsText:
        'Conteúdo 1\nConteúdo 2',
      objectivesText:
        'Objetivo 1',
      methodologyText:
        'Metodologia geral',
      resourcesText:
        'Manual',
      evaluationText:
        'Observação',
      sourcePages: [1]
    }
  ]
}

async function seedExistingModule() {
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
    name: '10.º A',
    courseName: '',
    ...audit
  })
  await maProfessorDb.subjects.add({
    id: 'subject',
    name: 'Disciplina de teste',
    ...audit
  })
  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Disciplina de teste · 10.º A',
    ...audit
  })
  await maProfessorDb.modules.add({
    id: 'existing-module',
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    code: '0349',
    name: 'Nome já confirmado',
    plannedPeriods: 28,
    order: 1,
    plannedStartDate: null,
    plannedEndDate: null,
    active: true,
    createdAt: timestamp,
    updatedAt: timestamp
  })
}

async function request() {
  return {
    confirmed: true,
    academicYearId: 'year',
    assignmentIds: ['assignment'],
    expectedFingerprint:
      (await readModuleImportState()).fingerprint,
    document,
    selections: [
      {
        sectionIndex: 0,
        code: '0349',
        name: 'Módulo importado',
        plannedPeriods: 30,
        reviewed: true
      }
    ]
  }
}

test(
  'existing module without an active planification receives the imported planification without changing or duplicating the module',
  async () => {
    await seedExistingModule()

    const beforeModule =
      await maProfessorDb.modules.get(
        'existing-module'
      )

    assert.deepEqual(
      await commitModulePlanificationImport(
        await request()
      ),
      {
        created: 0,
        skipped: 0,
        attached: 1
      }
    )

    assert.equal(
      await maProfessorDb.modules.count(),
      1
    )
    assert.deepEqual(
      await maProfessorDb.modules.get(
        'existing-module'
      ),
      beforeModule
    )

    const plans =
      await maProfessorDb.planifications
        .where('moduleId')
        .equals('existing-module')
        .toArray()

    assert.equal(
      plans.filter(plan => plan.active).length,
      1
    )
    assert.match(
      plans[0].title,
      /0349/
    )
    assert.match(
      plans[0].title,
      /Nome já confirmado/
    )

    const items =
      await maProfessorDb.planificationItems
        .where('planificationId')
        .equals(plans[0].id)
        .toArray()

    assert.equal(items.length, 3)
    assert.deepEqual(
      items
        .sort(
          (left, right) =>
            left.order - right.order
        )
        .map(item => item.suggestedSummary),
      [
        'Conteúdo 1',
        'Objetivo 1',
        'Conteúdo 2'
      ]
    )

    assert.deepEqual(
      await commitModulePlanificationImport(
        await request()
      ),
      {
        created: 0,
        skipped: 1
      }
    )
    assert.equal(
      await maProfessorDb.planifications
        .where('moduleId')
        .equals('existing-module')
        .count(),
      1
    )
  }
)

test(
  'existing active planification is preserved and never replaced automatically',
  async () => {
    await seedExistingModule()

    await maProfessorDb.planifications.add({
      id: 'teacher-plan',
      academicYearId: 'year',
      teachingAssignmentId: 'assignment',
      moduleId: 'existing-module',
      title: 'Planificação do professor',
      description: 'Manter',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    await maProfessorDb.planificationItems.add({
      id: 'teacher-item',
      planificationId: 'teacher-plan',
      order: 1,
      content: 'Conteúdo do professor',
      objectives: '',
      activity: '',
      resources: '',
      evaluation: '',
      suggestedSummary:
        'Conteúdo do professor',
      status: 'planned',
      usedLessonId: null,
      usedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })

    assert.deepEqual(
      await commitModulePlanificationImport(
        await request()
      ),
      {
        created: 0,
        skipped: 1
      }
    )

    assert.equal(
      await maProfessorDb.planifications.count(),
      1
    )
    assert.equal(
      await maProfessorDb.planificationItems.count(),
      1
    )
    assert.equal(
      (
        await maProfessorDb.planifications.get(
          'teacher-plan'
        )
      ).description,
      'Manter'
    )
    assert.equal(
      (
        await maProfessorDb.planificationItems.get(
          'teacher-item'
        )
      ).content,
      'Conteúdo do professor'
    )
  }
)
