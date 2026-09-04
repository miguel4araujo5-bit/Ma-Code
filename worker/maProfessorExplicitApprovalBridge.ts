import {
  MaProfessorAccessDurableObject as ExistingMaProfessorAccessDurableObject
} from './maProfessorOperationalStateBridge'

import type {
  MaProfessorAccessEnv
} from './maProfessorAccess'

const ACCESS_STORAGE_KEY =
  'ma-professor-access-state-v1'

const COMMERCE_STORAGE_KEY =
  'ma-professor-admin-commerce-v1'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const INTERNAL_EXPLICIT_APPROVAL_PATH =
  '/__internal/ma-professor/admin/requests/approve-explicit'

const INTERNAL_CREDENTIAL_GENERATE_PATH =
  '/__internal/ma-professor/admin/credentials/generate'

const PUBLIC_ACTIVATE_PATH =
  '/api/ma-professor/access/activate'

export type MAProfessorExplicitApprovalPlan =
  | 'free'
  | 'paid_30_days'
  | 'school_year'

type JsonObject =
  Record<string, unknown>

interface StoredAccessRequestSnapshot {
  id?: string
  email: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
  requestedAt?: number
  approvedAt: number | null
  rejectedAt: number | null
  activatedAt: number | null
  failedActivationAttempts?: number
  blockedUntil?: number | null
  decisionMode?:
    | 'pilot'
    | 'commercial'
  emailDispatchStatus?:
    | 'not_applicable'
    | 'not_configured'
    | 'pending'
    | 'sent'
    | 'failed'
  emailDispatchUpdatedAt?: number | null
  updatedAt: number
}

interface AccessStateSnapshot {
  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >
  updatedAt?: number
  [key: string]: unknown
}

interface StoredCommercialAuthorization {
  id: string
  email: string
  plan:
    | 'paid_30_days'
    | 'school_year'
  amountCents: number
  currency: 'EUR'
  selectedAt: number
  renewalId?: string | null
  paymentConfirmedAt: number | null
  paymentDispensedAt?: number | null
  credentialIssuedAt: number | null
  activatedAt?: number | null
  createdAt: number
  updatedAt: number
}

interface StoredCommerceState {
  schemaVersion: 1
  authorizations:
    StoredCommercialAuthorization[]
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
  storage:
    DurableObjectStorageLike
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
        'Cache-Control':
          'no-store',
        Pragma:
          'no-cache',
        'X-Content-Type-Options':
          'nosniff',
        'X-Frame-Options':
          'DENY',
        'Referrer-Policy':
          'no-referrer',
        'X-Robots-Tag':
          'noindex, nofollow'
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

function normalizeApprovalPlan(
  value: unknown
): MAProfessorExplicitApprovalPlan | null {
  return value === 'free' ||
    value === 'paid_30_days' ||
    value === 'school_year'
    ? value
    : null
}

function createCommerceState(
  now: number
): StoredCommerceState {
  return {
    schemaVersion: 1,
    authorizations: [],
    createdAt: now,
    updatedAt: now
  }
}

function normalizeCommerceState(
  value:
    | StoredCommerceState
    | undefined,
  now: number
): StoredCommerceState {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(
      value.authorizations
    )
  ) {
    return createCommerceState(now)
  }

  return {
    ...value,
    authorizations:
      value.authorizations.map(
        authorization => ({
          ...authorization,
          renewalId:
            authorization.renewalId ??
            null,
          paymentDispensedAt:
            authorization.paymentDispensedAt ??
            null,
          activatedAt:
            authorization.activatedAt ??
            null
        })
      )
  }
}

function toIso(
  value:
    | number
    | null
    | undefined
) {
  return typeof value === 'number' &&
    Number.isFinite(value)
    ? new Date(value)
        .toISOString()
    : null
}

function buildRequestSummary(
  request: StoredAccessRequestSnapshot
) {
  return {
    email:
      request.email,
    status:
      request.status,
    requestedAt:
      toIso(
        request.requestedAt
      ),
    approvedAt:
      toIso(
        request.approvedAt
      ),
    rejectedAt:
      toIso(
        request.rejectedAt
      ),
    activatedAt:
      toIso(
        request.activatedAt
      ),
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

function getLatestInitialAuthorization(
  state: StoredCommerceState,
  email: string
) {
  return state.authorizations
    .filter(
      authorization =>
        authorization.email === email &&
        !authorization.renewalId
    )
    .sort(
      (left, right) =>
        right.createdAt -
        left.createdAt
    )[0] || null
}

function isUnusedAuthorization(
  authorization:
    StoredCommercialAuthorization
) {
  return (
    authorization.paymentConfirmedAt ===
      null &&
    authorization.paymentDispensedAt ===
      null &&
    authorization.credentialIssuedAt ===
      null &&
    authorization.activatedAt ===
      null
  )
}

function createAuthorization(
  email: string,
  plan:
    | 'paid_30_days'
    | 'school_year',
  now: number
): StoredCommercialAuthorization {
  const uuid =
    globalThis.crypto
      .randomUUID?.()

  return {
    id:
      uuid
        ? `authorization-${uuid}`
        : `authorization-${now}-${Math.random()
            .toString(36)
            .slice(2, 14)}`,
    email,
    plan,
    amountCents:
      plan === 'school_year'
        ? 1500
        : 349,
    currency:
      'EUR',
    selectedAt:
      now,
    renewalId:
      null,
    paymentConfirmedAt:
      null,
    paymentDispensedAt:
      null,
    credentialIssuedAt:
      null,
    activatedAt:
      null,
    createdAt:
      now,
    updatedAt:
      now
  }
}

async function readBody(
  request: Request
): Promise<JsonObject> {
  const value =
    await request
      .clone()
      .json() as unknown

  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(
      'O pedido administrativo é inválido.'
    )
  }

  return value as JsonObject
}

export class MaProfessorAccessDurableObject {
  private readonly state:
    DurableObjectStateLike

  private readonly existing:
    ExistingMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state: DurableObjectStateLike,
    env: MaProfessorAccessEnv
  ) {
    this.state = state

    this.existing =
      new ExistingMaProfessorAccessDurableObject(
        state as never,
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

  private async handleExplicitApproval(
    request: Request
  ) {
    if (request.method !== 'POST') {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405
      )
    }

    let body: JsonObject

    try {
      body =
        await readBody(request)
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

    const approvalPlan =
      normalizeApprovalPlan(
        body.approvalPlan
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

    if (!approvalPlan) {
      return json(
        {
          success: false,
          message:
            'Selecione Gratuito, 30 dias ou Ano letivo.'
        },
        400
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    const accessRequest =
      accessState
        ?.accessRequests?.[
          email
        ]

    if (
      !accessState ||
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
            buildRequestSummary(
              accessRequest
            )
        },
        409
      )
    }

    const now =
      Date.now()

    const commerceState =
      normalizeCommerceState(
        await this.state.storage.get<StoredCommerceState>(
          COMMERCE_STORAGE_KEY
        ),
        now
      )

    const decisionMode =
      approvalPlan === 'free'
        ? 'pilot' as const
        : 'commercial' as const

    if (approvalPlan === 'free') {
      commerceState.authorizations =
        commerceState.authorizations.filter(
          authorization =>
            !(
              authorization.email ===
                email &&
              !authorization.renewalId &&
              isUnusedAuthorization(
                authorization
              )
            )
        )
    } else {
      const latest =
        getLatestInitialAuthorization(
          commerceState,
          email
        )

      if (
        !latest ||
        latest.plan !==
          approvalPlan ||
        !isUnusedAuthorization(
          latest
        )
      ) {
        commerceState.authorizations.push(
          createAuthorization(
            email,
            approvalPlan,
            now
          )
        )
      }
    }

    accessRequest.status =
      'approved'

    accessRequest.approvedAt =
      now

    accessRequest.rejectedAt =
      null

    accessRequest.decisionMode =
      decisionMode

    accessRequest.emailDispatchStatus =
      decisionMode === 'commercial'
        ? 'not_applicable'
        : 'pending'

    accessRequest.emailDispatchUpdatedAt =
      now

    accessRequest.updatedAt =
      now

    accessState.updatedAt =
      now

    commerceState.updatedAt =
      now

    await this.state.storage.put({
      [ACCESS_STORAGE_KEY]:
        accessState,
      [COMMERCE_STORAGE_KEY]:
        commerceState
    })

    return json({
      success: true,
      message:
        decisionMode === 'pilot'
          ? 'Pedido aprovado para acesso gratuito.'
          : 'Pedido aprovado para acesso Fundador.',
      request:
        buildRequestSummary(
          accessRequest
        ),
      decisionMode,
      emailDispatchStatus:
        accessRequest.emailDispatchStatus,
      emailDispatchUpdatedAt:
        toIso(
          accessRequest.emailDispatchUpdatedAt
        ),
      approvalPlan
    })
  }

  private async getPilotEmailFromRequest(
    request: Request
  ) {
    let body: JsonObject

    try {
      body =
        await readBody(request)
    } catch {
      return ''
    }

    const email =
      normalizeEmail(
        body.email
      )

    if (!isValidEmail(email)) {
      return ''
    }

    const state =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    const accessRequest =
      state?.accessRequests?.[
        email
      ]

    return accessRequest
        ?.decisionMode ===
        'pilot'
      ? email
      : ''
  }

  private async delegatePilotWithoutHistoricalCommerce(
    request: Request,
    email: string
  ) {
    const storedCommerceState =
      await this.state.storage.get<StoredCommerceState>(
        COMMERCE_STORAGE_KEY
      )

    if (
      !storedCommerceState ||
      !Array.isArray(
        storedCommerceState.authorizations
      ) ||
      !storedCommerceState.authorizations.some(
        authorization =>
          authorization.email ===
          email
      )
    ) {
      return this.existing.fetch(
        request
      )
    }

    const filteredCommerceState:
      StoredCommerceState = {
      ...storedCommerceState,
      authorizations:
        storedCommerceState.authorizations.filter(
          authorization =>
            authorization.email !==
            email
        )
    }

    await this.state.storage.put(
      COMMERCE_STORAGE_KEY,
      filteredCommerceState
    )

    try {
      return await this.existing.fetch(
        request
      )
    } finally {
      await this.state.storage.put(
        COMMERCE_STORAGE_KEY,
        storedCommerceState
      )
    }
  }

  private async handleRequest(
    request: Request
  ) {
    const pathname =
      new URL(
        request.url
      ).pathname

    if (
      pathname ===
        INTERNAL_EXPLICIT_APPROVAL_PATH
    ) {
      return this.handleExplicitApproval(
        request
      )
    }

    if (
      pathname ===
        INTERNAL_CREDENTIAL_GENERATE_PATH ||
      pathname ===
        PUBLIC_ACTIVATE_PATH
    ) {
      const email =
        await this.getPilotEmailFromRequest(
          request
        )

      if (email) {
        return this.delegatePilotWithoutHistoricalCommerce(
          request,
          email
        )
      }
    }

    return this.existing.fetch(
      request
    )
  }
}

function getAccessStub(
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

export async function decideMAProfessorAccessRequestExplicitly(
  env: MaProfessorAccessEnv,
  email: string,
  approvalPlan:
    MAProfessorExplicitApprovalPlan
) {
  const stub =
    getAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_EXPLICIT_APPROVAL_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body:
          JSON.stringify({
            email,
            approvalPlan
          })
      }
    )
  )
}
