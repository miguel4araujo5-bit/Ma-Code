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

const ACCOUNT_AUTH_KEY =
  'ma-professor-account-auth-v1'

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
        'ma-professor-enumeration-guard-'
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

      function json(body, status = 200) {
        return new Response(
          JSON.stringify(body),
          {
            status,
            headers: {
              'Content-Type': 'application/json'
            }
          }
        )
      }

      export class MaProfessorAccessDurableObject {
        constructor() {}

        async fetch(request) {
          const body = await request.clone().json().catch(() => ({}))

          delegatedRequests.push({
            method: request.method,
            url: request.url,
            body
          })

          if (body.accountPassword === 'wrong-password') {
            return json(
              {
                success: false,
                message:
                  'Já existe uma password pessoal definida para esta conta.'
              },
              409
            )
          }

          if (body.accountPassword === 'right-password') {
            return json({
              success: true,
              request: {
                email: body.email,
                status: 'approved',
                requestedAt: '2026-09-01T10:00:00.000Z',
                approvedAt: '2026-09-02T10:00:00.000Z',
                rejectedAt: null,
                activatedAt: null
              },
              canActivate: true,
              hasPersonalPassword: true,
              message: 'Pedido aprovado.'
            })
          }

          return json({
            success: false,
            message: 'Sessão inválida.'
          }, 401)
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
  body,
  ip = '203.0.113.10'
) {
  return new Request(
    'https://ma-professor.internal/api/ma-professor/access/request',
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json',
        'CF-Connecting-IP':
          ip
      },
      body:
        JSON.stringify(body)
    }
  )
}

function accountAuthState(email) {
  return {
    schemaVersion: 1,
    credentials: {
      [email]: {
        exists: true
      }
    },
    createdAt: 1,
    updatedAt: 1
  }
}

test(
  'wrong personal password no longer confirms that an account exists',
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
        [ACCOUNT_AUTH_KEY]:
          accountAuthState(email)
      })

    const access =
      new guard.MaProfessorAccessDurableObject(
        { storage },
        {}
      )

    const response =
      await access.fetch(
        request({
          email,
          accountPassword:
            'wrong-password'
        })
      )

    assert.equal(
      response.status,
      200
    )

    const body =
      await response.json()

    assert.equal(
      body.success,
      true
    )
    assert.equal(
      body.request.status,
      'pending'
    )
    assert.equal(
      body.canActivate,
      false
    )
    assert.doesNotMatch(
      body.message,
      /já existe|aprovado|rejeitado/i
    )
    assert.equal(
      lower.delegatedRequests.length,
      1,
      'A implementação inferior continua a validar a password sem revelar o resultado público específico.'
    )
  }
)

test(
  'correct existing personal password still reveals the real request state',
  async t => {
    const {
      guard,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const email =
      'docente@example.com'

    const storage =
      new MemoryStorage({
        [ACCOUNT_AUTH_KEY]:
          accountAuthState(email)
      })

    const access =
      new guard.MaProfessorAccessDurableObject(
        { storage },
        {}
      )

    const response =
      await access.fetch(
        request({
          email,
          accountPassword:
            'right-password'
        })
      )

    assert.equal(
      response.status,
      200
    )

    const body =
      await response.json()

    assert.equal(
      body.request.status,
      'approved'
    )
    assert.equal(
      body.canActivate,
      true
    )
    assert.equal(
      body.hasPersonalPassword,
      true
    )
  }
)

test(
  'first password definition masks an approved or pending state until the password is proven on a later request',
  async t => {
    const {
      guard,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const email =
      'primeiro-contacto@example.com'

    const storage =
      new MemoryStorage()

    const access =
      new guard.MaProfessorAccessDurableObject(
        { storage },
        {}
      )

    const response =
      await access.fetch(
        request({
          email,
          accountPassword:
            'right-password'
        })
      )

    assert.equal(
      response.status,
      200
    )

    const body =
      await response.json()

    assert.equal(
      body.request.status,
      'pending'
    )
    assert.equal(
      body.canActivate,
      false
    )
    assert.equal(
      body.request.approvedAt,
      null
    )
    assert.doesNotMatch(
      body.message,
      /aprovado|rejeitado/i
    )
  }
)

test(
  'email-only public request cannot query or create account state and still counts for rate limiting',
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
        { storage },
        {}
      )

    const ip =
      '203.0.113.44'

    for (
      let index = 0;
      index < 30;
      index += 1
    ) {
      const response =
        await access.fetch(
          request(
            {
              email:
                `probe-${index}@example.com`
            },
            ip
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
          {
            email:
              'probe-blocked@example.com'
          },
          ip
        )
      )

    assert.equal(
      blocked.status,
      429
    )
    assert.equal(
      lower.delegatedRequests.length,
      0,
      'Uma consulta pública só por email não deve chegar à camada que lê/cria pedidos.'
    )

    const guardState =
      storage.snapshot(
        REQUEST_GUARD_KEY
      )

    assert.ok(guardState)
    assert.equal(
      Object.keys(
        guardState.buckets
      ).length,
      1
    )
  }
)

test(
  'session-token request bypasses public enumeration masking and rate-limit bucket creation',
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
        { storage },
        {}
      )

    const response =
      await access.fetch(
        request({
          email:
            'docente@example.com',
          plan:
            'paid_30_days',
          token:
            'session-token',
          deviceId:
            'device-123456789'
        })
      )

    assert.equal(
      response.status,
      401
    )
    assert.equal(
      lower.delegatedRequests.length,
      1
    )
    assert.equal(
      storage.snapshot(
        REQUEST_GUARD_KEY
      ),
      undefined,
      'Pedidos com token não devem consumir o rate limit público de pedidos de acesso.'
    )
  }
)
