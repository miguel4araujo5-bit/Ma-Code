import {
  handleMaCodeAdminApiRequest,
  type MaCodeAdminEnv
} from './maCodeAdmin'

import {
  getMAProfessorAdminOverview
} from './maProfessorAccessAdminBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_ADMIN_API_PREFIX =
  '/api/admin/ma-professor'

export interface MaProfessorAdminEnv
  extends MaCodeAdminEnv,
    MaProfessorAccessEnv {}

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

async function verifyAdminSession(
  request: Request,
  env:
    MaProfessorAdminEnv
) {
  const sessionUrl =
    new URL(
      request.url
    )

  sessionUrl.pathname =
    '/api/admin/session'
  sessionUrl.search = ''
  sessionUrl.hash = ''

  const sessionRequest =
    new Request(
      sessionUrl.toString(),
      {
        method: 'GET',
        headers:
          request.headers
      }
    )

  return handleMaCodeAdminApiRequest(
    sessionRequest,
    env
  )
}

export function isMAProfessorAdminApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_ADMIN_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_ADMIN_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env:
    MaProfessorAdminEnv
) {
  const sessionResponse =
    await verifyAdminSession(
      request,
      env
    )

  if (
    !sessionResponse.ok
  ) {
    return sessionResponse
  }

  const url =
    new URL(
      request.url
    )

  const action =
    url.pathname.slice(
      MA_PROFESSOR_ADMIN_API_PREFIX.length
    ) || '/'

  switch (action) {
    case '/overview': {
      if (
        request.method !==
        'GET'
      ) {
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

      try {
        return await getMAProfessorAdminOverview(
          env
        )
      } catch (error) {
        console.error(
          'MA-Professor admin overview failed',
          {
            message:
              error instanceof Error
                ? error.message
                : String(
                    error
                  )
          }
        )

        return json(
          {
            success: false,
            message:
              'Não foi possível carregar os dados administrativos do MA-Professor.'
          },
          500
        )
      }
    }

    default:
      return json(
        {
          success: false,
          message:
            'Endpoint administrativo do MA-Professor não encontrado.'
        },
        404
      )
  }
}
