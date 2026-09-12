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

function transpile(value, filename) {
  return ts.transpileModule(value, {
    fileName: filename,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    }
  }).outputText
}

test('normal importer stores methodology resources and evaluation as planification context instead of repeating them in every item', async () => {
  const source = await readFile(
    new URL(
      '../../src/components/ma-professor/planifications/planificationPdfImportAdapter.ts',
      import.meta.url
    ),
    'utf8'
  )

  globalThis.__generalContextAdapterHarness = { commits: [] }

  const importRepositoryUrl = dataUrl(`
    export const planificationImportRepository = {
      async commitPlanificationImportBatch(input) {
        globalThis.__generalContextAdapterHarness.commits.push(structuredClone(input))
        return { results: input.entries.map(entry => ({ moduleId: entry.moduleId, action: entry.mode === 'create' ? 'created' : 'appended' })) }
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

  const runtimeSource = transpile(source, 'planificationPdfImportAdapter.ts')
    .replaceAll("'../planificationImportRepository'", `'${importRepositoryUrl}'`)
    .replaceAll('"../planificationImportRepository"', `"${importRepositoryUrl}"`)
    .replaceAll("'../repository'", `'${repositoryUrl}'`)
    .replaceAll('"../repository"', `"${repositoryUrl}"`)

  const adapter = await import(dataUrl(runtimeSource))
  const bytes = new TextEncoder().encode('documento')
  const file = {
    name: 'planificacao.docx',
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    }
  }

  await adapter.commitPlanificationPdfImport(file, [{
    section: {
      sourceDocumentName: file.name,
      sourcePages: [2],
      code: '10380',
      name: 'UFCD teste',
      durationHours: 50,
      plannedLessons: 60,
      periodLabel: '1.º período',
      contentsText: 'Tema A\nTema B',
      objectivesText: 'Objetivo geral',
      methodologyText: 'Metodologia origem',
      resourcesText: 'Recurso origem',
      evaluationText: 'Avaliação origem',
      warnings: []
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
    content: 'Tema A\nTema B',
    objectives: 'Objetivo geral',
    activity: 'Debate orientado',
    resources: 'Projetor\nVídeo',
    evaluation: 'Observação direta',
    expectedStateFingerprint: 'fingerprint'
  }])

  const entry = globalThis.__generalContextAdapterHarness.commits[0].entries[0]

  assert.match(entry.planification.description, /Metodologia\/estratégias:\s*Debate orientado/)
  assert.match(entry.planification.description, /Recursos:\s*Projetor/)
  assert.match(entry.planification.description, /Avaliação:\s*Observação direta/)
  assert.deepEqual(entry.items.map(item => item.content), ['Tema A', 'Tema B'])
  assert.ok(entry.items.every(item => item.activity === ''))
  assert.ok(entry.items.every(item => item.resources === ''))
  assert.ok(entry.items.every(item => item.evaluation === ''))
})

test('append preserves the existing description, adds new general context once and leaves historical items untouched', async () => {
  const source = await readFile(
    new URL(
      '../../src/components/ma-professor/planificationImportRepository.ts',
      import.meta.url
    ),
    'utf8'
  )

  const initial = {
    academicYears: [{ id: 'year', active: true }],
    teachingAssignments: [{ id: 'assignment', academicYearId: 'year', active: true }],
    modules: [{ id: 'module', academicYearId: 'year', teachingAssignmentId: 'assignment', active: true }],
    planifications: [{
      id: 'plan-existing',
      academicYearId: 'year',
      teachingAssignmentId: 'assignment',
      moduleId: 'module',
      title: 'Planificação existente',
      description: 'Descrição existente do professor.',
      active: true,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z'
    }],
    planificationItems: [{
      id: 'historical',
      planificationId: 'plan-existing',
      order: 1,
      content: 'Conteúdo já dado',
      activity: '',
      objectives: '',
      suggestedSummary: 'Conteúdo já dado',
      status: 'used',
      usedLessonId: 'lesson-1',
      usedAt: '2026-09-02T10:00:00.000Z',
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-02T10:00:00.000Z'
    }]
  }

  globalThis.__generalContextRepositoryState = structuredClone(initial)

  const dbUrl = dataUrl(`
    const clone = value => structuredClone(value)
    const state = () => globalThis.__generalContextRepositoryState
    const rows = name => state()[name]
    class Table {
      constructor(name) { this.name = name }
      async get(id) {
        const value = rows(this.name).find(item => item.id === id)
        return value ? clone(value) : undefined
      }
      async add(record) {
        rows(this.name).push(clone(record))
        return record.id
      }
      async put(record) {
        const index = rows(this.name).findIndex(item => item.id === record.id)
        if (index < 0) rows(this.name).push(clone(record))
        else rows(this.name)[index] = clone(record)
        return record.id
      }
      async bulkAdd(records) {
        for (const record of records) await this.add(record)
      }
      where(field) {
        return {
          equals: value => ({
            toArray: async () => clone(rows(this.name).filter(item => item[field] === value))
          })
        }
      }
    }
    export const maProfessorDb = {
      academicYears: new Table('academicYears'),
      teachingAssignments: new Table('teachingAssignments'),
      modules: new Table('modules'),
      planifications: new Table('planifications'),
      planificationItems: new Table('planificationItems'),
      async transaction(mode, ...args) {
        const callback = args.at(-1)
        const before = clone(state())
        try { return await callback() }
        catch (error) {
          globalThis.__generalContextRepositoryState = before
          throw error
        }
      }
    }
    export async function openMAProfessorDatabase() {}
  `)

  const dashboardUrl = dataUrl(`
    export function markDashboardDataDirty() {}
  `)

  const runtimeSource = transpile(source, 'planificationImportRepository.ts')
    .replaceAll("'./db'", `'${dbUrl}'`)
    .replaceAll('"./db"', `"${dbUrl}"`)
    .replaceAll("'./dashboard/dashboardRefreshSignal'", `'${dashboardUrl}'`)
    .replaceAll('"./dashboard/dashboardRefreshSignal"', `"${dashboardUrl}"`)

  const repositoryModule = await import(dataUrl(runtimeSource))
  const repository = new repositoryModule.PlanificationImportRepository()
  const preview = await repository.getPlanificationImportDestinationState({
    academicYearId: 'year',
    teachingAssignmentId: 'assignment',
    moduleId: 'module'
  })

  const description = [
    'Metodologia/estratégias:',
    'Debate orientado',
    'Recursos:',
    'Projetor',
    'Avaliação:',
    'Observação direta'
  ].join('\n')

  const input = {
    confirmed: true,
    document: { name: 'planificacao.docx', sha256: 'a'.repeat(64) },
    entries: [{
      academicYearId: 'year',
      teachingAssignmentId: 'assignment',
      moduleId: 'module',
      mode: 'append',
      expectedStateFingerprint: preview.stateFingerprint,
      source: { pages: [2], sectionOrdinal: 1 },
      planification: { title: 'Importada', description },
      items: [{
        content: 'Novo conteúdo',
        objectives: 'Novo objetivo',
        activity: '',
        resources: '',
        evaluation: '',
        suggestedSummary: '',
        sourcePages: [2]
      }]
    }]
  }

  const historicalBefore = structuredClone(initial.planificationItems[0])
  const first = await repository.commitPlanificationImportBatch(input)
  assert.equal(first.results[0].action, 'appended')

  const afterFirst = structuredClone(globalThis.__generalContextRepositoryState)
  assert.deepEqual(afterFirst.planificationItems[0], historicalBefore)
  assert.equal(afterFirst.planificationItems.length, 2)
  assert.equal(afterFirst.planificationItems[1].activity, '')
  assert.equal(afterFirst.planificationItems[1].resources, undefined)
  assert.equal(afterFirst.planificationItems[1].evaluation, undefined)
  assert.match(afterFirst.planifications[0].description, /Descrição existente do professor\./)
  assert.match(afterFirst.planifications[0].description, /Metodologia\/estratégias:/)
  assert.match(afterFirst.planifications[0].description, /Debate orientado/)
  assert.match(afterFirst.planifications[0].description, /Recursos:/)
  assert.match(afterFirst.planifications[0].description, /Avaliação:/)

  const second = await repository.commitPlanificationImportBatch(input)
  assert.equal(second.results[0].action, 'alreadyImported')
  assert.equal(
    globalThis.__generalContextRepositoryState.planifications[0].description,
    afterFirst.planifications[0].description
  )
})
