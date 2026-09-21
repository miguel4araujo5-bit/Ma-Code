import type {
  MAProfessorAccessResponse
} from './accessTypes'

import {
  finishMAProfessorOpaqueEnrollment,
  finishMAProfessorOpaqueLogin,
  startMAProfessorOpaqueEnrollment,
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

  const serverStart =
    await startMAProfessorOpaqueEnrollment(
      email,
      activationPassword,
      deviceId,
      clientStart.registrationRequest
    )

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
