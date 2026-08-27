import {
  handleMAProfessorAdminApiRequest as handleExistingMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv
} from './maProfessorAdmin'

import {
  generateMAProfessorAdminCredential
} from './maProfessorAccessAdminBridge'

import {
  hasMAProfessorEmailTransport,
  sendMAProfessorCommercialActivationEmail
} from './maProfessorEmailService'

export {
  isMAProfessorAdminApiPath
}

export type {
  MaProfessorAdminEnv
}

const CONFIRM_PAYMENT_PATH =
  '/api/admin/ma-professor/commerce/confirm-payment'

const DISPENSE_PAYMENT_PATH =
  '/api/admin/ma-professor/commerce/dispense-payment'

type JsonObject =
  Record<string, unknown>

function json(
  body: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control':
          'no-store',
        Pragma:
          'no-cache',
        'X-Content-Type-Options':
          'nosniff',
        'X-Robots-Tag':
          'noindex, nofollow'
      }
    }
  )
}

function isCommercialPaymentResolutionPath(
  pathname: string
) {
  return pathname ===
      CONFIRM_PAYMENT_PATH ||
    pathname ===
      DISPENSE_PAYMENT_PATH
}

async function readJsonObject(
  response: Response
): Promise<JsonObject | null> {
  try {
    const value =
      await response
        .clone()
        .json()

    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      return null
    }

    return value as JsonObject
  } catch {
    return null
  }
}

async function readRequestBody(
  request: Request
): Promise<JsonObject | null> {
  try {
    const value =
      await request
        .clone()
        .json()

    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      return null
    }

    return value as JsonObject
  } catch {
    return null
  }
}

function normalizeEmail(
  value: unknown
) {
  return typeof value === 'string'
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

function readCredential(
  body: JsonObject | null
) {
  const credential =
    body?.credential

  if (
    !credential ||
    typeof credential !== 'object' ||
    Array.isArray(credential)
  ) {
    return null
  }

  const value =
    credential as JsonObject

  if (
    typeof value.email !== 'string' ||
    typeof value.password !== 'string' ||
    !value.password
  ) {
    return null
  }

  return {
    ...value,
    email: value.email,
    password: value.password
  }
}

function getResolvedPaymentLabel(
  pathname: string
) {
  return pathname ===
    DISPENSE_PAYMENT_PATH
    ? 'Pagamento dispensado'
    : 'Pagamento confirmado'
}

async function completeCommercialActivation(
  request: Request,
  response: Response,
  env: MaProfessorAdminEnv
) {
  if (!response.ok) {
    return response
  }

  const responseBody =
    await readJsonObject(response)

  if (
    !responseBody ||
    responseBody.success !== true
  ) {
    return response
  }

  const requestBody =
    await readRequestBody(request)

  const email =
    normalizeEmail(
      requestBody?.email
    )

  if (!isValidEmail(email)) {
    return response
  }

  const pathname =
    new URL(request.url).pathname

  const paymentLabel =
    getResolvedPaymentLabel(pathname)

  if (!hasMAProfessorEmailTransport(env)) {
    return json({
      ...responseBody,
      message:
        `${paymentLabel}. O envio automático de email não está configurado; a senha continua disponível para geração manual no painel.`,
      emailDelivery:
        'not_configured',
      credentialIssued:
        false
    })
  }

  let credentialResponse:
    Response

  try {
    credentialResponse =
      await generateMAProfessorAdminCredential(
        env,
        email
      )
  } catch (error) {
    console.error(
      'MA-Professor commercial credential generation failed',
      {
        email,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json({
      ...responseBody,
      message:
        `${paymentLabel}, mas não foi possível gerar automaticamente a senha de ativação. Pode voltar a tentar através da ficha da conta.`,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  const credentialBody =
    await readJsonObject(
      credentialResponse
    )

  const credential =
    credentialResponse.ok
      ? readCredential(
          credentialBody
        )
      : null

  if (!credential) {
    console.error(
      'MA-Professor commercial credential generation returned no credential',
      {
        email,
        responseStatus:
          credentialResponse.status
      }
    )

    return json({
      ...responseBody,
      message:
        `${paymentLabel}, mas não foi possível obter a senha de ativação para envio automático. Consulte a ficha da conta.`,
      commerce:
        credentialBody?.commerce ??
        responseBody.commerce,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  const emailResult =
    await sendMAProfessorCommercialActivationEmail(
      env,
      email,
      credential.password
    )

  const commerce =
    credentialBody?.commerce ??
    responseBody.commerce

  if (emailResult.status === 'sent') {
    console.info(
      'MA-Professor commercial activation email sent',
      {
        email,
        responseId:
          emailResult.id || ''
      }
    )

    return json({
      ...responseBody,
      message:
        `${paymentLabel}. A senha de ativação foi criada e enviada automaticamente ao professor.`,
      commerce,
      emailDelivery:
        'sent',
      credentialIssued:
        true
    })
  }

  console.error(
    'MA-Professor commercial activation email failed',
    {
      email,
      status:
        emailResult.status,
      message:
        emailResult.error ||
        'Falha desconhecida.'
    }
  )

  return json({
    ...responseBody,
    message:
      `${paymentLabel} e senha de ativação criada, mas o email não foi enviado. Copie a senha apresentada e envie-a manualmente ao professor.`,
    commerce,
    emailDelivery:
      emailResult.status ===
        'not_configured'
        ? 'not_configured'
        : 'failed',
    credentialIssued:
      true,
    fallbackCredential:
      credential
  })
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
): Promise<Response | null> {
  const pathname =
    new URL(request.url).pathname

  if (
    !isCommercialPaymentResolutionPath(
      pathname
    )
  ) {
    return handleExistingMAProfessorAdminApiRequest(
      request,
      env
    )
  }

  const requestForCompletion =
    request.clone()

  const response =
    await handleExistingMAProfessorAdminApiRequest(
      request,
      env
    )

  return completeCommercialActivation(
    requestForCompletion,
    response,
    env
  )
}
