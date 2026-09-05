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

const source = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/syncStateStorage.ts',
    import.meta.url
  ),
  'utf8'
)

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type
    this.detail = options.detail
  }
}

globalThis.CustomEvent = TestCustomEvent

const events = []
let shouldFail = true
let storedValue = null

globalThis.window = {
  localStorage: {
    getItem() {
      return storedValue
    },
    setItem(_key, value) {
      if (shouldFail) {
        throw new Error('storage blocked')
      }

      storedValue = value
    },
    removeItem() {
      storedValue = null
    }
  },
  dispatchEvent(event) {
    events.push(event)
    return true
  }
}

const module = await import(
  transpile(source)
)

const {
  saveMAProfessorManualSyncState,
  readMAProfessorSyncStatePersistenceState,
  MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT
} = module

function makeState(operation) {
  return {
    serverRevision: 3,
    fingerprint: 'fingerprint-3',
    syncedAt: '2026-09-05T09:00:00.000Z',
    verifiedAt: '2026-09-05T09:01:00.000Z',
    lastOperation: operation
  }
}

for (const operation of ['upload', 'verify', 'restore']) {
  test(
    `completed ${operation} is not converted into an error when localStorage metadata fails`,
    () => {
      shouldFail = true
      events.length = 0

      assert.doesNotThrow(() => {
        const saved =
          saveMAProfessorManualSyncState(
            'prof@example.pt',
            'device-1',
            makeState(operation)
          )

        assert.equal(saved, false)
      })

      assert.deepEqual(
        readMAProfessorSyncStatePersistenceState(),
        {
          status: 'warning',
          operation
        }
      )

      assert.equal(events.length, 1)
      assert.equal(
        events[0].type,
        MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT
      )
      assert.deepEqual(
        events[0].detail,
        {
          status: 'warning',
          operation
        }
      )
    }
  )
}

test(
  'a later successful metadata write clears the warning state',
  () => {
    shouldFail = false
    events.length = 0

    const saved =
      saveMAProfessorManualSyncState(
        'prof@example.pt',
        'device-1',
        makeState('upload')
      )

    assert.equal(saved, true)
    assert.deepEqual(
      readMAProfessorSyncStatePersistenceState(),
      {
        status: 'saved',
        operation: null
      }
    )
    assert.equal(events.length, 1)
    assert.deepEqual(
      events[0].detail,
      {
        status: 'saved',
        operation: null
      }
    )

    const parsed = JSON.parse(storedValue)
    assert.equal(parsed.serverRevision, 3)
    assert.equal(parsed.lastOperation, 'upload')
  }
)

const noticeSource = await readFile(
  new URL(
    '../../src/components/ma-professor/sync/SyncStatePersistenceNotice.tsx',
    import.meta.url
  ),
  'utf8'
)

const pageSource = await readFile(
  new URL(
    '../../src/pages/MAProfessorPage.tsx',
    import.meta.url
  ),
  'utf8'
)

test(
  'the global notice states that the completed operation is not repeated automatically',
  () => {
    assert.match(
      noticeSource,
      /operação foi concluída/i
    )
    assert.match(
      noticeSource,
      /não serão repetidos automaticamente/i
    )
    assert.match(
      noticeSource,
      /Atualize o estado antes da próxima sincronização/i
    )
    assert.match(
      pageSource,
      /<SyncStatePersistenceNotice \/>/
    )
  }
)
