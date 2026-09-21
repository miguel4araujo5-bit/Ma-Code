import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccessAdminBridge'

import {
  MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
  type MAProfessorOpaqueAuthState
} from './maProfessorOpaqueAuthState'

import {
  MA_PROFESSOR_OPAQUE_ENROLL_FINISH_PATH,
  MA_PROFESSOR_OPAQUE_ENROLL_START_PATH,
  MA_PROFESSOR_OPAQUE_LOGIN_FINISH_PATH,
  MA_PROFESSOR_OPAQUE_LOGIN_START_PATH,
  createOpaqueAuthProtocolState,
  finishOpaqueEnrollment,
  finishOpaqueLogin,
  startOpaqueEnrollment,
  startOpaqueLogin
} from './maProfessorOpaqueAuthProtocol'

import {
  getMAProfessorOpaqueServerRuntime
} from './maProfessorOpaqueServerRuntime'

import type {
  LicensePlan,
  LicenseStatus,
  MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const PUBLIC_REQUEST_PATH =
  '/api/ma-professor/access/request'

const PUBLIC_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const PUBLIC_START_PATH =
  '/api/ma-professor/access/start'

const INTERNAL_COMMERCE_STATUS_PATH =
  '/__internal/ma-professor/admin/commerce/status'

const INTERNAL_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

const SESSION_TOKEN_BYTES =
  32

const MAX_ACTIVE_SESSIONS =
  4

const MAX_DEVICES =
  8

const EXPIRING_DAYS =
  7

const RENEWAL_GRACE_HOURS =
  24

type JsonObject =
  Record<string, unknown>

interface StoredLicenseSnapshot {
  email: string
  plan: LicensePlan
  validFrom: number
  validUntil: number
  revokedAt: number | null
  renewalRequestedAt: number | null
  updatedAt?: number
}

interface StoredSessionSnapshot {
  tokenHash: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
  revokedAt: number | null
}

interface StoredAccessRequestSnapshot {
  email: string
  activatedAt: number | null
}

interface StoredAccessCredentialSnapshot {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  activationCode?: string
  createdAt: number
  updatedAt: number
  authorizationId?: string
  authorizationPlan?: string
}

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >

  sessions?: Record<
    string,
    StoredSessionSnapshot
  >

  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >

  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >

  updatedAt?: number
}

interface StoredCommercialAuthorization {
  id: string
  email: string
  plan: string
  amountCents: number
  currency: 'EUR'
  selectedAt: number
  paymentConfirmedAt: number | null
  paymentDispensedAt?: number | null
  credentialIssuedAt: number | null
  activatedAt?: number | null
  createdAt: number
  updatedAt: number
}

interface StoredCommerceState {
  schemaVersion: 1

  authorizations:
    StoredCommercialAuthorization[]

  createdAt: number
  updatedAt: number
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>

  put(
    entries:
      Record<string, unknown>
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike

  blockConcurrencyWhile<T>(
    callback:
      () => Promise<T>
  ): Promise<T>
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',
    Pragma:
      'no-cache',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':
      'nosniff',
    'X-Frame-Options':
      'DENY',
    'Referrer-Policy':
      'no-referrer',
    'X-Robots-Tag':
      'noindex, nofollow'
  }

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<string, string> = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders,
        ...extraHeaders
      }
    }
  )
}

function normalizeEmail(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 180)
    : ''
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

function normalizePassword(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
    : ''
}

function normalizeDeviceId(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(0, 180)
    : ''
}

function normalizeSessionToken(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(0, 256)
    : ''
}

function normalizeOpaquePayload(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(0, 32_000)
    : ''
}

function isValidPersonalPassword(
  value: string
) {
  return value.length >=
      6 &&
    value.length <=
      128
}

async function readJson(
  request: Request
): Promise<JsonObject> {
  let parsed: unknown

  try {
    parsed =
      await request.json()
  } catch {
    throw new Error(
      'O pedido contém JSON inválido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'O pedido é inválido.'
    )
  }

  return parsed as JsonObject
}

async function readResponseJson(
  response: Response
) {
  try {
    return await response
      .clone()
      .json() as JsonObject
  } catch {
    return null
  }
}

function bytesToBase64(
  bytes: Uint8Array
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

function toArrayBuffer(
  value: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(value)

  return copy.buffer
}

async function hashPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const encoded =
    new TextEncoder()
      .encode(password)

  const key =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        encoded
      ),
      'PBKDF2',
      false,
      ['deriveBits']
    )

  const bits =
    await globalThis.crypto.subtle.deriveBits(
      {
        name:
          'PBKDF2',
        salt:
          toArrayBuffer(
            salt
          ),
        iterations,
        hash:
          'SHA-256'
      },
      key,
      256
    )

  return bytesToBase64(
    new Uint8Array(
      bits
    )
  )
}

function base64ToBytes(
  value: string
) {
  const binary =
    atob(value)

  const bytes =
    new Uint8Array(
      binary.length
    )

  for (
    let index = 0;
    index <
      binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(
        index
      )
  }

  return bytes
}

async function verifyStoredCredential(
  credential:
    StoredAccessCredentialSnapshot,
  secret: string
) {
  const calculated =
    await hashPassword(
      secret,
      base64ToBytes(
        credential
          .passwordSalt
      ),
      credential
        .passwordIterations
    )

  return calculated ===
    credential.passwordHash
}

function createToken() {
  const bytes =
    new Uint8Array(
      SESSION_TOKEN_BYTES
    )

  globalThis.crypto.getRandomValues(
    bytes
  )

  return bytesToBase64(
    bytes
  )
    .replaceAll(
      '+',
      '-'
    )
    .replaceAll(
      '/',
      '_'
    )
    .replaceAll(
      '=',
      ''
    )
}

async function hashToken(
  token: string
) {
  const bytes =
    new TextEncoder()
      .encode(token)

  const hash =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      bytes
    )

  return bytesToBase64(
    new Uint8Array(
      hash
    )
  )
}

async function hashLegacyToken(
  token: string
) {
  const hash =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(token)
    )

  return Array.from(
    new Uint8Array(hash),
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')
}

function getDaysRemaining(
  validUntil: number,
  now: number
) {
  return Math.max(
    0,
    Math.ceil(
      (
        validUntil -
        now
      ) /
        (
          24 *
          60 *
          60 *
          1000
        )
    )
  )
}

function getLicenseStatus(
  license:
    StoredLicenseSnapshot,
  now: number
): LicenseStatus {
  if (
    license.revokedAt !==
    null
  ) {
    return 'revoked'
  }

  if (
    license.validUntil <=
    now
  ) {
    return 'expired'
  }

  const renewalGraceActive =
    license
      .renewalRequestedAt !==
      null &&
    now -
      license
        .renewalRequestedAt <=
      RENEWAL_GRACE_HOURS *
        60 *
        60 *
        1000

  if (
    renewalGraceActive
  ) {
    return 'renewal_pending'
  }

  if (
    getDaysRemaining(
      license.validUntil,
      now
    ) <=
    EXPIRING_DAYS
  ) {
    return 'expiring'
  }

  return 'active'
}

function buildLicenseSummary(
  license:
    StoredLicenseSnapshot
) {
  const now =
    Date.now()

  return {
    email:
      license.email,
    plan:
      license.plan,
    status:
      getLicenseStatus(
        license,
        now
      ),
    validFrom:
      new Date(
        license.validFrom
      ).toISOString(),
    validUntil:
      new Date(
        license.validUntil
      ).toISOString(),
    daysRemaining:
      getDaysRemaining(
        license.validUntil,
        now
      ),
    renewalRequestedAt:
      license
        .renewalRequestedAt ===
        null
        ? null
        : new Date(
            license
              .renewalRequestedAt
          ).toISOString(),
    revokedAt:
      license.revokedAt ===
        null
        ? null
        : new Date(
            license.revokedAt
          ).toISOString()
  }
}

function isUsableLicense(
  license:
    StoredLicenseSnapshot
) {
  return license.revokedAt ===
      null &&
    license.validUntil >
      Date.now()
}

function getLatestAuthorization(
  commerce:
    StoredCommerceState |
    undefined,
  email: string
) {
  if (
    !commerce ||
    !Array.isArray(
      commerce.authorizations
    )
  ) {
    return null
  }

  return commerce
    .authorizations
    .filter(
      item =>
        item.email ===
        email
    )
    .sort(
      (
        left,
        right
      ) =>
        right.createdAt -
        left.createdAt
    )[0] ||
    null
}

function paymentResolved(
  authorization:
    StoredCommercialAuthorization |
    null
) {
  return Boolean(
    authorization &&
    (
      authorization
        .paymentConfirmedAt !==
        null ||
      (
        authorization
          .paymentDispensedAt ??
        null
      ) !==
        null
    )
  )
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly env:
    MaProfessorAccessEnv

  private readonly existing:
    ExistingMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state:
      DurableObjectStateLike,
    env:
      MaProfessorAccessEnv
  ) {
    this.state =
      state

    this.env =
      env

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state,
        env
      )
  }

  fetch(
    request: Request
  ): Promise<Response> {
    const response =
      this.operation.then(
        () =>
          this.handleRequest(
            request
          )
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private async handleActivation(
    request: Request
  ) {
    if (
      request.method !==
      'POST'
    ) {
      return json(
        {
          success:
            false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch (
      error
    ) {
      return json(
        {
          success:
            false,
          message:
            error instanceof
              Error
              ? error.message
              : 'Pedido inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const activationPassword =
      normalizePassword(
        body.activationPassword
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    if (
      !isValidEmail(
        email
      )
    ) {
      return json(
        {
          success:
            false,
          message:
            'Introduza um endereço de email válido.'
        },
        400
      )
    }

    if (
      !activationPassword
    ) {
      return json(
        {
          success:
            false,
          message:
            'Introduza a senha de ativação recebida.'
        },
        400
      )
    }

    if (
      !deviceId
    ) {
      return json(
        {
          success:
            false,
          message:
            'Não foi possível identificar este dispositivo.'
        },
        400
      )
    }

    const opaqueState =
      createOpaqueAuthProtocolState(
        await this.state.storage.get<MAProfessorOpaqueAuthState>(
          MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY
        )
      )

    if (
      !opaqueState.registrations[
        email
      ]
    ) {
      return json(
        {
          success:
            false,
          message:
            'Crie primeiro a sua password pessoal neste dispositivo para concluir a ativação protegida.'
        },
        409
      )
    }

    const delegatedHeaders =
      new Headers(
        request.headers
      )

    delegatedHeaders.delete(
      'content-length'
    )

    delegatedHeaders.set(
      'Content-Type',
      'application/json'
    )

    const delegatedRequest =
      new Request(
        request.url,
        {
          method:
            'POST',
          headers:
            delegatedHeaders,
          body:
            JSON.stringify({
              email,
              activationPassword,
              deviceId
            })
        }
      )

    const delegatedResponse =
      await this.existing.fetch(
        delegatedRequest
      )

    const delegatedBody =
      await readResponseJson(
        delegatedResponse
      )

    if (
      !delegatedResponse.ok ||
      !delegatedBody ||
      delegatedBody.success !==
        true
    ) {
      return delegatedResponse
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    if (
      !accessState
    ) {
      return json(
        {
          success:
            false,
          message:
            'A ativação foi validada, mas não foi possível concluir a preparação da conta.'
        },
        500
      )
    }

    if (
      accessState.credentials
    ) {
      delete accessState
        .credentials[
          email
        ]
    }

    accessState.updatedAt =
      Date.now()

    await this.state.storage.put(
      STORAGE_KEY,
      accessState
    )

    return json({
      ...delegatedBody,
      message:
        'Período de acesso ativado. A sua password pessoal permanece apenas no seu dispositivo e é usada pelo login protegido.'
    })
  }

  private async findAccountSession(
    accessState:
      AccessStateSnapshot,
    token: string
  ) {
    const sessions =
      accessState.sessions

    if (!sessions) {
      return null
    }

    const canonicalTokenHash =
      await hashToken(
        token
      )

    const canonicalSession =
      sessions[
        canonicalTokenHash
      ]

    if (canonicalSession) {
      return canonicalSession
    }

    const legacyTokenHash =
      await hashLegacyToken(
        token
      )

    return sessions[
      legacyTokenHash
    ] ?? null
  }

  private async validateOpaqueEnrollmentActivation(
    body: JsonObject
  ) {
    const email =
      normalizeEmail(
        body.email
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    const activationPassword =
      normalizePassword(
        body.activationPassword
      )

    if (
      !isValidEmail(
        email
      ) ||
      !deviceId ||
      !activationPassword
    ) {
      return {
        response:
          json(
            {
              success:
                false,
              message:
                'O email, a senha de ativação ou o dispositivo não são válidos.'
            },
            401
          )
      } as const
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    const credential =
      accessState
        ?.credentials?.[
          email
        ]

    if (
      !accessState ||
      !credential
    ) {
      return {
        response:
          json(
            {
              success:
                false,
              message:
                'O email ou a senha de ativação não são válidos.'
            },
            401
          )
      } as const
    }

    const activationMatches =
      await verifyStoredCredential(
        credential,
        activationPassword
      )

    if (!activationMatches) {
      return {
        response:
          json(
            {
              success:
                false,
              message:
                'O email ou a senha de ativação não são válidos.'
            },
            401
          )
      } as const
    }

    return {
      email,
      deviceId,
      accessState
    } as const
  }

  private async handleOpaqueEnrollmentStart(
    request: Request
  ) {
    if (
      request.method !==
        'POST'
    ) {
      return json(
        {
          success:
            false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch {
      return json(
        {
          success:
            false,
          message:
            'Pedido OPAQUE de registo inválido.'
        },
        400
      )
    }

    const identity =
      await this.validateOpaqueEnrollmentActivation(
        body
      )

    if (
      'response' in
        identity
    ) {
      return identity
        .response
    }

    const registrationRequest =
      normalizeOpaquePayload(
        body.registrationRequest
      )

    if (!registrationRequest) {
      return json(
        {
          success:
            false,
          message:
            'Pedido OPAQUE de registo inválido.'
        },
        400
      )
    }

    const opaqueState =
      createOpaqueAuthProtocolState(
        await this.state.storage.get<MAProfessorOpaqueAuthState>(
          MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY
        )
      )

    try {
      const runtime =
        await getMAProfessorOpaqueServerRuntime()

      const started =
        startOpaqueEnrollment(
          opaqueState,
          runtime,
          {
            email:
              identity.email,
            deviceId:
              identity.deviceId,
            registrationRequest
          }
        )

      await this.state.storage.put(
        MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
        opaqueState
      )

      return json({
        success:
          true,
        enrollmentId:
          started.enrollmentId,
        registrationResponse:
          started.registrationResponse,
        expiresAt:
          new Date(
            started.expiresAt
          ).toISOString()
      })
    } catch (
      error
    ) {
      if (
        error instanceof
          Error &&
        error.message ===
          'OPAQUE_ALREADY_ENROLLED'
      ) {
        return json(
          {
            success:
              false,
            message:
              'A autenticação protegida desta conta já foi preparada.'
          },
          409
        )
      }

      return json(
        {
          success:
            false,
          message:
            'Não foi possível preparar a autenticação protegida.'
        },
        500
      )
    }
  }

  private async handleOpaqueEnrollmentFinish(
    request: Request
  ) {
    if (
      request.method !==
        'POST'
    ) {
      return json(
        {
          success:
            false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch {
      return json(
        {
          success:
            false,
          message:
            'Registo OPAQUE inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    if (
      !isValidEmail(
        email
      ) ||
      !deviceId
    ) {
      return json(
        {
          success:
            false,
          message:
            'Registo OPAQUE inválido.'
        },
        400
      )
    }

    const enrollmentId =
      normalizeOpaquePayload(
        body.enrollmentId
      )

    const registrationRecord =
      normalizeOpaquePayload(
        body.registrationRecord
      )

    if (
      !enrollmentId ||
      !registrationRecord
    ) {
      return json(
        {
          success:
            false,
          message:
            'Registo OPAQUE inválido.'
        },
        400
      )
    }

    const opaqueState =
      createOpaqueAuthProtocolState(
        await this.state.storage.get<MAProfessorOpaqueAuthState>(
          MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY
        )
      )

    try {
      finishOpaqueEnrollment(
        opaqueState,
        {
          email,
          deviceId,
          enrollmentId,
          registrationRecord,
          migratedFromV2:
            false
        }
      )

      await this.state.storage.put(
        MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
        opaqueState
      )

      return json({
        success:
          true,
        message:
          'Autenticação protegida preparada.'
      })
    } catch (
      error
    ) {
      const message =
        error instanceof
          Error
          ? error.message
          : ''

      return json(
        {
          success:
            false,
          message:
            message ===
              'OPAQUE_ALREADY_ENROLLED'
              ? 'A autenticação protegida desta conta já foi preparada.'
              : 'O registo OPAQUE expirou, já foi utilizado ou não corresponde a este dispositivo.'
        },
        message ===
          'OPAQUE_ALREADY_ENROLLED'
          ? 409
          : 401
      )
    }
  }

  private async handleOpaqueLoginStart(
    request: Request
  ) {
    if (
      request.method !==
        'POST'
    ) {
      return json(
        {
          success:
            false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch {
      return json(
        {
          success:
            false,
          message:
            'Pedido OPAQUE de login inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    const startLoginRequest =
      normalizeOpaquePayload(
        body.startLoginRequest
      )

    if (
      !isValidEmail(
        email
      ) ||
      !deviceId ||
      !startLoginRequest
    ) {
      return json(
        {
          success:
            false,
          message:
            'Pedido OPAQUE de login inválido.'
        },
        400
      )
    }

    const opaqueState =
      createOpaqueAuthProtocolState(
        await this.state.storage.get<MAProfessorOpaqueAuthState>(
          MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY
        )
      )

    try {
      const runtime =
        await getMAProfessorOpaqueServerRuntime()

      const started =
        startOpaqueLogin(
          opaqueState,
          runtime,
          {
            email,
            deviceId,
            startLoginRequest
          }
        )

      await this.state.storage.put(
        MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
        opaqueState
      )

      return json({
        success:
          true,
        loginId:
          started.loginId,
        loginResponse:
          started.loginResponse,
        expiresAt:
          new Date(
            started.expiresAt
          ).toISOString()
      })
    } catch {
      return json(
        {
          success:
            false,
          message:
            'Não foi possível iniciar a autenticação protegida.'
        },
        500
      )
    }
  }

  private async handleOpaqueLoginFinish(
    request: Request
  ) {
    if (
      request.method !==
        'POST'
    ) {
      return json(
        {
          success:
            false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request
        )
    } catch {
      return json(
        {
          success:
            false,
          message:
            'Não foi possível iniciar sessão com estas credenciais.'
        },
        401
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    const loginId =
      normalizeOpaquePayload(
        body.loginId
      )

    const finishLoginRequest =
      normalizeOpaquePayload(
        body.finishLoginRequest
      )

    if (
      !isValidEmail(
        email
      ) ||
      !deviceId ||
      !loginId ||
      !finishLoginRequest
    ) {
      return json(
        {
          success:
            false,
          message:
            'Não foi possível iniciar sessão com estas credenciais.'
        },
        401
      )
    }

    const opaqueState =
      createOpaqueAuthProtocolState(
        await this.state.storage.get<MAProfessorOpaqueAuthState>(
          MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY
        )
      )

    let authenticated:
      ReturnType<
        typeof finishOpaqueLogin
      > =
      null

    try {
      const runtime =
        await getMAProfessorOpaqueServerRuntime()

      authenticated =
        finishOpaqueLogin(
          opaqueState,
          runtime,
          {
            email,
            deviceId,
            loginId,
            finishLoginRequest
          }
        )
    } finally {
      await this.state.storage.put(
        MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY,
        opaqueState
      )
    }

    if (!authenticated) {
      return json(
        {
          success:
            false,
          message:
            'Não foi possível iniciar sessão com estas credenciais.'
        },
        401
      )
    }

    return this.issueAccountSession(
      authenticated.email,
      authenticated.deviceId
    )
  }

  private async issueAccountSession(
    email: string,
    deviceId: string
  ) {
    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    const license =
      accessState
        ?.licenses?.[
          email
        ]

    if (
      !license
    ) {
      return json(
        {
          success:
            false,
          message:
            'Esta conta não tem um período de acesso ativo.'
        },
        403
      )
    }

    if (
      !isUsableLicense(
        license
      )
    ) {
      return json(
        {
          success:
            false,
          message:
            license.revokedAt !==
              null
              ? 'O acesso desta conta foi revogado.'
              : 'O período de acesso desta conta terminou. É necessária uma nova ativação para continuar.'
        },
        403
      )
    }

    const sessions =
      accessState.sessions ||
      {}

    const activeSessions =
      Object.values(
        sessions
      ).filter(
        session =>
          session.email ===
            email &&
          session.revokedAt ===
            null
      )

    const deviceIds =
      new Set(
        activeSessions.map(
          session =>
            session.deviceId
        )
      )

    if (
      !deviceIds.has(
        deviceId
      ) &&
      deviceIds.size >=
        MAX_DEVICES
    ) {
      return json(
        {
          success:
            false,
          message:
            'Foi atingido o número máximo de dispositivos associados a esta conta.'
        },
        403
      )
    }

    while (
      activeSessions.length >=
        MAX_ACTIVE_SESSIONS
    ) {
      const oldest =
        activeSessions
          .sort(
            (
              left,
              right
            ) =>
              left.createdAt -
              right.createdAt
          )
          .shift()

      if (
        oldest
      ) {
        oldest.revokedAt =
          Date.now()
      }
    }

    const token =
      createToken()

    const tokenHash =
      await hashToken(
        token
      )

    const now =
      Date.now()

    sessions[
      tokenHash
    ] = {
      tokenHash,
      email,
      deviceId,
      createdAt:
        now,
      lastSeenAt:
        now,
      revokedAt:
        null
    }

    accessState.sessions =
      sessions

    accessState.updatedAt =
      now

    await this.state.storage.put(
      STORAGE_KEY,
      accessState
    )

    return json({
      success:
        true,
      message:
        'Sessão iniciada.',
      token,
      license:
        buildLicenseSummary(
          license
        )
    })

  }

  private async handleRequestStatus(
    request: Request
  ) {
    if (
      request.method !==
        'POST'
    ) {
      return this.existing.fetch(
        request
      )
    }

    try {
      const requestBody =
        await readJson(
          request.clone()
        )

      if (
        'accountPassword' in
          requestBody
      ) {
        return json(
          {
            success:
              false,
            message:
              'O fluxo antigo de password pessoal foi descontinuado. A password é criada apenas no dispositivo durante a ativação protegida.'
          },
          400
        )
      }
    } catch {
      return this.existing.fetch(
        request
      )
    }

    return this.existing.fetch(
      request
    )
  }

  private async handleCommerceStatus(
    request: Request
  ) {
    const response =
      await this.existing.fetch(
        request
      )

    if (
      !response.ok
    ) {
      return response
    }

    const body =
      await readResponseJson(
        response
      )

    if (
      !body ||
      body.success !==
        true ||
      !body.commerce ||
      typeof body.commerce !==
        'object' ||
      Array.isArray(
        body.commerce
      )
    ) {
      return response
    }

    const commerceBody =
      body.commerce as JsonObject

    const email =
      normalizeEmail(
        commerceBody.email
      )

    const commerceState =
      await this.state.storage.get<StoredCommerceState>(
        COMMERCE_STORAGE_KEY
      )

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    const canGenerateCredential =
      Boolean(
        authorization &&
        paymentResolved(
          authorization
        ) &&
        (
          authorization
            .activatedAt ??
          null
        ) ===
          null
      )

    return json({
      ...body,
      commerce: {
        ...commerceBody,
        canGenerateCredential
      }
    })
  }

  private async handleCredentialGenerate(
    request: Request
  ) {
    if (
      request.method !==
      'POST'
    ) {
      return this.existing.fetch(
        request
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(
          request.clone()
        )
    } catch {
      return this.existing.fetch(
        request
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const commerceState =
      await this.state.storage.get<StoredCommerceState>(
        COMMERCE_STORAGE_KEY
      )

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    if (
      !authorization
    ) {
      const accessState =
        await this.state.storage.get<AccessStateSnapshot>(
          STORAGE_KEY
        )

      const accessRequest =
        accessState
          ?.accessRequests?.[
            email
          ]

      if (
        accessRequest?.activatedAt !=
        null
      ) {
        return json(
          {
            success:
              false,
            message:
              'Este período piloto já foi ativado. A senha de ativação deste período já foi utilizada e não pode ser novamente emitida.'
          },
          409
        )
      }

      return this.existing.fetch(
        request
      )
    }

    if (
      !paymentResolved(
        authorization
      )
    ) {
      return json(
        {
          success:
            false,
          message:
            'A autorização ainda não tem o pagamento confirmado ou dispensado.'
        },
        409
      )
    }

    if (
      (
        authorization
          .activatedAt ??
        null
      ) !==
      null
    ) {
      return json(
        {
          success:
            false,
          message:
            'Este período já foi ativado. Para um novo período deve existir uma nova autorização.'
        },
        409
      )
    }

    const previousIssuedAt =
      authorization
        .credentialIssuedAt

    if (
      previousIssuedAt !==
      null
    ) {
      authorization
        .credentialIssuedAt =
        null

      authorization.updatedAt =
        Date.now()

      commerceState!.updatedAt =
        Date.now()

      await this.state.storage.put(
        COMMERCE_STORAGE_KEY,
        commerceState
      )
    }

    const delegated =
      await this.existing.fetch(
        request
      )

    if (
      !delegated.ok &&
      previousIssuedAt !==
        null
    ) {
      authorization
        .credentialIssuedAt =
        previousIssuedAt

      authorization.updatedAt =
        Date.now()

      commerceState!.updatedAt =
        Date.now()

      await this.state.storage.put(
        COMMERCE_STORAGE_KEY,
        commerceState
      )
    }

    return delegated
  }

  private async handleRequest(
    request: Request
  ): Promise<Response> {
    const url =
      new URL(
        request.url
      )

    if (
      url.pathname ===
      PUBLIC_ACTIVATE_PATH
    ) {
      return this.handleActivation(
        request
      )
    }

    if (
      url.pathname ===
        MA_PROFESSOR_OPAQUE_ENROLL_START_PATH
    ) {
      return this.handleOpaqueEnrollmentStart(
        request
      )
    }

    if (
      url.pathname ===
        MA_PROFESSOR_OPAQUE_ENROLL_FINISH_PATH
    ) {
      return this.handleOpaqueEnrollmentFinish(
        request
      )
    }

    if (
      url.pathname ===
        MA_PROFESSOR_OPAQUE_LOGIN_START_PATH
    ) {
      return this.handleOpaqueLoginStart(
        request
      )
    }

    if (
      url.pathname ===
        MA_PROFESSOR_OPAQUE_LOGIN_FINISH_PATH
    ) {
      return this.handleOpaqueLoginFinish(
        request
      )
    }

    if (
      url.pathname ===
      PUBLIC_LOGIN_PATH
    ) {
      return json(
        {
          success:
            false,
          message:
            'O login legado foi descontinuado. Utilize o login protegido.'
        },
        410
      )
    }

    if (
      url.pathname ===
      PUBLIC_START_PATH
    ) {
      return json(
        {
          success:
            false,
          message:
            'O início de sessão sem password foi descontinuado. Utilize a sua password pessoal.'
        },
        410
      )
    }

    if (
      url.pathname ===
      PUBLIC_REQUEST_PATH
    ) {
      return this.handleRequestStatus(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_COMMERCE_STATUS_PATH
    ) {
      return this.handleCommerceStatus(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_CREDENTIAL_GENERATE_PATH
    ) {
      return this.handleCredentialGenerate(
        request
      )
    }

    return this.existing.fetch(
      request
    )
  }
}
