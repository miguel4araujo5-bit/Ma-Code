import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import * as ts from 'typescript'

const explicitSource = await readFile(
  new URL(
    '../../worker/maProfessorExplicitApprovalBridge.ts',
    import.meta.url
  ),
  'utf8'
)

const wrapperSource = await readFile(
  new URL(
    '../../worker/maProfessorAdminAtomicApproval.ts',
    import.meta.url
  ),
  'utf8'
)

const entrySource = await readFile(
  new URL(
    '../../worker/entry.ts',
    import.meta.url
  ),
  'utf8'
)

function transpile(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    },
    reportDiagnostics: true
  })

  const errors = (output.diagnostics || []).filter(
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

const lowerBridgeUrl = transpile(`
  export class MaProfessorAccessDurableObject {
    constructor() {}
    async fetch() {
      return new Response(
        JSON.stringify({ success: false }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }
  }
`)

const explicitRuntimeSource =
  explicitSource.replaceAll(
    "'./maProfessorOperationalStateBridge'",
    `'${lowerBridgeUrl}'`
  )

const explicit = await import(
  transpile(explicitRuntimeSource)
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

    for (const [key, entry] of
      Object.entries(keyOrEntries)) {
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

const ACCESS_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_KEY =
  'ma-professor-admin-commerce-v1'

function createInitialAccessState(email) {
  const now = Date.now() - 60_000

  return {
    accessRequests: {
      [email]: {
        id: 'request-1',
        email,
        status: 'pending',
        requestedAt: now,
        approvedAt: null,
        rejectedAt: null,
        activatedAt: null,
        failedActivationAttempts: 0,
        blockedUntil: null,
        updatedAt: now
      }
    },
    credentials: {},
    updatedAt: now
  }
}

function createCommerceState() {
  const now = Date.now() - 60_000

  return {
    schemaVersion: 1,
    authorizations: [],
    createdAt: now,
    updatedAt: now
  }
}

function createDurableObject(email) {
  const storage = new MemoryStorage({
    [ACCESS_KEY]:
      createInitialAccessState(email),
    [COMMERCE_KEY]:
      createCommerceState()
  })

  const durableObject =
    new explicit.MaProfessorAccessDurableObject(
      { storage },
      {}
    )

  return {
    storage,
    durableObject
  }
}

async function approve(
  durableObject,
  email,
  approvalPlan
) {
  return durableObject.fetch(
    new Request(
      'https://ma-professor.internal/__internal/ma-professor/admin/requests/approve-explicit',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          email,
          approvalPlan
        })
      }
    )
  )
}

test(
  'free approval persists approved status and credential together',
  async () => {
    const email =
      'atomic-free@example.com'
    const {
      storage,
      durableObject
    } = createDurableObject(email)

    const response =
      await approve(
        durableObject,
        email,
        'free'
      )

    assert.equal(response.status, 200)

    const body =
      await response.json()

    assert.equal(body.success, true)
    assert.equal(
      body.credentialIssued,
      true
    )
    assert.match(
      body.credential.password,
      /^MP-(?:[A-Z2-9]{4}-){3}[A-Z2-9]{4}$/
    )

    const access =
      storage.snapshot(ACCESS_KEY)

    assert.equal(
      access.accessRequests[email].status,
      'approved'
    )
    assert.ok(
      access.credentials[email]
    )
    assert.equal(
      typeof access.credentials[email]
        .passwordHash,
      'string'
    )
    assert.equal(
      typeof access.credentials[email]
        .passwordSalt,
      'string'
    )
    assert.equal(
      access.credentials[email]
        .passwordIterations,
      100_000
    )
    assert.equal(
      Object.hasOwn(
        access.credentials[email],
        'password'
      ),
      false,
      'A senha em claro não pode ser persistida.'
    )
  }
)

test(
  'commercial explicit approval persists approval, confirmed authorization and credential together',
  async () => {
    const email =
      'atomic-paid@example.com'
    const {
      storage,
      durableObject
    } = createDurableObject(email)

    const response =
      await approve(
        durableObject,
        email,
        'paid_30_days'
      )

    assert.equal(response.status, 200)

    const body =
      await response.json()

    assert.equal(
      body.credentialIssued,
      true
    )
    assert.equal(
      body.commerce.paymentStatus,
      'confirmed'
    )

    const access =
      storage.snapshot(ACCESS_KEY)
    const commerce =
      storage.snapshot(COMMERCE_KEY)
    const authorization =
      commerce.authorizations[0]
    const credential =
      access.credentials[email]

    assert.equal(
      access.accessRequests[email].status,
      'approved'
    )
    assert.equal(
      authorization.plan,
      'paid_30_days'
    )
    assert.equal(
      typeof authorization
        .paymentConfirmedAt,
      'number'
    )
    assert.equal(
      typeof authorization
        .credentialIssuedAt,
      'number'
    )
    assert.equal(
      credential.authorizationId,
      authorization.id
    )
    assert.equal(
      credential.authorizationPlan,
      'paid_30_days'
    )
  }
)

test(
  'credential-generation failure leaves the request pending and persists nothing partial',
  { concurrency: false },
  async () => {
    const email =
      'atomic-failure@example.com'
    const {
      storage,
      durableObject
    } = createDurableObject(email)

    const originalDescriptor =
      Object.getOwnPropertyDescriptor(
        globalThis,
        'crypto'
      )
    const actualCrypto =
      globalThis.crypto

    const failingCrypto = {
      randomUUID:
        actualCrypto.randomUUID.bind(
          actualCrypto
        ),
      getRandomValues:
        actualCrypto.getRandomValues.bind(
          actualCrypto
        ),
      subtle: {
        importKey:
          actualCrypto.subtle.importKey.bind(
            actualCrypto.subtle
          ),
        deriveBits: async () => {
          throw new Error(
            'Falha criptográfica simulada.'
          )
        }
      }
    }

    Object.defineProperty(
      globalThis,
      'crypto',
      {
        configurable: true,
        value: failingCrypto
      }
    )

    try {
      const response =
        await approve(
          durableObject,
          email,
          'free'
        )

      assert.equal(
        response.status,
        500
      )

      const body =
        await response.json()

      assert.equal(
        body.credentialIssued,
        false
      )
      assert.match(
        body.message,
        /permanece pendente/i
      )

      const access =
        storage.snapshot(ACCESS_KEY)
      const commerce =
        storage.snapshot(COMMERCE_KEY)

      assert.equal(
        access.accessRequests[email]
          .status,
        'pending'
      )
      assert.equal(
        access.credentials[email],
        undefined
      )
      assert.deepEqual(
        commerce.authorizations,
        []
      )
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(
          globalThis,
          'crypto',
          originalDescriptor
        )
      }
    }
  }
)

test(
  'production admin routing uses the atomic wrapper for current and legacy approvals',
  () => {
    assert.match(
      entrySource,
      /from '\.\/maProfessorAdminAtomicApproval'/
    )

    assert.match(
      wrapperSource,
      /\/api\/admin\/ma-professor\/requests\/approve-plan/
    )

    assert.match(
      wrapperSource,
      /\/api\/admin\/ma-professor\/requests\/approve'/
    )

    assert.doesNotMatch(
      wrapperSource,
      /generateMAProfessorAdminCredential/
    )

    assert.doesNotMatch(
      wrapperSource,
      /commerce\/confirm-payment/
    )
  }
)
