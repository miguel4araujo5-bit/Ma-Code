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

export interface MAProfessorAdminCommercialStatus {
  email: string
  authorizationId: string | null
  plan: MAProfessorCommercialPlan | null
  amountCents: number | null
  currency: 'EUR'
  paymentStatus: MAProfessorPaymentStatus
  selectedAt: string | null
  paymentConfirmedAt: string | null
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

function assertCommercialStatus(
  value: unknown
): asserts value is MAProfessorAdminCommercialStatus {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    throw new Error(
      'O servidor devolveu um estado comercial inválido.'
    )
  }

  const data =
    value as Partial<MAProfessorAdminCommercialStatus>

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
      'confirmed'

  if (
    typeof data.email !==
      'string' ||
    !validPlan ||
    !validPaymentStatus ||
    typeof data.canGenerateCredential !==
      'boolean'
  ) {
    throw new Error(
      'O servidor devolveu um estado comercial inválido.'
    )
  }
}

export async function getMAProfessorAdminOverview():
  Promise<MAProfessorAdminOverview> {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/overview`,
        {
          method: 'GET',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json'
          },
          cache:
            'no-store'
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar aos dados administrativos do MA-Professor.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível carregar os dados administrativos do MA-Professor.'
      )
    )
  }

  const data =
    body as MAProfessorAdminOverviewResponse

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
      'O servidor devolveu dados administrativos inválidos para o MA-Professor.'
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
  }
}

async function decideAccessRequest(
  email: string,
  decision:
    'approve' |
    'reject'
) {
  const endpoint =
    decision ===
    'approve'
      ? 'approve'
      : 'reject'

  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/requests/${endpoint}`,
        {
          method: 'POST',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json',
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify({
              email
            })
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
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        decision ===
        'approve'
          ? 'Não foi possível aprovar o pedido.'
          : 'Não foi possível rejeitar o pedido.'
      )
    )
  }

  const data =
    body as MAProfessorAdminActionResponse

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O servidor devolveu uma resposta administrativa inválida.'
    )
  }

  return data
}

export async function approveMAProfessorAccessRequest(
  email: string
) {
  return decideAccessRequest(
    email,
    'approve'
  )
}

export async function rejectMAProfessorAccessRequest(
  email: string
) {
  return decideAccessRequest(
    email,
    'reject'
  )
}

export async function getMAProfessorCommercialStatus(
  email: string
): Promise<MAProfessorAdminCommercialStatus> {
  const query =
    new URLSearchParams({
      email
    })

  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/commerce/status?${query.toString()}`,
        {
          method: 'GET',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json'
          },
          cache:
            'no-store'
        }
      )
  } catch {
    throw new Error(
      'Não foi possível consultar o plano e pagamento desta conta.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível consultar o plano e pagamento desta conta.'
      )
    )
  }

  const data =
    body as MAProfessorCommercialStatusResponse

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O servidor devolveu um estado comercial inválido.'
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
): Promise<MAProfessorAdminCommercialStatus> {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/commerce/select-plan`,
        {
          method: 'POST',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json',
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
  } catch {
    throw new Error(
      'Não foi possível registar o plano escolhido.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível registar o plano escolhido.'
      )
    )
  }

  const data =
    body as MAProfessorCommercialStatusResponse

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O servidor devolveu um estado comercial inválido.'
    )
  }

  assertCommercialStatus(
    data.commerce
  )

  return data.commerce
}

export async function confirmMAProfessorPayment(
  email: string
): Promise<MAProfessorAdminCommercialStatus> {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/commerce/confirm-payment`,
        {
          method: 'POST',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json',
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify({
              email
            })
        }
      )
  } catch {
    throw new Error(
      'Não foi possível confirmar o pagamento.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível confirmar o pagamento.'
      )
    )
  }

  const data =
    body as MAProfessorCommercialStatusResponse

  if (
    !data ||
    data.success !== true
  ) {
    throw new Error(
      'O servidor devolveu um estado comercial inválido.'
    )
  }

  assertCommercialStatus(
    data.commerce
  )

  return data.commerce
}

export async function getMAProfessorCredentialStatus(
  email: string
): Promise<MAProfessorAdminCredentialStatus> {
  const query =
    new URLSearchParams({
      email
    })

  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/credentials/status?${query.toString()}`,
        {
          method: 'GET',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json'
          },
          cache:
            'no-store'
        }
      )
  } catch {
    throw new Error(
      'Não foi possível consultar o estado da senha.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível consultar o estado da senha.'
      )
    )
  }

  const data =
    body as MAProfessorCredentialStatusResponse

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
      'O servidor devolveu um estado de senha inválido.'
    )
  }

  return data.credential
}

export async function generateMAProfessorAccessPassword(
  email: string
): Promise<MAProfessorGeneratedCredential> {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/credentials/generate`,
        {
          method: 'POST',
          credentials:
            'include',
          headers: {
            Accept:
              'application/json',
            'Content-Type':
              'application/json'
          },
          body:
            JSON.stringify({
              email
            })
        }
      )
  } catch {
    throw new Error(
      'Não foi possível ligar ao backend para gerar a senha.'
    )
  }

  const body =
    await readResponseBody(
      response
    )

  if (
    response.status ===
    401
  ) {
    throw getSessionError()
  }

  if (!response.ok) {
    throw new Error(
      getApiMessage(
        body,
        'Não foi possível gerar a senha desta conta.'
      )
    )
  }

  const data =
    body as MAProfessorCredentialGenerateResponse

  if (
    !data ||
    data.success !== true ||
    !data.credential ||
    typeof data.credential.email !==
      'string' ||
    typeof data.credential.password !==
      'string' ||
    data.credential.password.length <
      6
  ) {
    throw new Error(
      'O servidor não devolveu uma senha válida.'
    )
  }

  return data.credential
}
