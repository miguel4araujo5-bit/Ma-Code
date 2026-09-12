import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { pathToFileURL } from 'node:url'
import * as ts from 'typescript'

const ACCESS_KEY =
  'ma-professor-access-state-v1'
const REQUEST_KEY =
  'ma-professor-access-requests-v1'

function clone(value) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(
      Object.entries(initial).map(
        ([key, value]) => [
          key,
          clone(value)
        ]
      )
    )
    this.getCalls = []
    this.putCalls = []
    this.putBatches = []
  }

  async get(key) {
    this.getCalls.push(key)
    return clone(
      this.values.get(key)
    )
  }

  async put(keyOrEntries, value) {
    if (
      typeof keyOrEntries ===
        'string'
    ) {
      this.putCalls.push({
        key: keyOrEntries,
        value: clone(value)
      })
      this.putBatches.push([
        keyOrEntries
      ])
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    const entries =
      Object.entries(keyOrEntries)

    this.putBatches.push(
      entries.map(([key]) => key)
    )

    for (const [key, entry] of entries) {
      this.putCalls.push({
        key,
        value: clone(entry)
      })
      this.values.set(
        key,
        clone(entry)
      )
    }
  }

  snapshot(key) {
    return clone(
      this.values.get(key)
    )
  }

  putsFor(key) {
    return this.putCalls.filter(
      call => call.key === key
    )
  }
}

function transpile(source, filename) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName: filename,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022
        },
        reportDiagnostics: true
      }
    )

  const errors =
    (output.diagnostics || [])
      .filter(
        diagnostic =>
          diagnostic.category ===
            ts.DiagnosticCategory.Error
      )

  assert.equal(
    errors.length,
    0,
    errors.map(
      diagnostic =>
        ts.flattenDiagnosticMessageText(
          diagnostic.messageText,
          '\n'
        )
    ).join('\n')
  )

  return output.outputText
}

async function stageAdapter() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-request-split-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessRequestSplitBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'requestSplit.mjs'
    ),
    transpile(
      source,
      'maProfessorAccessRequestSplitBridge.ts'
    ),
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'requestSplit.mjs'
        )
      ).href
    )

  return {
    runtime,
    dispose: () =>
      rm(
        directory,
        {
          recursive: true,
          force: true
        }
      )
  }
}

function request(email, status = 'pending') {
  return {
    id: `request-${email}`,
    email,
    status,
    requestedAt: 100,
    approvedAt: null,
    rejectedAt: null,
    activatedAt: null,
    failedActivationAttempts: 0,
    blockedUntil: null,
    updatedAt: 100
  }
}

function legacyState(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {
      tokenA: {
        tokenHash: 'tokenA'
      }
    },
    renewals: [],
    accessRequests: {
      'docente@example.com':
        request('docente@example.com')
    },
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCore(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {
      tokenA: {
        tokenHash: 'tokenA'
      }
    },
    renewals: [],
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitRequests(overrides = {}) {
  return {
    schemaVersion: 1,
    accessRequests: {
      'docente@example.com':
        request('docente@example.com')
    },
    updatedAt: 100,
    ...overrides
  }
}

function adaptedState(runtime, storage) {
  return runtime
    .createMAProfessorAccessRequestSplitState({
      storage,
      marker: 'preserved'
    })
}

test(
  'legacy access requests are moved out of the core in one batch and remain visible to existing consumers',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: legacyState()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    assert.equal(state.marker, 'preserved')
    assert.ok(
      combined.accessRequests[
        'docente@example.com'
      ]
    )
    assert.ok(combined.sessions.tokenA)

    const persistedCore =
      storage.snapshot(ACCESS_KEY)
    const persistedRequests =
      storage.snapshot(REQUEST_KEY)

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistedCore,
        'accessRequests'
      ),
      false
    )
    assert.ok(
      persistedRequests.accessRequests[
        'docente@example.com'
      ]
    )
    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(ACCESS_KEY) &&
          keys.includes(REQUEST_KEY)
      ),
      'Núcleo e pedidos devem ser separados no mesmo put em lote.'
    )

    await state.storage.get(ACCESS_KEY)
    assert.deepEqual(
      storage.getCalls,
      [ACCESS_KEY, REQUEST_KEY],
      'A cache da instância evita releituras das chaves divididas.'
    )
  }
)

test(
  'request-only changes write only the request key',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [REQUEST_KEY]: splitRequests()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.accessRequests[
      'novo@example.com'
    ] = request('novo@example.com')
    combined.updatedAt = 250

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0,
      'Adicionar um pedido não deve regravar licenças, credenciais, renovações ou sessões.'
    )
    assert.equal(
      storage.putsFor(REQUEST_KEY).length,
      1
    )
    assert.ok(
      storage.snapshot(REQUEST_KEY)
        .accessRequests[
          'novo@example.com'
        ]
    )
  }
)

test(
  'core-only changes do not rewrite access requests',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [REQUEST_KEY]: splitRequests()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.licenses = {
      'docente@example.com': {
        email: 'docente@example.com',
        status: 'active'
      }
    }
    combined.updatedAt = 300

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      1
    )
    assert.equal(
      storage.putsFor(REQUEST_KEY).length,
      0,
      'Uma alteração de licença não deve regravar pedidos inalterados.'
    )
  }
)

test(
  'an existing request store is canonical and stale embedded requests cannot be resurrected',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            accessRequests: {
              'stale@example.com':
                request('stale@example.com')
            }
          }),
        [REQUEST_KEY]:
          splitRequests({
            accessRequests: {
              'canonical@example.com':
                request('canonical@example.com')
            },
            updatedAt: 500
          })
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    assert.equal(
      combined.accessRequests[
        'stale@example.com'
      ],
      undefined
    )
    assert.ok(
      combined.accessRequests[
        'canonical@example.com'
      ]
    )
    assert.equal(
      storage.snapshot(REQUEST_KEY)
        .accessRequests[
          'stale@example.com'
        ],
      undefined
    )
  }
)

test(
  'an empty legacy request map is removed from the core without creating an unnecessary empty request store',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            accessRequests: {}
          })
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    assert.deepEqual(
      combined.accessRequests,
      {}
    )
    assert.equal(
      storage.snapshot(REQUEST_KEY),
      undefined
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        storage.snapshot(ACCESS_KEY),
        'accessRequests'
      ),
      false
    )
  }
)

test(
  'retention composes session and request splits without new Cloudflare bindings migrations polling or scheduled work',
  async () => {
    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      )
    const requestSplit =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRequestSplitBridge.ts',
          import.meta.url
        ),
        'utf8'
      )
    const wrangler =
      await readFile(
        new URL(
          '../../wrangler.jsonc',
          import.meta.url
        ),
        'utf8'
      )

    assert.match(
      retention,
      /createMAProfessorAccessSessionSplitState/
    )
    assert.match(
      retention,
      /createMAProfessorAccessRequestSplitState/
    )
    assert.match(
      requestSplit,
      /ma-professor-access-requests-v1/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-access-requests-v1/
    )
    assert.doesNotMatch(
      requestSplit,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
  }
)
