import {
  handleMAProfessorAdminApiRequest as handleExistingMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv
} from './maProfessorAdmin'

import {
  handleMaCodeAdminApiRequest
} from './maCodeAdmin'

import {
  decideMAProfessorAccessRequest,
  generateMAProfessorAdminCredential,
  updateMAProfessorAdminEmailDispatchStatus
} from './maProfessorAccessAdminBridge'

export {
  isMAProfessorAdminApiPath
}

export type {
  MaProfessorAdminEnv
}

const APPROVE_PATH =
  '/api/admin/ma-professor/requests/approve'

const MA_PROFESSOR_ACCESS_URL =
  'https://ma-code.pt/produtos/ma-professor'

type JsonObject =
  Record<string, unknown>

type EmailDispatchStatus =
  | 'sent'
  | 'failed'
  | 'not_configured'

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

async function readJson(
  request: Request
): Promise<JsonObject> {
  const parsed =
    await request.json()

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'Pedido inválido.'
    )
  }

  return parsed as JsonObject
}

async function readResponseJson(
  response: Response
) {
  try {
    return await response
      .clone()
      .json() as JsonObject
  } catch {
    return null
  }
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

function escapeHtml(
  value: string
) {
  return value
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    )
}

async function validateAdminSession(
  request: Request,
  env: MaProfessorAdminEnv
) {
  const sessionRequest =
    new Request(
      new URL(
        '/api/admin/session',
        request.url
      ),
      {
        method:
          'GET',
        headers:
          request.headers
      }
    )

  const response =
    await handleMaCodeAdminApiRequest(
      sessionRequest,
      env
    )

  return response?.ok ===
    true
}

async function sendApprovalEmail(
  env: MaProfessorAdminEnv,
  email: string,
  activationPassword: string
): Promise<EmailDispatchStatus> {
  const apiKey =
    typeof env
      .RESEND_API_KEY_MA_PROFESSOR ===
      'string'
      ? env
          .RESEND_API_KEY_MA_PROFESSOR
          .trim()
      : ''

  if (
    !apiKey
  ) {
    return 'not_configured'
  }

  const safeEmail =
    escapeHtml(
      email
    )

  const safePassword =
    escapeHtml(
      activationPassword
    )

  const text = [
    'Olá,',
    '',
    'O seu pedido de acesso gratuito à fase piloto do MA-Professor foi aprovado.',
    '',
    `Email: ${email}`,
    `Senha de ativação: ${activationPassword}`,
    '',
    'Esta senha serve apenas para ativar o período de acesso autorizado. Não é a sua password de entrada no MA-Professor.',
    '',
    `Aceda a: ${MA_PROFESSOR_ACCESS_URL}`,
    '',
    'Na página, escolha “Já tenho acesso” e depois “Tenho uma senha de ativação”.',
    '',
    'Se for a primeira ativação desta conta, irá definir a sua password pessoal. Depois da ativação, deverá entrar normalmente com o seu email e essa password pessoal.',
    '',
    'A senha de ativação deixa de ser necessária depois de o período ser ativado.',
    '',
    'A eventual confirmação de manutenção da vaga na fase piloto é um processo separado e não utiliza esta senha de ativação.',
    '',
    'MA-Professor | MA-CODE'
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">
        MA-Professor · Fase piloto
      </p>

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
          <span style="font-family:monospace;font-weight:700;">${safePassword}</span>
        </p>
      </div>

      <p>
        Esta senha serve <strong>apenas para ativar o período de acesso autorizado</strong>.
        Não é a sua password normal de entrada no MA-Professor.
      </p>

      <p style="margin:24px 0;">
        <a
          href="${MA_PROFESSOR_ACCESS_URL}"
          style="display:inline-block;background:#22d3ee;color:#082f49;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;"
        >
          Aceder ao MA-Professor
        </a>
      </p>

      <p>
        Na página, escolha <strong>“Já tenho acesso”</strong> e depois
        <strong>“Tenho uma senha de ativação”</strong>.
      </p>

      <p>
        Se for a primeira ativação desta conta, irá definir a sua
        <strong>password pessoal</strong>. Depois da ativação, deverá entrar normalmente
        com o seu email e essa password pessoal.
      </p>

      <p>
        A senha de ativação deixa de ser necessária depois de o período ser ativado.
      </p>

      <p style="color:#475569;">
        A eventual confirmação de manutenção da vaga na fase piloto é um processo separado
        e não utiliza esta senha de ativação.
      </p>

      <p style="margin-top:28px;color:#64748b;font-size:13px;">
        MA-Professor | MA-CODE
      </p>
    </div>
  `

  try {
    const response =
      await fetch(
        'https://api.resend.com/emails',
        {
          method:
            'POST',
          headers: {
            Authorization:
              `Bearer ${apiKey}`,
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify({
              from:
                'MA-Professor | MA-CODE <acesso@professor.ma-code.pt>',
              to: [
                email
              ],
              subject:
                'O seu acesso ao MA-Professor foi aprovado',
              text,
              html
            })
        }
      )

    return response.ok
      ? 'sent'
      : 'failed'
  } catch {
    return 'failed'
  }
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
): Promise<Response | null> {
  const url =
    new URL(
      request.url
    )

  if (
    url.pathname !==
    APPROVE_PATH
  ) {
    return handleExistingMAProfessorAdminApiRequest(
      request,
      env
    )
  }

  if (
    request.method !==
    'POST'
  ) {
    return json(
      {
        success:
          false,
        message:
          'Método não permitido.'
      },
      405
    )
  }

  const authenticated =
    await validateAdminSession(
      request,
      env
    )

  if (
    !authenticated
  ) {
    return json(
      {
        success:
          false,
        message:
          'Sessão administrativa inválida ou expirada.'
      },
      401
    )
  }

  let body:
    JsonObject

  try {
    body =
      await readJson(
        request
      )
  } catch {
    return json(
      {
        success:
          false,
        message:
          'Pedido inválido.'
      },
      400
    )
  }

  const email =
    normalizeEmail(
      body.email
    )

  if (
    !isValidEmail(
      email
    )
  ) {
    return json(
      {
        success:
          false,
        message:
          'Email inválido.'
      },
      400
    )
  }

  const decisionResponse =
    await decideMAProfessorAccessRequest(
      env,
      email,
      'approve'
    )

  const decisionBody =
    await readResponseJson(
      decisionResponse
    )

  if (
    !decisionResponse.ok
  ) {
    return decisionResponse
  }

  const requestSummary =
    decisionBody
      ?.request

  const commercialStatusResponse =
    await env
      .MA_PROFESSOR_ACCESS
      .get(
        env
          .MA_PROFESSOR_ACCESS
          .idFromName(
            'ma-professor-access-global'
          )
      )
      .fetch(
        new Request(
          new URL(
            '/__internal/ma-professor/admin/commerce/status',
            request.url
          ),
          {
            method:
              'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                email
              })
          }
        )
      )

  const commercialBody =
    await readResponseJson(
      commercialStatusResponse
    )

  const commerce =
    commercialBody
      ?.commerce

  const hasCommercialAuthorization =
    Boolean(
      commerce &&
      typeof commerce ===
        'object' &&
      !Array.isArray(
        commerce
      ) &&
      typeof (
        commerce as JsonObject
      ).authorizationId ===
        'string'
    )

  if (
    hasCommercialAuthorization
  ) {
    return json({
      success:
        true,
      message:
        'Pedido aprovado. A senha de ativação será emitida depois de o pagamento estar confirmado ou dispensado.',
      request:
        requestSummary,
      emailDelivery:
        'not_applicable',
      credentialIssued:
        false
    })
  }

  const credentialResponse =
    await generateMAProfessorAdminCredential(
      env,
      email
    )

  const credentialBody =
    await readResponseJson(
      credentialResponse
    )

  if (
    !credentialResponse.ok ||
    !credentialBody
  ) {
    return credentialResponse
  }

  const credential =
    credentialBody
      .credential

  if (
    !credential ||
    typeof credential !==
      'object' ||
    Array.isArray(
      credential
    ) ||
    typeof (
      credential as JsonObject
    ).password !==
      'string'
  ) {
    return json(
      {
        success:
          false,
        message:
          'O pedido foi aprovado, mas não foi possível obter a senha de ativação.'
      },
      500
    )
  }

  const activationPassword =
    (
      credential as JsonObject
    ).password as string

  const emailDelivery =
    await sendApprovalEmail(
      env,
      email,
      activationPassword
    )

  await updateMAProfessorAdminEmailDispatchStatus(
    env,
    email,
    emailDelivery
  )

  return json({
    success:
      true,
    message:
      emailDelivery ===
        'sent'
        ? 'Pedido aprovado. A senha de ativação foi enviada por email.'
        : emailDelivery ===
            'not_configured'
          ? 'Pedido aprovado. O envio automático não está configurado; copie a senha de ativação e envie-a manualmente.'
          : 'Pedido aprovado e senha de ativação criada, mas o email não foi enviado. Copie-a e envie-a manualmente.',
    request:
      requestSummary,
    emailDelivery,
    credentialIssued:
      true,
    fallbackCredential:
      emailDelivery ===
        'sent'
        ? undefined
        : credential
  })
}
