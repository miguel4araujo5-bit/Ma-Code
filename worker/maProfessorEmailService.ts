const RESEND_EMAIL_API_URL =
  'https://api.resend.com/emails'

const MA_PROFESSOR_ACCESS_URL =
  'https://ma-code.pt/produtos/ma-professor'

const MA_PROFESSOR_EMAIL_ADDRESS =
  'acesso@professor.ma-code.pt'

const MA_PROFESSOR_EMAIL_NAME =
  'MA-Professor | MA-CODE'

const ADMIN_NOTIFICATION_EMAIL =
  'miguel4araujo5@gmail.com'

export interface MAProfessorEmailEnv {
  RESEND_API_KEY_MA_PROFESSOR?: string
}

export type MAProfessorEmailDeliveryStatus =
  | 'sent'
  | 'failed'
  | 'not_configured'
  | 'blocked'

export interface MAProfessorEmailDeliveryResult {
  status: MAProfessorEmailDeliveryStatus
  id?: string
  error?: string
}

interface MAProfessorEmailMessage {
  to: string
  subject: string
  text: string
  html: string
}

interface AdminAccessRequestEmailInput {
  requesterEmail: string
  isNewRequest: boolean
  submittedAt: string
  originalRequestedAt?: string | null
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 180)
    : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getResendApiKey(env: MAProfessorEmailEnv) {
  return (env.RESEND_API_KEY_MA_PROFESSOR || '').trim()
}

export function hasMAProfessorEmailTransport(env: MAProfessorEmailEnv) {
  return Boolean(getResendApiKey(env))
}

async function readResendError(response: Response) {
  try {
    const parsed = await response.clone().json() as { message?: unknown }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message.trim().slice(0, 500)
    }
  } catch {}
  return `Resend devolveu HTTP ${response.status}.`
}

async function sendMAProfessorEmail(
  env: MAProfessorEmailEnv,
  message: MAProfessorEmailMessage
): Promise<MAProfessorEmailDeliveryResult> {
  const apiKey = getResendApiKey(env)
  if (!apiKey) return { status: 'not_configured' }

  const recipient = normalizeEmail(message.to)
  if (!isValidEmail(recipient)) {
    return { status: 'blocked', error: 'Destinatário inválido.' }
  }

  try {
    const response = await fetch(RESEND_EMAIL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        from: `${MA_PROFESSOR_EMAIL_NAME} <${MA_PROFESSOR_EMAIL_ADDRESS}>`,
        to: [recipient],
        subject: message.subject,
        text: message.text,
        html: message.html
      })
    })

    if (!response.ok) {
      return { status: 'failed', error: await readResendError(response) }
    }

    let id = ''
    try {
      const body = await response.clone().json() as { id?: unknown }
      id = typeof body.id === 'string' ? body.id : ''
    } catch {}

    return { status: 'sent', ...(id ? { id } : {}) }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

function buildActivationUrl(email: string, password: string) {
  const query = new URLSearchParams({ acesso: 'ativar', email })
  const fragment = new URLSearchParams({ senha: password })
  return `${MA_PROFESSOR_ACCESS_URL}?${query.toString()}#${fragment.toString()}`
}

function buildActivationMessage(
  email: string,
  password: string,
  mode: 'pilot' | 'commercial'
): MAProfessorEmailMessage {
  const activationUrl = buildActivationUrl(email, password)
  const safeEmail = escapeHtml(email)
  const safeActivationUrl = escapeHtml(activationUrl)
  const safePassword = escapeHtml(password)
  const pilot = mode === 'pilot'
  const subject = pilot
    ? 'Ative o seu acesso ao MA-Professor'
    : 'O seu acesso ao MA-Professor está pronto'
  const headline = pilot
    ? 'O seu acesso está pronto'
    : 'Pagamento validado — acesso pronto'
  const introduction = pilot
    ? 'O seu acesso gratuito ao MA-Professor foi aprovado.'
    : 'O seu acesso ao MA-Professor foi autorizado e já pode ser ativado.'

  const text = [
    'Olá,',
    '',
    introduction,
    '',
    `Email: ${email}`,
    `Senha de ativação: ${password}`,
    '',
    'Abra o link abaixo. O email e a senha de ativação serão preenchidos automaticamente:',
    activationUrl,
    '',
    'A senha MP- serve apenas para ativar este período de acesso.',
    '',
    'MA-Professor | MA-CODE'
  ].join('\n')

  const html = `
    <div style="margin:0;background:#f8fafc;padding:28px 14px;">
      <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;max-width:580px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;padding:30px;box-sizing:border-box;">
        <p style="font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">MA-Professor · MA-CODE</p>
        <h1 style="font-size:27px;line-height:1.2;margin:0 0 14px;color:#0f172a;">${headline}</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${introduction}</p>
        <div style="margin:24px 0 0;padding:19px;border:1px solid #cbd5e1;border-radius:14px;background:#f8fafc;">
          <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Email</p>
          <p style="margin:5px 0 18px;font-size:15px;font-weight:700;color:#0f172a;word-break:break-word;">${safeEmail}</p>
          <p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">Senha de ativação</p>
          <p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;font-size:17px;font-weight:800;color:#0f172a;">${safePassword}</p>
        </div>
        <div style="margin:24px 0;">
          <a href="${safeActivationUrl}" style="display:block;box-sizing:border-box;background:#22d3ee;color:#082f49;text-decoration:none;text-align:center;font-size:15px;font-weight:800;padding:14px 20px;border-radius:11px;">Ativar acesso</a>
        </div>
        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;">A senha <strong>MP-</strong> serve apenas para ativar este período de acesso.</p>
        <p style="margin:25px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">MA-Professor | MA-CODE</p>
      </div>
    </div>
  `
  return { to: email, subject, text, html }
}

export async function sendMAProfessorPilotApprovalEmail(
  env: MAProfessorEmailEnv,
  email: string,
  password: string
) {
  return sendMAProfessorEmail(
    env,
    buildActivationMessage(normalizeEmail(email), password, 'pilot')
  )
}

export async function sendMAProfessorCommercialActivationEmail(
  env: MAProfessorEmailEnv,
  email: string,
  password: string
) {
  return sendMAProfessorEmail(
    env,
    buildActivationMessage(normalizeEmail(email), password, 'commercial')
  )
}

export async function sendMAProfessorPilotRejectionEmail(
  env: MAProfessorEmailEnv,
  email: string
) {
  const recipient = normalizeEmail(email)
  const text = [
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
  ].join('\n')
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">MA-Professor · Fase piloto</p>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">Decisão sobre o seu pedido</h1>
      <p>Olá,</p>
      <p>Agradecemos o seu interesse no MA-Professor.</p>
      <p>O seu pedido <strong>não foi aprovado nesta fase</strong>.</p>
      <p>O piloto decorre com um número limitado de vagas para permitir um acompanhamento próximo dos docentes participantes.</p>
      <p>Obrigado pelo interesse e pela disponibilidade para conhecer o projeto.</p>
      <p style="margin-top:28px;">MA-Professor | MA-CODE</p>
    </div>
  `
  return sendMAProfessorEmail(env, {
    to: recipient,
    subject: 'Decisão sobre o seu pedido ao MA-Professor',
    text,
    html
  })
}

export async function sendMAProfessorAdminAccessRequestEmail(
  env: MAProfessorEmailEnv,
  input: AdminAccessRequestEmailInput
) {
  const requesterEmail = normalizeEmail(input.requesterEmail)
  const adminEmail = normalizeEmail(ADMIN_NOTIFICATION_EMAIL)

  if (
    !isValidEmail(requesterEmail) ||
    !isValidEmail(adminEmail) ||
    requesterEmail === adminEmail
  ) {
    return {
      status: 'blocked',
      error: 'A notificação administrativa foi bloqueada por uma regra de destinatário.'
    } satisfies MAProfessorEmailDeliveryResult
  }

  const notificationTitle = input.isNewRequest
    ? 'Novo pedido de acesso'
    : 'Nova tentativa de pedido de acesso'
  const subject = input.isNewRequest
    ? 'Novo pedido de acesso ao MA-Professor'
    : 'Nova tentativa de acesso ao MA-Professor'
  const safeRequesterEmail = escapeHtml(requesterEmail)
  const safeSubmittedAt = escapeHtml(input.submittedAt)
  const safeOriginalRequestedAt = input.originalRequestedAt
    ? escapeHtml(input.originalRequestedAt)
    : ''

  const text = [
    `${notificationTitle} ao MA-Professor.`,
    '',
    `Email do requerente: ${requesterEmail}`,
    `Tentativa recebida em: ${input.submittedAt}`,
    ...(!input.isNewRequest && input.originalRequestedAt
      ? [`Pedido original: ${input.originalRequestedAt}`]
      : []),
    '',
    'O pedido encontra-se pendente e aguarda decisão no painel administrativo.',
    '',
    'MA-Professor | MA-CODE'
  ].join('\n')

  const originalRequestHtml =
    !input.isNewRequest && safeOriginalRequestedAt
      ? `<p style="margin:8px 0 0;"><strong>Pedido original:</strong> ${safeOriginalRequestedAt}</p>`
      : ''

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;max-width:620px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">MA-Professor · Administração</p>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">${notificationTitle}</h1>
      <p>Foi submetido um pedido de acesso ao MA-Professor.</p>
      <div style="margin:22px 0;padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">
        <p style="margin:0 0 8px;"><strong>Email do requerente:</strong> ${safeRequesterEmail}</p>
        <p style="margin:0;"><strong>Tentativa recebida em:</strong> ${safeSubmittedAt}</p>
        ${originalRequestHtml}
      </div>
      <p>O pedido encontra-se <strong>pendente</strong> e aguarda decisão no painel administrativo.</p>
      <p style="margin-top:28px;color:#64748b;font-size:13px;">MA-Professor | MA-CODE</p>
    </div>
  `

  return sendMAProfessorEmail(env, {
    to: adminEmail,
    subject,
    text,
    html
  })
}
