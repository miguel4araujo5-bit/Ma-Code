import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorLoginAttemptGuardBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const PUBLIC_LOGIN_PATH =
  '/api/ma-professor/access/login'

const PUBLIC_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

type JsonObject =
  Record<string, unknown>

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>
  put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike
  blockConcurrencyWhile<T>(
    callback: () => Promise<T>
  ): Promise<T>
}

interface SessionIdentity {
  email: string
  deviceId: string
}

function isRecord(
  value: unknown
): value is JsonObject {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
}

function normalizeEmail(
  value: unknown
) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 180)
    : ''
}

function normalizeDeviceId(
  value: unknown
) {
  return typeof value === 'string'
    ? value.trim().slice(0, 180)
    : ''
}

async function readSessionIdentity(
  request: Request
): Promise<SessionIdentity | null> {
  if (request.method !== 'POST') {
    return null
  }

  const pathname =
    new URL(request.url).pathname

  if (
    pathname !== PUBLIC_LOGIN_PATH &&
    pathname !== PUBLIC_ACTIVATE_PATH
  ) {
    return null
  }

  let body: unknown

  try {
    body = await request.clone().json()
  } catch {
    return null
  }

  if (!isRecord(body)) {
    return null
  }

  const email =
    normalizeEmail(body.email)
  const deviceId =
    normalizeDeviceId(body.deviceId)

  return email && deviceId
    ? { email, deviceId }
    : null
}

function matchingSessionKeys(
  value: unknown,
  identity: SessionIdentity
) {
  const keys =
    new Set<string>()

  if (
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return keys
  }

  for (
    const [key, candidate] of
    Object.entries(value.sessions)
  ) {
    if (
      !isRecord(candidate) ||
      normalizeEmail(candidate.email) !== identity.email ||
      normalizeDeviceId(candidate.deviceId) !== identity.deviceId ||
      (
        candidate.revokedAt !== null &&
        candidate.revokedAt !== undefined
      )
    ) {
      continue
    }

    keys.add(key)
  }

  return keys
}

function removeCapturedSessions(
  value: unknown,
  keys: Set<string>
) {
  if (
    keys.size === 0 ||
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return
  }

  for (const key of keys) {
    delete value.sessions[key]
  }
}

export function createMAProfessorSessionRotationState(
  state: DurableObjectStateLike,
  identity: SessionIdentity
) {
  const storage = state.storage
  let capturedKeys:
    Set<string> | null = null

  const rotationStorage:
    DurableObjectStorageLike = {
      async get<T>(key: string) {
        const value =
          await storage.get<T>(key)

        if (key !== ACCESS_STORAGE_KEY) {
          return value
        }

        if (value === undefined) {
          capturedKeys ??=
            new Set<string>()
          return value
        }

        const cloned =
          structuredClone(value)

        capturedKeys ??=
          matchingSessionKeys(
            cloned,
            identity
          )

        removeCapturedSessions(
          cloned,
          capturedKeys
        )

        return cloned as T
      },

      async put(
        keyOrEntries:
          string | Record<string, unknown>,
        value?: unknown
      ) {
        if (
          typeof keyOrEntries === 'string'
        ) {
          if (
            keyOrEntries === ACCESS_STORAGE_KEY &&
            capturedKeys !== null
          ) {
            removeCapturedSessions(
              value,
              capturedKeys
            )
          }

          await storage.put(
            keyOrEntries,
            value
          )
          return
        }

        if (
          capturedKeys !== null &&
          Object.prototype.hasOwnProperty.call(
            keyOrEntries,
            ACCESS_STORAGE_KEY
          )
        ) {
          removeCapturedSessions(
            keyOrEntries[ACCESS_STORAGE_KEY],
            capturedKeys
          )
        }

        await storage.put(keyOrEntries)
      }
    }

  return new Proxy(
    state as object,
    {
      get(target, property, receiver) {
        if (property === 'storage') {
          return rotationStorage
        }

        const value =
          Reflect.get(
            target,
            property,
            receiver
          )

        return typeof value === 'function'
          ? value.bind(target)
          : value
      }
    }
  ) as DurableObjectStateLike
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike
  private readonly env:
    MaProfessorAccessEnv
  private existing:
    ExistingMaProfessorAccessDurableObject
  private operation:
    Promise<void> = Promise.resolve()

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.state = state
    this.env = env
    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state,
        env
      )
  }

  fetch(request: Request): Promise<Response> {
    const response =
      this.operation.then(
        () => this.handleRequest(request)
      )

    this.operation = response.then(
      () => undefined,
      () => undefined
    )

    return response
  }

  private refreshExisting() {
    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        this.state,
        this.env
      )
  }

  private async handleRequest(
    request: Request
  ) {
    const identity =
      await readSessionIdentity(request)

    if (!identity) {
      return this.existing.fetch(request)
    }

    const scopedState =
      createMAProfessorSessionRotationState(
        this.state,
        identity
      )

    const scopedExisting =
      new ExistingMaProfessorAccessDurableObject(
        scopedState,
        this.env
      )

    try {
      return await scopedExisting.fetch(request)
    } finally {
      this.refreshExisting()
    }
  }
}
