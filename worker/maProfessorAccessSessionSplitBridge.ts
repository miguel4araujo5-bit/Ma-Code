import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorAccessRetentionBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const SESSION_STORAGE_KEY =
  'ma-professor-access-sessions-v1'

type JsonObject =
  Record<string, unknown>

interface SessionStoreSnapshot {
  schemaVersion: 1
  sessions: Record<string, unknown>
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
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function cloneSnapshot<T>(
  value: T
): T {
  return value === undefined
    ? value
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

function readTimestamp(
  value: unknown
) {
  return typeof value ===
      'number' &&
    Number.isFinite(value)
    ? value
    : null
}

function withoutUpdatedAt(
  value: unknown
) {
  if (!isRecord(value)) {
    return value
  }

  const copy = {
    ...value
  }

  delete copy.updatedAt

  return copy
}

function stripSessions(
  value: unknown
) {
  if (!isRecord(value)) {
    return cloneSnapshot(value)
  }

  const copy =
    cloneSnapshot(value)

  delete copy.sessions

  return copy
}

function readSessions(
  value: unknown
) {
  if (
    !isRecord(value) ||
    !isRecord(
      value.sessions
    )
  ) {
    return {}
  }

  return cloneSnapshot(
    value.sessions
  )
}

function normalizeSessionStore(
  value: unknown
): SessionStoreSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(
      value.sessions
    )
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    sessions:
      cloneSnapshot(
        value.sessions
      ),
    updatedAt:
      readTimestamp(
        value.updatedAt
      ) ?? 0
  }
}

function buildCombinedState(
  coreState: unknown,
  sessionStore:
    SessionStoreSnapshot | null
) {
  if (!isRecord(coreState)) {
    return cloneSnapshot(coreState)
  }

  const combined =
    cloneSnapshot(coreState)

  combined.sessions =
    cloneSnapshot(
      sessionStore?.sessions ??
        {}
    )

  const coreUpdatedAt =
    readTimestamp(
      combined.updatedAt
    )
  const sessionsUpdatedAt =
    readTimestamp(
      sessionStore?.updatedAt
    )

  if (
    coreUpdatedAt !== null ||
    sessionsUpdatedAt !== null
  ) {
    combined.updatedAt =
      Math.max(
        coreUpdatedAt ?? 0,
        sessionsUpdatedAt ?? 0
      )
  }

  return combined
}

function createSessionSplitState(
  state: DurableObjectStateLike
) {
  const storage =
    state.storage

  let loaded = false
  let loadPromise:
    Promise<void> | null =
      null

  let persistedCore:
    unknown

  let persistedSessions:
    SessionStoreSnapshot | null =
      null

  async function writeEntries(
    entries:
      Record<string, unknown>
  ) {
    const keys =
      Object.keys(entries)

    if (keys.length === 0) {
      return
    }

    if (keys.length === 1) {
      const key = keys[0]

      await storage.put(
        key,
        entries[key]
      )
      return
    }

    await storage.put(entries)
  }

  async function ensureLoaded() {
    if (loaded) {
      return
    }

    if (loadPromise) {
      await loadPromise
      return
    }

    loadPromise =
      (async () => {
        const [
          rawCore,
          rawSessionStore
        ] = await Promise.all([
          storage.get<unknown>(
            ACCESS_STORAGE_KEY
          ),
          storage.get<unknown>(
            SESSION_STORAGE_KEY
          )
        ])

        const normalizedSessionStore =
          normalizeSessionStore(
            rawSessionStore
          )

        const hasLegacySessions =
          isRecord(rawCore) &&
          Object.prototype.hasOwnProperty.call(
            rawCore,
            'sessions'
          )

        if (hasLegacySessions) {
          const migratedCore =
            stripSessions(rawCore)

          const migratedSessions =
            normalizedSessionStore ??
            {
              schemaVersion: 1 as const,
              sessions:
                readSessions(rawCore),
              updatedAt:
                readTimestamp(
                  (
                    rawCore as
                      JsonObject
                  ).updatedAt
                ) ?? Date.now()
            }

          const migrationEntries:
            Record<string, unknown> = {
              [ACCESS_STORAGE_KEY]:
                migratedCore
            }

          if (!normalizedSessionStore) {
            migrationEntries[
              SESSION_STORAGE_KEY
            ] =
              migratedSessions
          }

          await writeEntries(
            migrationEntries
          )

          persistedCore =
            cloneSnapshot(
              migratedCore
            )
          persistedSessions =
            cloneSnapshot(
              migratedSessions
            )
        } else {
          persistedCore =
            cloneSnapshot(
              rawCore
            )
          persistedSessions =
            normalizedSessionStore
              ? cloneSnapshot(
                  normalizedSessionStore
                )
              : null
        }

        loaded = true
      })()

    try {
      await loadPromise
    } finally {
      loadPromise = null
    }
  }

  function prepareAccessWrite(
    value: unknown
  ) {
    const nextCore =
      stripSessions(value)

    const hasExplicitSessions =
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        'sessions'
      )

    const nextSessions =
      hasExplicitSessions
        ? readSessions(value)
        : cloneSnapshot(
            persistedSessions
              ?.sessions ??
              {}
          )

    const nextUpdatedAt =
      readTimestamp(
        isRecord(value)
          ? value.updatedAt
          : null
      ) ??
      readTimestamp(
        isRecord(persistedCore)
          ? persistedCore.updatedAt
          : null
      ) ??
      persistedSessions
        ?.updatedAt ??
      Date.now()

    const nextSessionStore:
      SessionStoreSnapshot = {
        schemaVersion: 1,
        sessions:
          nextSessions,
        updatedAt:
          nextUpdatedAt
      }

    const coreChanged =
      !deepEqual(
        withoutUpdatedAt(
          persistedCore
        ),
        withoutUpdatedAt(
          nextCore
        )
      )

    const sessionsChanged =
      !persistedSessions ||
      !deepEqual(
        persistedSessions.sessions,
        nextSessions
      )

    const entries:
      Record<string, unknown> = {}

    if (coreChanged) {
      entries[
        ACCESS_STORAGE_KEY
      ] =
        nextCore
    }

    if (sessionsChanged) {
      entries[
        SESSION_STORAGE_KEY
      ] =
        nextSessionStore
    }

    return {
      entries,
      coreChanged,
      sessionsChanged,
      nextCore,
      nextSessionStore
    }
  }

  async function persistAccessWrite(
    value: unknown,
    passthroughEntries:
      Record<string, unknown> = {}
  ) {
    await ensureLoaded()

    const prepared =
      prepareAccessWrite(value)

    const entries = {
      ...passthroughEntries,
      ...prepared.entries
    }

    await writeEntries(entries)

    if (prepared.coreChanged) {
      persistedCore =
        cloneSnapshot(
          prepared.nextCore
        )
    }

    if (prepared.sessionsChanged) {
      persistedSessions =
        cloneSnapshot(
          prepared.nextSessionStore
        )
    }
  }

  const splitStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        if (
          key !==
            ACCESS_STORAGE_KEY
        ) {
          return storage.get<T>(key)
        }

        await ensureLoaded()

        return cloneSnapshot(
          buildCombinedState(
            persistedCore,
            persistedSessions
          )
        ) as T
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
              ACCESS_STORAGE_KEY
          ) {
            await persistAccessWrite(
              value
            )
            return
          }

          await storage.put(
            keyOrEntries,
            value
          )
          return
        }

        if (
          !Object.prototype.hasOwnProperty.call(
            keyOrEntries,
            ACCESS_STORAGE_KEY
          )
        ) {
          await storage.put(
            keyOrEntries
          )
          return
        }

        const passthroughEntries = {
          ...keyOrEntries
        }

        const accessValue =
          passthroughEntries[
            ACCESS_STORAGE_KEY
          ]

        delete passthroughEntries[
          ACCESS_STORAGE_KEY
        ]

        /*
         * A chave dividida é interna a esta camada.
         * Evita que uma escrita antiga/em lote consiga
         * substituir uma versão de sessões preparada
         * pelo adaptador no mesmo passo.
         */
        delete passthroughEntries[
          SESSION_STORAGE_KEY
        ]

        await persistAccessWrite(
          accessValue,
          passthroughEntries
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
          return splitStorage
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

export class MaProfessorAccessDurableObject {
  private readonly existing:
    ExistingMaProfessorAccessDurableObject

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        createSessionSplitState(
          state
        ) as never,
        env
      )
  }

  fetch(
    request: Request
  ) {
    return this.existing.fetch(
      request
    )
  }
}
