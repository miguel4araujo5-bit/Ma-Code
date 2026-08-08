import {
  MaProfessorAccessDurableObject as BaseMaProfessorAccessDurableObject,
  type AccessRequestStatus,
  type LicensePlan,
  type LicenseStatus,
  type MaProfessorAccessEnv
} from './maProfessorAccess'

const STORAGE_KEY =
  'ma-professor-access-state-v1'

const ACCESS_DURABLE_OBJECT_NAME =
  'ma-professor-access-global'

const INTERNAL_ADMIN_OVERVIEW_PATH =
  '/__internal/ma-professor/admin/overview'

const EXPIRING_DAYS = 7
const RENEWAL_GRACE_HOURS = 24

interface StoredLicenseSnapshot {
  email: string
  plan: LicensePlan
  validFrom: number
  validUntil: number
  revokedAt: number | null
  renewalRequestedAt: number | null
}

interface StoredAccessRequestSnapshot {
  email: string
  status: AccessRequestStatus
  requestedAt: number
  approvedAt: number | null
  rejectedAt: number | null
  activatedAt: number | null
}

interface StoredRenewalRequestSnapshot {
  id: string
  email: string
  requestedPlan:
    | 'paid_30_days'
    | 'school_year'
  amountCents: number
  currency: 'EUR'
  status: 'pending'
  requestedAt: number
}

interface AccessStateSnapshot {
  licenses?: Record<
    string,
    StoredLicenseSnapshot
  >
  renewals?:
    StoredRenewalRequestSnapshot[]
  accessRequests?: Record<
    string,
    StoredAccessRequestSnapshot
  >
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

  blockConcurrencyWhile<T>(
    callback:
      () => Promise<T>
  ): Promise<T>
}

const securityHeaders:
  Record<string, string> = {
    'Cache-Control':
      'no-store',
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

function toIso(
  value:
    number | null | undefined
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

function getDaysRemaining(
  validUntil: number,
  now: number
) {
  return Math.max(
    0,
    Math.ceil(
      (
        validUntil - now
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
  license:
    StoredLicenseSnapshot,
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
    license
      .renewalRequestedAt !==
      null &&
    now -
      license
        .renewalRequestedAt <=
      RENEWAL_GRACE_HOURS *
        60 *
        60 *
        1000

  if (
    renewalGraceActive
  ) {
    return 'renewal_pending'
  }

  if (
    getDaysRemaining(
      license.validUntil,
      now
    ) <= EXPIRING_DAYS
  ) {
    return 'expiring'
  }

  return 'active'
}

function buildOverview(
  state:
    AccessStateSnapshot |
    undefined
) {
  const now =
    Date.now()

  const accessRequests =
    Object.values(
      state?.accessRequests ||
        {}
    )
      .map(
        request => ({
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
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
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
        license => ({
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
              license
                .renewalRequestedAt
            )
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          left.email.localeCompare(
            right.email
          )
      )

  const renewals =
    [
      ...(state?.renewals ||
        [])
    ]
      .sort(
        (
          left,
          right
        ) =>
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
            resolvedAt:
              null,
            createdAt:
              requestedAt,
            updatedAt:
              requestedAt
          }
        }
      )

  return {
    success: true as const,
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

  private readonly base:
    BaseMaProfessorAccessDurableObject

  private operation:
    Promise<void> =
      Promise.resolve()

  constructor(
    state:
      DurableObjectStateLike,
    env:
      MaProfessorAccessEnv
  ) {
    this.state = state
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

  private async handleRequest(
    request: Request
  ): Promise<Response> {
    const url =
      new URL(
        request.url
      )

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
          405
        )
      }

      const state =
        await this
          .state
          .storage
          .get<AccessStateSnapshot>(
            STORAGE_KEY
          )

      return json(
        buildOverview(
          state
        )
      )
    }

    return this.base.fetch(
      request
    )
  }
}

export async function getMAProfessorAdminOverview(
  env:
    MaProfessorAccessEnv
) {
  const id =
    env
      .MA_PROFESSOR_ACCESS
      .idFromName(
        ACCESS_DURABLE_OBJECT_NAME
      )

  const stub =
    env
      .MA_PROFESSOR_ACCESS
      .get(id)

  return stub.fetch(
    new Request(
      `https://ma-professor.internal${INTERNAL_ADMIN_OVERVIEW_PATH}`,
      {
        method: 'GET'
      }
    )
  )
}
