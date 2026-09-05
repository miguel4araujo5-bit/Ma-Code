import type {
  LicensePlan,
  LicenseSummary
} from '../types'

export const MA_PROFESSOR_ACCESS_STORAGE_KEY =
  'ma-professor-access-v1'

export const MA_PROFESSOR_DEVICE_STORAGE_KEY =
  'ma-professor-device-v1'

export type MAProfessorAccessRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'

export interface MAProfessorAccessRequestSummary {
  email: string
  status: MAProfessorAccessRequestStatus
  requestedAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
  activatedAt: string | null
}

export interface MAProfessorStoredAccess {
  token: string
  deviceId: string
  email: string
  license: LicenseSummary | null
  checkedAt?: string
}

export interface MAProfessorAccessSession {
  token: string
  deviceId: string
  email: string
  license: LicenseSummary | null
  checkedAt: string
}

export type MAProfessorLicensedAccessSession =
  MAProfessorAccessSession & {
    license: LicenseSummary
  }

export interface MAProfessorAccessResponse {
  success: true
  token: string
  email?: string
  license: LicenseSummary | null
}

export interface MAProfessorAccountSessionResponse {
  success: true
  email: string
  license: LicenseSummary | null
}

export interface MAProfessorAccessRequestResponse {
  success: true
  request: MAProfessorAccessRequestSummary
  canActivate: boolean
  message: string
}

export interface MAProfessorLicenseResponse {
  success: true
  license: LicenseSummary
}

export interface MAProfessorRenewalResponse {
  success: true
  license: LicenseSummary
  message: string
}

export interface MAProfessorAccessErrorResponse {
  success: false
  message: string
}

export type MAProfessorAccessApiResult =
  | MAProfessorAccessResponse
  | MAProfessorAccountSessionResponse
  | MAProfessorAccessRequestResponse
  | MAProfessorLicenseResponse
  | MAProfessorRenewalResponse
  | MAProfessorAccessErrorResponse

export type RenewableLicensePlan =
  Extract<
    LicensePlan,
    | 'paid_30_days'
    | 'school_year'
  >

export function isLicenseUsable(
  license: LicenseSummary | null | undefined
) {
  if (!license) {
    return false
  }

  const usableStatus =
    license.status === 'active' ||
    license.status === 'expiring' ||
    license.status === 'renewal_pending'

  if (
    !usableStatus ||
    !license.validUntil
  ) {
    return false
  }

  const validUntil =
    new Date(
      license.validUntil
    ).getTime()

  return (
    Number.isFinite(validUntil) &&
    validUntil > Date.now()
  )
}

export function getLicensePlanLabel(
  plan: LicensePlan | null
) {
  switch (plan) {
    case 'beta_30_days':
      return 'Beta gratuita · 30 dias'

    case 'paid_30_days':
      return 'Mensal'

    case 'school_year':
      return 'Até ao final do ano letivo'

    case 'courtesy_30_days':
      return 'Oferta de 30 dias'

    case 'courtesy_school_year':
      return 'Oferta até ao final do ano letivo'

    default:
      return 'Sem plano ativo'
  }
}

export function getLicenseStatusLabel(
  status:
    LicenseSummary['status']
) {
  switch (status) {
    case 'active':
      return 'Ativa'

    case 'expiring':
      return 'A terminar'

    case 'renewal_pending':
      return 'Renovação pedida'

    case 'expired':
      return 'Terminada'

    case 'revoked':
      return 'Revogada'

    default:
      return 'Inativa'
  }
}

export function getAccessRequestStatusLabel(
  status:
    MAProfessorAccessRequestStatus
) {
  switch (status) {
    case 'approved':
      return 'Aprovado'

    case 'rejected':
      return 'Rejeitado'

    default:
      return 'Pendente'
  }
}
