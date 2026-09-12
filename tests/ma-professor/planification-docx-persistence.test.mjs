import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/planificationImportRepository.ts',
    import.meta.url
  ),
  'utf8'
)

function asDataModule(sourceText) {
  return `data:text/javascript;base64,${Buffer.from(
    sourceText,
    'utf8'
  ).toString('base64')}`
}

function transpile(sourceText) {
  const output = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
    item => item.category === ts.DiagnosticCategory.Error
  )

  assert.equal(errors.length, 0)
  return asDataModule(output.outputText)
}

const dbUrl = asDataModule(`
let state

function reset() {
  state = {
    academicYears: [{ id: 'year-1', active: true }],
    teachingAssignments: [{
      id: 'assignment-1',
      academicYearId: 'year-1',
      active: true
    }],
    modules: [{
      id: 'module-1',
      academicYearId: 'year-1',
      teachingAssignmentId: 'assignment-1',
      active: true,
      code: '0349'
    }],
    planifications: [],
    planificationItems: []
  }
}

reset()
const clone = value => structuredClone(value)
const rows = name => state[name]

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
        toArray: async () => clone(
          rows(this.name).filter(item => item[field] === value)
        )
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
    const before = clone(state)
    try {
      return await callback()
    } catch (error) {
      state = before
      throw error
    }
  }
}

export async function openMAProfessorDatabase() {}
export function __reset() { reset() }
export function __snapshot() { return clone(state) }
`)

const dashboardUrl = asDataModule(`
export function markDashboardDataDirty() {}
`)

const repositoryUrl = transpile(
  source
    .replace("from './db'", `from '${dbUrl}'`)
    .replace(
      "from './dashboard/dashboardRefreshSignal'",
      `from '${dashboardUrl}'`
    )
)

const repositoryModule = await import(repositoryUrl)
const dbModule = await import(dbUrl)
const repository = new repositoryModule.PlanificationImportRepository()

async function destinationState() {
  return repository.getPlanificationImportDestinationState({
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1'
  })
}

function entry(fingerprint, pages = []) {
  return {
    academicYearId: 'year-1',
    teachingAssignmentId: 'assignment-1',
    moduleId: 'module-1',
    mode: 'create',
    expectedStateFingerprint: fingerprint,
    source: {
      pages,
      sectionOrdinal: 1
    },
    planification: {
      title: 'Planificação — UFCD 0349',
      description: 'Origem Word'
    },
    items: [{
      content: 'Conteúdo A',
      objectives: 'Objetivo A',
      activity: '',
      resources: '',
      evaluation: '',
      suggestedSummary: '',
      sourcePages: pages
    }]
  }
}

const hash = 'a'.repeat(64)

test('DOCX import persists safely without inventing page numbers and remains idempotent', async () => {
  dbModule.__reset()
  const before = await destinationState()

  const first = await repository.commitPlanificationImportBatch({
    confirmed: true,
    document: {
      name: 'planificacao.docx',
      sha256: hash
    },
    entries: [entry(before.stateFingerprint)]
  })

  assert.equal(first.results[0].action, 'created')

  const afterFirst = dbModule.__snapshot()
  assert.deepEqual(afterFirst.planifications[0].sourcePages, [])
  assert.deepEqual(afterFirst.planificationItems[0].sourcePages, [])
  assert.equal(
    afterFirst.planificationItems[0].sourceDocumentName,
    'planificacao.docx'
  )
  assert.match(
    afterFirst.planificationItems[0].sourceImportKey,
    /^plan-import-v1:[a-f0-9]{64}$/
  )

  const second = await repository.commitPlanificationImportBatch({
    confirmed: true,
    document: {
      name: 'planificacao.docx',
      sha256: hash
    },
    entries: [entry(before.stateFingerprint)]
  })

  assert.equal(second.results[0].action, 'alreadyImported')
  assert.deepEqual(dbModule.__snapshot(), afterFirst)
})

test('PDF import still rejects a missing source page', async () => {
  dbModule.__reset()
  const before = await destinationState()

  await assert.rejects(
    repository.commitPlanificationImportBatch({
      confirmed: true,
      document: {
        name: 'planificacao.pdf',
        sha256: hash
      },
      entries: [entry(before.stateFingerprint)]
    }),
    /pelo menos uma página de origem válida/
  )

  const after = dbModule.__snapshot()
  assert.equal(after.planifications.length, 0)
  assert.equal(after.planificationItems.length, 0)
})
