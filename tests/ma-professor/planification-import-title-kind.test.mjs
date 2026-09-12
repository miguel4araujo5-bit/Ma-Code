import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true
  })
}

function dataUrl(value) {
  return `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`
}

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planifications/planificationPdfImportAdapter.ts',
    import.meta.url
  ),
  'utf8'
)

globalThis.__planificationTitleKindHarness = null

const importRepositoryUrl = dataUrl(`
  export const planificationImportRepository = {
    async getPlanificationImportDestinationState() {
      throw new Error('not used')
    },
    async commitPlanificationImportBatch(input) {
      globalThis.__planificationTitleKindHarness = structuredClone(input)
      return { results: [] }
    }
  }
`)

const repositoryUrl = dataUrl(`
  export const maProfessorRepository = {
    async getSetupSnapshot() {
      throw new Error('not used')
    }
  }
`)

const runtimeSource = ts.transpileModule(
  source,
  {
    fileName: 'planificationPdfImportAdapter.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }
).outputText
  .replaceAll(
    "'../planificationImportRepository'",
    `'${importRepositoryUrl}'`
  )
  .replaceAll(
    '"../planificationImportRepository"',
    `"${importRepositoryUrl}"`
  )
  .replaceAll(
    "'../repository'",
    `'${repositoryUrl}'`
  )
  .replaceAll(
    '"../repository"',
    `"${repositoryUrl}"`
  )

const adapter = await import(dataUrl(runtimeSource))

function section(code, name) {
  return {
    sourceDocumentName: 'planificacao.docx',
    sourcePages: [1],
    code,
    name,
    durationHours: null,
    plannedLessons: null,
    periodLabel: '',
    contentsText: 'Conteúdo',
    objectivesText: '',
    methodologyText: '',
    resourcesText: '',
    evaluationText: '',
    warnings: []
  }
}

function row(code, name, moduleId, sectionOrdinal) {
  return {
    section: section(code, name),
    sectionOrdinal,
    destination: {
      academicYearId: 'year',
      teachingAssignmentId: 'assignment',
      moduleId,
      code,
      name,
      label: `${code} · ${name}`,
      existingPlanification: 'no',
      stateFingerprint: `fingerprint-${moduleId}`
    },
    mode: 'create',
    content: 'Conteúdo',
    objectives: '',
    activity: '',
    resources: '',
    evaluation: '',
    expectedStateFingerprint: `fingerprint-${moduleId}`
  }
}

test('normal planification importer labels numeric codes as UFCD and module-style codes as Módulo', async () => {
  const bytes = new TextEncoder().encode('documento')
  const file = {
    name: 'planificacao.docx',
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      )
    }
  }

  await adapter.commitPlanificationPdfImport(
    file,
    [
      row('10380', 'Expressão dramática', 'ufcd-10380', 1),
      row('M1', 'Comunicação', 'module-m1', 2)
    ]
  )

  const titles = globalThis.__planificationTitleKindHarness.entries.map(
    entry => entry.planification.title
  )

  assert.deepEqual(
    titles,
    [
      'Planificação — UFCD 10380 · Expressão dramática',
      'Planificação — Módulo M1 · Comunicação'
    ]
  )
})
