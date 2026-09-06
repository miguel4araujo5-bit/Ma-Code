import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const baseSource = await readFile(
  new URL(
    '../../worker/maProfessorAccess.ts',
    import.meta.url
  ),
  'utf8'
)

const paidSource = await readFile(
  new URL(
    '../../worker/maProfessorPaidAccess.ts',
    import.meta.url
  ),
  'utf8'
)

const founderSource = await readFile(
  new URL(
    '../../src/components/ma-professor/access/FounderAccessOffer.tsx',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(
    source,
    {
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

  return `data:text/javascript;base64,${Buffer.from(
    output.outputText
  ).toString('base64')}`
}

const baseUrl =
  transpile(baseSource)

const paidRuntimeSource =
  paidSource.replaceAll(
    "'./maProfessorAccess'",
    `'${baseUrl}'`
  )

const base =
  await import(baseUrl)

const paid =
  await import(
    transpile(
      paidRuntimeSource
    )
  )

const ACCESS_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_KEY =
  'ma-professor-admin-commerce-v1'

const DAY_MS =
  24 * 60 * 60 * 1000

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

function bytesToBase64(bytes) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte)
  }

  return btoa(binary)
}

function toArrayBuffer(value) {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(value)

  return copy.buffer
}

async function hashPassword(
  password,
  salt,
  iterations = 100_000
) {
  const key =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        new TextEncoder().encode(
          password
        )
      ),
      'PBKDF2',
      false,
      ['deriveBits']
    )

  const bits =
    await globalThis.crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt:
          toArrayBuffer(salt),
        iterations,
        hash: 'SHA-256'
      },
      key,
      256
    )

  return bytesToBase64(
    new Uint8Array(bits)
  )
}

async function hashToken(token) {
  const hash =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(token)
    )

  return bytesToBase64(
    new Uint8Array(hash)
  )
}

async function createActivationCredential(
  email,
  password,
  authorizationId,
  authorizationPlan
) {
  const salt =
    new Uint8Array(16)

  globalThis.crypto.getRandomValues(
    salt
  )

  const now = Date.now()

  return {
    email,
    passwordSalt:
      bytesToBase64(salt),
    passwordHash:
      await hashPassword(
        password,
        salt
      ),
    passwordIterations:
      100_000,
    createdAt: now,
    updatedAt: now,
    authorizationId,
    authorizationPlan
  }
}

function createRequest(
  email,
  status,
  now
) {
  return {
    id: 'request-1',
    email,
    status,
    requestedAt:
      now - DAY_MS,
    approvedAt:
      status === 'approved'
        ? now - DAY_MS
        : null,
    rejectedAt:
      status === 'rejected'
        ? now - DAY_MS
        : null,
    activatedAt:
      status === 'approved'
        ? now - DAY_MS
        : null,
    failedActivationAttempts: 0,
    blockedUntil: null,
    updatedAt: now
  }
}

function createLicense(
  email,
  now,
  overrides = {}
) {
  return {
    email,
    plan: 'paid_30_days',
    validFrom:
      now - 20 * DAY_MS,
    validUntil:
      now + 10 * DAY_MS,
    revokedAt: null,
    renewalRequestedAt: null,
    renewalRequestedPlan: null,
    deviceIds: [
      'device-1234567890'
    ],
    createdAt:
      now - 20 * DAY_MS,
    updatedAt: now,
    ...overrides
  }
}

function createContext(
  storage,
  baseObject
) {
  return {
    state: createState(storage),
    base: baseObject,
    refreshBase() {}
  }
}

test(
  'renewal of an active 30-day license preserves the remaining valid period before adding the new 30 days',
  async () => {
    const email =
      'renewal-preserve@example.com'
    const deviceId =
      'device-1234567890'
    const password =
      'MP-TEST-AAAA-BBBB-CCCC'
    const now = Date.now()
    const previousLicense =
      createLicense(
        email,
        now
      )
    const renewalId =
      'renewal-preserve-1'
    const authorizationId =
      'authorization-preserve-1'

    const credential =
      await createActivationCredential(
        email,
        password,
        authorizationId,
        'paid_30_days'
      )

    const accessState = {
      licenses: {
        [email]: previousLicense
      },
      sessions: {},
      renewals: [
        {
          id: renewalId,
          email,
          requestedPlan:
            'paid_30_days',
          amountCents: 349,
          currency: 'EUR',
          status: 'pending',
          requestedAt:
            now - 60_000,
          resolvedAt: null,
          updatedAt:
            now - 60_000
        }
      ],
      accessRequests: {
        [email]:
          createRequest(
            email,
            'approved',
            now
          )
      },
      credentials: {
        [email]: credential
      },
      updatedAt: now
    }

    const commerceState = {
      schemaVersion: 1,
      authorizations: [
        {
          id: authorizationId,
          email,
          plan: 'paid_30_days',
          amountCents: 349,
          currency: 'EUR',
          selectedAt:
            now - 60_000,
          renewalId,
          paymentConfirmedAt:
            now - 50_000,
          paymentDispensedAt: null,
          credentialIssuedAt:
            now - 40_000,
          activatedAt: null,
          createdAt:
            now - 60_000,
          updatedAt:
            now - 40_000
        }
      ],
      createdAt:
        now - 60_000,
      updatedAt:
        now - 40_000
    }

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: accessState,
        [COMMERCE_KEY]: commerceState
      })

    const durableObjectState =
      createState(storage)

    const baseObject =
      new base.MaProfessorAccessDurableObject(
        durableObjectState,
        {}
      )

    const response =
      await paid.handleMAProfessorPaidAccessRequest(
        new Request(
          'https://ma-code.pt/api/ma-professor/access/activate',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              email,
              password,
              deviceId
            })
          }
        ),
        createContext(
          storage,
          baseObject
        )
      )

    assert.ok(response)
    assert.equal(response.status, 200)

    const updated =
      storage.snapshot(
        ACCESS_KEY
      ).licenses[email]

    assert.equal(
      updated.validFrom,
      previousLicense.validFrom,
      'Uma renovação contínua não deve apagar a data inicial do acesso ainda válido.'
    )

    assert.equal(
      updated.validUntil,
      previousLicense.validUntil +
        30 * DAY_MS,
      'Os 30 dias renovados devem começar depois do período ainda válido, não no instante da ativação.'
    )
  }
)

test(
  'changing the renewal plan inside the deduplication window cannot return success unless that plan is actually pending',
  async () => {
    const email =
      'renewal-switch@example.com'
    const deviceId =
      'device-renewal-switch'
    const token =
      'token-renewal-switch'
    const now = Date.now()
    const tokenHash =
      await hashToken(token)

    const accessState = {
      licenses: {
        [email]:
          createLicense(
            email,
            now,
            {
              renewalRequestedAt:
                now - 60_000,
              renewalRequestedPlan:
                'paid_30_days'
            }
          )
      },
      sessions: {
        [tokenHash]: {
          tokenHash,
          email,
          deviceId,
          createdAt:
            now - DAY_MS,
          lastSeenAt:
            now - 60_000,
          revokedAt: null
        }
      },
      renewals: [
        {
          id: 'renewal-existing-monthly',
          email,
          requestedPlan:
            'paid_30_days',
          amountCents: 349,
          currency: 'EUR',
          status: 'pending',
          requestedAt:
            now - 60_000,
          resolvedAt: null,
          updatedAt:
            now - 60_000
        }
      ],
      accessRequests: {
        [email]:
          createRequest(
            email,
            'approved',
            now
          )
      },
      credentials: {},
      updatedAt: now
    }

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: accessState,
        [COMMERCE_KEY]: {
          schemaVersion: 1,
          authorizations: [],
          createdAt: now,
          updatedAt: now
        }
      })

    const durableObjectState =
      createState(storage)

    const baseObject =
      new base.MaProfessorAccessDurableObject(
        durableObjectState,
        {}
      )

    const response =
      await paid.handleMAProfessorPaidAccessRequest(
        new Request(
          'https://ma-code.pt/api/ma-professor/access/renew',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              token,
              deviceId,
              requestedPlan:
                'school_year'
            })
          }
        ),
        createContext(
          storage,
          baseObject
        )
      )

    assert.ok(response)
    assert.equal(
      response.status,
      409,
      'O Worker não pode devolver sucesso para school_year quando só ficou pendente paid_30_days.'
    )

    const stateAfter =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      stateAfter.renewals.some(
        renewal =>
          renewal.status ===
            'pending' &&
          renewal.requestedPlan ===
            'school_year'
      ),
      false
    )
  }
)

test(
  'a rejected access request cannot create or appear to accept a Founder paid-access request',
  async () => {
    const email =
      'rejected-founder@example.com'
    const now = Date.now()

    const storage =
      new MemoryStorage({
        [ACCESS_KEY]: {
          licenses: {},
          sessions: {},
          renewals: [],
          accessRequests: {
            [email]:
              createRequest(
                email,
                'rejected',
                now
              )
          },
          credentials: {},
          updatedAt: now
        },
        [COMMERCE_KEY]: {
          schemaVersion: 1,
          authorizations: [],
          createdAt: now,
          updatedAt: now
        }
      })

    const durableObjectState =
      createState(storage)

    const baseObject =
      new base.MaProfessorAccessDurableObject(
        durableObjectState,
        {}
      )

    const response =
      await paid.handleMAProfessorPaidAccessRequest(
        new Request(
          'https://ma-code.pt/api/ma-professor/access/request',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body: JSON.stringify({
              email,
              plan: 'paid_30_days',
              token: 'irrelevant-for-rejected-state',
              deviceId:
                'device-rejected-founder'
            })
          }
        ),
        createContext(
          storage,
          baseObject
        )
      )

    assert.ok(response)
    assert.equal(
      response.status,
      409,
      'Um pedido rejeitado não deve receber uma resposta de sucesso ao tentar iniciar o fluxo Fundador.'
    )

    const commerceAfter =
      storage.snapshot(
        COMMERCE_KEY
      )

    assert.equal(
      commerceAfter.authorizations.length,
      0
    )
  }
)

test(
  'the Founder offer is not rendered for a rejected request',
  () => {
    assert.match(
      founderSource,
      /if\s*\(\s*requestStatus\s*===\s*['\"]rejected['\"]\s*\)\s*\{\s*return\s+null\s*\}/,
      'FounderAccessOffer deve sair imediatamente sem mostrar preço, MB WAY ou ativação quando o pedido está rejeitado.'
    )
  }
)
