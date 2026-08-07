const ADMIN_API_PREFIX = '/api/admin'

interface AdminApiErrorBody {
  success?: boolean
  message?: string
}

interface AuthenticatedAdminResponse {
  success: true
  authenticated: true
  expiresAt: string
}

export interface AdminSessionState {
  authenticated: boolean
  expiresAt: string | null
}

async function readResponseBody(
  response: Response
) {
  try {
    return await response.json() as unknown
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
    typeof body === 'object'
  ) {
    const data =
      body as AdminApiErrorBody

    if (
      typeof data.message === 'string'
    ) {
      return data.message
    }
  }

  return fallback
}

export async function getAdminSession():
  Promise<AdminSessionState> {
  let response: Response

  try {
    response =
      await fetch(
        `${ADMIN_API_PREFIX}/session`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept:
              'application/json'
          },
          cache: 'no-store'
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar à administração MA-CODE.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status === 401
  ) {
    return {
      authenticated: false,
      expiresAt: null
    }
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível verificar a sessão administrativa.'
      )
    )
  }

  const data =
    body as AuthenticatedAdminResponse

  if (
    !data ||
    data.success !== true ||
    data.authenticated !== true ||
    typeof data.expiresAt !==
      'string'
  ) {
    throw new Error(
      'O servidor devolveu uma sessão administrativa inválida.'
    )
  }

  return {
    authenticated: true,
    expiresAt:
      data.expiresAt
  }
}

export async function loginAdmin(
  password: string
): Promise<AdminSessionState> {
  let response: Response

  try {
    response =
      await fetch(
        `${ADMIN_API_PREFIX}/login`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type':
              'application/json',
            Accept:
              'application/json'
          },
          body:
            JSON.stringify({
              password
            })
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar à administração MA-CODE.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível iniciar a sessão administrativa.'
      )
    )
  }

  const data =
    body as AuthenticatedAdminResponse

  if (
    !data ||
    data.success !== true ||
    data.authenticated !== true ||
    typeof data.expiresAt !==
      'string'
  ) {
    throw new Error(
      'O servidor devolveu uma resposta de autenticação inválida.'
    )
  }

  return {
    authenticated: true,
    expiresAt:
      data.expiresAt
  }
}

export async function logoutAdmin() {
  let response: Response

  try {
    response =
      await fetch(
        `${ADMIN_API_PREFIX}/logout`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            Accept:
              'application/json'
          }
        }
      )
  } catch {
    throw new Error(
      'Não foi possível terminar a sessão administrativa no servidor.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível terminar a sessão administrativa.'
      )
    )
  }
}
