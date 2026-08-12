export const MA_PROFESSOR_ACCESS_API_PREFIX =
  '/api/ma-professor/access'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const PRODUCT_NAME =
  'MA-Professor'

const MAX_BODY_BYTES =
  12_000

const BETA_DAYS =
  30

const EXPIRING_DAYS =
  7

const RENEWAL_GRACE_HOURS =
  24

const MAX_SESSIONS_PER_EMAIL =
  4

const MAX_DEVICES_PER_EMAIL =
  8

const SESSION_MAX_AGE_DAYS =
  180

const PASSWORD_MIN_LENGTH =
  6

const PASSWORD_MAX_LENGTH =
  128

const MAX_FAILED_ACTIVATION_ATTEMPTS =
  5
const ACTIVATION_BLOCK_MINUTES =
  15

export type LicensePlan =
  | 'beta_30_days'
  | 'paid_30_days'
  | 'school_year'
  | 'courtesy_30_days'
  | 'courtesy_school_year'

export type LicenseStatus =
  | 'inactive'
  | 'active'
  | 'expiring'
  | 'renewal_pending'
  | 'expired'
  | 'revoked'

export type AccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

interface LicenseSummary {
  email: string

  plan:
    LicensePlan | null

  status:
    LicenseStatus

  validFrom:
    string | null
  validUntil:
    string | null

  daysRemaining:
    number | null

  renewalRequestedAt:
    string | null
}

interface StoredLicense {
  email: string

  plan:
    LicensePlan

  validFrom:
    number

  validUntil:
    number

  revokedAt:
    number | null

  renewalRequestedAt:
    number | null

  renewalRequestedPlan:
    LicensePlan | null

  deviceIds:
    string[]

  createdAt:
    number

  updatedAt:
    number
}

interface StoredSession {
  tokenHash: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
  revokedAt: number | null
}

interface StoredRenewalRequest {
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

interface StoredAccessRequest {
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

interface StoredAccessCredential {
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

interface LegacyAccessState {
  schemaVersion?:
    1

  licenses?:
    Record<
      string,
      StoredLicense
    >

  sessions?:
    Record<
      string,
      StoredSession
    >

  renewals?:
    StoredRenewalRequest[]

  createdAt?:
    number

  updatedAt?:
    number
}

interface AccessState {
  schemaVersion:
    2

  licenses:
    Record<
      string,
      StoredLicense
    >

  sessions:
    Record<
      string,
      StoredSession
    >

  renewals:
    StoredRenewalRequest[]

  accessRequests:
    Record<
      string,
      StoredAccessRequest
    >

  credentials:
    Record<
      string,
      StoredAccessCredential
    >

  createdAt:
    number

  updatedAt:
    number
}

interface DurableObjectIdLike {}

interface DurableObjectStubLike {
  fetch(
    request: Request
  ): Promise<Response>
}

interface DurableObjectNamespaceLike {
  idFromName(
    name: string
  ): DurableObjectIdLike

  get(
    id:
      DurableObjectIdLike
  ): DurableObjectStubLike
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

export interface MaProfessorAccessEnv {
  MA_PROFESSOR_ACCESS:
    DurableObjectNamespaceLike

  WEB3FORMS_ACCESS_KEY?:
    string

  WEB3FORMS_KEY?:
    string
}

type JsonBody =
  Record<
    string,
    unknown
  >

const securityHeaders:
  Record<
    string,
    string
  > = {
    'Cache-Control':
      'no-store',

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
    Record<
      string,
      string
    > = {}
) {
  return new Response(
    JSON.stringify(
      body
    ),
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

function createInitialState():
  AccessState {
  const timestamp =
    Date.now()

  return {
    schemaVersion:
      2,

    licenses:
      {},

    sessions:
      {},

    renewals:
      [],

    accessRequests:
      {},

    credentials:
      {},

    createdAt:
      timestamp,

    updatedAt:
      timestamp
  }
}

function createId(
  prefix: string
) {
  const uuid =
    globalThis
      .crypto
      ?.randomUUID
      ?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(
          2,
          14
        )}`
}

function migrateState(
  stored:
    | AccessState
    | LegacyAccessState
    | undefined
): AccessState {
  if (!stored) {
    return createInitialState()
  }

  const timestamp =
    Date.now()

  const licenses =
    stored.licenses ||
    {}

  const sessions =
    stored.sessions ||
    {}

  const renewals =
    Array.isArray(
      stored.renewals
    )
      ? stored.renewals
      : []

  const accessRequests =
    'accessRequests' in
        stored &&
    stored.accessRequests &&
    typeof stored
      .accessRequests ===
      'object'
      ? stored
          .accessRequests as
          Record<
            string,
            StoredAccessRequest
          >
      : {}

  const credentials =
    'credentials' in
        stored &&
    stored.credentials &&
    typeof stored
      .credentials ===
      'object'
      ? stored
          .credentials as
          Record<
            string,
            StoredAccessCredential
          >
      : {}

  /*
   * As licenças já existentes são preservadas.
   *
   * Não reduzimos retroativamente um período que
   * já tenha sido atribuído antes desta alteração.
   */
  for (
    const license of
    Object.values(
      licenses
    )
  ) {
    if (
      accessRequests[
        license.email
      ]
    ) {
      continue
    }

    accessRequests[
      license.email
    ] = {
      id:
        createId(
          'access'
        ),

      email:
        license.email,

      status:
        'approved',

      requestedAt:
        license.createdAt,

      approvedAt:
        license.createdAt,

      rejectedAt:
        null,

      activatedAt:
        license.validFrom,

      failedActivationAttempts:
        0,

      blockedUntil:
        null,

      updatedAt:
        license.updatedAt
    }
  }

  return {
    schemaVersion:
      2,

    licenses,

    sessions,

    renewals,

    accessRequests,

    credentials,

    createdAt:
      typeof stored
        .createdAt ===
        'number'
        ? stored.createdAt
        : timestamp,

    updatedAt:
      typeof stored
        .updatedAt ===
        'number'
        ? stored.updatedAt
        : timestamp
  }
}

function normalizeOrigin(
  value: string
) {
  try {
    return new URL(
      value
    ).origin
  } catch {
    return ''
  }
}

function isAllowedOrigin(
  request: Request
) {
  const requestOrigin =
    new URL(
      request.url
    ).origin

  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const referer =
    normalizeOrigin(
      request.headers.get(
        'Referer'
      ) || ''
    )

  const candidate =
    origin ||
    referer

  if (!candidate) {
    return false
  }

  const allowed =
    new Set([
      requestOrigin,
      'https://ma-code.pt',
      'https://www.ma-code.pt'
    ])

  try {
    const hostname =
      new URL(
        candidate
      ).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(
        hostname
      )
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(
    candidate
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
        .slice(
          0,
          180
        )
    : ''
}

function normalizeId(
  value: unknown,
  maxLength = 180
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

function normalizePassword(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .slice(
          0,
          PASSWORD_MAX_LENGTH
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

function randomToken() {
  const bytes =
    new Uint8Array(
      32
    )

  globalThis.crypto
    .getRandomValues(
      bytes
    )

  return Array
    .from(
      bytes,
      byte =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            '0'
          )
    )
    .join('')
}

function bytesToBase64(
  bytes:
    Uint8Array
) {
  let binary = ''

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

function base64ToBytes(
  value: string
) {
  const binary =
    atob(
      value
    )

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
    bytes[
      index
    ] =
      binary.charCodeAt(
        index
      )
  }

  return bytes
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

async function hashToken(
  token: string
) {
  const encoded =
    new TextEncoder()
      .encode(
        token
      )

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',
        toArrayBuffer(
          encoded
        )
      )

  return Array
    .from(
      new Uint8Array(
        digest
      ),
      byte =>
        byte
          .toString(
            16
          )
          .padStart(
            2,
            '0'
          )
    )
    .join('')
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

function timingSafeEqual(
  left: string,
  right: string
) {
  if (
    left.length !==
      right.length
  ) {
    return false
  }

  let difference =
    0

  for (
    let index = 0;
    index <
      left.length;
    index += 1
  ) {
    difference |=
      left.charCodeAt(
        index
      ) ^
      right.charCodeAt(
        index
      )
  }

  return difference ===
    0
}

async function verifyPassword(
  password: string,
  credential:
    StoredAccessCredential
) {
  let salt:
    Uint8Array

  try {
    salt =
      base64ToBytes(
        credential
          .passwordSalt
      )
  } catch {
    return false
  }

  const calculatedHash =
    await hashPassword(
      password,
      salt,
      credential
        .passwordIterations
    )

  return timingSafeEqual(
    calculatedHash,
    credential
      .passwordHash
  )
}

function toIso(
  value:
    number | null
) {
  return value ===
    null
    ? null
    : new Date(
        value
      ).toISOString()
}

function addDays(
  timestamp: number,
  days: number
) {
  return (
    timestamp +
    days *
      24 *
      60 *
      60 *
      1000
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
    StoredLicense,
  now: number
): LicenseStatus {
  if (
    license
      .revokedAt !==
    null
  ) {
    return 'revoked'
  }

  /*
   * Um pedido de renovação não prolonga uma licença expirada.
   */
  if (
    license
      .validUntil <=
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
    StoredLicense,
  now =
    Date.now()
): LicenseSummary {
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
  }
}

function buildAccessRequestSummary(
  request:
    StoredAccessRequest
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

async function readBody(
  request: Request
): Promise<JsonBody> {
  const contentType =
    request.headers.get(
      'content-type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes(
        'application/json'
      )
  ) {
    throw new Error(
      'Formato de pedido inválido.'
    )
  }

  const contentLength =
    Number(
      request.headers.get(
        'content-length'
      ) || 0
    )

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      MAX_BODY_BYTES
  ) {
    throw new Error(
      'O pedido é demasiado grande.'
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder()
      .encode(
        text
      )
      .byteLength >
    MAX_BODY_BYTES
  ) {
    throw new Error(
      'O pedido é demasiado grande.'
    )
  }

  const parsed =
    JSON.parse(
      text
    ) as unknown

  if (
    typeof parsed !==
      'object' ||
    parsed === null ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'O pedido enviado não é válido.'
    )
  }

  return parsed as
    JsonBody
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof
    Error
    ? error.message
    : 'Não foi possível processar o pedido.'
}

function getDurableObject(
  env:
    MaProfessorAccessEnv
) {
  const id =
    env
      .MA_PROFESSOR_ACCESS
      .idFromName(
        'ma-professor-access-global'
      )

  return env
    .MA_PROFESSOR_ACCESS
    .get(
      id
    )
}

export function isMAProfessorAccessApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_ACCESS_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_ACCESS_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorAccessApiRequest(
  request: Request,
  env:
    MaProfessorAccessEnv
) {
  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const corsHeaders:
    Record<
      string,
      string
    > = {}

  if (
    origin &&
    isAllowedOrigin(
      request
    )
  ) {
    corsHeaders[
      'Access-Control-Allow-Origin'
    ] =
      origin

    corsHeaders.Vary =
      'Origin'
  }

  if (
    request.method ===
      'OPTIONS'
  ) {
    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Pedido bloqueado por origem inválida.'
        },
        403
      )
    }

    return new Response(
      null,
      {
        status:
          204,

        headers: {
          ...securityHeaders,
          ...corsHeaders,

          'Access-Control-Allow-Headers':
            'Content-Type',

          'Access-Control-Allow-Methods':
            'POST, OPTIONS',

          'Access-Control-Max-Age':
            '86400'
        }
      }
    )
  }

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
        ...corsHeaders,

        Allow:
          'POST, OPTIONS'
      }
    )
  }

  if (
    !isAllowedOrigin(
      request
    )
  ) {
    return json(
      {
        success:
          false,

        message:
          'Pedido bloqueado por origem inválida.'
      },
      403,
      corsHeaders
    )
  }

  const response =
    await getDurableObject(
      env
    ).fetch(
      request
    )

  const headers =
    new Headers(
      response.headers
    )

  Object.entries(
    corsHeaders
  ).forEach(
    (
      [
        name,
        value
      ]
    ) => {
      headers.set(
        name,
        value
      )
    }
  )

  return new Response(
    response.body,
    {
      status:
        response.status,

      statusText:
        response.statusText,

      headers
    }
  )
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly env:
    MaProfessorAccessEnv

  private storedState:
    AccessState | null =
      null

  private operation:
    Promise<void>

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

    this.operation =
      this.state
        .blockConcurrencyWhile(
          async () => {
            const stored =
              await this
                .state
                .storage
                .get<
                  | AccessState
                  | LegacyAccessState
                >(
                  STORAGE_KEY
                )

            this.storedState =
              migrateState(
                stored
              )

            this.pruneSessions(
              this.storedState
            )

            await this.save()
          }
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

  private async getState() {
    if (
      !this.storedState
    ) {
      const stored =
        await this
          .state
          .storage
          .get<
            | AccessState
            | LegacyAccessState
          >(
            STORAGE_KEY
          )

      this.storedState =
        migrateState(
          stored
        )
    }

    return this
      .storedState
  }

  private async save() {
    if (
      !this.storedState
    ) {
      return
    }

    this.storedState
      .updatedAt =
      Date.now()

    await this
      .state
      .storage
      .put(
        STORAGE_KEY,
        this.storedState
      )
  }

  private pruneSessions(
    state:
      AccessState
  ) {
    const oldestAllowed =
      addDays(
        Date.now(),
        -SESSION_MAX_AGE_DAYS
      )

    for (
      const [
        tokenHash,
        session
      ] of
      Object.entries(
        state.sessions
      )
    ) {
      if (
        session
          .revokedAt !==
          null ||
        session
          .lastSeenAt <
          oldestAllowed
      ) {
        delete state
          .sessions[
          tokenHash
        ]
      }
    }
  }

  private async handleRequest(
    request: Request
  ) {
    const url =
      new URL(
        request.url
      )

    if (
      !isMAProfessorAccessApiPath(
        url.pathname
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Endpoint não encontrado.'
        },
        404
      )
    }

    const action =
      url.pathname.slice(
        MA_PROFESSOR_ACCESS_API_PREFIX
          .length
      ) || '/'

    try {
      const body =
        await readBody(
          request
        )

      switch (
        action
      ) {
        case '/request':
          return this
            .handleAccessRequest(
              body
            )

        case '/activate':
          return this
            .handleActivate(
              body
            )

        case '/start':
          return this
            .handleLegacyStart(
              body
            )

        case '/verify':
          return this
            .handleVerify(
              body
            )

        case '/confirm-pilot':
          return this
            .handleConfirmPilot(
              body
            )

        case '/renew':
          return this
            .handleRenew(
              body
            )

        case '/logout':
          return this
            .handleLogout(
              body
            )

        default:
          return json(
            {
              success:
                false,

              message:
                'Endpoint não encontrado.'
            },
            404
          )
      }
    } catch (
      error
    ) {
      const message =
        getErrorMessage(
          error
        )

      const status =
        message ===
          'O pedido é demasiado grande.'
          ? 413
          : message.includes(
                'JSON'
              ) ||
              message.includes(
                'Formato'
              ) ||
              message.includes(
                'válido'
              )
            ? 400
            : 500

      return json(
        {
          success:
            false,

          message
        },
        status
      )
    }
  }

  private async issueSession(
    state:
      AccessState,
    email: string,
    deviceId: string
  ) {
    const now =
      Date.now()

    const existing =
      Object.entries(
        state.sessions
      )
        .filter(
          (
            [
              ,
              session
            ]
          ) =>
            session.email ===
              email &&
            session
              .revokedAt ===
              null
        )
        .sort(
          (
            left,
            right
          ) =>
            right[
              1
            ].lastSeenAt -
            left[
              1
            ].lastSeenAt
        )

    for (
      const [
        tokenHash
      ] of
      existing.slice(
        MAX_SESSIONS_PER_EMAIL -
          1
      )
    ) {
      delete state
        .sessions[
        tokenHash
      ]
    }

    const token =
      randomToken()

    const tokenHash =
      await hashToken(
        token
      )

    state.sessions[
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

    return token
  }

  private async handleAccessRequest(
    body:
      JsonBody
  ) {
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
        .getState()

    const now =
      Date.now()

    const existingLicense =
      state.licenses[
        email
      ]

    let request =
      state
        .accessRequests[
        email
      ]

    if (
      existingLicense &&
      !request
    ) {
      request = {
        id:
          createId(
            'access'
          ),

        email,

        status:
          'approved',

        requestedAt:
          existingLicense
            .createdAt,

        approvedAt:
          existingLicense
            .createdAt,

        rejectedAt:
          null,

        activatedAt:
          existingLicense
            .validFrom,

        failedActivationAttempts:
          0,

        blockedUntil:
          null,

        updatedAt:
          now
      }

      state
        .accessRequests[
        email
      ] =
        request
    }

    if (
      existingLicense &&
      request
    ) {
      await this.save()

      return json({
        success:
          true,

        request:
          buildAccessRequestSummary(
            request
          ),

        canActivate:
          Boolean(
            state
              .credentials[
              email
            ]
          ),

        message:
          state
            .credentials[
            email
          ]
            ? 'Esta conta já está aprovada. Introduza a senha associada à conta para entrar.'
            : 'Esta conta já existe. A MA-CODE terá de associar uma senha antes de poder iniciar uma nova sessão.'
      })
    }

    if (
      request
    ) {
      if (
        request.status ===
          'pending'
      ) {
        return json({
          success:
            true,

          request:
            buildAccessRequestSummary(
              request
            ),

          canActivate:
            false,

          message:
            'O seu pedido já está registado e continua em análise pela MA-CODE.'
        })
      }

      if (
        request.status ===
          'approved'
      ) {
        return json({
          success:
            true,

          request:
            buildAccessRequestSummary(
              request
            ),

          canActivate:
            Boolean(
              state
                .credentials[
                email
              ]
            ),

          message:
            state
              .credentials[
              email
            ]
              ? 'O seu pedido já foi aprovado. Introduza a senha recebida por email para ativar a conta.'
              : 'O pedido foi aprovado, mas a senha ainda não está disponível. Aguarde o email da MA-CODE.'
        })
      }

      return json({
        success:
          true,

        request:
          buildAccessRequestSummary(
            request
          ),

        canActivate:
          false,

        message:
          'Este pedido foi rejeitado. Contacte a MA-CODE se pretender esclarecer ou voltar a solicitar acesso.'
      })
    }

    request = {
      id:
        createId(
          'access'
        ),

      email,

      status:
        'pending',

      requestedAt:
        now,

      approvedAt:
        null,

      rejectedAt:
        null,

      activatedAt:
        null,

      failedActivationAttempts:
        0,

      blockedUntil:
        null,

      updatedAt:
        now
    }

    state
      .accessRequests[
      email
    ] =
      request

    await this.save()

    await this
      .notifyAccessRequest(
        request
      )

    return json({
      success:
        true,

      request:
        buildAccessRequestSummary(
          request
        ),

      canActivate:
        false,

      message:
        'Pedido recebido. A MA-CODE irá analisar o pedido e, após aprovação, enviará por email a senha necessária para ativar a conta.'
    })
  }

  private async handleActivate(
    body:
      JsonBody
  ) {
    const email =
      normalizeEmail(
        body.email
      )

    const password =
      normalizePassword(
        body.password
      )

    const deviceId =
      normalizeId(
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
            'Indique um email válido.'
        },
        400
      )
    }

    if (
      password.length <
        PASSWORD_MIN_LENGTH ||
      password.length >
        PASSWORD_MAX_LENGTH
    ) {
      return json(
        {
          success:
            false,

          message:
            'Indique a senha recebida da MA-CODE.'
        },
        400
      )
    }

    if (
      deviceId.length <
      12
    ) {
      return json(
        {
          success:
            false,

          message:
            'O identificador deste dispositivo não é válido.'
        },
        400
      )
    }

    const state =
      await this
        .getState()

    const request =
      state
        .accessRequests[
        email
      ]

    if (
      !request
    ) {
      return json(
        {
          success:
            false,

          message:
            'Ainda não existe um pedido de acesso para este email. Faça primeiro o pedido de acesso.'
        },
        404
      )
    }

    if (
      request.status ===
      'pending'
    ) {
      return json(
        {
          success:
            false,

          message:
            'O pedido ainda está em análise. Aguarde o email de aprovação da MA-CODE.'
        },
        409
      )
    }

    if (
      request.status ===
      'rejected'
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este pedido não foi aprovado. Contacte a MA-CODE para mais informações.'
        },
        403
      )
    }

    const now =
      Date.now()

    if (
      request
        .blockedUntil !==
        null &&
      request
        .blockedUntil >
        now
    ) {
      return json(
        {
          success:
            false,

          message:
            'Foram feitas várias tentativas inválidas. Aguarde alguns minutos antes de tentar novamente.'
        },
        429
      )
    }

    const credential =
      state
        .credentials[
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
            'A conta está aprovada, mas a senha ainda não foi emitida. Aguarde o email da MA-CODE.'
        },
        409
      )
    }

    const passwordMatches =
      await verifyPassword(
        password,
        credential
      )

    if (
      !passwordMatches
    ) {
      request
        .failedActivationAttempts +=
        1

      request.updatedAt =
        now

      if (
        request
          .failedActivationAttempts >=
        MAX_FAILED_ACTIVATION_ATTEMPTS
      ) {
        request
          .failedActivationAttempts =
          0

        request.blockedUntil =
          now +
          ACTIVATION_BLOCK_MINUTES *
            60 *
            1000
      }

      await this.save()

      return json(
        {
          success:
            false,

          message:
            'Email ou senha incorretos.'
        },
        401
      )
    }

    request
      .failedActivationAttempts =
      0

    request.blockedUntil =
      null

    request.updatedAt =
      now

    let license =
      state.licenses[
        email
      ]

    /*
     * A beta nasce apenas aqui:
     * na primeira ativação válida.
     */
    if (
      !license
    ) {
      license = {
        email,

        plan:
          'beta_30_days',

        validFrom:
          now,

        validUntil:
          addDays(
            now,
            BETA_DAYS
          ),

        revokedAt:
          null,

        renewalRequestedAt:
          null,

        renewalRequestedPlan:
          null,

        deviceIds: [
          deviceId
        ],

        createdAt:
          now,

        updatedAt:
          now
      }

      state.licenses[
        email
      ] =
        license

      request.activatedAt =
        now
    } else {
      if (
        license
          .revokedAt !==
        null
      ) {
        return json(
          {
            success:
              false,

            message:
              'Esta licença foi revogada.'
          },
          403
        )
      }

      /*
       * A senha da conta permite iniciar sessão noutro dispositivo.
       * A chave de recuperação continua a ser necessária para abrir
       * os dados cifrados nesse novo dispositivo.
       */
      if (
        !license
          .deviceIds
          .includes(
            deviceId
          )
      ) {
        if (
          license
            .deviceIds
            .length >=
          MAX_DEVICES_PER_EMAIL
        ) {
          return json(
            {
              success:
                false,

              message:
                'Esta conta já atingiu o limite de dispositivos autorizados. Contacte a MA-CODE.'
            },
            409
          )
        }

        license
          .deviceIds
          .push(
            deviceId
          )
      }
    }

    const token =
      await this
        .issueSession(
          state,
          email,
          deviceId
        )

    license.updatedAt =
      now

    await this.save()

    return json({
      success:
        true,

      token,

      license:
        buildLicenseSummary(
          license,
          now
        )
    })
  }

  /*
   * Compatibilidade transitória com clientes antigos.
   *
   * Nunca cria uma licença nova.
   * Apenas permite reabrir uma licença já existente
   * no mesmo dispositivo.
   */
  private async handleLegacyStart(
    body:
      JsonBody
  ) {
    const email =
      normalizeEmail(
        body.email
      )

    const deviceId =
      normalizeId(
        body.deviceId
      )

    if (
      !isValidEmail(
        email
      ) ||
      deviceId.length <
        12
    ) {
      return json(
        {
          success:
            false,

          message:
            'O pedido de acesso não é válido.'
        },
        400
      )
    }

    const state =
      await this
        .getState()

    const license =
      state.licenses[
        email
      ]

    if (
      !license ||
      !license
        .deviceIds
        .includes(
          deviceId
        )
    ) {
      return json(
        {
          success:
            false,

          message:
            'A ativação automática deixou de estar disponível. Faça um pedido de acesso e utilize a senha enviada pela MA-CODE.'
        },
        410
      )
    }

    if (
      license
        .revokedAt !==
      null
    ) {
      return json(
        {
          success:
            false,

          message:
            'Esta licença foi revogada.'
        },
        403
      )
    }

    const token =
      await this
        .issueSession(
          state,
          email,
          deviceId
        )

    license.updatedAt =
      Date.now()

    await this.save()

    return json({
      success:
        true,

      token,

      license:
        buildLicenseSummary(
          license
        )
    })
  }

  private async authenticate(
    body:
      JsonBody
  ) {
    const token =
      normalizeId(
        body.token,
        256
      )

    const deviceId =
      normalizeId(
        body.deviceId
      )

    if (
      !token ||
      !deviceId
    ) {
      return null
    }

    const state =
      await this
        .getState()

    const tokenHash =
      await hashToken(
        token
      )

    const session =
      state.sessions[
        tokenHash
      ]

    if (
      !session ||
      session
        .revokedAt !==
        null ||
      session.deviceId !==
        deviceId
    ) {
      return null
    }

    const license =
      state.licenses[
        session.email
      ]

    if (
      !license
    ) {
      return null
    }

    session.lastSeenAt =
      Date.now()

    return {
      state,

      tokenHash,

      session,

      license
    }
  }

  private async handleVerify(
    body:
      JsonBody
  ) {
    const authenticated =
      await this
        .authenticate(
          body
        )

    if (
      !authenticated
    ) {
      return json(
        {
          success:
            false,

          message:
            'A sessão já não é válida.'
        },
        401
      )
    }

    await this.save()

    return json({
      success:
        true,

      license:
        buildLicenseSummary(
          authenticated
            .license
        )
    })
  }

  private async handleConfirmPilot(
    body:
      JsonBody
  ) {
    const authenticated =
      await this
        .authenticate(
          body
        )

    if (
      !authenticated
    ) {
      return json(
        {
          success:
            false,

          message:
            'A sessão já não é válida.'
        },
        401
      )
    }

    const now =
      Date.now()

    const {
      license
    } =
      authenticated

    if (
      license.plan !==
      'beta_30_days'
    ) {
      return json(
        {
          success:
            false,

          message:
            'A confirmação periódica aplica-se apenas ao acesso gratuito da fase piloto.'
        },
        409
      )
    }

    const status =
      getLicenseStatus(
        license,
        now
      )

    if (
      status ===
      'revoked'
    ) {
      return json(
        {
          success:
            false,

          message:
            'Esta licença foi revogada.'
        },
        403
      )
    }

    if (
      status ===
      'expired'
    ) {
      return json(
        {
          success:
            false,

          message:
            'O período de confirmação terminou e esta vaga piloto já não está ativa.'
        },
        410
      )
    }

    if (
      status !==
      'expiring'
    ) {
      return json(
        {
          success:
            false,

          message:
            'A confirmação da vaga piloto ainda não está disponível. Esta ação só pode ser realizada durante o período de confirmação.'
        },
        409
      )
    }

    license.validUntil =
      addDays(
        license.validUntil,
        BETA_DAYS
      )

    license.updatedAt =
      now

    await this.save()

    return json({
      success:
        true,

      license:
        buildLicenseSummary(
          license,
          now
        )
    })
  }

  private async handleRenew(
    body:
      JsonBody
  ) {
    const authenticated =
      await this
        .authenticate(
          body
        )

    if (
      !authenticated
    ) {
      return json(
        {
          success:
            false,

          message:
            'A sessão já não é válida.'
        },
        401
      )
    }

    const requestedPlan =
      normalizeId(
        body.requestedPlan
      )

    if (
      requestedPlan !==
        'paid_30_days' &&
      requestedPlan !==
        'school_year'
    ) {
      return json(
        {
          success:
            false,

          message:
            'Escolha um plano de renovação válido.'
        },
        400
      )
    }

    const now =
      Date.now()

    const {
      state,
      license
    } =
      authenticated

    const recentRequest =
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
      !recentRequest
    ) {
      const amountCents =
        requestedPlan ===
          'paid_30_days'
          ? 349
          : 1500

      const renewal:
        StoredRenewalRequest = {
        id:
          createId(
            'renewal'
          ),

        email:
          license.email,

        requestedPlan,

        amountCents,

        currency:
          'EUR',

        status:
          'pending',

        requestedAt:
          now
      }

      state
        .renewals
        .unshift(
          renewal
        )

      state.renewals =
        state
          .renewals
          .slice(
            0,
            2000
          )

      license
        .renewalRequestedAt =
        now

      license
        .renewalRequestedPlan =
        requestedPlan

      license.updatedAt =
        now

      await this.save()

      await this
        .notifyRenewal(
          renewal
        )
    } else {
      await this.save()
    }

    return json({
      success:
        true,

      license:
        buildLicenseSummary(
          license,
          now
        ),

      message:
        'Pedido registado. A MA-CODE confirmará manualmente o pagamento e a nova autorização. Não existe renovação automática.'
    })
  }

  private async handleLogout(
    body:
      JsonBody
  ) {
    const authenticated =
      await this
        .authenticate(
          body
        )

    if (
      authenticated
    ) {
      delete authenticated
        .state
        .sessions[
        authenticated
          .tokenHash
      ]

      await this.save()
    }

    return json({
      success:
        true
    })
  }

  private async notifyAccessRequest(
    request:
      StoredAccessRequest
  ) {
    const accessKey =
      (
        this.env
          .WEB3FORMS_ACCESS_KEY ||
        this.env
          .WEB3FORMS_KEY ||
        ''
      ).trim()

    if (
      !accessKey
    ) {
      console.warn(
        'MA-Professor access request notification not sent',
        {
          reason:
            'WEB3FORMS access key missing',

          requestId:
            request.id,

          email:
            request.email
        }
      )

      return
    }

    try {
      const response =
        await fetch(
          'https://api.web3forms.com/submit',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Accept:
                'application/json'
            },

            body:
              JSON.stringify({
                access_key:
                  accessKey,

                subject:
                  `Novo pedido de acesso ${PRODUCT_NAME}`,

                from_name:
                  'MA-Code Website',

                name:
                  'Pedido MA-Professor',

                email:
                  request.email,

                replyto:
                  request.email,

                product:
                  PRODUCT_NAME,

                request_id:
                  request.id,

                requested_at:
                  new Date(
                    request
                      .requestedAt
                  ).toISOString(),

                message: [
                  `Novo pedido de acesso ao ${PRODUCT_NAME}.`,
                  '',
                  `Email: ${request.email}`,
                  `Pedido: ${request.id}`,
                  `Data: ${new Date(
                    request.requestedAt
                  ).toISOString()}`,
                  '',
                  'O pedido ficou PENDENTE e não ativou qualquer licença.'
                ].join(
                  '\n'
                )
              })
          }
        )

      if (
        !response.ok
      ) {
        console.error(
          'MA-Professor access request notification rejected',
          {
            status:
              response.status,

            requestId:
              request.id
          }
        )
      }
    } catch (
      error
    ) {
      console.error(
        'MA-Professor access request notification failed',
        {
          message:
            getErrorMessage(
              error
            ),

          requestId:
            request.id
        }
      )
    }
  }

  private async notifyRenewal(
    renewal:
      StoredRenewalRequest
  ) {
    const accessKey =
      (
        this.env
          .WEB3FORMS_ACCESS_KEY ||
        this.env
          .WEB3FORMS_KEY ||
        ''
      ).trim()

    if (
      !accessKey
    ) {
      console.warn(
        'MA-Professor renewal notification not sent',
        {
          reason:
            'WEB3FORMS access key missing',

          renewalId:
            renewal.id,

          email:
            renewal.email
        }
      )

      return
    }

    const planLabel =
      renewal
        .requestedPlan ===
        'paid_30_days'
        ? 'Mensal · 3,49 €'
        : 'Ano letivo · 15 €'

    try {
      const response =
        await fetch(
          'https://api.web3forms.com/submit',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',

              Accept:
                'application/json'
            },

            body:
              JSON.stringify({
                access_key:
                  accessKey,

                subject:
                  `Pedido de renovação ${PRODUCT_NAME}`,

                from_name:
                  'MA-Code Website',

                name:
                  'Utilizador MA-Professor',

                email:
                  renewal.email,

                replyto:
                  renewal.email,

                product:
                  PRODUCT_NAME,

                plan:
                  planLabel,

                amount:
                  `${(
                    renewal
                      .amountCents /
                    100
                  )
                    .toFixed(
                      2
                    )
                    .replace(
                      '.',
                      ','
                    )} €`,

                renewal_id:
                  renewal.id,

                requested_at:
                  new Date(
                    renewal
                      .requestedAt
                  ).toISOString(),

                message: [
                  `Novo pedido de renovação do ${PRODUCT_NAME}.`,
                  '',
                  `Email: ${renewal.email}`,
                  `Plano: ${planLabel}`,
                  `Pedido: ${renewal.id}`,
                  `Data: ${new Date(
                    renewal.requestedAt
                  ).toISOString()}`
                ].join(
                  '\n'
                )
              })
          }
        )

      if (
        !response.ok
      ) {
        console.error(
          'MA-Professor renewal notification rejected',
          {
            status:
              response.status,

            renewalId:
              renewal.id
          }
        )
      }
    } catch (
      error
    ) {
      console.error(
        'MA-Professor renewal notification failed',
        {
          message:
            getErrorMessage(
              error
            ),

          renewalId:
            renewal.id
        }
      )
    }
  }
}
