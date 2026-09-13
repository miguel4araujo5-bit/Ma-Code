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
import 'fake-indexeddb/auto'

const root = resolve(
  new URL('../..', import.meta.url).pathname
)
const base =
  'src/components/ma-professor/'

const parserSource = readFileSync(
  join(
    root,
    base,
    'setup/regularAnnualPlanificationSpreadsheetDocument.ts'
  ),
  'utf8'
)
const documentSource = readFileSync(
  join(
    root,
    base,
    'setup/planificationModuleDocument.ts'
  ),
  'utf8'
)
const repositorySource = readFileSync(
  join(
    root,
    base,
    'setup/regularAnnualPlanificationImportRepository.ts'
  ),
  'utf8'
)
const panelSource = readFileSync(
  join(
    root,
    base,
    'setup/RegularAnnualPlanificationImportPanel.tsx'
  ),
  'utf8'
)
const wrapperSource = readFileSync(
  join(
    root,
    base,
    'setup/ModulePlanificationImportPanel.tsx'
  ),
  'utf8'
)
const legacySource = readFileSync(
  join(
    root,
    base,
    'setup/ModulePlanificationImportPanelLegacy.tsx'
  ),
  'utf8'
)

const parserRuntime = ts.transpileModule(
  parserSource,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext
    }
  }
).outputText

const parser = await import(
  `data:text/javascript;base64,${Buffer.from(
    parserRuntime
  ).toString('base64')}`
)

test(
  'regular annual Excel grid is parsed without inventing a curricular-unit code',
  () => {
    const result =
      parser.parseRegularAnnualPlanificationSpreadsheetRows(
        [
          [
            'PLANIFICAÇÃO DE Teatro — 5.º ANO'
          ],
          [
            'Período Letivo',
            'Temas/Conteúdos',
            'Objetivos/Competências',
            'Estratégias/Metodologias',
            'Aulas previstas'
          ],
          [
            '1.º Período',
            'Respiração e projeção vocal',
            'Projetar a voz com clareza',
            'Exercícios práticos',
            12
          ],
          [
            '2.º Período',
            'Construção de personagem',
            'Criar uma personagem coerente',
            'Improvisação orientada',
            14
          ]
        ],
        'teatro-5A.xlsx',
        'Planificação'
      )

    assert.equal(
      result.sections.length,
      1
    )
    assert.equal(
      result.sections[0].code,
      ''
    )
    assert.equal(
      result.sections[0].name,
      ''
    )
    assert.equal(
      result.sections[0].plannedLessons,
      26
    )
    assert.match(
      result.sections[0].contentsText,
      /Respiração e projeção vocal/
    )
    assert.match(
      result.sections[0].contentsText,
      /Construção de personagem/
    )
    assert.match(
      result.sections[0].objectivesText,
      /Projetar a voz com clareza/
    )
    assert.match(
      result.sections[0].warnings.join(' '),
      /Componente anual/
    )
  }
)

test(
  'UFCD or module evidence is never silently reclassified as an annual regular planification',
  () => {
    const result =
      parser.parseRegularAnnualPlanificationSpreadsheetRows(
        [
          [
            'Período Letivo',
            'Temas/Conteúdos',
            'Objetivos/Competências',
            'Aulas previstas'
          ],
          [
            '1.º Período',
            'UFCD 10383 — conteúdo',
            'Objetivo',
            20
          ]
        ],
        'ambiguo.xlsx',
        'Planificação'
      )

    assert.equal(
      result.sections.length,
      0
    )
    assert.match(
      result.warnings.join(' '),
      /UFCD\/módulo/
    )
  }
)

test(
  'document reader falls back to annual Excel only after the coded Excel parser finds no curricular units',
  () => {
    assert.match(
      documentSource,
      /failure\.message !==\s*'Não foram encontradas UFCD ou módulos estruturados nas folhas deste Excel\.'/
    )
    assert.match(
      documentSource,
      /extractRegularAnnualPlanificationSpreadsheet/
    )
    assert.match(
      documentSource,
      /importKind:\s*'regular_annual'/
    )
    assert.match(
      documentSource,
      /importKind:\s*'curricular_units'/
    )
  }
)

const cache = join(
  root,
  'node_modules',
  '.cache'
)
mkdirSync(
  cache,
  { recursive: true }
)
const output = mkdtempSync(
  join(
    cache,
    'regular-annual-plan-import-'
  )
)
writeFileSync(
  join(output, 'package.json'),
  '{"type":"commonjs"}'
)
const require =
  createRequire(import.meta.url)
const compiled =
  new Set()

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
    relative.replace(
      /\.tsx?$/,
      '.js'
    )
  )
  mkdirSync(
    dirname(target),
    { recursive: true }
  )
  writeFileSync(
    target,
    code
  )

  for (const match of code.matchAll(
    /require\(["'](\.[^"']+)["']\)/g
  )) {
    const dependencyBase = resolve(
      dirname(
        join(root, relative)
      ),
      match[1]
    )
    const dependency =
      existsSync(
        dependencyBase + '.ts'
      )
        ? dependencyBase + '.ts'
        : dependencyBase + '.tsx'

    if (existsSync(dependency)) {
      compile(
        dependency.slice(
          root.length + 1
        )
      )
    }
  }
}

compile(
  base +
  'setup/regularAnnualPlanificationImportRepository.ts'
)

const { maProfessorDb } = require(
  join(
    output,
    base,
    'db.js'
  )
)
const {
  commitRegularAnnualPlanificationImport,
  readRegularAnnualPlanificationImportState
} = require(
  join(
    output,
    base,
    'setup/regularAnnualPlanificationImportRepository.js'
  )
)

const audit = {
  createdAt:
    '2026-09-01T00:00:00.000Z',
  updatedAt:
    '2026-09-01T00:00:00.000Z'
}

async function seed(
  educationType = 'regular'
) {
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
    id: 'group',
    academicYearId: 'year',
    name: '5.º A',
    courseName: '',
    gradeLevel: '5',
    educationType,
    active: true,
    ...audit
  })
  await maProfessorDb.subjects.add({
    id: 'subject',
    academicYearId: 'year',
    name: 'Teatro',
    shortName: 'TEA',
    code: '',
    active: true,
    ...audit
  })
  await maProfessorDb.teachingAssignments.add({
    id: 'assignment',
    academicYearId: 'year',
    groupId: 'group',
    subjectId: 'subject',
    displayName: 'Teatro · 5.º A',
    active: true,
    ...audit
  })
  await maProfessorDb.modules.add({
    id: 'annual',
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    code: '',
    name: 'Componente anual',
    plannedPeriods: 87,
    order: 1,
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2027-06-30',
    regularAnnual: true,
    active: true,
    ...audit
  })
}

function annualDocument() {
  return {
    name: 'teatro-5A.xlsx',
    sha256: 'a'.repeat(64),
    subjectLabel: 'Teatro',
    courseLabel: '',
    gradeLabel: '5.º ano',
    groupLabel: '5.º A',
    periodMinutes: null,
    importKind: 'regular_annual',
    warnings: [],
    sections: [{
      sourceDocumentName:
        'teatro-5A.xlsx',
      sourcePages: [],
      code: '',
      name: '',
      durationHours: null,
      plannedLessons: 90,
      periodLabel:
        '1.º Período\n2.º Período',
      contentsText:
        'Respiração\nConstrução de personagem',
      objectivesText:
        'Projetar a voz\nCriar personagem',
      methodologyText:
        'Exercícios práticos',
      resourcesText:
        'Sala ampla',
      evaluationText:
        'Observação direta',
      warnings: []
    }]
  }
}

async function request() {
  return {
    confirmed: true,
    academicYearId: 'year',
    assignmentIds: ['assignment'],
    expectedFingerprint:
      (
        await readRegularAnnualPlanificationImportState()
      ).fingerprint,
    document: annualDocument(),
    selections: [{
      sectionIndex: 0,
      code: '',
      name: 'Componente anual',
      plannedPeriods: 87,
      reviewed: true
    }]
  }
}

after(async () => {
  await maProfessorDb.delete()
  rmSync(
    output,
    {
      recursive: true,
      force: true
    }
  )
})

test(
  'annual import attaches only planification data and preserves schedule-derived module identity and capacity',
  async () => {
    await seed()
    const beforeModule =
      await maProfessorDb.modules.get(
        'annual'
      )

    assert.deepEqual(
      await commitRegularAnnualPlanificationImport(
        await request()
      ),
      {
        attached: 1,
        skipped: 0
      }
    )

    const afterModule =
      await maProfessorDb.modules.get(
        'annual'
      )

    assert.equal(
      await maProfessorDb.modules.count(),
      1
    )
    assert.equal(
      afterModule.code,
      ''
    )
    assert.equal(
      afterModule.name,
      'Componente anual'
    )
    assert.equal(
      afterModule.plannedPeriods,
      87
    )
    assert.equal(
      afterModule.updatedAt,
      beforeModule.updatedAt
    )
    assert.equal(
      await maProfessorDb.planifications.count(),
      1
    )

    const items =
      await maProfessorDb.planificationItems.toArray()
    assert.equal(
      items.length,
      2
    )
    assert.deepEqual(
      items.map(item =>
        item.suggestedSummary
      ),
      [
        'Respiração',
        'Construção de personagem'
      ]
    )
    assert.ok(
      items.every(item =>
        item.sourceImportKey.startsWith(
          'regular-plan-v1:'
        )
      )
    )

    assert.deepEqual(
      await commitRegularAnnualPlanificationImport(
        await request()
      ),
      {
        attached: 0,
        skipped: 1
      }
    )
    assert.equal(
      await maProfessorDb.planifications.count(),
      1
    )
    assert.equal(
      await maProfessorDb.planificationItems.count(),
      2
    )
  }
)

test(
  'annual import refuses a professional destination even if a module is incorrectly flagged annual',
  async () => {
    await seed('professional')

    await assert.rejects(
      commitRegularAnnualPlanificationImport(
        await request()
      ),
      /ensino regular/
    )

    assert.equal(
      await maProfessorDb.planifications.count(),
      0
    )
    assert.equal(
      await maProfessorDb.planificationItems.count(),
      0
    )
    assert.equal(
      (
        await maProfessorDb.modules.get(
          'annual'
        )
      ).plannedPeriods,
      87
    )
  }
)

test(
  'annual UI is additive while the existing curricular importer remains preserved',
  () => {
    assert.match(
      wrapperSource,
      /ModulePlanificationImportPanelLegacy/
    )
    assert.match(
      wrapperSource,
      /RegularAnnualPlanificationImportPanel/
    )
    assert.match(
      panelSource,
      /accept="\.xlsx,\.xlsm,\.xls"/
    )
    assert.match(
      panelSource,
      /commitRegularAnnualPlanificationImport/
    )
    assert.match(
      panelSource,
      /A carga oficial permanece a calculada pelo horário/
    )
    assert.match(
      legacySource,
      /commitModulePlanificationImport/
    )
    assert.match(
      legacySource,
      /samePlanificationModuleCode\(module\.code,\s*row\.code\)/
    )
  }
)

test(
  'regular annual planification import stays local and adds no Cloudflare path',
  () => {
    for (const source of [
      parserSource,
      repositorySource,
      panelSource
    ]) {
      assert.doesNotMatch(
        source,
        /fetch\(|Durable Object|snapshotApi|wrangler|workers ai|cloudflare/i
      )
    }

    assert.match(
      repositorySource,
      /group\.educationType !==\s*'regular'/
    )
    assert.match(
      repositorySource,
      /module\.regularAnnual ===\s*true/
    )
  }
)
