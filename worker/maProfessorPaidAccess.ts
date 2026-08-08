import {
  MaProfessorAccessDurableObject as BaseMaProfessorAccessDurableObject,
  type LicensePlan,
  type LicenseStatus
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const PUBLIC_ACCESS_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

const PAID_30_DAYS =
  30

const EXPIRING_DAYS =
  7

export type MAProfessorPaidPlan =
  | 'paid_30_days'
  | 'school_year'

interface StoredLicenseSnapshot {
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

interface StoredAccessRequestSnapshot {
  email: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
  activatedAt: number | null
  updatedAt: number
}

interface StoredAccessCredentialSnapshot {
  email: string
  authorizationId?: string
  authorizationPlan?: MAProfessorPaidPlan
}

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >
  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >
  credentials?: Record<
    string,
    StoredAccessCredentialSnapshot
  >
  updatedAt?: number
  [key: string]: unknown
}

interface StoredCommercialAuthorization {
  id: string
  email: string
  plan: MAProfessorPaidPlan
  amountCents: number
  currency: 'EUR'
  selectedAt: number
  paymentConfirmedAt: number | null
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
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike
}

type JsonObject =
  Record<string, unknown>

interface PaidAccessContext {
  state: DurableObjectStateLike
  base: BaseMaProfessorAccessDurableObject
  refreshBase: () => void
}

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
  status = 200
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders
      }
    }
  )
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

function addDays(
  timestamp: number,
  days: number
) {
  return (
    timestamp +
    days *
      24 *
      60 *
      60 *
      1000
  )
}

function getSchoolYearValidUntil(
  validFrom: number
) {
  const activationDate =
    new Date(validFrom)

  const activationYear =
    activationDate.getUTCFullYear()

  /*
   * Fim de 1 de agosto em Portugal continental.
   * Em agosto, Portugal continental está em UTC+1.
   */
  const cutoffThisYear =
    Date.UTC(
      activationYear,
      7,
      1,
      22,
      59,
      59,
      999
    )

  if (
    validFrom <=
    cutoffThisYear
  ) {
    return cutoffThisYear
  }

  return Date.UTC(
    activationYear + 1,
    7,
    1,
    22,
    59,
    59,
    999
  )
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
      new Date(
        license.validFrom
      ).toISOString(),

    validUntil:
      new Date(
        license.validUntil
      ).toISOString(),

    daysRemaining:
      getDaysRemaining(
        license.validUntil,
        now
      ),

    renewalRequestedAt:
      license.renewalRequestedAt ===
      null
        ? null
        : new Date(
            license.renewalRequestedAt
          ).toISOString()
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

async function readActivationBody(
  request: Request
): Promise<JsonObject | null> {
  try {
    const parsed =
      await request
        .clone()
        .json()

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      Array.isArray(parsed)
    ) {
      return null
    }

    return parsed as JsonObject
  } catch {
    return null
  }
}

async function handlePaidActivation(
  request: Request,
  context: PaidAccessContext
): Promise<Response | null> {
  if (
    request.method !==
    'POST'
  ) {
    return null
  }

  const body =
    await readActivationBody(
      request
    )

  if (!body) {
    return null
  }

  const email =
    normalizeEmail(
      body.email
    )

  if (!isValidEmail(email)) {
    return null
  }

  const accessState =
    await context.state.storage.get<AccessStateSnapshot>(
      STORAGE_KEY
    )

  const accessRequest =
    accessState
      ?.accessRequests?.[
      email
    ]

  /*
   * Contas que já têm licença continuam a ser
   * tratadas pelo motor existente. Este módulo
   * só intervém na primeira ativação paga.
   */
  if (
    !accessState ||
    !accessRequest ||
    accessRequest.status !==
      'approved' ||
    accessState.licenses?.[
      email
    ]
  ) {
    return null
  }

  const commerceState =
    await context.state.storage.get<StoredCommerceState>(
      COMMERCE_STORAGE_KEY
    )

  if (
    !commerceState ||
    commerceState.schemaVersion !==
      1 ||
    !Array.isArray(
      commerceState.authorizations
    )
  ) {
    return json(
      {
        success: false,
        message:
          'Escolha primeiro o plano e conclua o pagamento antes de ativar o MA-Professor.'
      },
      409
    )
  }

  const authorization =
    getLatestAuthorization(
      commerceState,
      email
    )

  if (!authorization) {
    return json(
      {
        success: false,
        message:
          'Ainda não existe um plano associado a esta conta.'
      },
      409
    )
  }

  if (
    authorization
      .paymentConfirmedAt ===
    null
  ) {
    return json(
      {
        success: false,
        message:
          'O pagamento desta conta ainda não foi confirmado pela MA-CODE.'
      },
      409
    )
  }

  if (
    authorization
      .credentialIssuedAt ===
    null
  ) {
    return json(
      {
        success: false,
        message:
          'O pagamento está confirmado, mas a nova senha ainda não foi emitida pela MA-CODE.'
      },
      409
    )
  }

  const credential =
    accessState.credentials?.[
      email
    ]

  /*
   * A senha tem de pertencer exatamente à
   * autorização paga que está a ser ativada.
   */
  if (
    !credential ||
    credential.authorizationId !==
      authorization.id ||
    credential.authorizationPlan !==
      authorization.plan
  ) {
    return json(
      {
        success: false,
        message:
          'A senha disponível não corresponde à autorização paga atual. Contacte a MA-CODE.'
      },
      409
    )
  }

  /*
   * O motor existente continua responsável por:
   *
   * - validar o hash da senha;
   * - bloquear tentativas repetidas;
   * - registar o dispositivo;
   * - emitir a sessão.
   *
   * Depois dessa validação ter sucesso, substituímos
   * a licença beta transitória criada pelo motor
   * antigo pelo plano que foi realmente pago.
   */
  const baseResponse =
    await context.base.fetch(
      request
    )

  if (!baseResponse.ok) {
    return baseResponse
  }

  let baseBody:
    JsonObject

  try {
    baseBody =
      await baseResponse
        .clone()
        .json() as JsonObject
  } catch {
    return json(
      {
        success: false,
        message:
          'A ativação foi validada, mas a resposta do serviço não pôde ser concluída.'
      },
      500
    )
  }

  const token =
    typeof baseBody.token ===
      'string'
      ? baseBody.token
      : ''

  if (!token) {
    return json(
      {
        success: false,
        message:
          'A ativação foi validada, mas não foi possível criar a sessão.'
      },
      500
    )
  }

  /*
   * O motor base já validou a senha e gravou a sessão.
   * Relemos agora o estado acabado de guardar.
   */
  const freshState =
    await context.state.storage.get<AccessStateSnapshot>(
      STORAGE_KEY
    )

  const license =
    freshState
      ?.licenses?.[
      email
    ]

  const freshRequest =
    freshState
      ?.accessRequests?.[
      email
    ]

  if (
    !freshState ||
    !license ||
    !freshRequest
  ) {
    return json(
      {
        success: false,
        message:
          'A ativação foi validada, mas não foi possível concluir a licença paga.'
      },
      500
    )
  }

  const validFrom =
    license.validFrom

  license.plan =
    authorization.plan

  license.validFrom =
    validFrom

  license.validUntil =
    authorization.plan ===
      'paid_30_days'
      ? addDays(
          validFrom,
          PAID_30_DAYS
        )
      : getSchoolYearValidUntil(
          validFrom
        )

  license.revokedAt =
    null

  license.renewalRequestedAt =
    null

  license.renewalRequestedPlan =
    null

  license.updatedAt =
    Date.now()

  freshRequest.activatedAt =
    validFrom

  freshRequest.updatedAt =
    license.updatedAt

  freshState.updatedAt =
    license.updatedAt

  await context.state.storage.put(
    STORAGE_KEY,
    freshState
  )

  /*
   * A instância base tinha o estado anterior em memória.
   * Recriá-la garante que verificações posteriores veem
   * imediatamente a licença paga.
   */
  context.refreshBase()

  return json({
    success: true,

    token,

    license:
      buildLicenseSummary(
        license,
        license.updatedAt
      )
  })
}

export async function handleMAProfessorPaidAccessRequest(
  request: Request,
  context: PaidAccessContext
): Promise<Response | null> {
  const url =
    new URL(request.url)

  if (
    url.pathname !==
    PUBLIC_ACCESS_ACTIVATE_PATH
  ) {
    return null
  }

  return handlePaidActivation(
    request,
    context
  )
}
