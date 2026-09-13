import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const ACCESS_KEY =
  'ma-professor-access-state-v1'

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
  createMAProfessorSessionLifecycleState
} = await import(moduleUrl)

function session({
  key,
  deviceId,
  createdAt,
  lastSeenAt = createdAt,
  revokedAt = null
}) {
  return {
    tokenHash: key,
    email:
      'teacher@example.com',
    deviceId,
    createdAt,
    lastSeenAt,
    revokedAt
  }
}

function state(sessions) {
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

function fourDeviceState(now) {
  return state({
    'device-a-old':
      session({
        key: 'device-a-old',
        deviceId: 'device-a',
        createdAt:
          now - 5_000,
        lastSeenAt:
          now - 1_000
      }),
    'device-b':
      session({
        key: 'device-b',
        deviceId: 'device-b',
        createdAt:
          now - 40_000,
        lastSeenAt:
          now - 4_000
      }),
    'device-c':
      session({
        key: 'device-c',
        deviceId: 'device-c',
        createdAt:
          now - 30_000,
        lastSeenAt:
          now - 3_000
      }),
    'device-d':
      session({
        key: 'device-d',
        deviceId: 'device-d',
        createdAt:
          now - 20_000,
        lastSeenAt:
          now - 2_000
      })
  })
}

test(
  'replacing one device restores another device removed before the cap recognized the replacement',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          fourDeviceState(now)
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    delete value.sessions[
      'device-b'
    ]

    value.sessions[
      'device-a-new'
    ] =
      session({
        key: 'device-a-new',
        deviceId: 'device-a',
        createdAt: now,
        lastSeenAt: now
      })

    await guarded.storage.put(
      ACCESS_KEY,
      value
    )

    const persisted =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      persisted.sessions[
        'device-a-old'
      ],
      undefined
    )
    assert.ok(
      persisted.sessions[
        'device-a-new'
      ]
    )
    assert.ok(
      persisted.sessions[
        'device-b'
      ]
    )
    assert.ok(
      persisted.sessions[
        'device-c'
      ]
    )
    assert.ok(
      persisted.sessions[
        'device-d'
      ]
    )
    assert.equal(
      Object.keys(
        persisted.sessions
      ).length,
      4
    )
    assert.equal(
      storage.putCalls.length,
      1,
      'A substituição deve continuar a usar o mesmo write lógico.'
    )
  }
)

test(
  'replacing one device also restores another device that was only marked inactive by the old cap ordering',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          fourDeviceState(now)
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    value.sessions[
      'device-b'
    ].revokedAt =
      now

    value.sessions[
      'device-a-new'
    ] =
      session({
        key: 'device-a-new',
        deviceId: 'device-a',
        createdAt: now
      })

    await guarded.storage.put(
      ACCESS_KEY,
      value
    )

    const persisted =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      persisted.sessions[
        'device-b'
      ].revokedAt,
      null
    )
    assert.equal(
      persisted.sessions[
        'device-a-old'
      ],
      undefined
    )
    assert.ok(
      persisted.sessions[
        'device-a-new'
      ]
    )
  }
)

test(
  'a genuinely new device keeps the existing cap eviction',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          fourDeviceState(now)
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    delete value.sessions[
      'device-b'
    ]

    value.sessions[
      'device-e'
    ] =
      session({
        key: 'device-e',
        deviceId: 'device-e',
        createdAt: now
      })

    await guarded.storage.put(
      ACCESS_KEY,
      value
    )

    const persisted =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      persisted.sessions[
        'device-b'
      ],
      undefined,
      'Um quinto dispositivo real continua sujeito ao limite existente.'
    )
    assert.ok(
      persisted.sessions[
        'device-e'
      ]
    )
    assert.equal(
      Object.keys(
        persisted.sessions
      ).length,
      4
    )
  }
)

test(
  'replacement reconciliation preserves a multi-key atomic write',
  async () => {
    const now = Date.now()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          fourDeviceState(now)
      })

    const guarded =
      createMAProfessorSessionLifecycleState({
        storage
      })

    const value =
      await guarded.storage.get(
        ACCESS_KEY
      )

    delete value.sessions[
      'device-b'
    ]

    value.sessions[
      'device-a-new'
    ] =
      session({
        key: 'device-a-new',
        deviceId: 'device-a',
        createdAt: now
      })

    await guarded.storage.put({
      [ACCESS_KEY]: value,
      'ma-professor-admin-commerce-v1': {
        marker: 'preserved'
      }
    })

    assert.equal(
      storage.putCalls.length,
      1
    )
    assert.equal(
      storage.putCalls[0].kind,
      'batch'
    )
    assert.ok(
      storage.putCalls[0]
        .entries[ACCESS_KEY]
        .sessions['device-b']
    )
    assert.equal(
      storage.snapshot(
        'ma-professor-admin-commerce-v1'
      ).marker,
      'preserved'
    )
  }
)
