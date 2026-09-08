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
let state = {
  academicYears: [],
  teachingAssignments: [],
  modules: [],
  planifications: [],
  planificationItems: []
}

function clone(value) {
  return structuredClone(value)
}

function rows(name) {
  return state[name]
}

class Table {
  constructor(name) {
    this.name = name
  }

  async get(id) {
    const value = rows(this.name).find(item => item.id === id)
    return value ? clone(value) : undefined
  }

  async add(record) {
    rows(this.name).push(clone(record))
    return record.id
  }

  async bulkAdd(records) {
    for (const record of records) {
      await this.add(record)
    }
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

export function __reset(next) {
  state = clone(next)
}

export function __snapshot() {
  return clone(state)
}
`)

const dashboardUrl = asDataModule(`
let revision = 0

export function markDashboardDataDirty() {
  revision += 1
  return revision
}

export function getDashboardDataRevision() {
  return revision
}

export function __reset() {
  revision = 0
}
`)

const repositoryUrl = transpile(
  source
    .replace(
      "from './db'",
      `from '${dbUrl}'`
    )
    .replace(
      "from './dashboard/dashboardRefreshSignal'",
      `from '${dashboardUrl}'`
    )
)

const repositoryModule = await import(repositoryUrl)
const dbModule = await import(dbUrl)
const dashboardModule = await import(dashboardUrl)

const repository =
  new repositoryModule.PlanificationImportRepository()

const YEAR_ID = 'year-2026'
const ASSIGNMENT_ID = 'assignment-a'
const MODULE_A = 'module-a'
const MODULE_B = 'module-b'
const PDF_HASH = 'b'.repeat(64)

function baseState() {
  return {
    academicYears: [
      {
        id: YEAR_ID,
        active: true
      }
    ],
    teachingAssignments: [
      {
        id: ASSIGNMENT_ID,
        academicYearId: YEAR_ID,
        active: true
      }
    ],
    modules: [
      {
        id: MODULE_A,
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        active: true
      },
      {
        id: MODULE_B,
        academicYearId: YEAR_ID,
        teachingAssignmentId: ASSIGNMENT_ID,
        active: true
      }
    ],
    planifications: [],
    planificationItems: []
  }
}

function reset() {
  dbModule.__reset(baseState())
  dashboardModule.__reset()
}

async function destinationState(moduleId) {
  return repository.getPlanificationImportDestinationState({
    academicYearId: YEAR_ID,
    teachingAssignmentId: ASSIGNMENT_ID,
    moduleId
  })
}

function entry({
  moduleId,
  mode,
  fingerprint,
  sectionOrdinal,
  content
}) {
  return {
    academicYearId: YEAR_ID,
    teachingAssignmentId: ASSIGNMENT_ID,
    moduleId,
    mode,
    expectedStateFingerprint: fingerprint,
    source: {
      pages: [sectionOrdinal],
      sectionOrdinal
    },
    planification: {
      title: `Planificação ${moduleId}`
    },
    items: [
      {
        content
      }
    ]
  }
}

function batch(entries) {
  return {
    confirmed: true,
    document: {
      name: 'planificacao.pdf',
      sha256: PDF_HASH
    },
    entries
  }
}

test(
  'successful create and append invalidate dashboard exactly after persistent writes',
  async () => {
    reset()

    const beforeCreate = await destinationState(MODULE_A)

    const created = await repository.commitPlanificationImportBatch(
      batch([
        entry({
          moduleId: MODULE_A,
          mode: 'create',
          fingerprint: beforeCreate.stateFingerprint,
          sectionOrdinal: 1,
          content: 'Conteúdo A'
        })
      ])
    )

    assert.equal(created.results[0].action, 'created')
    assert.equal(dashboardModule.getDashboardDataRevision(), 1)

    const beforeAppend = await destinationState(MODULE_A)

    const appended = await repository.commitPlanificationImportBatch(
      batch([
        entry({
          moduleId: MODULE_A,
          mode: 'append',
          fingerprint: beforeAppend.stateFingerprint,
          sectionOrdinal: 2,
          content: 'Conteúdo B'
        })
      ])
    )

    assert.equal(appended.results[0].action, 'appended')
    assert.equal(dashboardModule.getDashboardDataRevision(), 2)
  }
)

test(
  'alreadyImported and skip-only batches do not invalidate dashboard again',
  async () => {
    reset()

    const preview = await destinationState(MODULE_A)
    const originalEntry = entry({
      moduleId: MODULE_A,
      mode: 'create',
      fingerprint: preview.stateFingerprint,
      sectionOrdinal: 1,
      content: 'Conteúdo A'
    })

    await repository.commitPlanificationImportBatch(
      batch([originalEntry])
    )

    assert.equal(dashboardModule.getDashboardDataRevision(), 1)

    const repeated = await repository.commitPlanificationImportBatch(
      batch([originalEntry])
    )

    assert.equal(repeated.results[0].action, 'alreadyImported')
    assert.equal(dashboardModule.getDashboardDataRevision(), 1)

    const skipped = await repository.commitPlanificationImportBatch(
      batch([
        entry({
          moduleId: MODULE_B,
          mode: 'skip',
          fingerprint: '',
          sectionOrdinal: 2,
          content: 'Ignorado'
        })
      ])
    )

    assert.equal(skipped.results[0].action, 'skipped')
    assert.equal(dashboardModule.getDashboardDataRevision(), 1)
  }
)

test(
  'rolled-back multi-UFCD batch leaves dashboard revision unchanged',
  async () => {
    reset()

    const previewA = await destinationState(MODULE_A)
    const previewB = await destinationState(MODULE_B)
    const before = dbModule.__snapshot()

    await assert.rejects(
      repository.commitPlanificationImportBatch(
        batch([
          entry({
            moduleId: MODULE_A,
            mode: 'create',
            fingerprint: previewA.stateFingerprint,
            sectionOrdinal: 1,
            content: 'Conteúdo A'
          }),
          entry({
            moduleId: MODULE_B,
            mode: 'create',
            fingerprint: `${previewB.stateFingerprint}-stale`,
            sectionOrdinal: 2,
            content: 'Conteúdo B'
          })
        ])
      ),
      /alterada depois da pré-visualização/
    )

    assert.deepEqual(dbModule.__snapshot(), before)
    assert.equal(dashboardModule.getDashboardDataRevision(), 0)
  }
)
