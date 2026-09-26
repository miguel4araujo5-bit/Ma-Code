import type {
  SupportTicket,
  SupportTicketMessage,
  SupportTicketStatus
} from '../../components/ma-professor/support/supportTicketClient'

const ADMIN_SUPPORT_ENDPOINT =
  '/api/admin/ma-professor/support-tickets'

export interface AdminSupportTicket
  extends SupportTicket {
  accountId: string
}

interface ApiErrorBody {
  message?: unknown
}

function normalizeMessage(
  value: unknown
) {
  return typeof value === 'string'
    ? value.trim().slice(0, 300)
    : ''
}

async function readResponse<T>(
  response: Response
): Promise<T> {
  let body: unknown = null

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
    typeof body === 'object'
      ? normalizeMessage(
          (body as ApiErrorBody)
            .message
        )
      : ''

  throw new Error(
    message ||
      'Não foi possível concluir a operação de suporte.'
  )
}

export async function listAdminSupportTickets() {
  const response =
    await fetch(
      ADMIN_SUPPORT_ENDPOINT,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      }
    )

  return readResponse<{
    success: true
    tickets: AdminSupportTicket[]
  }>(response)
}

export async function getAdminSupportTicket(
  ticketId: string
) {
  const url =
    new URL(
      `${ADMIN_SUPPORT_ENDPOINT}/detail`,
      window.location.origin
    )
  url.searchParams.set(
    'id',
    ticketId
  )

  const response =
    await fetch(
      url.pathname + url.search,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json'
        }
      }
    )

  return readResponse<{
    success: true
    ticket: AdminSupportTicket
    messages: SupportTicketMessage[]
  }>(response)
}

async function postAdminSupport<T>(
  action: 'reply' | 'status',
  payload:
    Record<string, unknown>
) {
  const response =
    await fetch(
      `${ADMIN_SUPPORT_ENDPOINT}/${action}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type':
            'application/json',
          Accept: 'application/json'
        },
        body:
          JSON.stringify(payload)
      }
    )

  return readResponse<T>(response)
}

export function replyAdminSupportTicket(
  ticketId: string,
  message: string
) {
  return postAdminSupport<{
    success: true
    ticket: AdminSupportTicket
    messages: SupportTicketMessage[]
  }>(
    'reply',
    {
      ticketId,
      message:
        message.trim().slice(0, 5000)
    }
  )
}

export function setAdminSupportTicketStatus(
  ticketId: string,
  status: SupportTicketStatus
) {
  return postAdminSupport<{
    success: true
    ticket: AdminSupportTicket | null
  }>(
    'status',
    {
      ticketId,
      status
    }
  )
}
