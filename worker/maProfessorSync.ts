import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

export const MA_PROFESSOR_SYNC_API_PREFIX =
  '/api/ma-professor/sync'

const ACCESS_VERIFY_PATH =
  '/api/ma-professor/access/verify'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const MAX_BODY_BYTES = 12_000

type JsonBody = Record<string, unknown>

interface D1PreparedStatementLike {
  bind(
    ...values: unknown[]
  ): D1PreparedStatementLike

  first<T = Record<string, unknown>>(): Promise<T | null>
}

interface D1DatabaseLike {
  prepare(
    query: string
  ): D1PreparedStatementLike
}

export interface MaProfessorSyncEnv
  extends MaProfessorAccessEnv {
  MA_PROFESSOR_DB: D1DatabaseLike
}

interface AccessLicense {
  email: string
  status:
    | 'inactive'
    | 'active'
    | 'expiring'
    | 'renewal_pending'
    | 'expired'
    | 'revoked'
}

interface AccessVerifySuccess {
  success: true
  license: AccessLicense
}

interface AccessVerifyError {
  success: false
  message?: string
}

type AccessVerifyResult =
  | AccessVerifySuccess
  | AccessVerifyError

interface SyncProfileRow {
  server_revision: number
  crypto_version: number
  updated_at: number
}

class SyncApiError extends Error {
  readonly status: number

  constructor(
    message: string,
    status: number
  ) {
    super(message)
    this.name = 'SyncApiError'
    this.status = status
  }
}

const securityHeaders: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow'
}

function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
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
  const requestOrigin = new URL(
    request.url
  ).origin

  const origin = normalizeOrigin(
    request.headers.get('Origin') || ''
  )

  const referer = normalizeOrigin(
    request.headers.get('Referer') || ''
  )

  const candidate =
    origin || referer

  if (!candidate) {
    return false
  }

  const allowed = new Set([
    requestOrigin,
    'https://ma-code.pt',
    'https://www.ma-code.pt'
  ])

  try {
    const hostname = new URL(
      candidate
    ).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(candidate)
}

function normalizeId(
  value: unknown,
  maxLength = 256
) {
  return typeof value === 'string'
    ? value.trim().slice(
        0,
        maxLength
      )
    : ''
}

async function readBody(
  request: Request
): Promise<JsonBody> {
  const contentType =
    request.headers.get(
      'content-type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    throw new SyncApiError(
      'Formato de pedido inválido.',
      400
    )
  }

  const contentLength = Number(
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
    throw new SyncApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  const text =
    await request.text()

  if (
    new TextEncoder().encode(
      text
    ).byteLength >
    MAX_BODY_BYTES
  ) {
    throw new SyncApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new SyncApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new SyncApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed as JsonBody
}

function isUsableLicenseStatus(
  status: AccessLicense['status']
) {
  return (
    status === 'active' ||
    status === 'expiring' ||
    status ===
      'renewal_pending'
  )
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
        [
          'ma-professor-account-v1',
          normalizedEmail
        ].join(':')
      )
    )

  const value = Array.from(
    new Uint8Array(digest),
    byte =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')

  return `account-${value}`
}

async function verifyAccessSession(
  body: JsonBody,
  env: MaProfessorSyncEnv
) {
  const token = normalizeId(
    body.token
  )

  const deviceId = normalizeId(
    body.deviceId,
    180
  )

  if (
    !token ||
    !deviceId
  ) {
    throw new SyncApiError(
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
            'Content-Type':
              'application/json',
            Accept:
              'application/json'
          },
          body: JSON.stringify({
            token,
            deviceId
          })
        }
      )
    )

  let result: AccessVerifyResult | null =
    null

  try {
    result =
      await response.json() as AccessVerifyResult
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
      typeof result.message ===
        'string'
        ? result.message
        : 'A sessão já não é válida.'

    throw new SyncApiError(
      message,
      response.status === 403
        ? 403
        : 401
    )
  }

  if (
    !isUsableLicenseStatus(
      result.license.status
    )
  ) {
    throw new SyncApiError(
      'A licença não permite sincronizar dados neste momento.',
      403
    )
  }

  const accountId =
    await createAccountId(
      result.license.email
    )

  return {
    accountId
  }
}

async function handleStatus(
  body: JsonBody,
  env: MaProfessorSyncEnv
) {
  const authenticated =
    await verifyAccessSession(
      body,
      env
    )

  const profile =
    await env.MA_PROFESSOR_DB
      .prepare(
        `
          SELECT
            server_revision,
            crypto_version,
            updated_at
          FROM ma_professor_sync_profiles
          WHERE account_id = ?
            AND deleted_at IS NULL
          LIMIT 1
        `
      )
      .bind(
        authenticated.accountId
      )
      .first<SyncProfileRow>()

  return json({
    success: true,
    databaseReady: true,
    profileExists:
      profile !== null,
    serverRevision:
      profile?.server_revision ?? 0,
    cryptoVersion:
      profile?.crypto_version ?? null,
    updatedAt:
      profile
        ? new Date(
            profile.updated_at
          ).toISOString()
        : null
  })
}

function getErrorDetails(
  error: unknown
) {
  if (
    error instanceof SyncApiError
  ) {
    return {
      status: error.status,
      message: error.message
    }
  }

  console.error(
    'MA-Professor sync request failed',
    {
      message:
        error instanceof Error
          ? error.message
          : String(error)
    }
  )

  return {
    status: 500,
    message:
      'Não foi possível contactar o serviço de sincronização.'
  }
}

export function isMAProfessorSyncApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_PROFESSOR_SYNC_API_PREFIX ||
    pathname.startsWith(
      `${MA_PROFESSOR_SYNC_API_PREFIX}/`
    )
  )
}

export async function handleMAProfessorSyncApiRequest(
  request: Request,
  env: MaProfessorSyncEnv
) {
  const origin = normalizeOrigin(
    request.headers.get(
      'Origin'
    ) || ''
  )

  const corsHeaders: Record<
    string,
    string
  > = {}

  if (
    origin &&
    isAllowedOrigin(request)
  ) {
    corsHeaders[
      'Access-Control-Allow-Origin'
    ] = origin

    corsHeaders.Vary =
      'Origin'
  }

  if (
    request.method ===
    'OPTIONS'
  ) {
    if (
      !isAllowedOrigin(
        request
      )
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

    return new Response(
      null,
      {
        status: 204,
        headers: {
          ...securityHeaders,
          ...corsHeaders,
          'Access-Control-Allow-Headers':
            'Content-Type',
          'Access-Control-Allow-Methods':
            'POST, OPTIONS',
          'Access-Control-Max-Age':
            '86400'
        }
      }
    )
  }

  if (
    request.method !==
    'POST'
  ) {
    return json(
      {
        success: false,
        message:
          'Método não permitido.'
      },
      405,
      {
        ...corsHeaders,
        Allow:
          'POST, OPTIONS'
      }
    )
  }

  if (
    !isAllowedOrigin(
      request
    )
  ) {
    return json(
      {
        success: false,
        message:
          'Pedido bloqueado por origem inválida.'
      },
      403,
      corsHeaders
    )
  }

  const url =
    new URL(request.url)

  const action =
    url.pathname.slice(
      MA_PROFESSOR_SYNC_API_PREFIX.length
    ) || '/'

  try {
    const body =
      await readBody(
        request
      )

    switch (action) {
      case '/status':
        return await handleStatus(
          body,
          env
        )

      default:
        return json(
          {
            success: false,
            message:
              'Endpoint não encontrado.'
          },
          404,
          corsHeaders
        )
    }
  } catch (error) {
    const details =
      getErrorDetails(
        error
      )

    return json(
      {
        success: false,
        message:
          details.message
      },
      details.status,
      corsHeaders
    )
  }
}
