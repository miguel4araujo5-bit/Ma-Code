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
const LICENSE_KEY =
  'ma-professor-access-licenses-v1'
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
        'ma-professor-license-split-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessLicenseSplitBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(directory, 'licenseSplit.mjs'),
    transpile(
      source,
      'maProfessorAccessLicenseSplitBridge.ts'
    ),
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(directory, 'licenseSplit.mjs')
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

function license(
  email = 'docente@example.com',
  overrides = {}
) {
  return {
    email,
    plan: 'beta_30_days',
    validFrom: 100,
    validUntil: 200,
    revokedAt: null,
    renewalRequestedAt: null,
    renewalRequestedPlan: null,
    deviceIds: ['device-123456'],
    createdAt: 100,
    updatedAt: 100,
    ...overrides
  }
}

function legacyState(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {
      'docente@example.com':
        license()
    },
    sessions: {},
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCore(overrides = {}) {
  return {
    schemaVersion: 2,
    sessions: {},
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitLicenses(overrides = {}) {
  return {
    schemaVersion: 1,
    licenses: {
      'docente@example.com':
        license()
    },
    updatedAt: 100,
    ...overrides
  }
}

function adaptedState(runtime, storage) {
  return runtime
    .createMAProfessorAccessLicenseSplitState({
      storage,
      marker: 'preserved'
    })
}

test(
  'legacy licenses migrate out of the logical core atomically and remain visible to existing consumers',
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
    assert.equal(
      combined.licenses[
        'docente@example.com'
      ].plan,
      'beta_30_days'
    )

    const persistedCore =
      storage.snapshot(ACCESS_KEY)
    const persistedLicenses =
      storage.snapshot(LICENSE_KEY)

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistedCore,
        'licenses'
      ),
      false
    )
    assert.equal(
      persistedLicenses.licenses[
        'docente@example.com'
      ].validUntil,
      200
    )
    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(ACCESS_KEY) &&
          keys.includes(LICENSE_KEY)
      ),
      'Núcleo e licenças devem migrar no mesmo put em lote.'
    )

    await state.storage.get(ACCESS_KEY)
    assert.deepEqual(
      storage.getCalls,
      [ACCESS_KEY, LICENSE_KEY],
      'A cache da instância evita releituras após a primeira recomposição.'
    )
  }
)

test(
  'license-only changes write only the dedicated license key',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [LICENSE_KEY]: splitLicenses()
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
    ].validUntil = 500
    combined.licenses[
      'docente@example.com'
    ].updatedAt = 300
    combined.updatedAt = 300

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0,
      'Renovar ou atualizar uma licença não deve regravar o núcleo lógico.'
    )
    assert.equal(
      storage.putsFor(LICENSE_KEY).length,
      1
    )
    assert.equal(
      storage.snapshot(LICENSE_KEY)
        .licenses['docente@example.com']
        .validUntil,
      500
    )
  }
)

test(
  'session or other core-only changes do not rewrite licenses',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [LICENSE_KEY]: splitLicenses()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    combined.sessions = {
      tokenA: {
        email: 'docente@example.com',
        lastSeenAt: 400
      }
    }
    combined.updatedAt = 400

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      1
    )
    assert.equal(
      storage.putsFor(LICENSE_KEY).length,
      0,
      'Uma alteração de sessão não deve regravar licenças inalteradas.'
    )
  }
)

test(
  'existing split license store is canonical and stale embedded licenses cannot be resurrected',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            licenses: {
              'stale@example.com':
                license(
                  'stale@example.com',
                  { plan: 'school_year' }
                )
            }
          }),
        [LICENSE_KEY]:
          splitLicenses({
            licenses: {
              'canonical@example.com':
                license(
                  'canonical@example.com',
                  { plan: 'paid_30_days' }
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
      await state.storage.get(ACCESS_KEY)

    assert.equal(
      combined.licenses[
        'stale@example.com'
      ],
      undefined
    )
    assert.equal(
      combined.licenses[
        'canonical@example.com'
      ].plan,
      'paid_30_days'
    )
    assert.equal(
      storage.snapshot(LICENSE_KEY)
        .licenses['stale@example.com'],
      undefined
    )
  }
)

test(
  'empty legacy license map is removed without creating an unnecessary empty split store',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            licenses: {}
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
      combined.licenses,
      {}
    )
    assert.equal(
      storage.snapshot(LICENSE_KEY),
      undefined
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        storage.snapshot(ACCESS_KEY),
        'licenses'
      ),
      false
    )
  }
)

test(
  'deleting the last existing license persists a canonical empty license store',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [LICENSE_KEY]: splitLicenses()
      })

    const state =
      adaptedState(
        staged.runtime,
        storage
      )

    const combined =
      await state.storage.get(ACCESS_KEY)

    delete combined.licenses[
      'docente@example.com'
    ]
    combined.updatedAt = 600

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.deepEqual(
      storage.snapshot(LICENSE_KEY)
        .licenses,
      {}
    )
    assert.equal(
      storage.putsFor(LICENSE_KEY).length,
      1
    )
    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0
    )
  }
)

test(
  'batch writes keep license and commerce changes in the same physical put',
  async t => {
    const staged = await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: splitCore(),
        [LICENSE_KEY]: splitLicenses()
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
    ].plan = 'school_year'
    combined.updatedAt = 700

    await state.storage.put({
      [ACCESS_KEY]: combined,
      [COMMERCE_KEY]: {
        schemaVersion: 1,
        authorizations: [],
        updatedAt: 700
      }
    })

    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(LICENSE_KEY) &&
          keys.includes(COMMERCE_KEY)
      ),
      'Licença e comércio devem poder persistir no mesmo put atómico.'
    )
    assert.equal(
      storage.putsFor(ACCESS_KEY).length,
      0
    )
  }
)

test(
  'retention composes license split after credential split without new bindings migrations polling or alarms',
  async () => {
    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      )
    const licenseSplit =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessLicenseSplitBridge.ts',
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
      /createMAProfessorAccessCredentialSplitState/
    )
    assert.match(
      retention,
      /createMAProfessorAccessLicenseSplitState/
    )
    assert.match(
      retention,
      /createMAProfessorAccessLicenseSplitState\(\s*credentialSplitState\s*\)/
    )
    assert.match(
      licenseSplit,
      /ma-professor-access-licenses-v1/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-access-licenses-v1/
    )
    assert.doesNotMatch(
      licenseSplit,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
  }
)
