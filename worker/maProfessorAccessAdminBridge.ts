import {
  MaProfessorAccessDurableObject as BaseMaProfessorAccessDurableObject,
  type AccessRequestStatus,
  type LicensePlan,
  type LicenseStatus,
  type MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const INTERNAL_ADMIN_OVERVIEW_PATH =
  '/__internal/ma-professor/admin/overview'

const INTERNAL_ADMIN_APPROVE_REQUEST_PATH =
  '/__internal/ma-professor/admin/requests/approve'

const INTERNAL_ADMIN_REJECT_REQUEST_PATH =
  '/__internal/ma-professor/admin/requests/reject'

const INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH =
  '/__internal/ma-professor/admin/credentials/status'

const INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

const EXPIRING_DAYS =
  7

const RENEWAL_GRACE_HOURS =
  24

const PASSWORD_HASH_ITERATIONS =
  120_000

const PASSWORD_SALT_BYTES =
  16

const GENERATED_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const GENERATED_PASSWORD_GROUPS =
  4

const GENERATED_PASSWORD_GROUP_LENGTH =
  4

export type MAProfessorAdminAccessRequestDecision =
  | 'approve'
  | 'reject'

interface StoredLicenseSnapshot {
  email: string
  plan: LicensePlan
  validFrom: number
  validUntil: number
  revokedAt: number | null
  renewalRequestedAt: number | null
}

interface StoredAccessRequestSnapshot {
  id: string
  email: string

  status:
    AccessRequestStatus

  requestedAt:
    number

  approvedAt:
    number | null

  rejectedAt:
    number | null

  activatedAt:
    number | null

  failedActivationAttempts:
    number

  blockedUntil:
    number | null

  updatedAt:
    number
}

interface StoredAccessCredentialSnapshot {
  email: string

  passwordSalt:
    string

  passwordHash:
    string

  passwordIterations:
    number

  createdAt:
    number

  updatedAt:
    number
}

interface StoredRenewalRequestSnapshot {
  id: string
  email: string

  requestedPlan:
    | 'paid_30_days'
    | 'school_year'

  amountCents:
    number

  currency:
    'EUR'

  status:
    'pending'

  requestedAt:
    number
}

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >

  renewals?:
    StoredRenewalRequestSnapshot[]

  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >

  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >

  updatedAt?:
    number
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
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

type JsonObject =
  Record<
    string,
    unknown
  >

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

function toIso(
  value:
    number |
    null |
    undefined
) {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(
      value
    )
  ) {
    return null
  }

  return new Date(
    value
  ).toISOString()
}

function normalizeEmail(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(
          0,
          180
        )
    : ''
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

async function readInternalJsonBody(
  request: Request
): Promise<JsonObject> {
  let parsed:
    unknown

  try {
    parsed =
      await request.json()
  } catch {
    throw new Error(
      'O pedido administrativo interno contém JSON inválido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'O pedido administrativo interno é inválido.'
    )
  }

  return parsed as
    JsonObject
}

function bytesToBase64(
  bytes:
    Uint8Array
) {
  let binary =
    ''

  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(
    binary
  )
}

function toArrayBuffer(
  value:
    Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(
    value
  )

  return copy.buffer
}

async function hashPassword(
  password: string,
  salt:
    Uint8Array,
  iterations:
    number
) {
  const encodedPassword =
    new TextEncoder()
      .encode(
        password
      )

  const baseKey =
    await globalThis
      .crypto
      .subtle
      .importKey(
        'raw',
        toArrayBuffer(
          encodedPassword
        ),
        'PBKDF2',
        false,
        [
          'deriveBits'
        ]
      )

  const bits =
    await globalThis
      .crypto
      .subtle
      .deriveBits(
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
        baseKey,
        256
      )

  return bytesToBase64(
    new Uint8Array(
      bits
    )
  )
}

function generatePassword() {
  const characterCount =
    GENERATED_PASSWORD_GROUPS *
    GENERATED_PASSWORD_GROUP_LENGTH

  const randomBytes =
    new Uint8Array(
      characterCount
    )

  globalThis
    .crypto
    .getRandomValues(
      randomBytes
    )

  const characters =
    Array.from(
      randomBytes,
      byte =>
        GENERATED_PASSWORD_ALPHABET[
          byte %
          GENERATED_PASSWORD_ALPHABET
            .length
        ]
    )

  const groups:
    string[] = []

  for (
    let index = 0;
    index <
      GENERATED_PASSWORD_GROUPS;
    index += 1
  ) {
    const start =
      index *
      GENERATED_PASSWORD_GROUP_LENGTH

    groups.push(
      characters
        .slice(
          start,
          start +
            GENERATED_PASSWORD_GROUP_LENGTH
        )
        .join('')
    )
  }

  return `MP-${groups.join(
    '-'
  )}`
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

function buildAccessRequestSummary(
  request:
    StoredAccessRequestSnapshot
) {
  return {
    email:
      request.email,

    status:
      request.status,

    requestedAt:
      toIso(
        request.requestedAt
      ),

    approvedAt:
      toIso(
        request.approvedAt
      ),

    rejectedAt:
      toIso(
        request.rejectedAt
      ),

    activatedAt:
      toIso(
        request.activatedAt
      )
  }
}

function buildCredentialStatus(
  email: string,
  credential:
    StoredAccessCredentialSnapshot |
    undefined
) {
  return {
    email,

    hasCredential:
      Boolean(
        credential
      ),

    createdAt:
      credential
        ? toIso(
            credential.createdAt
          )
        : null,

    updatedAt:
      credential
        ? toIso(
            credential.updatedAt
          )
        : null
  }
}

function buildOverview(
  state:
    AccessStateSnapshot |
    undefined
) {
  const now =
    Date.now()

  const accessRequests =
    Object.values(
      state?.accessRequests ||
        {}
    )
      .map(
        request =>
          buildAccessRequestSummary(
            request
          )
      )
      .sort(
        (
          left,
          right
        ) =>
          (
            right.requestedAt
              ? new Date(
                  right.requestedAt
                ).getTime()
              : 0
          ) -
          (
            left.requestedAt
              ? new Date(
                  left.requestedAt
                ).getTime()
              : 0
          )
      )

  const licenses =
    Object.values(
      state?.licenses ||
        {}
    )
      .map(
        license => ({
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
            toIso(
              license.validFrom
            ),

          validUntil:
            toIso(
              license.validUntil
            ),

          daysRemaining:
            getDaysRemaining(
              license.validUntil,
              now
            ),

          renewalRequestedAt:
            toIso(
              license
                .renewalRequestedAt
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.email.localeCompare(
            right.email
          )
      )

  const renewals =
    [
      ...(state?.renewals ||
        [])
    ]
      .sort(
        (
          left,
          right
        ) =>
          right.requestedAt -
          left.requestedAt
      )
      .map(
        renewal => {
          const requestedAt =
            toIso(
              renewal.requestedAt
            ) ||
            new Date(0)
              .toISOString()

          return {
            id:
              renewal.id,

            email:
              renewal.email,

            requestedPlan:
              renewal.requestedPlan,

            amountCents:
              renewal.amountCents,

            currency:
              renewal.currency,

            status:
              renewal.status,

            requestedAt,

            resolvedAt:
              null,

            createdAt:
              requestedAt,

            updatedAt:
              requestedAt
          }
        }
      )

  return {
    success:
      true as const,

    accessRequests,
    licenses,
    renewals,

    generatedAt:
      new Date(now)
        .toISOString()
  }
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly env:
    MaProfessorAccessEnv

  private base:
    BaseMaProfessorAccessDurableObject

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

    this.base =
      new BaseMaProfessorAccessDurableObject(
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

  private refreshBase() {
    /*
     * O motor público mantém o estado em memória.
     *
     * Depois de uma escrita administrativa,
     * recriamos a instância base para que o
     * pedido público seguinte releia imediatamente
     * o estado persistido.
     */
    this.base =
      new BaseMaProfessorAccessDurableObject(
        this.state,
        this.env
      )
  }

  private async handleAccessRequestDecision(
    request: Request,
    decision:
      MAProfessorAdminAccessRequestDecision
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
        await readInternalJsonBody(
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
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
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
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this
        .state
        .storage
        .get<AccessStateSnapshot>(
          STORAGE_KEY
        )

    const accessRequest =
      state
        ?.accessRequests
        ?.[email]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success:
            false,

          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status !==
      'pending'
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este pedido já não está pendente.',

          request:
            buildAccessRequestSummary(
              accessRequest
            )
        },
        409
      )
    }

    const now =
      Date.now()

    if (
      decision ===
      'approve'
    ) {
      accessRequest.status =
        'approved'

      accessRequest.approvedAt =
        now

      accessRequest.rejectedAt =
        null
    } else {
      accessRequest.status =
        'rejected'

      accessRequest.rejectedAt =
        now

      accessRequest.approvedAt =
        null
    }

    accessRequest.updatedAt =
      now

    state.updatedAt =
      now

    await this
      .state
      .storage
      .put(
        STORAGE_KEY,
        state
      )

    this.refreshBase()

    return json({
      success:
        true,

      message:
        decision ===
        'approve'
          ? 'Pedido aprovado.'
          : 'Pedido rejeitado.',

      request:
        buildAccessRequestSummary(
          accessRequest
        )
    })
  }

  private async handleCredentialStatus(
    request: Request
  ) {
    if (
      request.method !==
      'GET'
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
            'GET'
        }
      )
    }

    const url =
      new URL(
        request.url
      )

    const email =
      normalizeEmail(
        url.searchParams.get(
          'email'
        )
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
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this
        .state
        .storage
        .get<AccessStateSnapshot>(
          STORAGE_KEY
        )

    const accessRequest =
      state
        ?.accessRequests
        ?.[email]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success:
            false,

          message:
            'A conta não foi encontrada.'
        },
        404
      )
    }

    const credential =
      state
        .credentials
        ?.[email]

    return json({
      success:
        true,

      credential:
        buildCredentialStatus(
          email,
          credential
        )
    })
  }

  private async handleCredentialGenerate(
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
        await readInternalJsonBody(
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
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
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
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this
        .state
        .storage
        .get<AccessStateSnapshot>(
          STORAGE_KEY
        )

    const accessRequest =
      state
        ?.accessRequests
        ?.[email]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success:
            false,

          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status !==
      'approved'
    ) {
      return json(
        {
          success:
            false,

          message:
            accessRequest.status ===
            'pending'
              ? 'O pedido tem de ser aprovado antes de gerar a senha.'
              : 'Não é possível gerar uma senha para um pedido rejeitado.'
        },
        409
      )
    }

    const credentials =
      state.credentials ||
      {}

    const existingCredential =
      credentials[
        email
      ]

    if (
      existingCredential
    ) {
      return json(
        {
          success:
            false,

          message:
            'Esta conta já tem uma senha associada. A senha existente não pode ser recuperada em texto simples.',

          credential:
            buildCredentialStatus(
              email,
              existingCredential
            )
        },
        409
      )
    }

    const password =
      generatePassword()

    const salt =
      new Uint8Array(
        PASSWORD_SALT_BYTES
      )

    globalThis
      .crypto
      .getRandomValues(
        salt
      )

    const passwordHash =
      await hashPassword(
        password,
        salt,
        PASSWORD_HASH_ITERATIONS
      )

    const now =
      Date.now()

    const credential:
      StoredAccessCredentialSnapshot = {
        email,

        passwordSalt:
          bytesToBase64(
            salt
          ),

        passwordHash,

        passwordIterations:
          PASSWORD_HASH_ITERATIONS,

        createdAt:
          now,

        updatedAt:
          now
      }

    credentials[
      email
    ] =
      credential

    state.credentials =
      credentials

    accessRequest
      .failedActivationAttempts =
      0

    accessRequest.blockedUntil =
      null

    accessRequest.updatedAt =
      now

    state.updatedAt =
      now

    await this
      .state
      .storage
      .put(
        STORAGE_KEY,
        state
      )

    this.refreshBase()

    return json({
      success:
        true,

      message:
        'Senha criada. Copie-a agora: por segurança, não poderá voltar a ser consultada em texto simples.',

      credential: {
        ...buildCredentialStatus(
          email,
          credential
        ),

        password
      }
    })
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
      INTERNAL_ADMIN_OVERVIEW_PATH
    ) {
      if (
        request.method !==
        'GET'
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
              'GET'
          }
        )
      }

      const state =
        await this
          .state
          .storage
          .get<AccessStateSnapshot>(
            STORAGE_KEY
          )

      return json(
        buildOverview(
          state
        )
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_APPROVE_REQUEST_PATH
    ) {
      return this
        .handleAccessRequestDecision(
          request,
          'approve'
        )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_REJECT_REQUEST_PATH
    ) {
      return this
        .handleAccessRequestDecision(
          request,
          'reject'
        )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH
    ) {
      return this
        .handleCredentialStatus(
          request
        )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH
    ) {
      return this
        .handleCredentialGenerate(
          request
        )
    }

    return this.base.fetch(
      request
    )
  }
}

function getMAProfessorAccessStub(
  env:
    MaProfessorAccessEnv
) {
  const id =
    env
      .MA_PROFESSOR_ACCESS
      .idFromName(
        ACCESS_DURABLE_OBJECT_NAME
      )

  return env
    .MA_PROFESSOR_ACCESS
    .get(id)
}

export async function getMAProfessorAdminOverview(
  env:
    MaProfessorAccessEnv
) {
  const stub =
    getMAProfessorAccessStub(
      env
    )

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_OVERVIEW_PATH}`,
      {
        method:
          'GET'
      }
    )
  )
}

export async function decideMAProfessorAccessRequest(
  env:
    MaProfessorAccessEnv,
  email: string,
  decision:
    MAProfessorAdminAccessRequestDecision
) {
  const stub =
    getMAProfessorAccessStub(
      env
    )

  const pathname =
    decision ===
    'approve'
      ? INTERNAL_ADMIN_APPROVE_REQUEST_PATH
      : INTERNAL_ADMIN_REJECT_REQUEST_PATH

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${pathname}`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}

export async function getMAProfessorAdminCredentialStatus(
  env:
    MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(
      env
    )

  const url =
    new URL(
      `https://ma-professor.internal${INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH}`
    )

  url.searchParams.set(
    'email',
    email
  )

  return stub.fetch(
    new Request(
      url.toString(),
      {
        method:
          'GET'
      }
    )
  )
}

export async function generateMAProfessorAdminCredential(
  env:
    MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(
      env
    )

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH}`,
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}
