import {
  createMAProfessorOpaqueAuthState,
  normalizeMAProfessorOpaqueAuthState,
  type MAProfessorOpaqueAuthState
} from './maProfessorOpaqueAuthState'

export const MA_PROFESSOR_OPAQUE_ENROLL_START_PATH =
  '/api/ma-professor/access/opaque/enroll/start'

export const MA_PROFESSOR_OPAQUE_ENROLL_FINISH_PATH =
  '/api/ma-professor/access/opaque/enroll/finish'

export const MA_PROFESSOR_OPAQUE_LOGIN_START_PATH =
  '/api/ma-professor/access/opaque/login/start'

export const MA_PROFESSOR_OPAQUE_LOGIN_FINISH_PATH =
  '/api/ma-professor/access/opaque/login/finish'

const PENDING_ENROLLMENT_TTL_MS =
  2 * 60 * 1000

const PENDING_LOGIN_TTL_MS =
  2 * 60 * 1000

const MAX_PENDING_ENROLLMENTS =
  32

const MAX_PENDING_LOGINS =
  64

export interface MAProfessorOpaqueServerRuntime {
  createServerSetup():
    string

  createServerRegistrationResponse(
    params: {
      serverSetup: string
      userIdentifier: string
      registrationRequest: string
    }
  ): {
    registrationResponse: string
  }

  startServerLogin(
    params: {
      serverSetup: string
      registrationRecord:
        string | null
      startLoginRequest: string
      userIdentifier: string
    }
  ): {
    serverLoginState: string
    loginResponse: string
  }

  finishServerLogin(
    params: {
      serverLoginState: string
      finishLoginRequest: string
    }
  ): {
    sessionKey: string
  }
}

export interface MAProfessorOpaqueStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>
}

function normalizeEmail(
  value: string
) {
  return value
    .trim()
    .toLowerCase()
    .slice(0, 180)
}

function normalizeOpaqueValue(
  value: string
) {
  return value
    .trim()
    .slice(0, 32_000)
}

function createOpaqueId() {
  const bytes =
    new Uint8Array(24)

  globalThis.crypto.getRandomValues(
    bytes
  )

  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(
        byte
      )
  }

  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function prunePendingEnrollments(
  state:
    MAProfessorOpaqueAuthState,
  now: number
) {
  for (
    const [id, pending] of
    Object.entries(
      state.pendingEnrollments
    )
  ) {
    if (
      pending.expiresAt <=
        now
    ) {
      delete state
        .pendingEnrollments[
          id
        ]
    }
  }

  const entries =
    Object.entries(
      state.pendingEnrollments
    )

  if (
    entries.length <
      MAX_PENDING_ENROLLMENTS
  ) {
    return
  }

  entries
    .sort(
      (
        left,
        right
      ) =>
        left[1].createdAt -
        right[1].createdAt
    )
    .slice(
      0,
      entries.length -
        MAX_PENDING_ENROLLMENTS +
        1
    )
    .forEach(
      ([id]) => {
        delete state
          .pendingEnrollments[
            id
          ]
      }
    )
}


function prunePendingLogins(
  state:
    MAProfessorOpaqueAuthState,
  now: number
) {
  for (
    const [id, pending] of
    Object.entries(
      state.pendingLogins
    )
  ) {
    if (
      pending.expiresAt <=
        now
    ) {
      delete state
        .pendingLogins[
          id
        ]
    }
  }

  const entries =
    Object.entries(
      state.pendingLogins
    )

  if (
    entries.length <
      MAX_PENDING_LOGINS
  ) {
    return
  }

  entries
    .sort(
      (
        left,
        right
      ) =>
        left[1].createdAt -
        right[1].createdAt
    )
    .slice(
      0,
      entries.length -
        MAX_PENDING_LOGINS +
        1
    )
    .forEach(
      ([id]) => {
        delete state
          .pendingLogins[
            id
          ]
      }
    )
}

function ensureServerSetup(
  state:
    MAProfessorOpaqueAuthState,
  runtime:
    MAProfessorOpaqueServerRuntime
) {
  if (
    state.serverSetup
  ) {
    return state
      .serverSetup
  }

  const serverSetup =
    runtime
      .createServerSetup()

  state.serverSetup =
    serverSetup
  state.updatedAt =
    Date.now()

  return serverSetup
}

export function createOpaqueAuthProtocolState(
  stored:
    MAProfessorOpaqueAuthState |
    undefined,
  now = Date.now()
) {
  return normalizeMAProfessorOpaqueAuthState(
    stored,
    now
  )
}

export function startOpaqueEnrollment(
  state:
    MAProfessorOpaqueAuthState,
  runtime:
    MAProfessorOpaqueServerRuntime,
  input: {
    email: string
    deviceId: string
    registrationRequest: string
    replaceExisting?: boolean
  },
  now = Date.now()
) {
  const email =
    normalizeEmail(
      input.email
    )

  const deviceId =
    input.deviceId
      .trim()
      .slice(0, 180)

  const registrationRequest =
    normalizeOpaqueValue(
      input.registrationRequest
    )

  if (
    !email ||
    !deviceId ||
    !registrationRequest
  ) {
    throw new Error(
      'Pedido OPAQUE de registo inválido.'
    )
  }

  if (
    state.registrations[
      email
    ] &&
    !input.replaceExisting
  ) {
    throw new Error(
      'OPAQUE_ALREADY_ENROLLED'
    )
  }

  prunePendingEnrollments(
    state,
    now
  )

  const serverSetup =
    ensureServerSetup(
      state,
      runtime
    )

  const started =
    runtime
      .createServerRegistrationResponse({
        serverSetup,
        userIdentifier:
          email,
        registrationRequest
      })

  const enrollmentId =
    createOpaqueId()

  state.pendingEnrollments[
    enrollmentId
  ] = {
    id:
      enrollmentId,
    email,
    deviceId,
    createdAt:
      now,
    expiresAt:
      now +
      PENDING_ENROLLMENT_TTL_MS,
    ...(input.replaceExisting
      ? {
          replaceExisting:
            true
        }
      : {})
  }

  state.updatedAt =
    now

  return {
    enrollmentId,
    registrationResponse:
      started.registrationResponse,
    expiresAt:
      now +
      PENDING_ENROLLMENT_TTL_MS
  }
}

export function finishOpaqueEnrollment(
  state:
    MAProfessorOpaqueAuthState,
  input: {
    email: string
    deviceId: string
    enrollmentId: string
    registrationRecord: string
    migratedFromV2?: boolean
  },
  now = Date.now()
) {
  const email =
    normalizeEmail(
      input.email
    )

  const deviceId =
    input.deviceId
      .trim()
      .slice(0, 180)

  const enrollmentId =
    input.enrollmentId
      .trim()
      .slice(0, 180)

  const registrationRecord =
    normalizeOpaqueValue(
      input.registrationRecord
    )

  if (
    !email ||
    !deviceId ||
    !enrollmentId ||
    !registrationRecord
  ) {
    throw new Error(
      'Registo OPAQUE inválido.'
    )
  }

  const pending =
    state.pendingEnrollments[
      enrollmentId
    ]

  if (!pending) {
    throw new Error(
      'OPAQUE_ENROLLMENT_INVALID'
    )
  }

  delete state
    .pendingEnrollments[
      enrollmentId
    ]

  state.updatedAt =
    now

  if (
    pending.expiresAt <=
      now ||
    pending.email !==
      email ||
    pending.deviceId !==
      deviceId
  ) {
    throw new Error(
      'OPAQUE_ENROLLMENT_INVALID'
    )
  }

  if (
    state.registrations[
      email
    ] &&
    !pending.replaceExisting
  ) {
    throw new Error(
      'OPAQUE_ALREADY_ENROLLED'
    )
  }

  state.registrations[
    email
  ] = {
    email,
    registrationRecord,
    createdAt:
      now,
    updatedAt:
      now,
    migratedFromV2At:
      input.migratedFromV2
        ? now
        : null
  }

  state.updatedAt =
    now

  return state
    .registrations[
      email
    ]
}

export function startOpaqueLogin(
  state:
    MAProfessorOpaqueAuthState,
  runtime:
    MAProfessorOpaqueServerRuntime,
  input: {
    email: string
    deviceId: string
    startLoginRequest: string
  },
  now = Date.now()
) {
  const email =
    normalizeEmail(
      input.email
    )

  const deviceId =
    input.deviceId
      .trim()
      .slice(0, 180)

  const startLoginRequest =
    normalizeOpaqueValue(
      input.startLoginRequest
    )

  if (
    !email ||
    !deviceId ||
    !startLoginRequest
  ) {
    throw new Error(
      'Pedido OPAQUE de login inválido.'
    )
  }

  prunePendingLogins(
    state,
    now
  )

  const serverSetup =
    ensureServerSetup(
      state,
      runtime
    )

  const registration =
    state.registrations[
      email
    ]

  const started =
    runtime
      .startServerLogin({
        serverSetup,
        registrationRecord:
          registration
            ?.registrationRecord ??
          null,
        startLoginRequest,
        userIdentifier:
          email
      })

  const loginId =
    createOpaqueId()

  state.pendingLogins[
    loginId
  ] = {
    id:
      loginId,
    email,
    deviceId,
    serverLoginState:
      started.serverLoginState,
    createdAt:
      now,
    expiresAt:
      now +
      PENDING_LOGIN_TTL_MS
  }

  state.updatedAt =
    now

  return {
    loginId,
    loginResponse:
      started.loginResponse,
    expiresAt:
      now +
      PENDING_LOGIN_TTL_MS
  }
}

export function finishOpaqueLogin(
  state:
    MAProfessorOpaqueAuthState,
  runtime:
    MAProfessorOpaqueServerRuntime,
  input: {
    email: string
    deviceId: string
    loginId: string
    finishLoginRequest: string
  },
  now = Date.now()
) {
  const email =
    normalizeEmail(
      input.email
    )

  const deviceId =
    input.deviceId
      .trim()
      .slice(0, 180)

  const loginId =
    input.loginId
      .trim()
      .slice(0, 180)

  const finishLoginRequest =
    normalizeOpaqueValue(
      input.finishLoginRequest
    )

  if (
    !email ||
    !deviceId ||
    !loginId ||
    !finishLoginRequest
  ) {
    return null
  }

  const pending =
    state.pendingLogins[
      loginId
    ]

  if (!pending) {
    return null
  }

  delete state
    .pendingLogins[
      loginId
    ]

  state.updatedAt =
    now

  if (
    pending.expiresAt <=
      now ||
    pending.email !==
      email ||
    pending.deviceId !==
      deviceId
  ) {
    return null
  }

  try {
    runtime
      .finishServerLogin({
        serverLoginState:
          pending
            .serverLoginState,
        finishLoginRequest
      })
  } catch {
    return null
  }

  if (
    !state.registrations[
      pending.email
    ]
  ) {
    return null
  }

  return {
    email:
      pending.email,
    deviceId:
      pending.deviceId
  }
}

export function createFreshOpaqueAuthState(
  now = Date.now()
) {
  return createMAProfessorOpaqueAuthState(
    now
  )
}
