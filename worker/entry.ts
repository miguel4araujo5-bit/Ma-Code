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
  isMAProfessorAccessApiPath
} from './maProfessorAccess'

import {
  MaProfessorAccessDurableObject
} from './maProfessorAccessAdminBridge'

import {
  handleMAProfessorAdminApiRequest,
  isMAProfessorAdminApiPath,
  type MaProfessorAdminEnv
} from './maProfessorAdmin'

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

import {
  ConquistadorMatchmakingDurableObject,
  handleConquistadorMatchmakingApiRequest,
  isConquistadorMatchmakingApiPath,
  type ConquistadorMatchmakingEnv
} from './conquistadorMatchmaking'

import {
  ConquistadorGameSessionDurableObject,
  ensureConquistadorGameSession,
  handleConquistadorGameSessionApiRequest,
  isConquistadorGameSessionApiPath,
  type ConquistadorGameSessionEnv
} from './conquistadorGameSession'

export {
  BtcAlertsDurableObject,
  MaProfessorAccessDurableObject,
  ConquistadorMatchmakingDurableObject,
  ConquistadorGameSessionDurableObject
}

export type Env =
  BaseEnv &
  BtcAlertsEnv &
  MaCodeAdminEnv &
  MaProfessorAdminEnv &
  MaProfessorSyncEnv &
  MaProfessorSnapshotEnv &
  MaProfessorRecoveryEnv &
  ConquistadorMatchmakingEnv &
  ConquistadorGameSessionEnv

type ExecutionContextLike = {
  waitUntil(
    promise: Promise<unknown>
  ): void
}

const prepareMatchedGameSession =
  async (
    response: Response,
    env: Env
  ) => {
    if (!response.ok) {
      return response
    }

    const contentType =
      response.headers.get(
        'Content-Type'
      ) || ''

    if (
      !contentType
        .toLowerCase()
        .includes('application/json')
    ) {
      return response
    }

    let data:
      Record<string, unknown>

    try {
      data =
        await response
          .clone()
          .json() as Record<string, unknown>
    } catch {
      return response
    }

    if (
      data.success !== true ||
      data.status !== 'matched'
    ) {
      return response
    }

    if (
      typeof data.matchId !== 'string' ||
      typeof data.playerId !== 'string' ||
      typeof data.reconnectToken !== 'string' ||
      !Array.isArray(
        data.participants
      ) ||
      !Array.isArray(
        data.gameSessionCredentials
      )
    ) {
      const headers =
        new Headers(
          response.headers
        )

      headers.set(
        'Content-Type',
        'application/json; charset=utf-8'
      )

      const {
        gameSessionCredentials:
          _gameSessionCredentials,
        ...publicData
      } = data

      return new Response(
        JSON.stringify({
          ...publicData,
          success: false,
          message:
            'Não foi possível preparar as credenciais seguras da partida online.'
        }),
        {
          status: 503,
          headers
        }
      )
    }

    try {
      await ensureConquistadorGameSession(
        env,
        data.matchId,
        data.participants,
        data.gameSessionCredentials
      )
    } catch (error) {
      const headers =
        new Headers(
          response.headers
        )

      headers.set(
        'Content-Type',
        'application/json; charset=utf-8'
      )

      const {
        gameSessionCredentials:
          _gameSessionCredentials,
        ...publicData
      } = data

      return new Response(
        JSON.stringify({
          ...publicData,
          success: false,
          message:
            error instanceof Error
              ? error.message
              : 'Não foi possível preparar a partida online.'
        }),
        {
          status: 503,
          headers
        }
      )
    }

    const headers =
      new Headers(
        response.headers
      )

    headers.set(
      'Content-Type',
      'application/json; charset=utf-8'
    )

    const {
      gameSessionCredentials:
        _gameSessionCredentials,
      ...publicData
    } = data

    return new Response(
      JSON.stringify({
        ...publicData,
        gameSessionReady: true
      }),
      {
        status:
          response.status,
        statusText:
          response.statusText,
        headers
      }
    )
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
      isConquistadorGameSessionApiPath(
        url.pathname
      )
    ) {
      return handleConquistadorGameSessionApiRequest(
        request,
        env
      )
    }

    if (
      isConquistadorMatchmakingApiPath(
        url.pathname
      )
    ) {
      const response =
        await handleConquistadorMatchmakingApiRequest(
          request,
          env
        )

      return prepareMatchedGameSession(
        response,
        env
      )
    }

    if (
      isMAProfessorAdminApiPath(
        url.pathname
      )
    ) {
      return handleMAProfessorAdminApiRequest(
        request,
        env
      )
    }

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
