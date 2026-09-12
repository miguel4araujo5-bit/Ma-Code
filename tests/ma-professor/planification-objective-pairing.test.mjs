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
    async commitPlanificationImportBatch(input) {
      globalThis.__objectivePairingBatch = structuredClone(input)
      return { results: [] }
    },
    async getPlanificationImportDestinationState() {
      throw new Error('not used')
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

function file() {
  const bytes = new TextEncoder().encode('planificacao')
  return {
    name: 'planificacao.docx',
    async arrayBuffer() {
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      )
    }
  }
}

function row(content, objectives) {
  return {
    section: {
      sourceDocumentName: 'planificacao.docx',
      sourcePages: [1],
      code: '10380',
      name: 'UFCD teste',
      durationHours: 50,
      plannedLessons: 60,
      periodLabel: '1.º período',
      contentsText: content,
      objectivesText: objectives,
      methodologyText: '',
      resourcesText: '',
      evaluationText: '',
      warnings: []
    },
    sectionOrdinal: 1,
    destination: {
      academicYearId: 'year-1',
      teachingAssignmentId: 'assignment-1',
      moduleId: 'module-1',
      code: '10380',
      name: 'UFCD teste',
      label: '12.º D · AE · 10380',
      existingPlanification: 'no',
      stateFingerprint: 'fingerprint-1'
    },
    mode: 'create',
    content,
    objectives,
    activity: '',
    resources: '',
    evaluation: '',
    expectedStateFingerprint: 'fingerprint-1'
  }
}

async function importedItems(content, objectives) {
  globalThis.__objectivePairingBatch = null
  await adapter.commitPlanificationPdfImport(
    file(),
    [row(content, objectives)]
  )
  return globalThis.__objectivePairingBatch.entries[0].items
}

test('objectives pair with contents by position instead of repeating in every item', async () => {
  const items = await importedItems(
    'Tema A\nTema B\nTema C',
    'Objetivo A\nObjetivo B\nObjetivo C'
  )

  assert.deepEqual(
    items.map(item => [item.content, item.objectives]),
    [
      ['Tema A', 'Objetivo A'],
      ['Tema B', 'Objetivo B'],
      ['Tema C', 'Objetivo C']
    ]
  )
})

test('extra objectives stay attached to the last content without being lost', async () => {
  const items = await importedItems(
    'Tema A\nTema B',
    'Objetivo A\nObjetivo B\nObjetivo C\nObjetivo D'
  )

  assert.deepEqual(
    items.map(item => [item.content, item.objectives]),
    [
      ['Tema A', 'Objetivo A'],
      ['Tema B', 'Objetivo B\nObjetivo C\nObjetivo D']
    ]
  )
})

test('fewer objectives do not get repeated across remaining contents', async () => {
  const items = await importedItems(
    'Tema A\nTema B\nTema C',
    'Objetivo A'
  )

  assert.deepEqual(
    items.map(item => [item.content, item.objectives]),
    [
      ['Tema A', 'Objetivo A'],
      ['Tema B', ''],
      ['Tema C', '']
    ]
  )
})

test('objective-only documents create meaningful planification points instead of an empty content item', async () => {
  const items = await importedItems(
    '',
    'Objetivo A\nObjetivo B'
  )

  assert.deepEqual(
    items.map(item => [item.content, item.objectives]),
    [
      ['Objetivo A', ''],
      ['Objetivo B', '']
    ]
  )
})
