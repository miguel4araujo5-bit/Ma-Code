import assert from 'node:assert/strict'
import {
  webcrypto
} from 'node:crypto'
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
const ACCOUNT_AUTH_KEY =
  'ma-professor-account-auth-v1'
const ACTIVATION_GUARD_KEY =
  'ma-professor-activation-guard-v1'

let deriveBitsCalls = 0

const instrumentedCrypto = {
  getRandomValues(array) {
    return webcrypto.getRandomValues(array)
  },
  randomUUID() {
    return webcrypto.randomUUID()
  },
  subtle: {
    importKey(...args) {
      return webcrypto.subtle.importKey(...args)
    },
    deriveBits(...args) {
      deriveBitsCalls += 1
      return webcrypto.subtle.deriveBits(...args)
    },
    digest(...args) {
      return webcrypto.subtle.digest(...args)
    }
  }
}

Object.defineProperty(
  globalThis,
  'crypto',
  {
    value: instrumentedCrypto,
    configurable: true
  }
)

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
        ])
    )
    this.putCalls = []
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(key, value) {
    this.putCalls.push({
      key,
      value: clone(value)
    })
    this.values.set(
      key,
      clone(value)
    )
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
  const testSource =
    source
      .replaceAll(
        "'./maProfessorActivationCredentialGuardBridge'",
        "'./maProfessorActivationCredentialGuardBridge.mjs'"
      )
      .replaceAll(
        '"./maProfessorActivationCredentialGuardBridge"',
        '"./maProfessorActivationCredentialGuardBridge.mjs"'
      )
      .replace(
        'const PASSWORD_HASH_ITERATIONS =\n  100_000',
        'const PASSWORD_HASH_ITERATIONS =\n  10_000'
      )

  const output =
    ts.transpileModule(
      testSource,
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

async function stageBridge() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-public-auth-privacy-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorPublicAuthPrivacyBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorPublicAuthPrivacyBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorPublicAuthPrivacyBridge.ts'
    ),
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorActivationCredentialGuardBridge.mjs'
    ),
    `
      export const calls = []
      let responseStatus = 200
      let responseBody = {
        success: true
      }

      export function resetCalls() {
        calls.length = 0
      }

      export function setResponse(status, body) {
        responseStatus = status
        responseBody = structuredClone(body)
      }

      export class MaProfessorAccessDurableObject {
        constructor(state) {
          this.state = state
        }

        async fetch(request) {
          let body = null

          try {
            body = await request.clone().json()
          } catch {}

          calls.push({
            url: request.url,
            method: request.method,
            body
          })

          return new Response(
            JSON.stringify(responseBody),
            {
              status: responseStatus,
              headers: {
                'Content-Type':
                  'application/json; charset=utf-8'
              }
            }
          )
        }
      }
    `,
    'utf8'
  )

  const runtime =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorPublicAuthPrivacyBridge.mjs'
        )
      ).href
    )

  const lower =
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
    lower,
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

async function hashPassword(
  password,
  salt,
  iterations = 10_000
) {
  const key =
    await webcrypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )

  const bits =
    await webcrypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      key,
      256
    )

  return Buffer.from(
    new Uint8Array(bits)
  ).toString('base64')
}

async function activationCredential(
  email,
  password
) {
  const salt =
    new Uint8Array(16)

  salt.fill(7)

  return {
    email,
    passwordSalt:
      Buffer.from(salt)
        .toString('base64'),
    passwordHash:
      await hashPassword(
        password,
        salt
      ),
    passwordIterations:
      10_000
  }
}

async function sessionEntry(
  token,
  email,
  deviceId
) {
  const digest =
    await webcrypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    )

  const tokenHash =
    Buffer.from(
      new Uint8Array(digest)
    ).toString('base64')

  return [
    tokenHash,
    {
      tokenHash,
      email,
      deviceId,
      revokedAt: null
    }
  ]
}

function postRequest(
  path,
  body,
  connectingIp
) {
  const headers = {
    'Content-Type':
      'application/json'
  }

  if (connectingIp) {
    headers['CF-Connecting-IP'] =
      connectingIp
  }

  return new Request(
    `https://ma-code.pt${path}`,
    {
      method: 'POST',
      headers,
      body:
        JSON.stringify(body)
    }
  )
}

function instantiate(
  runtime,
  storage
) {
  return new runtime.MaProfessorAccessDurableObject(
    {
      storage
    },
    {}
  )
}

async function responseBody(response) {
  return response.json()
}

test(
  'missing login credential consumes one dummy PBKDF2 pass while an existing credential does not add a second bridge-local pass',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    staged.lower.setResponse(
      401,
      {
        success: false,
        message: 'lower failure'
      }
    )

    const missingStorage =
      new MemoryStorage({
        [ACCOUNT_AUTH_KEY]: {
          schemaVersion: 1,
          credentials: {}
        }
      })

    const missingAccess =
      instantiate(
        staged.runtime,
        missingStorage
      )

    const beforeMissing =
      deriveBitsCalls

    const missingResponse =
      await missingAccess.fetch(
        postRequest(
          '/api/ma-professor/access/login',
          {
            email:
              'missing@example.com',
            password:
              'password-123',
            deviceId:
              'device-123456789'
          }
        )
      )

    assert.equal(
      missingResponse.status,
      401
    )
    assert.equal(
      deriveBitsCalls -
        beforeMissing,
      1,
      'A ausência de credencial deve suportar o mesmo custo PBKDF2 do caminho de password incorreta.'
    )

    const existingStorage =
      new MemoryStorage({
        [ACCOUNT_AUTH_KEY]: {
          schemaVersion: 1,
          credentials: {
            'known@example.com': {}
          }
        }
      })

    const existingAccess =
      instantiate(
        staged.runtime,
        existingStorage
      )

    const beforeExisting =
      deriveBitsCalls

    const existingResponse =
      await existingAccess.fetch(
        postRequest(
          '/api/ma-professor/access/login',
          {
            email:
              'known@example.com',
            password:
              'password-123',
            deviceId:
              'device-123456789'
          }
        )
      )

    assert.equal(
      existingResponse.status,
      401
    )
    assert.equal(
      deriveBitsCalls -
        beforeExisting,
      0,
      'A camada exterior não deve duplicar o PBKDF2 que o autenticador real já executa para uma credencial existente.'
    )
  }
)

test(
  'unknown activation and wrong activation password have the same public response and never reach lower account-state branches',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    staged.lower.resetCalls()

    const credential =
      await activationCredential(
        'known@example.com',
        'RIGHT-ACTIVATION'
      )

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {
            'known@example.com':
              credential
          }
        }
      })

    const access =
      instantiate(
        staged.runtime,
        storage
      )

    const unknownResponse =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'missing@example.com',
            activationPassword:
              'WRONG-ACTIVATION',
            deviceId:
              'device-123456789'
          },
          '203.0.113.10'
        )
      )

    const wrongResponse =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'known@example.com',
            activationPassword:
              'WRONG-ACTIVATION',
            deviceId:
              'device-123456789'
          },
          '203.0.113.10'
        )
      )

    assert.equal(
      unknownResponse.status,
      401
    )
    assert.equal(
      wrongResponse.status,
      401
    )

    assert.deepEqual(
      await responseBody(
        unknownResponse
      ),
      await responseBody(
        wrongResponse
      )
    )

    assert.equal(
      staged.lower.calls.length,
      0,
      'Uma senha de ativação não validada não pode alcançar os ramos que revelam pedido, pagamento, licença ou password pessoal.'
    )

    const guardState =
      storage.snapshot(
        ACTIVATION_GUARD_KEY
      )

    const serialized =
      JSON.stringify(
        guardState
      )

    assert.ok(guardState)
    assert.doesNotMatch(
      serialized,
      /203\.0\.113\.10/
    )
    assert.doesNotMatch(
      serialized,
      /known@example\.com/
    )
    assert.doesNotMatch(
      serialized,
      /missing@example\.com/
    )
  }
)

test(
  'correct activation secret delegates unchanged so legitimate detailed state is only visible after proof of the secret',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    staged.lower.resetCalls()
    staged.lower.setResponse(
      409,
      {
        success: false,
        message:
          'Estado legítimo disponível após validação da senha.'
      }
    )

    const credential =
      await activationCredential(
        'known@example.com',
        'RIGHT-ACTIVATION'
      )

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {
            'known@example.com':
              credential
          }
        }
      })

    const access =
      instantiate(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'known@example.com',
            activationPassword:
              'RIGHT-ACTIVATION',
            deviceId:
              'device-123456789'
          },
          '203.0.113.11'
        )
      )

    assert.equal(response.status, 409)
    assert.equal(
      staged.lower.calls.length,
      1
    )
    assert.equal(
      (
        await responseBody(
          response
        )
      ).message,
      'Estado legítimo disponível após validação da senha.'
    )
  }
)

test(
  'activation failures are bounded by origin and origin-account without a global email lockout',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    staged.lower.resetCalls()

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {}
        }
      })

    const access =
      instantiate(
        staged.runtime,
        storage
      )

    for (
      let attempt = 1;
      attempt <= 7;
      attempt += 1
    ) {
      const response =
        await access.fetch(
          postRequest(
            '/api/ma-professor/access/activate',
            {
              email:
                'victim@example.com',
              activationPassword:
                'WRONG-ACTIVATION',
              deviceId:
                'device-123456789'
            },
            '203.0.113.20'
          )
        )

      assert.equal(
        response.status,
        401
      )
    }

    const blockedResponse =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'victim@example.com',
            activationPassword:
              'WRONG-ACTIVATION',
            deviceId:
              'device-123456789'
          },
          '203.0.113.20'
        )
      )

    assert.equal(
      blockedResponse.status,
      429
    )
    assert.ok(
      Number(
        blockedResponse.headers.get(
          'Retry-After'
        )
      ) > 0
    )

    const otherOriginResponse =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'victim@example.com',
            activationPassword:
              'WRONG-ACTIVATION',
            deviceId:
              'device-123456789'
          },
          '203.0.113.21'
        )
      )

    assert.equal(
      otherOriginResponse.status,
      401,
      'Uma origem atacante não deve bloquear globalmente o email da vítima.'
    )
  }
)

test(
  'activation without trusted Cloudflare origin stays generic without persisting a spoofable fallback bucket',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {}
        }
      })

    const access =
      instantiate(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/activate',
          {
            email:
              'missing@example.com',
            activationPassword:
              'WRONG-ACTIVATION',
            deviceId:
              'device-123456789'
          }
        )
      )

    assert.equal(response.status, 401)
    assert.equal(
      storage.putsFor(
        ACTIVATION_GUARD_KEY
      ).length,
      0
    )
  }
)

test(
  'public commerce status requires a valid session and ignores any caller supplied email',
  async t => {
    const staged =
      await stageBridge()
    t.after(staged.dispose)

    staged.lower.resetCalls()
    staged.lower.setResponse(
      200,
      {
        success: true,
        commerce: {
          email:
            'session@example.com'
        }
      }
    )

    const token =
      'session-token-123'
    const deviceId =
      'device-123456789'
    const [
      tokenHash,
      session
    ] =
      await sessionEntry(
        token,
        'session@example.com',
        deviceId
      )

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          sessions: {
            [tokenHash]:
              session
          }
        }
      })

    const access =
      instantiate(
        staged.runtime,
        storage
      )

    const unauthenticated =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/commerce/status',
          {
            email:
              'victim@example.com'
          }
        )
      )

    assert.equal(
      unauthenticated.status,
      401
    )
    assert.equal(
      staged.lower.calls.length,
      0
    )

    const authenticated =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/commerce/status',
          {
            email:
              'victim@example.com',
            token,
            deviceId
          }
        )
      )

    assert.equal(
      authenticated.status,
      200
    )
    assert.equal(
      staged.lower.calls.length,
      1
    )
    assert.equal(
      staged.lower.calls[0]
        .body.email,
      'session@example.com',
      'O email consultado deve ser sempre derivado da sessão autenticada.'
    )

    staged.lower.resetCalls()

    const wrongDevice =
      await access.fetch(
        postRequest(
          '/api/ma-professor/access/commerce/status',
          {
            token,
            deviceId:
              'different-device-123'
          }
        )
      )

    assert.equal(
      wrongDevice.status,
      401
    )
    assert.equal(
      staged.lower.calls.length,
      0
    )
  }
)

test(
  'production chain keeps login throttling outside privacy hardening and adds no Cloudflare binding or migration',
  async () => {
    const [
      retention,
      loginGuard,
      privacy,
      wrangler
    ] = await Promise.all([
      readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(
          '../../worker/maProfessorLoginAttemptGuardBridge.ts',
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(
          '../../worker/maProfessorPublicAuthPrivacyBridge.ts',
          import.meta.url
        ),
        'utf8'
      ),
      readFile(
        new URL(
          '../../wrangler.jsonc',
          import.meta.url
        ),
        'utf8'
      )
    ])

    assert.match(
      retention,
      /from '\.\/maProfessorLoginAttemptGuardBridge'/
    )
    assert.match(
      loginGuard,
      /from '\.\/maProfessorPublicAuthPrivacyBridge'/
    )
    assert.match(
      privacy,
      /from '\.\/maProfessorActivationCredentialGuardBridge'/
    )
    assert.match(
      privacy,
      /const PASSWORD_HASH_ITERATIONS =\s*100_000/
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-activation-guard-v1/i
    )
    assert.doesNotMatch(
      wrangler,
      /PublicAuthPrivacy/i
    )
  }
)
