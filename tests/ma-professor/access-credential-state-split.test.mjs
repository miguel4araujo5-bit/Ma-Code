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
const CREDENTIAL_KEY =
  'ma-professor-access-credentials-v1'
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
        'ma-professor-credential-split-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorAccessCredentialSplitBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'credentialSplit.mjs'
    ),
    transpile(
      source,
      'maProfessorAccessCredentialSplitBridge.ts'
    ),
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'credentialSplit.mjs'
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

function credential(
  email,
  overrides = {}
) {
  return {
    email,
    passwordSalt:
      'c2FsdA==',
    passwordHash:
      `hash-${email}`,
    passwordIterations:
      100000,
    createdAt:
      100,
    updatedAt:
      100,
    ...overrides
  }
}

function legacyState(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {},
    renewals: [],
    accessRequests: {},
    credentials: {
      'docente@example.com':
        credential(
          'docente@example.com'
        )
    },
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCore(overrides = {}) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {},
    renewals: [],
    accessRequests: {},
    createdAt: 10,
    updatedAt: 100,
    ...overrides
  }
}

function splitCredentials(overrides = {}) {
  return {
    schemaVersion: 1,
    credentials: {
      'docente@example.com':
        credential(
          'docente@example.com'
        )
    },
    updatedAt: 100,
    ...overrides
  }
}

function adaptedState(runtime, storage) {
  return runtime
    .createMAProfessorAccessCredentialSplitState({
      storage,
      marker: 'preserved'
    })
}

test(
  'legacy activation credentials are moved out of the access core atomically and stay visible to existing consumers',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState()
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
      state.marker,
      'preserved'
    )
    assert.equal(
      combined.credentials[
        'docente@example.com'
      ].passwordHash,
      'hash-docente@example.com'
    )

    const persistedCore =
      storage.snapshot(
        ACCESS_KEY
      )
    const persistedCredentials =
      storage.snapshot(
        CREDENTIAL_KEY
      )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        persistedCore,
        'credentials'
      ),
      false
    )
    assert.equal(
      persistedCredentials
        .credentials[
          'docente@example.com'
        ].passwordHash,
      'hash-docente@example.com'
    )
    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(
            ACCESS_KEY
          ) &&
          keys.includes(
            CREDENTIAL_KEY
          )
      ),
      'A migração deve separar núcleo e credenciais no mesmo put em lote.'
    )

    await state.storage.get(
      ACCESS_KEY
    )

    assert.deepEqual(
      storage.getCalls,
      [
        ACCESS_KEY,
        CREDENTIAL_KEY
      ],
      'A instância deve reutilizar a cache das duas chaves.'
    )
  }
)

test(
  'credential-only changes write only the dedicated credential key',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCore(),
        [CREDENTIAL_KEY]:
          splitCredentials()
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

    combined.credentials[
      'novo@example.com'
    ] = credential(
      'novo@example.com',
      {
        authorizationId:
          'authorization-1',
        authorizationPlan:
          'school_year'
      }
    )
    combined.updatedAt = 250

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      0,
      'Criar uma credencial não deve regravar licenças, pedidos, renovações ou sessões.'
    )
    assert.equal(
      storage.putsFor(
        CREDENTIAL_KEY
      ).length,
      1
    )
    assert.equal(
      storage.snapshot(
        CREDENTIAL_KEY
      ).credentials[
        'novo@example.com'
      ].authorizationId,
      'authorization-1'
    )
  }
)

test(
  'core-only changes do not rewrite credential hashes',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCore(),
        [CREDENTIAL_KEY]:
          splitCredentials()
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
        plan:
          'beta_30_days'
      }
    }
    combined.updatedAt = 300

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
        CREDENTIAL_KEY
      ).length,
      0,
      'Uma alteração no núcleo não deve voltar a persistir hashes de credenciais.'
    )
  }
)

test(
  'the split credential store is canonical and stale embedded credentials cannot be resurrected',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            credentials: {
              'stale@example.com':
                credential(
                  'stale@example.com'
                )
            }
          }),
        [CREDENTIAL_KEY]:
          splitCredentials({
            credentials: {
              'canonical@example.com':
                credential(
                  'canonical@example.com',
                  {
                    passwordHash:
                      'canonical-hash'
                  }
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
      combined.credentials[
        'stale@example.com'
      ],
      undefined
    )
    assert.equal(
      combined.credentials[
        'canonical@example.com'
      ].passwordHash,
      'canonical-hash'
    )
    assert.equal(
      storage.snapshot(
        CREDENTIAL_KEY
      ).credentials[
        'stale@example.com'
      ],
      undefined
    )
  }
)

test(
  'empty legacy credentials are removed without creating an unnecessary empty store',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          legacyState({
            credentials: {}
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

    assert.deepEqual(
      combined.credentials,
      {}
    )
    assert.equal(
      storage.snapshot(
        CREDENTIAL_KEY
      ),
      undefined
    )
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        storage.snapshot(
          ACCESS_KEY
        ),
        'credentials'
      ),
      false
    )
  }
)

test(
  'deleting the final activation credential persists the empty canonical store without rewriting the core',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCore(),
        [CREDENTIAL_KEY]:
          splitCredentials()
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

    delete combined.credentials[
      'docente@example.com'
    ]
    combined.updatedAt = 400

    await state.storage.put(
      ACCESS_KEY,
      combined
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      0
    )
    assert.equal(
      storage.putsFor(
        CREDENTIAL_KEY
      ).length,
      1
    )
    assert.deepEqual(
      storage.snapshot(
        CREDENTIAL_KEY
      ).credentials,
      {}
    )
  }
)

test(
  'credential and commerce changes keep their companion batch while credentials stay outside the core',
  async t => {
    const staged =
      await stageAdapter()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          splitCore(),
        [CREDENTIAL_KEY]:
          splitCredentials(),
        [COMMERCE_KEY]: {
          schemaVersion: 1,
          authorizations: [],
          updatedAt: 100
        }
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

    combined.credentials[
      'novo@example.com'
    ] = credential(
      'novo@example.com'
    )
    combined.accessRequests = {
      'novo@example.com': {
        email:
          'novo@example.com',
        status:
          'approved'
      }
    }
    combined.updatedAt = 500

    const commerce = {
      schemaVersion: 1,
      authorizations: [
        {
          id:
            'authorization-1',
          email:
            'novo@example.com'
        }
      ],
      updatedAt: 500
    }

    await state.storage.put({
      [ACCESS_KEY]:
        combined,
      [COMMERCE_KEY]:
        commerce
    })

    assert.ok(
      storage.putBatches.some(
        keys =>
          keys.includes(
            ACCESS_KEY
          ) &&
          keys.includes(
            CREDENTIAL_KEY
          ) &&
          keys.includes(
            COMMERCE_KEY
          )
      ),
      'A aprovação comercial deve poder continuar a persistir estado de acesso, credencial e comércio no mesmo batch físico.'
    )

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        storage.snapshot(
          ACCESS_KEY
        ),
        'credentials'
      ),
      false
    )
    assert.ok(
      storage.snapshot(
        CREDENTIAL_KEY
      ).credentials[
        'novo@example.com'
      ]
    )
    assert.equal(
      storage.snapshot(
        COMMERCE_KEY
      ).authorizations[0].id,
      'authorization-1'
    )
  }
)

test(
  'production composition includes the credential split without bindings migrations polling or scheduled work',
  async () => {
    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      )
    const credentialSplit =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessCredentialSplitBridge.ts',
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
      retention,
      /createMAProfessorAccessCredentialSplitState/
    )
    assert.match(
      credentialSplit,
      /ma-professor-access-credentials-v1/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-access-credentials-v1/
    )
    assert.doesNotMatch(
      credentialSplit,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
  }
)
