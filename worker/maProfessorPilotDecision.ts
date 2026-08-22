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

type JsonObject =
  Record<string, unknown>

interface MAProfessorEmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

export interface MAProfessorDecisionEmailEnv {
  RESEND_API_KEY_MA_PROFESSOR?: string
}

type MAProfessorDecisionEnv =
  MaProfessorAccessEnv &
  MAProfessorDecisionEmailEnv

const RESEND_EMAIL_API_URL =
  'https://api.resend.com/emails'

const MA_PROFESSOR_ACCESS_URL =
  'https://ma-code.pt/produtos/ma-professor'

const MA_PROFESSOR_ACTIVATION_URL =
  `${MA_PROFESSOR_ACCESS_URL}?acesso=ativar`

const MA_PROFESSOR_EMAIL_ADDRESS =
  'acesso@professor.ma-code.pt'

const MA_PROFESSOR_EMAIL_NAME =
  'MA-Professor | MA-CODE'

const responseHeaders = {
  'Content-Type':
    'application/json; charset=utf-8',
  'Cache-Control':
    'no-store',
  Pragma:
    'no-cache',
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
      headers:
        responseHeaders
    }
  )
}

async function readResponseJson(
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

function escapeHtml(
  value: string
) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getGeneratedCredential(
  body: JsonObject | null
) {
  const credential =
    body?.credential

  if (
    !credential ||
    typeof credential !==
      'object' ||
    Array.isArray(credential)
  ) {
    return null
  }

  const data =
    credential as JsonObject

  if (
    typeof data.email !==
      'string' ||
    typeof data.password !==
      'string' ||
    !data.password ||
    typeof data.hasCredential !==
      'boolean'
  ) {
    return null
  }

  return {
    email:
      data.email,
    password:
      data.password,
    hasCredential:
      data.hasCredential,
    createdAt:
      typeof data.createdAt ===
        'string' ||
      data.createdAt === null
        ? data.createdAt
        : null,
    updatedAt:
      typeof data.updatedAt ===
        'string' ||
      data.updatedAt === null
        ? data.updatedAt
        : null
  }
}

function getRequestSummary(
  body: JsonObject | null
) {
  const request =
    body?.request

  return request &&
    typeof request ===
      'object' &&
    !Array.isArray(request)
      ? request
      : undefined
}

function getRequestStatus(
  body: JsonObject | null
):
  | 'pending'
  | 'approved'
  | 'rejected'
  | null {
  const request =
    getRequestSummary(
      body
    )

  if (!request) {
    return null
  }

  const status =
    (request as JsonObject)
      .status

  return status ===
      'pending' ||
    status ===
      'approved' ||
    status ===
      'rejected'
    ? status
    : null
}

function getDecisionMode(
  body: JsonObject | null
): MAProfessorDecisionMode | null {
  const directMode =
    body?.decisionMode

  if (
    directMode ===
      'pilot' ||
    directMode ===
      'commercial'
  ) {
    return directMode
  }

  const request =
    getRequestSummary(
      body
    )

  if (!request) {
    return null
  }

  const requestMode =
    (request as JsonObject)
      .decisionMode

  return requestMode ===
      'pilot' ||
    requestMode ===
      'commercial'
    ? requestMode
    : null
}

function getEmailDispatchStatus(
  body: JsonObject | null
): MAProfessorEmailDispatchStatus | null {
  const directStatus =
    body?.emailDispatchStatus

  if (
    directStatus ===
      'not_applicable' ||
    directStatus ===
      'not_configured' ||
    directStatus ===
      'pending' ||
    directStatus ===
      'sent' ||
    directStatus ===
      'failed'
  ) {
    return directStatus
  }

  const request =
    getRequestSummary(
      body
    )

  if (!request) {
    return null
  }

  const requestStatus =
    (request as JsonObject)
      .emailDispatchStatus

  return requestStatus ===
      'not_applicable' ||
    requestStatus ===
      'not_configured' ||
    requestStatus ===
      'pending' ||
    requestStatus ===
      'sent' ||
    requestStatus ===
      'failed'
    ? requestStatus
    : null
}

function buildRetryMessage(
  decision:
    | 'approve'
    | 'reject',
  mode: MAProfessorDecisionMode,
  status: MAProfessorEmailDispatchStatus
) {
  if (
    mode ===
      'commercial' ||
    status ===
      'not_applicable'
  ) {
    return decision ===
      'approve'
      ? 'Este pedido comercial já estava aprovado. Mantém-se o fluxo comercial existente para validação de pagamento e emissão da senha de ativação.'
      : 'Este pedido comercial já estava rejeitado.'
  }

  if (
    status ===
    'sent'
  ) {
    return decision ===
      'approve'
      ? 'Este pedido piloto já estava aprovado e o envio automático anterior está registado como enviado. Não foi gerada uma nova senha de ativação.'
      : 'Este pedido piloto já estava rejeitado e o email de decisão anterior está registado como enviado.'
  }

  if (
    status ===
    'failed'
  ) {
    return decision ===
      'approve'
      ? 'Este pedido piloto já estava aprovado, mas o envio automático anterior ficou registado como falhado. Consulte a ficha da conta antes de gerar uma nova senha de ativação.'
      : 'Este pedido piloto já estava rejeitado, mas o envio automático anterior ficou registado como falhado.'
  }

  if (
    status ===
    'not_configured'
  ) {
    return decision ===
      'approve'
      ? 'Este pedido piloto já estava aprovado, mas o envio automático não estava configurado. Consulte a ficha da conta para emitir a senha de ativação manualmente.'
      : 'Este pedido piloto já estava rejeitado, mas o envio automático não estava configurado.'
  }

  return decision ===
    'approve'
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

    const body =
      await readResponseJson(
        response
      )

    if (!response.ok) {
      console.error(
        'MA-Professor email dispatch status update failed',
        {
          status,
          responseStatus:
            response.status,
          message:
            typeof body?.message ===
              'string'
              ? body.message
              : 'Resposta interna inválida.'
        }
      )

      return {
        persisted:
          false as const,
        request:
          getRequestSummary(
            body
          )
      }
    }

    return {
      persisted:
        true as const,
      request:
        getRequestSummary(
          body
        )
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
      persisted:
        false as const,
      request:
        undefined
    }
  }
}

function buildApprovalEmail(
  email: string,
  password: string
): MAProfessorEmailMessage {
  const safeEmail =
    escapeHtml(email)

  const safePassword =
    escapeHtml(password)

  return {
    to:
      email,
    subject:
      'O seu acesso ao MA-Professor foi aprovado',
    text: [
      'Olá,',
      '',
      'O seu pedido de acesso gratuito à fase piloto do MA-Professor foi aprovado.',
      '',
      `Ativar acesso: ${MA_PROFESSOR_ACTIVATION_URL}`,
      `Email: ${email}`,
      `Senha de ativação: ${password}`,
      '',
      'O botão ou link de ativação abre diretamente o ecrã “Ativar acesso”. Nesse ecrã só precisa do seu email e desta senha de ativação.',
      '',
      'A sua password pessoal foi definida quando submeteu o pedido de acesso. Não é pedida novamente durante a ativação e será a password que deverá guardar para os acessos seguintes.',
      '',
      'Esta senha de ativação serve apenas para ativar o período de acesso autorizado. Não é a sua password normal de entrada no MA-Professor e não deve ser partilhada.',
      '',
      'Depois da ativação, entra normalmente com o seu email e a password pessoal. A senha de ativação deixa de ser necessária para os logins.',
      '',
      'A confirmação mensal para manutenção da vaga é um processo separado. Não utiliza esta senha de ativação e não altera a sua password pessoal.',
      '',
      'MA-Professor | MA-CODE'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
        <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">MA-Professor · Fase piloto</p>

        <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">
          O seu pedido foi aprovado
        </h1>

        <p>Olá,</p>

        <p>
          O seu pedido de <strong>acesso gratuito à fase piloto do MA-Professor</strong> foi aprovado.
        </p>

        <div style="margin:24px 0;padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">
          <p style="margin:0 0 8px;">
            <strong>Email:</strong> ${safeEmail}
          </p>

          <p style="margin:0;">
            <strong>Senha de ativação:</strong>
            <span style="font-family:monospace;">${safePassword}</span>
          </p>
        </div>

        <p style="margin:24px 0;">
          <a
            href="${MA_PROFESSOR_ACTIVATION_URL}"
            style="display:inline-block;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
          >
            Ativar acesso
          </a>
        </p>

        <p>
          O botão abre diretamente o ecrã <strong>“Ativar acesso”</strong>. Nesse ecrã só precisa do seu email e desta senha de ativação.
        </p>

        <p style="color:#475569;font-size:14px;">
          A sua <strong>password pessoal</strong> foi definida quando submeteu o pedido de acesso. Não é pedida novamente durante a ativação e será a password que deverá guardar para os acessos seguintes.
        </p>

        <p style="color:#475569;font-size:14px;">
          Esta senha serve <strong>apenas para ativar o período de acesso autorizado</strong>. Não é a sua password normal de entrada no MA-Professor e não deve ser partilhada.
        </p>

        <p style="color:#475569;font-size:14px;">
          Depois da ativação, entra normalmente com o seu email e a <strong>password pessoal</strong>. A senha de ativação deixa de ser necessária para os logins.
        </p>

        <p style="color:#475569;font-size:14px;">
          A confirmação mensal para manutenção da vaga é um processo separado. Não utiliza esta senha de ativação e não altera a sua password pessoal.
        </p>

        <p style="margin-top:28px;">
          MA-Professor | MA-CODE
        </p>
      </div>
    `
  }
}

function buildRejectionEmail(
  email: string
): MAProfessorEmailMessage {
  return {
    to:
      email,
    subject:
      'Decisão sobre o seu pedido ao MA-Professor',
    text: [
      'Olá,',
      '',
      'Agradecemos o seu interesse no MA-Professor.',
      '',
      'O seu pedido não foi aprovado nesta fase.',
      '',
      'O piloto decorre com um número limitado de vagas para permitir um acompanhamento próximo dos docentes participantes.',
      '',
      'Obrigado pelo interesse e pela disponibilidade para conhecer o projeto.',
      '',
      'MA-Professor | MA-CODE'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
        <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">
          MA-Professor · Fase piloto
        </p>

        <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">
          Decisão sobre o seu pedido
        </h1>

        <p>Olá,</p>

        <p>
          Agradecemos o seu interesse no MA-Professor.
        </p>

        <p>
          O seu pedido <strong>não foi aprovado nesta fase</strong>.
        </p>

        <p>
          O piloto decorre com um número limitado de vagas para permitir um acompanhamento próximo dos docentes participantes.
        </p>

        <p>
          Obrigado pelo interesse e pela disponibilidade para conhecer o projeto.
        </p>

        <p style="margin-top:28px;">
          MA-Professor | MA-CODE
        </p>
      </div>
    `
  }
}

function getResendApiKey(
  env: MAProfessorDecisionEnv
) {
  return (
    env.RESEND_API_KEY_MA_PROFESSOR ||
    ''
  ).trim()
}

async function getResendErrorMessage(
  response: Response
) {
  const body =
    await readResponseJson(
      response
    )

  const message =
    body?.message

  return typeof message ===
    'string' &&
    message.trim()
      ? message.trim()
      : `Resend devolveu HTTP ${response.status}.`
}

async function sendMAProfessorEmail(
  env: MAProfessorDecisionEnv,
  message: MAProfessorEmailMessage
) {
  const apiKey =
    getResendApiKey(env)

  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY_MA_PROFESSOR não está configurada.'
    )
  }

  const response =
    await fetch(
      RESEND_EMAIL_API_URL,
      {
        method:
          'POST',
        headers: {
          Authorization:
            `Bearer ${apiKey}`,
          'Content-Type':
            'application/json',
          Accept:
            'application/json'
        },
        body:
          JSON.stringify({
            from:
              `${MA_PROFESSOR_EMAIL_NAME} <${MA_PROFESSOR_EMAIL_ADDRESS}>`,
            to: [
              message.to
            ],
            subject:
              message.subject,
            html:
              message.html,
            text:
              message.text
          })
      }
    )

  if (!response.ok) {
    throw new Error(
      await getResendErrorMessage(
        response
      )
    )
  }

  const body =
    await readResponseJson(
      response
    )

  const messageId =
    body?.id

  if (
    typeof messageId !==
      'string' ||
    !messageId
  ) {
    throw new Error(
      'O Resend aceitou o pedido, mas não devolveu o identificador do email.'
    )
  }

  return messageId
}

export async function processMAProfessorAccessDecision(
  env: MAProfessorDecisionEnv,
  email: string,
  decision:
    | 'approve'
    | 'reject'
) {
  const decisionResponse =
    await decideMAProfessorAccessRequest(
      env,
      email,
      decision
    )

  const decisionBody =
    await readResponseJson(
      decisionResponse
    )

  if (!decisionResponse.ok) {
    if (
      decisionResponse.status ===
      409
    ) {
      const request =
        getRequestSummary(
          decisionBody
        )

      const mode =
        getDecisionMode(
          decisionBody
        )

      const emailDispatchStatus =
        getEmailDispatchStatus(
          decisionBody
        )

      const persistedStatus =
        getRequestStatus(
          decisionBody
        )

      const expectedStatus =
        decision ===
          'approve'
          ? 'approved'
          : 'rejected'

      if (
        request &&
        mode &&
        emailDispatchStatus &&
        persistedStatus ===
          expectedStatus
      ) {
        return json({
          success: true,
          message:
            buildRetryMessage(
              decision,
              mode,
              emailDispatchStatus
            ),
          request,
          emailDelivery:
            emailDispatchStatus,
          credentialIssued:
            decision ===
              'approve' &&
            emailDispatchStatus ===
              'sent'
        })
      }
    }

    return decisionResponse
  }

  const request =
    getRequestSummary(
      decisionBody
    )

  const mode =
    getDecisionMode(
      decisionBody
    )

  const initialDispatchStatus =
    getEmailDispatchStatus(
      decisionBody
    )

  if (!mode) {
    return json({
      success: true,
      message:
        decision ===
          'approve'
          ? 'Pedido aprovado, mas o modo do acesso não ficou disponível na resposta persistida. Nenhuma senha de ativação foi gerada automaticamente.'
          : 'Pedido rejeitado, mas o modo do acesso não ficou disponível na resposta persistida. Nenhum email foi enviado automaticamente.',
      request,
      emailDelivery:
        initialDispatchStatus ??
        'pending',
      credentialIssued:
        false
    })
  }

  if (
    mode ===
    'commercial'
  ) {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido comercial aprovado. Mantém-se o fluxo comercial existente para validação de pagamento e emissão da senha de ativação.'
          : 'Pedido comercial rejeitado.',
      request,
      emailDelivery:
        'not_applicable',
      credentialIssued:
        false
    })
  }

  if (!getResendApiKey(env)) {
    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        'not_configured'
      )

    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido piloto aprovado. O envio automático por Resend ainda não está configurado; gere e envie a senha de ativação manualmente através da ficha da conta.'
          : 'Pedido piloto rejeitado. O envio automático por Resend ainda não está configurado.',
      request:
        persisted.request ??
        request,
      emailDelivery:
        'not_configured',
      credentialIssued:
        false
    })
  }

  if (decision === 'reject') {
    try {
      await sendMAProfessorEmail(
        env,
        buildRejectionEmail(
          email
        )
      )

      const persisted =
        await persistEmailDispatchStatus(
          env,
          email,
          'sent'
        )

      return json({
        success: true,
        message:
          'Pedido piloto rejeitado e email de decisão enviado ao professor através do Resend.',
        request:
          persisted.request ??
          request,
        emailDelivery:
          'sent',
        credentialIssued:
          false
      })
    } catch (emailError) {
      console.error(
        'MA-Professor rejection email failed',
        {
          provider:
            'resend',
          message:
            emailError instanceof Error
              ? emailError.message
              : String(emailError)
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
          'Pedido piloto rejeitado, mas não foi possível enviar o email de decisão. A decisão ficou guardada no sistema.',
        request:
          persisted.request ??
          request,
        emailDelivery:
          'failed',
        credentialIssued:
          false
      })
    }
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
      request:
        persisted.request ??
        request,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  const credentialBody =
    await readResponseJson(
      credentialResponse
    )

  const credential =
    credentialResponse.ok
      ? getGeneratedCredential(
          credentialBody
        )
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
      request:
        persisted.request ??
        request,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  try {
    await sendMAProfessorEmail(
      env,
      buildApprovalEmail(
        email,
        credential.password
      )
    )

    const persisted =
      await persistEmailDispatchStatus(
        env,
        email,
        'sent'
      )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado, senha de ativação criada e email de ativação enviado ao professor através do Resend.',
      request:
        persisted.request ??
        request,
      emailDelivery:
        'sent',
      credentialIssued:
        true
    })
  } catch (emailError) {
    console.error(
      'MA-Professor approval email failed',
      {
        provider:
          'resend',
        message:
          emailError instanceof Error
            ? emailError.message
            : String(emailError)
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
        'Pedido piloto aprovado e senha de ativação criada, mas o email não foi enviado. Copie a senha de ativação apresentada agora e envie-a manualmente ao professor.',
      request:
        persisted.request ??
        request,
      emailDelivery:
        'failed',
      credentialIssued:
        true,
      fallbackCredential:
        credential
    })
  }
}
