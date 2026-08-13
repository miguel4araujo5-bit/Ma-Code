import {
  ConquistadorGameSessionDurableObject as BaseConquistadorGameSessionDurableObject,
  ensureConquistadorGameSession,
  type ConquistadorGameSessionEnv
} from './conquistadorGameSession'

import {
  ConquistadorMatchmakingDurableObject as BaseConquistadorMatchmakingDurableObject,
  type ConquistadorMatchmakingEnv
} from './conquistadorMatchmaking'

const GAME_API_PREFIX =
  '/api/conquistador/game'

const MATCHMAKING_API_PREFIX =
  '/api/conquistador/matchmaking'

const MATCHMAKING_OBJECT_NAME =
  'conquistador-matchmaking-global'

const PENDING_SOCKET_MAX_AGE_MS =
  12_000

const PRESENCE_WARNING_AFTER_DISCONNECT_MS =
  15_000

const MAX_SOCKET_MESSAGE_CHARACTERS =
  32_000

type DurableObjectIdLike =
  unknown

type DurableObjectStubLike = {
  fetch(
    input: Request | string,
    init?: RequestInit
  ): Promise<Response>
}

type DurableObjectNamespaceLike = {
  idFromName(
    name: string
  ): DurableObjectIdLike

  get(
    id: DurableObjectIdLike
  ): DurableObjectStubLike
}

type RealtimeStorageLike = {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>

  getAlarm(): Promise<number | null>

  setAlarm(
    scheduledTime: number | Date
  ): Promise<void>

  deleteAlarm(): Promise<void>
}

type RealtimeDurableObjectStateLike = {
  storage: RealtimeStorageLike

  blockConcurrencyWhile<T>(
    callback: () => Promise<T>
  ): Promise<T>

  acceptWebSocket(
    socket: WebSocket
  ): void

  getWebSockets(): WebSocket[]
}

type HibernationWebSocket =
  WebSocket & {
    serializeAttachment(
      value: unknown
    ): void

    deserializeAttachment(): unknown
  }

declare const WebSocketPair: {
  new(): {
    0: WebSocket
    1: WebSocket
  }
}

type GamePendingAttachment = {
  kind: 'game-pending'
  matchId: string
  openedAt: number
}

type GameSocketAttachment = {
  kind: 'game'
  matchId: string
  playerId: string
  reconnectToken: string
  revision: number | null
  lastTouchedAt: number
  disconnectNotifiedAt?: number
}

type MatchmakingSocketAttachment = {
  kind: 'matchmaking'
  ticketId: string
  openedAt: number
}

type SocketAttachment =
  | GamePendingAttachment
  | GameSocketAttachment
  | MatchmakingSocketAttachment

type JsonObject =
  Record<string, unknown>

export type ConquistadorRealtimeEnv =
  ConquistadorGameSessionEnv &
  ConquistadorMatchmakingEnv

const json = (
  body: unknown,
  status = 200
) =>
  new Response(
    JSON.stringify(
      body
    ),
    {
      status,

      headers: {
        'Content-Type':
          'application/json; charset=utf-8',

        'Cache-Control':
          'no-store',

        'X-Content-Type-Options':
          'nosniff'
      }
    }
  )

const normalizeId = (
  value: unknown,
  maxLength = 128
) =>
  typeof value ===
  'string'
    ? value
        .replace(
          /[^A-Za-z0-9_-]/g,
          ''
        )
        .slice(
          0,
          maxLength
        )
    : ''

const normalizeReconnectToken = (
  value: unknown
) => {
  const token =
    typeof value ===
    'string'
      ? value.trim()
      : ''

  return (
    token.length >=
      32 &&
    token.length <=
      256 &&
    /^[A-Za-z0-9_-]+$/.test(
      token
    )
  )
    ? token
    : ''
}

const normalizeRevision = (
  value: unknown
) => {
  const revision =
    Number(
      value
    )

  return (
    Number.isInteger(
      revision
    ) &&
    revision >=
      0
  )
    ? revision
    : null
}

const normalizeOrigin = (
  value: string
) => {
  try {
    return new URL(
      value
    ).origin
  } catch {
    return ''
  }
}

const isAllowedOrigin = (
  request: Request
) => {
  const requestOrigin =
    new URL(
      request.url
    ).origin

  const origin =
    normalizeOrigin(
      request.headers.get(
        'Origin'
      ) || ''
    )

  if (!origin) {
    return false
  }

  const allowed =
    new Set([
      requestOrigin,
      'https://ma-code.pt',
      'https://www.ma-code.pt'
    ])

  try {
    const hostname =
      new URL(
        origin
      ).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(
        hostname
      )
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(
    origin
  )
}

const isWebSocketUpgrade = (
  request: Request
) =>
  request.method ===
    'GET' &&
  (
    request.headers.get(
      'Upgrade'
    ) || ''
  ).toLowerCase() ===
    'websocket'

const createWebSocketResponse = (
  socket: WebSocket
) =>
  new Response(
    null,
    {
      status: 101,

      webSocket:
        socket
    } as ResponseInit & {
      webSocket: WebSocket
    }
  )

const readSocketMessage = (
  message:
    | string
    | ArrayBuffer
) => {
  if (
    typeof message ===
    'string'
  ) {
    return message
  }

  return new TextDecoder()
    .decode(
      message
    )
}

const parseSocketMessage = (
  message:
    | string
    | ArrayBuffer
) => {
  const text =
    readSocketMessage(
      message
    )

  if (
    text.length >
    MAX_SOCKET_MESSAGE_CHARACTERS
  ) {
    throw new Error(
      'A mensagem realtime é demasiado grande.'
    )
  }

  const parsed =
    JSON.parse(
      text
    ) as unknown

  if (
    !parsed ||
    typeof parsed !==
      'object' ||
    Array.isArray(
      parsed
    )
  ) {
    throw new Error(
      'A mensagem realtime não é válida.'
    )
  }

  return parsed as
    JsonObject
}

const getAttachment = (
  socket: WebSocket
): SocketAttachment | null => {
  try {
    const value =
      (
        socket as
          HibernationWebSocket
      ).deserializeAttachment()

    if (
      !value ||
      typeof value !==
        'object'
    ) {
      return null
    }

    return value as
      SocketAttachment
  } catch {
    return null
  }
}

const setAttachment = (
  socket: WebSocket,
  attachment:
    SocketAttachment
) => {
  try {
    (
      socket as
        HibernationWebSocket
    ).serializeAttachment(
      attachment
    )
  } catch {}
}

const sendSocketJson = (
  socket: WebSocket,
  body: unknown
) => {
  if (
    socket.readyState !==
    1
  ) {
    return false
  }

  try {
    socket.send(
      JSON.stringify(
        body
      )
    )

    return true
  } catch {
    return false
  }
}

const closeSocket = (
  socket: WebSocket,
  code = 1000,
  reason = ''
) => {
  try {
    socket.close(
      code,
      reason.slice(
        0,
        120
      )
    )
  } catch {}
}

const internalJsonRequest = (
  path: string,
  body: JsonObject
) =>
  new Request(
    `https://conquistador.internal${path}`,
    {
      method:
        'POST',

      headers: {
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify(
          body
        )
    }
  )

const parseResponse =
  async (
    response: Response
  ) => {
    let data:
      JsonObject = {}

    try {
      data =
        await response
          .clone()
          .json() as
            JsonObject
    } catch {}

    return {
      response,
      data
    }
  }

const publicGameError = (
  status: number,
  data: JsonObject
) => ({
  type:
    'error',

  status,

  message:
    typeof data.message ===
      'string'
      ? data.message
      : 'Não foi possível continuar a partida online.',

  data
})

export const handleConquistadorGameRealtimeApiRequest =
  async (
    request: Request,
    env:
      ConquistadorRealtimeEnv
  ) => {
    if (
      !isWebSocketUpgrade(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este endpoint realtime requer WebSocket.'
        },

        426
      )
    }

    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Pedido bloqueado por origem inválida.'
        },

        403
      )
    }

    const url =
      new URL(
        request.url
      )

    const matchId =
      normalizeId(
        url.searchParams.get(
          'matchId'
        )
      )

    if (!matchId) {
      return json(
        {
          success:
            false,

          message:
            'A sessão da partida não é válida.'
        },

        400
      )
    }

    const namespace =
      env.CONQUISTADOR_GAME as
        DurableObjectNamespaceLike

    const id =
      namespace.idFromName(
        matchId
      )

    return namespace
      .get(
        id
      )
      .fetch(
        request
      )
  }

export const handleConquistadorMatchmakingRealtimeApiRequest =
  async (
    request: Request,
    env:
      ConquistadorRealtimeEnv
  ) => {
    if (
      !isWebSocketUpgrade(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este endpoint realtime requer WebSocket.'
        },

        426
      )
    }

    if (
      !isAllowedOrigin(
        request
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Pedido bloqueado por origem inválida.'
        },

        403
      )
    }

    const url =
      new URL(
        request.url
      )

    const ticketId =
      normalizeId(
        url.searchParams.get(
          'ticketId'
        )
      )

    if (!ticketId) {
      return json(
        {
          success:
            false,

          message:
            'O pedido de matchmaking não é válido.'
        },

        400
      )
    }

    const namespace =
      env.CONQUISTADOR_MATCHMAKING as
        DurableObjectNamespaceLike

    const id =
      namespace.idFromName(
        MATCHMAKING_OBJECT_NAME
      )

    return namespace
      .get(
        id
      )
      .fetch(
        request
      )
  }

export class ConquistadorGameSessionDurableObject
  extends BaseConquistadorGameSessionDurableObject {
  private readonly realtimeState:
    RealtimeDurableObjectStateLike

  constructor(
    state:
      RealtimeDurableObjectStateLike,
    env:
      ConquistadorRealtimeEnv
  ) {
    super(
      state,
      env
    )

    this.realtimeState =
      state
  }

  async fetch(
    request: Request
  ): Promise<Response> {
    if (
      isWebSocketUpgrade(
        request
      )
    ) {
      return this
        .handleWebSocketUpgrade(
          request
        )
    }

    const response =
      await super.fetch(
        request
      )

    const pathname =
      new URL(
        request.url
      ).pathname

    if (
      response.ok &&
      (
        pathname ===
          '/command' ||
        pathname ===
          '/leave' ||
        pathname ===
          '/turn-timeout'
      )
    ) {
      await this
        .broadcastGameState()
    }

    return response
  }

  async alarm():
    Promise<void> {
    await this
      .closeExpiredPendingSockets()

    await super.alarm()

    await this
      .broadcastGameState()
  }

  async webSocketMessage(
    socket: WebSocket,
    message:
      | string
      | ArrayBuffer
  ) {
    let body:
      JsonObject

    try {
      body =
        parseSocketMessage(
          message
        )
    } catch (
      error
    ) {
      sendSocketJson(
        socket,
        {
          type:
            'error',

          status:
            400,

          message:
            error instanceof
            Error
              ? error.message
              : 'A mensagem realtime não é válida.'
        }
      )

      closeSocket(
        socket,
        1003,
        'Mensagem inválida'
      )

      return
    }

    const type =
      typeof body.type ===
        'string'
        ? body.type
        : ''

    if (
      type ===
      'auth'
    ) {
      await this
        .handleSocketAuth(
          socket,
          body
        )

      return
    }

    const attachment =
      getAttachment(
        socket
      )

    if (
      !attachment ||
      attachment.kind !==
        'game'
    ) {
      sendSocketJson(
        socket,
        {
          type:
            'error',

          status:
            401,

          message:
            'A ligação realtime ainda não está autenticada.'
        }
      )

      closeSocket(
        socket,
        1008,
        'Sessão não autenticada'
      )

      return
    }

    if (
      type ===
      'state'
    ) {
      await this
        .handleSocketState(
          socket,
          attachment,
          body
        )

      return
    }

    if (
      type ===
      'command'
    ) {
      await this
        .handleSocketCommand(
          socket,
          attachment,
          body
        )

      return
    }

    if (
      type ===
      'turn-timeout'
    ) {
      await this
        .handleSocketTurnTimeout(
          socket,
          attachment,
          body
        )

      return
    }

    sendSocketJson(
      socket,
      {
        type:
          'error',

        status:
          400,

        message:
          'A mensagem realtime não é suportada.'
      }
    )
  }

  async webSocketClose(
    socket: WebSocket,
    _code: number,
    _reason: string
  ) {
    await this
      .markSocketDisconnected(
        socket
      )
  }

  async webSocketError(
    socket: WebSocket
  ) {
    await this
      .markSocketDisconnected(
        socket
      )

    closeSocket(
      socket,
      1011,
      'Erro realtime'
    )
  }

  private async handleWebSocketUpgrade(
    request: Request
  ) {
    const url =
      new URL(
        request.url
      )

    const matchId =
      normalizeId(
        url.searchParams.get(
          'matchId'
        )
      )

    if (!matchId) {
      return json(
        {
          success:
            false,

          message:
            'A sessão da partida não é válida.'
        },

        400
      )
    }

    const pair =
      new WebSocketPair()

    const client =
      pair[0]

    const server =
      pair[1] as
        HibernationWebSocket

    this.realtimeState
      .acceptWebSocket(
        server
      )

    const now =
      Date.now()

    setAttachment(
      server,
      {
        kind:
          'game-pending',

        matchId,

        openedAt:
          now
      }
    )

    await this
      .scheduleAlarmNoLaterThan(
        now +
          PENDING_SOCKET_MAX_AGE_MS
      )

    return createWebSocketResponse(
      client
    )
  }

  private async handleSocketAuth(
    socket: WebSocket,
    body: JsonObject
  ) {
    const pending =
      getAttachment(
        socket
      )

    if (
      !pending ||
      pending.kind !==
        'game-pending'
    ) {
      sendSocketJson(
        socket,
        {
          type:
            'error',

          status:
            409,

          message:
            'Esta ligação realtime já foi inicializada.'
        }
      )

      return
    }

    const playerId =
      normalizeId(
        body.playerId
      )

    const reconnectToken =
      normalizeReconnectToken(
        body.reconnectToken
      )

    if (
      !playerId ||
      !reconnectToken
    ) {
      sendSocketJson(
        socket,
        {
          type:
            'error',

          status:
            400,

          message:
            'A credencial da partida não é válida.'
        }
      )

      closeSocket(
        socket,
        1008,
        'Credencial inválida'
      )

      return
    }

    const result =
      await this
        .callSocketConnect(
          pending.matchId,
          playerId,
          reconnectToken
        )

    if (
      !result.response.ok ||
      result.data.success !==
        true
    ) {
      sendSocketJson(
        socket,
        publicGameError(
          result.response.status,
          result.data
        )
      )

      closeSocket(
        socket,
        1008,
        'Autenticação recusada'
      )

      return
    }

    const revision =
      normalizeRevision(
        result.data.revision
      )

    const attachment:
      GameSocketAttachment = {
        kind:
          'game',

        matchId:
          pending.matchId,

        playerId,

        reconnectToken,

        revision,

        lastTouchedAt:
          Date.now()
      }

    setAttachment(
      socket,
      attachment
    )

    this.closeOtherPlayerSockets(
      socket,
      attachment
    )

    sendSocketJson(
      socket,
      {
        type:
          'state',

        data:
          result.data
      }
    )
  }

  private async handleSocketState(
    socket: WebSocket,
    attachment:
      GameSocketAttachment,
    body: JsonObject
  ) {
    const requestId =
      normalizeId(
        body.requestId,
        96
      )

    const result =
      await this
        .callSocketState(
          attachment.matchId,
          attachment.playerId,
          attachment.reconnectToken,
          normalizeRevision(
            body.knownRevision
          ) ??
            attachment.revision
        )

    if (
      result.response.ok &&
      result.data.success ===
        true
    ) {
      this.updateGameAttachment(
        socket,
        attachment,
        result.data
      )
    }

    sendSocketJson(
      socket,
      {
        type:
          'state-result',

        requestId,

        ok:
          result.response.ok &&
          result.data.success ===
            true,

        status:
          result.response.status,

        data:
          result.data
      }
    )

    if (
      [
        401,
        403,
        410
      ].includes(
        result.response.status
      )
    ) {
      closeSocket(
        socket,
        1008,
        'Sessão terminada'
      )
    }
  }

  private async handleSocketCommand(
    socket: WebSocket,
    attachment:
      GameSocketAttachment,
    body: JsonObject
  ) {
    const requestId =
      normalizeId(
        body.requestId,
        96
      )

    const command =
      body.command &&
      typeof body.command ===
        'object' &&
      !Array.isArray(
        body.command
      )
        ? body.command as
            JsonObject
        : null

    if (!command) {
      sendSocketJson(
        socket,
        {
          type:
            'command-result',

          requestId,

          ok:
            false,

          status:
            400,

          data: {
            success:
              false,

            message:
              'A ação online não é válida.'
          }
        }
      )

      return
    }

    const response =
      await super.fetch(
        internalJsonRequest(
          '/socket-command',
          {
            matchId:
              attachment.matchId,

            playerId:
              attachment.playerId,

            reconnectToken:
              attachment.reconnectToken,

            revision:
              normalizeRevision(
                body.revision
              ) ??
                attachment.revision,

            command
          }
        )
      )

    const result =
      await parseResponse(
        response
      )

    if (
      result.data.game
    ) {
      this.updateGameAttachment(
        socket,
        attachment,
        result.data
      )
    }

    sendSocketJson(
      socket,
      {
        type:
          'command-result',

        requestId,

        ok:
          result.response.ok &&
          result.data.success ===
            true,

        status:
          result.response.status,

        data:
          result.data
      }
    )

    if (
      result.response.ok &&
      result.data.success ===
        true
    ) {
      await this
        .broadcastGameState(
          socket
        )
    }

    if (
      [
        401,
        403,
        410
      ].includes(
        result.response.status
      )
    ) {
      closeSocket(
        socket,
        1008,
        'Sessão terminada'
      )
    }
  }

  private async handleSocketTurnTimeout(
    socket: WebSocket,
    attachment:
      GameSocketAttachment,
    body: JsonObject
  ) {
    const requestId =
      normalizeId(
        body.requestId,
        96
      )

    const sequence =
      normalizeRevision(
        body.sequence
      )

    if (
      sequence ===
      null
    ) {
      sendSocketJson(
        socket,
        {
          type:
            'turn-timeout-result',

          requestId,

          ok:
            false,

          status:
            400,

          data: {
            success:
              false,

            message:
              'O identificador do limite de tempo não é válido.'
          }
        }
      )

      return
    }

    const response =
      await super.fetch(
        internalJsonRequest(
          '/turn-timeout',
          {
            matchId:
              attachment.matchId,

            playerId:
              attachment.playerId,

            reconnectToken:
              attachment.reconnectToken,

            sequence
          }
        )
      )

    const result =
      await parseResponse(
        response
      )

    if (
      result.data.game
    ) {
      this.updateGameAttachment(
        socket,
        attachment,
        result.data
      )
    }

    const succeeded =
      result.response.ok &&
      result.data.success ===
        true

    const kicked =
      result.data.kicked ===
        true ||
      result.data.status ===
        'player-replaced'

    sendSocketJson(
      socket,
      {
        type:
          'turn-timeout-result',

        requestId,

        ok:
          succeeded,

        status:
          result.response.status,

        data:
          result.data
      }
    )

    if (
      succeeded
    ) {
      await this
        .broadcastGameState(
          socket
        )
    }

    if (
      kicked ||
      [
        401,
        403,
        410
      ].includes(
        result.response.status
      )
    ) {
      closeSocket(
        socket,
        1008,
        'Sessão terminada'
      )
    }
  }

  private async callSocketConnect(
