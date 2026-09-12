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

const MODULE_NAMES = [
  'maProfessorAccess',
  'maProfessorPaidAccess',
  'maProfessorAccessAdminBridge',
  'maProfessorAccessAuthBridge',
  'maProfessorAccountSessionBridge',
  'maProfessorAccessAccountAdminBridge',
  'maProfessorOperationalStateBridge',
  'maProfessorExplicitApprovalBridge',
  'maProfessorActivationCredentialGuardBridge'
]

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
      typeof keyOrEntries ===
      'string'
    ) {
      this.putCalls.push({
        key: keyOrEntries,
        value: clone(value)
      })
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    for (
      const [key, entry] of
      Object.entries(keyOrEntries)
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
      call => call.key === key
    )
  }
}

function createState(storage) {
  return {
    storage,
    blockConcurrencyWhile:
      async callback =>
        callback()
  }
}

function transpile(source, filename) {
  const output = ts.transpileModule(
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

  let javascript =
    output.outputText

  for (const dependency of MODULE_NAMES) {
    javascript = javascript
      .replaceAll(
        `'./${dependency}'`,
        `'./${dependency}.mjs'`
      )
      .replaceAll(
        `"./${dependency}"`,
        `"./${dependency}.mjs"`
      )
  }

  return javascript
}

async function stageProductionChain() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-cold-start-'
      )
    )

  for (const moduleName of MODULE_NAMES) {
    const source =
      await readFile(
        new URL(
          `../../worker/${moduleName}.ts`,
          import.meta.url
        ),
        'utf8'
      )

    await writeFile(
      join(
        directory,
        `${moduleName}.mjs`
      ),
      transpile(
        source,
        `${moduleName}.ts`
      ),
      'utf8'
    )
  }

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorActivationCredentialGuardBridge.mjs'
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

function request(
  pathname,
  body = {}
) {
  return new Request(
    `https://ma-code.pt${pathname}`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body:
        JSON.stringify(body)
    }
  )
}

function currentState(
  overrides = {}
) {
  return {
    schemaVersion: 2,
    licenses: {},
    sessions: {},
    renewals: [],
    accessRequests: {},
    credentials: {},
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides
  }
}

async function initializeAccess(
  runtime,
  storage
) {
  const access =
    new runtime.MaProfessorAccessDurableObject(
      createState(storage),
      {}
    )

  await access.fetch(
    request(
      '/api/ma-professor/access/not-found'
    )
  )

  return access
}

test(
  'an unchanged current access state is not rewritten on cold start',
  async t => {
    const staged =
      await stageProductionChain()
    t.after(staged.dispose)

    const original =
      currentState()
    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: original
      })

    await initializeAccess(
      staged.runtime,
      storage
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      0,
      'Um cold start sem alterações não deve regravar o blob global.'
    )
    assert.deepEqual(
      storage.snapshot(
        ACCESS_KEY
      ),
      original,
      'updatedAt também deve permanecer intacto quando nada mudou.'
    )
  }
)

test(
  'the first real access-state mutation after a clean cold start is still persisted',
  async t => {
    const staged =
      await stageProductionChain()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          currentState()
      })

    const access =
      await initializeAccess(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email:
              'novo@example.com',
            accountPassword:
              'password-segura'
          }
        )
      )

    assert.equal(
      response.status,
      200
    )
    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      1,
      'A proteção do cold start não pode engolir a primeira alteração real.'
    )
    assert.equal(
      storage.snapshot(
        ACCESS_KEY
      ).accessRequests[
        'novo@example.com'
      ].status,
      'pending'
    )
  }
)

test(
  'legacy access state is still migrated and persisted on cold start',
  async t => {
    const staged =
      await stageProductionChain()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          schemaVersion: 1,
          licenses: {},
          sessions: {},
          renewals: [],
          createdAt: 10,
          updatedAt: 10
        }
      })

    await initializeAccess(
      staged.runtime,
      storage
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      1
    )
    assert.equal(
      storage.snapshot(
        ACCESS_KEY
      ).schemaVersion,
      2
    )
    assert.deepEqual(
      storage.snapshot(
        ACCESS_KEY
      ).accessRequests,
      {}
    )
  }
)

test(
  'an empty access store still creates and persists its initial state',
  async t => {
    const staged =
      await stageProductionChain()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()

    await initializeAccess(
      staged.runtime,
      storage
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      1
    )
    assert.equal(
      storage.snapshot(
        ACCESS_KEY
      ).schemaVersion,
      2
    )
  }
)

test(
  'expired sessions are still pruned and the changed state is persisted',
  async t => {
    const staged =
      await stageProductionChain()
    t.after(staged.dispose)

    const oldTimestamp =
      Date.now() -
      181 *
        24 *
        60 *
        60 *
        1000

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          currentState({
            sessions: {
              expired: {
                tokenHash:
                  'expired',
                email:
                  'docente@example.com',
                deviceId:
                  'device-01',
                createdAt:
                  oldTimestamp,
                lastSeenAt:
                  oldTimestamp,
                revokedAt:
                  null
              }
            }
          })
      })

    await initializeAccess(
      staged.runtime,
      storage
    )

    assert.equal(
      storage.putsFor(
        ACCESS_KEY
      ).length,
      1,
      'A remoção de uma sessão antiga continua a exigir persistência.'
    )
    assert.deepEqual(
      storage.snapshot(
        ACCESS_KEY
      ).sessions,
      {}
    )
  }
)
