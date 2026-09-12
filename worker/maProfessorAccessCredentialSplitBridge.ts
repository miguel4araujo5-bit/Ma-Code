const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

export const MA_PROFESSOR_ACCESS_CREDENTIAL_STORAGE_KEY =
  'ma-professor-access-credentials-v1'

type JsonObject =
  Record<string, unknown>

interface CredentialStoreSnapshot {
  schemaVersion: 1
  credentials:
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

function stripCredentials(
  value: unknown
) {
  if (!isRecord(value)) {
    return cloneSnapshot(value)
  }

  const copy =
    cloneSnapshot(value)

  delete copy.credentials

  return copy
}

function readCredentials(
  value: unknown
) {
  if (
    !isRecord(value) ||
    !isRecord(
      value.credentials
    )
  ) {
    return {}
  }

  return cloneSnapshot(
    value.credentials
  )
}

function normalizeCredentialStore(
  value: unknown
): CredentialStoreSnapshot | null {
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !isRecord(
      value.credentials
    )
  ) {
    return null
  }

  return {
    schemaVersion: 1,
    credentials:
      cloneSnapshot(
        value.credentials
      ),
    updatedAt:
      readTimestamp(
        value.updatedAt
      ) ?? 0
  }
}

function buildCombinedState(
  coreState: unknown,
  credentialStore:
    CredentialStoreSnapshot | null
) {
  if (!isRecord(coreState)) {
    return cloneSnapshot(coreState)
  }

  const combined =
    cloneSnapshot(coreState)

  combined.credentials =
    cloneSnapshot(
      credentialStore
        ?.credentials ??
      {}
    )

  const coreUpdatedAt =
    readTimestamp(
      combined.updatedAt
    )
  const credentialsUpdatedAt =
    readTimestamp(
      credentialStore?.updatedAt
    )

  if (
    coreUpdatedAt !== null ||
    credentialsUpdatedAt !== null
  ) {
    combined.updatedAt =
      Math.max(
        coreUpdatedAt ?? 0,
        credentialsUpdatedAt ?? 0
      )
  }

  return combined
}

function hasEntries(
  value: Record<string, unknown>
) {
  return Object.keys(value).length > 0
}

export function createMAProfessorAccessCredentialSplitState(
  state: DurableObjectStateLike
) {
  const storage = state.storage

  let loaded = false
  let loadPromise:
    Promise<void> | null = null

  let persistedCore: unknown
  let persistedCredentials:
    CredentialStoreSnapshot | null = null

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
          rawCredentialStore
        ] = await Promise.all([
          storage.get<unknown>(
            ACCESS_STORAGE_KEY
          ),
          storage.get<unknown>(
            MA_PROFESSOR_ACCESS_CREDENTIAL_STORAGE_KEY
          )
        ])

        const normalizedCredentialStore =
          normalizeCredentialStore(
            rawCredentialStore
          )

        const hasLegacyCredentials =
          isRecord(rawCore) &&
          Object.prototype.hasOwnProperty.call(
            rawCore,
            'credentials'
          )

        if (hasLegacyCredentials) {
          const migratedCore =
            stripCredentials(rawCore)
          const legacyCredentials =
            readCredentials(rawCore)

          const migratedCredentials =
            normalizedCredentialStore ??
            {
              schemaVersion: 1 as const,
              credentials:
                legacyCredentials,
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
            !normalizedCredentialStore &&
            hasEntries(
              legacyCredentials
            )
          ) {
            migrationEntries[
              MA_PROFESSOR_ACCESS_CREDENTIAL_STORAGE_KEY
            ] = migratedCredentials
          }

          await writeEntries(
            migrationEntries
          )

          persistedCore =
            cloneSnapshot(
              migratedCore
            )
          persistedCredentials =
            normalizedCredentialStore
              ? cloneSnapshot(
                  normalizedCredentialStore
                )
              : hasEntries(
                  legacyCredentials
                )
                ? cloneSnapshot(
                    migratedCredentials
                  )
                : null
        } else {
          persistedCore =
            cloneSnapshot(rawCore)
          persistedCredentials =
            normalizedCredentialStore
              ? cloneSnapshot(
                  normalizedCredentialStore
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
      stripCredentials(value)

    const hasExplicitCredentials =
      isRecord(value) &&
      Object.prototype.hasOwnProperty.call(
        value,
        'credentials'
      )

    const nextCredentials =
      hasExplicitCredentials
        ? readCredentials(value)
        : cloneSnapshot(
            persistedCredentials
              ?.credentials ??
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
      persistedCredentials
        ?.updatedAt ??
      Date.now()

    const nextCredentialStore:
      CredentialStoreSnapshot = {
        schemaVersion: 1,
        credentials:
          nextCredentials,
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

    const credentialsChanged =
      persistedCredentials
        ? !deepEqual(
            persistedCredentials.credentials,
            nextCredentials
          )
        : hasEntries(
            nextCredentials
          )

    const entries:
      Record<string, unknown> = {}

    if (coreChanged) {
      entries[
        ACCESS_STORAGE_KEY
      ] = nextCore
    }

    if (credentialsChanged) {
      entries[
        MA_PROFESSOR_ACCESS_CREDENTIAL_STORAGE_KEY
      ] = nextCredentialStore
    }

    return {
      entries,
      coreChanged,
      credentialsChanged,
      nextCore,
      nextCredentialStore
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

    if (prepared.credentialsChanged) {
      persistedCredentials =
        cloneSnapshot(
          prepared.nextCredentialStore
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
            persistedCredentials
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
          MA_PROFESSOR_ACCESS_CREDENTIAL_STORAGE_KEY
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
