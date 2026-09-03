import type {
  MAProfessorAccessRequestResponse,
  MAProfessorAccessResponse,
  MAProfessorLicenseResponse,
  MAProfessorRenewalResponse,
  RenewableLicensePlan
} from './accessTypes'

const MA_PROFESSOR_ACCESS_API_PREFIX =
  '/api/ma-professor/access'

const MISSING_ACTIVE_PERIOD_MESSAGE =
  'Esta conta não tem um período de acesso ativo.'

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
  accountPassword?: string
) {
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

  return postJson<MAProfessorAccessRequestResponse>(
    '/request',
    body
  )
}

async function getFirstActivationMessage(
  email: string
) {
  try {
    const response =
      await requestMAProfessorAccess(
        email
      )

    switch (
      response.request.status
    ) {
      case 'pending':
        return 'A sua conta foi criada, mas o pedido de acesso ainda está em análise. Aguarde a aprovação da MA-CODE antes de tentar entrar.'

      case 'approved':
        return response.canActivate
          ? 'O seu pedido já foi aprovado, mas o primeiro período de acesso ainda não foi ativado. Utilize a senha de ativação MP-... recebida por email em “Tenho uma senha de ativação”. Depois da primeira ativação poderá entrar normalmente com o seu email e a sua password pessoal.'
          : 'O seu pedido já foi aprovado, mas a senha de ativação ainda não está disponível. Aguarde o email da MA-CODE antes de tentar entrar.'

      case 'rejected':
        return 'O pedido de acesso desta conta não foi aprovado. Contacte a MA-CODE se necessitar de esclarecimentos.'

      default:
        return null
    }
  } catch {
    /*
     * A consulta do estado é apenas uma melhoria da mensagem de erro.
     * Se estiver indisponível, mantemos o erro original do login.
     */
    return null
  }
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
  try {
    return await postJson<MAProfessorAccessResponse>(
      '/login',
      {
        email,
        password,
        deviceId
      }
    )
  } catch (
    error
  ) {
    if (
      error instanceof Error &&
      error.message ===
        MISSING_ACTIVE_PERIOD_MESSAGE
    ) {
      const firstActivationMessage =
        await getFirstActivationMessage(
          email
        )

      if (
        firstActivationMessage
      ) {
        throw new Error(
          firstActivationMessage
        )
      }
    }

    throw error
  }
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
