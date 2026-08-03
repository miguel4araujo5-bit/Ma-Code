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
  handleMAProfessorAccessApiRequest,
  isMAProfessorAccessApiPath,
  MaProfessorAccessDurableObject
} from './maProfessorAccess'

import {
  handleMAProfessorSyncApiRequest,
  isMAProfessorSyncApiPath,
  type MaProfessorSyncEnv
} from './maProfessorSync'

export {
  BtcAlertsDurableObject,
  MaProfessorAccessDurableObject
}

export interface Env
  extends BaseEnv,
    BtcAlertsEnv,
    MaProfessorSyncEnv {}

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
      new URL(request.url)

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
