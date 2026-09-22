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

const REQUEST_GUARD_KEY =
  'ma-professor-access-request-guard-v1'

function clone(value) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

class MemoryStorage {
  constructor(initial = {}) {
    this.values =
      new Map(
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
              'Content-Type':
                'application/json'
            }
          }
        )
      }

      export class MaProfessorAccessDurableObject {
        constructor() {}

        async fetch(request) {
          const body =
            await request
              .clone()
              .json()
              .catch(() => ({}))

          delegatedRequests.push({
            method:
              request.method,
            url:
              request.url,
            body
          })

          if (body.token) {
            return json(
              {
                success:
                  false,
                message:
                  'Sessão inválida.'
              },
              401
            )
          }

          if (
            String(body.email || '')
              .startsWith('approved-')
          ) {
            return json({
              success:
                true,
              request: {
                email:
                  body.email,
                status:
                  'approved',
                requestedAt:
                  '2026-09-01T10:00:00.000Z',
                approvedAt:
                  '2026-09-02T10:00:00.000Z',
                rejectedAt:
                  null,
                activatedAt:
                  null
              },
              canActivate:
                true,
              message:
                'Pedido aprovado.'
            })
          }

          return json({
            success:
              true,
            request: {
              email:
                body.email,
              status:
                'pending',
              requestedAt:
                '2026-09-01T10:00:00.000Z',
              approvedAt:
                null,
              rejectedAt:
                null,
              activatedAt:
                null
            },
            canActivate:
              false,
            message:
              'Pedido recebido.'
          })
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
    dispose:
      () =>
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

function request(
  body,
  ip = '203.0.113.10'
) {
  return new Request(
    'https://ma-professor.internal/api/ma-professor/access/request',
    {
      method:
        'POST',
      headers: {
        'Content-Type':
          'application/json',
        'CF-Connecting-IP':
          ip
      },
      body:
        JSON.stringify(
          body
        )
    }
  )
}

test(
  'email-only request masks an approved account state while still creating or querying the real request underneath',
  async t => {
    const {
      guard,
      lower,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const access =
      new guard
        .MaProfessorAccessDurableObject(
          {
            storage:
              new MemoryStorage()
          },
          {}
        )

    const response =
      await access.fetch(
        request({
          email:
            'approved-docente@example.com'
        })
      )

    assert.equal(
      response.status,
      200
    )

    const payload =
      await response.json()

    assert.equal(
      payload.success,
      true
    )
    assert.equal(
      payload.request.status,
      'pending'
    )
    assert.equal(
      payload.canActivate,
      false
    )
    assert.equal(
      payload.request.approvedAt,
      null
    )
    assert.match(
      payload.message,
      /se for aprovado/i
    )
    assert.doesNotMatch(
      payload.message,
      /^Pedido aprovado\.?$/i
    )
    assert.equal(
      lower.delegatedRequests.length,
      1,
      'O pedido email-only deve chegar à implementação real, mas a resposta pública continua genérica.'
    )
  }
)

test(
  'legacy accountPassword payload is rejected and never reaches the lower access implementation',
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
      new guard
        .MaProfessorAccessDurableObject(
          { storage },
          {}
        )

    const response =
      await access.fetch(
        request({
          email:
            'docente@example.com',
          accountPassword:
            'legacy-personal-password'
        })
      )

    assert.equal(
      response.status,
      400
    )

    const payload =
      await response.json()

    assert.match(
      payload.message,
      /fluxo antigo de password pessoal foi descontinuado/i
    )
    assert.equal(
      lower.delegatedRequests.length,
      0
    )
    assert.ok(
      storage.snapshot(
        REQUEST_GUARD_KEY
      ),
      'A tentativa pública continua sujeita ao rate limit mesmo sendo rejeitada por usar o payload antigo.'
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
      new guard
        .MaProfessorAccessDurableObject(
          { storage },
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
            {
              email:
                `docente-${index}@example.com`
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
              'bloqueado@example.com'
          },
          ip
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

    const serialized =
      JSON.stringify(
        guardState
      )

    assert.doesNotMatch(
      serialized,
      /203\.0\.113\.24/
    )
  }
)

test(
  'blocked origins do not keep delegating and session-token requests bypass the public signup guard',
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
      new guard
        .MaProfessorAccessDurableObject(
          { storage },
          {}
        )

    const headersIp =
      '198.51.100.8'

    for (
      let index = 0;
      index < 31;
      index += 1
    ) {
      await access.fetch(
        request(
          {
            email:
              `limite-${index}@example.com`
          },
          headersIp
        )
      )
    }

    const delegatedAtBlock =
      lower.delegatedRequests.length

    const blockedAgain =
      await access.fetch(
        request(
          {
            email:
              'outra@example.com'
          },
          headersIp
        )
      )

    assert.equal(
      blockedAgain.status,
      429
    )
    assert.equal(
      lower.delegatedRequests.length,
      delegatedAtBlock
    )

    const sessionRequest =
      await access.fetch(
        request(
          {
            email:
              'docente@example.com',
            plan:
              'paid_30_days',
            token:
              'session-token',
            deviceId:
              'device-123456789'
          },
          headersIp
        )
      )

    assert.equal(
      sessionRequest.status,
      401
    )
    assert.equal(
      lower.delegatedRequests.length,
      delegatedAtBlock + 1
    )
  }
)

test(
  'request guard state remains bounded when Cloudflare origins rotate',
  async t => {
    const {
      guard,
      dispose
    } = await stageGuard()

    t.after(dispose)

    const storage =
      new MemoryStorage()

    const access =
      new guard
        .MaProfessorAccessDurableObject(
          { storage },
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
            {
              email:
                `rotacao-${index}@example.com`
            },
            `192.0.${third}.${fourth}`
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
