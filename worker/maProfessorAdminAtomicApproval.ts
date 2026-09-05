import {
  handleMAProfessorAdminApiRequest as handleExistingMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv
} from './maProfessorAdminFixed'

import {
  updateMAProfessorAdminEmailDispatchStatus
} from './maProfessorAccessAdminBridge'

import {
  decideMAProfessorAccessRequestExplicitly,
  type MAProfessorExplicitApprovalPlan
} from './maProfessorExplicitApprovalBridge'

import {
  hasMAProfessorEmailTransport,
  sendMAProfessorCommercialActivationEmail,
  sendMAProfessorPilotApprovalEmail
} from './maProfessorEmailService'

export {
  isMAProfessorAdminApiPath
}

export type {
  MaProfessorAdminEnv
}

const APPROVE_PLAN_PATH =
  '/api/admin/ma-professor/requests/approve-plan'

const LEGACY_APPROVE_PATH =
  '/api/admin/ma-professor/requests/approve'

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

async function readJsonObject(
  response: Response
): Promise<JsonObject | null> {
  try {
    const value =
      await response
        .clone()
        .json()

    return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? value as JsonObject
      : null
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

    return value &&
      typeof value === 'object' &&
      !Array.isArray(value)
      ? value as JsonObject
      : null
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

function normalizeApprovalPlan(
  value: unknown
): MAProfessorExplicitApprovalPlan | null {
  return value === 'free' ||
    value === 'paid_30_days' ||
    value === 'school_year'
    ? value
    : null
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

function buildAdminProbe(
  source: Request
) {
  const url =
    new URL(source.url)

  url.pathname =
    '/api/admin/ma-professor/overview'
  url.search = ''
  url.hash = ''

  const headers =
    new Headers(source.headers)

  headers.delete(
    'Content-Type'
  )
  headers.delete(
    'Content-Length'
  )

  return new Request(
    url.toString(),
    {
      method: 'GET',
      headers
    }
  )
}

async function persistPilotEmailStatus(
  env: MaProfessorAdminEnv,
  email: string,
  status:
    | 'not_configured'
    | 'sent'
    | 'failed'
) {
  try {
    const response =
      await updateMAProfessorAdminEmailDispatchStatus(
        env,
        email,
        status
      )

    const body =
      await readJsonObject(
        response
      )

    return response.ok
      ? body?.request
      : undefined
  } catch (error) {
    console.error(
      'MA-Professor atomic approval email status update failed',
      {
        email,
        status,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return undefined
  }
}

async function completePilotApproval(
  approvalBody: JsonObject,
  env: MaProfessorAdminEnv,
  email: string,
  credential:
    ReturnType<typeof readCredential>
) {
  if (!credential) {
    return json(
      {
        success: false,
        message:
          'A aprovação não devolveu uma senha de ativação válida.',
        credentialIssued: false,
        approvalPlan: 'free'
      },
      500
    )
  }

  if (!hasMAProfessorEmailTransport(env)) {
    const request =
      await persistPilotEmailStatus(
        env,
        email,
        'not_configured'
      )

    return json({
      ...approvalBody,
      request:
        request ??
        approvalBody.request,
      message:
        'Acesso gratuito aprovado e senha criada. O email automático não está configurado; copie a senha apresentada e envie-a manualmente ao professor.',
      emailDelivery:
        'not_configured',
      credentialIssued:
        true,
      fallbackCredential:
        credential,
      approvalPlan:
        'free'
    })
  }

  const emailResult =
    await sendMAProfessorPilotApprovalEmail(
      env,
      email,
      credential.password
    )

  const dispatchStatus =
    emailResult.status === 'sent'
      ? 'sent'
      : emailResult.status ===
          'not_configured'
        ? 'not_configured'
        : 'failed'

  const request =
    await persistPilotEmailStatus(
      env,
      email,
      dispatchStatus
    )

  if (emailResult.status === 'sent') {
    return json({
      ...approvalBody,
      request:
        request ??
        approvalBody.request,
      message:
        'Acesso gratuito aprovado. A senha foi criada e o email de ativação foi enviado ao professor.',
      emailDelivery:
        'sent',
      credentialIssued:
        true,
      approvalPlan:
        'free'
    })
  }

  console.error(
    'MA-Professor atomic pilot approval email failed',
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
    ...approvalBody,
    request:
      request ??
      approvalBody.request,
    message:
      'Acesso gratuito aprovado e senha criada, mas o email não foi enviado. Copie a senha apresentada e envie-a manualmente ao professor.',
    emailDelivery:
      dispatchStatus,
    credentialIssued:
      true,
    fallbackCredential:
      credential,
    approvalPlan:
      'free'
  })
}

async function completeCommercialApproval(
  approvalBody: JsonObject,
  env: MaProfessorAdminEnv,
  email: string,
  approvalPlan:
    Exclude<
      MAProfessorExplicitApprovalPlan,
      'free'
    >,
  credential:
    ReturnType<typeof readCredential>
) {
  if (!credential) {
    return json(
      {
        success: false,
        message:
          'A aprovação comercial não devolveu uma senha de ativação válida.',
        credentialIssued: false,
        approvalPlan
      },
      500
    )
  }

  if (!hasMAProfessorEmailTransport(env)) {
    return json({
      ...approvalBody,
      message:
        'Acesso Fundador aprovado, pagamento registado e senha criada. O envio automático de email não está configurado; copie a senha apresentada e envie-a manualmente ao professor.',
      emailDelivery:
        'not_configured',
      credentialIssued:
        true,
      fallbackCredential:
        credential,
      approvalPlan
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
      ...approvalBody,
      message:
        'Acesso Fundador aprovado. O pagamento, a senha e o envio do email de ativação foram concluídos.',
      emailDelivery:
        'sent',
      credentialIssued:
        true,
      approvalPlan
    })
  }

  console.error(
    'MA-Professor atomic commercial approval email failed',
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
    ...approvalBody,
    message:
      'Acesso Fundador aprovado, pagamento registado e senha criada, mas o email não foi enviado. Copie a senha apresentada e envie-a manualmente ao professor.',
    emailDelivery:
      emailResult.status ===
        'not_configured'
        ? 'not_configured'
        : 'failed',
    credentialIssued:
      true,
    fallbackCredential:
      credential,
    approvalPlan
  })
}

async function handleAtomicApproval(
  request: Request,
  env: MaProfessorAdminEnv,
  legacy = false
) {
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

  const authResponse =
    await handleExistingMAProfessorAdminApiRequest(
      buildAdminProbe(
        request
      ),
      env
    )

  if (!authResponse ||
      !authResponse.ok) {
    return authResponse
  }

  const body =
    await readRequestBody(
      request
    )

  const email =
    normalizeEmail(
      body?.email
    )

  const approvalPlan =
    legacy
      ? 'free' as const
      : normalizeApprovalPlan(
          body?.approvalPlan
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
          'Selecione Gratuito, 30 dias ou Ano letivo.'
      },
      400
    )
  }

  const approvalResponse =
    await decideMAProfessorAccessRequestExplicitly(
      env,
      email,
      approvalPlan
    )

  if (!approvalResponse.ok) {
    return approvalResponse
  }

  const approvalBody =
    await readJsonObject(
      approvalResponse
    )

  if (
    !approvalBody ||
    approvalBody.success !== true
  ) {
    return json(
      {
        success: false,
        message:
          'A operação de aprovação devolveu uma resposta inválida.'
      },
      500
    )
  }

  const credential =
    readCredential(
      approvalBody
    )

  if (approvalPlan === 'free') {
    return completePilotApproval(
      approvalBody,
      env,
      email,
      credential
    )
  }

  return completeCommercialApproval(
    approvalBody,
    env,
    email,
    approvalPlan,
    credential
  )
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
): Promise<Response | null> {
  const pathname =
    new URL(
      request.url
    ).pathname

  if (pathname === APPROVE_PLAN_PATH) {
    return handleAtomicApproval(
      request,
      env
    )
  }

  if (pathname === LEGACY_APPROVE_PATH) {
    return handleAtomicApproval(
      request,
      env,
      true
    )
  }

  return handleExistingMAProfessorAdminApiRequest(
    request,
    env
  )
}
