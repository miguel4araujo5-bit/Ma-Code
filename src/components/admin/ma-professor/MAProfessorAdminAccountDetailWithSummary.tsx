import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import type {
  MAProfessorAdminAccessRequestSummary
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAdminAccountDetail from './MAProfessorAdminAccountDetail'
import MAProfessorAdminAccountFlowSummary from './MAProfessorAdminAccountFlowSummary'
import './MAProfessorAdminAccountDetailCompact.css'

interface MAProfessorAdminAccountDetailWithSummaryProps {
  email: string
  request:
    MAProfessorAdminAccessRequestSummary |
    null
  license:
    LicenseSummary |
    null
  renewals:
    LicenseRenewalRequest[]
  dataConnected?: boolean
  onClose: () => void
}

export default function MAProfessorAdminAccountDetailWithSummary({
  email,
  request,
  license,
  renewals,
  dataConnected = false,
  onClose
}: MAProfessorAdminAccountDetailWithSummaryProps) {
  return (
    <div className="ma-professor-admin-account-detail-compact space-y-4">
      <MAProfessorAdminAccountFlowSummary
        email={email}
        request={request}
        license={license}
        dataConnected={dataConnected}
      />

      <MAProfessorAdminAccountDetail
        email={email}
        request={request}
        license={license}
        renewals={renewals}
        dataConnected={dataConnected}
        onClose={onClose}
      />
    </div>
  )
}
