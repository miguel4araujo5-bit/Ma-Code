import type {
  LicensePlan,
  LicenseSummary
} from '../types'

export const MA_PROFESSOR_ACCESS_STORAGE_KEY =
  'ma-professor-access-v1'

export const MA_PROFESSOR_DEVICE_STORAGE_KEY =
  'ma-professor-device-v1'

export interface MAProfessorAccessSession {
  token: string
  deviceId: string
  email: string
  license: LicenseSummary
  checkedAt: string
}

export interface MAProfessorAccessResponse {
  success: true
  token: string
  license: LicenseSummary
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
  | MAProfessorLicenseResponse
  | MAProfessorRenewalResponse
  | MAProfessorAccessErrorResponse

export type RenewableLicensePlan = Extract<
  LicensePlan,
  'paid_30_days' | 'school_year'
>

export function isLicenseUsable(
  license: LicenseSummary
) {
  return (
    license.status === 'active' ||
    license.status === 'expiring' ||
    license.status === 'renewal_pending'
  )
}

export function getLicensePlanLabel(
  plan: LicensePlan | null
) {
  switch (plan) {
    case 'beta_30_days':
      return 'Beta gratuita · 4 meses'
    case 'paid_30_days':
      return 'Mensal'
    case 'school_year':
      return 'Até ao fim do ano letivo'
    case 'courtesy_30_days':
      return 'Oferta de 30 dias'
    case 'courtesy_school_year':
      return 'Oferta até ao fim do ano letivo'
    default:
      return 'Sem plano ativo'
  }
}

export function getLicenseStatusLabel(
  status: LicenseSummary['status']
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
