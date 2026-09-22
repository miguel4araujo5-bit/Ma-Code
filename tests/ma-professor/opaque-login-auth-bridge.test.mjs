import assert from 'node:assert/strict'
import {
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises'
import {
  tmpdir
} from 'node:os'
import {
  join
} from 'node:path'
import test from 'node:test'
import {
  pathToFileURL
} from 'node:url'
import * as ts from 'typescript'

const ACCESS_KEY =
  'ma-professor-access-state-v1'

const ACCOUNT_AUTH_KEY =
  'ma-professor-account-auth-v1'

const OPAQUE_KEY =
  'ma-professor-opaque-auth-v1'

function clone(value) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values =
      new Map(
        Object.entries(
          initial
        ).map(
          ([key, value]) => [
            key,
            clone(value)
          ]
        )
      )
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(
    keyOrEntries,
    value
  ) {
    if (
      typeof keyOrEntries ===
        'string'
    ) {
      this.values.set(
        keyOrEntries,
        clone(value)
      )
      return
    }

    for (
      const [key, entry] of
      Object.entries(
        keyOrEntries
      )
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

function transpile(
  source,
  filename
) {
  const output =
    ts.transpileModule(
      source,
      {
        fileName:
          filename,
        compilerOptions: {
          module:
            ts.ModuleKind.ESNext,
          target:
            ts.ScriptTarget.ES2022
        },
        reportDiagnostics:
          true
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

async function stageAuthBridge() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-opaque-login-'
      )
    )

  await writeFile(join(directory, 'maProfessorAccess.mjs'), "export const CURRENT_TERMS_VERSION = '2026-09-22'\n")

  for (
    const moduleName of [
      'maProfessorOpaqueAuthState',
      'maProfessorOpaqueAuthProtocol',
      'maProfessorAccessAuthBridge'
    ]
  ) {
    let source =
      await readFile(
        new URL(
          `../../worker/${moduleName}.ts`,
          import.meta.url
        ),
        'utf8'
      )

    for (
      const dependency of [
        'maProfessorAccess',
        'maProfessorAccessAdminBridge',
        'maProfessorOpaqueAuthState',
        'maProfessorOpaqueAuthProtocol',
        'maProfessorOpaqueServerRuntime'
      ]
    ) {
      source =
        source
          .replaceAll(
            `'./${dependency}'`,
            `'./${dependency}.mjs'`
          )
          .replaceAll(
            `"./${dependency}"`,
            `"./${dependency}.mjs"`
          )
    }

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

  await writeFile(
    join(
      directory,
      'maProfessorAccessAdminBridge.mjs'
    ),
    `
      export class MaProfessorAccessDurableObject {
        async fetch() {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'lower layer not expected'
            }),
            {
              status: 404,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          )
        }
      }
    `,
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorOpaqueServerRuntime.mjs'
    ),
    `
      export const calls = []

      const runtime = {
        createServerSetup() {
          calls.push('createServerSetup')
          return 'server-setup'
        },

        createServerRegistrationResponse() {
          throw new Error(
            'registration is not part of this login test'
          )
        },

        startServerLogin({
          registrationRecord,
          startLoginRequest,
          userIdentifier
        }) {
          calls.push({
            operation: 'start',
            registrationRecord,
            startLoginRequest,
            userIdentifier
          })

          return {
            serverLoginState:
              JSON.stringify({
                registrationRecord,
                userIdentifier
              }),
            loginResponse:
              'opaque-login-response'
          }
        },

        finishServerLogin({
          serverLoginState,
          finishLoginRequest
        }) {
          const state =
            JSON.parse(
              serverLoginState
            )

          calls.push({
            operation: 'finish',
            finishLoginRequest,
            userIdentifier:
              state.userIdentifier
          })

          if (
            !state.registrationRecord ||
            finishLoginRequest !==
              'proof:' + state.registrationRecord
          ) {
            throw new Error(
              'invalid opaque proof'
            )
          }

          return {
            sessionKey:
              'server-session-key-must-not-escape'
          }
        }
      }

      export async function getMAProfessorOpaqueServerRuntime() {
        return runtime
      }
    `,
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorAccessAuthBridge.mjs'
        )
      ).href
    )

  return {
    runtime,
    dispose: () =>
      rm(
        directory,
        {
          recursive:
            true,
          force:
            true
        }
      )
  }
}

function createOpaqueState(
  email
) {
  return {
    schemaVersion: 1,
    protocol:
      'OPAQUE-RFC9807',
    serverSetup:
      'server-setup',
    registrations: {
      [email]: {
        email,
        registrationRecord:
          'known-record',
        createdAt:
          1,
        updatedAt:
          1,
        migratedFromV2At:
          1
      }
    },
    pendingEnrollments:
      {},
    pendingLogins:
      {},
    createdAt:
      1,
    updatedAt:
      1
  }
}

function createAccessState(
  email
) {
  const now =
    Date.now()

  return {
    licenses: {
      [email]: {
        email,
        plan:
          'paid_30_days',
        validFrom:
          now - 60_000,
        validUntil:
          now +
          30 * 24 * 60 * 60 * 1000,
        revokedAt:
          null,
        renewalRequestedAt:
          null
      }
    },
    sessions:
      {},
    updatedAt:
      now
  }
}

function createStorage(
  email
) {
  return new MemoryStorage({
    [ACCESS_KEY]:
      createAccessState(
        email
      ),
    [ACCOUNT_AUTH_KEY]: {
      schemaVersion: 1,
      credentials: {
        [email]: {
          email,
          passwordSalt:
            'legacy-salt',
          passwordHash:
            'legacy-hash',
          passwordIterations:
            100_000,
          createdAt:
            1,
          updatedAt:
            1
        }
      },
      createdAt:
        1,
      updatedAt:
        1
    },
    [OPAQUE_KEY]:
      createOpaqueState(
        email
      )
  })
}

function createAccess(
  runtime,
  storage
) {
  return new runtime
    .MaProfessorAccessDurableObject(
      {
        storage,
        blockConcurrencyWhile:
          async callback =>
            callback()
      },
      {}
    )
}

function post(
  pathname,
  body
) {
  return new Request(
    `https://ma-code.pt${pathname}`,
    {
      method:
        'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body:
        JSON.stringify(
          body
        )
    }
  )
}

async function body(
  response
) {
  return response
    .clone()
    .json()
}

test(
  'registered OPAQUE account completes login and issues the existing MA-Professor session contract',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'known@example.com'
    const deviceId =
      'device-known'

    const storage =
      createStorage(
        email
      )

    const legacyBefore =
      storage.snapshot(
        ACCOUNT_AUTH_KEY
      )

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const started =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/start',
          {
            email,
            deviceId,
            startLoginRequest:
              'client-start'
          }
        )
      )

    assert.equal(
      started.status,
      200
    )

    const startBody =
      await body(
        started
      )

    assert.equal(
      startBody.success,
      true
    )
    assert.equal(
      startBody.loginResponse,
      'opaque-login-response'
    )
    assert.equal(
      typeof startBody.loginId,
      'string'
    )

    const finished =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/finish',
          {
            email,
            deviceId,
            loginId:
              startBody.loginId,
            finishLoginRequest:
              'proof:known-record'
          }
        )
      )

    assert.equal(
      finished.status,
      200
    )

    const finishBody =
      await body(
        finished
      )

    assert.equal(
      finishBody.success,
      true
    )
    assert.equal(
      typeof finishBody.token,
      'string'
    )
    assert.equal(
      finishBody.license?.email,
      email
    )

    const accessState =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      Object.values(
        accessState.sessions
      ).some(
        session =>
          session.email ===
            email &&
          session.deviceId ===
            deviceId &&
          session.revokedAt ===
            null
      ),
      true
    )

    const opaqueState =
      storage.snapshot(
        OPAQUE_KEY
      )

    assert.equal(
      Object.keys(
        opaqueState.pendingLogins
      ).length,
      0
    )

    assert.doesNotMatch(
      JSON.stringify(
        opaqueState
      ),
      /password|exportKey|server-session-key/i
    )

    assert.deepEqual(
      storage.snapshot(
        ACCOUNT_AUTH_KEY
      ),
      legacyBefore,
      'O primeiro login OPAQUE comprovado ainda não deve apagar automaticamente a credencial v2.'
    )
  }
)

test(
  'unknown OPAQUE account receives a normal start response but finish fails generically and creates no session',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const knownEmail =
      'known@example.com'
    const missingEmail =
      'missing@example.com'
    const deviceId =
      'device-missing'

    const storage =
      createStorage(
        knownEmail
      )

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const started =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/start',
          {
            email:
              missingEmail,
            deviceId,
            startLoginRequest:
              'client-start-missing'
          }
        )
      )

    assert.equal(
      started.status,
      200
    )

    const startBody =
      await body(
        started
      )

    assert.equal(
      typeof startBody.loginId,
      'string'
    )
    assert.equal(
      typeof startBody.loginResponse,
      'string'
    )

    const finished =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/finish',
          {
            email:
              missingEmail,
            deviceId,
            loginId:
              startBody.loginId,
            finishLoginRequest:
              'anything'
          }
        )
      )

    assert.equal(
      finished.status,
      401
    )

    const finishBody =
      await body(
        finished
      )

    assert.equal(
      finishBody.message,
      'Não foi possível iniciar sessão com estas credenciais.'
    )

    assert.equal(
      Object.keys(
        storage.snapshot(
          OPAQUE_KEY
        ).pendingLogins
      ).length,
      0
    )

    assert.equal(
      Object.keys(
        storage.snapshot(
          ACCESS_KEY
        ).sessions
      ).length,
      0
    )
  }
)

test(
  'OPAQUE finish rejects a different device and consumes the challenge before replay',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'known@example.com'

    const storage =
      createStorage(
        email
      )

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const started =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/start',
          {
            email,
            deviceId:
              'device-a',
            startLoginRequest:
              'client-start-device'
          }
        )
      )

    const startBody =
      await body(
        started
      )

    const mismatch =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/finish',
          {
            email,
            deviceId:
              'device-b',
            loginId:
              startBody.loginId,
            finishLoginRequest:
              'proof:known-record'
          }
        )
      )

    assert.equal(
      mismatch.status,
      401
    )

    const replay =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/login/finish',
          {
            email,
            deviceId:
              'device-a',
            loginId:
              startBody.loginId,
            finishLoginRequest:
              'proof:known-record'
          }
        )
      )

    assert.equal(
      replay.status,
      401
    )

    assert.equal(
      Object.keys(
        storage.snapshot(
          OPAQUE_KEY
        ).pendingLogins
      ).length,
      0
    )
  }
)
