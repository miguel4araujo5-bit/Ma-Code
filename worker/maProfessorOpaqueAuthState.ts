export const MA_PROFESSOR_OPAQUE_AUTH_STORAGE_KEY =
  'ma-professor-opaque-auth-v1'

export const MA_PROFESSOR_OPAQUE_AUTH_SCHEMA_VERSION =
  1

export const MA_PROFESSOR_OPAQUE_PROTOCOL =
  'OPAQUE-RFC9807'

export interface MAProfessorOpaqueRegistration {
  email: string
  registrationRecord: string
  createdAt: number
  updatedAt: number
  migratedFromV2At: number | null
}

export interface MAProfessorOpaquePendingEnrollment {
  id: string
  email: string
  deviceId: string
  createdAt: number
  expiresAt: number
}

export interface MAProfessorOpaquePendingLogin {
  id: string
  email: string
  deviceId: string
  serverLoginState: string
  createdAt: number
  expiresAt: number
}

export interface MAProfessorOpaqueAuthState {
  schemaVersion: 1
  protocol: 'OPAQUE-RFC9807'
  serverSetup: string | null
  registrations:
    Record<
      string,
      MAProfessorOpaqueRegistration
    >
  pendingEnrollments:
    Record<
      string,
      MAProfessorOpaquePendingEnrollment
    >
  pendingLogins:
    Record<
      string,
      MAProfessorOpaquePendingLogin
    >
  createdAt: number
  updatedAt: number
}

export function createMAProfessorOpaqueAuthState(
  now = Date.now()
): MAProfessorOpaqueAuthState {
  return {
    schemaVersion:
      MA_PROFESSOR_OPAQUE_AUTH_SCHEMA_VERSION,
    protocol:
      MA_PROFESSOR_OPAQUE_PROTOCOL,
    serverSetup:
      null,
    registrations:
      {},
    pendingEnrollments:
      {},
    pendingLogins:
      {},
    createdAt:
      now,
    updatedAt:
      now
  }
}

export function normalizeMAProfessorOpaqueAuthState(
  value:
    MAProfessorOpaqueAuthState |
    undefined,
  now = Date.now()
): MAProfessorOpaqueAuthState {
  if (
    !value ||
    value.schemaVersion !==
      MA_PROFESSOR_OPAQUE_AUTH_SCHEMA_VERSION ||
    value.protocol !==
      MA_PROFESSOR_OPAQUE_PROTOCOL ||
    !value.registrations ||
    typeof value.registrations !==
      'object' ||
    !value.pendingLogins ||
    typeof value.pendingLogins !==
      'object'
  ) {
    return createMAProfessorOpaqueAuthState(
      now
    )
  }

  return {
    ...value,
    pendingEnrollments:
      value.pendingEnrollments &&
      typeof value.pendingEnrollments ===
        'object'
        ? value.pendingEnrollments
        : {}
  }
}
