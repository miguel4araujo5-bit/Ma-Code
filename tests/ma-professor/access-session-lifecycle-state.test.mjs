import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const ACCESS_KEY =
  'ma-professor-access-state-v1'

const DAY_MS =
  24 * 60 * 60 * 1000

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
    this.putCalls = []
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(keyOrEntries, value) {
    if (
      typeof keyOrEntries === 'string'
    ) {
      this.putCalls.push({
        kind: 'single',
        key: keyOrEntries,
        value: clone(value)
      })
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    this.putCalls.push({
      kind: 'batch',
      entries: clone(keyOrEntries)
    })

    for (
      const [key, entry] of
      Object.entries(keyOrEntries)
    ) {
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
}

const source = await readFile(
  new URL(
    '../../worker/maProfessorSessionLifecycleState.ts',
    import.meta.url
  ),
  'utf8'
)

const output = ts.transpileModule(
  source,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  }
)

const diagnostics =
  (output.diagnostics || []).filter(
    diagnostic =>
      diagnostic.category ===
        ts.DiagnosticCategory.Error
  )

assert.equal(
  diagnostics.length,
  0,
  diagnostics.map(
    diagnostic =>
      ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      )
  ).join('\n')
)

const moduleUrl =
  `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`

const {
  createMAProfessorSessionLifecycleState,
  MA_PROFESSOR_SESSION_ABSOLUTE_MAX_AGE_DAYS
} = await import(moduleUrl)

function storedSession({
  tokenHash,
  email = 'teacher@example.com',
  deviceId = 'device-teacher-01',
  createdAt,
  lastSeenAt = createdAt,
  revokedAt = null
}) {
  return {
    tokenHash,
    email,
    deviceId,
    createdAt,
    lastSeenAt,
    revokedAt
  }
}

function accessState(sessions) {
  const now = Date.now()

  return {
    schemaVersion: 2,
    sessions,
    licenses: {},
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: now,
    updatedAt: now
  }
}

test(
  'revoked and absolutely expired sessions are removed server-side while recent sessions remain',
  async () => {
    assert.equal(
      MA_PROFESSOR_SESSION_ABSOLUTE_MAX_AGE_DAYS,
      180
    )

    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: accessState({
          revoked:
            storedSession({
              tokenHash: 'revoked',
              createdAt:
                now - DAY_MS,
              revokedAt:
                now - 1_000
            }),
          expired:
            storedSession({
              tokenHash: 'expired',
              createdAt:
                now - 181 * DAY_MS,
              lastSeenAt:
                now - 1_000
            }),
          recent:
            storedSession({
              tokenHash: 'recent',
              createdAt:
                now - 179 * DAY_MS,
              lastSeenAt:
                now - 1_000,
              deviceId:
                'device-recent-02'
            })
        })
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    assert.equal(
      value.sessions.revoked,
      undefined
    )
    assert.equal(
      value.sessions.expired,
      undefined,
      'Atividade recente não pode prolongar uma sessão para lá do limite absoluto desde createdAt.'
    )
    assert.ok(
      value.sessions.recent
    )
    assert.equal(
      storage.putCalls.length,
      1,
      'A limpeza necessária deve persistir numa única escrita lógica.'
    )

    await guarded.storage.get(
      ACCESS_KEY
    )

    assert.equal(
      storage.putCalls.length,
      1,
      'Uma leitura já limpa não deve gerar nova escrita.'
    )
  }
)

test(
  'recent concurrent tokens on the same device are not changed by the absolute-timeout guard',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: accessState({
          older:
            storedSession({
              tokenHash: 'older',
              createdAt:
                now - 10_000
            }),
          newer:
            storedSession({
              tokenHash: 'newer',
              createdAt:
                now - 1_000
            })
        })
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    assert.ok(value.sessions.older)
    assert.ok(value.sessions.newer)
    assert.equal(
      storage.putCalls.length,
      0,
      'Esta fase não deve alterar cardinalidade de sessões recentes nem expulsar outro dispositivo indiretamente.'
    )
  }
)

test(
  'absolute-expiry cleanup mutates an access write before delegation so lower in-memory state cannot retain an expired token',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage()
    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      accessState({
        expired:
          storedSession({
            tokenHash: 'expired',
            createdAt:
              now - 181 * DAY_MS,
            lastSeenAt:
              now
          }),
        fresh:
          storedSession({
            tokenHash: 'fresh',
            createdAt:
              now
          })
      })

    await guarded.storage.put(
      ACCESS_KEY,
      value
    )

    assert.equal(
      value.sessions.expired,
      undefined,
      'A mesma referência usada pelo código inferior deve ficar já sem a sessão expirada.'
    )
    assert.ok(value.sessions.fresh)
    assert.equal(
      storage.snapshot(
        ACCESS_KEY
      ).sessions.expired,
      undefined
    )
  }
)

test(
  'multi-key access writes stay in one atomic batch while absolute expiry is applied',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage()
    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      accessState({
        expired:
          storedSession({
            tokenHash: 'expired',
            createdAt:
              now - 181 * DAY_MS
          }),
        fresh:
          storedSession({
            tokenHash: 'fresh',
            createdAt:
              now
          })
      })

    await guarded.storage.put({
      [ACCESS_KEY]: value,
      'ma-professor-admin-commerce-v1': {
        schemaVersion: 1,
        marker: 'preserved'
      }
    })

    assert.equal(
      storage.putCalls.length,
      1
    )
    assert.equal(
      storage.putCalls[0].kind,
      'batch',
      'O guard não pode decompor um put multi-key em writes separados.'
    )
    assert.equal(
      storage.putCalls[0]
        .entries[ACCESS_KEY]
        .sessions.expired,
      undefined
    )
    assert.ok(
      storage.putCalls[0]
        .entries[ACCESS_KEY]
        .sessions.fresh
    )
    assert.equal(
      storage.snapshot(
        'ma-professor-admin-commerce-v1'
      ).marker,
      'preserved'
    )
  }
)
