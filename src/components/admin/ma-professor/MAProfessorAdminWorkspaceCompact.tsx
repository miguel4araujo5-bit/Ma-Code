import type {
  LicenseRenewalRequest,
  LicenseSummary
} from '../../ma-professor/types'

import type {
  MAProfessorAdminAccessRequestSummary
} from '../../../lib/admin/maProfessorAdminApi'

import MAProfessorAdminWorkspace from './MAProfessorAdminWorkspace'

import './MAProfessorAdminWorkspaceCompact.css'

interface MAProfessorAdminWorkspaceCompactProps {
  accessRequests:
    MAProfessorAdminAccessRequestSummary[]
  licenses:
    LicenseSummary[]
  renewals:
    LicenseRenewalRequest[]
  dataConnected?: boolean
  onApproveRequest: (
    email: string
  ) => Promise<void>
  onRejectRequest: (
    email: string
  ) => Promise<void>
}

export default function MAProfessorAdminWorkspaceCompact({
  accessRequests,
  licenses,
  renewals,
  dataConnected = false,
  onApproveRequest,
  onRejectRequest
}: MAProfessorAdminWorkspaceCompactProps) {
  return (
    <div className="ma-professor-admin-workspace-compact">
      <MAProfessorAdminWorkspace
        accessRequests={accessRequests}
        licenses={licenses}
        renewals={renewals}
        dataConnected={dataConnected}
        onApproveRequest={onApproveRequest}
        onRejectRequest={onRejectRequest}
      />
    </div>
  )
}
