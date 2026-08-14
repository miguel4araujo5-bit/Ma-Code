import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccessAdminBridge'

import type {
  LicensePlan,
  LicenseStatus,
  MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const ACCOUNT_AUTH_STORAGE_KEY =
  'ma-professor-account-auth-v1'

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

const PASSWORD_HASH_ITERATIONS =
  100_000

const PASSWORD_SALT_BYTES =
  16

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
  authorizations: StoredCommercialAuthorization[]
  createdAt: number
  updatedAt: number
}

interface StoredAccountCredential {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  createdAt: number
  updatedAt: number
}

interface StoredAccountAuthState {
  schemaVersion: 1
  credentials: Record<
    string,
    StoredAccountCredential
  >
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

async function createAccountCredential(
  email: string,
  password: string
): Promise<StoredAccountCredential> {
  const salt =
    new Uint8Array(
      PASSWORD_SALT_BYTES
    )

  globalThis.crypto.getRandomValues(
    salt
  )

  const now =
    Date.now()

  return {
    email,
    passwordSalt:
      bytesToBase64(
        salt
      ),
    passwordHash:
      await hashPassword(
        password,
        salt,
        PASSWORD_HASH_ITERATIONS
      ),
    passwordIterations:
      PASSWORD_HASH_ITERATIONS,
    createdAt:
      now,
    updatedAt:
      now
  }
}

async function verifyAccountPassword(
  credential:
    StoredAccountCredential,
  password: string
) {
  const calculated =
    await hashPassword(
      password,
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

function createAccountAuthState():
  StoredAccountAuthState {
  const now =
    Date.now()

  return {
    schemaVersion:
      1,
    credentials:
      {},
    createdAt:
      now,
    updatedAt:
      now
  }
}

function normalizeAccountAuthState(
  stored:
    StoredAccountAuthState |
    undefined
) {
  if (
    !stored ||
    stored.schemaVersion !==
      1 ||
    !stored.credentials ||
    typeof stored.credentials !==
      'object'
  ) {
    return createAccountAuthState()
  }

  return stored
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

    const accountPassword =
      normalizePassword(
        body.accountPassword
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
      !isValidPersonalPassword(
        accountPassword
      )
    ) {
      return json(
        {
          success:
            false,
          message:
            'A password pessoal deve ter entre 6 e 128 caracteres.'
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

    const authState =
      normalizeAccountAuthState(
        await this.state.storage.get<StoredAccountAuthState>(
          ACCOUNT_AUTH_STORAGE_KEY
        )
      )

    const existingPersonalCredential =
      authState.credentials[
        email
      ]

    if (
      existingPersonalCredential
    ) {
      const passwordMatches =
        await verifyAccountPassword(
          existingPersonalCredential,
          accountPassword
        )

      if (
        !passwordMatches
      ) {
        return json(
          {
            success:
              false,
            message:
              'A password pessoal está incorreta. Para ativar um novo período deve usar a mesma password pessoal da sua conta.'
          },
          401
        )
      }
    }

    const delegatedRequest =
      new Request(
        request.url,
        {
          method:
            'POST',
          headers:
            request.headers,
          body:
            JSON.stringify({
              email,
              password:
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
      !existingPersonalCredential
    ) {
      authState.credentials[
        email
      ] =
        await createAccountCredential(
          email,
          accountPassword
        )
    }

    authState.updatedAt =
      Date.now()

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

    await this.state.storage.put({
      [ACCOUNT_AUTH_STORAGE_KEY]:
        authState,
      [STORAGE_KEY]:
        accessState
    })

    return json({
      ...delegatedBody,
      message:
        existingPersonalCredential
          ? 'Período de acesso ativado. Continue a usar a sua password pessoal para entrar no MA-Professor.'
          : 'Período de acesso ativado. A sua password pessoal ficou definida e será usada nos próximos acessos.'
    })
  }

  private async handleLogin(
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

    const password =
      normalizePassword(
        body.password
      )

    const deviceId =
      normalizeDeviceId(
        body.deviceId
      )

    if (
      !isValidEmail(
        email
      ) ||
      !password ||
      !deviceId
    ) {
      return json(
        {
          success:
            false,
          message:
            'Introduza o email e a password pessoal da sua conta.'
        },
        400
      )
    }

    const authState =
      normalizeAccountAuthState(
        await this.state.storage.get<StoredAccountAuthState>(
          ACCOUNT_AUTH_STORAGE_KEY
        )
      )

    const credential =
      authState.credentials[
        email
      ]

    if (
      !credential
    ) {
      return json(
        {
          success:
            false,
          message:
            'Esta conta ainda não tem uma password pessoal definida. Se recebeu uma senha de ativação, utilize primeiro a opção “Tenho uma senha de ativação”.'
        },
        401
      )
    }

    const passwordMatches =
      await verifyAccountPassword(
        credential,
        password
      )

    if (
      !passwordMatches
    ) {
      return json(
        {
          success:
            false,
          message:
            'Email ou password pessoal incorretos.'
        },
        401
      )
    }

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
        true
    ) {
      return response
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (
      !email
    ) {
      return response
    }

    const authState =
      normalizeAccountAuthState(
        await this.state.storage.get<StoredAccountAuthState>(
          ACCOUNT_AUTH_STORAGE_KEY
        )
      )

    const hasPersonalPassword =
      Boolean(
        authState.credentials[
          email
        ]
      )

    return json({
      ...body,
      hasPersonalPassword,
      message:
        body.canActivate ===
          true
          ? hasPersonalPassword
            ? 'Existe uma nova senha de ativação disponível para esta conta. Utilize-a apenas para ativar o novo período.'
            : 'O pedido foi aprovado. Utilize a senha de ativação recebida para ativar o período e definir a sua password pessoal.'
          : body.message
    })
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
      PUBLIC_LOGIN_PATH
    ) {
      return this.handleLogin(
        request
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
