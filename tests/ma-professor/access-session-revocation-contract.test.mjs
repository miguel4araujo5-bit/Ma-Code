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
  'maProfessorExplicitApprovalBridge'
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
  }

  async get(key) {
    return clone(
      this.values.get(key)
    )
  }

  async put(keyOrEntries, value) {
    if (
      typeof keyOrEntries === 'string'
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

function createState(storage) {
  return {
    storage,
    blockConcurrencyWhile: async callback =>
      callback()
  }
}

function transpile(source, filename) {
  const output = ts.transpileModule(
    source,
    {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
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
        'ma-professor-session-revocation-'
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
          'maProfessorExplicitApprovalBridge.mjs'
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
  body
) {
  return new Request(
    `https://ma-code.pt${pathname}`,
    {
      method: 'POST',
      headers: {
        'Content-Type':
          'application/json'
      },
      body: JSON.stringify(body)
    }
  )
}

function bytesToBase64(bytes) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte)
  }

  return btoa(binary)
}

async function hashTokenBase64(token) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    )

  return bytesToBase64(
    new Uint8Array(digest)
  )
}

async function hashTokenLegacyHex(token) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    )

  return Array.from(
    new Uint8Array(digest),
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')
}

function createAccessState({
  email,
  deviceId,
  tokenHash
}) {
  const now = Date.now()
  const validFrom =
    now - 60_000

  return {
    schemaVersion: 2,
    licenses: {
      [email]: {
        email,
        plan: 'paid_30_days',
        validFrom,
        validUntil:
          now +
          30 * 24 * 60 * 60 * 1000,
        revokedAt: null,
        renewalRequestedAt: null,
        renewalRequestedPlan: null,
        deviceIds: [deviceId],
        createdAt: validFrom,
        updatedAt: now
      }
    },
    sessions: {
      [tokenHash]: {
        tokenHash,
        email,
        deviceId,
        createdAt: now,
        lastSeenAt: now,
        revokedAt: null
      }
    },
    renewals: [],
    accessRequests: {
      [email]: {
        id: 'access-session-revocation',
        email,
        status: 'approved',
        requestedAt: validFrom,
        approvedAt: validFrom,
        rejectedAt: null,
        activatedAt: validFrom,
        failedActivationAttempts: 0,
        blockedUntil: null,
        updatedAt: now
      }
    },
    credentials: {},
    createdAt: validFrom,
    updatedAt: now
  }
}

async function assertLogoutRevokesEveryPath({
  runtime,
  tokenHash,
  token,
  email,
  deviceId
}) {
  const storage =
    new MemoryStorage({
      [ACCESS_KEY]:
        createAccessState({
          email,
          deviceId,
          tokenHash
        })
    })

  const access =
    new runtime.MaProfessorAccessDurableObject(
      createState(storage),
      {}
    )

  const verifyBeforeLogout =
    await access.fetch(
      request(
        '/api/ma-professor/access/account/verify',
        {
          token,
          deviceId
        }
      )
    )

  assert.equal(
    verifyBeforeLogout.status,
    200,
    'A sessão armazenada deve ser reconhecida antes do logout.'
  )

  const logoutResponse =
    await access.fetch(
      request(
        '/api/ma-professor/access/logout',
        {
          token,
          deviceId
        }
      )
    )

  assert.equal(
    logoutResponse.status,
    200
  )

  const verifyAfterLogout =
    await access.fetch(
      request(
        '/api/ma-professor/access/account/verify',
        {
          token,
          deviceId
        }
      )
    )

  assert.equal(
    verifyAfterLogout.status,
    401,
    'Depois do logout, /account/verify tem de rejeitar a mesma sessão.'
  )

  const beforeRenew =
    storage.snapshot(
      ACCESS_KEY
    )
  const renewalCountBefore =
    beforeRenew.renewals.length

  const renewAfterLogout =
    await access.fetch(
      request(
        '/api/ma-professor/access/renew',
        {
          token,
          deviceId,
          requestedPlan:
            'paid_30_days'
        }
      )
    )

  assert.equal(
    renewAfterLogout.status,
    401,
    'O núcleo não pode aceitar uma sessão já terminada pelo bridge exterior.'
  )

  const afterRenew =
    storage.snapshot(
      ACCESS_KEY
    )

  assert.equal(
    afterRenew.renewals.length,
    renewalCountBefore,
    'Um /renew após logout não pode criar nem alterar pedidos de renovação.'
  )

  const storedSession =
    afterRenew.sessions?.[
      tokenHash
    ]

  assert.ok(
    !storedSession ||
      storedSession.revokedAt !== null,
    'A cache interna não pode ressuscitar uma sessão revogada.'
  )
}

test(
  'logout invalidates the cached Base64 session before delegated renewal',
  async t => {
    const {
      runtime,
      dispose
    } = await stageProductionChain()

    t.after(dispose)

    const token =
      'base64-session-revocation-token'
    const email =
      'base64-revocation@example.com'
    const deviceId =
      'device-base64-revocation-01'

    await assertLogoutRevokesEveryPath({
      runtime,
      token,
      email,
      deviceId,
      tokenHash:
        await hashTokenBase64(token)
    })
  }
)

test(
  'account verify and logout preserve the historical hex session contract',
  async t => {
    const {
      runtime,
      dispose
    } = await stageProductionChain()

    t.after(dispose)

    const token =
      'legacy-hex-session-token'
    const email =
      'legacy-hex@example.com'
    const deviceId =
      'device-legacy-hex-01'

    await assertLogoutRevokesEveryPath({
      runtime,
      token,
      email,
      deviceId,
      tokenHash:
        await hashTokenLegacyHex(token)
    })
  }
)
