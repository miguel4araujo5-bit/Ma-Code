import type {
  LicenseSummary
} from '../types'

import type {
  MAProfessorAccessRequestResponse,
  MAProfessorAccessResponse,
  MAProfessorLicenseResponse,
  MAProfessorRenewalResponse,
  RenewableLicensePlan
} from './accessTypes'

const API_PREFIX =
  '/api/ma-professor/access'

interface ApiErrorBody {
  success?: boolean
  message?: string
}

async function postJson<T>(
  path: string,
  body: Record<
    string,
    unknown
  >
): Promise<T> {
  let response: Response

  try {
    response =
      await fetch(
        `${API_PREFIX}${path}`,
        {
          method:
            'POST',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'application/json'
          },
          body:
            JSON.stringify(
              body
            ),
          cache:
            'no-store'
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar ao serviço de acesso. Verifique a ligação e tente novamente.'
    )
  }

  let data: unknown

  try {
    data =
      await response.json()
  } catch {
    data = null
  }

  if (
    !response.ok
  ) {
    const message =
      data &&
      typeof data ===
        'object'
        ? (
            data as ApiErrorBody
          ).message
        : ''

    throw new Error(
      message ||
        'Não foi possível concluir o pedido. Tente novamente.'
    )
  }

  return data as T
}

export async function requestMAProfessorAccess(
  email: string
) {
  return postJson<MAProfessorAccessRequestResponse>(
    '/request',
    {
      email
    }
  )
}

/*
 * Mantido por compatibilidade com o AccessGate existente.
 *
 * O novo fluxo público utiliza activateMAProfessorAccessPeriod,
 * onde a senha MP e a password pessoal são enviadas separadamente.
 */
export async function activateMAProfessorAccess(
  email: string,
  password: string,
  deviceId: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/activate',
    {
      email,
      password,
      deviceId
    }
  )
}

/*
 * A senha MP serve apenas para ativar o período.
 *
 * accountPassword é a password pessoal da conta:
 * - na primeira ativação, fica definida;
 * - em ativações posteriores, deve corresponder à password
 *   pessoal já existente.
 */
export async function activateMAProfessorAccessPeriod(
  email: string,
  activationPassword: string,
  accountPassword: string,
  deviceId: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/activate',
    {
      email,
      activationPassword,
      accountPassword,
      deviceId
    }
  )
}

/*
 * Login normal depois da ativação.
 *
 * Nunca recebe a senha MP.
 */
export async function loginMAProfessorAccess(
  email: string,
  password: string,
  deviceId: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/login',
    {
      email,
      password,
      deviceId
    }
  )
}

export async function startMAProfessorAccess(
  email: string,
  deviceId: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/start',
    {
      email,
      deviceId
    }
  )
}

export async function verifyMAProfessorAccess(
  token: string,
  deviceId: string
) {
  return postJson<MAProfessorLicenseResponse>(
    '/verify',
    {
      token,
      deviceId
    }
  )
}

export async function confirmMAProfessorPilotAccess(
  token: string,
  deviceId: string
) {
  return postJson<MAProfessorLicenseResponse>(
    '/confirm-pilot',
    {
      token,
      deviceId
    }
  )
}

export async function requestMAProfessorRenewal(
  token: string,
  deviceId: string,
  requestedPlan: RenewableLicensePlan
) {
  return postJson<MAProfessorRenewalResponse>(
    '/renew',
    {
      token,
      deviceId,
      requestedPlan
    }
  )
}

export async function endMAProfessorSession(
  token: string,
  deviceId: string
) {
  return postJson<{
    success: true
    message?: string
  }>(
    '/logout',
    {
      token,
      deviceId
    }
  )
}

export async function logoutMAProfessorAccess(
  token: string,
  deviceId: string
) {
  return endMAProfessorSession(
    token,
    deviceId
  )
}

export function createSessionLicense(
  license: LicenseSummary
) {
  return license
}
