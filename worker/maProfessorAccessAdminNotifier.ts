const PUBLIC_REQUEST_PATH =
  '/api/ma-professor/access/request'

const RESEND_EMAIL_API_URL =
  'https://api.resend.com/emails'

const DEFAULT_ADMIN_EMAIL =
  'miguel4araujo5@gmail.com'

const NEW_REQUEST_WINDOW_MS =
  2 * 60 * 1000

type JsonObject =
  Record<string, unknown>

export interface MAProfessorAccessAdminNotifierEnv {
  RESEND_API_KEY_MA_PROFESSOR?: string
  MA_PROFESSOR_ADMIN_EMAIL?: string
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

function readIsoDate(
  value: unknown
) {
  if (
    typeof value !== 'string' ||
    !value
  ) {
    return null
  }

  const timestamp =
    Date.parse(value)

  return Number.isFinite(timestamp)
    ? {
        iso: value,
        timestamp
      }
    : null
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

export async function notifyMAProfessorNewAccessRequest(
  request: Request,
  response: Response,
  env: MAProfessorAccessAdminNotifierEnv
) {
  if (
    request.method !== 'POST' ||
    new URL(request.url).pathname !==
      PUBLIC_REQUEST_PATH ||
    !response.ok
  ) {
    return
  }

  const apiKey =
    (
      env.RESEND_API_KEY_MA_PROFESSOR ||
      ''
    ).trim()

  if (!apiKey) {
    console.warn(
      'MA-Professor admin access notification not sent',
      {
        reason:
          'RESEND_API_KEY_MA_PROFESSOR missing'
      }
    )
    return
  }

  let body: JsonObject

  try {
    const parsed =
      await response.clone().json()

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return
    }

    body = parsed as JsonObject
  } catch {
    return
  }

  const requestSummary =
    body.request

  if (
    body.success !== true ||
    !requestSummary ||
    typeof requestSummary !== 'object' ||
    Array.isArray(requestSummary)
  ) {
    return
  }

  const summary =
    requestSummary as JsonObject

  if (summary.status !== 'pending') {
    return
  }

  const requesterEmail =
    normalizeEmail(summary.email)

  if (!isValidEmail(requesterEmail)) {
    return
  }

  const configuredAdminEmail =
    normalizeEmail(
      env.MA_PROFESSOR_ADMIN_EMAIL
    )

  const adminEmail =
    isValidEmail(configuredAdminEmail)
      ? configuredAdminEmail
      : DEFAULT_ADMIN_EMAIL

  const now =
    Date.now()

  const submittedAt =
    new Date(now).toISOString()

  const originalRequestedAt =
    readIsoDate(
      summary.requestedAt
    )

  const isNewRequest =
    Boolean(
      originalRequestedAt &&
      Math.abs(
        now - originalRequestedAt.timestamp
      ) <= NEW_REQUEST_WINDOW_MS
    )

  const notificationTitle =
    isNewRequest
      ? 'Novo pedido de acesso'
      : 'Nova tentativa de pedido de acesso'

  const subject =
    isNewRequest
      ? 'Novo pedido de acesso ao MA-Professor'
      : 'Nova tentativa de acesso ao MA-Professor'

  const safeRequesterEmail =
    escapeHtml(requesterEmail)

  const safeSubmittedAt =
    escapeHtml(submittedAt)

  const safeOriginalRequestedAt =
    originalRequestedAt
      ? escapeHtml(
          originalRequestedAt.iso
        )
      : ''

  const text = [
    `${notificationTitle} ao MA-Professor.`,
    '',
    `Email do requerente: ${requesterEmail}`,
    `Tentativa recebida em: ${submittedAt}`,
    ...(
      !isNewRequest &&
      originalRequestedAt
        ? [
            `Pedido original: ${originalRequestedAt.iso}`
          ]
        : []
    ),
    '',
    'O pedido encontra-se pendente e aguarda decisão no painel administrativo.',
    '',
    'MA-Professor | MA-CODE'
  ].join('\n')

  const originalRequestHtml =
    !isNewRequest &&
    safeOriginalRequestedAt
      ? `
        <p style="margin:8px 0 0;">
          <strong>Pedido original:</strong> ${safeOriginalRequestedAt}
        </p>
      `
      : ''

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">
        MA-Professor · Administração
      </p>

      <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">
        ${notificationTitle}
      </h1>

      <p>
        Foi submetido um pedido de acesso ao MA-Professor.
      </p>

      <div style="margin:22px 0;padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">
        <p style="margin:0 0 8px;">
          <strong>Email do requerente:</strong> ${safeRequesterEmail}
        </p>
        <p style="margin:0;">
          <strong>Tentativa recebida em:</strong> ${safeSubmittedAt}
        </p>
        ${originalRequestHtml}
      </div>

      <p>
        O pedido encontra-se <strong>pendente</strong> e aguarda decisão no painel administrativo.
      </p>

      <p style="margin-top:28px;color:#64748b;font-size:13px;">
        MA-Professor | MA-CODE
      </p>
    </div>
  `

  try {
    const emailResponse =
      await fetch(
        RESEND_EMAIL_API_URL,
        {
          method: 'POST',
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
                adminEmail
              ],
              subject,
              text,
              html
            })
        }
      )

    if (!emailResponse.ok) {
      let responseText = ''

      try {
        responseText =
          (
            await emailResponse.text()
          ).slice(0, 500)
      } catch {
        responseText = ''
      }

      console.error(
        'MA-Professor admin access notification rejected',
        {
          status:
            emailResponse.status,
          adminEmail,
          requesterEmail,
          response:
            responseText
        }
      )

      return
    }

    let responseId = ''

    try {
      const responseBody =
        await emailResponse.json() as {
          id?: unknown
        }

      responseId =
        typeof responseBody.id === 'string'
          ? responseBody.id
          : ''
    } catch {
      responseId = ''
    }

    console.info(
      'MA-Professor admin access notification sent',
      {
        adminEmail,
        requesterEmail,
        isNewRequest,
        responseId
      }
    )
  } catch (error) {
    console.error(
      'MA-Professor admin access notification failed',
      {
        adminEmail,
        requesterEmail,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )
  }
}
