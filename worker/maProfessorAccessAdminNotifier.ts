import {
  sendMAProfessorAdminAccessRequestEmail,
  type MAProfessorEmailEnv
} from './maProfessorEmailService'

const PUBLIC_REQUEST_PATH =
  '/api/ma-professor/access/request'

const NEW_REQUEST_WINDOW_MS =
  2 * 60 * 1000

type JsonObject = Record<string, unknown>

export interface MAProfessorAccessAdminNotifierEnv
  extends MAProfessorEmailEnv {}

function normalizeEmail(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 180)
    : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function readIsoDate(value: unknown) {
  if (typeof value !== 'string' || !value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? { iso: value, timestamp }
    : null
}

export async function notifyMAProfessorNewAccessRequest(
  request: Request,
  response: Response,
  env: MAProfessorAccessAdminNotifierEnv
) {
  if (
    request.method !== 'POST' ||
    new URL(request.url).pathname !== PUBLIC_REQUEST_PATH ||
    !response.ok
  ) {
    return
  }

  let body: JsonObject

  try {
    const parsed = await response.clone().json()
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return
    }
    body = parsed as JsonObject
  } catch {
    return
  }

  const requestSummary = body.request

  if (
    body.success !== true ||
    !requestSummary ||
    typeof requestSummary !== 'object' ||
    Array.isArray(requestSummary)
  ) {
    return
  }

  const summary = requestSummary as JsonObject
  if (summary.status !== 'pending') return

  const requesterEmail = normalizeEmail(summary.email)
  if (!isValidEmail(requesterEmail)) return

  const now = Date.now()
  const submittedAt = new Date(now).toISOString()
  const originalRequestedAt = readIsoDate(summary.requestedAt)

  const isNewRequest = Boolean(
    originalRequestedAt &&
    Math.abs(now - originalRequestedAt.timestamp) <=
      NEW_REQUEST_WINDOW_MS
  )

  const result = await sendMAProfessorAdminAccessRequestEmail(
    env,
    {
      requesterEmail,
      isNewRequest,
      submittedAt,
      originalRequestedAt:
        originalRequestedAt?.iso ?? null
    }
  )

  if (result.status === 'sent') {
    console.info(
      'MA-Professor admin access notification sent',
      {
        requesterEmail,
        isNewRequest,
        responseId: result.id || ''
      }
    )
    return
  }

  if (result.status === 'not_configured') {
    console.warn(
      'MA-Professor admin access notification not sent',
      {
        reason:
          'RESEND_API_KEY_MA_PROFESSOR missing',
        requesterEmail
      }
    )
    return
  }

  console.error(
    'MA-Professor admin access notification failed',
    {
      requesterEmail,
      status: result.status,
      message:
        result.error || 'Falha desconhecida.'
    }
  )
}
