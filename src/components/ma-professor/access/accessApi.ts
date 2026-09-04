import type {
  MAProfessorAccessRequestResponse,
  MAProfessorAccessResponse,
  MAProfessorAccountSessionResponse,
  MAProfessorLicenseResponse,
  MAProfessorRenewalResponse,
  RenewableLicensePlan
} from './accessTypes'

import {
  readMAProfessorStoredAccess
} from './accessStorage'

const MA_PROFESSOR_ACCESS_API_PREFIX =
  '/api/ma-professor/access'

interface ApiErrorBody {
  success?: boolean
  message?: string
}

async function readResponseBody(
  response: Response
) {
  try {
    return await response
      .json() as unknown
  } catch {
    return null
  }
}

function getApiMessage(
  body: unknown,
  fallback: string
) {
  if (
    body &&
    typeof body ===
      'object'
  ) {
    const data =
      body as ApiErrorBody

    if (
      typeof data.message ===
      'string'
    ) {
      return data.message
    }
  }

  return fallback
}

async function postJson<T>(
  path: string,
  body:
    Record<string, unknown>
): Promise<T> {
  const response =
    await fetch(
      `${MA_PROFESSOR_ACCESS_API_PREFIX}${path}`,
      {
        method:
          'POST',
        headers: {
          'Content-Type':
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

  const data =
    await readResponseBody(
      response
    )

  if (
    !response.ok
  ) {
    throw new Error(
      getApiMessage(
        data,
        'Não foi possível concluir o pedido.'
      )
    )
  }

  return data as T
}

export async function requestMAProfessorAccess(
  email: string,
  accountPassword?: string,
  plan?: RenewableLicensePlan
) {
  if (
    typeof accountPassword !==
      'string' &&
    !plan
  ) {
    const stored =
      readMAProfessorStoredAccess()

    const normalizedEmail =
      email
        .trim()
        .toLowerCase()

    if (
      !stored ||
      stored.email
        .trim()
        .toLowerCase() !==
        normalizedEmail
    ) {
      throw new Error(
        'A sessão da conta não é válida.'
      )
    }

    return postJson<MAProfessorAccessRequestResponse>(
      '/status',
      {
        token:
          stored.token,
        deviceId:
          stored.deviceId
      }
    )
  }

  const body:
    Record<string, unknown> = {
      email
    }

  if (
    typeof accountPassword ===
    'string'
  ) {
    body.accountPassword =
      accountPassword
  }

  if (plan) {
    body.plan = plan
  }

  return postJson<MAProfessorAccessRequestResponse>(
    '/request',
    body
  )
}

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

export async function activateMAProfessorAccessPeriod(
  email: string,
  activationPassword: string,
  deviceId: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/activate',
    {
      email,
      activationPassword,
      deviceId
    }
  )
}

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

export async function verifyMAProfessorAccountSession(
  token: string,
  deviceId: string
) {
  return postJson<MAProfessorAccountSessionResponse>(
    '/account/verify',
    {
      token,
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

export async function logoutMAProfessorAccess(
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

export async function endMAProfessorSession(
  token: string,
  deviceId: string
) {
  return logoutMAProfessorAccess(
    token,
    deviceId
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
  requestedPlan:
    RenewableLicensePlan
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
