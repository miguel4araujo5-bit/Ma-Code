const PUBLIC_REQUEST_PATH =
  '/api/ma-professor/access/request'

const MAX_NEW_REQUEST_AGE_MS =
  2 * 60 * 1000

type JsonObject =
  Record<string, unknown>

export interface MAProfessorAccessNotificationEnv {
  WEB3FORMS_ACCESS_KEY?: string
  WEB3FORMS_KEY?: string
}

function normalizeEmail(
  value: unknown
) {
  return typeof value ===
    'string'
    ? value
        .trim()
        .toLowerCase()
        .slice(0, 180)
    : ''
}

function isValidEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  )
}

function readRequestedAt(
  value: unknown
) {
  if (
    typeof value !==
      'string' ||
    !value
  ) {
    return null
  }

  const timestamp =
    Date.parse(value)

  return Number.isFinite(
    timestamp
  )
    ? {
        iso: value,
        timestamp
      }
    : null
}

export async function exposeMAProfessorAccessRequestNotification(
  request: Request,
  response: Response,
  env: MAProfessorAccessNotificationEnv
) {
  if (
    request.method !==
      'POST' ||
    new URL(
      request.url
    ).pathname !==
      PUBLIC_REQUEST_PATH ||
    !response.ok
  ) {
    return response
  }

  const accessKey =
    (
      env.WEB3FORMS_ACCESS_KEY ||
      env.WEB3FORMS_KEY ||
      ''
    ).trim()

  if (!accessKey) {
    console.warn(
      'MA-Professor browser notification bridge unavailable',
      {
        reason:
          'WEB3FORMS access key missing'
      }
    )

    return response
  }

  let body:
    JsonObject

  try {
    const parsed =
      await response
        .clone()
        .json()

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return response
    }

    body =
      parsed as JsonObject
  } catch {
    return response
  }

  const requestSummary =
    body.request

  if (
    body.success !==
      true ||
    !requestSummary ||
    typeof requestSummary !==
      'object' ||
    Array.isArray(
      requestSummary
    )
  ) {
    return response
  }

  const summary =
    requestSummary as JsonObject

  if (
    summary.status !==
      'pending'
  ) {
    return response
  }

  const email =
    normalizeEmail(
      summary.email
    )

  const requestedAt =
    readRequestedAt(
      summary.requestedAt
    )

  if (
    !isValidEmail(
      email
    ) ||
    !requestedAt
  ) {
    return response
  }

  const age =
    Date.now() -
    requestedAt.timestamp

  if (
    age < -30_000 ||
    age >
      MAX_NEW_REQUEST_AGE_MS
  ) {
    return response
  }

  const headers =
    new Headers(
      response.headers
    )

  headers.set(
    'Content-Type',
    'application/json; charset=utf-8'
  )

  headers.set(
    'Cache-Control',
    'no-store'
  )

  return new Response(
    JSON.stringify({
      ...body,
      notification: {
        provider:
          'web3forms',
        accessKey,
        requestedAt:
          requestedAt.iso
      }
    }),
    {
      status:
        response.status,
      statusText:
        response.statusText,
      headers
    }
  )
}
