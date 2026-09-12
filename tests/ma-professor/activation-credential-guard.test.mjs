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

const REQUEST_GUARD_KEY =
  'ma-professor-access-request-guard-v1'

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
    this.putCalls = 0
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(key, value) {
    this.putCalls += 1
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
    (output.diagnostics || []).filter(
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
    .replaceAll(
      "'./maProfessorExplicitApprovalBridge'",
      "'./maProfessorExplicitApprovalBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorExplicitApprovalBridge"',
      '"./maProfessorExplicitApprovalBridge.mjs"'
    )
}

async function stageGuard() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-credential-guard-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorActivationCredentialGuardBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorActivationCredentialGuardBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorActivationCredentialGuardBridge.ts'
    ),
    'utf8'
  )

  await writeFile(
    join(
      directory,
      'maProfessorExplicitApprovalBridge.mjs'
    ),
    `
      export const delegatedRequests = []

      export class MaProfessorAccessDurableObject {
        constructor() {}

        async fetch(request) {
          delegatedRequests.push({
            method: request.method,
            url: request.url,
            body: await request.clone().text()
          })

          return new Response(
            JSON.stringify({
              success: true,
              delegated: true
            }),
            {
              status: 200,
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

  const guard =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorActivationCredentialGuardBridge.mjs'
        )
      ).href
    )

  const lower =
    await import(
      pathToFileURL(
        join(
          directory,
          'maProfessorExplicitApprovalBridge.mjs'
        )
      ).href
    )

  return {
    guard,
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

function request(
  pathname,
  body,
  method = 'POST',
  extraHeaders = {}
) {
  return new Request(
    `https://ma-professor.internal${pathname}`,
    {
      method,
      headers: {
        'Content-Type':
          'application/json',
        ...extraHeaders
      },
      body:
        method === 'POST'
          ? JSON.stringify(body)
          : undefined
    }
  )
}

function existingCredential(email) {
  return {
    email,
    passwordSalt:
      'salt',
    passwordHash:
      'hash',
    passwordIterations:
      100_000,
    createdAt:
      1,
    updatedAt:
      1
  }
}

test(
  'manual generation cannot replace an activation credential that was already issued',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const email =
      'docente@example.com'

    const originalState = {
      credentials: {
        [email]:
          existingCredential(
            email
          )
      }
    }

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]:
          originalState
      })

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    const response =
      await access.fetch(
        request(
          '/__internal/ma-professor/admin/credentials/generate',
          {
            email
          }
        )
      )

    assert.equal(
      response.status,
      409
    )

    const body =
      await response.json()

    assert.equal(
      body.success,
      false
    )
    assert.match(
      body.message,
      /senha existente foi preservada/i
    )
    assert.equal(
      lower.delegatedRequests.length,
      0,
      'O pedido destrutivo não pode chegar à implementação que gera e substitui a credencial.'
    )
    assert.deepEqual(
      storage.snapshot(
        ACCESS_KEY
      ),
      originalState,
      'A credencial já enviada tem de permanecer exatamente igual.'
    )
  }
)

test(
  'first credential generation is still delegated when no activation credential exists',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {}
        }
      })

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    const response =
      await access.fetch(
        request(
          '/__internal/ma-professor/admin/credentials/generate',
          {
            email:
              'novo@example.com'
          }
        )
      )

    assert.equal(
      response.status,
      200
    )
    assert.equal(
      lower.delegatedRequests.length,
      1
    )
  }
)

test(
  'activation requests remain untouched by the credential rotation guard',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const email =
      'docente@example.com'

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          credentials: {
            [email]:
              existingCredential(
                email
              )
          }
        }
      })

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    const response =
      await access.fetch(
        request(
          '/api/ma-professor/access/activate',
          {
            email,
            activationPassword:
              'MP-AAAA-BBBB-CCCC-DDDD',
            deviceId:
              'device-01'
          }
        )
      )

    assert.equal(
      response.status,
      200
    )
    assert.equal(
      lower.delegatedRequests.length,
      1
    )
  }
)

test(
  'public account creation is rate limited per Cloudflare origin without storing the raw IP',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const storage =
      new MemoryStorage()

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    const ip =
      '203.0.113.24'

    for (
      let index = 0;
      index < 30;
      index += 1
    ) {
      const response =
        await access.fetch(
          request(
            '/api/ma-professor/access/request',
            {
              email:
                `docente-${index}@example.com`,
              accountPassword:
                'password-segura'
            },
            'POST',
            {
              'CF-Connecting-IP':
                ip
            }
          )
        )

      assert.equal(
        response.status,
        200
      )
    }

    const blocked =
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email:
              'bloqueado@example.com',
            accountPassword:
              'password-segura'
          },
          'POST',
          {
            'CF-Connecting-IP':
              ip
          }
        )
      )

    assert.equal(
      blocked.status,
      429
    )
    assert.ok(
      Number(
        blocked.headers.get(
          'Retry-After'
        )
      ) > 0
    )
    assert.equal(
      lower.delegatedRequests.length,
      30
    )

    const guardState =
      storage.snapshot(
        REQUEST_GUARD_KEY
      )

    assert.equal(
      Object.keys(
        guardState.buckets
      ).length,
      1
    )

    const [bucketKey] =
      Object.keys(
        guardState.buckets
      )

    assert.match(
      bucketKey,
      /^[a-f0-9]{64}$/
    )
    assert.doesNotMatch(
      JSON.stringify(
        guardState
      ),
      new RegExp(
        ip.replaceAll(
          '.',
          '\\.'
        )
      )
    )
  }
)

test(
  'blocked access request origins do not keep writing and non-signup request flows are not throttled',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const storage =
      new MemoryStorage()

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    const headers = {
      'CF-Connecting-IP':
        '198.51.100.8'
    }

    for (
      let index = 0;
      index < 31;
      index += 1
    ) {
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email:
              `limite-${index}@example.com`,
            accountPassword:
              'password-segura'
          },
          'POST',
          headers
        )
      )
    }

    const writesAtBlock =
      storage.putCalls

    const blockedAgain =
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email:
              'outra@example.com',
            accountPassword:
              'password-segura'
          },
          'POST',
          headers
        )
      )

    assert.equal(
      blockedAgain.status,
      429
    )
    assert.equal(
      storage.putCalls,
      writesAtBlock,
      'Depois de a origem estar bloqueada, novas tentativas não devem gerar mais escritas no Durable Object.'
    )

    const renewalLikeRequest =
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email:
              'docente@example.com',
            plan:
              'paid_30_days',
            token:
              'token',
            deviceId:
              'device'
          },
          'POST',
          headers
        )
      )

    assert.equal(
      renewalLikeRequest.status,
      200
    )
    assert.equal(
      lower.delegatedRequests.length,
      31,
      'Os 30 pedidos iniciais e o fluxo sem accountPassword devem continuar a ser delegados.'
    )
  }
)

test(
  'request guard state remains bounded even when origins rotate',
  async t => {
    const {
      guard,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const storage =
      new MemoryStorage()

    const access =
      new guard.MaProfessorAccessDurableObject(
        {
          storage
        },
        {}
      )

    for (
      let index = 0;
      index < 260;
      index += 1
    ) {
      const third =
        Math.floor(
          index / 250
        )
      const fourth =
        index % 250 + 1

      const response =
        await access.fetch(
          request(
            '/api/ma-professor/access/request',
            {
              email:
                `rotacao-${index}@example.com`,
              accountPassword:
                'password-segura'
            },
            'POST',
            {
              'CF-Connecting-IP':
                `192.0.${third}.${fourth}`
            }
          )
        )

      assert.equal(
        response.status,
        200
      )
    }

    const guardState =
      storage.snapshot(
        REQUEST_GUARD_KEY
      )

    assert.equal(
      Object.keys(
        guardState.buckets
      ).length,
      256
    )
  }
)
