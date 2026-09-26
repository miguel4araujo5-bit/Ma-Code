import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_SUPPORT_TICKETS_API_PREFIX =
  '/api/ma-professor/support-tickets'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'
const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const MAX_BODY_BYTES = 16_000
const MAX_SUBJECT_LENGTH = 160
const MAX_MESSAGE_LENGTH = 5_000
const MAX_OPEN_TICKETS = 10

const TICKET_CATEGORIES = new Set([
  'getting-started',
  'daily-work',
  'planning',
  'attendance',
  'security',
  'technical',
  'other'
])

const TICKET_STATUSES = new Set([
  'new',
  'in_review',
  'waiting_professor',
  'resolved',
  'closed'
])

type JsonObject =
  Record<string, unknown>

interface D1RunResultLike {
  success: boolean
  meta?: {
    changes?: number
  }
}

interface D1AllResultLike<T> {
  success?: boolean
  results?: T[]
}

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike
  first<T = Record<string, unknown>>():
    Promise<T | null>
  all<T = Record<string, unknown>>():
    Promise<D1AllResultLike<T>>
  run(): Promise<D1RunResultLike>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike
  batch(
    statements: D1PreparedStatementLike[]
  ): Promise<D1RunResultLike[]>
}

export interface MaProfessorSupportTicketEnv
  extends MaProfessorAccessEnv {
  MA_PROFESSOR_DB: D1DatabaseLike
}

interface AccessVerifySuccess {
  success: true
  license: {
    email: string
    status: string
  }
}

interface AccessVerifyError {
  success: false
  message?: string
}

type AccessVerifyResult =
  | AccessVerifySuccess
  | AccessVerifyError

interface SupportTicketRow {
  id: string
  account_id: string
  category: string
  subject: string
  status: string
  app_version: string | null
  screen: string | null
  browser: string | null
  os: string | null
  created_at: number
  updated_at: number
  closed_at: number | null
}

interface SupportMessageRow {
  id: string
  ticket_id: string
  author_role: string
  body: string
  created_at: number
}

class SupportTicketApiError
  extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number
  ) {
    super(message)
    this.name =
      'SupportTicketApiError'
    this.status = status
  }
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':
      'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow'
  }

function json(
  body: unknown,
  status = 200,
  extraHeaders:
    Record<string, string> = {}
) {
  return new Response(
    JSON.stringify(body),
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
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isAllowedOrigin(
  request: Request
) {
  const requestOrigin =
    new URL(request.url).origin
  const origin =
    normalizeOrigin(
      request.headers.get('Origin') || ''
    )
  const referer =
    normalizeOrigin(
      request.headers.get('Referer') || ''
    )
  const candidate = origin || referer

  if (!candidate) {
    return false
  }

  if (
    candidate === requestOrigin ||
    candidate === 'https://ma-code.pt' ||
    candidate === 'https://www.ma-code.pt'
  ) {
    return true
  }

  try {
    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(
      new URL(candidate).hostname
    )
  } catch {
    return false
  }
}

function isObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function normalizeText(
  value: unknown,
  maxLength: number
) {
  return typeof value === 'string'
    ? value
        .trim()
        .slice(0, maxLength)
    : ''
}

function normalizeOptionalText(
  value: unknown,
  maxLength: number
) {
  const normalized =
    normalizeText(
      value,
      maxLength
    )

  return normalized || null
}

async function readJsonBody(
  request: Request
): Promise<JsonObject> {
  const contentType =
    request.headers.get('content-type') || ''

  if (
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    throw new SupportTicketApiError(
      'Formato de pedido inválido.',
      400
    )
  }

  const contentLength =
    Number(
      request.headers.get('content-length') || 0
    )

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    throw new SupportTicketApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder()
      .encode(text)
      .byteLength > MAX_BODY_BYTES
  ) {
    throw new SupportTicketApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new SupportTicketApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (!isObject(parsed)) {
    throw new SupportTicketApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
}

async function createAccountId(
  email: string
) {
  const normalizedEmail =
    email.trim().toLowerCase()
  const digest =
    await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        `ma-professor-account-v1:${normalizedEmail}`
      )
    )

  return `account-${Array.from(
    new Uint8Array(digest),
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')}`
}

async function verifyAccessSession(
  body: JsonObject,
  env: MaProfessorSupportTicketEnv
) {
  const token =
    normalizeText(body.token, 256)
  const deviceId =
    normalizeText(body.deviceId, 180)

  if (!token || !deviceId) {
    throw new SupportTicketApiError(
      'A sessão não é válida.',
      401
    )
  }

  const durableObjectId =
    env.MA_PROFESSOR_ACCESS.idFromName(
      ACCESS_DURABLE_OBJECT_NAME
    )
  const durableObject =
    env.MA_PROFESSOR_ACCESS.get(
      durableObjectId
    )

  const response =
    await durableObject.fetch(
      new Request(
        `https://ma-professor.internal${ACCESS_VERIFY_PATH}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            token,
            deviceId
          })
        }
      )
    )

  let result:
    AccessVerifyResult | null = null

  try {
    result =
      await response.json() as
        AccessVerifyResult
  } catch {
    result = null
  }

  if (
    !response.ok ||
    !result ||
    result.success !== true
  ) {
    const message =
      result &&
      result.success === false &&
      typeof result.message === 'string'
        ? result.message
        : 'A sessão já não é válida.'

    throw new SupportTicketApiError(
      message,
      response.status === 403
        ? 403
        : 401
    )
  }

  return {
    accountId:
      await createAccountId(
        result.license.email
      )
  }
}

function publicTicket(
  row: SupportTicketRow
) {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    status: row.status,
    context: {
      appVersion: row.app_version,
      screen: row.screen,
      browser: row.browser,
      os: row.os
    },
    createdAt:
      new Date(row.created_at)
        .toISOString(),
    updatedAt:
      new Date(row.updated_at)
        .toISOString(),
    closedAt:
      row.closed_at === null
        ? null
        : new Date(row.closed_at)
            .toISOString()
  }
}

function publicMessage(
  row: SupportMessageRow
) {
  return {
    id: row.id,
    authorRole: row.author_role,
    body: row.body,
    createdAt:
      new Date(row.created_at)
        .toISOString()
  }
}

async function getOwnedTicket(
  env: MaProfessorSupportTicketEnv,
  ticketId: string,
  accountId: string
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          id,
          account_id,
          category,
          subject,
          status,
          app_version,
          screen,
          browser,
          os,
          created_at,
          updated_at,
          closed_at
        FROM ma_professor_support_tickets
        WHERE id = ?
          AND account_id = ?
        LIMIT 1
      `
    )
    .bind(
      ticketId,
      accountId
    )
    .first<SupportTicketRow>()
}

async function getTicketById(
  env: MaProfessorSupportTicketEnv,
  ticketId: string
) {
  return env.MA_PROFESSOR_DB
    .prepare(
      `
        SELECT
          id,
          account_id,
          category,
          subject,
          status,
          app_version,
          screen,
          browser,
          os,
          created_at,
          updated_at,
          closed_at
        FROM ma_professor_support_tickets
        WHERE id = ?
        LIMIT 1
      `
    )
    .bind(ticketId)
    .first<SupportTicketRow>()
}

async function getTicketMessages(
  env: MaProfessorSupportTicketEnv,
  ticketId: string
) {
  const result =
    await env.MA_PROFESSOR_DB
      .prepare(
        `
          SELECT
            id,
            ticket_id,
            author_role,
            body,
            created_at
          FROM ma_professor_support_messages
          WHERE ticket_id = ?
          ORDER BY created_at ASC, id ASC
        `
      )
      .bind(ticketId)
      .all<SupportMessageRow>()

  return result.results || []
}

async function handleCreateTicket(
  body: JsonObject,
  env: MaProfessorSupportTicketEnv,
  accountId: string
) {
  const category =
    normalizeText(body.category, 40)
  const subject =
    normalizeText(
      body.subject,
      MAX_SUBJECT_LENGTH
    )
  const message =
    normalizeText(
      body.message,
      MAX_MESSAGE_LENGTH
    )

  if (!TICKET_CATEGORIES.has(category)) {
    throw new SupportTicketApiError(
      'Escolha uma categoria de apoio válida.',
      400
    )
  }

  if (subject.length < 4) {
    throw new SupportTicketApiError(
      'Descreva brevemente o assunto do pedido.',
      400
    )
  }

  if (message.length < 8) {
    throw new SupportTicketApiError(
      'Explique o que está a acontecer com um pouco mais de detalhe.',
      400
    )
  }

  const openCount =
    await env.MA_PROFESSOR_DB
      .prepare(
        `
          SELECT COUNT(*) AS total
          FROM ma_professor_support_tickets
          WHERE account_id = ?
            AND status != 'closed'
        `
      )
      .bind(accountId)
      .first<{
        total: number
      }>()

  if (
    Number(openCount?.total || 0) >=
      MAX_OPEN_TICKETS
  ) {
    throw new SupportTicketApiError(
      'Já existem vários pedidos de apoio em aberto. Responda a um pedido existente antes de criar outro.',
      429
    )
  }

  const now = Date.now()
  const ticketId =
    `ticket-${globalThis.crypto.randomUUID()}`
  const messageId =
    `message-${globalThis.crypto.randomUUID()}`

  const result =
    await env.MA_PROFESSOR_DB.batch([
      env.MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_support_tickets (
              id,
              account_id,
              category,
              subject,
              status,
              app_version,
              screen,
              browser,
              os,
              created_at,
              updated_at,
              closed_at
            ) VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, NULL)
          `
        )
        .bind(
          ticketId,
          accountId,
          category,
          subject,
          normalizeOptionalText(
            body.appVersion,
            64
          ),
          normalizeOptionalText(
            body.screen,
            120
          ),
          normalizeOptionalText(
            body.browser,
            180
          ),
          normalizeOptionalText(
            body.os,
            120
          ),
          now,
          now
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_support_messages (
              id,
              ticket_id,
              author_role,
              body,
              created_at
            ) VALUES (?, ?, 'professor', ?, ?)
          `
        )
        .bind(
          messageId,
          ticketId,
          message,
          now
        )
    ])

  if (
    result.length !== 2 ||
    result.some(item =>
      item.success !== true
    )
  ) {
    throw new SupportTicketApiError(
      'Não foi possível guardar o pedido de apoio.',
      500
    )
  }

  const created =
    await getOwnedTicket(
      env,
      ticketId,
      accountId
    )

  if (!created) {
    throw new SupportTicketApiError(
      'Não foi possível confirmar o pedido criado.',
      500
    )
  }

  return {
    success: true,
    ticket:
      publicTicket(created)
  }
}

async function handleListTickets(
  env: MaProfessorSupportTicketEnv,
  accountId: string
) {
  const result =
    await env.MA_PROFESSOR_DB
      .prepare(
        `
          SELECT
            id,
            account_id,
            category,
            subject,
            status,
            app_version,
            screen,
            browser,
            os,
            created_at,
            updated_at,
            closed_at
          FROM ma_professor_support_tickets
          WHERE account_id = ?
          ORDER BY updated_at DESC
          LIMIT 50
        `
      )
      .bind(accountId)
      .all<SupportTicketRow>()

  return {
    success: true,
    tickets:
      (result.results || [])
        .map(publicTicket)
  }
}

async function handleTicketDetail(
  body: JsonObject,
  env: MaProfessorSupportTicketEnv,
  accountId: string
) {
  const ticketId =
    normalizeText(body.ticketId, 120)
  const ticket =
    await getOwnedTicket(
      env,
      ticketId,
      accountId
    )

  if (!ticket) {
    throw new SupportTicketApiError(
      'Pedido de apoio não encontrado.',
      404
    )
  }

  const messages =
    await getTicketMessages(
      env,
      ticketId
    )

  return {
    success: true,
    ticket:
      publicTicket(ticket),
    messages:
      messages.map(publicMessage)
  }
}

async function handleProfessorReply(
  body: JsonObject,
  env: MaProfessorSupportTicketEnv,
  accountId: string
) {
  const ticketId =
    normalizeText(body.ticketId, 120)
  const message =
    normalizeText(
      body.message,
      MAX_MESSAGE_LENGTH
    )
  const ticket =
    await getOwnedTicket(
      env,
      ticketId,
      accountId
    )

  if (!ticket) {
    throw new SupportTicketApiError(
      'Pedido de apoio não encontrado.',
      404
    )
  }

  if (ticket.status === 'closed') {
    throw new SupportTicketApiError(
      'Este pedido já está fechado.',
      409
    )
  }

  if (message.length < 2) {
    throw new SupportTicketApiError(
      'Escreva uma mensagem antes de enviar.',
      400
    )
  }

  const now = Date.now()
  const messageId =
    `message-${globalThis.crypto.randomUUID()}`

  const result =
    await env.MA_PROFESSOR_DB.batch([
      env.MA_PROFESSOR_DB
        .prepare(
          `
            INSERT INTO ma_professor_support_messages (
              id,
              ticket_id,
              author_role,
              body,
              created_at
            ) VALUES (?, ?, 'professor', ?, ?)
          `
        )
        .bind(
          messageId,
          ticketId,
          message,
          now
        ),
      env.MA_PROFESSOR_DB
        .prepare(
          `
            UPDATE ma_professor_support_tickets
            SET status = 'in_review',
                updated_at = ?,
                closed_at = NULL
            WHERE id = ?
              AND account_id = ?
              AND status != 'closed'
          `
        )
        .bind(
          now,
          ticketId,
          accountId
        )
    ])

  if (
    result.length !== 2 ||
    result.some(item =>
      item.success !== true
    )
  ) {
    throw new SupportTicketApiError(
      'Não foi possível guardar a resposta.',
      500
    )
  }

  return handleTicketDetail(
    {
      ticketId
    },
    env,
    accountId
  )
}

export function isMAProfessorSupportTicketsApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_SUPPORT_TICKETS_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_SUPPORT_TICKETS_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorSupportTicketsApiRequest(
  request: Request,
  env: MaProfessorSupportTicketEnv
) {
  if (request.method !== 'POST') {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        Allow: 'POST'
      }
    )
  }

  if (!isAllowedOrigin(request)) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403
    )
  }

  try {
    const body =
      await readJsonBody(request)
    const session =
      await verifyAccessSession(
        body,
        env
      )
    const pathname =
      new URL(request.url).pathname
    const action =
      pathname.slice(
        MA_PROFESSOR_SUPPORT_TICKETS_API_PREFIX.length
      ) || '/list'

    let result: unknown

    switch (action) {
      case '/create':
        result =
          await handleCreateTicket(
            body,
            env,
            session.accountId
          )
        break

      case '/list':
      case '/':
        result =
          await handleListTickets(
            env,
            session.accountId
          )
        break

      case '/detail':
        result =
          await handleTicketDetail(
            body,
            env,
            session.accountId
          )
        break

      case '/reply':
        result =
          await handleProfessorReply(
            body,
            env,
            session.accountId
          )
        break

      default:
        return json(
          {
            success: false,
            message:
              'Endpoint de apoio não encontrado.'
          },
          404
        )
    }

    return json(result)
  } catch (error) {
    if (
      error instanceof
        SupportTicketApiError
    ) {
      return json(
        {
          success: false,
          message: error.message
        },
        error.status
      )
    }

    console.error(
      'MA-Professor support ticket request failed',
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json(
      {
        success: false,
        message:
          'Não foi possível concluir o pedido de apoio.'
      },
      500
    )
  }
}

export async function handleMAProfessorSupportTicketAdminRequest(
  request: Request,
  env: MaProfessorSupportTicketEnv,
  action: string
) {
  try {
    if (
      action === '/support-tickets' ||
      action === '/support-tickets/'
    ) {
      if (request.method !== 'GET') {
        return json(
          {
            success: false,
            message:
              'Método não permitido.'
          },
          405,
          {
            Allow: 'GET'
          }
        )
      }

      const result =
        await env.MA_PROFESSOR_DB
          .prepare(
            `
              SELECT
                id,
                account_id,
                category,
                subject,
                status,
                app_version,
                screen,
                browser,
                os,
                created_at,
                updated_at,
                closed_at
              FROM ma_professor_support_tickets
              ORDER BY
                CASE status
                  WHEN 'new' THEN 0
                  WHEN 'in_review' THEN 1
                  WHEN 'waiting_professor' THEN 2
                  WHEN 'resolved' THEN 3
                  ELSE 4
                END,
                updated_at DESC
              LIMIT 100
            `
          )
          .all<SupportTicketRow>()

      return json({
        success: true,
        tickets:
          (result.results || [])
            .map(row => ({
              ...publicTicket(row),
              accountId: row.account_id
            }))
      })
    }

    if (action === '/support-tickets/detail') {
      if (request.method !== 'GET') {
        return json(
          {
            success: false,
            message:
              'Método não permitido.'
          },
          405,
          {
            Allow: 'GET'
          }
        )
      }

      const ticketId =
        normalizeText(
          new URL(request.url)
            .searchParams.get('id'),
          120
        )
      const ticket =
        await getTicketById(
          env,
          ticketId
        )

      if (!ticket) {
        return json(
          {
            success: false,
            message:
              'Pedido de apoio não encontrado.'
          },
          404
        )
      }

      const messages =
        await getTicketMessages(
          env,
          ticketId
        )

      return json({
        success: true,
        ticket: {
          ...publicTicket(ticket),
          accountId: ticket.account_id
        },
        messages:
          messages.map(publicMessage)
      })
    }

    if (
      action !== '/support-tickets/reply' &&
      action !== '/support-tickets/status'
    ) {
      return json(
        {
          success: false,
          message:
            'Endpoint administrativo de apoio não encontrado.'
        },
        404
      )
    }

    if (request.method !== 'POST') {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow: 'POST'
        }
      )
    }

    const body =
      await readJsonBody(request)
    const ticketId =
      normalizeText(body.ticketId, 120)
    const ticket =
      await getTicketById(
        env,
        ticketId
      )

    if (!ticket) {
      return json(
        {
          success: false,
          message:
            'Pedido de apoio não encontrado.'
        },
        404
      )
    }

    const now = Date.now()

    if (action === '/support-tickets/status') {
      const status =
        normalizeText(body.status, 40)

      if (!TICKET_STATUSES.has(status)) {
        return json(
          {
            success: false,
            message:
              'Estado de apoio inválido.'
          },
          400
        )
      }

      const closedAt =
        status === 'closed'
          ? now
          : null

      await env.MA_PROFESSOR_DB
        .prepare(
          `
            UPDATE ma_professor_support_tickets
            SET status = ?,
                updated_at = ?,
                closed_at = ?
            WHERE id = ?
          `
        )
        .bind(
          status,
          now,
          closedAt,
          ticketId
        )
        .run()

      const updated =
        await getTicketById(
          env,
          ticketId
        )

      return json({
        success: true,
        ticket: updated
          ? {
              ...publicTicket(updated),
              accountId:
                updated.account_id
            }
          : null
      })
    }

    if (ticket.status === 'closed') {
      return json(
        {
          success: false,
          message:
            'Este pedido já está fechado.'
        },
        409
      )
    }

    const message =
      normalizeText(
        body.message,
        MAX_MESSAGE_LENGTH
      )

    if (message.length < 2) {
      return json(
        {
          success: false,
          message:
            'Escreva uma resposta antes de enviar.'
        },
        400
      )
    }

    const messageId =
      `message-${globalThis.crypto.randomUUID()}`

    const result =
      await env.MA_PROFESSOR_DB.batch([
        env.MA_PROFESSOR_DB
          .prepare(
            `
              INSERT INTO ma_professor_support_messages (
                id,
                ticket_id,
                author_role,
                body,
                created_at
              ) VALUES (?, ?, 'admin', ?, ?)
            `
          )
          .bind(
            messageId,
            ticketId,
            message,
            now
          ),
        env.MA_PROFESSOR_DB
          .prepare(
            `
              UPDATE ma_professor_support_tickets
              SET status = 'waiting_professor',
                  updated_at = ?,
                  closed_at = NULL
              WHERE id = ?
            `
          )
          .bind(
            now,
            ticketId
          )
      ])

    if (
      result.length !== 2 ||
      result.some(item =>
        item.success !== true
      )
    ) {
      throw new SupportTicketApiError(
        'Não foi possível guardar a resposta.',
        500
      )
    }

    const messages =
      await getTicketMessages(
        env,
        ticketId
      )
    const updated =
      await getTicketById(
        env,
        ticketId
      )

    return json({
      success: true,
      ticket: updated
        ? {
            ...publicTicket(updated),
            accountId:
              updated.account_id
          }
        : null,
      messages:
        messages.map(publicMessage)
    })
  } catch (error) {
    if (
      error instanceof
        SupportTicketApiError
    ) {
      return json(
        {
          success: false,
          message: error.message
        },
        error.status
      )
    }

    console.error(
      'MA-Professor admin support ticket request failed',
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    )

    return json(
      {
        success: false,
        message:
          'Não foi possível concluir a operação de apoio.'
      },
      500
    )
  }
}
