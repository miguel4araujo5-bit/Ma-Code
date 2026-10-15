import type {
  MAProfessorAccessResponse
} from './accessTypes'

import {
  MAProfessorAccessApiError,
  finishMAProfessorOpaqueEnrollment,
  finishMAProfessorOpaqueLogin,
  finishMAProfessorOpaqueMigration,
  startMAProfessorOpaqueEnrollment,
  startMAProfessorOpaqueAccountEnrollment,
  startMAProfessorOpaqueLogin,
  startMAProfessorOpaqueMigration
} from './accessApi'

import {
  MA_PROFESSOR_OPAQUE_KEY_STRETCHING,
  MA_PROFESSOR_OPAQUE_LEGACY_KEY_STRETCHING,
  MA_PROFESSOR_OPAQUE_TIMEOUT_MS,
  MAProfessorOpaqueTimeoutError,
  type MAProfessorOpaqueKeyStretching,
  finishMAProfessorOpaqueClientLogin,
  finishMAProfessorOpaqueClientRegistration,
  startMAProfessorOpaqueClientLogin,
  startMAProfessorOpaqueClientRegistration
} from './opaqueClient'

import {
  unwrapMAProfessorLegacyOpaqueExportKey,
  wrapMAProfessorLegacyOpaqueExportKey
} from './opaqueExportKeyMigration'

export interface MAProfessorOpaqueLoginResult {
  response:
    MAProfessorAccessResponse
  exportKey:
    string
}

interface MAProfessorOpaqueProfileLoginResult
  extends MAProfessorOpaqueLoginResult {
  rawExportKey:
    string
}

export class MAProfessorOpaqueMobileCompatibilityError
  extends Error {
  constructor() {
    super(
      'Esta conta ainda utiliza a proteção anterior, que pode exceder a memória disponível num telemóvel. Entre uma vez no MA-Professor num computador para atualizar a proteção da conta e depois volte a tentar neste dispositivo.'
    )
    this.name =
      'MAProfessorOpaqueMobileCompatibilityError'
  }
}

export function shouldAvoidLegacyOpaqueKeyStretching() {
  if (
    typeof navigator ===
      'undefined'
  ) {
    return false
  }

  const userAgent =
    navigator.userAgent || ''

  const platform =
    navigator.platform || ''

  return (
    /iPhone|iPad|iPod|Android|Mobile/i.test(
      userAgent
    ) ||
    (
      platform ===
        'MacIntel' &&
      navigator.maxTouchPoints >
        1
    )
  )
}

export async function registerMAProfessorOpaqueAccount(
  email: string,
  password: string,
  deviceId: string
): Promise<void> {
  const clientStart =
    await startMAProfessorOpaqueClientRegistration(
      password
    )

  const serverStart =
    await startMAProfessorOpaqueAccountEnrollment(
      email,
      deviceId,
      clientStart.registrationRequest
    )

  const clientFinish =
    await finishMAProfessorOpaqueClientRegistration(
      password,
      clientStart.clientRegistrationState,
      serverStart.registrationResponse,
      MA_PROFESSOR_OPAQUE_KEY_STRETCHING
    )

  await finishMAProfessorOpaqueEnrollment(
    email,
    deviceId,
    serverStart.enrollmentId,
    clientFinish.registrationRecord
  )
}

export async function enrollMAProfessorOpaqueForActivation(
  email: string,
  password: string,
  activationPassword: string,
  deviceId: string
) {
  const clientStart =
    await startMAProfessorOpaqueClientRegistration(
      password
    )

  let serverStart

  try {
    serverStart =
      await startMAProfessorOpaqueEnrollment(
        email,
        activationPassword,
        deviceId,
        clientStart.registrationRequest
      )
  } catch (error) {
    if (
      !(
        error instanceof
          MAProfessorAccessApiError
      ) ||
      error.status !== 409
    ) {
      throw error
    }

    const authenticated =
      await loginMAProfessorOpaqueOnly(
        email,
        password,
        deviceId
      )

    return {
      exportKey:
        authenticated.exportKey
    }
  }

  const clientFinish =
    await finishMAProfessorOpaqueClientRegistration(
      password,
      clientStart.clientRegistrationState,
      serverStart.registrationResponse,
      MA_PROFESSOR_OPAQUE_KEY_STRETCHING
    )

  await finishMAProfessorOpaqueEnrollment(
    email,
    deviceId,
    serverStart.enrollmentId,
    clientFinish.registrationRecord
  )

  return {
    exportKey:
      clientFinish.exportKey
  }
}

function requireActiveLogin(
  signal: AbortSignal
) {
  if (signal.aborted) {
    throw new MAProfessorOpaqueTimeoutError()
  }
}

async function performOpaqueLoginWithStretching(
  email: string,
  password: string,
  deviceId: string,
  signal: AbortSignal,
  keyStretching:
    MAProfessorOpaqueKeyStretching
): Promise<MAProfessorOpaqueProfileLoginResult | null> {
  const clientStart =
    await startMAProfessorOpaqueClientLogin(
      password
    )

  requireActiveLogin(signal)

  const serverStart =
    await startMAProfessorOpaqueLogin(
      email,
      deviceId,
      clientStart.startLoginRequest,
      signal
    )

  requireActiveLogin(signal)

  const clientFinish =
    await finishMAProfessorOpaqueClientLogin(
      password,
      clientStart.clientLoginState,
      serverStart.loginResponse,
      keyStretching
    )

  requireActiveLogin(signal)

  if (!clientFinish) {
    return null
  }

  const response =
    await finishMAProfessorOpaqueLogin(
      email,
      deviceId,
      serverStart.loginId,
      clientFinish.finishLoginRequest,
      signal
    )

  requireActiveLogin(signal)

  const exportKey =
    response
      .opaqueLegacyExportKeyWrap
      ? await unwrapMAProfessorLegacyOpaqueExportKey(
          clientFinish.exportKey,
          response
            .opaqueLegacyExportKeyWrap
        )
      : clientFinish.exportKey

  return {
    response,
    exportKey,
    rawExportKey:
      clientFinish.exportKey
  }
}

async function migrateLegacyOpaqueCredential(
  email: string,
  password: string,
  deviceId: string,
  migrationId: string,
  legacyExportKey: string,
  signal: AbortSignal
) {
  requireActiveLogin(signal)

  const clientStart =
    await startMAProfessorOpaqueClientRegistration(
      password
    )

  requireActiveLogin(signal)

  const serverStart =
    await startMAProfessorOpaqueMigration(
      email,
      deviceId,
      migrationId,
      clientStart.registrationRequest,
      signal
    )

  requireActiveLogin(signal)

  const clientFinish =
    await finishMAProfessorOpaqueClientRegistration(
      password,
      clientStart.clientRegistrationState,
      serverStart.registrationResponse,
      MA_PROFESSOR_OPAQUE_KEY_STRETCHING
    )

  requireActiveLogin(signal)

  const legacyExportKeyWrap =
    await wrapMAProfessorLegacyOpaqueExportKey(
      clientFinish.exportKey,
      legacyExportKey
    )

  requireActiveLogin(signal)

  await finishMAProfessorOpaqueMigration(
    email,
    deviceId,
    serverStart.enrollmentId,
    clientFinish.registrationRecord,
    legacyExportKeyWrap,
    signal
  )

  requireActiveLogin(signal)
}

async function performOpaqueLogin(
  email: string,
  password: string,
  deviceId: string,
  signal: AbortSignal
): Promise<MAProfessorOpaqueLoginResult | null> {
  const current =
    await performOpaqueLoginWithStretching(
      email,
      password,
      deviceId,
      signal,
      MA_PROFESSOR_OPAQUE_KEY_STRETCHING
    )

  if (current) {
    return {
      response:
        current.response,
      exportKey:
        current.exportKey
    }
  }

  if (
    shouldAvoidLegacyOpaqueKeyStretching()
  ) {
    throw new MAProfessorOpaqueMobileCompatibilityError()
  }

  const legacy =
    await performOpaqueLoginWithStretching(
      email,
      password,
      deviceId,
      signal,
      MA_PROFESSOR_OPAQUE_LEGACY_KEY_STRETCHING
    )

  if (!legacy) {
    return null
  }

  const migrationId =
    legacy.response
      .opaqueMigrationId

  if (migrationId) {
    await migrateLegacyOpaqueCredential(
      email,
      password,
      deviceId,
      migrationId,
      legacy.rawExportKey,
      signal
    )
  }

  return {
    response:
      legacy.response,
    exportKey:
      legacy.exportKey
  }
}

export async function loginMAProfessorOpaque(
  email: string,
  password: string,
  deviceId: string
): Promise<MAProfessorOpaqueLoginResult | null> {
  const controller =
    new AbortController()

  let timer:
    ReturnType<typeof setTimeout> |
    undefined

  const timeout =
    new Promise<never>(
      (_, reject) => {
        timer =
          setTimeout(
            () => {
              reject(
                new MAProfessorOpaqueTimeoutError()
              )
              controller.abort()
            },
            MA_PROFESSOR_OPAQUE_TIMEOUT_MS
          )
      }
    )

  try {
    return await Promise.race([
      performOpaqueLogin(
        email,
        password,
        deviceId,
        controller.signal
      ),
      timeout
    ])
  } finally {
    clearTimeout(timer)
  }
}

export async function loginMAProfessorOpaqueOnly(
  email: string,
  password: string,
  deviceId: string
): Promise<MAProfessorOpaqueLoginResult> {
  const opaque =
    await loginMAProfessorOpaque(
      email,
      password,
      deviceId
    )

  if (!opaque) {
    throw new Error(
      'Não foi possível iniciar sessão com estas credenciais.'
    )
  }

  return opaque
}
