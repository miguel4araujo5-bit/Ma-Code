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
  generatedAt: string
}

interface MAProfessorAdminOverviewResponse
  extends MAProfessorAdminOverview {
  success: true
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
    typeof body === 'object'
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

export async function getMAProfessorAdminOverview():
  Promise<MAProfessorAdminOverview> {
  let response: Response

  try {
    response =
      await fetch(
        `${MA_PROFESSOR_ADMIN_API_PREFIX}/overview`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Accept:
              'application/json'
          },
          cache: 'no-store'
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
    response.status === 401
  ) {
    throw new Error(
      'A sessão administrativa expirou. Atualize a página e volte a entrar.'
    )
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
    body as
      MAProfessorAdminOverviewResponse

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
