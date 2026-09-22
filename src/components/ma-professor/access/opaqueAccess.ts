import type {
  MAProfessorAccessResponse
} from './accessTypes'

import {
  MAProfessorAccessApiError,
  finishMAProfessorOpaqueEnrollment,
  finishMAProfessorOpaqueLogin,
  startMAProfessorOpaqueEnrollment,
  startMAProfessorOpaqueAccountEnrollment,
  startMAProfessorOpaqueLogin
} from './accessApi'

import {
  finishMAProfessorOpaqueClientLogin,
  finishMAProfessorOpaqueClientRegistration,
  startMAProfessorOpaqueClientLogin,
  startMAProfessorOpaqueClientRegistration
} from './opaqueClient'

export interface MAProfessorOpaqueLoginResult {
  response:
    MAProfessorAccessResponse
  exportKey:
    string
}

export async function registerMAProfessorOpaqueAccount(
  email: string,
  password: string,
  deviceId: string
): Promise<void> {
  const clientStart = await startMAProfessorOpaqueClientRegistration(password)
  const serverStart = await startMAProfessorOpaqueAccountEnrollment(
    email, deviceId, clientStart.registrationRequest
  )
  const clientFinish = await finishMAProfessorOpaqueClientRegistration(
    password, clientStart.clientRegistrationState, serverStart.registrationResponse
  )
  await finishMAProfessorOpaqueEnrollment(
    email, deviceId, serverStart.enrollmentId, clientFinish.registrationRecord
  )
  // Login separately proves the password and obtains the account's exportKey.
  // An anonymous repeated request never replaces the existing credential.
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
    serverStart = await startMAProfessorOpaqueEnrollment(
      email, activationPassword, deviceId, clientStart.registrationRequest
    )
  } catch (error) {
    if (!(error instanceof MAProfessorAccessApiError) || error.status !== 409) throw error
    // An interrupted activation may already have enrolled this password.
    // Prove knowledge through login; never replace the existing registration.
    const authenticated = await loginMAProfessorOpaqueOnly(email, password, deviceId)
    return { exportKey: authenticated.exportKey }
  }

  const clientFinish =
    await finishMAProfessorOpaqueClientRegistration(
      password,
      clientStart.clientRegistrationState,
      serverStart.registrationResponse
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

export async function loginMAProfessorOpaque(
  email: string,
  password: string,
  deviceId: string
): Promise<MAProfessorOpaqueLoginResult | null> {
  const clientStart =
    await startMAProfessorOpaqueClientLogin(
      password
    )

  const serverStart =
    await startMAProfessorOpaqueLogin(
      email,
      deviceId,
      clientStart.startLoginRequest
    )

  const clientFinish =
    await finishMAProfessorOpaqueClientLogin(
      password,
      clientStart.clientLoginState,
      serverStart.loginResponse
    )

  if (!clientFinish) {
    return null
  }

  const response =
    await finishMAProfessorOpaqueLogin(
      email,
      deviceId,
      serverStart.loginId,
      clientFinish.finishLoginRequest
    )

  return {
    response,
    exportKey:
      clientFinish.exportKey
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
