import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorExplicitApprovalBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const REQUEST_GUARD_STORAGE_KEY =
  'ma-professor-access-request-guard-v1'

const PUBLIC_ACCESS_REQUEST_PATH =
  '/api/ma-professor/access/request'

const INTERNAL_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

const REQUEST_GUARD_WINDOW_MS =
  10 * 60 * 1000

const REQUEST_GUARD_BLOCK_MS =
  15 * 60 * 1000

const REQUEST_GUARD_MAX_ATTEMPTS =
  30

const REQUEST_GUARD_RETENTION_MS =
  60 * 60 * 1000

const REQUEST_GUARD_MAX_BUCKETS =
  256

type JsonObject =
  Record<string, unknown>

interface StoredAccessCredentialSnapshot {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  createdAt: number
  updatedAt: number
}

interface AccessStateSnapshot {
  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >
}

interface RequestGuardBucket {
  windowStartedAt: number
  count: number
  blockedUntil: number | null
  lastSeenAt: number
}

interface RequestGuardState {
  schemaVersion: 1
  buckets: Record<
    string,
    RequestGuardBucket
  >
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

function createRequestGuardState():
  RequestGuardState {
  return {
    schemaVersion: 1,
    buckets: {},
    updatedAt: Date.now()
  }
}

function normalizeRequestGuardState(
  value:
    RequestGuardState |
    undefined
) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !value.buckets ||
    typeof value.buckets !==
      'object'
  ) {
    return createRequestGuardState()
  }

  return value
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

async function hashRequestOrigin(
  value: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          `ma-professor-access-request:${value}`
        )
    )

  return bytesToHex(
    new Uint8Array(digest)
  )
}

function pruneRequestGuardState(
  state: RequestGuardState,
  now: number
) {
  const oldestAllowed =
    now -
    REQUEST_GUARD_RETENTION_MS

  for (
    const [
      key,
      bucket
    ] of Object.entries(
      state.buckets
    )
  ) {
    if (
      bucket.lastSeenAt <
        oldestAllowed &&
      (
        bucket.blockedUntil ===
          null ||
        bucket.blockedUntil <=
          now
      )
    ) {
      delete state.buckets[
        key
      ]
    }
  }
}

function makeRoomForRequestGuardBucket(
  state: RequestGuardState,
  currentKey: string
) {
  if (
    state.buckets[
      currentKey
    ] ||
    Object.keys(
      state.buckets
    ).length <
      REQUEST_GUARD_MAX_BUCKETS
  ) {
    return
  }

  const oldestKey =
    Object.entries(
      state.buckets
    )
      .sort(
        (
          left,
          right
        ) =>
          left[1].lastSeenAt -
          right[1].lastSeenAt
      )[0]?.[0]

  if (oldestKey) {
    delete state.buckets[
      oldestKey
    ]
  }
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

    return parsed as
      JsonObject
  } catch {
    return null
  }
}

async function readEmail(
  request: Request
) {
  const parsed =
    await readRequestBody(
      request
    )

  return normalizeEmail(
    parsed?.email
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
    this.state =
      state

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

  private async enforceAccessRequestRateLimit(
    request: Request
  ) {
    if (
      request.method !==
        'POST' ||
      new URL(
        request.url
      ).pathname !==
        PUBLIC_ACCESS_REQUEST_PATH
    ) {
      return null
    }

    const body =
      await readRequestBody(
        request
      )

    if (
      !body ||
      typeof body.accountPassword !==
        'string' ||
      body.accountPassword.length ===
        0
    ) {
      return null
    }

    const connectingIp =
      (
        request.headers.get(
          'CF-Connecting-IP'
        ) || ''
      )
        .trim()
        .slice(0, 64)

    if (!connectingIp) {
      return null
    }

    const key =
      await hashRequestOrigin(
        connectingIp
      )

    const now =
      Date.now()

    const state =
      normalizeRequestGuardState(
        await this.state.storage.get<RequestGuardState>(
          REQUEST_GUARD_STORAGE_KEY
        )
      )

    pruneRequestGuardState(
      state,
      now
    )

    makeRoomForRequestGuardBucket(
      state,
      key
    )

    let bucket =
      state.buckets[
        key
      ]

    if (
      bucket?.blockedUntil !==
        null &&
      bucket?.blockedUntil !==
        undefined &&
      bucket.blockedUntil >
        now
    ) {
      return json(
        {
          success: false,
          message:
            'Foram recebidos demasiados pedidos de acesso desta origem. Aguarde alguns minutos antes de tentar novamente.'
        },
        429,
        {
          'Retry-After':
            String(
              Math.max(
                1,
                Math.ceil(
                  (
                    bucket.blockedUntil -
                    now
                  ) /
                    1000
                )
              )
            )
        }
      )
    }

    if (
      !bucket ||
      now -
        bucket.windowStartedAt >=
        REQUEST_GUARD_WINDOW_MS
    ) {
      bucket = {
        windowStartedAt: now,
        count: 1,
        blockedUntil: null,
        lastSeenAt: now
      }
    } else {
      bucket.count += 1
      bucket.lastSeenAt =
        now
    }

    if (
      bucket.count >
      REQUEST_GUARD_MAX_ATTEMPTS
    ) {
      bucket.blockedUntil =
        now +
        REQUEST_GUARD_BLOCK_MS
    }

    state.buckets[
      key
    ] =
      bucket

    state.updatedAt =
      now

    await this.state.storage.put(
      REQUEST_GUARD_STORAGE_KEY,
      state
    )

    if (
      bucket.blockedUntil !==
        null &&
      bucket.blockedUntil >
        now
    ) {
      return json(
        {
          success: false,
          message:
            'Foram recebidos demasiados pedidos de acesso desta origem. Aguarde alguns minutos antes de tentar novamente.'
        },
        429,
        {
          'Retry-After':
            String(
              Math.ceil(
                REQUEST_GUARD_BLOCK_MS /
                  1000
              )
            )
        }
      )
    }

    return null
  }

  private async handleRequest(
    request: Request
  ) {
    const pathname =
      new URL(
        request.url
      ).pathname

    if (
      pathname ===
        PUBLIC_ACCESS_REQUEST_PATH
    ) {
      const limited =
        await this.enforceAccessRequestRateLimit(
          request
        )

      if (limited) {
        return limited
      }
    }

    if (
      pathname !==
        INTERNAL_CREDENTIAL_GENERATE_PATH ||
      request.method !==
        'POST'
    ) {
      return this.existing.fetch(
        request
      )
    }

    const email =
      await readEmail(
        request
      )

    if (!email) {
      return this.existing.fetch(
        request
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    if (
      accessState
        ?.credentials?.[
          email
        ]
    ) {
      return json(
        {
          success: false,
          message:
            'Já existe uma senha de ativação emitida para esta conta. Por segurança, a senha existente foi preservada e não foi substituída. Utilize o email de ativação já enviado.'
        },
        409
      )
    }

    return this.existing.fetch(
      request
    )
  }
}
