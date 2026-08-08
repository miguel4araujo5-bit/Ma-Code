import baseWorker, {
  type Env as BaseEnv
} from './index'

import {
  BtcAlertsDurableObject,
  handleBtcAlertsApiRequest,
  isBtcAlertsApiPath,
  runBtcAlertsScheduled,
  type BtcAlertsEnv
} from './maBtcAlerts'

import {
  handleMaCodeAdminApiRequest,
  isMaCodeAdminApiPath,
  type MaCodeAdminEnv
} from './maCodeAdmin'

import {
  handleMAProfessorAccessApiRequest,
  isMAProfessorAccessApiPath,
  MaProfessorAccessDurableObject
} from './maProfessorAccess'

import {
  handleMAProfessorRecoveryApiRequest,
  isMAProfessorRecoveryApiPath,
  type MaProfessorRecoveryEnv
} from './maProfessorRecovery'

import {
  handleMAProfessorSnapshotApiRequest,
  isMAProfessorSnapshotApiPath,
  type MaProfessorSnapshotEnv
} from './maProfessorSnapshot'

import {
  handleMAProfessorSyncApiRequest,
  isMAProfessorSyncApiPath,
  type MaProfessorSyncEnv
} from './maProfessorSync'

export {
  BtcAlertsDurableObject,
  MaProfessorAccessDurableObject
}

export type Env =
  BaseEnv &
  BtcAlertsEnv &
  MaCodeAdminEnv &
  MaProfessorSyncEnv &
  MaProfessorSnapshotEnv &
  MaProfessorRecoveryEnv

type ExecutionContextLike = {
  waitUntil(
    promise: Promise<unknown>
  ): void
}

export default {
  async fetch(
    request: Request,
    env: Env
  ) {
    const url =
      new URL(
        request.url
      )

    if (
      isMaCodeAdminApiPath(
        url.pathname
      )
    ) {
      return handleMaCodeAdminApiRequest(
        request,
        env
      )
    }

    if (
      isBtcAlertsApiPath(
        url.pathname
      )
    ) {
      return handleBtcAlertsApiRequest(
        request,
        env
      )
    }

    if (
      isMAProfessorAccessApiPath(
        url.pathname
      )
    ) {
      return handleMAProfessorAccessApiRequest(
        request,
        env
      )
    }

    if (
      isMAProfessorSyncApiPath(
        url.pathname
      )
    ) {
      return handleMAProfessorSyncApiRequest(
        request,
        env
      )
    }

    if (
      isMAProfessorRecoveryApiPath(
        url.pathname
      )
    ) {
      return handleMAProfessorRecoveryApiRequest(
        request,
        env
      )
    }

    if (
      isMAProfessorSnapshotApiPath(
        url.pathname
      )
    ) {
      return handleMAProfessorSnapshotApiRequest(
        request,
        env
      )
    }

    return baseWorker.fetch(
      request,
      env
    )
  },

  async scheduled(
    _controller: unknown,
    env: Env,
    context: ExecutionContextLike
  ) {
    context.waitUntil(
      runBtcAlertsScheduled(
        env
      )
    )
  }
}
