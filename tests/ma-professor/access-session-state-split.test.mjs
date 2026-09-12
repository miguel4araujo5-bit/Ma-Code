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

const SESSION_KEY =
  'ma-professor-access-sessions-v1'

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
      Object.entries(
        keyOrEntries
      )

    this.putBatches.push(
      entries.map(
        ([key]) => key
      )
    )

    for (
      const [key, entry] of
      entries
    ) {
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
      call =>
        call.key === key
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

async function stageSplitAdapter() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-session-split-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessSessionSplitBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorAccessSessionSplitBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorAccessSessionSplitBridge.ts'
    ),
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorAccessSessionSplitBridge.mjs'
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

function session(
  tokenHash,
  lastSeenAt = 100
) {
  return {
    tokenHash,
    email:
      'docente@example.com',
    deviceId:
      'device-01',
    createdAt: 50,
    lastSeenAt,
    revokedAt: null
  }
}

function legacyAccessState(
  overrides = {}
) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {
      tokenA:
        session('tokenA')
    },
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCoreState(
  overrides = {}
) {
  return {
    schemaVersion: 2,
    licenses: {},
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitSessionState(
  overrides = {}
) {
  return {
    schemaVersion: 1,
    sessions: {
      tokenA:
        session('tokenA')
    },
    updatedAt: 100,
    ...overrides
  }
}

function adaptedState(
  runtime,
  storage
) {
  return runtime
    .createMAProfessorAccessSessionSplitState({
      storage,
      marker:
        'preserved-state-property'
    })
}

test(
  'legacy sessions are migrated atomically out of the access blob and remain visible to existing consumers',
  async t => {
    const staged =
      await stageSplitAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyAccessState()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(
        ACCESS_KEY
      )

    assert.ok(
      combined.sessions.tokenA
    )
    assert.equal(
      state.marker,
      'preserved-state-property'
    )

    const persistedCore =
      storage.snapshot(
        ACCESS_KEY
      )
    const persistedSessions =
      storage.snapshot(
        SESSION_KEY
      )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistedCore,
        'sessions'
      ),
      false,
      'O blob principal deixa de transportar sessões depois da migração.'
    )
    assert.deepEqual(
      persistedSessions.sessions,
      legacyAccessState().sessions
    )

    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(
            ACCESS_KEY
          ) &&
          keys.includes(
            SESSION_KEY
          )
      ),
      'A primeira separação deve persistir núcleo e sessões no mesmo put em lote.'
    )

    await state.storage.get(
      ACCESS_KEY
    )

    assert.deepEqual(
      storage.getCalls,
      [
        ACCESS_KEY,
        SESSION_KEY
      ],
      'Depois do primeiro carregamento, as leituras do estado usam a cache da instância do Durable Object.'
    )
  }
)

test(
  'session-only activity writes only the session key and does not rewrite licenses requests or credentials',
  async t => {
    const staged =
      await stageSplitAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCoreState(),
        [SESSION_KEY]:
          splitSessionState()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(
        ACCESS_KEY
      )

    combined.sessions.tokenA.lastSeenAt =
      250
    combined.updatedAt =
      250

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      0,
      'Uma atualização de lastSeenAt não deve voltar a gravar o blob principal.'
    )
    assert.equal(
      storage.putsFor(
        SESSION_KEY
      ).length,
      1
    )
    assert.equal(
      storage.snapshot(
        SESSION_KEY
      ).sessions.tokenA.lastSeenAt,
      250
    )

    const reread =
      await state.storage.get(
        ACCESS_KEY
      )

    assert.equal(
      reread.updatedAt,
      250,
      'O estado recomposto deve manter o updatedAt mais recente das sessões.'
    )
  }
)

test(
  'core-only changes do not rewrite the split session state',
  async t => {
    const staged =
      await stageSplitAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCoreState(),
        [SESSION_KEY]:
          splitSessionState()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(
        ACCESS_KEY
      )

    combined.accessRequests = {
      'novo@example.com': {
        email:
          'novo@example.com',
        status:
          'pending',
        updatedAt:
          300
      }
    }
    combined.updatedAt =
      300

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      1
    )
    assert.equal(
      storage.putsFor(
        SESSION_KEY
      ).length,
      0,
      'Alterações a pedidos/licenças não devem regravar sessões inalteradas.'
    )
    assert.ok(
      storage.snapshot(
        ACCESS_KEY
      ).accessRequests[
        'novo@example.com'
      ]
    )
  }
)

test(
  'batch writes keep unrelated storage updates atomic while splitting access sessions',
  async t => {
    const staged =
      await stageSplitAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCoreState(),
        [SESSION_KEY]:
          splitSessionState()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(
        ACCESS_KEY
      )

    combined.licenses = {
      'docente@example.com': {
        email:
          'docente@example.com',
        status:
          'active'
      }
    }
    combined.updatedAt =
      400

    await state.storage.put({
      [ACCESS_KEY]:
        combined,
      'ma-professor-test-companion': {
        ok: true
      }
    })

    assert.deepEqual(
      storage.snapshot(
        'ma-professor-test-companion'
      ),
      {
        ok: true
      }
    )
    assert.equal(
      storage.putsFor(
        SESSION_KEY
      ).length,
      0
    )

    const lastBatch =
      storage.putBatches.at(-1)

    assert.ok(
      lastBatch.includes(
        ACCESS_KEY
      )
    )
    assert.ok(
      lastBatch.includes(
        'ma-professor-test-companion'
      )
    )
  }
)

test(
  'an existing split session store is canonical and legacy embedded sessions cannot be resurrected',
  async t => {
    const staged =
      await stageSplitAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyAccessState({
            sessions: {
              staleToken:
                session(
                  'staleToken',
                  25
                )
            }
          }),
        [SESSION_KEY]:
          splitSessionState({
            sessions: {
              canonicalToken:
                session(
                  'canonicalToken',
                  500
                )
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
      await state.storage.get(
        ACCESS_KEY
      )

    assert.equal(
      combined.sessions.staleToken,
      undefined
    )
    assert.ok(
      combined.sessions.canonicalToken
    )
    assert.ok(
      storage.snapshot(
        SESSION_KEY
      ).sessions.canonicalToken
    )
    assert.equal(
      storage.snapshot(
        SESSION_KEY
      ).sessions.staleToken,
      undefined
    )
  }
)

test(
  'retention composes the split adapter without adding Cloudflare bindings migrations polling or scheduled work',
  async () => {
    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      )

    const split =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessSessionSplitBridge.ts',
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
      split,
      /ma-professor-access-sessions-v1/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-access-sessions-v1/
    )
    assert.doesNotMatch(
      split,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
  }
)
