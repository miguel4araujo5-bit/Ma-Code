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

const importRepositoryUrl = dataUrl(`
  export const planificationImportRepository = {
    async getPlanificationImportDestinationState() {
      throw new Error('not used')
    },
    async commitPlanificationImportBatch(input) {
      globalThis.__planificationMetadataHarness = structuredClone(input)
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

const runtimeSource = ts.transpileModule(source, {
  fileName: 'planificationPdfImportAdapter.ts',
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022
  }
}).outputText
  .replaceAll("'../planificationImportRepository'", `'${importRepositoryUrl}'`)
  .replaceAll('"../planificationImportRepository"', `"${importRepositoryUrl}"`)
  .replaceAll("'../repository'", `'${repositoryUrl}'`)
  .replaceAll('"../repository"', `"${repositoryUrl}"`)

const adapter = await import(dataUrl(runtimeSource))

function file(name = 'planificacao.docx') {
  const bytes = new TextEncoder().encode('documento')
  return {
    name,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
  }
}

function row(sectionOverrides = {}) {
  return {
    section: {
      sourceDocumentName: 'planificacao.docx',
      sourcePages: [2],
      code: '10380',
      name: 'UFCD teste',
      durationHours: 50,
      plannedLessons: 60,
      periodLabel: '1.º período',
      contentsText: 'Tema A',
      objectivesText: 'Objetivo A',
      methodologyText: '',
      resourcesText: '',
      evaluationText: '',
      warnings: [],
      ...sectionOverrides
    },
    sectionOrdinal: 1,
    destination: {
      academicYearId: 'year',
      teachingAssignmentId: 'assignment',
      moduleId: 'module',
      code: '10380',
      name: 'UFCD teste',
      label: 'Destino',
      existingPlanification: 'no',
      stateFingerprint: 'fingerprint'
    },
    mode: 'create',
    content: 'Tema A',
    objectives: 'Objetivo A',
    activity: 'Debate orientado',
    resources: 'Projetor',
    evaluation: 'Observação direta',
    expectedStateFingerprint: 'fingerprint'
  }
}

test('normal importer preserves period duration and planned lessons as document context', async () => {
  globalThis.__planificationMetadataHarness = null

  await adapter.commitPlanificationPdfImport(
    file(),
    [row()]
  )

  const description = globalThis.__planificationMetadataHarness.entries[0].planification.description

  assert.match(description, /^1\.º período\n/)
  assert.match(description, /Duração no documento: 50 horas\./)
  assert.match(description, /Aulas previstas no documento: 60\./)
  assert.match(description, /Metodologia\/estratégias:\s*Debate orientado/)
  assert.match(description, /Recursos:\s*Projetor/)
  assert.match(description, /Avaliação:\s*Observação direta/)
  assert.doesNotMatch(description, /Duração das aulas no documento|Tempos letivos confirmados/)
})

test('missing optional document metadata is omitted instead of inventing values', async () => {
  globalThis.__planificationMetadataHarness = null

  await adapter.commitPlanificationPdfImport(
    file(),
    [row({
      periodLabel: '   ',
      durationHours: null,
      plannedLessons: null
    })]
  )

  const description = globalThis.__planificationMetadataHarness.entries[0].planification.description

  assert.doesNotMatch(description, /período/i)
  assert.doesNotMatch(description, /Duração no documento/)
  assert.doesNotMatch(description, /Aulas previstas no documento/)
  assert.match(description, /Metodologia\/estratégias:/)
})
