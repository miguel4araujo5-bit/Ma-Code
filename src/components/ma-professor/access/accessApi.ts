import type {
  MAProfessorAccessRequestResponse,
  MAProfessorAccessResponse,
  MAProfessorAccessVerifyResponse
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
    Record<string, unknown>,
  token?: string
): Promise<T> {
  const response =
    await fetch(
      `${MA_PROFESSOR_ACCESS_API_PREFIX}${path}`,
      {
        method:
          'POST',
        headers: {
          'Content-Type':
            'application/json',
          ...(token
            ? {
                Authorization:
                  `Bearer ${token}`
              }
            : {})
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
  token: string
) {
  return postJson<MAProfessorAccessVerifyResponse>(
    '/verify',
    {},
    token
  )
}

export async function logoutMAProfessorAccess(
  token: string
) {
  return postJson<{
    success: true
    message: string
  }>(
    '/logout',
    {},
    token
  )
}

export async function confirmMAProfessorPilotAccess(
  token: string
) {
  return postJson<MAProfessorAccessResponse>(
    '/confirm-pilot',
    {},
    token
  )
}
