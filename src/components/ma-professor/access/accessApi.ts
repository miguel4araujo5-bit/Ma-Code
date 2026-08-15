import type {
  MAProfessorAccessRequestResponse,
  MAProfessorAccessResponse,
  MAProfessorLicenseResponse,
  MAProfessorRenewalResponse,
  RenewableLicensePlan
} from './accessTypes'

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
  email: string
) {
  return postJson<MAProfessorAccessRequestResponse>(
    '/request',
    {
      email
    }
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
