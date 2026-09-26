import {
  readMAProfessorStoredAccess
} from '../access/accessStorage'

import {
  createProblemReportDraft,
  getProblemReportScreen
} from './problemReportClient'

const SUPPORT_TICKETS_ENDPOINT =
  '/api/ma-professor/support-tickets'

export type SupportTicketCategory =
  | 'getting-started'
  | 'daily-work'
  | 'planning'
  | 'attendance'
  | 'security'
  | 'technical'
  | 'other'

export type SupportTicketStatus =
  | 'new'
  | 'in_review'
  | 'waiting_professor'
  | 'resolved'
  | 'closed'

export interface SupportTicket {
  id: string
  category: SupportTicketCategory
  subject: string
  status: SupportTicketStatus
  context: {
    appVersion: string | null
    screen: string | null
    browser: string | null
    os: string | null
  }
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

export interface SupportTicketMessage {
  id: string
  authorRole:
    | 'professor'
    | 'admin'
  body: string
  createdAt: string
}

interface ApiErrorBody {
  success?: boolean
  message?: unknown
}

function normalizeText(
  value: string,
  maxLength: number
) {
  return value
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function getSessionPayload() {
  const access =
    readMAProfessorStoredAccess()

  if (
    !access?.token ||
    !access.deviceId
  ) {
    throw new Error(
      'A sessão do MA-Professor já não está disponível. Volte a entrar antes de enviar um pedido de apoio.'
    )
  }

  return {
    token: access.token,
    deviceId: access.deviceId
  }
}

function readOperatingSystem() {
  if (typeof navigator === 'undefined') {
    return 'Sistema desconhecido'
  }

  const agent =
    navigator.userAgent || ''

  if (/iPhone|iPad|iPod/.test(agent)) {
    return 'iOS/iPadOS'
  }

  if (/Macintosh|Mac OS X/.test(agent)) {
    return 'macOS'
  }

  if (/Android/.test(agent)) {
    return 'Android'
  }

  if (/Windows/.test(agent)) {
    return 'Windows'
  }

  if (/Linux/.test(agent)) {
    return 'Linux'
  }

  return 'Outro sistema'
}

async function postSupport<T>(
  action: string,
  payload:
    Record<string, unknown> = {}
): Promise<T> {
  const response =
    await fetch(
      `${SUPPORT_TICKETS_ENDPOINT}/${action}`,
      {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type':
            'application/json',
          Accept:
            'application/json'
        },
        body:
          JSON.stringify({
            ...getSessionPayload(),
            ...payload
          })
      }
    )

  let body:
    unknown = null

  try {
    body = await response.json()
  } catch {
    body = null
  }

  if (
    response.ok &&
    body &&
    typeof body === 'object'
  ) {
    return body as T
  }

  const message =
    body &&
    typeof body === 'object' &&
    typeof (body as ApiErrorBody)
      .message === 'string'
      ? normalizeText(
          String(
            (body as ApiErrorBody)
              .message
          ),
          300
        )
      : ''

  throw new Error(
    message ||
      'Não foi possível contactar o apoio do MA-Professor.'
  )
}

export async function createSupportTicket(
  category: SupportTicketCategory,
  subject: string,
  message: string
) {
  const diagnostic =
    createProblemReportDraft(
      'Pedido de apoio',
      getProblemReportScreen()
    )

  return postSupport<{
    success: true
    ticket: SupportTicket
  }>(
    'create',
    {
      category,
      subject:
        normalizeText(
          subject,
          160
        ),
      message:
        normalizeText(
          message,
          5_000
        ),
      appVersion:
        diagnostic.version,
      screen:
        diagnostic.screen,
      browser:
        diagnostic.browser,
      os:
        readOperatingSystem()
    }
  )
}

export async function listSupportTickets() {
  return postSupport<{
    success: true
    tickets: SupportTicket[]
  }>('list')
}

export async function getSupportTicket(
  ticketId: string
) {
  return postSupport<{
    success: true
    ticket: SupportTicket
    messages: SupportTicketMessage[]
  }>(
    'detail',
    {
      ticketId:
        normalizeText(
          ticketId,
          120
        )
    }
  )
}

export async function replySupportTicket(
  ticketId: string,
  message: string
) {
  return postSupport<{
    success: true
    ticket: SupportTicket
    messages: SupportTicketMessage[]
  }>(
    'reply',
    {
      ticketId:
        normalizeText(
          ticketId,
          120
        ),
      message:
        normalizeText(
          message,
          5_000
        )
    }
  )
}
