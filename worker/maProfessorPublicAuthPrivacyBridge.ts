import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorLoginAttemptGuardBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const ACCOUNT_AUTH_STORAGE_KEY =
  'ma-professor-account-auth-v1'

const ACTIVATION_GUARD_STORAGE_KEY =
  'ma-professor-activation-guard-v1'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const PUBLIC_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

const PUBLIC_COMMERCE_STATUS_PATH =
  '/api/ma-professor/access/commerce/status'

const PASSWORD_HASH_ITERATIONS =
  100_000

const PASSWORD_SALT_BYTES =
  16

const ACTIVATION_GUARD_WINDOW_MS =
  10 * 60 * 1000

const ACTIVATION_GUARD_BLOCK_MS =
  15 * 60 * 1000

const ACTIVATION_GUARD_MAX_PAIR_FAILURES =
  8

const ACTIVATION_GUARD_MAX_ORIGIN_FAILURES =
  30

const ACTIVATION_GUARD_RETENTION_MS =
  60 * 60 * 1000

const ACTIVATION_GUARD_MAX_BUCKETS =
  512

type JsonObject =
  Record<string, unknown>

interface StoredActivationCredential {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
}

interface StoredSessionSnapshot {
  tokenHash: string
  email: string
  deviceId: string
  revokedAt: number | null
}

interface AccessStateSnapshot {
  credentials?: Record<
    string,
    StoredActivationCredential
  >

  sessions?: Record<
    string,
    StoredSessionSnapshot
  >
}

interface AccountAuthStateSnapshot {
  credentials?: Record<
    string,
    unknown
  >
}

interface ActivationGuardBucket {
  windowStartedAt: number
  count: number
  blockedUntil: number | null
  lastSeenAt: number
}

interface ActivationGuardState {
  schemaVersion: 1
  buckets: Record<
    string,
    ActivationGuardBucket
  >
  updatedAt: number
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put(
    key: string,
    value: unknown
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike
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
        'Cache-Control':
          'no-store',
        Pragma:
          'no-cache',
        'X-Content-Type-Options':
          'nosniff',
        'X-Frame-Options':
          'DENY',
        'Referrer-Policy':
          'no-referrer',
        'X-Robots-Tag':
          'noindex, nofollow',
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
        .trim()
        .slice(0, 128)
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
        .slice(0, maxLength)
    : ''
}

async function readRequestBody(
  request: Request
) {
  try {
    const parsed =
      await request
        .clone()
        .json() as unknown

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return null
    }

    return parsed as JsonObject
  } catch {
    return null
  }
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

function bytesToHex(
  bytes: Uint8Array
) {
  return Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')
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
    index < binary.length;
    index += 1
  ) {
    bytes[index] =
      binary.charCodeAt(index)
  }

  return bytes
}

async function hashPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const key =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        new TextEncoder()
          .encode(password)
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

  let difference = 0

  for (
    let index = 0;
    index < left.length;
    index += 1
  ) {
    difference |=
      left.charCodeAt(index) ^
      right.charCodeAt(index)
  }

  return difference === 0
}

async function consumeDummyPasswordCost(
  password: string
) {
  await hashPassword(
    password,
    new Uint8Array(
      PASSWORD_SALT_BYTES
    ),
    PASSWORD_HASH_ITERATIONS
  )
}

async function verifyActivationPassword(
  credential:
    StoredActivationCredential |
    undefined,
  password: string
) {
  if (!credential) {
    await consumeDummyPasswordCost(
      password
    )
    return false
  }

  const iterations =
    Number.isInteger(
      credential.passwordIterations
    ) &&
    credential.passwordIterations >=
      10_000 &&
    credential.passwordIterations <=
      1_000_000
      ? credential.passwordIterations
      : null

  if (!iterations) {
    await consumeDummyPasswordCost(
      password
    )
    return false
  }

  try {
    const calculated =
      await hashPassword(
        password,
        base64ToBytes(
          credential.passwordSalt
        ),
        iterations
      )

    return timingSafeEqual(
      calculated,
      credential.passwordHash
    )
  } catch {
    await consumeDummyPasswordCost(
      password
    )
    return false
  }
}

async function hashSessionToken(
  token: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(token)
    )

  return new Uint8Array(digest)
}

async function findSession(
  state:
    AccessStateSnapshot |
    undefined,
  token: string
) {
  if (!state?.sessions) {
    return null
  }

  const digest =
    await hashSessionToken(token)

  const canonical =
    state.sessions[
      bytesToBase64(digest)
    ]

  if (canonical) {
    return canonical
  }

  return state.sessions[
    bytesToHex(digest)
  ] ?? null
}

function createActivationGuardState():
  ActivationGuardState {
  return {
    schemaVersion: 1,
    buckets: {},
    updatedAt: Date.now()
  }
}

function normalizeActivationGuardState(
  value:
    ActivationGuardState |
    undefined
) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !value.buckets ||
    typeof value.buckets !==
      'object'
  ) {
    return createActivationGuardState()
  }

  return value
}

async function hashActivationGuardKey(
  scope: 'origin' | 'pair',
  value: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          `ma-professor-activation-guard:${scope}:${value}`
        )
    )

  return bytesToHex(
    new Uint8Array(digest)
  )
}

function pruneActivationGuardState(
  state: ActivationGuardState,
  now: number
) {
  const oldestAllowed =
    now -
    ACTIVATION_GUARD_RETENTION_MS

  for (
    const [key, bucket] of
    Object.entries(
      state.buckets
    )
  ) {
    if (
      bucket.lastSeenAt <
        oldestAllowed &&
      (
        bucket.blockedUntil ===
          null ||
        bucket.blockedUntil <= now
      )
    ) {
      delete state.buckets[key]
    }
  }
}

function makeRoomForActivationBucket(
  state: ActivationGuardState,
  currentKey: string
) {
  if (
    state.buckets[currentKey] ||
    Object.keys(
      state.buckets
    ).length <
      ACTIVATION_GUARD_MAX_BUCKETS
  ) {
    return
  }

  const oldestKey =
    Object.entries(
      state.buckets
    )
      .sort(
        (left, right) =>
          left[1].lastSeenAt -
          right[1].lastSeenAt
      )[0]?.[0]

  if (oldestKey) {
    delete state.buckets[oldestKey]
  }
}

function recordActivationFailure(
  state: ActivationGuardState,
  key: string,
  maxFailures: number,
  now: number
) {
  makeRoomForActivationBucket(
    state,
    key
  )

  let bucket =
    state.buckets[key]

  if (
    !bucket ||
    now -
      bucket.windowStartedAt >=
      ACTIVATION_GUARD_WINDOW_MS
  ) {
    bucket = {
      windowStartedAt: now,
      count: 1,
      blockedUntil: null,
      lastSeenAt: now
    }
  } else {
    bucket.count += 1
    bucket.lastSeenAt = now
  }

  if (
    bucket.count >=
      maxFailures
  ) {
    bucket.blockedUntil =
      now +
      ACTIVATION_GUARD_BLOCK_MS
  }

  state.buckets[key] =
    bucket
}

function getBlockedUntil(
  state: ActivationGuardState,
  keys: string[],
  now: number
) {
  let blockedUntil:
    number | null = null

  for (const key of keys) {
    const candidate =
      state.buckets[key]
        ?.blockedUntil ??
      null

    if (
      candidate !== null &&
      candidate > now &&
      (
        blockedUntil === null ||
        candidate > blockedUntil
      )
    ) {
      blockedUntil = candidate
    }
  }

  return blockedUntil
}

function getConnectingIp(
  request: Request
) {
  return (
    request.headers.get(
      'CF-Connecting-IP'
    ) || ''
  )
    .trim()
    .slice(0, 64)
}

function createGenericActivationFailure() {
  return json(
    {
      success: false,
      message:
        'Email ou senha de ativação incorretos.'
    },
    401
  )
}

function createActivationRateLimitResponse(
  blockedUntil: number,
  now: number
) {
  return json(
    {
      success: false,
      message:
        'Foram recebidas demasiadas tentativas de ativação desta origem. Aguarde alguns minutos antes de tentar novamente.'
    },
    429,
    {
      'Retry-After':
        String(
          Math.max(
            1,
            Math.ceil(
              (
                blockedUntil - now
              ) /
                1000
            )
          )
        )
    }
  )
}

function createInvalidSessionResponse() {
  return json(
    {
      success: false,
      message:
        'A sessão da conta não é válida.'
    },
    401
  )
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly existing:
    ExistingMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.state = state

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state as never,
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

  private async handleLogin(
    request: Request
  ) {
    const body =
      await readRequestBody(
        request
      )

    const email =
      normalizeEmail(
        body?.email
      )

    const password =
      normalizePassword(
        body?.password
      )

    if (
      !isValidEmail(email) ||
      !password
    ) {
      return this.existing.fetch(
        request
      )
    }

    const authState =
      await this.state.storage.get<AccountAuthStateSnapshot>(
        ACCOUNT_AUTH_STORAGE_KEY
      )

    const hasCredential =
      Boolean(
        authState?.credentials &&
        Object.prototype.hasOwnProperty.call(
          authState.credentials,
          email
        )
      )

    const response =
      await this.existing.fetch(
        request
      )

    if (
      response.status === 401 &&
      !hasCredential
    ) {
      await consumeDummyPasswordCost(
        password
      )
    }

    return response
  }

  private async handleActivation(
    request: Request
  ) {
    const body =
      await readRequestBody(
        request
      )

    const email =
      normalizeEmail(
        body?.email
      )

    const password =
      normalizePassword(
        body?.activationPassword ??
        body?.password
      )

    if (
      !isValidEmail(email) ||
      !password
    ) {
      return this.existing.fetch(
        request
      )
    }

    const connectingIp =
      getConnectingIp(
        request
      )

    let guardState:
      ActivationGuardState | null =
        null
    let originKey = ''
    let pairKey = ''

    if (connectingIp) {
      [originKey, pairKey] =
        await Promise.all([
          hashActivationGuardKey(
            'origin',
            connectingIp
          ),
          hashActivationGuardKey(
            'pair',
            `${connectingIp}\n${email}`
          )
        ])

      const now = Date.now()

      guardState =
        normalizeActivationGuardState(
          await this.state.storage.get<ActivationGuardState>(
            ACTIVATION_GUARD_STORAGE_KEY
          )
        )

      pruneActivationGuardState(
        guardState,
        now
      )

      const blockedUntil =
        getBlockedUntil(
          guardState,
          [originKey, pairKey],
          now
        )

      if (blockedUntil !== null) {
        return createActivationRateLimitResponse(
          blockedUntil,
          now
        )
      }
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    const matches =
      await verifyActivationPassword(
        accessState
          ?.credentials?.[
            email
          ],
        password
      )

    if (matches) {
      return this.existing.fetch(
        request
      )
    }

    if (
      !connectingIp ||
      !guardState ||
      !originKey ||
      !pairKey
    ) {
      return createGenericActivationFailure()
    }

    const now = Date.now()

    recordActivationFailure(
      guardState,
      originKey,
      ACTIVATION_GUARD_MAX_ORIGIN_FAILURES,
      now
    )

    recordActivationFailure(
      guardState,
      pairKey,
      ACTIVATION_GUARD_MAX_PAIR_FAILURES,
      now
    )

    guardState.updatedAt = now

    await this.state.storage.put(
      ACTIVATION_GUARD_STORAGE_KEY,
      guardState
    )

    const blockedUntil =
      getBlockedUntil(
        guardState,
        [originKey, pairKey],
        now
      )

    return blockedUntil !== null
      ? createActivationRateLimitResponse(
          blockedUntil,
          now
        )
      : createGenericActivationFailure()
  }

  private async handleCommerceStatus(
    request: Request
  ) {
    const body =
      await readRequestBody(
        request
      )

    const token =
      normalizeId(
        body?.token,
        256
      )

    const deviceId =
      normalizeId(
        body?.deviceId,
        180
      )

    if (!token || !deviceId) {
      return createInvalidSessionResponse()
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    const session =
      await findSession(
        accessState,
        token
      )

    const sessionEmail =
      normalizeEmail(
        session?.email
      )

    if (
      !session ||
      !sessionEmail ||
      session.revokedAt !== null ||
      session.deviceId !== deviceId
    ) {
      return createInvalidSessionResponse()
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

    return this.existing.fetch(
      new Request(
        request.url,
        {
          method: 'POST',
          headers:
            delegatedHeaders,
          body:
            JSON.stringify({
              ...(body || {}),
              email:
                sessionEmail,
              token,
              deviceId
            })
        }
      )
    )
  }

  private handleRequest(
    request: Request
  ): Promise<Response> {
    const url =
      new URL(request.url)

    if (
      request.method === 'POST' &&
      url.pathname ===
        PUBLIC_LOGIN_PATH
    ) {
      return this.handleLogin(
        request
      )
    }

    if (
      request.method === 'POST' &&
      url.pathname ===
        PUBLIC_ACTIVATE_PATH
    ) {
      return this.handleActivation(
        request
      )
    }

    if (
      request.method === 'POST' &&
      url.pathname ===
        PUBLIC_COMMERCE_STATUS_PATH
    ) {
      return this.handleCommerceStatus(
        request
      )
    }

    return this.existing.fetch(
      request
    )
  }
}
