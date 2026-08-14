import {
  MA_PROFESSOR_ACCESS_STORAGE_KEY,
  MA_PROFESSOR_DEVICE_STORAGE_KEY,
  type MAProfessorAccessSession
} from './accessTypes'

export const MA_PROFESSOR_ACCESS_SESSION_EVENT =
  'ma-professor-access-session-change'

type MAProfessorStoredAccessInput =
  Omit<
    MAProfessorAccessSession,
    'checkedAt'
  > & {
    checkedAt?: string
  }

function canUseStorage() {
  return (
    typeof window !==
      'undefined' &&
    typeof window.localStorage !==
      'undefined'
  )
}

function notifySessionChange() {
  if (
    typeof window ===
    'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new Event(
      MA_PROFESSOR_ACCESS_SESSION_EVENT
    )
  )
}

function createId(
  prefix: string
) {
  const uuid =
    globalThis.crypto
      ?.randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
}

export function getOrCreateMAProfessorDeviceId() {
  if (
    !canUseStorage()
  ) {
    return createId(
      'device'
    )
  }

  const stored =
    window.localStorage
      .getItem(
        MA_PROFESSOR_DEVICE_STORAGE_KEY
      )
      ?.trim()

  if (
    stored
  ) {
    return stored
  }

  const deviceId =
    createId(
      'device'
    )

  window.localStorage.setItem(
    MA_PROFESSOR_DEVICE_STORAGE_KEY,
    deviceId
  )

  return deviceId
}

export function readMAProfessorAccessSession():
  MAProfessorAccessSession |
  null {
  if (
    !canUseStorage()
  ) {
    return null
  }

  const raw =
    window.localStorage.getItem(
      MA_PROFESSOR_ACCESS_STORAGE_KEY
    )

  if (
    !raw
  ) {
    return null
  }

  try {
    const value =
      JSON.parse(
        raw
      ) as Partial<MAProfessorAccessSession>

    if (
      typeof value.token !==
        'string' ||
      typeof value.deviceId !==
        'string' ||
      typeof value.email !==
        'string' ||
      !value.license ||
      typeof value.license !==
        'object'
    ) {
      throw new Error(
        'Sessão inválida.'
      )
    }

    return {
      token:
        value.token,
      deviceId:
        value.deviceId,
      email:
        value.email,
      license:
        value.license,
      checkedAt:
        typeof value.checkedAt ===
        'string'
          ? value.checkedAt
          : new Date()
              .toISOString()
    }
  } catch {
    clearMAProfessorAccessSession()

    return null
  }
}

export function saveMAProfessorAccessSession(
  session:
    MAProfessorAccessSession
) {
  if (
    !canUseStorage()
  ) {
    return
  }

  window.localStorage.setItem(
    MA_PROFESSOR_ACCESS_STORAGE_KEY,
    JSON.stringify(
      session
    )
  )

  notifySessionChange()
}

export function clearMAProfessorAccessSession() {
  if (
    !canUseStorage()
  ) {
    return
  }

  window.localStorage.removeItem(
    MA_PROFESSOR_ACCESS_STORAGE_KEY
  )

  notifySessionChange()
}

/*
 * Nomes utilizados pelo novo gate de autenticação.
 *
 * São aliases sobre o mesmo armazenamento da aplicação para
 * não criar duas sessões paralelas.
 */
export function readMAProfessorStoredAccess() {
  return readMAProfessorAccessSession()
}

export function saveMAProfessorStoredAccess(
  access:
    MAProfessorStoredAccessInput
) {
  saveMAProfessorAccessSession({
    ...access,
    checkedAt:
      access.checkedAt ??
      new Date()
        .toISOString()
  })
}

export function clearMAProfessorStoredAccess() {
  clearMAProfessorAccessSession()
}
