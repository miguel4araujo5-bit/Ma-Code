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

const LOGIN_GUARD_KEY =
  'ma-professor-login-guard-v1'

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
    this.getCalls = []
  }

  async get(key) {
    this.getCalls.push(key)

    return clone(
      this.values.get(key)
    )
  }

  async put(key, value) {
    this.putCalls.push({
      key,
      value:
        clone(value)
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
      "'./maProfessorActivationCredentialGuardBridge'",
      "'./maProfessorActivationCredentialGuardBridge.mjs'"
    )
    .replaceAll(
      '"./maProfessorActivationCredentialGuardBridge"',
      '"./maProfessorActivationCredentialGuardBridge.mjs"'
    )
}

async function stageGuard() {
  const directory =
    await mkdtemp(
      join(
        tmpdir(),
        'ma-professor-login-guard-'
      )
    )

  const source =
    await readFile(
      new URL(
        '../../worker/maProfessorLoginAttemptGuardBridge.ts',
        import.meta.url
      ),
      'utf8'
    )

  await writeFile(
    join(
      directory,
      'maProfessorLoginAttemptGuardBridge.mjs'
    ),
    transpile(
      source,
      'maProfessorLoginAttemptGuardBridge.ts'
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

      function json(body, status) {
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
        constructor(state) {
          this.state = state
        }

        async fetch(request) {
          const body =
            await request.clone().json()

          calls.push({
            email: body.email,
            password: body.password,
            ip:
              request.headers.get(
                'CF-Connecting-IP'
              )
          })

          if (
            body.password ===
              'correct-password'
          ) {
            return json(
              {
                success: true,
                message:
                  'Sessão iniciada.'
              },
              200
            )
          }

          if (
            body.password ===
              'correct-no-license'
          ) {
            return json(
              {
                success: false,
                message:
                  'Esta conta não tem um período de acesso ativo.'
              },
              403
            )
          }

          if (
            String(
              body.email || ''
            ).startsWith(
              'missing-'
            )
          ) {
            return json(
              {
                success: false,
                message:
                  'Esta conta ainda não tem uma password pessoal definida.'
              },
              401
            )
          }

          return json(
            {
              success: false,
              message:
                'Email ou password pessoal incorretos.'
            },
            401
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
          'maProfessorLoginAttemptGuardBridge.mjs'
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

function createAccess(runtime, storage) {
  return new runtime
    .MaProfessorAccessDurableObject(
      {
        storage
      },
      {}
    )
}

function loginRequest({
  email =
    'docente@example.com',
  password =
    'wrong-password',
  ip =
    '203.0.113.10'
} = {}) {
  const headers =
    new Headers({
      'Content-Type':
        'application/json'
    })

  if (ip) {
    headers.set(
      'CF-Connecting-IP',
      ip
    )
  }

  return new Request(
    'https://ma-code.pt/api/ma-professor/access/login',
    {
      method: 'POST',
      headers,
      body:
        JSON.stringify({
          email,
          password,
          deviceId:
            'device-01'
        })
    }
  )
}

async function responseBody(response) {
  return response.clone().json()
}

test(
  'missing account and wrong password expose the same generic login failure',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const missing =
      await access.fetch(
        loginRequest({
          email:
            'missing-user@example.com',
          ip:
            '203.0.113.11'
        })
      )

    const wrong =
      await access.fetch(
        loginRequest({
          email:
            'existing@example.com',
          ip:
            '203.0.113.12'
        })
      )

    assert.equal(
      missing.status,
      401
    )
    assert.equal(
      wrong.status,
      401
    )
    assert.deepEqual(
      await responseBody(missing),
      await responseBody(wrong)
    )
    assert.deepEqual(
      await responseBody(wrong),
      {
        success: false,
        message:
          'Email ou password pessoal incorretos.'
      }
    )
  }
)

test(
  'eight failures for one account from one origin block the next attempt before password verification',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    for (
      let index = 0;
      index < 8;
      index += 1
    ) {
      const response =
        await access.fetch(
          loginRequest()
        )

      assert.equal(
        response.status,
        401
      )
    }

    assert.equal(
      staged.lower.calls.length,
      8
    )

    const blocked =
      await access.fetch(
        loginRequest()
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
      staged.lower.calls.length,
      8,
      'A tentativa bloqueada não deve chegar à verificação de password.'
    )

    const serialized =
      JSON.stringify(
        storage.snapshot(
          LOGIN_GUARD_KEY
        )
      )

    assert.doesNotMatch(
      serialized,
      /203\.0\.113\.10/
    )
    assert.doesNotMatch(
      serialized,
      /docente@example\.com/
    )
  }
)

test(
  'password spraying from one origin is capped across different accounts',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    for (
      let index = 0;
      index < 30;
      index += 1
    ) {
      const response =
        await access.fetch(
          loginRequest({
            email:
              `spray-${index}@example.com`,
            ip:
              '198.51.100.20'
          })
        )

      assert.equal(
        response.status,
        401
      )
    }

    const blocked =
      await access.fetch(
        loginRequest({
          email:
            'spray-next@example.com',
          ip:
            '198.51.100.20'
        })
      )

    assert.equal(
      blocked.status,
      429
    )
    assert.equal(
      staged.lower.calls.length,
      30
    )
  }
)

test(
  'blocking one origin for an account does not globally lock that account',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    for (
      let index = 0;
      index < 8;
      index += 1
    ) {
      await access.fetch(
        loginRequest({
          email:
            'shared@example.com',
          ip:
            '192.0.2.40'
        })
      )
    }

    const otherOrigin =
      await access.fetch(
        loginRequest({
          email:
            'shared@example.com',
          ip:
            '192.0.2.41'
        })
      )

    assert.equal(
      otherOrigin.status,
      401
    )
    assert.equal(
      staged.lower.calls.length,
      9,
      'Não existe lockout global por email que um atacante possa usar contra a vítima.'
    )
  }
)

test(
  'successful authentication and post-auth license rejection do not consume failed-login budget',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const success =
      await access.fetch(
        loginRequest({
          password:
            'correct-password',
          ip:
            '203.0.113.60'
        })
      )

    const noLicense =
      await access.fetch(
        loginRequest({
          password:
            'correct-no-license',
          ip:
            '203.0.113.60'
        })
      )

    assert.equal(
      success.status,
      200
    )
    assert.equal(
      noLicense.status,
      403
    )
    assert.equal(
      storage.putsFor(
        LOGIN_GUARD_KEY
      ).length,
      0
    )

    const failure =
      await access.fetch(
        loginRequest({
          ip:
            '203.0.113.60'
        })
      )

    assert.equal(
      failure.status,
      401
    )
    assert.equal(
      storage.putsFor(
        LOGIN_GUARD_KEY
      ).length,
      1
    )
  }
)

test(
  'without trusted Cloudflare origin metadata login errors are still generic but no spoofable fallback is persisted',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    const response =
      await access.fetch(
        loginRequest({
          email:
            'missing-user@example.com',
          ip: ''
        })
      )

    assert.equal(
      response.status,
      401
    )
    assert.deepEqual(
      await responseBody(
        response
      ),
      {
        success: false,
        message:
          'Email ou password pessoal incorretos.'
      }
    )
    assert.equal(
      storage.putsFor(
        LOGIN_GUARD_KEY
      ).length,
      0
    )
  }
)

test(
  'login guard stays bounded and adds no Cloudflare binding migration polling alarm or scheduled work',
  async t => {
    const staged =
      await stageGuard()
    t.after(staged.dispose)

    const storage =
      new MemoryStorage()
    const access =
      createAccess(
        staged.runtime,
        storage
      )

    for (
      let index = 0;
      index < 300;
      index += 1
    ) {
      await access.fetch(
        loginRequest({
          email:
            `bounded-${index}@example.com`,
          ip:
            `198.18.${Math.floor(index / 250)}.${index % 250}`
        })
      )
    }

    const guardState =
      storage.snapshot(
        LOGIN_GUARD_KEY
      )

    assert.ok(
      Object.keys(
        guardState.buckets
      ).length <= 512
    )

    const source =
      await readFile(
        new URL(
          '../../worker/maProfessorLoginAttemptGuardBridge.ts',
          import.meta.url
        ),
        'utf8'
      )

    const retention =
      await readFile(
        new URL(
          '../../worker/maProfessorAccessRetentionBridge.ts',
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
      /maProfessorLoginAttemptGuardBridge/
    )
    assert.doesNotMatch(
      source,
      /setInterval|setTimeout|scheduled\s*\(|alarm/i
    )
    assert.doesNotMatch(
      wrangler,
      /ma-professor-login-guard-v1/
    )
  }
)
