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

const MAX_ACTIVE_SESSIONS =
  4

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

interface ActiveSessionSnapshot {
  key: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
  value: JsonObject
}

interface SessionScanResult {
  changed: boolean
  snapshot:
    Map<string, ActiveSessionSnapshot>
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

function normalizeEmail(
  value: unknown
) {
  return typeof value === 'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 180)
    : ''
}

function normalizeDeviceId(
  value: unknown
) {
  return typeof value === 'string'
    ? value
        .trim()
        .slice(0, 180)
    : ''
}

function isActiveSession(
  value: unknown
): value is JsonObject {
  return (
    isRecord(value) &&
    (
      value.revokedAt === null ||
      value.revokedAt === undefined
    )
  )
}

function scanSessions(
  value: unknown,
  now: number
): SessionScanResult {
  const snapshot =
    new Map<
      string,
      ActiveSessionSnapshot
    >()

  if (
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return {
      changed: false,
      snapshot
    }
  }

  const sessions =
    value.sessions
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
      normalizeEmail(
        candidate.email
      )
    const deviceId =
      normalizeDeviceId(
        candidate.deviceId
      )

    if (
      !email ||
      !deviceId
    ) {
      continue
    }

    snapshot.set(
      key,
      {
        key,
        email,
        deviceId,
        createdAt:
          createdAt ?? 0,
        lastSeenAt:
          readTimestamp(
            candidate.lastSeenAt
          ) ??
          createdAt ??
          0,
        value:
          structuredClone(candidate)
      }
    )
  }

  return {
    changed,
    snapshot
  }
}

function collectNewActiveSessions(
  value: unknown,
  previous:
    Map<string, ActiveSessionSnapshot>
) {
  const newestByDevice =
    new Map<
      string,
      ActiveSessionSnapshot
    >()

  if (
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return newestByDevice
  }

  for (
    const [
      key,
      candidate
    ] of Object.entries(
      value.sessions
    )
  ) {
    if (
      previous.has(key) ||
      !isActiveSession(candidate)
    ) {
      continue
    }

    const email =
      normalizeEmail(
        candidate.email
      )
    const deviceId =
      normalizeDeviceId(
        candidate.deviceId
      )

    if (
      !email ||
      !deviceId
    ) {
      continue
    }

    const createdAt =
      readTimestamp(
        candidate.createdAt
      ) ?? 0
    const lastSeenAt =
      readTimestamp(
        candidate.lastSeenAt
      ) ??
      createdAt

    const next = {
      key,
      email,
      deviceId,
      createdAt,
      lastSeenAt,
      value:
        structuredClone(candidate)
    }

    const identity =
      `${email}\n${deviceId}`
    const current =
      newestByDevice.get(
        identity
      )

    if (
      !current ||
      next.createdAt >
        current.createdAt ||
      (
        next.createdAt ===
          current.createdAt &&
        next.lastSeenAt >
          current.lastSeenAt
      )
    ) {
      newestByDevice.set(
        identity,
        next
      )
    }
  }

  return newestByDevice
}

function reconcileSessionReplacement(
  value: unknown,
  previous:
    Map<string, ActiveSessionSnapshot> |
    null
) {
  if (
    !previous ||
    previous.size === 0 ||
    !isRecord(value) ||
    !isRecord(value.sessions)
  ) {
    return
  }

  const sessions =
    value.sessions
  const newSessions =
    collectNewActiveSessions(
      value,
      previous
    )

  for (
    const replacement of
    newSessions.values()
  ) {
    const previousSameDevice =
      Array.from(
        previous.values()
      ).filter(
        candidate =>
          candidate.email ===
            replacement.email &&
          candidate.deviceId ===
            replacement.deviceId
      )

    if (
      previousSameDevice.length === 0
    ) {
      continue
    }

    for (
      const [
        key,
        candidate
      ] of Object.entries(sessions)
    ) {
      if (
        key === replacement.key ||
        !isActiveSession(candidate)
      ) {
        continue
      }

      if (
        normalizeEmail(
          candidate.email
        ) === replacement.email &&
        normalizeDeviceId(
          candidate.deviceId
        ) === replacement.deviceId
      ) {
        delete sessions[key]
      }
    }

    for (
      const prior of
      previous.values()
    ) {
      if (
        prior.email !==
          replacement.email ||
        prior.deviceId ===
          replacement.deviceId
      ) {
        continue
      }

      const current =
        sessions[prior.key]

      if (!isActiveSession(current)) {
        sessions[prior.key] =
          structuredClone(
            prior.value
          )
      }
    }

    const otherActive =
      Object.entries(sessions)
        .filter(
          ([key, candidate]) =>
            key !== replacement.key &&
            isActiveSession(candidate) &&
            normalizeEmail(
              candidate.email
            ) === replacement.email
        )
        .map(
          ([key, candidate]) => ({
            key,
            createdAt:
              readTimestamp(
                candidate.createdAt
              ) ?? 0,
            lastSeenAt:
              readTimestamp(
                candidate.lastSeenAt
              ) ??
              readTimestamp(
                candidate.createdAt
              ) ??
              0
          })
        )
        .sort(
          (left, right) =>
            right.lastSeenAt -
              left.lastSeenAt ||
            right.createdAt -
              left.createdAt ||
            right.key.localeCompare(
              left.key
            )
        )

    for (
      const extra of
      otherActive.slice(
        MAX_ACTIVE_SESSIONS - 1
      )
    ) {
      delete sessions[
        extra.key
      ]
    }
  }
}

export function createMAProfessorSessionLifecycleState(
  state: DurableObjectStateLike
) {
  const storage =
    state.storage

  let previousActiveSessions:
    Map<string, ActiveSessionSnapshot> |
    null = null

  const lifecycleStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        const value =
          await storage.get<T>(key)

        if (
          key !== ACCESS_STORAGE_KEY
        ) {
          return value
        }

        const scan =
          scanSessions(
            value,
            Date.now()
          )

        if (scan.changed) {
          await storage.put(
            ACCESS_STORAGE_KEY,
            value
          )
        }

        previousActiveSessions =
          scan.snapshot

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
            keyOrEntries !==
              ACCESS_STORAGE_KEY
          ) {
            await storage.put(
              keyOrEntries,
              value
            )
            return
          }

          reconcileSessionReplacement(
            value,
            previousActiveSessions
          )

          const scan =
            scanSessions(
              value,
              Date.now()
            )

          await storage.put(
            keyOrEntries,
            value
          )

          previousActiveSessions =
            scan.snapshot
          return
        }

        let nextSnapshot =
          previousActiveSessions

        if (
          Object.prototype.hasOwnProperty.call(
            keyOrEntries,
            ACCESS_STORAGE_KEY
          )
        ) {
          const accessState =
            keyOrEntries[
              ACCESS_STORAGE_KEY
            ]

          reconcileSessionReplacement(
            accessState,
            previousActiveSessions
          )

          nextSnapshot =
            scanSessions(
              accessState,
              Date.now()
            ).snapshot
        }

        await storage.put(
          keyOrEntries
        )

        previousActiveSessions =
          nextSnapshot
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
