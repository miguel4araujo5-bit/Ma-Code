import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorPublicAuthPrivacyBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const LOGIN_GUARD_STORAGE_KEY =
  'ma-professor-login-guard-v1'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const LOGIN_GUARD_WINDOW_MS =
  10 * 60 * 1000

const LOGIN_GUARD_BLOCK_MS =
  15 * 60 * 1000

const LOGIN_GUARD_MAX_PAIR_FAILURES =
  8

const LOGIN_GUARD_MAX_ORIGIN_FAILURES =
  30

const LOGIN_GUARD_RETENTION_MS =
  60 * 60 * 1000

const LOGIN_GUARD_MAX_BUCKETS =
  512

type JsonObject =
  Record<string, unknown>

interface LoginGuardBucket {
  windowStartedAt: number
  count: number
  blockedUntil: number | null
  lastSeenAt: number
}

interface LoginGuardState {
  schemaVersion: 1
  buckets: Record<
    string,
    LoginGuardBucket
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

function createLoginGuardState():
  LoginGuardState {
  return {
    schemaVersion: 1,
    buckets: {},
    updatedAt: Date.now()
  }
}

function normalizeLoginGuardState(
  value:
    LoginGuardState |
    undefined
) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !value.buckets ||
    typeof value.buckets !==
      'object'
  ) {
    return createLoginGuardState()
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

async function hashLoginGuardKey(
  scope: 'origin' | 'pair',
  value: string
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder()
        .encode(
          `ma-professor-login-guard:${scope}:${value}`
        )
    )

  return bytesToHex(
    new Uint8Array(digest)
  )
}

function pruneLoginGuardState(
  state: LoginGuardState,
  now: number
) {
  const oldestAllowed =
    now -
    LOGIN_GUARD_RETENTION_MS

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
        bucket.blockedUntil <=
          now
      )
    ) {
      delete state.buckets[key]
    }
  }
}

function makeRoomForLoginGuardBucket(
  state: LoginGuardState,
  currentKey: string
) {
  if (
    state.buckets[currentKey] ||
    Object.keys(
      state.buckets
    ).length <
      LOGIN_GUARD_MAX_BUCKETS
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

function recordFailedAttempt(
  state: LoginGuardState,
  key: string,
  maxFailures: number,
  now: number
) {
  makeRoomForLoginGuardBucket(
    state,
    key
  )

  let bucket =
    state.buckets[key]

  if (
    !bucket ||
    now -
      bucket.windowStartedAt >=
      LOGIN_GUARD_WINDOW_MS
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
      LOGIN_GUARD_BLOCK_MS
  }

  state.buckets[key] =
    bucket
}

function getBlockedUntil(
  state: LoginGuardState,
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

function createGenericLoginFailure() {
  return json(
    {
      success: false,
      message:
        'Email ou password pessoal incorretos.'
    },
    401
  )
}

function createLoginRateLimitResponse(
  blockedUntil: number,
  now: number
) {
  return json(
    {
      success: false,
      message:
        'Foram recebidas demasiadas tentativas de início de sessão desta origem. Aguarde alguns minutos antes de tentar novamente.'
    },
    429,
    {
      'Retry-After':
        String(
          Math.max(
            1,
            Math.ceil(
              (
                blockedUntil -
                now
              ) /
                1000
            )
          )
        )
    }
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

    const connectingIp =
      getConnectingIp(
        request
      )

    let guardState:
      LoginGuardState | null =
        null
    let originKey = ''
    let pairKey = ''

    if (connectingIp) {
      [originKey, pairKey] =
        await Promise.all([
          hashLoginGuardKey(
            'origin',
            connectingIp
          ),
          email
            ? hashLoginGuardKey(
                'pair',
                `${connectingIp}\n${email}`
              )
            : Promise.resolve('')
        ])

      const now =
        Date.now()

      guardState =
        normalizeLoginGuardState(
          await this.state.storage.get<LoginGuardState>(
            LOGIN_GUARD_STORAGE_KEY
          )
        )

      pruneLoginGuardState(
        guardState,
        now
      )

      const blockedUntil =
        getBlockedUntil(
          guardState,
          [originKey, pairKey]
            .filter(Boolean),
          now
        )

      if (
        blockedUntil !== null
      ) {
        return createLoginRateLimitResponse(
          blockedUntil,
          now
        )
      }
    }

    const response =
      await this.existing.fetch(
        request
      )

    if (response.status !== 401) {
      return response
    }

    if (
      !connectingIp ||
      !guardState ||
      !originKey
    ) {
      return createGenericLoginFailure()
    }

    const now =
      Date.now()

    recordFailedAttempt(
      guardState,
      originKey,
      LOGIN_GUARD_MAX_ORIGIN_FAILURES,
      now
    )

    if (pairKey) {
      recordFailedAttempt(
        guardState,
        pairKey,
        LOGIN_GUARD_MAX_PAIR_FAILURES,
        now
      )
    }

    guardState.updatedAt = now

    await this.state.storage.put(
      LOGIN_GUARD_STORAGE_KEY,
      guardState
    )

    return createGenericLoginFailure()
  }

  private async handleRequest(
    request: Request
  ) {
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

    return this.existing.fetch(
      request
    )
  }
}
