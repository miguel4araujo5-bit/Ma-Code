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

const PENDING_LOGIN_TTL_MS =
  2 * 60 * 1000

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
    registrationRequest: string
  }
) {
  const email =
    normalizeEmail(
      input.email
    )

  const registrationRequest =
    normalizeOpaqueValue(
      input.registrationRequest
    )

  if (
    !email ||
    !registrationRequest
  ) {
    throw new Error(
      'Pedido OPAQUE de registo inválido.'
    )
  }

  if (
    state.registrations[
      email
    ]
  ) {
    throw new Error(
      'OPAQUE_ALREADY_ENROLLED'
    )
  }

  const serverSetup =
    ensureServerSetup(
      state,
      runtime
    )

  return runtime
    .createServerRegistrationResponse({
      serverSetup,
      userIdentifier:
        email,
      registrationRequest
    })
}

export function finishOpaqueEnrollment(
  state:
    MAProfessorOpaqueAuthState,
  input: {
    email: string
    registrationRecord: string
    migratedFromV2?: boolean
  },
  now = Date.now()
) {
  const email =
    normalizeEmail(
      input.email
    )

  const registrationRecord =
    normalizeOpaqueValue(
      input.registrationRecord
    )

  if (
    !email ||
    !registrationRecord
  ) {
    throw new Error(
      'Registo OPAQUE inválido.'
    )
  }

  if (
    state.registrations[
      email
    ]
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
    loginId: string
    finishLoginRequest: string
  },
  now = Date.now()
) {
  const loginId =
    input.loginId
      .trim()
      .slice(0, 180)

  const finishLoginRequest =
    normalizeOpaqueValue(
      input.finishLoginRequest
    )

  if (
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
      now
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
