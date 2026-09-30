import opaqueWasmUrl from '../../../../worker/vendor/ma-professor-opaque/opaque_bg.wasm?url'

import init, {
  finishClientLogin,
  finishClientRegistration,
  startClientLogin,
  startClientRegistration
} from '../../../../worker/vendor/ma-professor-opaque/opaque.js'

const KEY_STRETCHING =
  'rfc-recommended' as const

export const MA_PROFESSOR_OPAQUE_TIMEOUT_MS = 30_000

export class MAProfessorOpaqueTimeoutError extends Error {
  constructor() {
    super('A confirmação da password demorou demasiado. Verifique a ligação à Internet e tente novamente.')
    this.name = 'MAProfessorOpaqueTimeoutError'
  }
}

let opaqueReady:
  Promise<unknown> |
  null =
  null

async function initializeOpaque() {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new MAProfessorOpaqueTimeoutError())
      controller.abort()
    }, MA_PROFESSOR_OPAQUE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([
      init({
        module_or_path: typeof opaqueWasmUrl === 'string'
          ? new Request(opaqueWasmUrl, { signal: controller.signal })
          : opaqueWasmUrl
      }),
      timeout
    ])
  } finally {
    clearTimeout(timer)
  }
}

function ensureOpaqueReady() {
  if (!opaqueReady) {
    opaqueReady =
      initializeOpaque().catch(error => {
        // A connection failure must not poison every later manual attempt.
        opaqueReady = null
        throw error
      })
  }

  return opaqueReady
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

export async function startMAProfessorOpaqueClientRegistration(
  password: string
): Promise<MAProfessorOpaqueClientRegistrationStart> {
  await ensureOpaqueReady()

  const started =
    startClientRegistration({
      password
    })

  return {
    clientRegistrationState:
      started.clientRegistrationState,
    registrationRequest:
      started.registrationRequest
  }
}

export async function finishMAProfessorOpaqueClientRegistration(
  password: string,
  clientRegistrationState: string,
  registrationResponse: string
): Promise<MAProfessorOpaqueClientRegistrationFinish> {
  await ensureOpaqueReady()

  const finished =
    finishClientRegistration({
      password,
      clientRegistrationState,
      registrationResponse,
      keyStretching:
        KEY_STRETCHING
    })

  return {
    registrationRecord:
      finished.registrationRecord,
    exportKey:
      finished.exportKey
  }
}

export async function startMAProfessorOpaqueClientLogin(
  password: string
): Promise<MAProfessorOpaqueClientLoginStart> {
  await ensureOpaqueReady()

  const started =
    startClientLogin({
      password
    })

  return {
    clientLoginState:
      started.clientLoginState,
    startLoginRequest:
      started.startLoginRequest
  }
}

export async function finishMAProfessorOpaqueClientLogin(
  password: string,
  clientLoginState: string,
  loginResponse: string
): Promise<MAProfessorOpaqueClientLoginFinish | null> {
  await ensureOpaqueReady()

  const finished =
    finishClientLogin({
      password,
      clientLoginState,
      loginResponse,
      keyStretching:
        KEY_STRETCHING
    })

  if (!finished) {
    return null
  }

  return {
    finishLoginRequest:
      finished.finishLoginRequest,
    exportKey:
      finished.exportKey
  }
}
