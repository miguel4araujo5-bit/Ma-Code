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

  put(
    keyOrEntries:
      | string
      | Record<string, unknown>,
    value?: unknown
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage:
    DurableObjectStorageLike
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function cloneSnapshot(
  value: unknown
) {
  return value === undefined
    ? undefined
    : structuredClone(value)
}

function deepEqual(
  left: unknown,
  right: unknown
): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (
    Array.isArray(left) ||
    Array.isArray(right)
  ) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !==
        right.length
    ) {
      return false
    }

    return left.every(
      (value, index) =>
        deepEqual(
          value,
          right[index]
        )
    )
  }

  if (
    !isRecord(left) ||
    !isRecord(right)
  ) {
    return false
  }

  const leftKeys =
    Object.keys(left)
  const rightKeys =
    Object.keys(right)

  if (
    leftKeys.length !==
    rightKeys.length
  ) {
    return false
  }

  return leftKeys.every(
    key =>
      Object.prototype.hasOwnProperty.call(
        right,
        key
      ) &&
      deepEqual(
        left[key],
        right[key]
      )
  )
}

function withoutUpdatedAt(
  value: Record<string, unknown>
) {
  const copy = {
    ...value
  }

  delete copy.updatedAt

  return copy
}

function isRedundantColdStartWrite(
  stored: unknown,
  next: unknown
) {
  if (
    !isRecord(stored) ||
    !isRecord(next) ||
    stored.schemaVersion !== 2 ||
    next.schemaVersion !== 2 ||
    typeof stored.updatedAt !==
      'number'
  ) {
    return false
  }

  return deepEqual(
    withoutUpdatedAt(stored),
    withoutUpdatedAt(next)
  )
}

function createColdStartWriteGuardedState(
  state: DurableObjectStateLike
) {
  const storage =
    state.storage

  let initialAccessState:
    unknown
  let initialAccessStateLoaded =
    false
  let firstAccessStatePutPending =
    true

  const guardedStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        const value =
          await storage.get<T>(
            key
          )

        if (
          key ===
            ACCESS_STORAGE_KEY &&
          !initialAccessStateLoaded
        ) {
          initialAccessState =
            cloneSnapshot(value)
          initialAccessStateLoaded =
            true
        }

        return value
      },

      async put(
        keyOrEntries:
          | string
          | Record<string, unknown>,
        value?: unknown
      ) {
        if (
          typeof keyOrEntries ===
            'string'
        ) {
          if (
            keyOrEntries ===
              ACCESS_STORAGE_KEY &&
            firstAccessStatePutPending
          ) {
            firstAccessStatePutPending =
              false

            if (
              initialAccessStateLoaded &&
              isRedundantColdStartWrite(
                initialAccessState,
                value
              )
            ) {
              return
            }
          }

          await storage.put(
            keyOrEntries,
            value
          )
          return
        }

        await storage.put(
          keyOrEntries
        )
      }
    }

  return new Proxy(
    state as object,
    {
      get(
        target,
        property,
        receiver
      ) {
        if (
          property ===
          'storage'
        ) {
          return guardedStorage
        }

        const value =
          Reflect.get(
            target,
            property,
            receiver
          )

        return typeof value ===
          'function'
          ? value.bind(target)
          : value
      }
    }
  ) as DurableObjectStateLike
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

    const guardedState =
      createColdStartWriteGuardedState(
        state
      )

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        guardedState as never,
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
