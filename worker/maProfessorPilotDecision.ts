import {
  decideMAProfessorAccessRequest,
  generateMAProfessorAdminCredential,
  getMAProfessorAdminCommercialStatus
} from './maProfessorAccessAdminBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

type JsonObject =
  Record<string, unknown>

interface MAProfessorEmailAddress {
  email: string
  name?: string
}

interface MAProfessorEmailMessage {
  to:
    | string
    | MAProfessorEmailAddress
  from:
    | string
    | MAProfessorEmailAddress
  subject: string
  html?: string
  text?: string
  replyTo?:
    | string
    | MAProfessorEmailAddress
}

interface MAProfessorEmailSendResult {
  messageId: string
}

interface MAProfessorEmailBinding {
  send(
    message: MAProfessorEmailMessage
  ): Promise<MAProfessorEmailSendResult>
}

export interface MAProfessorDecisionEmailEnv {
  MA_PROFESSOR_EMAIL?:
    MAProfessorEmailBinding
}

type MAProfessorDecisionEnv =
  MaProfessorAccessEnv &
  MAProfessorDecisionEmailEnv

const MA_PROFESSOR_ACCESS_URL =
  'https://ma-code.pt/produtos/ma-professor'

const MA_PROFESSOR_EMAIL_ADDRESS =
  'acesso@ma-code.pt'

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

function getAuthorizationId(
  body: JsonObject | null
) {
  const commerce =
    body?.commerce

  if (
    !commerce ||
    typeof commerce !==
      'object' ||
    Array.isArray(commerce)
  ) {
    return null
  }

  const authorizationId =
    (commerce as JsonObject)
      .authorizationId

  return typeof authorizationId ===
    'string' &&
    authorizationId
      ? authorizationId
      : null
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
    from: {
      email:
        MA_PROFESSOR_EMAIL_ADDRESS,
      name:
        MA_PROFESSOR_EMAIL_NAME
    },
    replyTo: {
      email:
        MA_PROFESSOR_EMAIL_ADDRESS,
      name:
        MA_PROFESSOR_EMAIL_NAME
    },
    subject:
      'O seu acesso ao MA-Professor foi aprovado',
    text: [
      'Olá,',
      '',
      'O seu pedido de acesso gratuito à fase piloto do MA-Professor foi aprovado.',
      '',
      `Aceda a: ${MA_PROFESSOR_ACCESS_URL}`,
      `Email: ${email}`,
      `Senha de acesso: ${password}`,
      '',
      'Na página do MA-Professor, escolha “Já tenho acesso” e introduza o email e a senha acima.',
      '',
      'A senha é pessoal. Não a partilhe.',
      '',
      'Durante a fase piloto poderá ser solicitada uma confirmação periódica para manutenção da vaga.',
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
            <strong>Senha de acesso:</strong>
            <span style="font-family:monospace;">${safePassword}</span>
          </p>
        </div>

        <p style="margin:24px 0;">
          <a
            href="${MA_PROFESSOR_ACCESS_URL}"
            style="display:inline-block;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
          >
            Aceder ao MA-Professor
          </a>
        </p>

        <p>
          Na página, escolha <strong>“Já tenho acesso”</strong> e introduza o email e a senha acima.
        </p>

        <p style="color:#475569;font-size:14px;">
          A senha é pessoal. Não a partilhe.
        </p>

        <p style="color:#475569;font-size:14px;">
          Durante a fase piloto poderá ser solicitada uma confirmação periódica para manutenção da vaga.
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
    from: {
      email:
        MA_PROFESSOR_EMAIL_ADDRESS,
      name:
        MA_PROFESSOR_EMAIL_NAME
    },
    replyTo: {
      email:
        MA_PROFESSOR_EMAIL_ADDRESS,
      name:
        MA_PROFESSOR_EMAIL_NAME
    },
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

async function getCommercialMode(
  env: MAProfessorDecisionEnv,
  email: string
) {
  try {
    const response =
      await getMAProfessorAdminCommercialStatus(
        env,
        email
      )

    const body =
      await readResponseJson(
        response
      )

    if (!response.ok) {
      return {
        known: false,
        commercial: false
      }
    }

    return {
      known: true,
      commercial:
        Boolean(
          getAuthorizationId(
            body
          )
        )
    }
  } catch {
    return {
      known: false,
      commercial: false
    }
  }
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

  if (!decisionResponse.ok) {
    return decisionResponse
  }

  const decisionBody =
    await readResponseJson(
      decisionResponse
    )

  const request =
    getRequestSummary(
      decisionBody
    )

  const mode =
    await getCommercialMode(
      env,
      email
    )

  if (!mode.known) {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido aprovado. Não foi possível determinar com segurança se o acesso é piloto ou comercial, pelo que nenhuma senha foi gerada automaticamente.'
          : 'Pedido rejeitado. Não foi possível determinar com segurança a modalidade do acesso para enviar a comunicação automática.',
      request,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  if (mode.commercial) {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido comercial aprovado. Mantém-se o fluxo comercial existente para validação de pagamento e emissão da senha.'
          : 'Pedido comercial rejeitado.',
      request,
      emailDelivery:
        'not_applicable',
      credentialIssued:
        false
    })
  }

  if (!env.MA_PROFESSOR_EMAIL) {
    return json({
      success: true,
      message:
        decision === 'approve'
          ? 'Pedido piloto aprovado. O envio automático de email ainda não está configurado; gere e envie a senha manualmente através da ficha da conta.'
          : 'Pedido piloto rejeitado. O envio automático de email ainda não está configurado.',
      request,
      emailDelivery:
        'not_configured',
      credentialIssued:
        false
    })
  }

  if (decision === 'reject') {
    try {
      await env.MA_PROFESSOR_EMAIL.send(
        buildRejectionEmail(
          email
        )
      )

      return json({
        success: true,
        message:
          'Pedido piloto rejeitado e email de decisão enviado ao professor.',
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
          message:
            emailError instanceof Error
              ? emailError.message
              : String(emailError)
        }
      )

      return json({
        success: true,
        message:
          'Pedido piloto rejeitado, mas não foi possível enviar o email de decisão. A decisão ficou guardada no sistema.',
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

    return json({
      success: true,
      message:
        'Pedido piloto aprovado, mas não foi possível gerar automaticamente a senha. Pode tentar gerar a senha manualmente na ficha da conta.',
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
    return json({
      success: true,
      message:
        'Pedido piloto aprovado, mas não foi possível obter a nova senha para envio automático. Pode gerar a senha manualmente na ficha da conta.',
      request,
      emailDelivery:
        'failed',
      credentialIssued:
        false
    })
  }

  try {
    await env.MA_PROFESSOR_EMAIL.send(
      buildApprovalEmail(
        email,
        credential.password
      )
    )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado, senha criada e email de acesso enviado ao professor.',
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
        message:
          emailError instanceof Error
            ? emailError.message
            : String(emailError)
      }
    )

    return json({
      success: true,
      message:
        'Pedido piloto aprovado e senha criada, mas o email não foi enviado. Copie a senha apresentada agora e envie-a manualmente ao professor.',
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
