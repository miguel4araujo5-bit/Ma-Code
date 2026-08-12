import {
  MA_CARTEIRA_WALLET_PATH,
  MaCarteiraWalletError,
  getMaCarteiraWallet
} from './maCarteiraWallet'

type HeaderMap = Record<string, string>

interface Env {
  CONTACT_ALLOWED_ORIGINS?: string
}

const ORIGIN_BLOCKED_MESSAGE =
  'Pedido bloqueado por origem inválida.'

const securityHeaders: HeaderMap = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Robots-Tag': 'noindex, nofollow'
}

const json = (
  body: unknown,
  status = 200,
  headers: HeaderMap = {}
) =>
  new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders,
        ...headers
      }
    }
  )

const normalizeOrigin = (
  value: string
) => {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const getConfiguredOrigins = (
  env: Env
) =>
  (
    env.CONTACT_ALLOWED_ORIGINS ||
    ''
  )
    .split(',')
    .map((origin) =>
      normalizeOrigin(
        origin.trim()
      )
    )
    .filter(Boolean)

const isLocalDevelopmentOrigin = (
  origin: string
) => {
  try {
    const { hostname } =
      new URL(origin)

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    )
  } catch {
    return false
  }
}

const getDefaultAllowedOrigins = (
  requestOrigin: string
) =>
  new Set([
    requestOrigin,
    'https://ma-code.pt',
    'https://www.ma-code.pt'
  ])

const isAllowedOrigin = (
  origin: string,
  requestOrigin: string,
  env: Env
) => {
  const normalizedOrigin =
    normalizeOrigin(origin)

  if (!normalizedOrigin) {
    return false
  }

  if (
    getDefaultAllowedOrigins(
      requestOrigin
    ).has(normalizedOrigin)
  ) {
    return true
  }

  if (
    isLocalDevelopmentOrigin(
      normalizedOrigin
    )
  ) {
    return true
  }

  return getConfiguredOrigins(
    env
  ).includes(normalizedOrigin)
}

const getRefererOrigin = (
  request: Request
) => {
  const referer =
    request.headers.get(
      'referer'
    )

  if (!referer) {
    return ''
  }

  return normalizeOrigin(
    referer
  )
}

const getVerifiedRequestOrigin = (
  request: Request,
  requestOrigin: string,
  env: Env
) => {
  const origin =
    request.headers.get(
      'origin'
    )

  if (origin) {
    return isAllowedOrigin(
      origin,
      requestOrigin,
      env
    )
      ? normalizeOrigin(origin)
      : ''
  }

  const refererOrigin =
    getRefererOrigin(request)

  if (!refererOrigin) {
    return ''
  }

  return isAllowedOrigin(
    refererOrigin,
    requestOrigin,
    env
  )
    ? refererOrigin
    : ''
}

const createCorsHeaders = (
  origin: string | null
): HeaderMap => {
  const normalizedOrigin =
    origin
      ? normalizeOrigin(origin)
      : ''

  if (!normalizedOrigin) {
    return {}
  }

  return {
    'Access-Control-Allow-Origin':
      normalizedOrigin,
    'Access-Control-Allow-Methods':
      'GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type',
    Vary: 'Origin'
  }
}

const getErrorMessage = (
  error: unknown
) => {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url =
      new URL(request.url)

    const requestOrigin =
      url.origin

    const origin =
      request.headers.get(
        'origin'
      )

    const refererOrigin =
      getRefererOrigin(
        request
      )

    const verifiedOrigin =
      getVerifiedRequestOrigin(
        request,
        requestOrigin,
        env
      )

    const corsHeaders =
      origin &&
      verifiedOrigin
        ? createCorsHeaders(
            verifiedOrigin
          )
        : {}

    const respond = (
      body: unknown,
      status = 200,
      headers: HeaderMap = {}
    ) =>
      json(
        body,
        status,
        {
          ...corsHeaders,
          ...headers
        }
      )

    if (
      url.pathname !==
      MA_CARTEIRA_WALLET_PATH
    ) {
      return respond(
        {
          success: false,
          message:
            'Endpoint não encontrado.'
        },
        404
      )
    }

    const hasSuppliedOrigin =
      Boolean(
        origin ||
        refererOrigin
      )

    if (
      hasSuppliedOrigin &&
      !verifiedOrigin
    ) {
      return respond(
        {
          success: false,
          message:
            ORIGIN_BLOCKED_MESSAGE
        },
        403
      )
    }

    if (
      request.method ===
      'OPTIONS'
    ) {
      const headers:
        HeaderMap = {
        Allow:
          'GET, OPTIONS',
        ...securityHeaders,
        ...corsHeaders
      }

      if (origin) {
        headers[
          'Access-Control-Max-Age'
        ] = '86400'
      }

      return new Response(
        null,
        {
          status: 204,
          headers
        }
      )
    }

    if (
      request.method !==
      'GET'
    ) {
      return respond(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405,
        {
          Allow:
            'GET, OPTIONS'
        }
      )
    }

    try {
      const result =
        await getMaCarteiraWallet(
          url
        )

      return respond({
        success: true,
        ...result
      })
    } catch (error) {
      if (
        error instanceof
        MaCarteiraWalletError
      ) {
        return respond(
          {
            success: false,
            message:
              error.message
          },
          error.status
        )
      }

      console.error(
        'MA-Carteira read worker request failed',
        {
          message:
            getErrorMessage(
              error
            )
        }
      )

      return respond(
        {
          success: false,
          message:
            'Não foi possível consultar os saldos deste endereço.'
        },
        500
      )
    }
  }
}
