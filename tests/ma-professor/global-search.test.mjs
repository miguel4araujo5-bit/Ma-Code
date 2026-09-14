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

const root = resolve(
  new URL('../..', import.meta.url).pathname
)
const base = 'src/components/ma-professor/'
const cache = join(
  root,
  'node_modules',
  '.cache'
)
mkdirSync(cache, { recursive: true })
const output = mkdtempSync(
  join(cache, 'global-search-')
)
writeFileSync(
  join(output, 'package.json'),
  '{"type":"commonjs"}'
)

const originalWindow = globalThis.window
globalThis.window = {
  indexedDB: globalThis.indexedDB
}

const require = createRequire(import.meta.url)
const compiled = new Set()

function compile(relative) {
  if (compiled.has(relative)) {
    return
  }

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
  mkdirSync(dirname(target), {
    recursive: true
  })
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

    if (existsSync(dependency)) {
      compile(
        dependency.slice(root.length + 1)
      )
    }
  }
}

compile(
  base + 'settings/searchRepository.ts'
)

const {
  maProfessorDb
} = require(
  join(output, base, 'db.js')
)
const {
  searchMAProfessor
} = require(
  join(
    output,
    base,
    'settings/searchRepository.js'
  )
)

const panelSource = readFileSync(
  join(
    root,
    base,
    'settings/SearchSettingsPanel.tsx'
  ),
  'utf8'
)

const audit = {
  createdAt: '2026-09-14T10:00:00.000Z',
  updatedAt: '2026-09-14T10:00:00.000Z'
}

async function seed() {
  await maProfessorDb.delete()
  await maProfessorDb.open()

  await maProfessorDb.academicYears.bulkAdd([
    {
      id: 'year-active',
      name: '2026/2027',
      startDate: '2026-09-01',
      endDate: '2027-08-31',
      active: true,
      setupCompletedAt: null,
      ...audit
    },
    {
      id: 'year-old',
      name: '2025/2026',
      startDate: '2025-09-01',
      endDate: '2026-08-31',
      active: false,
      setupCompletedAt: null,
      ...audit
    }
  ])

  await maProfessorDb.groups.add({
    id: 'group',
    academicYearId: 'year-active',
    name: '11.º E',
    courseName: 'TAP',
    gradeLevel: '11',
    educationType: 'professional',
    active: true,
    ...audit
  })

  await maProfessorDb.subjects.add({
    id: 'subject',
    academicYearId: 'year-active',
    name: 'Área de Expressões',
    shortName: 'AE',
    code: 'AE',
    active: true,
    ...audit
  })

  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    academicYearId: 'year-active',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Área de Expressões · 11.º E',
    active: true,
    ...audit
  })

  await maProfessorDb.modules.add({
    id: 'module',
    academicYearId: 'year-active',
    teachingAssignmentId: 'assignment',
    code: '10385',
    name: 'Laboratório de competências sociais',
    plannedPeriods: 30,
    order: 1,
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2027-06-30',
    active: true,
    ...audit
  })

  await maProfessorDb.students.bulkAdd([
    {
      id: 'student',
      academicYearId: 'year-active',
      groupId: 'group',
      number: '7',
      name: 'Aluno Teste',
      active: true,
      notes: 'Delegado de turma',
      ...audit
    },
    {
      id: 'old-student',
      academicYearId: 'year-old',
      groupId: 'old-group',
      number: '1',
      name: 'Aluno Antigo',
      active: true,
      notes: '',
      ...audit
    }
  ])

  await maProfessorDb.planifications.add({
    id: 'planification',
    academicYearId: 'year-active',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    title: 'Planificação 10385',
    description: 'Plano anual',
    active: true,
    ...audit
  })

  await maProfessorDb.planificationItems.add({
    id: 'plan-item',
    planificationId: 'planification',
    order: 1,
    content: 'Expressão e movimento corporal',
    activity: 'Improvisação em pares',
    objectives: 'Cooperação e comunicação',
    resources: 'Sala ampla',
    evaluation: 'Observação direta',
    suggestedSummary: 'Trabalho de expressão corporal',
    status: 'planned',
    usedLessonId: null,
    usedAt: null,
    ...audit
  })

  await maProfessorDb.lessons.add({
    id: 'lesson',
    academicYearId: 'year-active',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    scheduleSlotId: null,
    origin: 'scheduled',
    status: 'taught',
    date: '2026-09-14',
    startTime: '10:00',
    endTime: '10:50',
    periodCount: 1,
    countTowardProgress: true,
    plannedActivity: 'Exercício prático',
    summary: 'Comunicação não verbal',
    summarySource: 'manual',
    planificationItemIds: [],
    giaeStatus: 'submitted',
    giaeSubmittedAt: '2026-09-14T11:00:00.000Z',
    notes: '',
    ...audit
  })

  await maProfessorDb.lessonAssessments.add({
    id: 'assessment',
    academicYearId: 'year-active',
    lessonId: 'lesson',
    teachingAssignmentId: 'assignment',
    moduleId: 'module',
    criterionId: 'criterion',
    title: 'Trabalho prático',
    activityType: 'practical_work',
    description: 'Avaliação da comunicação não verbal',
    absentScore: 0,
    exemptScore: 10,
    ...audit
  })

  await maProfessorDb.assessmentResults.add({
    id: 'assessment-result',
    assessmentId: 'assessment',
    studentId: 'student',
    status: 'evaluated',
    score: 17,
    note: 'Boa prestação',
    ...audit
  })
}

after(async () => {
  await maProfessorDb.delete()
  rmSync(output, {
    recursive: true,
    force: true
  })

  if (originalWindow === undefined) {
    delete globalThis.window
  } else {
    globalThis.window = originalWindow
  }
})

test(
  'global search finds planification item contents with words in any order',
  async () => {
    await seed()

    const results = await searchMAProfessor({
      query: 'corporal expressão',
      academicYearId: 'year-active',
      kind: 'planification'
    })

    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'planification:planification')
    assert.match(results[0].detail, /movimento corporal/i)
  }
)

test(
  'global search exposes individual assessment results as classifications',
  async () => {
    await seed()

    const results = await searchMAProfessor({
      query: 'teste 17',
      academicYearId: 'year-active',
      kind: 'grade'
    })

    assert.equal(results.length, 1)
    assert.equal(
      results[0].id,
      'grade-result:assessment-result'
    )
    assert.match(results[0].title, /17 valores/i)
    assert.match(results[0].subtitle, /Trabalho prático/i)
  }
)

test(
  'UFCD is a searchable synonym even when the module name omits the word',
  async () => {
    await seed()

    const results = await searchMAProfessor({
      query: 'UFCD 10385',
      academicYearId: 'year-active',
      kind: 'module'
    })

    assert.equal(results.length, 1)
    assert.equal(results[0].id, 'module:module')
  }
)

test(
  'missing academicYearId falls back to the active academic year',
  async () => {
    await seed()

    const active = await searchMAProfessor({
      query: 'Aluno Teste',
      kind: 'student'
    })
    const old = await searchMAProfessor({
      query: 'Aluno Antigo',
      kind: 'student'
    })

    assert.equal(active.length, 1)
    assert.equal(old.length, 0)
  }
)

test(
  'search panel loads active-year records immediately instead of starting empty',
  () => {
    assert.match(
      panelSource,
      /searchMAProfessor\(\{[\s\S]*query: ''[\s\S]*kind: 'all'/
    )
    assert.match(
      panelSource,
      /Sem filtros,[\s\S]*mostrados automaticamente os registos mais recentes/
    )
  }
)
