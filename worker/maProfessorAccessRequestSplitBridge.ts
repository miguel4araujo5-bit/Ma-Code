const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

export const MA_PROFESSOR_ACCESS_REQUEST_STORAGE_KEY =
  'ma-professor-access-requests-v1'

type JsonObject =
  Record<string, unknown>

interface RequestStoreSnapshot {
  schemaVersion: 1
  accessRequests:
    Record<string, unknown>
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
    typeof value === 'object' &&
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
      left.length !== right.length
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

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)

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
  return typeof value === 'number' &&
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

function stripAccessRequests(
  value: unknown
) {
  if (!isRecord(value)) {
    return cloneSnapshot(value)
  }

  const copy =
    cloneSnapshot(value)

  delete copy.accessRequests

  return copy
}

function readAccessRequests(
  value: unknown
) {
  if (
    !isRecord(value) ||
    !isRecord(
      value.accessRequests
    )
  ) {
    return {}
  }

  return cloneSnapshot(
    value.accessRequests
  )
}

function normalizeRequestStore(
  value: unknown
): RequestStoreSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(
      value.accessRequests
    )
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    accessRequests:
      cloneSnapshot(
        value.accessRequests
      ),
    updatedAt:
      readTimestamp(
        value.updatedAt
      ) ?? 0
  }
}

function buildCombinedState(
  coreState: unknown,
  requestStore:
    RequestStoreSnapshot | null
) {
  if (!isRecord(coreState)) {
    return cloneSnapshot(coreState)
  }

  const combined =
    cloneSnapshot(coreState)

  combined.accessRequests =
    cloneSnapshot(
      requestStore
        ?.accessRequests ??
      {}
    )

  const coreUpdatedAt =
    readTimestamp(
      combined.updatedAt
    )
  const requestsUpdatedAt =
    readTimestamp(
      requestStore?.updatedAt
    )

  if (
    coreUpdatedAt !== null ||
    requestsUpdatedAt !== null
  ) {
    combined.updatedAt =
      Math.max(
        coreUpdatedAt ?? 0,
        requestsUpdatedAt ?? 0
      )
  }

  return combined
}

function hasEntries(
  value: Record<string, unknown>
) {
  return Object.keys(value).length > 0
}

export function createMAProfessorAccessRequestSplitState(
  state: DurableObjectStateLike
) {
  const storage = state.storage

  let loaded = false
  let loadPromise:
    Promise<void> | null = null

  let persistedCore: unknown
  let persistedRequests:
    RequestStoreSnapshot | null = null

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
          rawRequestStore
        ] = await Promise.all([
          storage.get<unknown>(
            ACCESS_STORAGE_KEY
          ),
          storage.get<unknown>(
            MA_PROFESSOR_ACCESS_REQUEST_STORAGE_KEY
          )
        ])

        const normalizedRequestStore =
          normalizeRequestStore(
            rawRequestStore
          )

        const hasLegacyAccessRequests =
          isRecord(rawCore) &&
          Object.prototype.hasOwnProperty.call(
            rawCore,
            'accessRequests'
          )

        if (hasLegacyAccessRequests) {
          const migratedCore =
            stripAccessRequests(rawCore)
          const legacyAccessRequests =
            readAccessRequests(rawCore)

          const migratedRequests =
            normalizedRequestStore ??
            {
              schemaVersion: 1 as const,
              accessRequests:
                legacyAccessRequests,
              updatedAt:
                readTimestamp(
                  rawCore.updatedAt
                ) ?? Date.now()
            }

          const migrationEntries:
            Record<string, unknown> = {
              [ACCESS_STORAGE_KEY]:
                migratedCore
            }

          if (
            !normalizedRequestStore &&
            hasEntries(
              legacyAccessRequests
            )
          ) {
            migrationEntries[
              MA_PROFESSOR_ACCESS_REQUEST_STORAGE_KEY
            ] = migratedRequests
          }

          await writeEntries(
            migrationEntries
          )

          persistedCore =
            cloneSnapshot(
              migratedCore
            )
          persistedRequests =
            normalizedRequestStore
              ? cloneSnapshot(
                  normalizedRequestStore
                )
              : hasEntries(
                  legacyAccessRequests
                )
                ? cloneSnapshot(
                    migratedRequests
                  )
                : null
        } else {
          persistedCore =
            cloneSnapshot(rawCore)
          persistedRequests =
            normalizedRequestStore
              ? cloneSnapshot(
                  normalizedRequestStore
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
      stripAccessRequests(value)

    const hasExplicitAccessRequests =
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        'accessRequests'
      )

    const nextAccessRequests =
      hasExplicitAccessRequests
        ? readAccessRequests(value)
        : cloneSnapshot(
            persistedRequests
              ?.accessRequests ??
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
      persistedRequests
        ?.updatedAt ??
      Date.now()

    const nextRequestStore:
      RequestStoreSnapshot = {
        schemaVersion: 1,
        accessRequests:
          nextAccessRequests,
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

    const requestsChanged =
      persistedRequests
        ? !deepEqual(
            persistedRequests
              .accessRequests,
            nextAccessRequests
          )
        : hasEntries(
            nextAccessRequests
          )

    const entries:
      Record<string, unknown> = {}

    if (coreChanged) {
      entries[
        ACCESS_STORAGE_KEY
      ] = nextCore
    }

    if (requestsChanged) {
      entries[
        MA_PROFESSOR_ACCESS_REQUEST_STORAGE_KEY
      ] = nextRequestStore
    }

    return {
      entries,
      coreChanged,
      requestsChanged,
      nextCore,
      nextRequestStore
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

    if (prepared.requestsChanged) {
      persistedRequests =
        cloneSnapshot(
          prepared.nextRequestStore
        )
    }
  }

  const splitStorage:
    DurableObjectStorageLike = {
      async get<T>(
        key: string
      ) {
        if (
          key !== ACCESS_STORAGE_KEY
        ) {
          return storage.get<T>(key)
        }

        await ensureLoaded()

        return cloneSnapshot(
          buildCombinedState(
            persistedCore,
            persistedRequests
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
          typeof keyOrEntries === 'string'
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

        delete passthroughEntries[
          MA_PROFESSOR_ACCESS_REQUEST_STORAGE_KEY
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
        if (property === 'storage') {
          return splitStorage
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
