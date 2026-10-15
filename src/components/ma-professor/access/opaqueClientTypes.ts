export const MA_PROFESSOR_OPAQUE_TIMEOUT_MS = 30_000

export class MAProfessorOpaqueTimeoutError extends Error {
  constructor() {
    super('A confirmação da password demorou demasiado. Verifique a ligação à Internet e tente novamente.')
    this.name = 'MAProfessorOpaqueTimeoutError'
  }
}

export interface MAProfessorOpaqueClientRegistrationStart {
  clientRegistrationState: string
  registrationRequest: string
}

export interface MAProfessorOpaqueClientRegistrationFinish {
  registrationRecord: string
  exportKey: string
}

export interface MAProfessorOpaqueClientLoginStart {
  clientLoginState: string
  startLoginRequest: string
}

export interface MAProfessorOpaqueClientLoginFinish {
  finishLoginRequest: string
  exportKey: string
}

export interface MAProfessorOpaqueOperations {
  startRegistration: {
    args: [password: string]
    result: MAProfessorOpaqueClientRegistrationStart
  }
  finishRegistration: {
    args: [password: string, clientRegistrationState: string, registrationResponse: string]
    result: MAProfessorOpaqueClientRegistrationFinish
  }
  startLogin: {
    args: [password: string]
    result: MAProfessorOpaqueClientLoginStart
  }
  finishLogin: {
    args: [password: string, clientLoginState: string, loginResponse: string]
    result: MAProfessorOpaqueClientLoginFinish | null
  }
}

export type MAProfessorOpaqueOperation = keyof MAProfessorOpaqueOperations

export type MAProfessorOpaqueWorkerRequest = {
  [K in MAProfessorOpaqueOperation]: {
    operation: K
    args: MAProfessorOpaqueOperations[K]['args']
  }
}[MAProfessorOpaqueOperation]

export type MAProfessorOpaqueWorkerResponse =
  | { success: true; result: MAProfessorOpaqueOperations[MAProfessorOpaqueOperation]['result'] }
  | { success: false; timeout: boolean }
