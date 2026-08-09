import {
  Game
} from '../public/jogos/conquistador/src/game/Game.js'

const API_PREFIX =
  '/api/conquistador/game'

const STORAGE_KEY =
  'conquistador-game-session-v1'

const MATCH_SIZE = 4
const MAX_NAME_LENGTH = 24

type PlayerKind =
  | 'human'
  | 'bot'

type MatchParticipant = {
  id: string
  name: string
  kind: PlayerKind
  icon: string | null
}

type StoredSession = {
  matchId: string
  createdAt: number
  updatedAt: number
  revision: number
  participants: MatchParticipant[]
  game: Record<string, unknown>
}

type DurableObjectIdLike = unknown

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

type DurableObjectStorageLike = {
  get<T>(
    key: string
  ): Promise<T | undefined>

  put<T>(
    key: string,
    value: T
  ): Promise<void>
}

type DurableObjectStateLike = {
  storage: DurableObjectStorageLike
  blockConcurrencyWhile<T>(
    callback: () => Promise<T>
  ): Promise<T>
}

export type ConquistadorGameSessionEnv = {
  CONQUISTADOR_GAME:
    DurableObjectNamespaceLike
}

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {}
) =>
  new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        'Cache-Control':
          'no-store',
        'X-Content-Type-Options':
          'nosniff',
        ...headers
      }
    }
  )

const normalizeOrigin = (
  value: string
) => {
  try {
    return new URL(value).origin
  } catch {
    return ''
  }
}

const isAllowedOrigin = (
  request: Request
) => {
  const requestOrigin =
    new URL(request.url).origin

  const origin = normalizeOrigin(
    request.headers.get('Origin') || ''
  )

  const referer = normalizeOrigin(
    request.headers.get('Referer') || ''
  )

  const candidate =
    origin || referer

  if (!candidate) {
    return false
  }

  const allowed = new Set([
    requestOrigin,
    'https://ma-code.pt',
    'https://www.ma-code.pt'
  ])

  try {
    const hostname =
      new URL(candidate).hostname

    if (
      [
        'localhost',
        '127.0.0.1',
        '0.0.0.0'
      ].includes(hostname)
    ) {
      return true
    }
  } catch {
    return false
  }

  return allowed.has(candidate)
}

const getBody = async (
  request: Request
) => {
  const contentType =
    request.headers.get(
      'Content-Type'
    ) || ''

  if (
    !contentType
      .toLowerCase()
      .includes('application/json')
  ) {
    throw new Error(
      'O pedido deve usar JSON.'
    )
  }

  const body =
    await request.json()

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new Error(
      'O pedido enviado não é válido.'
    )
  }

  return body as Record<string, unknown>
}

const normalizeId = (
  value: unknown
) => {
  if (
    typeof value !== 'string'
  ) {
    return ''
  }

  return value
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, 96)
}

const normalizeName = (
  value: unknown
) => {
  if (
    typeof value !== 'string'
  ) {
    return ''
  }

  return value
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
}

const normalizeParticipants = (
  value: unknown
): MatchParticipant[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const participants =
    value.map(
      (item) => {
        if (
          !item ||
          typeof item !== 'object' ||
          Array.isArray(item)
        ) {
          return null
        }

        const source =
          item as Record<string, unknown>

        const id =
          normalizeId(source.id)

        const name =
          normalizeName(source.name)

        const kind =
          source.kind === 'bot'
            ? 'bot'
            : source.kind === 'human'
              ? 'human'
              : null

        if (
          !id ||
          !name ||
          !kind
        ) {
          return null
        }

        return {
          id,
          name,
          kind,
          icon:
            kind === 'bot'
              ? '⚙'
              : null
        } as MatchParticipant
      }
    )
    .filter(
      (
        participant
      ): participant is MatchParticipant =>
        Boolean(participant)
    )

  if (
    participants.length !==
    MATCH_SIZE
  ) {
    return []
  }

  const uniqueIds =
    new Set(
      participants.map(
        (participant) =>
          participant.id
      )
    )

  if (
    uniqueIds.size !==
    MATCH_SIZE
  ) {
    return []
  }

  return participants
}

const getSessionObject = (
  env: ConquistadorGameSessionEnv,
  matchId: string
) => {
  const id =
    env.CONQUISTADOR_GAME
      .idFromName(matchId)

  return env.CONQUISTADOR_GAME
    .get(id)
}

const getResourceTotal = (
  resources: unknown
) => {
  if (
    !resources ||
    typeof resources !== 'object' ||
    Array.isArray(resources)
  ) {
    return 0
  }

  return Object.values(
    resources as Record<string, unknown>
  ).reduce<number>(
    (total, value) =>
      total +
      Math.max(
        0,
        Number(value) || 0
      ),
    0
  )
}

const createClientView = (
  session: StoredSession,
  viewerId: string
) => {
  const game =
    session.game as Record<string, unknown>

  const rawPlayers =
    Array.isArray(game.players)
      ? game.players
      : []

  const participantsById =
    new Map(
      session.participants.map(
        (participant) => [
          participant.id,
          participant
        ]
      )
    )

  const players =
    rawPlayers.map(
      (rawPlayer) => {
        const player =
          rawPlayer &&
          typeof rawPlayer === 'object' &&
          !Array.isArray(rawPlayer)
            ? rawPlayer as Record<string, unknown>
            : {}

        const id =
          String(player.id || '')

        const participant =
          participantsById.get(id)

        const isSelf =
          id === viewerId

        const resources =
          player.resources &&
          typeof player.resources === 'object' &&
          !Array.isArray(player.resources)
            ? player.resources as Record<string, unknown>
            : {}

        return {
          id,
          name:
            String(player.name || ''),
          houseId:
            player.houseId ?? null,
          color:
            player.color ?? null,
          symbol:
            player.symbol ?? null,
          prestige:
            Number(player.prestige) || 0,
          pieces:
            player.pieces ?? {},
          usedGuardCaptains:
            Number(player.usedGuardCaptains) || 0,
          contractPrestige:
            Number(player.contractPrestige) || 0,
          hasLargestNetwork:
            Boolean(player.hasLargestNetwork),
          hasLargestMilitary:
            Boolean(player.hasLargestMilitary),
          kind:
            participant?.kind || 'human',
          icon:
            participant?.icon || null,
          totalResources:
            getResourceTotal(resources),
          resources:
            isSelf
              ? resources
              : null,
          isSelf
        }
      }
    )

  const currentPlayerIndex =
    Number(game.currentPlayerIndex) || 0

  const currentPlayer =
    players[
      currentPlayerIndex
    ] || null

  return {
    matchId:
      session.matchId,
    revision:
      session.revision,
    createdAt:
      session.createdAt,
    updatedAt:
      session.updatedAt,
    viewerId,
    participants:
      session.participants,
    game: {
      id:
        game.id ?? null,
      seed:
        game.seed ?? null,
      phase:
        game.phase ?? null,
      turnNumber:
        Number(game.turnNumber) || 1,
      currentPlayerIndex,
      currentPlayerId:
        currentPlayer?.id || null,
      board:
        game.board ?? null,
      bank:
        game.bank ?? null,
      lastRoll:
        game.lastRoll ?? null,
      history:
        game.history ?? [],
      winnerId:
        game.winnerId ?? null,
      sevenEvent:
        game.sevenEvent ?? null,
      threat:
        game.threat ?? null,
      players
    }
  }
}

export const isConquistadorGameSessionApiPath = (
  pathname: string
) =>
  pathname === API_PREFIX ||
  pathname.startsWith(
    `${API_PREFIX}/`
  )

export const ensureConquistadorGameSession =
  async (
    env: ConquistadorGameSessionEnv,
    matchIdValue: unknown,
    participantsValue: unknown
  ) => {
    const matchId =
      normalizeId(matchIdValue)

    const participants =
      normalizeParticipants(
        participantsValue
      )

    if (
      !matchId ||
      participants.length !==
        MATCH_SIZE
    ) {
      throw new Error(
        'O matchmaking devolveu uma composição de partida inválida.'
      )
    }

    const response =
      await getSessionObject(
        env,
        matchId
      ).fetch(
        new Request(
          'https://conquistador.internal/bootstrap',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },
            body:
              JSON.stringify({
                matchId,
                participants
              })
          }
        )
      )

    if (!response.ok) {
      let message =
        'Não foi possível preparar a sessão da partida.'

      try {
        const body =
          await response.json() as {
            message?: string
          }

        if (body?.message) {
          message = body.message
        }
      } catch {}

      throw new Error(message)
    }
  }

export const handleConquistadorGameSessionApiRequest =
  async (
    request: Request,
    env: ConquistadorGameSessionEnv
  ) => {
    const origin = normalizeOrigin(
      request.headers.get('Origin') || ''
    )

    const corsHeaders:
      Record<string, string> = {}

    if (
      origin &&
      isAllowedOrigin(request)
    ) {
      corsHeaders[
        'Access-Control-Allow-Origin'
      ] = origin
      corsHeaders.Vary =
        'Origin'
    }

    if (
      request.method === 'OPTIONS'
    ) {
      if (!isAllowedOrigin(request)) {
        return json(
          {
            success: false,
            message:
              'Pedido bloqueado por origem inválida.'
          },
          403
        )
      }

      return new Response(
        null,
        {
          status: 204,
          headers: {
            ...corsHeaders,
            'Access-Control-Allow-Headers':
              'Content-Type',
            'Access-Control-Allow-Methods':
              'POST, OPTIONS',
            'Access-Control-Max-Age':
              '86400'
          }
        }
      )
    }

    if (
      request.method !== 'POST'
    ) {
      return json(
        {
          success: false,
          message:
            'Método não permitido.'
        },
        405,
        {
          ...corsHeaders,
          Allow: 'POST, OPTIONS'
        }
      )
    }

    if (!isAllowedOrigin(request)) {
      return json(
        {
          success: false,
          message:
            'Pedido bloqueado por origem inválida.'
        },
        403,
        corsHeaders
      )
    }

    try {
      const body =
        await getBody(request)

      const matchId =
        normalizeId(body.matchId)

      const playerId =
        normalizeId(body.playerId)

      if (
        !matchId ||
        !playerId
      ) {
        return json(
          {
            success: false,
            message:
              'A sessão ou o jogador não são válidos.'
          },
          400,
          corsHeaders
        )
      }

      const stub =
        getSessionObject(
          env,
          matchId
        )

      const response =
        await stub.fetch(
          new Request(
            'https://conquistador.internal/state',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json'
              },
              body:
                JSON.stringify({
                  playerId
                })
            }
          )
        )

      const headers =
        new Headers(
          response.headers
        )

      Object.entries(
        corsHeaders
      ).forEach(
        ([name, value]) => {
          headers.set(
            name,
            value
          )
        }
      )

      return new Response(
        response.body,
        {
          status:
            response.status,
          statusText:
            response.statusText,
          headers
        }
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir a sessão da partida.'

      return json(
        {
          success: false,
          message
        },
        message.includes('JSON') ||
        message.includes('válid')
          ? 400
          : 500,
        corsHeaders
      )
    }
  }

export class ConquistadorGameSessionDurableObject {
  private readonly state:
    DurableObjectStateLike

  private session:
    StoredSession | null = null

  private operation:
    Promise<void>

  constructor(
    state: DurableObjectStateLike,
    _env: ConquistadorGameSessionEnv
  ) {
    this.state = state

    this.operation =
      this.state.blockConcurrencyWhile(
        async () => {
          this.session =
            (
              await this.state.storage.get<StoredSession>(
                STORAGE_KEY
              )
            ) ||
            null
        }
      )
  }

  fetch(
    request: Request
  ): Promise<Response> {
    const response =
      this.operation.then(
        () =>
          this.handleRequest(
            request
          )
      )

    this.operation =
      response.then(
        () => undefined,
        () => undefined
      )

    return response
  }

  private async save() {
    if (!this.session) {
      return
    }

    await this.state.storage.put(
      STORAGE_KEY,
      this.session
    )
  }

  private async handleBootstrap(
    request: Request
  ) {
    const body =
      await getBody(request)

    const matchId =
      normalizeId(body.matchId)

    const participants =
      normalizeParticipants(
        body.participants
      )

    if (
      !matchId ||
      participants.length !==
        MATCH_SIZE
    ) {
      return json(
        {
          success: false,
          message:
            'Não foi possível criar a composição da partida.'
        },
        400
      )
    }

    if (this.session) {
      if (
        this.session.matchId !==
        matchId
      ) {
        return json(
          {
            success: false,
            message:
              'Esta sessão já pertence a outra partida.'
          },
          409
        )
      }

      return json({
        success: true,
        status: 'ready',
        matchId:
          this.session.matchId,
        revision:
          this.session.revision
      })
    }

    const now =
      Date.now()

    const players =
      participants.map(
        (participant) => ({
          id:
            participant.id,
          name:
            participant.name
        })
      )

    const game =
      new Game({
        id:
          `online-${matchId}`,
        seed:
          `ONLINE-${matchId}`,
        players
      })

    this.session = {
      matchId,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      participants,
      game:
        game.toJSON()
    }

    await this.save()

    return json({
      success: true,
      status: 'ready',
      matchId,
      revision: 1
    })
  }

  private async handleState(
    request: Request
  ) {
    if (!this.session) {
      return json(
        {
          success: false,
          message:
            'A sessão desta partida ainda não foi criada.'
        },
        404
      )
    }

    const body =
      await getBody(request)

    const playerId =
      normalizeId(body.playerId)

    const participant =
      this.session.participants.find(
        (candidate) =>
          candidate.id ===
          playerId
      )

    if (
      !participant ||
      participant.kind !== 'human'
    ) {
      return json(
        {
          success: false,
          message:
            'Este jogador não pertence à sessão online.'
        },
        403
      )
    }

    return json({
      success: true,
      status: 'ready',
      ...createClientView(
        this.session,
        playerId
      )
    })
  }

  private async handleRequest(
    request: Request
  ) {
    const url =
      new URL(request.url)

    try {
      if (
        request.method !== 'POST'
      ) {
        return json(
          {
            success: false,
            message:
              'Método não permitido.'
          },
          405
        )
      }

      switch (url.pathname) {
        case '/bootstrap':
          return this.handleBootstrap(
            request
          )

        case '/state':
          return this.handleState(
            request
          )

        default:
          return json(
            {
              success: false,
              message:
                'Endpoint não encontrado.'
            },
            404
          )
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível processar a sessão da partida.'

      return json(
        {
          success: false,
          message
        },
        message.includes('JSON') ||
        message.includes('válid')
          ? 400
          : 500
      )
    }
  }
}
