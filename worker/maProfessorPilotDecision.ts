import {
  decideMAProfessorAccessRequest,
  generateMAProfessorAdminCredential,
  updateMAProfessorAdminEmailDispatchStatus,
  type MAProfessorDecisionMode,
  type MAProfessorEmailDispatchStatus
} from './maProfessorAccessAdminBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

import {
  hasMAProfessorEmailTransport,
  sendMAProfessorPilotApprovalEmail,
  sendMAProfessorPilotRejectionEmail,
  type MAProfessorEmailDeliveryResult,
  type MAProfessorEmailEnv
} from './maProfessorEmailService'

type JsonObject = Record<string, unknown>

export interface MAProfessorDecisionEmailEnv
  extends MAProfessorEmailEnv {}

type MAProfessorDecisionEnv =
  MaProfessorAccessEnv &
  MAProfessorDecisionEmailEnv

const responseHeaders = {
  'Content-Type':
    'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow'
}

function json(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: responseHeaders
    }
  )
}

async function readResponseJson(
  response: Response
): Promise<JsonObject | null> {
  try {
    const value = await response.clone().json()
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as JsonObject
  } catch {
    return null
  }
}

function getRequestSummary(
  body: JsonObject | null
) {
  const request = body?.request
  return request &&
    typeof request === 'object' &&
    !Array.isArray(request)
    ? request
    : undefined
}

function getRequestStatus(
  body: JsonObject | null
): 'pending' | 'approved' | 'rejected' | null {
  const request = getRequestSummary(body)
  if (!request) return null
  const status = (request as JsonObject).status
  return status === 'pending' ||
    status === 'approved' ||
    status === 'rejected'
    ? status
    : null
}

function getDecisionMode(
  body: JsonObject | null
): MAProfessorDecisionMode | null {
  const directMode = body?.decisionMode

  if (
    directMode === 'pilot' ||
    directMode === 'commercial'
  ) {
    return directMode
  }

  const request = getRequestSummary(body)
  if (!request) return null

  const requestMode =
    (request as JsonObject).decisionMode

  return requestMode === 'pilot' ||
    requestMode === 'commercial'
    ? requestMode
    : null
}

function getEmailDispatchStatus(
  body: JsonObject | null
): MAProfessorEmailDispatchStatus | null {
  const directStatus = body?.emailDispatchStatus

  if (
    directStatus === 'not_applicable' ||
    directStatus === 'not_configured' ||
    directStatus === 'pending' ||
    directStatus === 'sent' ||
    directStatus === 'failed'
  ) {
    return directStatus
  }

  const request = getRequestSummary(body)
  if (!request) return null

  const status =
    (request as JsonObject).emailDispatchStatus

  return status === 'not_applicable' ||
    status === 'not_configured' ||
    status === 'pending' ||
    status === 'sent' ||
    status === 'failed'
    ? status
    : null
}

function getGeneratedCredential(
  body: JsonObject | null
) {
  const credential = body?.credential

  if (
    !credential ||
    typeof credential !== 'object' ||
    Array.isArray(credential)
  ) {
    return null
  }

  const data = credential as JsonObject

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

function buildRetryMessage(
  decision: 'approve' | 'reject',
  mode: MAProfessorDecisionMode,
  status: MAProfessorEmailDispatchStatus
) {
  if (
    mode === 'commercial' ||
    status === 'not_applicable'
  ) {
    return decision === 'approve'
      ? 'Este pedido comercial já estava aprovado. Mantém-se o fluxo comercial existente para validação de pagamento e emissão da senha de ativação.'
      : 'Este pedido comercial já estava rejeitado.'
  }

  if (status === 'sent') {
    return decision === 'approve'
      ? 'Este pedido piloto já estava aprovado e o envio automático anterior está registado como enviado. Não foi gerada uma nova senha de ativação.'
      : 'Este pedido piloto já estava rejeitado e o email de decisão anterior está registado como enviado.'
  }

  if (status === 'failed') {
    return decision === 'approve'
      ? 'Este pedido piloto já estava aprovado, mas o envio automático anterior ficou registado como falhado. Consulte a ficha da conta antes de gerar uma nova senha de ativação.'
      : 'Este pedido piloto já estava rejeitado, mas o envio automático anterior ficou registado como falhado.'
  }

  if (status === 'not_configured') {
    return decision === 'approve'
      ? 'Este pedido piloto já estava aprovado, mas o envio automático não estava configurado. Consulte a ficha da conta para emitir a senha de ativação manualmente.'
      : 'Este pedido piloto já estava rejeitado, mas o envio automático não estava configurado.'
  }

  return decision === 'approve'
    ? 'Este pedido piloto já estava aprovado. O resultado do envio automático anterior continua por confirmar, por isso não foi gerada nem enviada uma nova senha de ativação.'
    : 'Este pedido piloto já estava rejeitado. O resultado do envio automático anterior continua por confirmar.'
}

async function persistEmailDispatchStatus(
  env: MAProfessorDecisionEnv,
  email: string,
  status: MAProfessorEmailDispatchStatus
) {
  try {
    const response =
      await updateMAProfessorAdminEmailDispatchStatus(
        env,
        email,
        status
      )

    const body = await readResponseJson(response)

    if (!response.ok) {
      console.error(
        'MA-Professor email dispatch status update failed',
        {
          status,
          responseStatus: response.status,
          message:
            typeof body?.message === 'string'
              ? body.message
              : 'Resposta interna inválida.'
        }
      )
    }

    return {
      persisted: response.ok,
      request: getRequestSummary(body)
    }
  } catch (error) {
    console.error(
      'MA-Professor email dispatch status update failed',
      {
        status,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return {
      persisted: false,
      request: undefined
    }
  }
}

function toPersistedStatus(
  result: MAProfessorEmailDeliveryResult
): MAProfessorEmailDispatchStatus {
  if (result.status === 'sent') return 'sent'
  if (result.status === 'not_configured') {
    return 'not_configured'
  }
  return 'failed'
}

export async function processMAProfessorAccessDecision(
  env: MAProfessorDecisionEnv,
  email: string,
  decision: 'approve' | 'reject'
) {
  const decisionResponse =
    await decideMAProfessorAccessRequest(
      env,
      email,
      decision
    )

  const decisionBody =
    await readResponseJson(decisionResponse)

  if (!decisionResponse.ok) {
    if (decisionResponse.status === 409) {
      const request = getRequestSummary(decisionBody)
      const mode = getDecisionMode(decisionBody)
      const dispatchStatus =
        getEmailDispatchStatus(decisionBody)
      const persistedStatus =
        getRequestStatus(decisionBody)
      const expectedStatus =
        decision === 'approve'
          ? 'approved'
          : 'rejected'

      if (
        request &&
        mode &&
        dispatchStatus &&
        persistedStatus === expectedStatus
      ) {
        return json({
          success: true,
          message:
            buildRetryMessage(
              decision,
              mode,
              dispatchStatus
            ),
          request,
          emailDelivery: dispatchStatus,
          credentialIssued:
            decision === 'approve' &&
            dispatchStatus === 'sent'
        })
      }
    }

    return decisionResponse
  }

  const request = getRequestSummary(decisionBody)
  const mode = getDecisionMode(decisionBody)
  const initialDispatchStatus =
    getEmailDispatchStatus(decisionBody)

  if (!mode) {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido aprovado, mas o modo do acesso não ficou disponível na resposta persistida. Nenhuma senha de ativação foi gerada automaticamente.'
          : 'Pedido rejeitado, mas o modo do acesso não ficou disponível na resposta persistida. Nenhum email foi enviado automaticamente.',
      request,
      emailDelivery:
        initialDispatchStatus ?? 'pending',
      credentialIssued: false
    })
  }

  if (mode === 'commercial') {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido comercial aprovado. A ativação será enviada automaticamente depois de o pagamento ser confirmado ou dispensado.'
          : 'Pedido comercial rejeitado.',
      request,
      emailDelivery: 'not_applicable',
      credentialIssued: false
    })
  }

  if (decision === 'reject') {
    if (!hasMAProfessorEmailTransport(env)) {
      const persisted =
        await persistEmailDispatchStatus(
          env,
          email,
          'not_configured'
        )

      return json({
        success: true,
        message:
          'Pedido piloto rejeitado. O envio automático por Resend ainda não está configurado.',
        request: persisted.request ?? request,
        emailDelivery: 'not_configured',
        credentialIssued: false
      })
    }

    const result =
      await sendMAProfessorPilotRejectionEmail(
        env,
        email
      )

    const dispatchStatus =
      toPersistedStatus(result)

    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        dispatchStatus
      )

    if (result.status === 'sent') {
      return json({
        success: true,
        message:
          'Pedido piloto rejeitado e email de decisão enviado ao professor através do Resend.',
        request: persisted.request ?? request,
        emailDelivery: 'sent',
        credentialIssued: false
      })
    }

    console.error(
      'MA-Professor rejection email failed',
      {
        provider: 'resend',
        status: result.status,
        message:
          result.error || 'Falha desconhecida.'
      }
    )

    return json({
      success: true,
      message:
        'Pedido piloto rejeitado, mas não foi possível enviar o email de decisão. A decisão ficou guardada no sistema.',
      request: persisted.request ?? request,
      emailDelivery: dispatchStatus,
      credentialIssued: false
    })
  }

  let credentialResponse: Response

  try {
    credentialResponse =
      await generateMAProfessorAdminCredential(
        env,
        email
      )
  } catch (credentialError) {
    console.error(
      'MA-Professor automatic pilot credential generation failed',
      {
        message:
          credentialError instanceof Error
            ? credentialError.message
            : String(credentialError)
      }
    )

    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        'failed'
      )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado, mas não foi possível gerar automaticamente a senha de ativação. Pode tentar gerar uma nova senha de ativação manualmente na ficha da conta.',
      request: persisted.request ?? request,
      emailDelivery: 'failed',
      credentialIssued: false
    })
  }

  const credentialBody =
    await readResponseJson(credentialResponse)

  const credential =
    credentialResponse.ok
      ? getGeneratedCredential(credentialBody)
      : null

  if (!credential) {
    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        'failed'
      )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado, mas não foi possível obter a nova senha de ativação para envio automático. Pode gerar uma nova senha de ativação manualmente na ficha da conta.',
      request: persisted.request ?? request,
      emailDelivery: 'failed',
      credentialIssued: false
    })
  }

  if (!hasMAProfessorEmailTransport(env)) {
    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        'not_configured'
      )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado e senha de ativação criada. O envio automático por Resend ainda não está configurado; copie a senha apresentada agora e envie-a manualmente ao professor.',
      request: persisted.request ?? request,
      emailDelivery: 'not_configured',
      credentialIssued: true,
      fallbackCredential: credential
    })
  }

  const result =
    await sendMAProfessorPilotApprovalEmail(
      env,
      email,
      credential.password
    )

  const dispatchStatus =
    toPersistedStatus(result)

  const persisted =
    await persistEmailDispatchStatus(
      env,
      email,
      dispatchStatus
    )

  if (result.status === 'sent') {
    return json({
      success: true,
      message:
        'Pedido piloto aprovado, senha de ativação criada e email de ativação enviado ao professor através do Resend.',
      request: persisted.request ?? request,
      emailDelivery: 'sent',
      credentialIssued: true
    })
  }

  console.error(
    'MA-Professor approval email failed',
    {
      provider: 'resend',
      status: result.status,
      message:
        result.error || 'Falha desconhecida.'
    }
  )

  return json({
    success: true,
    message:
      'Pedido piloto aprovado e senha de ativação criada, mas o email não foi enviado. Copie a senha de ativação apresentada agora e envie-a manualmente ao professor.',
    request: persisted.request ?? request,
    emailDelivery: dispatchStatus,
    credentialIssued: true,
    fallbackCredential: credential
  })
}
