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
}

interface ValidProblemReport {
  error: string
  version: string
  screen: string
  browser: string
  occurredAt: string
  message: string
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

  const pathname =
    text
      .split(/[?#]/, 1)[0]
      .trim()

  return pathname.startsWith(
    '/'
  )
    ? pathname.slice(
        0,
        MAX_SCREEN_LENGTH
      )
    : ''
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
    message
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

  if (
    result.meta?.changes ===
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

async function readResendError(
  response: Response
) {
  try {
    const parsed =
      await response
        .clone()
        .json() as {
          message?: unknown
        }

    if (
      typeof parsed.message ===
        'string' &&
      parsed.message.trim()
    ) {
      return parsed.message
        .trim()
        .slice(
          0,
          240
        )
    }
  } catch {
    // A resposta externa não é exposta ao utilizador.
  }

  return `HTTP ${response.status}`
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
    const reason =
      await readResendError(
        response
      )

    console.error(
      'MA-Professor problem report delivery failed',
      {
        status:
          response.status,

        reason
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

    await sendProblemReportEmail(
      env,
      report,
      receivedAt
    )

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
