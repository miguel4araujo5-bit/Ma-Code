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

export function getOrCreateMAProfessorDeviceId() {
  const stored =
    localStorage.getItem(
      DEVICE_STORAGE_KEY
    )

  if (
    stored
  ) {
    return stored
  }

  const deviceId =
    createDeviceId()

  localStorage.setItem(
    DEVICE_STORAGE_KEY,
    deviceId
  )

  return deviceId
}

export function readMAProfessorStoredAccess():
  MAProfessorStoredAccess |
  null {
  const raw =
    localStorage.getItem(
      ACCESS_STORAGE_KEY
    )

  if (
    !raw
  ) {
    return null
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
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function saveMAProfessorStoredAccess(
  access:
    MAProfessorStoredAccess
) {
  localStorage.setItem(
    ACCESS_STORAGE_KEY,
    JSON.stringify(
      access
    )
  )

  notifySessionChange()
}

export function clearMAProfessorStoredAccess() {
  localStorage.removeItem(
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
