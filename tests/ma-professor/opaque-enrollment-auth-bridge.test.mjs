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
      this.values.get(
        key
      )
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
      this.values.get(
        key
      )
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
        'ma-professor-opaque-enrollment-'
      )
    )

  const files = [
    'maProfessorOpaqueAuthState',
    'maProfessorOpaqueAuthProtocol',
    'maProfessorAccessAuthBridge'
  ]

  for (
    const moduleName of
    files
  ) {
    let source =
      await readFile(
        new URL(
          `../../worker/${moduleName}.ts`,
          import.meta.url
        ),
        'utf8'
      )

    source =
      source
        .replaceAll(
          "'./maProfessorAccessAdminBridge'",
          "'./maProfessorAccessAdminBridge.mjs'"
        )
        .replaceAll(
          '"./maProfessorAccessAdminBridge"',
          '"./maProfessorAccessAdminBridge.mjs"'
        )
        .replaceAll(
          "'./maProfessorOpaqueAuthState'",
          "'./maProfessorOpaqueAuthState.mjs'"
        )
        .replaceAll(
          '"./maProfessorOpaqueAuthState"',
          '"./maProfessorOpaqueAuthState.mjs"'
        )
        .replaceAll(
          "'./maProfessorOpaqueAuthProtocol'",
          "'./maProfessorOpaqueAuthProtocol.mjs'"
        )
        .replaceAll(
          '"./maProfessorOpaqueAuthProtocol"',
          '"./maProfessorOpaqueAuthProtocol.mjs"'
        )
        .replaceAll(
          "'./maProfessorOpaqueServerRuntime'",
          "'./maProfessorOpaqueServerRuntime.mjs'"
        )
        .replaceAll(
          '"./maProfessorOpaqueServerRuntime"',
          '"./maProfessorOpaqueServerRuntime.mjs"'
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

        createServerRegistrationResponse({
          serverSetup,
          userIdentifier,
          registrationRequest
        }) {
          calls.push({
            operation: 'registration',
            serverSetup,
            userIdentifier,
            registrationRequest
          })

          return {
            registrationResponse:
              'registration-response'
          }
        },

        startServerLogin() {
          throw new Error(
            'login is not part of this enrollment test'
          )
        },

        finishServerLogin() {
          throw new Error(
            'login is not part of this enrollment test'
          )
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

  const opaqueRuntime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorOpaqueServerRuntime.mjs'
        )
      ).href
    )

  return {
    runtime,
    opaqueRuntime,
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

function bytesToBase64(
  bytes
) {
  let binary = ''

  for (
    const byte of bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(binary)
}

async function hashSessionToken(
  token
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(token)
    )

  return bytesToBase64(
    new Uint8Array(
      digest
    )
  )
}

async function createCredential(
  email,
  password
) {
  const salt =
    Uint8Array.from(
      { length: 16 },
      (_, index) =>
        index + 1
    )

  const imported =
    await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder()
        .encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )

  const bits =
    await globalThis.crypto.subtle.deriveBits(
      {
        name:
          'PBKDF2',
        salt,
        iterations:
          100_000,
        hash:
          'SHA-256'
      },
      imported,
      256
    )

  return {
    email,
    passwordSalt:
      bytesToBase64(
        salt
      ),
    passwordHash:
      bytesToBase64(
        new Uint8Array(
          bits
        )
      ),
    passwordIterations:
      100_000,
    createdAt:
      1,
    updatedAt:
      1
  }
}

async function createStorage({
  email,
  activationPassword
}) {
  return new MemoryStorage({
    [ACCESS_KEY]: {
      sessions:
        {},
      accessRequests: {
        [email]: {
          email,
          activatedAt:
            null
        }
      },
      credentials: {
        [email]:
          await createCredential(
            email,
            activationPassword
          )
      },
      updatedAt:
        1
    }
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

async function responseBody(
  response
) {
  return response
    .clone()
    .json()
}

test(
  'valid MP activation secret can authorize first OPAQUE enrollment without a personal password payload',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'teacher@example.com'
    const activationPassword =
      'MP-TEST-1234'
    const deviceId =
      'device-opaque-01'

    const storage =
      await createStorage({
        email,
        activationPassword
      })

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const startResponse =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/enroll/start',
          {
            email,
            activationPassword,
            deviceId,
            registrationRequest:
              'client-registration-request'
          }
        )
      )

    assert.equal(
      startResponse.status,
      200
    )

    const startBody =
      await responseBody(
        startResponse
      )

    assert.equal(
      startBody.success,
      true
    )
    assert.equal(
      startBody.registrationResponse,
      'registration-response'
    )
    assert.equal(
      typeof startBody.enrollmentId,
      'string'
    )

    const pendingState =
      storage.snapshot(
        OPAQUE_KEY
      )

    assert.equal(
      Object.keys(
        pendingState.pendingEnrollments
      ).length,
      1
    )

    const finishResponse =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/enroll/finish',
          {
            email,
            deviceId,
            enrollmentId:
              startBody.enrollmentId,
            registrationRecord:
              'opaque-registration-record'
          }
        )
      )

    assert.equal(
      finishResponse.status,
      200
    )

    const opaqueState =
      storage.snapshot(
        OPAQUE_KEY
      )

    assert.equal(
      opaqueState
        .registrations[
          email
        ]
        .registrationRecord,
      'opaque-registration-record'
    )

    assert.equal(
      opaqueState
        .registrations[
          email
        ]
        .migratedFromV2At,
      null
    )

    assert.equal(
      Object.keys(
        opaqueState
          .pendingEnrollments
      ).length,
      0
    )
  }
)

test(
  'wrong MP activation secret cannot create OPAQUE enrollment state',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'teacher@example.com'

    const storage =
      await createStorage({
        email,
        activationPassword:
          'MP-CORRECT-1234'
      })

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/enroll/start',
          {
            email,
            activationPassword:
              'MP-WRONG-9999',
            deviceId:
              'device-opaque-02',
            registrationRequest:
              'client-registration-request'
          }
        )
      )

    assert.equal(
      response.status,
      401
    )

    assert.equal(
      storage.snapshot(
        OPAQUE_KEY
      ),
      undefined
    )

    assert.equal(
      staged
        .opaqueRuntime
        .calls
        .length,
      0
    )
  }
)

test(
  'OPAQUE enrollment finish is bound to the device and consumes a mismatched challenge',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'teacher@example.com'
    const activationPassword =
      'MP-BOUND-1234'
    const deviceId =
      'device-opaque-03'

    const storage =
      await createStorage({
        email,
        activationPassword
      })

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const started =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/enroll/start',
          {
            email,
            activationPassword,
            deviceId,
            registrationRequest:
              'client-registration-request'
          }
        )
      )

    const startBody =
      await responseBody(
        started
      )

    const mismatch =
      await access.fetch(
        post(
          '/api/ma-professor/access/opaque/enroll/finish',
          {
            email,
            deviceId:
              'other-device',
            enrollmentId:
              startBody.enrollmentId,
            registrationRecord:
              'opaque-registration-record'
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
          '/api/ma-professor/access/opaque/enroll/finish',
          {
            email,
            deviceId,
            enrollmentId:
              startBody.enrollmentId,
            registrationRecord:
              'opaque-registration-record'
          }
        )
      )

    assert.equal(
      replay.status,
      401
    )
  }
)

test(
  'activation cannot complete before OPAQUE registration exists',
  async t => {
    const staged =
      await stageAuthBridge()

    t.after(
      staged.dispose
    )

    const email =
      'teacher@example.com'
    const activationPassword =
      'MP-FIRST-1234'

    const storage =
      await createStorage({
        email,
        activationPassword
      })

    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        post(
          '/api/ma-professor/access/activate',
          {
            email,
            activationPassword,
            deviceId:
              'device-first-activation'
          }
        )
      )

    assert.equal(
      response.status,
      409
    )

    const payload =
      await responseBody(
        response
      )

    assert.match(
      payload.message,
      /Crie primeiro a sua password pessoal/
    )
  }
)
