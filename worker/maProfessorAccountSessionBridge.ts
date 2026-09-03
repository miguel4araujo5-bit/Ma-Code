import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccessAuthBridge'

import type {
  LicensePlan,
  LicenseStatus,
  MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const PUBLIC_ACCOUNT_VERIFY_PATH =
  '/api/ma-professor/access/account/verify'

const PUBLIC_LOGOUT_PATH =
  '/api/ma-professor/access/logout'

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

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >

  sessions?: Record<
    string,
    StoredSessionSnapshot
  >

  updatedAt?: number

  [key: string]: unknown
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

const licenseOnlyLoginMessages =
  new Set([
    'Esta conta não tem um período de acesso ativo.',
    'O acesso desta conta foi revogado.',
    'O período de acesso desta conta terminou. É necessária uma nova ativação para continuar.'
  ])

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders
      }
    }
  )
}

async function readJson(
  request: Request
): Promise<JsonObject> {
  const parsed =
    await request.json()

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

function normalizeId(
  value: unknown,
  maxLength = 256
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(
          0,
          maxLength
        )
    : ''
}

function bytesToBase64(
  bytes: Uint8Array
) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte)
  }

  return btoa(binary)
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
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function hashToken(
  token: string
) {
  const hash =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(token)
    )

  return bytesToBase64(
    new Uint8Array(hash)
  )
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
    license.renewalRequestedAt !==
      null &&
    now -
      license.renewalRequestedAt <=
      RENEWAL_GRACE_HOURS *
        60 *
        60 *
        1000

  if (renewalGraceActive) {
    return 'renewal_pending'
  }

  if (
    getDaysRemaining(
      license.validUntil,
      now
    ) <= EXPIRING_DAYS
  ) {
    return 'expiring'
  }

  return 'active'
}

function buildLicenseSummary(
  license:
    StoredLicenseSnapshot
) {
  const now = Date.now()

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
      license.renewalRequestedAt ===
        null
        ? null
        : new Date(
            license.renewalRequestedAt
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
    this.state = state
    this.env = env
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

  private async issueAccountSession(
    email: string,
    deviceId: string,
    accessState:
      AccessStateSnapshot
  ) {
    const sessions =
      accessState.sessions || {}

    const activeSessions =
      Object.values(
        sessions
      ).filter(
        session =>
          session.email === email &&
          session.revokedAt === null
      )

    const deviceIds =
      new Set(
        activeSessions.map(
          session =>
            session.deviceId
        )
      )

    if (
      !deviceIds.has(deviceId) &&
      deviceIds.size >=
        MAX_DEVICES
    ) {
      return json(
        {
          success: false,
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
            (left, right) =>
              left.createdAt -
              right.createdAt
          )
          .shift()

      if (oldest) {
        oldest.revokedAt =
          Date.now()
      }
    }

    const token =
      createToken()
    const tokenHash =
      await hashToken(token)
    const now =
      Date.now()

    sessions[tokenHash] = {
      tokenHash,
      email,
      deviceId,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null
    }

    accessState.sessions =
      sessions
    accessState.updatedAt =
      now

    await this.state.storage.put(
      STORAGE_KEY,
      accessState
    )

    const license =
      accessState
        .licenses?.[email] ??
      null

    return json({
      success: true,
      message:
        license
          ? 'Sessão da conta iniciada. O acesso às ferramentas permanece bloqueado até existir uma licença utilizável.'
          : 'Sessão da conta iniciada. A conta está ativa, mas ainda não tem um período de acesso.',
      token,
      email,
      license:
        license
          ? buildLicenseSummary(
              license
            )
          : null
    })
  }

  private async handleLogin(
    request: Request
  ) {
    if (
      request.method !== 'POST'
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
    const deviceId =
      normalizeId(
        body.deviceId,
        180
      )

    const delegated =
      await this.existing.fetch(
        request
      )

    if (delegated.ok) {
      return delegated
    }

    const delegatedBody =
      await readResponseJson(
        delegated
      )
    const message =
      typeof delegatedBody?.message ===
        'string'
        ? delegatedBody.message
        : ''

    if (
      delegated.status !== 403 ||
      !licenseOnlyLoginMessages.has(
        message
      ) ||
      !email ||
      !deviceId
    ) {
      return delegated
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    if (!accessState) {
      return json(
        {
          success: false,
          message:
            'A conta foi autenticada, mas não foi possível criar a sessão.'
        },
        500
      )
    }

    return this.issueAccountSession(
      email,
      deviceId,
      accessState
    )
  }

  private async handleAccountVerify(
    request: Request
  ) {
    if (
      request.method !== 'POST'
    ) {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(request)
    } catch {
      return json(
        {
          success: false,
          message:
            'O pedido de verificação da conta é inválido.'
        },
        400
      )
    }

    const token =
      normalizeId(
        body.token,
        256
      )
    const deviceId =
      normalizeId(
        body.deviceId,
        180
      )

    if (!token || !deviceId) {
      return json(
        {
          success: false,
          message:
            'A sessão da conta não é válida.'
        },
        401
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    if (!accessState?.sessions) {
      return json(
        {
          success: false,
          message:
            'A sessão da conta já não é válida.'
        },
        401
      )
    }

    const tokenHash =
      await hashToken(token)
    const session =
      accessState.sessions[
        tokenHash
      ]

    if (
      !session ||
      session.revokedAt !== null ||
      session.deviceId !== deviceId
    ) {
      return json(
        {
          success: false,
          message:
            'A sessão da conta já não é válida.'
        },
        401
      )
    }

    session.lastSeenAt =
      Date.now()
    accessState.updatedAt =
      Date.now()

    await this.state.storage.put(
      STORAGE_KEY,
      accessState
    )

    const license =
      accessState
        .licenses?.[
          session.email
        ] ??
      null

    return json({
      success: true,
      email:
        session.email,
      license:
        license
          ? buildLicenseSummary(
              license
            )
          : null
    })
  }

  private async handleLogout(
    request: Request
  ) {
    if (
      request.method !== 'POST'
    ) {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405
      )
    }

    let body:
      JsonObject

    try {
      body =
        await readJson(request)
    } catch {
      return json({
        success: true,
        message:
          'Sessão terminada.'
      })
    }

    const token =
      normalizeId(
        body.token,
        256
      )
    const deviceId =
      normalizeId(
        body.deviceId,
        180
      )

    if (token && deviceId) {
      const accessState =
        await this.state.storage.get<AccessStateSnapshot>(
          STORAGE_KEY
        )

      if (accessState?.sessions) {
        const tokenHash =
          await hashToken(token)
        const session =
          accessState.sessions[
            tokenHash
          ]

        if (
          session &&
          session.deviceId ===
            deviceId &&
          session.revokedAt ===
            null
        ) {
          session.revokedAt =
            Date.now()
          accessState.updatedAt =
            Date.now()

          await this.state.storage.put(
            STORAGE_KEY,
            accessState
          )
        }
      }
    }

    return json({
      success: true,
      message:
        'Sessão terminada.'
    })
  }

  private handleRequest(
    request: Request
  ): Promise<Response> {
    const pathname =
      new URL(
        request.url
      ).pathname

    if (
      pathname ===
        PUBLIC_LOGIN_PATH
    ) {
      return this.handleLogin(request)
    }

    if (
      pathname ===
        PUBLIC_ACCOUNT_VERIFY_PATH
    ) {
      return this.handleAccountVerify(
        request
      )
    }

    if (
      pathname ===
        PUBLIC_LOGOUT_PATH
    ) {
      return this.handleLogout(request)
    }

    return this.existing.fetch(
      request
    )
  }
}
