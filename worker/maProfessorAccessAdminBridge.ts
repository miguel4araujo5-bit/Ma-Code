import {
  MaProfessorAccessDurableObject as BaseMaProfessorAccessDurableObject,
  type AccessRequestStatus,
  type LicensePlan,
  type LicenseStatus,
  type MaProfessorAccessEnv
} from './maProfessorAccess'

import {
  handleMAProfessorPaidAccessRequest
} from './maProfessorPaidAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const PUBLIC_ACCESS_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

const INTERNAL_ADMIN_OVERVIEW_PATH =
  '/__internal/ma-professor/admin/overview'

const INTERNAL_ADMIN_APPROVE_REQUEST_PATH =
  '/__internal/ma-professor/admin/requests/approve'

const INTERNAL_ADMIN_REJECT_REQUEST_PATH =
  '/__internal/ma-professor/admin/requests/reject'

const INTERNAL_ADMIN_COMMERCE_STATUS_PATH =
  '/__internal/ma-professor/admin/commerce/status'

const INTERNAL_ADMIN_COMMERCE_SELECT_PLAN_PATH =
  '/__internal/ma-professor/admin/commerce/select-plan'

const INTERNAL_ADMIN_COMMERCE_CONFIRM_PAYMENT_PATH =
  '/__internal/ma-professor/admin/commerce/confirm-payment'

const INTERNAL_ADMIN_COMMERCE_DISPENSE_PAYMENT_PATH =
  '/__internal/ma-professor/admin/commerce/dispense-payment'

const INTERNAL_ADMIN_LICENSE_REVOKE_PATH =
  '/__internal/ma-professor/admin/licenses/revoke'

const INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH =
  '/__internal/ma-professor/admin/credentials/status'

const INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

const INTERNAL_ADMIN_EMAIL_DISPATCH_STATUS_PATH =
  '/__internal/ma-professor/admin/requests/email-dispatch'

const EXPIRING_DAYS = 7
const RENEWAL_GRACE_HOURS = 24
const PASSWORD_HASH_ITERATIONS = 100_000
const PASSWORD_SALT_BYTES = 16

const GENERATED_PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const GENERATED_PASSWORD_GROUPS = 4
const GENERATED_PASSWORD_GROUP_LENGTH = 4

export type MAProfessorAdminAccessRequestDecision =
  | 'approve'
  | 'reject'

export type MAProfessorCommercialPlan =
  | 'paid_30_days'
  | 'school_year'

export type MAProfessorPaymentStatus =
  | 'not_started'
  | 'pending'
  | 'confirmed'
  | 'dispensed'

export type MAProfessorDecisionMode =
  | 'pilot'
  | 'commercial'

export type MAProfessorEmailDispatchStatus =
  | 'not_applicable'
  | 'not_configured'
  | 'pending'
  | 'sent'
  | 'failed'

interface StoredLicenseSnapshot {
  email: string
  plan: LicensePlan
  validFrom: number
  validUntil: number
  revokedAt: number | null
  renewalRequestedAt: number | null
  updatedAt?: number
}

interface StoredSessionSnapshot {
  tokenHash: string
  email: string
  deviceId: string
  createdAt: number
  lastSeenAt: number
  revokedAt: number | null
}

interface StoredAccessRequestSnapshot {
  id: string
  email: string
  status: AccessRequestStatus
  requestedAt: number
  approvedAt: number | null
  rejectedAt: number | null
  activatedAt: number | null
  failedActivationAttempts: number
  blockedUntil: number | null
  decisionMode?: MAProfessorDecisionMode
  emailDispatchStatus?: MAProfessorEmailDispatchStatus
  emailDispatchUpdatedAt?: number | null
  updatedAt: number
}

interface StoredAccessCredentialSnapshot {
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  activationCode?: string
  createdAt: number
  updatedAt: number
  authorizationId?: string
  authorizationPlan?: MAProfessorCommercialPlan
}

interface StoredRenewalRequestSnapshot {
  id: string
  email: string
  requestedPlan:
    | 'paid_30_days'
    | 'school_year'
  amountCents: number
  currency: 'EUR'
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
  requestedAt: number
  resolvedAt?: number | null
  updatedAt?: number
}

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >
  sessions?: Record<
    string,
    StoredSessionSnapshot
  >
  renewals?: StoredRenewalRequestSnapshot[]
  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >
  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >
  updatedAt?: number
}

interface StoredCommercialAuthorization {
  id: string
  email: string
  plan: MAProfessorCommercialPlan
  amountCents: number
  currency: 'EUR'
  selectedAt: number
  paymentConfirmedAt: number | null
  paymentDispensedAt?: number | null
  credentialIssuedAt: number | null
  createdAt: number
  updatedAt: number
}

interface StoredCommerceState {
  schemaVersion: 1
  authorizations: StoredCommercialAuthorization[]
  createdAt: number
  updatedAt: number
}

interface DurableObjectStorageLike {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>

  put(
    entries: Record<string, unknown>
  ): Promise<void>
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike

  blockConcurrencyWhile<T>(
    callback: () => Promise<T>
  ): Promise<T>
}

type JsonObject =
  Record<string, unknown>

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',
    Pragma:
      'no-cache',
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

function toIso(
  value:
    number |
    null |
    undefined
) {
  if (
    typeof value !==
      'number' ||
    !Number.isFinite(value)
  ) {
    return null
  }

  return new Date(
    value
  ).toISOString()
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

function normalizeCommercialPlan(
  value: unknown
): MAProfessorCommercialPlan | null {
  return value ===
      'paid_30_days' ||
    value ===
      'school_year'
    ? value
    : null
}

function isPilotLicensePlan(
  value:
    LicensePlan |
    null |
    undefined
) {
  return value ===
      'beta_30_days' ||
    value ===
      'courtesy_30_days' ||
    value ===
      'courtesy_school_year'
}

function getCommercialPlanAmount(
  plan: MAProfessorCommercialPlan
) {
  return plan ===
    'school_year'
    ? 1500
    : 349
}

function createInternalId(
  prefix: string
) {
  const uuid =
    globalThis.crypto
      .randomUUID?.()

  return uuid
    ? `${prefix}-${uuid}`
    : `${prefix}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 14)}`
}

async function readInternalJsonBody(
  request: Request
): Promise<JsonObject> {
  let parsed: unknown

  try {
    parsed =
      await request.json()
  } catch {
    throw new Error(
      'O pedido administrativo interno contém JSON inválido.'
    )
  }

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      'O pedido administrativo interno é inválido.'
    )
  }

  return parsed as JsonObject
}

function bytesToBase64(
  bytes: Uint8Array
) {
  let binary = ''

  for (const byte of bytes) {
    binary +=
      String.fromCharCode(byte)
  }

  return btoa(binary)
}

function toArrayBuffer(
  value: Uint8Array
): ArrayBuffer {
  const copy =
    new Uint8Array(
      value.byteLength
    )

  copy.set(value)

  return copy.buffer
}

async function hashPassword(
  password: string,
  salt: Uint8Array,
  iterations: number
) {
  const encodedPassword =
    new TextEncoder()
      .encode(password)

  const baseKey =
    await globalThis.crypto.subtle.importKey(
      'raw',
      toArrayBuffer(
        encodedPassword
      ),
      'PBKDF2',
      false,
      [
        'deriveBits'
      ]
    )

  const bits =
    await globalThis.crypto.subtle.deriveBits(
      {
        name:
          'PBKDF2',
        salt:
          toArrayBuffer(salt),
        iterations,
        hash:
          'SHA-256'
      },
      baseKey,
      256
    )

  return bytesToBase64(
    new Uint8Array(bits)
  )
}

function generatePassword() {
  const characterCount =
    GENERATED_PASSWORD_GROUPS *
    GENERATED_PASSWORD_GROUP_LENGTH

  const randomBytes =
    new Uint8Array(
      characterCount
    )

  globalThis.crypto.getRandomValues(
    randomBytes
  )

  const characters =
    Array.from(
      randomBytes,
      byte =>
        GENERATED_PASSWORD_ALPHABET[
          byte %
          GENERATED_PASSWORD_ALPHABET.length
        ]
    )

  const groups: string[] = []

  for (
    let index = 0;
    index <
      GENERATED_PASSWORD_GROUPS;
    index += 1
  ) {
    const start =
      index *
      GENERATED_PASSWORD_GROUP_LENGTH

    groups.push(
      characters
        .slice(
          start,
          start +
            GENERATED_PASSWORD_GROUP_LENGTH
        )
        .join('')
    )
  }

  return `MP-${groups.join('-')}`
}

function getDaysRemaining(
  validUntil: number,
  now: number
) {
  return Math.max(
    0,
    Math.ceil(
      (
        validUntil -
        now
      ) /
        (
          24 *
          60 *
          60 *
          1000
        )
    )
  )
}

function getLicenseStatus(
  license: StoredLicenseSnapshot,
  now: number
): LicenseStatus {
  if (
    license.revokedAt !==
    null
  ) {
    return 'revoked'
  }

  if (
    license.validUntil <=
    now
  ) {
    return 'expired'
  }

  const renewalGraceActive =
    license.renewalRequestedAt !==
      null &&
    now -
      license.renewalRequestedAt <=
      RENEWAL_GRACE_HOURS *
        60 *
        60 *
        1000

  if (renewalGraceActive) {
    return 'renewal_pending'
  }

  if (
    getDaysRemaining(
      license.validUntil,
      now
    ) <=
    EXPIRING_DAYS
  ) {
    return 'expiring'
  }

  return 'active'
}

function buildAccessRequestSummary(
  request: StoredAccessRequestSnapshot
) {
  return {
    email:
      request.email,
    status:
      request.status,
    requestedAt:
      toIso(request.requestedAt),
    approvedAt:
      toIso(request.approvedAt),
    rejectedAt:
      toIso(request.rejectedAt),
    activatedAt:
      toIso(request.activatedAt),
    decisionMode:
      request.decisionMode ??
      null,
    emailDispatchStatus:
      request.emailDispatchStatus ??
      null,
    emailDispatchUpdatedAt:
      toIso(
        request.emailDispatchUpdatedAt
      )
  }
}

function buildCredentialStatus(
  email: string,
  credential:
    StoredAccessCredentialSnapshot |
    undefined
) {
  return {
    email,
    hasCredential:
      Boolean(credential),
    activationCode:
      null,
    createdAt:
      credential
        ? toIso(
            credential.createdAt
          )
        : null,
    updatedAt:
      credential
        ? toIso(
            credential.updatedAt
          )
        : null
  }
}

function stripLegacyActivationCodes(
  state:
    AccessStateSnapshot |
    undefined
) {
  if (!state?.credentials) {
    return false
  }

  let changed = false

  for (
    const credential of
    Object.values(
      state.credentials
    )
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        credential,
        'activationCode'
      )
    ) {
      delete credential.activationCode
      changed = true
    }
  }

  return changed
}

function buildLicenseSummary(
  license: StoredLicenseSnapshot,
  now: number
) {
  return {
    email:
      license.email,
    plan:
      license.plan,
    status:
      getLicenseStatus(
        license,
        now
      ),
    validFrom:
      toIso(
        license.validFrom
      ),
    validUntil:
      toIso(
        license.validUntil
      ),
    daysRemaining:
      getDaysRemaining(
        license.validUntil,
        now
      ),
    renewalRequestedAt:
      toIso(
        license.renewalRequestedAt
      ),
    revokedAt:
      toIso(
        license.revokedAt
      )
  }
}

function createCommerceState():
  StoredCommerceState {
  const now = Date.now()

  return {
    schemaVersion: 1,
    authorizations: [],
    createdAt: now,
    updatedAt: now
  }
}

function normalizeCommercialAuthorization(
  authorization: StoredCommercialAuthorization
): StoredCommercialAuthorization {
  return {
    ...authorization,
    paymentDispensedAt:
      authorization.paymentDispensedAt ??
      null
  }
}

function normalizeCommerceState(
  stored:
    StoredCommerceState |
    undefined
): StoredCommerceState {
  if (
    !stored ||
    stored.schemaVersion !==
      1 ||
    !Array.isArray(
      stored.authorizations
    )
  ) {
    return createCommerceState()
  }

  return {
    ...stored,
    authorizations:
      stored.authorizations.map(
        normalizeCommercialAuthorization
      )
  }
}

function getLatestAuthorization(
  commerceState:
    StoredCommerceState,
  email: string
) {
  return commerceState.authorizations
    .filter(
      authorization =>
        authorization.email ===
        email
    )
    .sort(
      (left, right) =>
        right.createdAt -
        left.createdAt
    )[0] || null
}

function isPaymentResolved(
  authorization:
    StoredCommercialAuthorization |
    null
) {
  return Boolean(
    authorization &&
      (
        authorization.paymentConfirmedAt !==
          null ||
        authorization.paymentDispensedAt !==
          null
      )
  )
}

function buildCommercialStatus(
  email: string,
  authorization:
    StoredCommercialAuthorization |
    null
) {
  const paymentStatus:
    MAProfessorPaymentStatus =
    !authorization
      ? 'not_started'
      : authorization
          .paymentDispensedAt !==
        null
        ? 'dispensed'
        : authorization
            .paymentConfirmedAt !==
          null
          ? 'confirmed'
          : 'pending'

  return {
    email,
    authorizationId:
      authorization?.id ??
      null,
    plan:
      authorization?.plan ??
      null,
    amountCents:
      authorization
        ?.amountCents ??
      null,
    currency:
      'EUR' as const,
    paymentStatus,
    selectedAt:
      authorization
        ? toIso(
            authorization.selectedAt
          )
        : null,
    paymentConfirmedAt:
      authorization
        ? toIso(
            authorization.paymentConfirmedAt
          )
        : null,
    paymentDispensedAt:
      authorization
        ? toIso(
            authorization.paymentDispensedAt
          )
        : null,
    credentialIssuedAt:
      authorization
        ? toIso(
            authorization.credentialIssuedAt
          )
        : null,
    canGenerateCredential:
      Boolean(
        authorization &&
        isPaymentResolved(
          authorization
        ) &&
        authorization
          .credentialIssuedAt ===
          null
      )
  }
}

function buildOverview(
  state:
    AccessStateSnapshot |
    undefined
) {
  const now = Date.now()

  const accessRequests =
    Object.values(
      state?.accessRequests ||
        {}
    )
      .map(
        request =>
          buildAccessRequestSummary(
            request
          )
      )
      .sort(
        (left, right) =>
          (
            right.requestedAt
              ? new Date(
                  right.requestedAt
                ).getTime()
              : 0
          ) -
          (
            left.requestedAt
              ? new Date(
                  left.requestedAt
                ).getTime()
              : 0
          )
      )

  const licenses =
    Object.values(
      state?.licenses ||
        {}
    )
      .map(
        license =>
          buildLicenseSummary(
            license,
            now
          )
      )
      .sort(
        (left, right) =>
          left.email.localeCompare(
            right.email
          )
      )

  const renewals =
    [
      ...(state?.renewals || [])
    ]
      .sort(
        (left, right) =>
          right.requestedAt -
          left.requestedAt
      )
      .map(
        renewal => {
          const requestedAt =
            toIso(
              renewal.requestedAt
            ) ||
            new Date(0)
              .toISOString()

          const resolvedAt =
            toIso(
              renewal.resolvedAt
            )

          const updatedAt =
            toIso(
              renewal.updatedAt
            ) ||
            resolvedAt ||
            requestedAt

          return {
            id:
              renewal.id,
            email:
              renewal.email,
            requestedPlan:
              renewal.requestedPlan,
            amountCents:
              renewal.amountCents,
            currency:
              renewal.currency,
            status:
              renewal.status,
            requestedAt,
            resolvedAt,
            createdAt:
              requestedAt,
            updatedAt
          }
        }
      )

  return {
    success:
      true as const,
    accessRequests,
    licenses,
    renewals,
    generatedAt:
      new Date(now)
        .toISOString()
  }
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly env:
    MaProfessorAccessEnv

  private base:
    BaseMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.state = state
    this.env = env
    this.base =
      new BaseMaProfessorAccessDurableObject(
        state,
        env
      )
  }

  fetch(
    request: Request
  ): Promise<Response> {
    const response =
      this.operation.then(
        () =>
          this.handleRequest(
            request
          )
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private refreshBase() {
    this.base =
      new BaseMaProfessorAccessDurableObject(
        this.state,
        this.env
      )
  }

  private async readAccessState() {
    const state =
      await this.state.storage.get<AccessStateSnapshot>(
        STORAGE_KEY
      )

    if (
      state &&
      stripLegacyActivationCodes(
        state
      )
    ) {
      await this.state.storage.put(
        STORAGE_KEY,
        state
      )

      this.refreshBase()
    }

    return state
  }

  private async readCommerceState() {
    const stored =
      await this.state.storage.get<StoredCommerceState>(
        COMMERCE_STORAGE_KEY
      )

    return normalizeCommerceState(
      stored
    )
  }

  private async handlePublicActivationSafetyGate(
    request: Request
  ): Promise<Response | null> {
    if (
      request.method !==
      'POST'
    ) {
      return null
    }

    let body: JsonObject

    try {
      body =
        await request
          .clone()
          .json() as JsonObject
    } catch {
      return null
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return null
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest ||
      accessRequest.status !==
        'approved' ||
      state.licenses?.[email]
    ) {
      return null
    }

    const commerceState =
      await this.readCommerceState()

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    if (!authorization) {
      const credential =
        state.credentials?.[
          email
        ]

      const existingLicense =
        state.licenses?.[
          email
        ]

      const pilotAccess =
        !existingLicense ||
        isPilotLicensePlan(
          existingLicense.plan
        )

      if (
        credential?.authorizationId ||
        credential?.authorizationPlan ||
        !pilotAccess
      ) {
        return json(
          {
            success: false,
            message:
              'A credencial comercial desta conta não tem uma autorização disponível. Contacte a MA-CODE.'
          },
          409
        )
      }

      return null
    }

    if (
      isPaymentResolved(
        authorization
      ) &&
      authorization.credentialIssuedAt
    ) {
      return json(
        {
          success: false,
          message:
            'A autorização comercial está registada, mas a ativação do novo plano ainda não está disponível. Aguarde indicação da MA-CODE.'
        },
        409
      )
    }

    return json(
      {
        success: false,
        message:
          'Esta conta ainda não possui uma autorização comercial pronta para ativação.'
      },
      409
    )
  }

  private async handleAccessRequestDecision(
    request: Request,
    decision:
      MAProfessorAdminAccessRequestDecision
  ) {
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
          Allow: 'POST'
        }
      )
    }

    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status !==
      'pending'
    ) {
      return json(
        {
          success: false,
          message:
            'Este pedido já não está pendente.',
          request:
            buildAccessRequestSummary(
              accessRequest
            )
        },
        409
      )
    }

    const commerceState =
      await this.readCommerceState()

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    const decisionMode:
      MAProfessorDecisionMode =
      authorization
        ? 'commercial'
        : 'pilot'

    const now = Date.now()

    if (
      decision ===
      'approve'
    ) {
      accessRequest.status =
        'approved'
      accessRequest.approvedAt =
        now
      accessRequest.rejectedAt =
        null
    } else {
      accessRequest.status =
        'rejected'
      accessRequest.rejectedAt =
        now
      accessRequest.approvedAt =
        null
    }

    accessRequest.decisionMode =
      decisionMode

    accessRequest.emailDispatchStatus =
      decisionMode ===
        'commercial'
        ? 'not_applicable'
        : 'pending'

    accessRequest.emailDispatchUpdatedAt =
      now

    accessRequest.updatedAt = now
    state.updatedAt = now

    await this.state.storage.put(
      STORAGE_KEY,
      state
    )

    this.refreshBase()

    return json({
      success: true,
      message:
        decision ===
        'approve'
          ? 'Pedido aprovado.'
          : 'Pedido rejeitado.',
      request:
        buildAccessRequestSummary(
          accessRequest
        ),
      decisionMode,
      emailDispatchStatus:
        accessRequest.emailDispatchStatus,
      emailDispatchUpdatedAt:
        toIso(
          accessRequest.emailDispatchUpdatedAt
        )
    })
  }

  private async handleEmailDispatchStatusUpdate(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const status =
      body.status

    const validStatus =
      status ===
        'not_applicable' ||
      status ===
        'not_configured' ||
      status === 'pending' ||
      status === 'sent' ||
      status === 'failed'

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    if (!validStatus) {
      return json(
        {
          success: false,
          message:
            'Indique um estado de envio válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status ===
      'pending'
    ) {
      return json(
        {
          success: false,
          message:
            'O estado de envio só pode ser atualizado depois da decisão do pedido.'
        },
        409
      )
    }

    const decisionMode =
      accessRequest.decisionMode

    if (
      decisionMode ===
        'commercial' &&
      status !==
        'not_applicable'
    ) {
      return json(
        {
          success: false,
          message:
            'Pedidos comerciais não utilizam o envio automático da fase piloto.'
        },
        409
      )
    }

    if (
      decisionMode ===
        'pilot' &&
      status ===
        'not_applicable'
    ) {
      return json(
        {
          success: false,
          message:
            'Pedidos piloto devem manter um estado explícito para o envio automático.'
        },
        409
      )
    }

    const now = Date.now()

    accessRequest.emailDispatchStatus =
      status as MAProfessorEmailDispatchStatus

    accessRequest.emailDispatchUpdatedAt =
      now

    accessRequest.updatedAt = now
    state.updatedAt = now

    await this.state.storage.put(
      STORAGE_KEY,
      state
    )

    this.refreshBase()

    return json({
      success: true,
      message:
        'Estado do envio automático atualizado.',
      request:
        buildAccessRequestSummary(
          accessRequest
        )
    })
  }

  private async handleLicenseRevoke(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const license =
      state?.licenses?.[
        email
      ]

    if (
      !state ||
      !license
    ) {
      return json(
        {
          success: false,
          message:
            'A licença não foi encontrada.'
        },
        404
      )
    }

    const now = Date.now()

    const alreadyRevoked =
      license.revokedAt !==
      null

    if (!alreadyRevoked) {
      license.revokedAt =
        now

      license.updatedAt =
        now
    }

    let sessionsRevoked = 0

    for (
      const session of
      Object.values(
        state.sessions || {}
      )
    ) {
      if (
        session.email ===
          email &&
        session.revokedAt ===
          null
      ) {
        session.revokedAt =
          now

        sessionsRevoked += 1
      }
    }

    if (
      !alreadyRevoked ||
      sessionsRevoked > 0
    ) {
      state.updatedAt =
        now

      await this.state.storage.put(
        STORAGE_KEY,
        state
      )

      this.refreshBase()
    }

    const responseNow =
      Date.now()

    return json({
      success: true,
      message:
        alreadyRevoked
          ? 'A licença já se encontrava revogada. As sessões ativas foram novamente verificadas.'
          : 'Licença revogada. As sessões ativas desta conta foram invalidadas.',
      license:
        buildLicenseSummary(
          license,
          responseNow
        )
    })
  }

  private async handleCommerceStatus(
    request: Request
  ) {
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

    const url =
      new URL(request.url)

    const email =
      normalizeEmail(
        url.searchParams.get(
          'email'
        )
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'A conta não foi encontrada.'
        },
        404
      )
    }

    const commerceState =
      await this.readCommerceState()

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    return json({
      success: true,
      commerce:
        buildCommercialStatus(
          email,
          authorization
        )
    })
  }

  private async handleCommerceSelectPlan(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    const plan =
      normalizeCommercialPlan(
        body.plan
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    if (!plan) {
      return json(
        {
          success: false,
          message:
            'Selecione um plano válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status !==
      'approved'
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido tem de estar aprovado antes de recuperar um pedido antigo sem plano.'
        },
        409
      )
    }

    const commerceState =
      await this.readCommerceState()

    const latestAuthorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    if (latestAuthorization) {
      if (
        latestAuthorization.plan !==
        plan
      ) {
        return json(
          {
            success: false,
            message:
              'O plano foi escolhido pelo professor no pedido e não pode ser alterado pelo MA-ADMIN.'
          },
          409
        )
      }

      return json({
        success: true,
        message:
          'O plano já tinha sido escolhido pelo professor no pedido de acesso.',
        commerce:
          buildCommercialStatus(
            email,
            latestAuthorization
          )
      })
    }

    const now = Date.now()

    const authorization:
      StoredCommercialAuthorization = {
        id:
          createInternalId(
            'authorization'
          ),
        email,
        plan,
        amountCents:
          getCommercialPlanAmount(
            plan
          ),
        currency:
          'EUR',
        selectedAt:
          now,
        paymentConfirmedAt:
          null,
        paymentDispensedAt:
          null,
        credentialIssuedAt:
          null,
        createdAt:
          now,
        updatedAt:
          now
      }

    commerceState.authorizations.push(
      authorization
    )

    commerceState.updatedAt = now

    await this.state.storage.put(
      COMMERCE_STORAGE_KEY,
      commerceState
    )

    return json({
      success: true,
      message:
        'Pedido antigo recuperado com o plano indicado. Para pedidos novos, o plano vem sempre escolhido pelo professor.',
      commerce:
        buildCommercialStatus(
          email,
          authorization
        )
    })
  }

  private async getApprovedAuthorization(
    request: Request
  ) {
    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return {
        response:
          json(
            {
              success: false,
              message:
                error instanceof Error
                  ? error.message
                  : 'Pedido administrativo inválido.'
            },
            400
          )
      }
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return {
        response:
          json(
            {
              success: false,
              message:
                'Indique um email válido.'
            },
            400
          )
      }
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return {
        response:
          json(
            {
              success: false,
              message:
                'O pedido de acesso não foi encontrado.'
            },
            404
          )
      }
    }

    if (
      accessRequest.status !==
      'approved'
    ) {
      return {
        response:
          json(
            {
              success: false,
              message:
                'O pedido tem de estar aprovado antes de validar o estado comercial.'
            },
            409
          )
      }
    }

    const commerceState =
      await this.readCommerceState()

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    if (!authorization) {
      return {
        response:
          json(
            {
              success: false,
              message:
                'Este pedido ainda não tem um plano associado. Se for um pedido antigo, recupere primeiro o plano.'
            },
            409
          )
      }
    }

    return {
      response: null,
      email,
      state,
      accessRequest,
      commerceState,
      authorization
    }
  }

  private async handleCommerceConfirmPayment(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    const lookup =
      await this.getApprovedAuthorization(
        request
      )

    if (lookup.response) {
      return lookup.response
    }

    const {
      email,
      commerceState,
      authorization
    } = lookup

    if (
      !email ||
      !commerceState ||
      !authorization
    ) {
      return json(
        {
          success: false,
          message:
            'Não foi possível validar a autorização comercial.'
        },
        500
      )
    }

    if (
      authorization.credentialIssuedAt !==
      null
    ) {
      return json(
        {
          success: false,
          message:
            'Esta autorização já originou uma senha. Para um novo pagamento será necessária uma nova autorização.'
        },
        409
      )
    }

    if (
      authorization.paymentDispensedAt !==
      null
    ) {
      return json(
        {
          success: false,
          message:
            'Este acesso foi marcado como pagamento dispensado e não pode ser convertido em pagamento confirmado.'
        },
        409
      )
    }

    if (
      authorization.paymentConfirmedAt ===
      null
    ) {
      const now = Date.now()

      authorization.paymentConfirmedAt =
        now

      authorization.updatedAt =
        now

      commerceState.updatedAt =
        now

      await this.state.storage.put(
        COMMERCE_STORAGE_KEY,
        commerceState
      )
    }

    return json({
      success: true,
      message:
        'Pagamento confirmado. A geração da nova senha está agora autorizada.',
      commerce:
        buildCommercialStatus(
          email,
          authorization
        )
    })
  }

  private async handleCommerceDispensePayment(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    const lookup =
      await this.getApprovedAuthorization(
        request
      )

    if (lookup.response) {
      return lookup.response
    }

    const {
      email,
      commerceState,
      authorization
    } = lookup

    if (
      !email ||
      !commerceState ||
      !authorization
    ) {
      return json(
        {
          success: false,
          message:
            'Não foi possível validar a autorização comercial.'
        },
        500
      )
    }

    if (
      authorization.credentialIssuedAt !==
      null
    ) {
      return json(
        {
          success: false,
          message:
            'Esta autorização já originou uma senha. O estado do pagamento já não pode ser alterado.'
        },
        409
      )
    }

    if (
      authorization.paymentConfirmedAt !==
      null
    ) {
      return json(
        {
          success: false,
          message:
            'Este pagamento já foi confirmado e não pode ser marcado como dispensado.'
        },
        409
      )
    }

    if (
      authorization.paymentDispensedAt ===
      null
    ) {
      const now = Date.now()

      authorization.paymentDispensedAt =
        now

      authorization.updatedAt =
        now

      commerceState.updatedAt =
        now

      await this.state.storage.put(
        COMMERCE_STORAGE_KEY,
        commerceState
      )
    }

    return json({
      success: true,
      message:
        'Pagamento dispensado pela MA-CODE. A geração da nova senha está agora autorizada.',
      commerce:
        buildCommercialStatus(
          email,
          authorization
        )
    })
  }

  private async handleCredentialStatus(
    request: Request
  ) {
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

    const url =
      new URL(request.url)

    const email =
      normalizeEmail(
        url.searchParams.get(
          'email'
        )
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'A conta não foi encontrada.'
        },
        404
      )
    }

    const credential =
      state.credentials?.[
        email
      ]

    return json({
      success: true,
      credential:
        buildCredentialStatus(
          email,
          credential
        )
    })
  }

  private async handleCredentialGenerate(
    request: Request
  ) {
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
          Allow: 'POST'
        }
      )
    }

    let body: JsonObject

    try {
      body =
        await readInternalJsonBody(
          request
        )
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Pedido administrativo inválido.'
        },
        400
      )
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return json(
        {
          success: false,
          message:
            'Indique um email válido.'
        },
        400
      )
    }

    const state =
      await this.readAccessState()

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    if (
      !state ||
      !accessRequest
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (
      accessRequest.status !==
      'approved'
    ) {
      return json(
        {
          success: false,
          message:
            'O pedido tem de estar aprovado antes de gerar a senha.'
        },
        409
      )
    }

    const commerceState =
      await this.readCommerceState()

    const authorization =
      getLatestAuthorization(
        commerceState,
        email
      )

    const existingLicense =
      state.licenses?.[
        email
      ]

    const pilotAccess =
      !authorization &&
      (
        !existingLicense ||
        isPilotLicensePlan(
          existingLicense.plan
        )
      )

    if (
      !authorization &&
      !pilotAccess
    ) {
      return json(
        {
          success: false,
          message:
            'Esta conta utiliza uma licença comercial, mas não tem uma autorização comercial disponível para emitir uma nova senha.'
        },
        409
      )
    }

    if (authorization) {
      if (
        !isPaymentResolved(
          authorization
        )
      ) {
        return json(
          {
            success: false,
            message:
              'O pagamento ainda está pendente de verificação. A senha continua bloqueada.'
          },
          409
        )
      }

      if (
        authorization.credentialIssuedAt !==
        null
      ) {
        return json(
          {
            success: false,
            message:
              'Esta autorização já originou uma senha. Um novo pagamento deve criar uma nova autorização e uma nova senha.'
          },
          409
        )
      }
    }

    const password =
      generatePassword()

    const salt =
      new Uint8Array(
        PASSWORD_SALT_BYTES
      )

    globalThis.crypto.getRandomValues(
      salt
    )

    const passwordHash =
      await hashPassword(
        password,
        salt,
        PASSWORD_HASH_ITERATIONS
      )

    const now = Date.now()

    const credential:
      StoredAccessCredentialSnapshot = {
        email,
        passwordSalt:
          bytesToBase64(salt),
        passwordHash,
        passwordIterations:
          PASSWORD_HASH_ITERATIONS,
        createdAt:
          now,
        updatedAt:
          now,
        ...(authorization
          ? {
              authorizationId:
                authorization.id,
              authorizationPlan:
                authorization.plan
            }
          : {})
      }

    const credentials =
      state.credentials || {}

    credentials[email] =
      credential

    state.credentials =
      credentials

    accessRequest.failedActivationAttempts =
      0

    accessRequest.blockedUntil =
      null

    accessRequest.updatedAt =
      now

    state.updatedAt =
      now

    if (authorization) {
      authorization.credentialIssuedAt =
        now

      authorization.updatedAt =
        now

      commerceState.updatedAt =
        now

      await this.state.storage.put({
        [STORAGE_KEY]:
          state,
        [COMMERCE_STORAGE_KEY]:
          commerceState
      })
    } else {
      await this.state.storage.put(
        STORAGE_KEY,
        state
      )
    }

    this.refreshBase()

    return json({
      success: true,
      message:
        pilotAccess
          ? 'Senha criada para o acesso gratuito da fase piloto.'
          : authorization.paymentDispensedAt !==
              null
            ? 'Nova senha criada para a autorização com pagamento dispensado.'
            : 'Nova senha criada para o pagamento confirmado.',
      credential: {
        ...buildCredentialStatus(
          email,
          credential
        ),
        password
      },
      commerce:
        buildCommercialStatus(
          email,
          authorization
        )
    })
  }

  private async handleRequest(
    request: Request
  ): Promise<Response> {
    const url =
      new URL(request.url)

    const paidAccessResponse =
      await handleMAProfessorPaidAccessRequest(
        request,
        {
          state:
            this.state,
          base:
            this.base,
          refreshBase:
            () =>
              this.refreshBase()
        }
      )

    if (paidAccessResponse) {
      return paidAccessResponse
    }

    if (
      url.pathname ===
      PUBLIC_ACCESS_ACTIVATE_PATH
    ) {
      const safetyResponse =
        await this.handlePublicActivationSafetyGate(
          request
        )

      if (safetyResponse) {
        return safetyResponse
      }
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_OVERVIEW_PATH
    ) {
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

      const state =
        await this.readAccessState()

      return json(
        buildOverview(state)
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_APPROVE_REQUEST_PATH
    ) {
      return this.handleAccessRequestDecision(
        request,
        'approve'
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_REJECT_REQUEST_PATH
    ) {
      return this.handleAccessRequestDecision(
        request,
        'reject'
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_EMAIL_DISPATCH_STATUS_PATH
    ) {
      return this.handleEmailDispatchStatusUpdate(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_COMMERCE_STATUS_PATH
    ) {
      return this.handleCommerceStatus(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_COMMERCE_SELECT_PLAN_PATH
    ) {
      return this.handleCommerceSelectPlan(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_COMMERCE_CONFIRM_PAYMENT_PATH
    ) {
      return this.handleCommerceConfirmPayment(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_COMMERCE_DISPENSE_PAYMENT_PATH
    ) {
      return this.handleCommerceDispensePayment(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_LICENSE_REVOKE_PATH
    ) {
      return this.handleLicenseRevoke(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH
    ) {
      return this.handleCredentialStatus(
        request
      )
    }

    if (
      url.pathname ===
      INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH
    ) {
      return this.handleCredentialGenerate(
        request
      )
    }

    return this.base.fetch(
      request
    )
  }
}

function getMAProfessorAccessStub(
  env: MaProfessorAccessEnv
) {
  const id =
    env.MA_PROFESSOR_ACCESS.idFromName(
      ACCESS_DURABLE_OBJECT_NAME
    )

  return env.MA_PROFESSOR_ACCESS.get(
    id
  )
}

export async function getMAProfessorAdminOverview(
  env: MaProfessorAccessEnv
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_OVERVIEW_PATH}`,
      {
        method: 'GET'
      }
    )
  )
}

export async function decideMAProfessorAccessRequest(
  env: MaProfessorAccessEnv,
  email: string,
  decision:
    MAProfessorAdminAccessRequestDecision
) {
  const stub =
    getMAProfessorAccessStub(env)

  const pathname =
    decision ===
    'approve'
      ? INTERNAL_ADMIN_APPROVE_REQUEST_PATH
      : INTERNAL_ADMIN_REJECT_REQUEST_PATH

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${pathname}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}

export async function updateMAProfessorAdminEmailDispatchStatus(
  env: MaProfessorAccessEnv,
  email: string,
  status: MAProfessorEmailDispatchStatus
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_EMAIL_DISPATCH_STATUS_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email,
            status
          })
      }
    )
  )
}

export async function getMAProfessorAdminCommercialStatus(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  const url =
    new URL(
      `https://ma-professor.internal${INTERNAL_ADMIN_COMMERCE_STATUS_PATH}`
    )

  url.searchParams.set(
    'email',
    email
  )

  return stub.fetch(
    new Request(
      url.toString(),
      {
        method: 'GET'
      }
    )
  )
}

export async function selectMAProfessorAdminCommercialPlan(
  env: MaProfessorAccessEnv,
  email: string,
  plan: MAProfessorCommercialPlan
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_COMMERCE_SELECT_PLAN_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email,
            plan
          })
      }
    )
  )
}

export async function confirmMAProfessorAdminPayment(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_COMMERCE_CONFIRM_PAYMENT_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}

export async function dispenseMAProfessorAdminPayment(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_COMMERCE_DISPENSE_PAYMENT_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}

export async function revokeMAProfessorAdminLicense(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_LICENSE_REVOKE_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}

export async function getMAProfessorAdminCredentialStatus(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  const url =
    new URL(
      `https://ma-professor.internal${INTERNAL_ADMIN_CREDENTIAL_STATUS_PATH}`
    )

  url.searchParams.set(
    'email',
    email
  )

  return stub.fetch(
    new Request(
      url.toString(),
      {
        method: 'GET'
      }
    )
  )
}

export async function generateMAProfessorAdminCredential(
  env: MaProfessorAccessEnv,
  email: string
) {
  const stub =
    getMAProfessorAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_CREDENTIAL_GENERATE_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email
          })
      }
    )
  )
}
