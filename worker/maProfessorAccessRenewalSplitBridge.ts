const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

export const MA_PROFESSOR_ACCESS_RENEWAL_STORAGE_KEY =
  'ma-professor-access-renewals-v1'

type JsonObject =
  Record<string, unknown>

interface RenewalStoreSnapshot {
  schemaVersion: 1
  renewals: unknown[]
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

function stripRenewals(
  value: unknown
) {
  if (!isRecord(value)) {
    return cloneSnapshot(value)
  }

  const copy =
    cloneSnapshot(value)

  delete copy.renewals

  return copy
}

function readRenewals(
  value: unknown
) {
  if (
    !isRecord(value) ||
    !Array.isArray(
      value.renewals
    )
  ) {
    return []
  }

  return cloneSnapshot(
    value.renewals
  )
}

function normalizeRenewalStore(
  value: unknown
): RenewalStoreSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(
      value.renewals
    )
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    renewals:
      cloneSnapshot(
        value.renewals
      ),
    updatedAt:
      readTimestamp(
        value.updatedAt
      ) ?? 0
  }
}

function buildCombinedState(
  coreState: unknown,
  renewalStore:
    RenewalStoreSnapshot | null
) {
  if (!isRecord(coreState)) {
    return cloneSnapshot(coreState)
  }

  const combined =
    cloneSnapshot(coreState)

  combined.renewals =
    cloneSnapshot(
      renewalStore?.renewals ??
      []
    )

  const coreUpdatedAt =
    readTimestamp(
      combined.updatedAt
    )
  const renewalsUpdatedAt =
    readTimestamp(
      renewalStore?.updatedAt
    )

  if (
    coreUpdatedAt !== null ||
    renewalsUpdatedAt !== null
  ) {
    combined.updatedAt =
      Math.max(
        coreUpdatedAt ?? 0,
        renewalsUpdatedAt ?? 0
      )
  }

  return combined
}

export function createMAProfessorAccessRenewalSplitState(
  state: DurableObjectStateLike
) {
  const storage = state.storage

  let loaded = false
  let loadPromise:
    Promise<void> | null = null

  let persistedCore: unknown
  let persistedRenewals:
    RenewalStoreSnapshot | null = null

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
          rawRenewalStore
        ] = await Promise.all([
          storage.get<unknown>(
            ACCESS_STORAGE_KEY
          ),
          storage.get<unknown>(
            MA_PROFESSOR_ACCESS_RENEWAL_STORAGE_KEY
          )
        ])

        const normalizedRenewalStore =
          normalizeRenewalStore(
            rawRenewalStore
          )

        const hasLegacyRenewals =
          isRecord(rawCore) &&
          Object.prototype.hasOwnProperty.call(
            rawCore,
            'renewals'
          )

        if (hasLegacyRenewals) {
          const migratedCore =
            stripRenewals(rawCore)
          const legacyRenewals =
            readRenewals(rawCore)

          const migratedRenewals =
            normalizedRenewalStore ??
            {
              schemaVersion: 1 as const,
              renewals:
                legacyRenewals,
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
            !normalizedRenewalStore &&
            legacyRenewals.length > 0
          ) {
            migrationEntries[
              MA_PROFESSOR_ACCESS_RENEWAL_STORAGE_KEY
            ] = migratedRenewals
          }

          await writeEntries(
            migrationEntries
          )

          persistedCore =
            cloneSnapshot(
              migratedCore
            )
          persistedRenewals =
            normalizedRenewalStore
              ? cloneSnapshot(
                  normalizedRenewalStore
                )
              : legacyRenewals.length > 0
                ? cloneSnapshot(
                    migratedRenewals
                  )
                : null
        } else {
          persistedCore =
            cloneSnapshot(rawCore)
          persistedRenewals =
            normalizedRenewalStore
              ? cloneSnapshot(
                  normalizedRenewalStore
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
      stripRenewals(value)

    const hasExplicitRenewals =
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        'renewals'
      )

    const nextRenewals =
      hasExplicitRenewals
        ? readRenewals(value)
        : cloneSnapshot(
            persistedRenewals
              ?.renewals ??
            []
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
      persistedRenewals
        ?.updatedAt ??
      Date.now()

    const nextRenewalStore:
      RenewalStoreSnapshot = {
        schemaVersion: 1,
        renewals:
          nextRenewals,
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

    const renewalsChanged =
      persistedRenewals
        ? !deepEqual(
            persistedRenewals.renewals,
            nextRenewals
          )
        : nextRenewals.length > 0

    const entries:
      Record<string, unknown> = {}

    if (coreChanged) {
      entries[
        ACCESS_STORAGE_KEY
      ] = nextCore
    }

    if (renewalsChanged) {
      entries[
        MA_PROFESSOR_ACCESS_RENEWAL_STORAGE_KEY
      ] = nextRenewalStore
    }

    return {
      entries,
      coreChanged,
      renewalsChanged,
      nextCore,
      nextRenewalStore
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

    if (prepared.renewalsChanged) {
      persistedRenewals =
        cloneSnapshot(
          prepared.nextRenewalStore
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
            persistedRenewals
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
          MA_PROFESSOR_ACCESS_RENEWAL_STORAGE_KEY
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
