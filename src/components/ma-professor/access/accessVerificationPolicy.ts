export const MA_PROFESSOR_ACCESS_VERIFICATION_EVENT =
  'ma-professor-access-verification-state'

export const MA_PROFESSOR_VERIFICATION_FALLBACK_MAX_AGE_MS =
  24 * 60 * 60 * 1000

export type MAProfessorAccessVerificationState =
  | 'verified'
  | 'local-cache'

interface AccessErrorWithStatus {
  status?: unknown
}

interface StoredAccessIdentity {
  token?: unknown
  deviceId?: unknown
  checkedAt?: unknown
}

let currentVerificationState:
  MAProfessorAccessVerificationState =
    'verified'

export function getMAProfessorAccessErrorStatus(
  error: unknown
) {
  if (
    !error ||
    typeof error !== 'object'
  ) {
    return null
  }

  const status =
    (error as AccessErrorWithStatus)
      .status

  return typeof status === 'number' &&
    Number.isInteger(status)
    ? status
    : null
}

export function shouldInvalidateStoredSessionAfterVerificationError(
  error: unknown
) {
  const status =
    getMAProfessorAccessErrorStatus(
      error
    )

  return (
    status === 401 ||
    status === 403
  )
}

export function isStoredVerificationFreshForFallback(
  storedAccess:
    StoredAccessIdentity | null,
  nowMs = Date.now()
) {
  if (
    !storedAccess ||
    typeof storedAccess.checkedAt !==
      'string' ||
    !storedAccess.checkedAt
  ) {
    return false
  }

  const checkedAtMs =
    new Date(
      storedAccess.checkedAt
    ).getTime()

  if (
    !Number.isFinite(checkedAtMs) ||
    !Number.isFinite(nowMs)
  ) {
    return false
  }

  const ageMs =
    nowMs - checkedAtMs

  return (
    ageMs >= 0 &&
    ageMs <=
      MA_PROFESSOR_VERIFICATION_FALLBACK_MAX_AGE_MS
  )
}

export function canUseStoredSessionForVerificationFallback(
  error: unknown,
  storedAccess:
    StoredAccessIdentity | null,
  token: string,
  deviceId: string,
  nowMs = Date.now()
) {
  if (
    shouldInvalidateStoredSessionAfterVerificationError(
      error
    ) ||
    !storedAccess ||
    !isStoredVerificationFreshForFallback(
      storedAccess,
      nowMs
    )
  ) {
    return false
  }

  return (
    storedAccess.token === token &&
    storedAccess.deviceId === deviceId
  )
}

export function readMAProfessorAccessVerificationState() {
  return currentVerificationState
}

export function publishMAProfessorAccessVerificationState(
  state:
    MAProfessorAccessVerificationState
) {
  currentVerificationState = state

  if (
    typeof window === 'undefined'
  ) {
    return
  }

  window.dispatchEvent(
    new CustomEvent(
      MA_PROFESSOR_ACCESS_VERIFICATION_EVENT,
      {
        detail: state
      }
    )
  )
}
