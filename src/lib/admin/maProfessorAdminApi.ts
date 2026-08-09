import type {
  MAProfessorAccessRequestSummary
} from '../../components/ma-professor/access/accessTypes'

import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../components/ma-professor/types'

const MA_PROFESSOR_ADMIN_API_PREFIX =
  '/api/admin/ma-professor'

interface AdminApiErrorBody {
  success?: boolean
  message?: string
}

export interface MAProfessorAdminOverview {
  accessRequests:
    MAProfessorAccessRequestSummary[]
  licenses:
    LicenseSummary[]
  renewals:
    LicenseRenewalRequest[]
  generatedAt:
    string
}

export interface MAProfessorAdminCredentialStatus {
  email: string
  hasCredential: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface MAProfessorGeneratedCredential
  extends MAProfessorAdminCredentialStatus {
  password: string
}

export type MAProfessorCommercialPlan =
  | 'paid_30_days'
  | 'school_year'

export type MAProfessorPaymentStatus =
  | 'not_started'
  | 'pending'
  | 'confirmed'
  | 'dispensed'

export interface MAProfessorAdminCommercialStatus {
  email: string
  authorizationId: string | null
  plan: MAProfessorCommercialPlan | null
  amountCents: number | null
  currency: 'EUR'
  paymentStatus: MAProfessorPaymentStatus
  selectedAt: string | null
  paymentConfirmedAt: string | null
  paymentDispensedAt: string | null
  credentialIssuedAt: string | null
  canGenerateCredential: boolean
}

interface MAProfessorAdminOverviewResponse
  extends MAProfessorAdminOverview {
  success: true
}

interface MAProfessorAdminActionResponse {
  success: true
  message: string
  request?:
    MAProfessorAccessRequestSummary
  license?:
    LicenseSummary
}

interface MAProfessorCredentialStatusResponse {
  success: true
  credential:
    MAProfessorAdminCredentialStatus
}

interface MAProfessorCredentialGenerateResponse {
  success: true
  message: string
  credential:
    MAProfessorGeneratedCredential
  commerce?:
    MAProfessorAdminCommercialStatus
}

interface MAProfessorCommercialStatusResponse {
  success: true
  message?: string
  commerce:
    MAProfessorAdminCommercialStatus
}

async function readResponseBody(
  response: Response
) {
  try {
    return await response.json() as unknown
  } catch {
    return null
  }
}

function getApiMessage(
  body: unknown,
  fallback: string
) {
  if (
    body &&
    typeof body ===
      'object'
  ) {
    const data =
      body as AdminApiErrorBody

    if (
      typeof data.message ===
      'string'
    ) {
      return data.message
    }
  }

  return fallback
}

function getSessionError() {
  return new Error(
    'A sessão administrativa expirou. Atualize a página e volte a entrar.'
  )
}

function isNullableString(
  value: unknown
) {
  return value === null ||
    typeof value === 'string'
}

function assertCommercialStatus(
  value: unknown
): asserts value is MAProfessorAdminCommercialStatus {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    throw new Error(
      'A resposta comercial do MA-Professor é inválida.'
    )
  }

  const data =
    value as Record<string, unknown>

  const validPlan =
    data.plan === null ||
    data.plan ===
      'paid_30_days' ||
    data.plan ===
      'school_year'

  const validPaymentStatus =
    data.paymentStatus ===
      'not_started' ||
    data.paymentStatus ===
      'pending' ||
    data.paymentStatus ===
      'confirmed' ||
    data.paymentStatus ===
      'dispensed'

  if (
    typeof data.email !==
      'string' ||
    !validPlan ||
    !validPaymentStatus ||
    data.currency !==
      'EUR' ||
    !isNullableString(
      data.authorizationId
    ) ||
    !(
      data.amountCents ===
        null ||
      typeof data.amountCents ===
        'number'
    ) ||
    !isNullableString(
      data.selectedAt
    ) ||
    !isNullableString(
      data.paymentConfirmedAt
    ) ||
    !isNullableString(
      data.paymentDispensedAt
    ) ||
    !isNullableString(
      data.credentialIssuedAt
    ) ||
    typeof data.canGenerateCredential !==
      'boolean'
  ) {
    throw new Error(
      'A resposta comercial do MA-Professor é inválida.'
    )
  }
}

async function requestAdminApi(
  path: string,
  init: RequestInit,
  fallbackMessage: string
) {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}${path}`,
        {
          credentials:
            'include',
          cache:
            'no-store',
          ...init,
          headers: {
            Accept:
              'application/json',
            ...(init.headers || {})
          }
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar ao backend administrativo do MA-Professor.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status === 401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        fallbackMessage
      )
    )
  }

  return body
}

async function postEmailAction(
  path: string,
  email: string,
  fallbackMessage: string
) {
  const body =
    await requestAdminApi(
      path,
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
      },
      fallbackMessage
    )

  const data =
    body as MAProfessorAdminActionResponse | null

  if (
    !data ||
    data.success !== true ||
    typeof data.message !==
      'string'
  ) {
    throw new Error(
      'O backend administrativo devolveu uma resposta inválida.'
    )
  }

  return data
}

export async function getMAProfessorAdminOverview() {
  const body =
    await requestAdminApi(
      '/overview',
      {
        method: 'GET'
      },
      'Não foi possível carregar os dados administrativos do MA-Professor.'
    )

  const data =
    body as MAProfessorAdminOverviewResponse | null

  if (
    !data ||
    data.success !== true ||
    !Array.isArray(
      data.accessRequests
    ) ||
    !Array.isArray(
      data.licenses
    ) ||
    !Array.isArray(
      data.renewals
    ) ||
    typeof data.generatedAt !==
      'string'
  ) {
    throw new Error(
      'O backend administrativo devolveu dados inválidos.'
    )
  }

  return {
    accessRequests:
      data.accessRequests,
    licenses:
      data.licenses,
    renewals:
      data.renewals,
    generatedAt:
      data.generatedAt
  } satisfies MAProfessorAdminOverview
}

export async function approveMAProfessorAccessRequest(
  email: string
) {
  return postEmailAction(
    '/requests/approve',
    email,
    'Não foi possível aprovar o pedido de acesso.'
  )
}

export async function rejectMAProfessorAccessRequest(
  email: string
) {
  return postEmailAction(
    '/requests/reject',
    email,
    'Não foi possível rejeitar o pedido de acesso.'
  )
}

export async function getMAProfessorCommercialStatus(
  email: string
) {
  const params =
    new URLSearchParams({
      email
    })

  const body =
    await requestAdminApi(
      `/commerce/status?${params.toString()}`,
      {
        method: 'GET'
      },
      'Não foi possível consultar o plano e pagamento desta conta.'
    )

  const data =
    body as MAProfessorCommercialStatusResponse | null

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado comercial inválido.'
    )
  }

  assertCommercialStatus(
    data.commerce
  )

  return data.commerce
}

export async function selectMAProfessorCommercialPlan(
  email: string,
  plan: MAProfessorCommercialPlan
) {
  const body =
    await requestAdminApi(
      '/commerce/select-plan',
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
      },
      'Não foi possível registar o plano escolhido.'
    )

  const data =
    body as MAProfessorCommercialStatusResponse | null

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado comercial inválido.'
    )
  }

  assertCommercialStatus(
    data.commerce
  )

  return data.commerce
}

async function updateMAProfessorPayment(
  email: string,
  action:
    'confirm-payment' |
    'dispense-payment',
  fallbackMessage: string
) {
  const body =
    await requestAdminApi(
      `/commerce/${action}`,
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
      },
      fallbackMessage
    )

  const data =
    body as MAProfessorCommercialStatusResponse | null

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado comercial inválido.'
    )
  }

  assertCommercialStatus(
    data.commerce
  )

  return data.commerce
}

export async function confirmMAProfessorPayment(
  email: string
) {
  return updateMAProfessorPayment(
    email,
    'confirm-payment',
    'Não foi possível confirmar o pagamento.'
  )
}

export async function dispenseMAProfessorPayment(
  email: string
) {
  return updateMAProfessorPayment(
    email,
    'dispense-payment',
    'Não foi possível marcar o pagamento como dispensado.'
  )
}

export async function revokeMAProfessorLicense(
  email: string
) {
  const data =
    await postEmailAction(
      '/licenses/revoke',
      email,
      'Não foi possível revogar a licença.'
    )

  if (
    !data.license ||
    data.license.email !==
      email ||
    data.license.status !==
      'revoked' ||
    !isNullableString(
      data.license.revokedAt
    )
  ) {
    throw new Error(
      'O backend administrativo devolveu uma licença revogada inválida.'
    )
  }

  return data.license
}

export async function getMAProfessorCredentialStatus(
  email: string
) {
  const params =
    new URLSearchParams({
      email
    })

  const body =
    await requestAdminApi(
      `/credentials/status?${params.toString()}`,
      {
        method: 'GET'
      },
      'Não foi possível consultar o estado da senha.'
    )

  const data =
    body as MAProfessorCredentialStatusResponse | null

  if (
    !data ||
    data.success !== true ||
    !data.credential ||
    typeof data.credential.email !==
      'string' ||
    typeof data.credential.hasCredential !==
      'boolean'
  ) {
    throw new Error(
      'O backend administrativo devolveu um estado de senha inválido.'
    )
  }

  return data.credential
}

export async function generateMAProfessorAccessPassword(
  email: string
) {
  const body =
    await requestAdminApi(
      '/credentials/generate',
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
      },
      'Não foi possível gerar a nova senha.'
    )

  const data =
    body as MAProfessorCredentialGenerateResponse | null

  if (
    !data ||
    data.success !== true ||
    !data.credential ||
    typeof data.credential.email !==
      'string' ||
    typeof data.credential.hasCredential !==
      'boolean' ||
    typeof data.credential.password !==
      'string' ||
    !data.credential.password
  ) {
    throw new Error(
      'O backend administrativo devolveu uma nova senha inválida.'
    )
  }

  if (data.commerce) {
    assertCommercialStatus(
      data.commerce
    )
  }

  return data.credential
}
