import { Game } from '../public/jogos/conquistador/src/game/Game.js'

import {
  chooseConquistadorBotCommand,
  getConquistadorBotActorId
} from './conquistadorBotEngine'

const API_PREFIX = '/api/conquistador/game'
const STORAGE_KEY = 'conquistador-game-session-v1'
const MATCH_SIZE = 4
const MAX_NAME_LENGTH = 24

const RESOURCE_IDS = [
  'stone',
  'cork',
  'wheat',
  'cod',
  'iron'
] as const

type PlayerKind =
  | 'human'
  | 'bot'

type MatchParticipant = {
  id: string
  name: string
  kind: PlayerKind
  icon: string | null
}

type BotRuntimeState = {
  actorId: string | null
  nextActionAt: number
}

type StoredSession = {
  matchId: string
  createdAt: number
  updatedAt: number
  revision: number
  participants: MatchParticipant[]
  game: Record<string, unknown>
  bot?: BotRuntimeState
}

type CommandType =
  | 'placeInitialVillage'
  | 'placeInitialRoad'
  | 'placeInitialSeaRoute'
  | 'rollDice'
  | 'buildRoad'
  | 'buildSeaRoute'
  | 'buildVillage'
  | 'buildCity'
  | 'discardForSeven'
  | 'chooseSevenThreat'
  | 'placeSevenThreat'
  | 'resolveSevenVictim'
  | 'skipSevenTheft'
  | 'endTurn'

type GameCommand = {
  type: CommandType
  payload: Record<string, unknown>
}

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
  storage:
    DurableObjectStorageLike

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
          'nosniff',

        ...headers
      }
    }
  )

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

  const referer =
    normalizeOrigin(
      request.headers.get(
        'Referer'
      ) || ''
    )

  const candidate =
    origin ||
    referer

  if (!candidate) {
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
        candidate
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
    candidate
  )
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
      .includes(
        'application/json'
      )
  ) {
    throw new Error(
      'O pedido deve usar JSON.'
    )
  }

  const body =
    await request.json()

  if (
    !body ||
    typeof body !==
      'object' ||
    Array.isArray(
      body
    )
  ) {
    throw new Error(
      'O pedido enviado não é válido.'
    )
  }

  return body as
    Record<
      string,
      unknown
    >
}

const normalizeId = (
  value: unknown
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
          96
        )
    : ''

const normalizeName = (
  value: unknown
) =>
  typeof value ===
  'string'
    ? value
        .replace(
          /[\u0000-\u001F\u007F]/g,
          ''
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .slice(
          0,
          MAX_NAME_LENGTH
        )
    : ''

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

const normalizeParticipants = (
  value: unknown
):
  MatchParticipant[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const participants =
    value
      .map(
        (
          item
        ) => {
          if (
            !item ||
            typeof item !==
              'object' ||
            Array.isArray(
              item
            )
          ) {
            return null
          }

          const source =
            item as
              Record<
                string,
                unknown
              >

          const id =
            normalizeId(
              source.id
            )

          const name =
            normalizeName(
              source.name
            )

          const kind =
            source.kind ===
            'bot'
              ? 'bot'
              : source.kind ===
                  'human'
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
              kind ===
              'bot'
                ? '⚙'
                : null
          } as MatchParticipant
        }
      )
      .filter(
        (
          participant
        ):
          participant is MatchParticipant =>
            Boolean(
              participant
            )
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
        (
          participant
        ) =>
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

const normalizePayload = (
  value: unknown
):
  Record<
    string,
    unknown
  > =>
  value &&
  typeof value ===
    'object' &&
  !Array.isArray(
    value
  )
    ? value as
        Record<
          string,
          unknown
        >
    : {}

const COMMAND_TYPES =
  new Set<
    CommandType
  >([
    'placeInitialVillage',
    'placeInitialRoad',
    'placeInitialSeaRoute',
    'rollDice',
    'buildRoad',
    'buildSeaRoute',
    'buildVillage',
    'buildCity',
    'discardForSeven',
    'chooseSevenThreat',
    'placeSevenThreat',
    'resolveSevenVictim',
    'skipSevenTheft',
    'endTurn'
  ])

const normalizeCommand = (
  value: unknown
):
  GameCommand |
  null => {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null
  }

  const source =
    value as
      Record<
        string,
        unknown
      >

  const type =
    typeof source.type ===
    'string'
      ? source.type as
          CommandType
      : null

  if (
    !type ||
    !COMMAND_TYPES.has(
      type
    )
  ) {
    return null
  }

  return {
    type,

    payload:
      normalizePayload(
        source.payload
      )
  }
}

const getSessionObject = (
  env:
    ConquistadorGameSessionEnv,

  matchId:
    string
) => {
  const id =
    env.CONQUISTADOR_GAME
      .idFromName(
        matchId
      )

  return env
    .CONQUISTADOR_GAME
    .get(
      id
    )
}

const clone = <T>(
  value: T
): T =>
  JSON.parse(
    JSON.stringify(
      value
    )
  ) as T

const getResourceTotal = (
  resources: unknown
) => {
  if (
    !resources ||
    typeof resources !==
      'object' ||
    Array.isArray(
      resources
    )
  ) {
    return 0
  }

  return Object.values(
    resources as
      Record<
        string,
        unknown
      >
  ).reduce<number>(
    (
      total,
      value
    ) =>
      total +
      Math.max(
        0,
        Number(
          value
        ) || 0
      ),
    0
  )
}

const redactHistory = (
  history: unknown,
  viewerId: string
) => {
  if (
    !Array.isArray(
      history
    )
  ) {
    return []
  }

  return history.map(
    (
      rawEntry
    ) => {
      if (
        !rawEntry ||
        typeof rawEntry !==
          'object' ||
        Array.isArray(
          rawEntry
        )
      ) {
        return rawEntry
      }

      const entry =
        clone(
          rawEntry as
            Record<
              string,
              unknown
            >
        )

      const details =
        entry.details &&
        typeof entry.details ===
          'object' &&
        !Array.isArray(
          entry.details
        )
          ? entry.details as
              Record<
                string,
                unknown
              >
          : null

      if (!details) {
        return entry
      }

      if (
        entry.type ===
          'seven-discard' &&
        entry.playerId !==
          viewerId
      ) {
        delete details
          .resources
      }

      if (
        entry.type ===
        'seven-steal'
      ) {
        const victimId =
          String(
            details.victimId ||
            ''
          )

        const actorId =
          String(
            entry.playerId ||
            ''
          )

        if (
          viewerId !==
            victimId &&
          viewerId !==
            actorId
        ) {
          delete details
            .resourceId
        }
      }

      return entry
    }
  )
}

const getViewerActions = (
  game: any,
  viewerId: string
) => {
  const isCurrentPlayer =
    game?.currentPlayer
      ?.id ===
    viewerId

  const actions:
    Record<
      string,
      unknown
    > = {
      isCurrentPlayer,

      canRollDice:
        false,

      canEndTurn:
        false,

      initialVillageIds:
        [],

      initialRoadIds:
        [],

      initialSeaRouteIds:
        [],

      villageIds:
        [],

      roadIds:
        [],

      seaRouteIds:
        [],

      cityIds:
        [],

      seven:
        null
    }

  if (
    isCurrentPlayer &&
    game?.phase ===
      'setup-village'
  ) {
    actions
      .initialVillageIds =
      game
        .getValidInitialVillageIds()
  }

  if (
    isCurrentPlayer &&
    game?.phase ===
      'setup-road'
  ) {
    actions
      .initialRoadIds =
      game
        .getValidInitialRoadIds()

    actions
      .initialSeaRouteIds =
      game
        .getValidInitialSeaRouteIds()
  }

  if (
    isCurrentPlayer &&
    game?.phase ===
      'turn-roll'
  ) {
    actions.canRollDice =
      true
  }

  if (
    isCurrentPlayer &&
    game?.phase ===
      'turn-actions'
  ) {
    actions.canEndTurn =
      true

    actions.villageIds =
      game
        .getValidVillageIds()

    actions.roadIds =
      game
        .getValidRoadIds()

    actions.seaRouteIds =
      game
        .getValidSeaRouteIds()

    actions.cityIds =
      game
        .getValidCityIds()
  }

  if (
    game?.phase ===
    'event-seven'
  ) {
    const step =
      game?.sevenEvent
        ?.step ||
      null

    const discardPlayer =
      game
        .getCurrentSevenDiscardPlayer
        ?.()

    if (
      step ===
        'discard' &&
      discardPlayer
        ?.id ===
        viewerId
    ) {
      actions.seven = {
        step,

        required:
          game
            .getCurrentSevenDiscardEntry
            ?.()
            ?.required ||
          0
      }
    } else if (
      isCurrentPlayer &&
      step ===
        'choose-threat'
    ) {
      actions.seven = {
        step,

        threatTypes: [
          'contrabandist',
          'storm'
        ]
      }
    } else if (
      isCurrentPlayer &&
      step ===
        'choose-target'
    ) {
      actions.seven = {
        step,

        territoryIds:
          game
            .getSevenValidTerritoryIds(),

        edgeIds:
          game
            .getSevenValidEdgeIds()
      }
    } else if (
      isCurrentPlayer &&
      step ===
        'choose-victim'
    ) {
      actions.seven = {
        step,

        victimIds:
          game
            .getSevenEligibleVictimIds(),

        canSkip:
          game
            ?.sevenEvent
            ?.selectedThreat ===
          'storm'
      }
    }
  }

  return actions
}

const createClientView = (
  session:
    StoredSession,

  viewerId:
    string
) => {
  const gameData =
    session.game as
      Record<
        string,
        any
      >

  const game =
    Game.fromJSON(
      gameData
    )

  const participantsById =
    new Map(
      session.participants
        .map(
          (
            participant
          ) => [
            participant.id,
            participant
          ]
        )
    )

  const players =
    (
      Array.isArray(
        gameData.players
      )
        ? gameData.players
        : []
    )
      .map(
        (
          rawPlayer:
            Record<
              string,
              any
            >
        ) => {
          const id =
            String(
              rawPlayer
                ?.id ||
              ''
            )

          const participant =
            participantsById
              .get(
                id
              )

          const resources =
            rawPlayer
              ?.resources &&
            typeof rawPlayer
              .resources ===
              'object'
              ? rawPlayer
                  .resources
              : {}

          const isSelf =
            id ===
            viewerId

          return {
            id,

            name:
              String(
                rawPlayer
                  ?.name ||
                ''
              ),

            houseId:
              rawPlayer
                ?.houseId ??
              null,

            color:
              rawPlayer
                ?.color ??
              null,

            symbol:
              rawPlayer
                ?.symbol ??
              null,

            prestige:
              Number(
                rawPlayer
                  ?.prestige
              ) || 0,

            pieces:
              rawPlayer
                ?.pieces ??
              {},

            usedGuardCaptains:
              Number(
                rawPlayer
                  ?.usedGuardCaptains
              ) || 0,

            contractPrestige:
              Number(
                rawPlayer
                  ?.contractPrestige
              ) || 0,

            hasLargestNetwork:
              Boolean(
                rawPlayer
                  ?.hasLargestNetwork
              ),

            hasLargestMilitary:
              Boolean(
                rawPlayer
                  ?.hasLargestMilitary
              ),

            kind:
              participant
                ?.kind ||
              'human',

            icon:
              participant
                ?.icon ||
              null,

            totalResources:
              getResourceTotal(
                resources
              ),

            resources:
              isSelf
                ? resources
                : null,

            isSelf
          }
        }
      )

  const currentPlayerIndex =
    Number(
      gameData
        .currentPlayerIndex
    ) || 0

  const currentPlayer =
    players[
      currentPlayerIndex
    ] ||
    null

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

    actions:
      getViewerActions(
        game,
        viewerId
      ),

    game: {
      id:
        gameData.id ??
        null,

      seed:
        gameData.seed ??
        null,

      phase:
        gameData.phase ??
        null,

      turnNumber:
        Number(
          gameData
            .turnNumber
        ) || 1,

      currentPlayerIndex,

      currentPlayerId:
        currentPlayer
          ?.id ||
        null,

      board:
        gameData.board ??
        null,

      bank:
        gameData.bank ??
        null,

      lastRoll:
        gameData.lastRoll ??
        null,

      history:
        redactHistory(
          gameData.history,
          viewerId
        ),

      winnerId:
        gameData.winnerId ??
        null,

      sevenEvent:
        gameData.sevenEvent ??
        null,

      threat:
        gameData.threat ??
        null,

      players
    }
  }
}

const normalizeResourceSelection = (
  value: unknown
) => {
  if (
    !value ||
    typeof value !==
      'object' ||
    Array.isArray(
      value
    )
  ) {
    return null
  }

  const source =
    value as
      Record<
        string,
        unknown
      >

  const selection:
    Record<
      string,
      number
    > = {}

  for (
    const resourceId
    of RESOURCE_IDS
  ) {
    const quantity =
      Number(
        source[
          resourceId
        ] || 0
      )

    if (
      !Number.isInteger(
        quantity
      ) ||
      quantity < 0
    ) {
      return null
    }

    if (
      quantity > 0
    ) {
      selection[
        resourceId
      ] = quantity
    }
  }

  return selection
}

const requireId = (
  value: unknown,
  message: string
) => {
  const id =
    normalizeId(
      value
    )

  if (!id) {
    throw new Error(
      message
    )
  }

  return id
}

const ensureCommandOwner = (
  game: any,
  playerId: string,
  commandType:
    CommandType
) => {
  if (
    commandType ===
    'discardForSeven'
  ) {
    return game
      .getCurrentSevenDiscardPlayer
      ?.()
      ?.id ===
      playerId
      ? {
          valid:
            true,

          reason:
            null
        }
      : {
          valid:
            false,

          reason:
            'O descarte pertence a outro jogador.'
        }
  }

  return game
    ?.currentPlayer
    ?.id ===
    playerId
    ? {
        valid:
          true,

        reason:
          null
      }
    : {
        valid:
          false,

        reason:
          'Não é a sua vez de jogar.'
      }
}

const executeCommand = (
  game: any,
  playerId: string,
  command:
    GameCommand
) => {
  const ownership =
    ensureCommandOwner(
      game,
      playerId,
      command.type
    )

  if (
    !ownership.valid
  ) {
    return {
      success:
        false,

      reason:
        ownership.reason
    }
  }

  const payload =
    command.payload

  switch (
    command.type
  ) {
    case 'placeInitialVillage':
      return game
        .placeInitialVillage(
          requireId(
            payload.vertexId,
            'O local da Vila não é válido.'
          )
        )

    case 'placeInitialRoad':
      return game
        .placeInitialRoad(
          requireId(
            payload.edgeId,
            'O Caminho inicial não é válido.'
          )
        )

    case 'placeInitialSeaRoute':
      return game
        .placeInitialSeaRoute(
          requireId(
            payload.edgeId,
            'A Rota Marítima inicial não é válida.'
          )
        )

    case 'rollDice':
      return game
        .rollDice()

    case 'buildRoad':
      return game
        .buildRoad(
          requireId(
            payload.edgeId,
            'O Caminho Real não é válido.'
          )
        )

    case 'buildSeaRoute':
      return game
        .buildSeaRoute(
          requireId(
            payload.edgeId,
            'A Rota Marítima não é válida.'
          )
        )

    case 'buildVillage':
      return game
        .buildVillage(
          requireId(
            payload.vertexId,
            'O local da Vila não é válido.'
          )
        )

    case 'buildCity':
      return game
        .buildCity(
          requireId(
            payload.vertexId,
            'O local da Cidade Muralhada não é válido.'
          )
        )

    case 'discardForSeven': {
      const selection =
        normalizeResourceSelection(
          payload.selection
        )

      return selection
        ? game
            .discardForSeven(
              selection
            )
        : {
            success:
              false,

            reason:
              'A seleção de recursos para descarte não é válida.'
          }
    }

    case 'chooseSevenThreat':
      return game
        .chooseSevenThreat(
          String(
            payload
              .threatType ||
            ''
          )
        )

    case 'placeSevenThreat':
      return game
        .placeSevenThreat(
          String(
            payload
              .targetType ||
            ''
          ),

          requireId(
            payload.targetId,
            'O destino da ameaça não é válido.'
          )
        )

    case 'resolveSevenVictim':
      return game
        .resolveSevenVictim(
          requireId(
            payload.victimId,
            'O jogador escolhido não é válido.'
          )
        )

    case 'skipSevenTheft':
      return game
        .skipSevenTheft()

    case 'endTurn':
      return game
        .endTurn()
  }
}

export const isConquistadorGameSessionApiPath = (
  pathname: string
) =>
  pathname ===
    API_PREFIX ||
  pathname.startsWith(
    `${API_PREFIX}/`
  )

export const ensureConquistadorGameSession =
  async (
    env:
      ConquistadorGameSessionEnv,

    matchIdValue:
      unknown,

    participantsValue:
      unknown
  ) => {
    const matchId =
      normalizeId(
        matchIdValue
      )

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
            method:
              'POST',

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

    if (
      !response.ok
    ) {
      let message =
        'Não foi possível preparar a sessão da partida.'

      try {
        const body =
          await response
            .json() as {
              message?: string
            }

        if (
          body
            ?.message
        ) {
          message =
            body.message
        }
      } catch {}

      throw new Error(
        message
      )
    }
  }

export const handleConquistadorGameSessionApiRequest =
  async (
    request:
      Request,

    env:
      ConquistadorGameSessionEnv
  ) => {
    const origin =
      normalizeOrigin(
        request.headers.get(
          'Origin'
        ) || ''
      )

    const corsHeaders:
      Record<
        string,
        string
      > = {}

    if (
      origin &&
      isAllowedOrigin(
        request
      )
    ) {
      corsHeaders[
        'Access-Control-Allow-Origin'
      ] =
        origin

      corsHeaders.Vary =
        'Origin'
    }

    if (
      request.method ===
      'OPTIONS'
    ) {
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

      return new Response(
        null,
        {
          status:
            204,

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
      request.method !==
      'POST'
    ) {
      return json(
        {
          success:
            false,

          message:
            'Método não permitido.'
        },

        405,

        {
          ...corsHeaders,

          Allow:
            'POST, OPTIONS'
        }
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

        403,

        corsHeaders
      )
    }

    try {
      const body =
        await getBody(
          request
        )

      const matchId =
        normalizeId(
          body.matchId
        )

      const playerId =
        normalizeId(
          body.playerId
        )

      const action =
        body.action ===
        'command'
          ? 'command'
          : 'state'

      if (
        !matchId ||
        !playerId
      ) {
        return json(
          {
            success:
              false,

            message:
              'A sessão ou o jogador não são válidos.'
          },

          400,

          corsHeaders
        )
      }

      const response =
        await getSessionObject(
          env,
          matchId
        ).fetch(
          new Request(
            `https://conquistador.internal/${action}`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  ...body,
                  matchId,
                  playerId
                })
            }
          )
        )

      const headers =
        new Headers(
          response.headers
        )

      for (
        const [
          name,
          value
        ]
        of Object.entries(
          corsHeaders
        )
      ) {
        headers.set(
          name,
          value
        )
      }

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
    } catch (
      error
    ) {
      const message =
        error instanceof
        Error
          ? error.message
          : 'Não foi possível abrir a sessão da partida.'

      return json(
        {
          success:
            false,

          message
        },

        (
          message.includes(
            'JSON'
          ) ||
          message.includes(
            'válid'
          )
        )
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
    StoredSession |
    null = null

  private operation:
    Promise<void>

  constructor(
    state:
      DurableObjectStateLike,

    _env:
      ConquistadorGameSessionEnv
  ) {
    this.state =
      state

    this.operation =
      this.state
        .blockConcurrencyWhile(
          async () => {
            this.session =
              (
                await this
                  .state
                  .storage
                  .get<StoredSession>(
                    STORAGE_KEY
                  )
              ) ||
              null
          }
        )
  }

  fetch(
    request:
      Request
  ):
    Promise<Response> {
    const response =
      this.operation
        .then(
          () =>
            this.handleRequest(
              request
            )
        )

    this.operation =
      response.then(
        () =>
          undefined,

        () =>
          undefined
      )

    return response
  }

  private async save() {
    if (
      this.session
    ) {
      await this
        .state
        .storage
        .put(
          STORAGE_KEY,
          this.session
        )
    }
  }

  private getHumanParticipant(
    playerId:
      string
  ) {
    return (
      this.session
        ?.participants
        .find(
          (
            participant
          ) =>
            participant.id ===
              playerId &&
            participant.kind ===
              'human'
        ) ||
      null
    )
  }

  private getBotDelay(
    revision:
      number
  ) {
    return (
      850 +
      (
        revision %
        4
      ) *
        110
    )
  }

  private async scheduleBot(
    game:
      any,

    now =
      Date.now()
  ) {
    if (
      !this.session
    ) {
      return false
    }

    const actorId =
      getConquistadorBotActorId(
        game,
        this.session
          .participants
      )

    if (
      !actorId
    ) {
      if (
        this.session
          .bot
          ?.actorId ||
        this.session
          .bot
          ?.nextActionAt
      ) {
        this.session.bot = {
          actorId:
            null,

          nextActionAt:
            0
        }

        await this.save()
      }

      return false
    }

    if (
      this.session
        .bot
        ?.actorId !==
        actorId ||
      !this.session
        .bot
        ?.nextActionAt
    ) {
      this.session.bot = {
        actorId,

        nextActionAt:
          now +
          this.getBotDelay(
            this.session
              .revision
          )
      }

      await this.save()
    }

    return true
  }

  private async advanceBotIfDue() {
    if (
      !this.session
    ) {
      return false
    }

    const game =
      Game.fromJSON(
        this.session.game
      )

    if (
      !await this
        .scheduleBot(
          game
        )
    ) {
      return false
    }

    const runtime =
      this.session.bot

    if (
      !runtime
        ?.actorId ||
      Date.now() <
        runtime
          .nextActionAt
    ) {
      return false
    }

    const command =
      chooseConquistadorBotCommand(
        game,
        this.session
          .participants,
        runtime.actorId
      ) as
        GameCommand |
        null

    if (
      !command
    ) {
      this.session.bot = {
        actorId:
          null,

        nextActionAt:
          0
      }

      await this.save()

      return false
    }

    let result:
      Record<
        string,
        unknown
      >

    try {
      result =
        executeCommand(
          game,
          runtime.actorId,
          command
        ) as
          Record<
            string,
            unknown
          >
    } catch {
      result = {
        success:
          false
      }
    }

    if (
      !result ||
      result.success !==
        true
    ) {
      this.session.bot = {
        actorId:
          null,

        nextActionAt:
          0
      }

      await this.save()

      return false
    }

    this.session.game =
      game.toJSON()

    this.session.revision +=
      1

    this.session.updatedAt =
      Date.now()

    this.session.bot = {
      actorId:
        null,

      nextActionAt:
        0
    }

    await this
      .scheduleBot(
        game,
        Date.now()
      )

    await this.save()

    return true
  }

  private async handleBootstrap(
    request:
      Request
  ) {
    const body =
      await getBody(
        request
      )

    const matchId =
      normalizeId(
        body.matchId
      )

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
          success:
            false,

          message:
            'Não foi possível criar a composição da partida.'
        },

        400
      )
    }

    if (
      this.session
    ) {
      if (
        this.session
          .matchId !==
        matchId
      ) {
        return json(
          {
            success:
              false,

            message:
              'Esta sessão já pertence a outra partida.'
          },

          409
        )
      }

      return json({
        success:
          true,

        status:
          'ready',

        matchId:
          this.session
            .matchId,

        revision:
          this.session
            .revision
      })
    }

    const now =
      Date.now()

    const game =
      new Game({
        id:
          `online-${matchId}`,

        seed:
          `ONLINE-${matchId}`,

        players:
          participants
            .map(
              (
                participant
              ) => ({
                id:
                  participant.id,

                name:
                  participant.name
              })
            )
      })

    this.session = {
      matchId,

      createdAt:
        now,

      updatedAt:
        now,

      revision:
        1,

      participants,

      game:
        game.toJSON(),

      bot: {
        actorId:
          null,

        nextActionAt:
          0
      }
    }

    await this
      .scheduleBot(
        game,
        now
      )

    await this.save()

    return json({
      success:
        true,

      status:
        'ready',

      matchId,

      revision:
        1
    })
  }

  private async handleState(
    request:
      Request
  ) {
    if (
      !this.session
    ) {
      return json(
        {
          success:
            false,

          message:
            'A sessão desta partida ainda não foi criada.'
        },

        404
      )
    }

    const body =
      await getBody(
        request
      )

    const playerId =
      normalizeId(
        body.playerId
      )

    if (
      !this
        .getHumanParticipant(
          playerId
        )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este jogador não pertence à sessão online.'
        },

        403
      )
    }

    await this
      .advanceBotIfDue()

    const knownRevision =
      normalizeRevision(
        body.knownRevision
      )

    if (
      knownRevision !==
        null &&
      knownRevision ===
        this.session
          .revision
    ) {
      return json({
        success:
          true,

        status:
          'not-modified',

        matchId:
          this.session
            .matchId,

        revision:
          this.session
            .revision
      })
    }

    return json({
      success:
        true,

      status:
        'ready',

      ...createClientView(
        this.session,
        playerId
      )
    })
  }

  private async handleCommand(
    request:
      Request
  ) {
    if (
      !this.session
    ) {
      return json(
        {
          success:
            false,

          message:
            'A sessão desta partida ainda não foi criada.'
        },

        404
      )
    }

    const body =
      await getBody(
        request
      )

    const playerId =
      normalizeId(
        body.playerId
      )

    if (
      !this
        .getHumanParticipant(
          playerId
        )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Este jogador não pertence à sessão online.'
        },

        403
      )
    }

    const expectedRevision =
      normalizeRevision(
        body.revision
      )

    if (
      expectedRevision !==
        null &&
      expectedRevision !==
        this.session
          .revision
    ) {
      return json(
        {
          success:
            false,

          status:
            'revision-conflict',

          message:
            'A partida foi atualizada noutro dispositivo. O estado foi sincronizado.',

          ...createClientView(
            this.session,
            playerId
          )
        },

        409
      )
    }

    const command =
      normalizeCommand(
        body.command
      )

    if (
      !command
    ) {
      return json(
        {
          success:
            false,

          message:
            'A ação enviada não é suportada.'
        },

        400
      )
    }

    const game =
      Game.fromJSON(
        this.session.game
      )

    if (
      !game
        ?.players
        ?.some(
          (
            player:
              any
          ) =>
            player
              ?.id ===
            playerId
        )
    ) {
      return json(
        {
          success:
            false,

          message:
            'O jogador não pertence ao estado atual da partida.'
        },

        403
      )
    }

    let result:
      Record<
        string,
        unknown
      >

    try {
      result =
        executeCommand(
          game,
          playerId,
          command
        ) as
          Record<
            string,
            unknown
          >
    } catch (
      error
    ) {
      return json(
        {
          success:
            false,

          message:
            error instanceof
            Error
              ? error.message
              : 'Não foi possível executar a ação.'
        },

        400
      )
    }

    if (
      !result ||
      result.success !==
        true
    ) {
      return json(
        {
          success:
            false,

          message:
            String(
              result
                ?.reason ||
              'A ação não é válida neste momento.'
            )
        },

        409
      )
    }

    this.session.game =
      game.toJSON()

    this.session.revision +=
      1

    this.session.updatedAt =
      Date.now()

    this.session.bot = {
      actorId:
        null,

      nextActionAt:
        0
    }

    await this
      .scheduleBot(
        game,
        Date.now()
      )

    await this.save()

    return json({
      success:
        true,

      status:
        'ready',

      command:
        command.type,

      ...createClientView(
        this.session,
        playerId
      )
    })
  }

  private async handleRequest(
    request:
      Request
  ) {
    const url =
      new URL(
        request.url
      )

    try {
      if (
        request.method !==
        'POST'
      ) {
        return json(
          {
            success:
              false,

            message:
              'Método não permitido.'
          },

          405
        )
      }

      switch (
        url.pathname
      ) {
        case '/bootstrap':
          return this
            .handleBootstrap(
              request
            )

        case '/state':
          return this
            .handleState(
              request
            )

        case '/command':
          return this
            .handleCommand(
              request
            )

        default:
          return json(
            {
              success:
                false,

              message:
                'Endpoint não encontrado.'
            },

            404
          )
      }
    } catch (
      error
    ) {
      const message =
        error instanceof
        Error
          ? error.message
          : 'Não foi possível processar a sessão da partida.'

      return json(
        {
          success:
            false,

          message
        },

        (
          message.includes(
            'JSON'
          ) ||
          message.includes(
            'válid'
          )
        )
          ? 400
          : 500
      )
    }
  }
}
