const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

export const MA_PROFESSOR_SESSION_ABSOLUTE_MAX_AGE_DAYS =
  180

const SESSION_ABSOLUTE_MAX_AGE_MS =
  MA_PROFESSOR_SESSION_ABSOLUTE_MAX_AGE_DAYS *
  24 *
  60 *
  60 *
  1000

type JsonObject =
  Record<string, unknown>

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

interface ActiveSessionCandidate {
  key: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
}

function isRecord(
  value: unknown
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function readTimestamp(
  value: unknown
) {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : null
}

function normalizeIdentity(
  value: unknown,
  maxLength: number
) {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, maxLength)
    : ''
}

function sanitizeSessions(
  value: unknown,
  now: number
) {
  if (
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return false
  }

  const sessions =
    value.sessions
  const candidates:
    ActiveSessionCandidate[] = []
  let changed = false

  for (
    const [
      key,
      candidate
    ] of Object.entries(sessions)
  ) {
    if (!isRecord(candidate)) {
      continue
    }

    if (
      candidate.revokedAt !== null &&
      candidate.revokedAt !== undefined
    ) {
      delete sessions[key]
      changed = true
      continue
    }

    const createdAt =
      readTimestamp(candidate.createdAt)

    if (
      createdAt !== null &&
      now - createdAt >=
        SESSION_ABSOLUTE_MAX_AGE_MS
    ) {
      delete sessions[key]
      changed = true
      continue
    }

    const email =
      normalizeIdentity(
        candidate.email,
        180
      )
    const deviceId =
      normalizeIdentity(
        candidate.deviceId,
        180
      )

    if (
      !email ||
      !deviceId ||
      createdAt === null
    ) {
      continue
    }

    candidates.push({
      key,
      email,
      deviceId,
      createdAt,
      lastSeenAt:
        readTimestamp(
          candidate.lastSeenAt
        ) ?? createdAt
    })
  }

  candidates.sort(
    (left, right) =>
      right.createdAt -
        left.createdAt ||
      right.lastSeenAt -
        left.lastSeenAt ||
      right.key.localeCompare(
        left.key
      )
  )

  const activeDeviceSessions =
    new Set<string>()

  for (
    const candidate of candidates
  ) {
    const identity =
      `${candidate.email}\n${candidate.deviceId}`

    if (
      activeDeviceSessions.has(
        identity
      )
    ) {
      delete sessions[
        candidate.key
      ]
      changed = true
      continue
    }

    activeDeviceSessions.add(
      identity
    )
  }

  return changed
}

export function createMAProfessorSessionLifecycleState(
  state: DurableObjectStateLike
) {
  const storage =
    state.storage

  const lifecycleStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        const value =
          await storage.get<T>(key)

        if (
          key === ACCESS_STORAGE_KEY &&
          sanitizeSessions(
            value,
            Date.now()
          )
        ) {
          await storage.put(
            ACCESS_STORAGE_KEY,
            value
          )
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
          typeof keyOrEntries === 'string'
        ) {
          if (
            keyOrEntries ===
              ACCESS_STORAGE_KEY
          ) {
            sanitizeSessions(
              value,
              Date.now()
            )
          }

          await storage.put(
            keyOrEntries,
            value
          )
          return
        }

        if (
          Object.prototype.hasOwnProperty.call(
            keyOrEntries,
            ACCESS_STORAGE_KEY
          )
        ) {
          sanitizeSessions(
            keyOrEntries[
              ACCESS_STORAGE_KEY
            ],
            Date.now()
          )
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
        if (property === 'storage') {
          return lifecycleStorage
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
