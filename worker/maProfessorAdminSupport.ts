import {
  handleMAProfessorAdminApiRequest as handleExistingMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv as ExistingMaProfessorAdminEnv
} from './maProfessorAdminAtomicApproval'

import {
  handleMAProfessorSupportTicketAdminRequest,
  type MaProfessorSupportTicketEnv
} from './maProfessorSupportTickets'

export {
  isMAProfessorAdminApiPath
}

export type MaProfessorAdminEnv =
  ExistingMaProfessorAdminEnv &
  MaProfessorSupportTicketEnv

const ADMIN_PREFIX =
  '/api/admin/ma-professor'
const SUPPORT_PREFIX =
  `${ADMIN_PREFIX}/support-tickets`

function normalizeOrigin(
  value: string
) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isAllowedBrowserRequest(
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
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'X-Content-Type-Options':
          'nosniff',
        'X-Robots-Tag':
          'noindex, nofollow'
      }
    }
  )
}

function buildAdminProbe(
  source: Request
) {
  const url =
    new URL(source.url)

  url.pathname =
    `${ADMIN_PREFIX}/overview`
  url.search = ''
  url.hash = ''

  const headers =
    new Headers(source.headers)

  headers.delete('Content-Type')
  headers.delete('Content-Length')

  return new Request(
    url.toString(),
    {
      method: 'GET',
      headers
    }
  )
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
): Promise<Response | null> {
  const pathname =
    new URL(request.url).pathname

  if (
    pathname !== SUPPORT_PREFIX &&
    !pathname.startsWith(
      `${SUPPORT_PREFIX}/`
    )
  ) {
    return handleExistingMAProfessorAdminApiRequest(
      request,
      env
    )
  }

  const authResponse =
    await handleExistingMAProfessorAdminApiRequest(
      buildAdminProbe(request),
      env
    )

  if (
    !authResponse ||
    !authResponse.ok
  ) {
    return authResponse
  }

  if (
    request.method !== 'GET' &&
    !isAllowedBrowserRequest(request)
  ) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403
    )
  }

  const action =
    pathname.slice(
      ADMIN_PREFIX.length
    ) || '/'

  return handleMAProfessorSupportTicketAdminRequest(
    request,
    env,
    action
  )
}
