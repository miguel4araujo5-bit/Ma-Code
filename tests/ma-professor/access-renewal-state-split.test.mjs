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
const RENEWAL_KEY =
  'ma-professor-access-renewals-v1'
const COMMERCE_KEY =
  'ma-professor-admin-commerce-v1'

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
        'ma-professor-renewal-split-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessRenewalSplitBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'renewalSplit.mjs'
    ),
    transpile(
      source,
      'maProfessorAccessRenewalSplitBridge.ts'
    ),
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'renewalSplit.mjs'
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

function renewal(
  id = 'renewal-1',
  overrides = {}
) {
  return {
    id,
    email: 'docente@example.com',
    requestedPlan: 'paid_30_days',
    amountCents: 349,
    currency: 'EUR',
    status: 'pending',
    requestedAt: 100,
    ...overrides
  }
}

function legacyState(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {
      'docente@example.com': {
        email: 'docente@example.com',
        plan: 'beta_30_days',
        updatedAt: 100
      }
    },
    sessions: {
      tokenA: {
        tokenHash: 'tokenA'
      }
    },
    renewals: [
      renewal()
    ],
    accessRequests: {
      'docente@example.com': {
        id: 'request-1',
        email: 'docente@example.com',
        status: 'approved'
      }
    },
    credentials: {
      'docente@example.com': {
        email: 'docente@example.com',
        passwordHash: 'hash'
      }
    },
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCore(overrides = {}) {
  const state =
    legacyState(overrides)

  delete state.renewals

  return state
}

function splitRenewals(overrides = {}) {
  return {
    schemaVersion: 1,
    renewals: [
      renewal()
    ],
    updatedAt: 100,
    ...overrides
  }
}

function adaptedState(runtime, storage) {
  return runtime
    .createMAProfessorAccessRenewalSplitState({
      storage,
      marker: 'preserved'
    })
}

test(
  'legacy renewal history is moved out of the core atomically and remains visible to existing consumers',
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
    assert.equal(combined.renewals.length, 1)
    assert.equal(
      combined.renewals[0].id,
      'renewal-1'
    )
    assert.ok(combined.sessions.tokenA)
    assert.ok(
      combined.accessRequests[
        'docente@example.com'
      ]
    )

    const persistedCore =
      storage.snapshot(ACCESS_KEY)
    const persistedRenewals =
      storage.snapshot(RENEWAL_KEY)

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistedCore,
        'renewals'
      ),
      false
    )
    assert.equal(
      persistedRenewals.renewals[0].id,
      'renewal-1'
    )
    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(ACCESS_KEY) &&
          keys.includes(RENEWAL_KEY)
      ),
      'Núcleo e renovações devem ser separados no mesmo put em lote.'
    )

    await state.storage.get(ACCESS_KEY)
    assert.deepEqual(
      storage.getCalls,
      [ACCESS_KEY, RENEWAL_KEY],
      'A cache da instância evita releituras das chaves divididas.'
    )
  }
)

test(
  'renewal-only changes write only the renewal key',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [RENEWAL_KEY]: splitRenewals()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.renewals[0].status =
      'approved'
    combined.renewals[0].resolvedAt =
      250
    combined.updatedAt = 250

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0,
      'Resolver uma renovação não deve regravar licenças ou credenciais quando o núcleo não mudou.'
    )
    assert.equal(
      storage.putsFor(RENEWAL_KEY).length,
      1
    )
    assert.equal(
      storage.snapshot(RENEWAL_KEY)
        .renewals[0].status,
      'approved'
    )
  }
)

test(
  'core-only changes do not rewrite renewal history',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [RENEWAL_KEY]: splitRenewals()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.licenses[
      'docente@example.com'
    ].plan = 'paid_30_days'
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
      storage.putsFor(RENEWAL_KEY).length,
      0
    )
  }
)

test(
  'batch access writes keep commerce updates atomic while splitting renewal mutations',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [RENEWAL_KEY]: splitRenewals(),
        [COMMERCE_KEY]: {
          schemaVersion: 1,
          authorizations: []
        }
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.renewals[0].status =
      'cancelled'
    combined.renewals[0].resolvedAt =
      400
    combined.updatedAt = 400

    const commerce = {
      schemaVersion: 1,
      authorizations: [
        {
          id: 'authorization-1',
          renewalId: 'renewal-1'
        }
      ],
      updatedAt: 400
    }

    await state.storage.put({
      [ACCESS_KEY]: combined,
      [COMMERCE_KEY]: commerce
    })

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0
    )
    assert.equal(
      storage.putsFor(RENEWAL_KEY).length,
      1
    )
    assert.deepEqual(
      storage.snapshot(COMMERCE_KEY),
      commerce
    )
    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(RENEWAL_KEY) &&
          keys.includes(COMMERCE_KEY)
      ),
      'Renovação e autorização comercial devem continuar no mesmo put em lote.'
    )
  }
)

test(
  'an existing renewal store is canonical and stale embedded history cannot be resurrected',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            renewals: [
              renewal('stale-renewal')
            ]
          }),
        [RENEWAL_KEY]:
          splitRenewals({
            renewals: [
              renewal(
                'canonical-renewal',
                {
                  status: 'approved',
                  resolvedAt: 500
                }
              )
            ],
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

    assert.deepEqual(
      combined.renewals.map(
        item => item.id
      ),
      ['canonical-renewal']
    )
    assert.deepEqual(
      storage.snapshot(RENEWAL_KEY)
        .renewals.map(
          item => item.id
        ),
      ['canonical-renewal']
    )
  }
)

test(
  'an empty legacy renewal array is removed from the core without creating an unnecessary empty store',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            renewals: []
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
      combined.renewals,
      []
    )
    assert.equal(
      storage.snapshot(RENEWAL_KEY),
      undefined
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        storage.snapshot(ACCESS_KEY),
        'renewals'
      ),
      false
    )
  }
)

test(
  'retention composes session request and renewal splits without new Cloudflare bindings migrations polling or scheduled work',
  async () => {
    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      )
    const renewalSplit =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRenewalSplitBridge.ts',
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
      retention,
      /createMAProfessorAccessRenewalSplitState/
    )
    assert.match(
      renewalSplit,
      /ma-professor-access-renewals-v1/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-access-renewals-v1/
    )
    assert.doesNotMatch(
      renewalSplit,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
  }
)
