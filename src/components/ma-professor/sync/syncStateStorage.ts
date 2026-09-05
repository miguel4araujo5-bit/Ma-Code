const STORAGE_PREFIX =
  'ma-professor-manual-sync-v1'

const STATE_VERSION =
  1 as const

export const MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT =
  'ma-professor-sync-state-persistence'

export type MAProfessorManualSyncOperation =
  | 'upload'
  | 'verify'
  | 'restore'

export type MAProfessorSyncStatePersistenceStatus =
  | 'saved'
  | 'warning'

export interface MAProfessorSyncStatePersistenceState {
  status:
    MAProfessorSyncStatePersistenceStatus

  operation:
    MAProfessorManualSyncOperation | null
}

export interface MAProfessorManualSyncState {
  version:
    typeof STATE_VERSION

  serverRevision:
    number

  fingerprint:
    string

  syncedAt:
    string

  verifiedAt:
    string

  lastOperation:
    MAProfessorManualSyncOperation
}

let persistenceState:
  MAProfessorSyncStatePersistenceState = {
  status:
    'saved',

  operation:
    null
}

function publishPersistenceState(
  next:
    MAProfessorSyncStatePersistenceState
) {
  persistenceState =
    next

  if (
    typeof window ===
      'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      MA_PROFESSOR_SYNC_STATE_PERSISTENCE_EVENT,
      {
        detail:
          next
      }
    )
  )
}

export function readMAProfessorSyncStatePersistenceState() {
  return persistenceState
}

function normalizeEmail(
  email: string
) {
  return email
    .trim()
    .toLowerCase()
}

function normalizeDeviceId(
  deviceId: string
) {
  return deviceId.trim()
}

function createStorageKey(
  email: string,
  deviceId: string
) {
  const normalizedEmail =
    normalizeEmail(email)

  const normalizedDeviceId =
    normalizeDeviceId(
      deviceId
    )

  if (
    !normalizedEmail ||
    !normalizedDeviceId
  ) {
    throw new Error(
      'Não foi possível identificar esta conta ou dispositivo.'
    )
  }

  return [
    STORAGE_PREFIX,
    encodeURIComponent(
      normalizedEmail
    ),
    encodeURIComponent(
      normalizedDeviceId
    )
  ].join(':')
}

function isObject(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value ===
      'object' &&
    value !== null &&
    !Array.isArray(
      value
    )
  )
}

function isValidDate(
  value: unknown
): value is string {
  return (
    typeof value ===
      'string' &&
    Boolean(
      value
    ) &&
    !Number.isNaN(
      new Date(
        value
      ).getTime()
    )
  )
}

function isValidOperation(
  value: unknown
): value is MAProfessorManualSyncOperation {
  return (
    value === 'upload' ||
    value === 'verify' ||
    value === 'restore'
  )
}

function parseState(
  value: unknown
): MAProfessorManualSyncState | null {
  if (
    !isObject(
      value
    ) ||
    value.version !==
      STATE_VERSION ||
    typeof value.serverRevision !==
      'number' ||
    !Number.isInteger(
      value.serverRevision
    ) ||
    value.serverRevision < 0 ||
    typeof value.fingerprint !==
      'string' ||
    !value.fingerprint ||
    !isValidDate(
      value.syncedAt
    ) ||
    !isValidDate(
      value.verifiedAt
    ) ||
    !isValidOperation(
      value.lastOperation
    )
  ) {
    return null
  }

  return {
    version:
      STATE_VERSION,

    serverRevision:
      value.serverRevision,

    fingerprint:
      value.fingerprint,

    syncedAt:
      value.syncedAt,

    verifiedAt:
      value.verifiedAt,

    lastOperation:
      value.lastOperation
  }
}

export function readMAProfessorManualSyncState(
  email: string,
  deviceId: string
): MAProfessorManualSyncState | null {
  if (
    typeof window ===
      'undefined'
  ) {
    return null
  }

  const key =
    createStorageKey(
      email,
      deviceId
    )

  let raw: string | null =
    null

  try {
    raw =
      window.localStorage.getItem(
        key
      )
  } catch {
    return null
  }

  if (!raw) {
    return null
  }

  try {
    return parseState(
      JSON.parse(
        raw
      )
    )
  } catch {
    return null
  }
}

export function saveMAProfessorManualSyncState(
  email: string,
  deviceId: string,
  state: Omit<
    MAProfessorManualSyncState,
    'version'
  >
) {
  if (
    typeof window ===
      'undefined'
  ) {
    publishPersistenceState({
      status:
        'warning',

      operation:
        state.lastOperation
    })

    return false
  }

  const key =
    createStorageKey(
      email,
      deviceId
    )

  const payload:
    MAProfessorManualSyncState = {
    version:
      STATE_VERSION,

    ...state
  }

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(
        payload
      )
    )

    publishPersistenceState({
      status:
        'saved',

      operation:
        null
    })

    return true
  } catch {
    /*
     * A operação online ou o restauro já pode ter sido concluído
     * quando chegamos a este ponto. Uma falha apenas neste metadado
     * técnico nunca deve transformar esse sucesso real num erro nem
     * provocar uma repetição automática da operação principal.
     */
    publishPersistenceState({
      status:
        'warning',

      operation:
        state.lastOperation
    })

    return false
  }
}

export function clearMAProfessorManualSyncState(
  email: string,
  deviceId: string
) {
  if (
    typeof window ===
      'undefined'
  ) {
    return
  }

  const key =
    createStorageKey(
      email,
      deviceId
    )

  try {
    window.localStorage.removeItem(
      key
    )
  } catch {
    // A remoção deste metadado técnico não deve bloquear a aplicação.
  }
}
