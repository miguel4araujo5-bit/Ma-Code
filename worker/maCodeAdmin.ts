export interface MaCodeAdminEnv {
  MA_CODE_ADMIN_PASSWORD?: string
  MA_CODE_ADMIN_SESSION_SECRET?: string
}

type JsonObject = Record<string, unknown>

interface AdminSessionPayload {
  version: 1
  issuedAt: number
  expiresAt: number
  nonce: string
}

class AdminApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AdminApiError'
    this.status = status
  }
}

export const MA_CODE_ADMIN_API_PREFIX = '/api/admin'

const ADMIN_COOKIE_NAME = '__Host-ma_code_admin'
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000
const MAX_BODY_BYTES = 2_000
const MIN_ADMIN_PASSWORD_LENGTH = 16
const MIN_SESSION_SECRET_LENGTH = 32

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const securityHeaders: Record<string, string> = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...securityHeaders,
      ...extraHeaders
    }
  })
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isLocalOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname

    return [
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ].includes(hostname)
  } catch {
    return false
  }
}

function isAllowedBrowserRequest(request: Request) {
  const requestOrigin = new URL(request.url).origin
  const origin = normalizeOrigin(
    request.headers.get('Origin') || ''
  )
  const referer = normalizeOrigin(
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

  return isLocalOrigin(candidate)
}

function getAdminConfiguration(env: MaCodeAdminEnv) {
  const password =
    env.MA_CODE_ADMIN_PASSWORD || ''

  const sessionSecret =
    env.MA_CODE_ADMIN_SESSION_SECRET || ''

  if (
    password.length < MIN_ADMIN_PASSWORD_LENGTH ||
    sessionSecret.length < MIN_SESSION_SECRET_LENGTH
  ) {
    throw new AdminApiError(
      'A administração MA-CODE ainda não está configurada no servidor.',
      503
    )
  }

  return {
    password,
    sessionSecret
  }
}

function isJsonObject(
  value: unknown
): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
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
    throw new AdminApiError(
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
    throw new AdminApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  const text = await request.text()

  if (
    encoder.encode(text).byteLength >
    MAX_BODY_BYTES
  ) {
    throw new AdminApiError(
      'O pedido é demasiado grande.',
      413
    )
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new AdminApiError(
      'O pedido enviado não contém JSON válido.',
      400
    )
  }

  if (!isJsonObject(parsed)) {
    throw new AdminApiError(
      'O pedido enviado não é válido.',
      400
    )
  }

  return parsed
}

function getCookieValue(
  request: Request,
  name: string
) {
  const cookieHeader =
    request.headers.get('Cookie') || ''

  for (
    const part of cookieHeader.split(';')
  ) {
    const [
      rawName,
      ...rawValueParts
    ] = part.trim().split('=')

    if (rawName === name) {
      return rawValueParts.join('=')
    }
  }

  return ''
}

function bytesToBase64Url(
  bytes: Uint8Array
) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function stringToBase64Url(
  value: string
) {
  return bytesToBase64Url(
    encoder.encode(value)
  )
}

function base64UrlToString(
  value: string
) {
  const normalized =
    value
      .replace(/-/g, '+')
      .replace(/_/g, '/')

  const padding =
    normalized.length % 4 === 0
      ? ''
      : '='.repeat(
          4 - (normalized.length % 4)
        )

  try {
    const binary =
      atob(normalized + padding)

    const bytes =
      Uint8Array.from(
        binary,
        character =>
          character.charCodeAt(0)
      )

    return decoder.decode(bytes)
  } catch {
    return null
  }
}

function timingSafeStringEqual(
  left: string,
  right: string
) {
  const maxLength =
    Math.max(
      left.length,
      right.length
    )

  let difference =
    left.length ^
    right.length

  for (
    let index = 0;
    index < maxLength;
    index += 1
  ) {
    difference |=
      (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0)
  }

  return difference === 0
}

async function passwordMatches(
  suppliedPassword: string,
  configuredPassword: string
) {
  const [
    suppliedDigest,
    configuredDigest
  ] =
    await Promise.all([
      globalThis.crypto.subtle.digest(
        'SHA-256',
        encoder.encode(
          suppliedPassword
        )
      ),
      globalThis.crypto.subtle.digest(
        'SHA-256',
        encoder.encode(
          configuredPassword
        )
      )
    ])

  return timingSafeStringEqual(
    bytesToBase64Url(
      new Uint8Array(
        suppliedDigest
      )
    ),
    bytesToBase64Url(
      new Uint8Array(
        configuredDigest
      )
    )
  )
}

async function signPayload(
  encodedPayload: string,
  secret: string
) {
  const key =
    await globalThis.crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      {
        name: 'HMAC',
        hash: 'SHA-256'
      },
      false,
      ['sign']
    )

  const signature =
    await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(
        encodedPayload
      )
    )

  return bytesToBase64Url(
    new Uint8Array(signature)
  )
}

function createNonce() {
  const bytes =
    new Uint8Array(18)

  globalThis.crypto.getRandomValues(
    bytes
  )

  return bytesToBase64Url(bytes)
}

async function createSessionToken(
  secret: string
) {
  const issuedAt =
    Date.now()

  const payload:
    AdminSessionPayload = {
      version: 1,
      issuedAt,
      expiresAt:
        issuedAt +
        SESSION_DURATION_MS,
      nonce:
        createNonce()
    }

  const encodedPayload =
    stringToBase64Url(
      JSON.stringify(payload)
    )

  const signature =
    await signPayload(
      encodedPayload,
      secret
    )

  return {
    token:
      `${encodedPayload}.${signature}`,
    payload
  }
}

async function verifySessionToken(
  token: string,
  secret: string
): Promise<AdminSessionPayload | null> {
  const [
    encodedPayload,
    signature,
    extra
  ] =
    token.split('.')

  if (
    !encodedPayload ||
    !signature ||
    extra
  ) {
    return null
  }

  const expectedSignature =
    await signPayload(
      encodedPayload,
      secret
    )

  if (
    !timingSafeStringEqual(
      signature,
      expectedSignature
    )
  ) {
    return null
  }

  const payloadText =
    base64UrlToString(
      encodedPayload
    )

  if (!payloadText) {
    return null
  }

  let parsed: unknown

  try {
    parsed =
      JSON.parse(
        payloadText
      ) as unknown
  } catch {
    return null
  }

  if (
    !isJsonObject(parsed) ||
    parsed.version !== 1 ||
    typeof parsed.issuedAt !==
      'number' ||
    typeof parsed.expiresAt !==
      'number' ||
    typeof parsed.nonce !==
      'string'
  ) {
    return null
  }

  if (
    !Number.isFinite(
      parsed.issuedAt
    ) ||
    !Number.isFinite(
      parsed.expiresAt
    ) ||
    parsed.expiresAt <=
      Date.now() ||
    parsed.issuedAt >
      Date.now() +
        60_000 ||
    parsed.expiresAt -
      parsed.issuedAt >
      SESSION_DURATION_MS +
        60_000
  ) {
    return null
  }

  return {
    version: 1,
    issuedAt:
      parsed.issuedAt,
    expiresAt:
      parsed.expiresAt,
    nonce:
      parsed.nonce
  }
}

function createSessionCookie(
  token: string
) {
  return [
    `${ADMIN_COOKIE_NAME}=${token}`,
    'Path=/',
    `Max-Age=${Math.floor(
      SESSION_DURATION_MS / 1000
    )}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ')
}

function clearSessionCookie() {
  return [
    `${ADMIN_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    'Secure',
    'SameSite=Strict'
  ].join('; ')
}

async function getAuthenticatedSession(
  request: Request,
  env: MaCodeAdminEnv
) {
  const {
    sessionSecret
  } =
    getAdminConfiguration(env)

  const token =
    getCookieValue(
      request,
      ADMIN_COOKIE_NAME
    )

  if (!token) {
    return null
  }

  return verifySessionToken(
    token,
    sessionSecret
  )
}

async function pauseAfterFailedLogin() {
  await new Promise<void>(
    resolve => {
      setTimeout(
        resolve,
        650
      )
    }
  )
}

function getErrorResponse(
  error: unknown
) {
  if (
    error instanceof
    AdminApiError
  ) {
    return json(
      {
        success: false,
        message:
          error.message
      },
      error.status
    )
  }

  return json(
    {
      success: false,
      message:
        'Não foi possível processar o pedido administrativo.'
    },
    500
  )
}

async function handleLogin(
  request: Request,
  env: MaCodeAdminEnv
) {
  if (
    request.method !== 'POST'
  ) {
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

  if (
    !isAllowedBrowserRequest(
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

  const body =
    await readJsonBody(
      request
    )

  const suppliedPassword =
    typeof body.password ===
      'string'
      ? body.password
      : ''

  if (
    !suppliedPassword ||
    suppliedPassword.length > 256
  ) {
    await pauseAfterFailedLogin()

    return json(
      {
        success: false,
        message:
          'Credenciais de administração inválidas.'
      },
      401
    )
  }

  const {
    password,
    sessionSecret
  } =
    getAdminConfiguration(env)

  const matches =
    await passwordMatches(
      suppliedPassword,
      password
    )

  if (!matches) {
    await pauseAfterFailedLogin()

    return json(
      {
        success: false,
        message:
          'Credenciais de administração inválidas.'
      },
      401
    )
  }

  const {
    token,
    payload
  } =
    await createSessionToken(
      sessionSecret
    )

  return json(
    {
      success: true,
      authenticated: true,
      expiresAt:
        new Date(
          payload.expiresAt
        ).toISOString()
    },
    200,
    {
      'Set-Cookie':
        createSessionCookie(
          token
        )
    }
  )
}

async function handleSession(
  request: Request,
  env: MaCodeAdminEnv
) {
  if (
    request.method !== 'GET'
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

  const session =
    await getAuthenticatedSession(
      request,
      env
    )

  if (!session) {
    return json(
      {
        success: false,
        authenticated: false,
        message:
          'Sessão administrativa inexistente ou expirada.'
      },
      401,
      {
        'Set-Cookie':
          clearSessionCookie()
      }
    )
  }

  return json({
    success: true,
    authenticated: true,
    expiresAt:
      new Date(
        session.expiresAt
      ).toISOString()
  })
}

async function handleLogout(
  request: Request
) {
  if (
    request.method !== 'POST'
  ) {
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

  if (
    !isAllowedBrowserRequest(
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

  return json(
    {
      success: true
    },
    200,
    {
      'Set-Cookie':
        clearSessionCookie()
    }
  )
}

export function isMaCodeAdminApiPath(
  pathname: string
) {
  return (
    pathname ===
      MA_CODE_ADMIN_API_PREFIX ||
    pathname.startsWith(
      `${MA_CODE_ADMIN_API_PREFIX}/`
    )
  )
}

export async function handleMaCodeAdminApiRequest(
  request: Request,
  env: MaCodeAdminEnv
) {
  const url =
    new URL(
      request.url
    )

  const action =
    url.pathname.slice(
      MA_CODE_ADMIN_API_PREFIX.length
    ) || '/'

  try {
    switch (action) {
      case '/login':
        return await handleLogin(
          request,
          env
        )

      case '/session':
        return await handleSession(
          request,
          env
        )

      case '/logout':
        return await handleLogout(
          request
        )

      default:
        return json(
          {
            success: false,
            message:
              'Endpoint administrativo não encontrado.'
          },
          404
        )
    }
  } catch (error) {
    return getErrorResponse(error)
  }
}
