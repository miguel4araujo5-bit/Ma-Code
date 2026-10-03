import type { MaProfessorAccessEnv } from './maProfessorAccess'

export const MA_PROFESSOR_PROBLEM_REPORT_PATH =
  '/api/ma-professor/problem-report'

const MAX_BODY_BYTES =
  4_096

const MAX_ERROR_LENGTH =
  160

const MAX_VERSION_LENGTH =
  120

const MAX_SCREEN_LENGTH =
  160

const MAX_BROWSER_LENGTH =
  120

const MAX_MESSAGE_LENGTH =
  800

const ORIGIN_WINDOW_MS =
  15 * 60 * 1000

const ORIGIN_MAX_REPORTS =
  8

const GLOBAL_WINDOW_MS =
  60 * 60 * 1000

const GLOBAL_MAX_REPORTS =
  40

const RATE_LIMIT_RETENTION_MS =
  2 * 24 * 60 * 60 * 1000

const RATE_LIMIT_TABLE =
  'ma_professor_problem_report_rate_limits'

const RESEND_EMAIL_API_URL =
  'https://api.resend.com/emails'

const MA_PROFESSOR_EMAIL_ADDRESS =
  'acesso@professor.ma-code.pt'

const MA_PROFESSOR_EMAIL_NAME =
  'MA-Professor | MA-CODE'

const ADMIN_NOTIFICATION_EMAIL =
  'miguel4araujo5@gmail.com'

const encoder =
  new TextEncoder()

type JsonObject =
  Record<string, unknown>

interface D1ResultLike {
  success: boolean
  meta?: {
    changes?: number
  }
}

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike

  run():
    Promise<D1ResultLike>

  all<T>(): Promise<{ success: boolean; results?: T[] }>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike
}

export interface MaProfessorProblemReportEnv {
  MA_PROFESSOR_DB:
    D1DatabaseLike

  RESEND_API_KEY_MA_PROFESSOR?:
    string

  MA_PROFESSOR_ACCESS?: MaProfessorAccessEnv['MA_PROFESSOR_ACCESS']
}

interface ValidProblemReport {
  error: string
  version: string
  screen: string
  browser: string
  occurredAt: string
  message: string
  device: string
}

class ProblemReportApiError
  extends Error {
  readonly status:
    number

  readonly headers:
    Record<string, string>

  constructor(
    message: string,
    status: number,
    headers:
      Record<string, string> = {}
  ) {
    super(message)

    this.name =
      'ProblemReportApiError'

    this.status =
      status

    this.headers =
      headers
  }
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',

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
    JSON.stringify(
      body
    ),
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
    return new URL(
      value
    ).origin
  } catch {
    return ''
  }
}

function isLocalOrigin(
  origin: string
) {
  try {
    const hostname =
      new URL(
        origin
      ).hostname

    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(
      hostname
    )
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
    origin ||
    referer

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

function isJsonObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value ===
      'object' &&
    value !==
      null &&
    !Array.isArray(
      value
    )
  )
}

function normalizeText(
  value: unknown,
  maxLength: number
) {
  if (
    typeof value !==
      'string'
  ) {
    return ''
  }

  return value
    .replace(
      /[\u0000-\u001f\u007f]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
    .slice(
      0,
      maxLength
    )
}

function normalizeScreen(
  value: unknown
) {
  const text =
    normalizeText(
      value,
      MAX_SCREEN_LENGTH
    )

  const screen =
    text
      .split(/[?#]/, 1)[0]
      .trim()

  if (
    !screen ||
    screen.includes(
      '://'
    )
  ) {
    return ''
  }

  return screen.slice(
    0,
    MAX_SCREEN_LENGTH
  )
}

function normalizeOccurredAt(
  value: unknown
) {
  const text =
    normalizeText(
      value,
      64
    )

  const timestamp =
    Date.parse(
      text
    )

  if (
    !text ||
    !Number.isFinite(
      timestamp
    )
  ) {
    return ''
  }

  return new Date(
    timestamp
  ).toISOString()
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
    throw new ProblemReportApiError(
      'Formato de pedido inválido.',
      400
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
    throw new ProblemReportApiError(
      'O relatório é demasiado grande.',
      413
    )
  }

  const text =
    await request.text()

  if (
    encoder.encode(
      text
    ).byteLength >
      MAX_BODY_BYTES
  ) {
    throw new ProblemReportApiError(
      'O relatório é demasiado grande.',
      413
    )
  }

  let parsed:
    unknown

  try {
    parsed =
      JSON.parse(
        text
      ) as unknown
  } catch {
    throw new ProblemReportApiError(
      'O relatório não contém JSON válido.',
      400
    )
  }

  if (
    !isJsonObject(
      parsed
    )
  ) {
    throw new ProblemReportApiError(
      'O relatório não é válido.',
      400
    )
  }

  return parsed
}

function validateProblemReport(
  body: JsonObject
): ValidProblemReport {
  const error =
    normalizeText(
      body.error,
      MAX_ERROR_LENGTH
    )

  const version =
    normalizeText(
      body.version,
      MAX_VERSION_LENGTH
    )

  const screen =
    normalizeScreen(
      body.screen
    )

  const browser =
    normalizeText(
      body.browser,
      MAX_BROWSER_LENGTH
    )

  const occurredAt =
    normalizeOccurredAt(
      body.occurredAt
    )

  const message =
    normalizeText(
      body.message,
      MAX_MESSAGE_LENGTH
    )

  if (
    !error ||
    !version ||
    !screen ||
    !browser ||
    !occurredAt
  ) {
    throw new ProblemReportApiError(
      'Faltam dados técnicos necessários para enviar o relatório.',
      400
    )
  }

  return {
    error,
    version,
    screen,
    browser,
    occurredAt,
    message,
    device: normalizeText(body.device, 80) || 'Dispositivo desconhecido'
  }
}

async function reportContact(body: JsonObject, env: MaProfessorProblemReportEnv) {
  // A identidade vem exclusivamente da sessão verificada, nunca de um email enviado pelo cliente.
  if (!env.MA_PROFESSOR_ACCESS || !isJsonObject(body.session)) return null
  const token = normalizeText(body.session.token, 256)
  const deviceId = normalizeText(body.session.deviceId, 180)
  if (!token || !deviceId) return null
  const binding = env.MA_PROFESSOR_ACCESS
  const response = await binding.get(binding.idFromName('ma-professor-access-global')).fetch(new Request(
    'https://ma-professor.internal/api/ma-professor/access/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, deviceId })
    }
  ))
  const result = await response.json() as { success?: boolean; license?: { email?: string } }
  if (!response.ok || result.success !== true || !result.license?.email) return null
  const email = result.license.email.trim().toLowerCase()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`ma-professor-account-v1:${email}`))
  return { email, accountId: `account-${bytesToHex(new Uint8Array(digest))}` }
}

async function storeProblemReport(body: JsonObject, report: ValidProblemReport, env: MaProfessorProblemReportEnv, now: number) {
  let contact: Awaited<ReturnType<typeof reportContact>> = null
  try { contact = await reportContact(body, env) } catch { /* O diagnóstico também funciona se a sessão falhar. */ }
  const result = await env.MA_PROFESSOR_DB.prepare(`
    INSERT INTO ma_professor_problem_reports (
      id, account_id, contact_email, error_type, app_version, screen, browser,
      device, occurred_at, message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), contact?.accountId ?? null, contact?.email ?? null,
    report.error, report.version, report.screen, report.browser, report.device,
    report.occurredAt, report.message, now, now).run()
  if (!result.success || result.meta?.changes !== 1) {
    throw new ProblemReportApiError('Não foi possível guardar o relatório no suporte. Tente novamente mais tarde.', 503)
  }
}

// Chamado apenas depois da autenticação e da proteção de origem do Admin existente.
export async function handleMAProfessorProblemReportAdminRequest(request: Request, env: MaProfessorProblemReportEnv, action: string) {
  try {
    if (action === '/problem-reports' && request.method === 'GET') {
      const result = await env.MA_PROFESSOR_DB.prepare(`
        SELECT id, account_id, contact_email, error_type, app_version, screen, browser,
          device, occurred_at, message, status, internal_note, created_at, updated_at
        FROM ma_professor_problem_reports
        ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, created_at DESC
        LIMIT 100
      `).all<Record<string, unknown>>()
      if (!result.success) throw new Error('report-list-failed')
      return json({ success: true, reports: result.results ?? [] })
    }
    if (action !== '/problem-reports/update' || request.method !== 'POST') {
      return json({ success: false, message: 'Método ou operação não permitido.' }, 405)
    }
    const body = await readJsonBody(request)
    const id = normalizeText(body.id, 80)
    const status = normalizeText(body.status, 30)
    if (!id || !['new', 'in_review', 'resolved'].includes(status) || typeof body.internalNote !== 'string') {
      return json({ success: false, message: 'Indique um relatório e estado válidos.' }, 400)
    }
    const result = await env.MA_PROFESSOR_DB.prepare(`
      UPDATE ma_professor_problem_reports SET status = ?, internal_note = ?, updated_at = ? WHERE id = ?
    `).bind(status, normalizeText(body.internalNote, 1600), Date.now(), id).run()
    if (!result.success) throw new Error('report-update-failed')
    if (result.meta?.changes !== 1) return json({ success: false, message: 'Relatório não encontrado.' }, 404)
    return json({ success: true })
  } catch (error) {
    if (error instanceof ProblemReportApiError) return json({ success: false, message: error.message }, error.status)
    return json({ success: false, message: 'O serviço de relatórios está temporariamente indisponível.' }, 503)
  }
}

function getConnectingIp(
  request: Request
) {
  const cloudflareIp =
    (
      request.headers.get(
        'CF-Connecting-IP'
      ) || ''
    )
      .trim()
      .slice(
        0,
        64
      )

  if (cloudflareIp) {
    return cloudflareIp
  }

  const requestOrigin =
    new URL(
      request.url
    ).origin

  if (
    isLocalOrigin(
      requestOrigin
    )
  ) {
    return 'local-development'
  }

  return ''
}

function bytesToHex(
  bytes: Uint8Array
) {
  return Array.from(
    bytes,
    byte =>
      byte
        .toString(16)
        .padStart(
          2,
          '0'
        )
  ).join('')
}

function getUtcDayBucket(
  now: number
) {
  return new Date(
    now
  )
    .toISOString()
    .slice(
      0,
      10
    )
}

async function hashRateLimitOrigin(
  ip: string,
  now: number
) {
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      encoder.encode(
        [
          'ma-professor-problem-report',
          getUtcDayBucket(
            now
          ),
          ip
        ].join(':')
      )
    )

  return bytesToHex(
    new Uint8Array(
      digest
    )
  )
}

async function reserveRateLimitSlot(
  request: Request,
  env: MaProfessorProblemReportEnv,
  now: number
) {
  const connectingIp =
    getConnectingIp(
      request
    )

  if (!connectingIp) {
    throw new ProblemReportApiError(
      'Não foi possível validar a origem do relatório. Tente novamente mais tarde.',
      503
    )
  }

  const originHash =
    await hashRateLimitOrigin(
      connectingIp,
      now
    )

  let result:
    D1ResultLike

  try {
    result =
      await env
        .MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ${RATE_LIMIT_TABLE} (
              origin_hash,
              created_at
            )
            SELECT ?, ?
            WHERE (
              SELECT COUNT(*)
              FROM ${RATE_LIMIT_TABLE}
              WHERE origin_hash = ?
                AND created_at >= ?
            ) < ?
              AND (
                SELECT COUNT(*)
                FROM ${RATE_LIMIT_TABLE}
                WHERE created_at >= ?
              ) < ?
          `
        )
        .bind(
          originHash,
          now,
          originHash,
          now -
            ORIGIN_WINDOW_MS,
          ORIGIN_MAX_REPORTS,
          now -
            GLOBAL_WINDOW_MS,
          GLOBAL_MAX_REPORTS
        )
        .run()
  } catch {
    throw new ProblemReportApiError(
      'O serviço de reporte está temporariamente indisponível.',
      503
    )
  }

  if (
    !result.success
  ) {
    throw new ProblemReportApiError(
      'O serviço de reporte está temporariamente indisponível.',
      503
    )
  }

  const changes =
    result.meta?.changes

  if (
    changes ===
      0
  ) {
    throw new ProblemReportApiError(
      'Foram enviados demasiados relatórios. Aguarde alguns minutos antes de tentar novamente.',
      429,
      {
        'Retry-After':
          String(
            Math.ceil(
              ORIGIN_WINDOW_MS /
                1000
            )
          )
      }
    )
  }

  if (
    changes !==
      1
  ) {
    throw new ProblemReportApiError(
      'O serviço de reporte está temporariamente indisponível.',
      503
    )
  }

  try {
    await env
      .MA_PROFESSOR_DB
      .prepare(
        `
          DELETE FROM ${RATE_LIMIT_TABLE}
          WHERE created_at < ?
        `
      )
      .bind(
        now -
          RATE_LIMIT_RETENTION_MS
      )
      .run()
  } catch {
    /*
     * A limpeza é apenas manutenção. Uma falha aqui não transforma
     * um relatório já limitado numa falha da aplicação.
     */
  }
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

async function sendProblemReportEmail(
  env: MaProfessorProblemReportEnv,
  report: ValidProblemReport,
  receivedAt: string
) {
  const apiKey =
    (
      env.RESEND_API_KEY_MA_PROFESSOR ||
      ''
    ).trim()

  if (!apiKey) {
    throw new ProblemReportApiError(
      'O serviço de reporte está temporariamente indisponível.',
      503
    )
  }

  const optionalMessageText =
    report.message ||
    'Não fornecida.'

  const text = [
    'Relatório técnico do MA-Professor',
    '',
    `Erro: ${report.error}`,
    `Versão: ${report.version}`,
    `Ecrã: ${report.screen}`,
    `Browser: ${report.browser}`,
    `Data no dispositivo: ${report.occurredAt}`,
    `Recebido no servidor: ${receivedAt}`,
    '',
    'Mensagem opcional:',
    optionalMessageText,
    '',
    'Este email não inclui automaticamente dados escolares, conteúdos do IndexedDB, ficheiros, passwords ou endereço IP.'
  ].join(
    '\n'
  )

  const safe = {
    error:
      escapeHtml(
        report.error
      ),

    version:
      escapeHtml(
        report.version
      ),

    screen:
      escapeHtml(
        report.screen
      ),

    browser:
      escapeHtml(
        report.browser
      ),

    occurredAt:
      escapeHtml(
        report.occurredAt
      ),

    receivedAt:
      escapeHtml(
        receivedAt
      ),

    message:
      escapeHtml(
        optionalMessageText
      )
  }

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#0f172a;max-width:660px;margin:0 auto;padding:24px;">
      <p style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0891b2;margin:0 0 12px;">MA-Professor · Diagnóstico</p>
      <h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;color:#0f172a;">Relatório técnico</h1>
      <div style="margin:20px 0;padding:18px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;">
        <p style="margin:0 0 8px;"><strong>Erro:</strong> ${safe.error}</p>
        <p style="margin:0 0 8px;"><strong>Versão:</strong> ${safe.version}</p>
        <p style="margin:0 0 8px;"><strong>Ecrã:</strong> ${safe.screen}</p>
        <p style="margin:0 0 8px;"><strong>Browser:</strong> ${safe.browser}</p>
        <p style="margin:0 0 8px;"><strong>Data no dispositivo:</strong> ${safe.occurredAt}</p>
        <p style="margin:0;"><strong>Recebido no servidor:</strong> ${safe.receivedAt}</p>
      </div>
      <p style="margin:20px 0 8px;font-weight:700;">Mensagem opcional</p>
      <p style="margin:0;padding:14px;border-left:3px solid #22d3ee;background:#f8fafc;white-space:pre-wrap;">${safe.message}</p>
      <p style="margin:22px 0 0;color:#64748b;font-size:12px;">O sistema não anexa automaticamente dados escolares, conteúdos do IndexedDB, ficheiros, passwords ou endereço IP.</p>
    </div>
  `

  let response:
    Response

  try {
    response =
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
                ADMIN_NOTIFICATION_EMAIL
              ],

              subject:
                'Relatório técnico do MA-Professor',

              text,
              html
            })
        }
      )
  } catch {
    throw new ProblemReportApiError(
      'Não foi possível enviar o relatório. Tente novamente mais tarde.',
      503
    )
  }

  if (!response.ok) {
    console.error(
      'MA-Professor problem report delivery failed',
      {
        status:
          response.status
      }
    )

    throw new ProblemReportApiError(
      'Não foi possível enviar o relatório. Tente novamente mais tarde.',
      503
    )
  }
}

export function isMAProfessorProblemReportApiPath(
  pathname: string
) {
  return pathname ===
    MA_PROFESSOR_PROBLEM_REPORT_PATH
}

export async function handleMAProfessorProblemReportApiRequest(
  request: Request,
  env: MaProfessorProblemReportEnv
) {
  try {
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
        405,
        {
          Allow:
            'POST'
        }
      )
    }

    if (
      !isAllowedBrowserRequest(
        request
      )
    ) {
      throw new ProblemReportApiError(
        'Origem do pedido inválida.',
        403
      )
    }

    const body =
      await readJsonBody(
        request
      )

    const report =
      validateProblemReport(
        body
      )

    const now =
      Date.now()

    await reserveRateLimitSlot(
      request,
      env,
      now
    )

    const receivedAt =
      new Date(
        now
      ).toISOString()

    await storeProblemReport(body, report, env, now)
    // O Admin é o destino persistente. Uma falha do aviso por email não perde o relatório.
    try { await sendProblemReportEmail(env, report, receivedAt) } catch {
      console.error('MA-Professor report saved; email notification unavailable')
    }

    return json({
      success:
        true
    })
  } catch (error) {
    if (
      error instanceof
        ProblemReportApiError
    ) {
      return json(
        {
          success:
            false,

          message:
            error.message
        },
        error.status,
        error.headers
      )
    }

    console.error(
      'MA-Professor problem report failed without report payload'
    )

    return json(
      {
        success:
          false,

        message:
          'O serviço de reporte está temporariamente indisponível.'
      },
      503
    )
  }
}
