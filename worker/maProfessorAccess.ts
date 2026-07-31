export const MA_PROFESSOR_ACCESS_API_PREFIX =
  '/api/ma-professor/access'

const STORAGE_KEY = 'ma-professor-access-state-v1'
const PRODUCT_NAME = 'MA-Professor'
const MAX_BODY_BYTES = 12_000
const BETA_DAYS = 30
const EXPIRING_DAYS = 7
const RENEWAL_GRACE_HOURS = 24
const MAX_SESSIONS_PER_EMAIL = 4
const SESSION_MAX_AGE_DAYS = 120

export type LicensePlan =
  | 'beta_30_days'
  | 'paid_30_days'
  | 'school_year'
  | 'courtesy_30_days'
  | 'courtesy_school_year'

export type LicenseStatus =
  | 'inactive'
  | 'active'
  | 'expiring'
  | 'renewal_pending'
  | 'expired'
  | 'revoked'

interface LicenseSummary {
  email: string
  plan: LicensePlan | null
  status: LicenseStatus
  validFrom: string | null
  validUntil: string | null
  daysRemaining: number | null
  renewalRequestedAt: string | null
}

interface StoredLicense {
  email: string
  plan: LicensePlan
  validFrom: number
  validUntil: number
  revokedAt: number | null
  renewalRequestedAt: number | null
  renewalRequestedPlan: LicensePlan | null
  deviceIds: string[]
  createdAt: number
  updatedAt: number
}

interface StoredSession {
  tokenHash: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
  revokedAt: number | null
}

interface StoredRenewalRequest {
  id: string
  email: string
  requestedPlan: 'paid_30_days' | 'school_year'
  amountCents: number
  currency: 'EUR'
  status: 'pending'
  requestedAt: number
}

interface AccessState {
  schemaVersion: 1
  licenses: Record<string, StoredLicense>
  sessions: Record<string, StoredSession>
  renewals: StoredRenewalRequest[]
  createdAt: number
  updatedAt: number
}

interface DurableObjectIdLike {}

interface DurableObjectStubLike {
  fetch(request: Request): Promise<Response>
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): DurableObjectIdLike
  get(id: DurableObjectIdLike): DurableObjectStubLike
}

interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

export interface MaProfessorAccessEnv {
  MA_PROFESSOR_ACCESS: DurableObjectNamespaceLike
  WEB3FORMS_ACCESS_KEY?: string
  WEB3FORMS_KEY?: string
}

type JsonBody = Record<string, unknown>

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

function createInitialState(): AccessState {
  const timestamp = Date.now()

  return {
    schemaVersion: 1,
    licenses: {},
    sessions: {},
    renewals: [],
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

function isAllowedOrigin(request: Request) {
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

  const allowed = new Set([
    requestOrigin,
    'https://ma-code.pt',
    'https://www.ma-code.pt'
  ])

  try {
    const hostname = new URL(candidate).hostname
    if (
      ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(candidate)
}

function normalizeEmail(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().slice(0, 180)
    : ''
}

function normalizeId(value: unknown, maxLength = 180) {
  return typeof value === 'string'
    ? value.trim().slice(0, maxLength)
    : ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 14)}`
}

function randomToken() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

async function hashToken(token: string) {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  )

  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function toIso(value: number | null) {
  return value === null ? null : new Date(value).toISOString()
}

function addDays(timestamp: number, days: number) {
  return timestamp + days * 24 * 60 * 60 * 1000
}

function getDaysRemaining(validUntil: number, now: number) {
  return Math.max(
    0,
    Math.ceil((validUntil - now) / (24 * 60 * 60 * 1000))
  )
}

function getLicenseStatus(
  license: StoredLicense,
  now: number
): LicenseStatus {
  if (license.revokedAt !== null) {
    return 'revoked'
  }

  const renewalGraceActive =
    license.renewalRequestedAt !== null &&
    now - license.renewalRequestedAt <=
      RENEWAL_GRACE_HOURS * 60 * 60 * 1000

  if (renewalGraceActive) {
    return 'renewal_pending'
  }

  if (license.validUntil <= now) {
    return 'expired'
  }

  if (
    getDaysRemaining(license.validUntil, now) <= EXPIRING_DAYS
  ) {
    return 'expiring'
  }

  return 'active'
}

function buildLicenseSummary(
  license: StoredLicense,
  now = Date.now()
): LicenseSummary {
  return {
    email: license.email,
    plan: license.plan,
    status: getLicenseStatus(license, now),
    validFrom: toIso(license.validFrom),
    validUntil: toIso(license.validUntil),
    daysRemaining: getDaysRemaining(license.validUntil, now),
    renewalRequestedAt: toIso(license.renewalRequestedAt)
  }
}

async function readBody(request: Request): Promise<JsonBody> {
  const contentType = request.headers.get('content-type') || ''

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('Formato de pedido inválido.')
  }

  const contentLength = Number(
    request.headers.get('content-length') || 0
  )

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    throw new Error('O pedido é demasiado grande.')
  }

  const text = await request.text()

  if (
    new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES
  ) {
    throw new Error('O pedido é demasiado grande.')
  }

  const parsed = JSON.parse(text) as unknown

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error('O pedido enviado não é válido.')
  }

  return parsed as JsonBody
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível processar o pedido.'
}

function getDurableObject(env: MaProfessorAccessEnv) {
  const id = env.MA_PROFESSOR_ACCESS.idFromName(
    'ma-professor-access-global'
  )
  return env.MA_PROFESSOR_ACCESS.get(id)
}

export function isMAProfessorAccessApiPath(pathname: string) {
  return (
    pathname === MA_PROFESSOR_ACCESS_API_PREFIX ||
    pathname.startsWith(`${MA_PROFESSOR_ACCESS_API_PREFIX}/`)
  )
}

export async function handleMAProfessorAccessApiRequest(
  request: Request,
  env: MaProfessorAccessEnv
) {
  const origin = normalizeOrigin(
    request.headers.get('Origin') || ''
  )
  const corsHeaders: Record<string, string> = {}

  if (origin && isAllowedOrigin(request)) {
    corsHeaders['Access-Control-Allow-Origin'] = origin
    corsHeaders.Vary = 'Origin'
  }

  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(request)) {
      return json(
        {
          success: false,
          message: 'Pedido bloqueado por origem inválida.'
        },
        403
      )
    }

    return new Response(null, {
      status: 204,
      headers: {
        ...securityHeaders,
        ...corsHeaders,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  if (request.method !== 'POST') {
    return json(
      {
        success: false,
        message: 'Método não permitido.'
      },
      405,
      {
        ...corsHeaders,
        Allow: 'POST, OPTIONS'
      }
    )
  }

  if (!isAllowedOrigin(request)) {
    return json(
      {
        success: false,
        message: 'Pedido bloqueado por origem inválida.'
      },
      403,
      corsHeaders
    )
  }

  const response = await getDurableObject(env).fetch(request)
  const headers = new Headers(response.headers)

  Object.entries(corsHeaders).forEach(([name, value]) => {
    headers.set(name, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

export class MaProfessorAccessDurableObject {
  private readonly state: DurableObjectStateLike
  private readonly env: MaProfessorAccessEnv
  private storedState: AccessState | null = null
  private operation: Promise<void>

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.state = state
    this.env = env
    this.operation = this.state.blockConcurrencyWhile(
      async () => {
        this.storedState =
          (await this.state.storage.get<AccessState>(STORAGE_KEY)) ||
          createInitialState()
        this.pruneSessions(this.storedState)
        await this.save()
      }
    )
  }

  fetch(request: Request): Promise<Response> {
    const response = this.operation.then(() =>
      this.handleRequest(request)
    )

    this.operation = response.then(
      () => undefined,
      () => undefined
    )

    return response
  }

  private async getState() {
    if (!this.storedState) {
      this.storedState =
        (await this.state.storage.get<AccessState>(STORAGE_KEY)) ||
        createInitialState()
    }

    return this.storedState
  }

  private async save() {
    if (!this.storedState) {
      return
    }

    this.storedState.updatedAt = Date.now()
    await this.state.storage.put(STORAGE_KEY, this.storedState)
  }

  private pruneSessions(state: AccessState) {
    const oldestAllowed = addDays(Date.now(), -SESSION_MAX_AGE_DAYS)

    for (const [tokenHash, session] of Object.entries(
      state.sessions
    )) {
      if (
        session.revokedAt !== null ||
        session.lastSeenAt < oldestAllowed
      ) {
        delete state.sessions[tokenHash]
      }
    }
  }

  private async handleRequest(request: Request) {
    const url = new URL(request.url)

    if (!isMAProfessorAccessApiPath(url.pathname)) {
      return json(
        {
          success: false,
          message: 'Endpoint não encontrado.'
        },
        404
      )
    }

    const action =
      url.pathname.slice(MA_PROFESSOR_ACCESS_API_PREFIX.length) ||
      '/'

    try {
      const body = await readBody(request)

      switch (action) {
        case '/start':
          return this.handleStart(body)
        case '/verify':
          return this.handleVerify(body)
        case '/renew':
          return this.handleRenew(body)
        case '/logout':
          return this.handleLogout(body)
        default:
          return json(
            {
              success: false,
              message: 'Endpoint não encontrado.'
            },
            404
          )
      }
    } catch (error) {
      const message = getErrorMessage(error)
      const status =
        message === 'O pedido é demasiado grande.'
          ? 413
          : message.includes('JSON') ||
              message.includes('Formato') ||
              message.includes('válido')
            ? 400
            : 500

      return json(
        {
          success: false,
          message
        },
        status
      )
    }
  }

  private async issueSession(
    state: AccessState,
    email: string,
    deviceId: string
  ) {
    const now = Date.now()
    const existing = Object.entries(state.sessions)
      .filter(([, session]) =>
        session.email === email && session.revokedAt === null
      )
      .sort(
        (left, right) =>
          right[1].lastSeenAt - left[1].lastSeenAt
      )

    for (const [tokenHash] of existing.slice(
      MAX_SESSIONS_PER_EMAIL - 1
    )) {
      delete state.sessions[tokenHash]
    }

    const token = randomToken()
    const tokenHash = await hashToken(token)

    state.sessions[tokenHash] = {
      tokenHash,
      email,
      deviceId,
      createdAt: now,
      lastSeenAt: now,
      revokedAt: null
    }

    return token
  }

  private async handleStart(body: JsonBody) {
    const email = normalizeEmail(body.email)
    const deviceId = normalizeId(body.deviceId)

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message: 'Indique um email válido.'
        },
        400
      )
    }

    if (deviceId.length < 12) {
      return json(
        {
          success: false,
          message: 'O identificador deste dispositivo não é válido.'
        },
        400
      )
    }

    const state = await this.getState()
    const now = Date.now()
    let license = state.licenses[email]

    if (!license) {
      license = {
        email,
        plan: 'beta_30_days',
        validFrom: now,
        validUntil: addDays(now, BETA_DAYS),
        revokedAt: null,
        renewalRequestedAt: null,
        renewalRequestedPlan: null,
        deviceIds: [deviceId],
        createdAt: now,
        updatedAt: now
      }
      state.licenses[email] = license
    } else if (!license.deviceIds.includes(deviceId)) {
      return json(
        {
          success: false,
          message:
            'Este email já foi ativado noutro dispositivo. Contacte a MA-CODE para transferir o acesso.'
        },
        409
      )
    }

    if (license.revokedAt !== null) {
      return json(
        {
          success: false,
          message: 'Esta licença foi revogada.'
        },
        403
      )
    }

    const token = await this.issueSession(
      state,
      email,
      deviceId
    )
    license.updatedAt = now
    await this.save()

    return json({
      success: true,
      token,
      license: buildLicenseSummary(license, now)
    })
  }

  private async authenticate(body: JsonBody) {
    const token = normalizeId(body.token, 256)
    const deviceId = normalizeId(body.deviceId)

    if (!token || !deviceId) {
      return null
    }

    const state = await this.getState()
    const tokenHash = await hashToken(token)
    const session = state.sessions[tokenHash]

    if (
      !session ||
      session.revokedAt !== null ||
      session.deviceId !== deviceId
    ) {
      return null
    }

    const license = state.licenses[session.email]

    if (!license) {
      return null
    }

    session.lastSeenAt = Date.now()

    return {
      state,
      tokenHash,
      session,
      license
    }
  }

  private async handleVerify(body: JsonBody) {
    const authenticated = await this.authenticate(body)

    if (!authenticated) {
      return json(
        {
          success: false,
          message: 'A sessão já não é válida.'
        },
        401
      )
    }

    await this.save()

    return json({
      success: true,
      license: buildLicenseSummary(authenticated.license)
    })
  }

  private async handleRenew(body: JsonBody) {
    const authenticated = await this.authenticate(body)

    if (!authenticated) {
      return json(
        {
          success: false,
          message: 'A sessão já não é válida.'
        },
        401
      )
    }

    const requestedPlan = normalizeId(body.requestedPlan)

    if (
      requestedPlan !== 'paid_30_days' &&
      requestedPlan !== 'school_year'
    ) {
      return json(
        {
          success: false,
          message: 'Escolha um plano de renovação válido.'
        },
        400
      )
    }

    const now = Date.now()
    const { state, license } = authenticated
    const recentRequest =
      license.renewalRequestedAt !== null &&
      now - license.renewalRequestedAt <=
        RENEWAL_GRACE_HOURS * 60 * 60 * 1000

    if (!recentRequest) {
      const amountCents =
        requestedPlan === 'paid_30_days' ? 349 : 1500
      const renewal: StoredRenewalRequest = {
        id: createId('renewal'),
        email: license.email,
        requestedPlan,
        amountCents,
        currency: 'EUR',
        status: 'pending',
        requestedAt: now
      }

      state.renewals.unshift(renewal)
      state.renewals = state.renewals.slice(0, 2000)
      license.renewalRequestedAt = now
      license.renewalRequestedPlan = requestedPlan
      license.updatedAt = now
      await this.save()
      await this.notifyRenewal(renewal)
    } else {
      await this.save()
    }

    return json({
      success: true,
      license: buildLicenseSummary(license, now),
      message:
        'Pedido registado. Aguarde até 24 horas pela confirmação da MA-CODE.'
    })
  }

  private async handleLogout(body: JsonBody) {
    const authenticated = await this.authenticate(body)

    if (authenticated) {
      delete authenticated.state.sessions[authenticated.tokenHash]
      await this.save()
    }

    return json({ success: true })
  }

  private async notifyRenewal(
    renewal: StoredRenewalRequest
  ) {
    const accessKey = (
      this.env.WEB3FORMS_ACCESS_KEY ||
      this.env.WEB3FORMS_KEY ||
      ''
    ).trim()

    if (!accessKey) {
      console.warn('MA-Professor renewal notification not sent', {
        reason: 'WEB3FORMS access key missing',
        renewalId: renewal.id,
        email: renewal.email
      })
      return
    }

    const planLabel =
      renewal.requestedPlan === 'paid_30_days'
        ? 'Mensal · 3,49 €'
        : 'Ano letivo · 15 €'

    try {
      const response = await fetch(
        'https://api.web3forms.com/submit',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            access_key: accessKey,
            subject: `Pedido de renovação ${PRODUCT_NAME}`,
            from_name: 'MA-Code Website',
            name: 'Utilizador MA-Professor',
            email: renewal.email,
            replyto: renewal.email,
            product: PRODUCT_NAME,
            plan: planLabel,
            amount: `${(renewal.amountCents / 100)
              .toFixed(2)
              .replace('.', ',')} €`,
            renewal_id: renewal.id,
            requested_at: new Date(
              renewal.requestedAt
            ).toISOString(),
            message: [
              `Novo pedido de renovação do ${PRODUCT_NAME}.`,
              '',
              `Email: ${renewal.email}`,
              `Plano: ${planLabel}`,
              `Pedido: ${renewal.id}`,
              `Data: ${new Date(
                renewal.requestedAt
              ).toISOString()}`
            ].join('\n')
          })
        }
      )

      if (!response.ok) {
        console.error('MA-Professor renewal notification rejected', {
          status: response.status,
          renewalId: renewal.id
        })
      }
    } catch (error) {
      console.error('MA-Professor renewal notification failed', {
        message: getErrorMessage(error),
        renewalId: renewal.id
      })
    }
  }
}
