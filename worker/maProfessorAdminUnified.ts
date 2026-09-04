import {
  handleMAProfessorAdminApiRequest as handleExistingMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv
} from './maProfessorAdminFixed'

import {
  handleMAProfessorApprovalPlanRequest
} from './maProfessorApprovalAdmin'

export {
  isMAProfessorAdminApiPath
}

export type {
  MaProfessorAdminEnv
}

export async function handleMAProfessorAdminApiRequest(
  request: Request,
  env: MaProfessorAdminEnv
) {
  const approvalResponse =
    await handleMAProfessorApprovalPlanRequest(
      request,
      env
    )

  if (approvalResponse) {
    return approvalResponse
  }

  return handleExistingMAProfessorAdminApiRequest(
    request,
    env
  )
}
