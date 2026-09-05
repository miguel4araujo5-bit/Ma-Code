import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

function transpile(source) {
  const output = ts.transpileModule(source, {
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

  return `data:text/javascript;base64,${Buffer.from(output.outputText).toString('base64')}`
}

const dbUrl = transpile(`
  export async function openMAProfessorDatabase() {
    return {
      tables: ['all'],
      async transaction(mode, tables, callback) {
        globalThis.__restoreTest.transactionMode = mode;
        globalThis.__restoreTest.transactionTables = tables;
        return callback();
      }
    };
  }
`)

const snapshotServiceUrl = transpile(`
  export async function createMAProfessorDatabaseSnapshot() {
    return structuredClone(globalThis.__restoreTest.currentLocalSnapshot);
  }

  export async function restoreMAProfessorDatabaseSnapshot(snapshot) {
    globalThis.__restoreTest.restoreCalls += 1;
    globalThis.__restoreTest.restoredSnapshot = structuredClone(snapshot);
    return {
      snapshot,
      recordCounts: snapshot.recordCounts,
      totalRecords: Object.values(snapshot.recordCounts).reduce((total, count) => total + count, 0)
    };
  }
`)

const guardedSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/guardedSnapshotRestore.ts',
    import.meta.url
  ),
  'utf8'
)

const guardedRuntime = guardedSource
  .replaceAll("'../db'", `'${dbUrl}'`)
  .replaceAll("'./databaseSnapshotService'", `'${snapshotServiceUrl}'`)

const guardedModule = await import(
  transpile(guardedRuntime)
)

const {
  createMAProfessorSnapshotContentSignature,
  restoreMAProfessorDatabaseSnapshotIfLocalUnchanged,
  MAProfessorLocalSnapshotChangedError
} = guardedModule

function makeSnapshot(summary) {
  return {
    format: 'ma-professor-database-snapshot',
    formatVersion: 1,
    databaseName: 'ma-professor',
    databaseVersion: 1,
    createdAt: '2026-09-05T09:00:00.000Z',
    tables: {
      lessons: [
        {
          id: 'lesson-1',
          summary
        }
      ]
    },
    recordCounts: {
      lessons: 1
    }
  }
}

function resetState(snapshot) {
  globalThis.__restoreTest = {
    currentLocalSnapshot: structuredClone(snapshot),
    restoreCalls: 0,
    restoredSnapshot: null,
    transactionMode: null,
    transactionTables: null
  }
}

test(
  'online restore proceeds when local data is unchanged since preview',
  async () => {
    const localAtPreview = makeSnapshot('Sumário local')
    const remote = makeSnapshot('Sumário online')

    resetState(localAtPreview)

    const signature =
      createMAProfessorSnapshotContentSignature(
        localAtPreview
      )

    const result =
      await restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
        remote,
        signature
      )

    assert.equal(
      globalThis.__restoreTest.restoreCalls,
      1
    )
    assert.equal(
      result.totalRecords,
      1
    )
    assert.equal(
      globalThis.__restoreTest.transactionMode,
      'rw'
    )
  }
)

test(
  'online restore aborts before replacement when another tab changes local data after preview',
  async () => {
    const localAtPreview = makeSnapshot('Sumário antes do preview')
    const changedLocally = makeSnapshot('Alterado noutra aba depois do preview')
    const remote = makeSnapshot('Sumário online')

    resetState(changedLocally)

    const signature =
      createMAProfessorSnapshotContentSignature(
        localAtPreview
      )

    await assert.rejects(
      () =>
        restoreMAProfessorDatabaseSnapshotIfLocalUnchanged(
          remote,
          signature
        ),
      error => {
        assert.ok(
          error instanceof MAProfessorLocalSnapshotChangedError
        )
        assert.match(
          error.message,
          /alterados depois da comparação/i
        )
        return true
      }
    )

    assert.equal(
      globalThis.__restoreTest.restoreCalls,
      0,
      'O snapshot remoto nunca pode ser escrito depois de uma alteração local concorrente.'
    )
  }
)

test(
  'snapshot content signature ignores only snapshot creation time',
  () => {
    const first = makeSnapshot('Mesmo conteúdo')
    const second = {
      ...makeSnapshot('Mesmo conteúdo'),
      createdAt: '2030-01-01T00:00:00.000Z'
    }

    assert.equal(
      createMAProfessorSnapshotContentSignature(first),
      createMAProfessorSnapshotContentSignature(second)
    )

    second.tables.lessons[0].summary = 'Conteúdo realmente diferente'

    assert.notEqual(
      createMAProfessorSnapshotContentSignature(first),
      createMAProfessorSnapshotContentSignature(second)
    )
  }
)

const onlineRestoreSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/onlineRestoreService.ts',
    import.meta.url
  ),
  'utf8'
)

const panelSource = await readFile(
  new URL(
    '../../src/components/ma-professor/settings/OnlineRestorePanel.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'online restore carries the exact local preview guard into the final restore',
  () => {
    assert.match(
      onlineRestoreSource,
      /localContentSignature:\s*createMAProfessorSnapshotContentSignature\(/
    )
    assert.match(
      onlineRestoreSource,
      /restoreMAProfessorDatabaseSnapshotIfLocalUnchanged\(/
    )
    assert.match(
      panelSource,
      /expectedLocalContentSignature:\s*foundPreview\.localContentSignature/
    )
  }
)
