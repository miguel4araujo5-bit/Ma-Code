const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

export const MA_PROFESSOR_ACCESS_LICENSE_STORAGE_KEY =
  'ma-professor-access-licenses-v1'

type JsonObject =
  Record<string, unknown>

interface LicenseStoreSnapshot {
  schemaVersion: 1
  licenses:
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

function stripLicenses(
  value: unknown
) {
  if (!isRecord(value)) {
    return cloneSnapshot(value)
  }

  const copy =
    cloneSnapshot(value)

  delete copy.licenses

  return copy
}

function readLicenses(
  value: unknown
) {
  if (
    !isRecord(value) ||
    !isRecord(
      value.licenses
    )
  ) {
    return {}
  }

  return cloneSnapshot(
    value.licenses
  )
}

function normalizeLicenseStore(
  value: unknown
): LicenseStoreSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(
      value.licenses
    )
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    licenses:
      cloneSnapshot(
        value.licenses
      ),
    updatedAt:
      readTimestamp(
        value.updatedAt
      ) ?? 0
  }
}

function buildCombinedState(
  coreState: unknown,
  licenseStore:
    LicenseStoreSnapshot | null
) {
  if (!isRecord(coreState)) {
    return cloneSnapshot(coreState)
  }

  const combined =
    cloneSnapshot(coreState)

  combined.licenses =
    cloneSnapshot(
      licenseStore
        ?.licenses ??
      {}
    )

  const coreUpdatedAt =
    readTimestamp(
      combined.updatedAt
    )
  const licensesUpdatedAt =
    readTimestamp(
      licenseStore?.updatedAt
    )

  if (
    coreUpdatedAt !== null ||
    licensesUpdatedAt !== null
  ) {
    combined.updatedAt =
      Math.max(
        coreUpdatedAt ?? 0,
        licensesUpdatedAt ?? 0
      )
  }

  return combined
}

function hasEntries(
  value: Record<string, unknown>
) {
  return Object.keys(value).length > 0
}

export function createMAProfessorAccessLicenseSplitState(
  state: DurableObjectStateLike
) {
  const storage = state.storage

  let loaded = false
  let loadPromise:
    Promise<void> | null = null

  let persistedCore: unknown
  let persistedLicenses:
    LicenseStoreSnapshot | null = null

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
          rawLicenseStore
        ] = await Promise.all([
          storage.get<unknown>(
            ACCESS_STORAGE_KEY
          ),
          storage.get<unknown>(
            MA_PROFESSOR_ACCESS_LICENSE_STORAGE_KEY
          )
        ])

        const normalizedLicenseStore =
          normalizeLicenseStore(
            rawLicenseStore
          )

        const hasLegacyLicenses =
          isRecord(rawCore) &&
          Object.prototype.hasOwnProperty.call(
            rawCore,
            'licenses'
          )

        if (hasLegacyLicenses) {
          const migratedCore =
            stripLicenses(rawCore)
          const legacyLicenses =
            readLicenses(rawCore)

          const migratedLicenses =
            normalizedLicenseStore ??
            {
              schemaVersion: 1 as const,
              licenses:
                legacyLicenses,
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
            !normalizedLicenseStore &&
            hasEntries(
              legacyLicenses
            )
          ) {
            migrationEntries[
              MA_PROFESSOR_ACCESS_LICENSE_STORAGE_KEY
            ] = migratedLicenses
          }

          await writeEntries(
            migrationEntries
          )

          persistedCore =
            cloneSnapshot(
              migratedCore
            )
          persistedLicenses =
            normalizedLicenseStore
              ? cloneSnapshot(
                  normalizedLicenseStore
                )
              : hasEntries(
                  legacyLicenses
                )
                ? cloneSnapshot(
                    migratedLicenses
                  )
                : null
        } else {
          persistedCore =
            cloneSnapshot(rawCore)
          persistedLicenses =
            normalizedLicenseStore
              ? cloneSnapshot(
                  normalizedLicenseStore
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
      stripLicenses(value)

    const hasExplicitLicenses =
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        'licenses'
      )

    const nextLicenses =
      hasExplicitLicenses
        ? readLicenses(value)
        : cloneSnapshot(
            persistedLicenses
              ?.licenses ??
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
      persistedLicenses
        ?.updatedAt ??
      Date.now()

    const nextLicenseStore:
      LicenseStoreSnapshot = {
        schemaVersion: 1,
        licenses:
          nextLicenses,
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

    const licensesChanged =
      persistedLicenses
        ? !deepEqual(
            persistedLicenses.licenses,
            nextLicenses
          )
        : hasEntries(
            nextLicenses
          )

    const entries:
      Record<string, unknown> = {}

    if (coreChanged) {
      entries[
        ACCESS_STORAGE_KEY
      ] = nextCore
    }

    if (licensesChanged) {
      entries[
        MA_PROFESSOR_ACCESS_LICENSE_STORAGE_KEY
      ] = nextLicenseStore
    }

    return {
      entries,
      coreChanged,
      licensesChanged,
      nextCore,
      nextLicenseStore
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

    if (prepared.licensesChanged) {
      persistedLicenses =
        cloneSnapshot(
          prepared.nextLicenseStore
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
            persistedLicenses
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
          MA_PROFESSOR_ACCESS_LICENSE_STORAGE_KEY
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
