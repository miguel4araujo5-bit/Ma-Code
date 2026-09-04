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

const INTERNAL_PREPARE_APPROVAL_PLAN_PATH =
  '/__internal/ma-professor/admin/requests/prepare-approval-plan'

export type MAProfessorApprovalPlan =
  | 'free'
  | 'paid_30_days'
  | 'school_year'

type JsonObject =
  Record<string, unknown>

interface StoredAccessRequestSnapshot {
  email: string
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
}

interface AccessStateSnapshot {
  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >
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
): MAProfessorApprovalPlan | null {
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
    StoredCommerceState | undefined,
  now: number
) {
  if (
    !value ||
    value.schemaVersion !== 1 ||
    !Array.isArray(
      value.authorizations
    )
  ) {
    return createCommerceState(now)
  }

  return value
}

function isAuthorizationResolved(
  authorization:
    StoredCommercialAuthorization
) {
  return Boolean(
    authorization.paymentConfirmedAt !==
      null ||
    authorization.paymentDispensedAt !=
      null ||
    authorization.credentialIssuedAt !==
      null ||
    authorization.activatedAt !=
      null
  )
}

function getLatestAuthorization(
  state: StoredCommerceState,
  email: string
) {
  return state.authorizations
    .filter(
      authorization =>
        authorization.email === email
    )
    .sort(
      (left, right) =>
        right.createdAt -
        left.createdAt
    )[0] || null
}

function createAuthorization(
  email: string,
  plan:
    | 'paid_30_days'
    | 'school_year',
  now: number
): StoredCommercialAuthorization {
  const uuid =
    globalThis.crypto.randomUUID?.()

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
    currency: 'EUR',
    selectedAt: now,
    renewalId: null,
    paymentConfirmedAt: null,
    paymentDispensedAt: null,
    credentialIssuedAt: null,
    activatedAt: null,
    createdAt: now,
    updatedAt: now
  }
}

async function readBody(
  request: Request
): Promise<JsonObject> {
  const value =
    await request.json() as unknown

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
          this.handleRequest(request)
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private async handlePrepareApprovalPlan(
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
      body = await readBody(request)
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
      normalizeEmail(body.email)

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
            'Selecione uma modalidade de aprovação válida.'
        },
        400
      )
    }

    const accessState =
      await this.state.storage.get<AccessStateSnapshot>(
        ACCESS_STORAGE_KEY
      )

    const accessRequest =
      accessState?.accessRequests?.[
        email
      ]

    if (!accessRequest) {
      return json(
        {
          success: false,
          message:
            'O pedido de acesso não foi encontrado.'
        },
        404
      )
    }

    if (accessRequest.status !== 'pending') {
      return json(
        {
          success: false,
          message:
            'A modalidade só pode ser escolhida enquanto o pedido está pendente.'
        },
        409
      )
    }

    const now = Date.now()

    const commerceState =
      normalizeCommerceState(
        await this.state.storage.get<StoredCommerceState>(
          COMMERCE_STORAGE_KEY
        ),
        now
      )

    const latest =
      getLatestAuthorization(
        commerceState,
        email
      )

    if (
      latest &&
      isAuthorizationResolved(latest)
    ) {
      return json(
        {
          success: false,
          message:
            'Já existe uma autorização comercial resolvida para esta conta. Abra a ficha antes de alterar a modalidade.'
        },
        409
      )
    }

    if (approvalPlan === 'free') {
      const before =
        commerceState.authorizations.length

      commerceState.authorizations =
        commerceState.authorizations.filter(
          authorization =>
            authorization.email !== email ||
            isAuthorizationResolved(
              authorization
            )
        )

      if (
        commerceState.authorizations.length !==
        before
      ) {
        commerceState.updatedAt = now

        await this.state.storage.put(
          COMMERCE_STORAGE_KEY,
          commerceState
        )
      }

      return json({
        success: true,
        approvalPlan,
        decisionMode: 'pilot',
        message:
          'Aprovação gratuita preparada.'
      })
    }

    if (
      latest &&
      latest.plan === approvalPlan
    ) {
      return json({
        success: true,
        approvalPlan,
        decisionMode: 'commercial',
        message:
          'O plano comercial já estava preparado para este pedido.'
      })
    }

    commerceState.authorizations.push(
      createAuthorization(
        email,
        approvalPlan,
        now
      )
    )

    commerceState.updatedAt = now

    await this.state.storage.put(
      COMMERCE_STORAGE_KEY,
      commerceState
    )

    return json({
      success: true,
      approvalPlan,
      decisionMode: 'commercial',
      message:
        'Plano comercial preparado para aprovação.'
    })
  }

  private handleRequest(
    request: Request
  ) {
    const pathname =
      new URL(request.url).pathname

    if (
      pathname ===
        INTERNAL_PREPARE_APPROVAL_PLAN_PATH
    ) {
      return this.handlePrepareApprovalPlan(
        request
      )
    }

    return this.existing.fetch(request)
  }
}

function getAccessStub(
  env: MaProfessorAccessEnv
) {
  const id =
    env.MA_PROFESSOR_ACCESS.idFromName(
      ACCESS_DURABLE_OBJECT_NAME
    )

  return env.MA_PROFESSOR_ACCESS.get(id)
}

export async function prepareMAProfessorAdminApprovalPlan(
  env: MaProfessorAccessEnv,
  email: string,
  approvalPlan: MAProfessorApprovalPlan
) {
  const stub = getAccessStub(env)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_PREPARE_APPROVAL_PLAN_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          email,
          approvalPlan
        })
      }
    )
  )
}
