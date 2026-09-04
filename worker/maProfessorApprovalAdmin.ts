import {
  handleMaCodeAdminApiRequest
} from './maCodeAdmin'

import {
  confirmMAProfessorAdminPayment,
  generateMAProfessorAdminCredential
} from './maProfessorAccessAdminBridge'

import {
  prepareMAProfessorAdminApprovalPlan,
  type MAProfessorApprovalPlan
} from './maProfessorApprovalPlanBridge'

import {
  processMAProfessorAccessDecision
} from './maProfessorPilotDecision'

import {
  sendMAProfessorCommercialActivationEmail
} from './maProfessorEmailService'

import type {
  MaProfessorAdminEnv
} from './maProfessorAdminFixed'

export const MA_PROFESSOR_APPROVE_PLAN_PATH =
  '/api/admin/ma-professor/requests/approve-plan'

type JsonObject =
  Record<string, unknown>

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
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders
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
    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(
      new URL(origin).hostname
    )
  } catch {
    return false
  }
}

function isAllowedBrowserRequest(
  request: Request
) {
  const requestOrigin =
    new URL(request.url).origin

  const candidate =
    normalizeOrigin(
      request.headers.get('Origin') || ''
    ) ||
    normalizeOrigin(
      request.headers.get('Referer') || ''
    )

  return Boolean(
    candidate &&
    (
      candidate === requestOrigin ||
      candidate === 'https://ma-code.pt' ||
      candidate === 'https://www.ma-code.pt' ||
      isLocalOrigin(candidate)
    )
  )
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

function normalizeApprovalPlan(
  value: unknown
): MAProfessorApprovalPlan | null {
  return value === 'free' ||
    value === 'paid_30_days' ||
    value === 'school_year'
    ? value
    : null
}

async function readJsonObject(
  response: Response
): Promise<JsonObject | null> {
  try {
    const value =
      await response.clone().json()

    if (
      !value ||
      typeof value !== 'object' ||
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
) {
  const contentType =
    request.headers.get(
      'content-type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    throw new Error(
      'Formato de pedido inválido.'
    )
  }

  const value =
    await request.json() as unknown

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'O pedido administrativo é inválido.'
    )
  }

  return value as JsonObject
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

  return handleMaCodeAdminApiRequest(
    new Request(
      sessionUrl.toString(),
      {
        method: 'GET',
        headers: request.headers
      }
    ),
    env
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

  const data =
    credential as JsonObject

  if (
    typeof data.email !== 'string' ||
    typeof data.password !== 'string' ||
    !data.password ||
    typeof data.hasCredential !== 'boolean'
  ) {
    return null
  }

  return {
    email: data.email,
    password: data.password,
    hasCredential: data.hasCredential,
    activationCode:
      typeof data.activationCode === 'string'
        ? data.activationCode
        : null,
    createdAt:
      typeof data.createdAt === 'string' ||
      data.createdAt === null
        ? data.createdAt
        : null,
    updatedAt:
      typeof data.updatedAt === 'string' ||
      data.updatedAt === null
        ? data.updatedAt
        : null
  }
}

export async function handleMAProfessorApprovalPlanRequest(
  request: Request,
  env: MaProfessorAdminEnv
) {
  if (
    new URL(request.url).pathname !==
      MA_PROFESSOR_APPROVE_PLAN_PATH
  ) {
    return null
  }

  if (request.method !== 'POST') {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405
    )
  }

  if (!isAllowedBrowserRequest(request)) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403
    )
  }

  const sessionResponse =
    await verifyAdminSession(
      request,
      env
    )

  if (!sessionResponse.ok) {
    return sessionResponse
  }

  let body: JsonObject

  try {
    body =
      await readRequestBody(
        request.clone()
      )
  } catch (error) {
    return json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Pedido administrativo inválido.'
      },
      400
    )
  }

  const email =
    normalizeEmail(body.email)

  const approvalPlan =
    normalizeApprovalPlan(
      body.approvalPlan
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

  if (!approvalPlan) {
    return json(
      {
        success: false,
        message:
          'Selecione uma modalidade de aprovação válida.'
      },
      400
    )
  }

  const prepared =
    await prepareMAProfessorAdminApprovalPlan(
      env,
      email,
      approvalPlan
    )

  if (!prepared.ok) {
    return prepared
  }

  const decisionResponse =
    await processMAProfessorAccessDecision(
      env,
      email,
      'approve'
    )

  if (!decisionResponse.ok) {
    return decisionResponse
  }

  if (approvalPlan === 'free') {
    return decisionResponse
  }

  const decisionBody =
    await readJsonObject(
      decisionResponse
    )

  const paymentResponse =
    await confirmMAProfessorAdminPayment(
      env,
      email
    )

  if (!paymentResponse.ok) {
    return paymentResponse
  }

  const paymentBody =
    await readJsonObject(
      paymentResponse
    )

  let credentialResponse: Response

  try {
    credentialResponse =
      await generateMAProfessorAdminCredential(
        env,
        email
      )
  } catch (error) {
    console.error(
      'MA-Professor unified approval credential generation failed',
      {
        email,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json({
      success: true,
      message:
        'O pedido e o pagamento foram aprovados, mas não foi possível gerar automaticamente a senha de ativação. Utilize a ficha da conta para voltar a tentar.',
      request:
        decisionBody?.request,
      commerce:
        paymentBody?.commerce,
      approvalPlan,
      emailDelivery: 'failed',
      credentialIssued: false
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
    return json({
      success: true,
      message:
        'O pedido e o pagamento foram aprovados, mas a senha de ativação não ficou disponível. Utilize a ficha da conta para voltar a gerar a senha.',
      request:
        decisionBody?.request,
      commerce:
        credentialBody?.commerce ??
        paymentBody?.commerce,
      approvalPlan,
      emailDelivery: 'failed',
      credentialIssued: false
    })
  }

  const emailResult =
    await sendMAProfessorCommercialActivationEmail(
      env,
      email,
      credential.password
    )

  if (emailResult.status === 'sent') {
    return json({
      success: true,
      message:
        approvalPlan === 'school_year'
          ? 'Acesso Fundador até ao fim do ano letivo aprovado. A senha de ativação foi criada e o email de ativação foi enviado ao professor.'
          : 'Acesso Fundador de 30 dias aprovado. A senha de ativação foi criada e o email de ativação foi enviado ao professor.',
      request:
        decisionBody?.request,
      commerce:
        credentialBody?.commerce ??
        paymentBody?.commerce,
      approvalPlan,
      emailDelivery: 'sent',
      credentialIssued: true
    })
  }

  return json({
    success: true,
    message:
      'O acesso foi aprovado e a senha de ativação foi criada, mas o email não foi enviado. Copie a senha apresentada e envie-a manualmente ao professor.',
    request:
      decisionBody?.request,
    commerce:
      credentialBody?.commerce ??
      paymentBody?.commerce,
    approvalPlan,
    emailDelivery:
      emailResult.status ===
        'not_configured'
        ? 'not_configured'
        : 'failed',
    credentialIssued: true,
    fallbackCredential:
      credential
  })
}
