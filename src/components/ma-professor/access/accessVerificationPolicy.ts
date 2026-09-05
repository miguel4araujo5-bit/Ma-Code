export const MA_PROFESSOR_ACCESS_VERIFICATION_EVENT =
  'ma-professor-access-verification-state'

export type MAProfessorAccessVerificationState =
  | 'verified'
  | 'local-cache'

interface AccessErrorWithStatus {
  status?: unknown
}

interface StoredAccessIdentity {
  token?: unknown
  deviceId?: unknown
}

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

export function canUseStoredSessionForVerificationFallback(
  error: unknown,
  storedAccess:
    StoredAccessIdentity | null,
  token: string,
  deviceId: string
) {
  if (
    shouldInvalidateStoredSessionAfterVerificationError(
      error
    ) ||
    !storedAccess
  ) {
    return false
  }

  return (
    storedAccess.token === token &&
    storedAccess.deviceId === deviceId
  )
}
