import {
  handleMaCodeAdminApiRequest,
  type MaCodeAdminEnv
} from './maCodeAdmin'

import {
  confirmMAProfessorAdminPayment,
  decideMAProfessorAccessRequest,
  dispenseMAProfessorAdminPayment,
  generateMAProfessorAdminCredential,
  getMAProfessorAdminCommercialStatus,
  getMAProfessorAdminCredentialStatus,
  getMAProfessorAdminOverview,
  revokeMAProfessorAdminLicense
} from './maProfessorAccessAdminBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_ADMIN_API_PREFIX =
  '/api/admin/ma-professor'

export interface MaProfessorAdminEnv
  extends MaCodeAdminEnv,
    MaProfessorAccessEnv {}

type JsonObject =
  Record<string, unknown>

type EmailAdminAction = (
  env: MaProfessorAdminEnv,
  email: string
) => Promise<Response>

const MAX_BODY_BYTES =
  2_000

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',
    Pragma:
      'no-cache',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':
      'nosniff',
    'X-Frame-Options':
      'DENY',
    'Referrer-Policy':
      'no-referrer',
    'X-Robots-Tag':
      'noindex, nofollow'
  }

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<string, string> = {}
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders,
        ...extraHeaders
      }
    }
  )
}

function normalizeOrigin(
  value: string
) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isLocalOrigin(
  origin: string
) {
  try {
    const hostname =
      new URL(origin).hostname

    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(hostname)
  } catch {
    return false
  }
}

function isAllowedBrowserRequest(
  request: Request
) {
  const requestOrigin =
    new URL(
      request.url
    ).origin

  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  const referer =
    normalizeOrigin(
      request.headers.get(
        'Referer'
      ) || ''
    )

  const candidate =
    origin || referer

  if (!candidate) {
    return false
  }

  if (
    candidate ===
      requestOrigin ||
    candidate ===
      'https://ma-code.pt' ||
    candidate ===
      'https://www.ma-code.pt'
  ) {
    return true
  }

  return isLocalOrigin(
    candidate
  )
}

function normalizeEmail(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 180)
    : ''
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

async function readJsonBody(
  request: Request
): Promise<JsonObject> {
  const contentType =
    request.headers.get(
      'content-type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes(
        'application/json'
      )
  ) {
    throw new Error(
      'Formato de pedido inválido.'
    )
  }

  const contentLength =
    Number(
      request.headers.get(
        'content-length'
      ) || 0
    )

  if (
    Number.isFinite(
      contentLength
    ) &&
    contentLength >
      MAX_BODY_BYTES
  ) {
    throw new Error(
      'O pedido é demasiado grande.'
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder()
      .encode(text)
      .byteLength >
    MAX_BODY_BYTES
  ) {
    throw new Error(
      'O pedido é demasiado grande.'
    )
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(text) as unknown
  } catch {
    throw new Error(
      'O pedido enviado não contém JSON válido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'O pedido enviado não é válido.'
    )
  }

  return parsed as JsonObject
}

async function verifyAdminSession(
  request: Request,
  env: MaProfessorAdminEnv
) {
  const sessionUrl =
    new URL(request.url)

  sessionUrl.pathname =
    '/api/admin/session'
  sessionUrl.search = ''
  sessionUrl.hash = ''

  const sessionRequest =
    new Request(
      sessionUrl.toString(),
      {
        method: 'GET',
        headers:
          request.headers
      }
    )

  return handleMaCodeAdminApiRequest(
    sessionRequest,
    env
  )
}

async function getValidatedBodyEmail(
  request: Request
) {
  const body =
    await readJsonBody(
      request
    )

  const email =
    normalizeEmail(
      body.email
    )

  if (!isValidEmail(email)) {
    throw new Error(
      'Indique um email válido.'
    )
  }

  return email
}

function getBodyErrorStatus(
  message: string
) {
  return message ===
    'O pedido é demasiado grande.'
    ? 413
    : 400
}

async function handleEmailMutation(
  request: Request,
  env: MaProfessorAdminEnv,
  action: EmailAdminAction,
  logMessage: string,
  fallbackMessage: string
) {
  if (
    request.method !==
    'POST'
  ) {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        Allow: 'POST'
      }
    )
  }

  if (
    !isAllowedBrowserRequest(
      request
    )
  ) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403
    )
  }

  let email: string

  try {
    email =
      await getValidatedBodyEmail(
        request
      )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Pedido administrativo inválido.'

    return json(
      {
        success: false,
        message
      },
      getBodyErrorStatus(
        message
      )
    )
  }

  try {
    return await action(
      env,
      email
    )
  } catch (error) {
    console.error(
      logMessage,
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json(
      {
        success: false,
        message:
          fallbackMessage
      },
      500
    )
  }
}

async function handleAccessRequestDecision(
  request: Request,
  env: MaProfessorAdminEnv,
  decision:
    'approve' |
    'reject'
) {
  return handleEmailMutation(
    request,
    env,
    (
      actionEnv,
      email
    ) =>
      decideMAProfessorAccessRequest(
        actionEnv,
        email,
        decision
      ),
    'MA-Professor admin access request decision failed',
    'Não foi possível atualizar o pedido de acesso.'
  )
}

async function handleCommercialStatus(
  request: Request,
  env: MaProfessorAdminEnv
) {
  if (
    request.method !==
    'GET'
  ) {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        Allow: 'GET'
      }
    )
  }

  const url =
    new URL(request.url)

  const email =
    normalizeEmail(
      url.searchParams.get(
        'email'
      )
    )

  if (!isValidEmail(email)) {
    return json(
      {
        success: false,
        message:
          'Indique um email válido.'
      },
      400
    )
  }

  try {
    return await getMAProfessorAdminCommercialStatus(
      env,
      email
    )
  } catch (error) {
    console.error(
      'MA-Professor admin commerce status failed',
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json(
      {
        success: false,
        message:
          'Não foi possível consultar o plano e pagamento desta conta.'
      },
      500
    )
  }
}

async function handleCredentialStatus(
  request: Request,
  env: MaProfessorAdminEnv
) {
  if (
    request.method !==
    'GET'
  ) {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        Allow: 'GET'
      }
    )
  }

  const url =
    new URL(request.url)

  const email =
    normalizeEmail(
      url.searchParams.get(
        'email'
      )
    )

  if (!isValidEmail(email)) {
    return json(
      {
        success: false,
        message:
          'Indique um email válido.'
      },
      400
    )
  }

  try {
    return await getMAProfessorAdminCredentialStatus(
      env,
      email
    )
  } catch (error) {
    console.error(
      'MA-Professor admin credential status failed',
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json(
      {
        success: false,
        message:
          'Não foi possível consultar o estado da senha.'
      },
      500
    )
  }
}

export function isMAProfessorAdminApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_ADMIN_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_ADMIN_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
) {
  const sessionResponse =
    await verifyAdminSession(
      request,
      env
    )

  if (!sessionResponse.ok) {
    return sessionResponse
  }

  const url =
    new URL(request.url)

  const action =
    url.pathname.slice(
      MA_PROFESSOR_ADMIN_API_PREFIX.length
    ) || '/'

  switch (action) {
    case '/overview': {
      if (
        request.method !==
        'GET'
      ) {
        return json(
          {
            success: false,
            message:
              'Método não permitido.'
          },
          405,
          {
            Allow: 'GET'
          }
        )
      }

      try {
        return await getMAProfessorAdminOverview(
          env
        )
      } catch (error) {
        console.error(
          'MA-Professor admin overview failed',
          {
            message:
              error instanceof Error
                ? error.message
                : String(error)
          }
        )

        return json(
          {
            success: false,
            message:
              'Não foi possível carregar os dados administrativos do MA-Professor.'
          },
          500
        )
      }
    }

    case '/requests/approve':
      return handleAccessRequestDecision(
        request,
        env,
        'approve'
      )

    case '/requests/reject':
      return handleAccessRequestDecision(
        request,
        env,
        'reject'
      )

    case '/commerce/status':
      return handleCommercialStatus(
        request,
        env
      )

    case '/commerce/select-plan':
      return json(
        {
          success: false,
          message:
            'O plano é escolhido pelo professor antes do pedido de acesso e não pode ser definido pelo MA-ADMIN no fluxo normal.'
        },
        409
      )

    case '/commerce/confirm-payment':
      return handleEmailMutation(
        request,
        env,
        confirmMAProfessorAdminPayment,
        'MA-Professor admin payment confirmation failed',
        'Não foi possível confirmar o pagamento.'
      )

    case '/commerce/dispense-payment':
      return handleEmailMutation(
        request,
        env,
        dispenseMAProfessorAdminPayment,
        'MA-Professor admin payment dispensation failed',
        'Não foi possível marcar o pagamento como dispensado.'
      )

    case '/licenses/revoke':
      return handleEmailMutation(
        request,
        env,
        revokeMAProfessorAdminLicense,
        'MA-Professor admin license revocation failed',
        'Não foi possível revogar a licença.'
      )

    case '/credentials/status':
      return handleCredentialStatus(
        request,
        env
      )

    case '/credentials/generate':
      return handleEmailMutation(
        request,
        env,
        generateMAProfessorAdminCredential,
        'MA-Professor admin credential generation failed',
        'Não foi possível gerar a senha da conta.'
      )

    default:
      return json(
        {
          success: false,
          message:
            'Endpoint administrativo do MA-Professor não encontrado.'
        },
        404
      )
  }
}
