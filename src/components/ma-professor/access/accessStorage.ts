import type {
  MAProfessorAccessSession,
  MAProfessorStoredAccess
} from './accessTypes'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-v1'

const DEVICE_STORAGE_KEY =
  'ma-professor-device-id-v1'

export const MA_PROFESSOR_ACCESS_SESSION_EVENT =
  'ma-professor-access-session-change'

let memoryAccess:
  MAProfessorStoredAccess | null = null

let memoryDeviceId:
  string | null = null

function notifySessionChange() {
  if (
    typeof window !==
    'undefined'
  ) {
    window.dispatchEvent(
      new Event(
        MA_PROFESSOR_ACCESS_SESSION_EVENT
      )
    )
  }
}

function createDeviceId() {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  if (
    uuid
  ) {
    return uuid
  }

  return [
    Date.now()
      .toString(36),
    Math.random()
      .toString(36)
      .slice(2, 12),
    Math.random()
      .toString(36)
      .slice(2, 12)
  ].join('-')
}

function getStorage(
  kind: 'local' | 'session'
): Storage | null {
  if (
    typeof window ===
    'undefined'
  ) {
    return null
  }

  try {
    return kind === 'local'
      ? window.localStorage
      : window.sessionStorage
  } catch {
    return null
  }
}

function readStoredValue(
  key: string
) {
  for (
    const kind of [
      'local',
      'session'
    ] as const
  ) {
    const storage =
      getStorage(kind)

    if (!storage) {
      continue
    }

    try {
      const value =
        storage.getItem(key)

      if (value !== null) {
        return value
      }
    } catch {
      // Em navegação privada o browser pode bloquear este armazenamento.
    }
  }

  return null
}

function writeStoredValue(
  key: string,
  value: string
) {
  for (
    const kind of [
      'local',
      'session'
    ] as const
  ) {
    const storage =
      getStorage(kind)

    if (!storage) {
      continue
    }

    try {
      storage.setItem(
        key,
        value
      )

      return true
    } catch {
      // Tenta o armazenamento seguinte; por fim existe fallback em memória.
    }
  }

  return false
}

function removeStoredValue(
  key: string
) {
  for (
    const kind of [
      'local',
      'session'
    ] as const
  ) {
    const storage =
      getStorage(kind)

    if (!storage) {
      continue
    }

    try {
      storage.removeItem(key)
    } catch {
      // A limpeza em memória continua a ser efetuada abaixo.
    }
  }
}

export function getOrCreateMAProfessorDeviceId() {
  const stored =
    readStoredValue(
      DEVICE_STORAGE_KEY
    )

  if (
    stored
  ) {
    memoryDeviceId = stored
    return stored
  }

  if (
    memoryDeviceId
  ) {
    return memoryDeviceId
  }

  const deviceId =
    createDeviceId()

  memoryDeviceId = deviceId

  writeStoredValue(
    DEVICE_STORAGE_KEY,
    deviceId
  )

  return deviceId
}

export function readMAProfessorStoredAccess():
  MAProfessorStoredAccess |
  null {
  const raw =
    readStoredValue(
      ACCESS_STORAGE_KEY
    )

  if (
    !raw
  ) {
    return memoryAccess
  }

  try {
    const parsed =
      JSON.parse(
        raw
      ) as MAProfessorStoredAccess

    if (
      !parsed ||
      typeof parsed.token !==
        'string' ||
      typeof parsed.email !==
        'string' ||
      typeof parsed.deviceId !==
        'string' ||
      !parsed.license
    ) {
      return memoryAccess
    }

    memoryAccess = parsed
    return parsed
  } catch {
    return memoryAccess
  }
}

export function saveMAProfessorStoredAccess(
  access:
    MAProfessorStoredAccess
) {
  memoryAccess = access

  writeStoredValue(
    ACCESS_STORAGE_KEY,
    JSON.stringify(
      access
    )
  )

  notifySessionChange()
}

export function clearMAProfessorStoredAccess() {
  memoryAccess = null

  removeStoredValue(
    ACCESS_STORAGE_KEY
  )

  notifySessionChange()
}

export function readMAProfessorAccessSession():
  MAProfessorAccessSession |
  null {
  const stored =
    readMAProfessorStoredAccess()

  if (!stored) {
    return null
  }

  return {
    ...stored,
    checkedAt:
      typeof stored.checkedAt ===
        'string' &&
      stored.checkedAt
        ? stored.checkedAt
        : new Date(0)
            .toISOString()
  }
}

export function saveMAProfessorAccessSession(
  session:
    MAProfessorAccessSession
) {
  saveMAProfessorStoredAccess(
    session
  )
}

export function clearMAProfessorAccessSession() {
  clearMAProfessorStoredAccess()
}
