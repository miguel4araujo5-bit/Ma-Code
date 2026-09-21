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

const OPAQUE_KEY =
  'ma-professor-opaque-auth-v1'

const MODULE_NAMES = [
  'maProfessorAccess',
  'maProfessorPaidAccess',
  'maProfessorAccessAdminBridge',
  'maProfessorAccessAuthBridge',
  'maProfessorAccountSessionBridge',
  'maProfessorAccessAccountAdminBridge',
  'maProfessorOperationalStateBridge',
  'maProfessorExplicitApprovalBridge',
  'maProfessorOpaqueAuthState',
  'maProfessorOpaqueAuthProtocol',
  'maProfessorOpaqueServerRuntime'
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
        'ma-professor-session-contract-'
      )
    )

  for (const moduleName of MODULE_NAMES) {
    if (
      moduleName ===
        'maProfessorOpaqueServerRuntime'
    ) {
      await writeFile(
        join(
          directory,
          'maProfessorOpaqueServerRuntime.mjs'
        ),
        `
          export async function getMAProfessorOpaqueServerRuntime() {
            throw new Error(
              'OPAQUE runtime is not expected in this legacy-chain test.'
            )
          }
        `,
        'utf8'
      )
      continue
    }

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

async function body(response) {
  return response.json()
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

test(
  'production chain keeps protected activation, account verification and renewal on one session contract',
  async t => {
    const {
      runtime,
      dispose
    } = await stageProductionChain()

    t.after(dispose)

    const storage =
      new MemoryStorage()

    const access =
      new runtime.MaProfessorAccessDurableObject(
        createState(storage),
        {}
      )

    const email =
      'session-contract@example.com'
    const deviceId =
      'device-session-contract-01'

    const accessRequestResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/request',
          {
            email
          }
        )
      )

    assert.equal(
      accessRequestResponse.status,
      200
    )

    const accessRequestBody =
      await body(
        accessRequestResponse
      )

    assert.equal(
      accessRequestBody.request.status,
      'pending'
    )

    const approvalResponse =
      await access.fetch(
        request(
          '/__internal/ma-professor/admin/requests/approve-explicit',
          {
            email,
            approvalPlan:
              'free'
          }
        )
      )

    assert.equal(
      approvalResponse.status,
      200
    )

    const approvalBody =
      await body(
        approvalResponse
      )

    assert.equal(
      approvalBody.credentialIssued,
      true
    )

    const activationPassword =
      approvalBody.credential.password

    assert.equal(
      typeof activationPassword,
      'string'
    )

    /*
     * O login OPAQUE tem integração própria. Aqui semeamos apenas o
     * registration record já concluído para isolar o contrato comum de
     * sessão: ativação -> verify -> renew.
     */
    await storage.put(
      OPAQUE_KEY,
      {
        schemaVersion:
          1,
        protocol:
          'OPAQUE-RFC9807',
        serverSetup:
          'server-setup',
        registrations: {
          [email]: {
            email,
            registrationRecord:
              'opaque-registration-record',
            createdAt:
              Date.now(),
            updatedAt:
              Date.now(),
            migratedFromV2At:
              null
          }
        },
        pendingEnrollments:
          {},
        pendingLogins:
          {},
        createdAt:
          Date.now(),
        updatedAt:
          Date.now()
      }
    )

    const activationResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/activate',
          {
            email,
            activationPassword,
            deviceId
          }
        )
      )

    assert.equal(
      activationResponse.status,
      200,
      'A senha MP aprovada deve ativar o período apenas depois de existir o registo OPAQUE.'
    )

    const activationBody =
      await body(
        activationResponse
      )
    const activationToken =
      activationBody.token

    assert.equal(
      typeof activationToken,
      'string'
    )

    const verifyActivationResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/account/verify',
          {
            token:
              activationToken,
            deviceId
          }
        )
      )

    assert.equal(
      verifyActivationResponse.status,
      200,
      'A sessão devolvida pela ativação protegida tem de usar o contrato canónico de /account/verify.'
    )

    const renewalResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/renew',
          {
            token:
              activationToken,
            deviceId,
            requestedPlan:
              'paid_30_days'
          }
        )
      )

    assert.equal(
      renewalResponse.status,
      200,
      'A sessão real emitida pela ativação deve chegar à lógica de renovação.'
    )

    const renewalState =
      storage.snapshot(
        ACCESS_KEY
      )

    assert.equal(
      renewalState.renewals.some(
        renewal =>
          renewal.email ===
            email &&
          renewal.requestedPlan ===
            'paid_30_days' &&
          renewal.status ===
            'pending'
      ),
      true,
      'O 200 de /renew só é válido se o pedido correspondente tiver sido realmente registado.'
    )

    const switchedPlanResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/renew',
          {
            token:
              activationToken,
            deviceId,
            requestedPlan:
              'school_year'
          }
        )
      )

    assert.equal(
      switchedPlanResponse.status,
      409,
      'Mudar de plano dentro da deduplicação não pode voltar a produzir falso sucesso.'
    )

    const invalidTokenResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/renew',
          {
            token:
              'invalid-session-token',
            deviceId,
            requestedPlan:
              'paid_30_days'
          }
        )
      )

    assert.equal(
      invalidTokenResponse.status,
      401,
      'Uma sessão inexistente continua a ser rejeitada.'
    )

    const wrongDeviceResponse =
      await access.fetch(
        request(
          '/api/ma-professor/access/renew',
          {
            token:
              activationToken,
            deviceId:
              'device-session-contract-other',
            requestedPlan:
              'paid_30_days'
          }
        )
      )

    assert.equal(
      wrongDeviceResponse.status,
      401,
      'Um token válido não pode ser reutilizado noutro dispositivo.'
    )

    const finalState =
      storage.snapshot(
        ACCESS_KEY
      )

    const activationBase64Hash =
      await hashTokenBase64(
        activationToken
      )

    const activationLegacyHexHash =
      await hashTokenLegacyHex(
        activationToken
      )

    assert.ok(
      finalState.sessions[
        activationBase64Hash
      ],
      'A sessão da ativação deve usar o hash SHA-256 Base64 canónico.'
    )

    assert.equal(
      finalState.sessions[
        activationLegacyHexHash
      ],
      undefined,
      'Não devem coexistir representações hexadecimal e Base64 para as novas sessões.'
    )
  }
)
