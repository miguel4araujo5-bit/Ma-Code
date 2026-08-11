import { Game } from '../public/jogos/conquistador/src/game/Game.js'

import {
  chooseConquistadorBotCommand,
  getConquistadorBotActorId
} from './conquistadorBotEngine'

const API_PREFIX = '/api/conquistador/game'
const STORAGE_KEY = 'conquistador-game-session-v1'
const MATCH_SIZE = 4
const MAX_NAME_LENGTH = 24
const BOT_RETRY_DELAY_MS = 1600
const PRESENCE_TIMEOUT_MS = 30_000
const PRESENCE_WARNING_MS = 15_000
const BOT_ICON = '⚙'

const BOT_NAMES = [
  'Duarte',
  'Leonor',
  'Martim',
  'Beatriz',
  'Afonso',
  'Inês',
  'Gonçalo',
  'Catarina',
  'Tomé',
  'Madalena',
  'Diogo',
  'Constança',
  'Vasco',
  'Joana',
  'Lourenço',
  'Matilde',
  'Rodrigo',
  'Teresa',
  'Salvador',
  'Mariana'
] as const

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

type HumanPresenceState = {
  tokenHash: string
  lastSeenAt: number
  takeoverAt: number
  automated: boolean
  abandonedAt?: number
}

type SessionCredential = {
  playerId: string
  reconnectToken: string
}

type StoredSession = {
  matchId: string
  createdAt: number
  updatedAt: number
  revision: number
  participants: MatchParticipant[]
  game: Record<string, unknown>
  presence?: Record<string, HumanPresenceState>
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

  getAlarm(): Promise<number | null>

  setAlarm(
    scheduledTime: number | Date
  ): Promise<void>

  deleteAlarm(): Promise<void>
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

const normalizeReconnectToken = (
  value: unknown
) =>
  typeof value ===
  'string' &&
  value.length >= 32 &&
  value.length <= 256 &&
  /^[A-Za-z0-9_-]+$/.test(
    value
  )
    ? value
    : ''

const hashReconnectToken = async (
  value: string
) => {
  const data =
    new TextEncoder()
      .encode(
        value
      )

  const digest =
    await globalThis
      .crypto
      .subtle
      .digest(
        'SHA-256',
        data
      )

  return Array.from(
    new Uint8Array(
      digest
    ),
    (byte) =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')
}

const constantTimeEqual = (
  first: string,
  second: string
) => {
  if (
    first.length !==
    second.length
  ) {
    return false
  }

  let difference = 0

  for (
    let index = 0;
    index <
      first.length;
    index += 1
  ) {
    difference |=
      first.charCodeAt(
        index
      ) ^
      second.charCodeAt(
        index
      )
  }

  return difference === 0
}

const normalizeSessionCredentials = (
  value: unknown
): SessionCredential[] => {
  if (
    !Array.isArray(
      value
    )
  ) {
    return []
  }

  const credentials =
    value
      .map(
        (item) => {
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
            item as Record<
              string,
              unknown
            >

          const playerId =
            normalizeId(
              source.playerId
            )

          const reconnectToken =
            normalizeReconnectToken(
              source.reconnectToken
            )

          if (
            !playerId ||
            !reconnectToken
          ) {
            return null
          }

          return {
            playerId,
            reconnectToken
          }
        }
      )
      .filter(
        (credential):
          credential is SessionCredential =>
            Boolean(
              credential
            )
      )

  const uniqueIds =
    new Set(
      credentials.map(
        (credential) =>
          credential.playerId
      )
    )

  return uniqueIds.size ===
    credentials.length
      ? credentials
      : []
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

  return uniqueIds.size ===
    MATCH_SIZE
    ? participants
    : []
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

const getEffectiveParticipants = (
  session: StoredSession
): MatchParticipant[] =>
  session.participants.map(
    (participant) => {
      if (
        participant.kind !==
        'human'
      ) {
        return participant
      }

      const presence =
        session.presence?.[
          participant.id
        ]

      if (
        !presence?.automated
      ) {
        return participant
      }

      return {
        ...participant,
        kind: 'bot',
        icon: BOT_ICON
      }
    }
  )

const getPresenceWarnings = (
  session: StoredSession,
  now = Date.now()
) => {
  if (!session.presence) {
    return []
  }

  return session.participants
    .filter(
      (participant) => {
        if (participant.kind !== 'human') {
          return false
        }

        const presence =
          session.presence?.[participant.id]

        if (
          !presence ||
          presence.automated ||
          Number(presence.abandonedAt) > 0 ||
          !Number.isFinite(presence.takeoverAt) ||
          presence.takeoverAt <= 0
        ) {
          return false
        }

        const warningAt =
          presence.takeoverAt -
          PRESENCE_WARNING_MS

        return (
          now >= warningAt &&
          now < presence.takeoverAt
        )
      }
    )
    .map(
      (participant) => {
        const presence =
          session.presence![participant.id]

        return {
          playerId: participant.id,
          playerName: participant.name,
          expiresAt: presence.takeoverAt,
          secondsRemaining:
            Math.max(
              0,
              Math.ceil(
                (presence.takeoverAt - now) /
                1000
              )
            )
        }
      }
    )
    .sort(
      (first, second) =>
        first.expiresAt -
        second.expiresAt
    )
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

  const effectiveParticipants =
    getEffectiveParticipants(
      session
    )

  const participantsById =
    new Map(
      effectiveParticipants
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
      effectiveParticipants,

    presenceWarnings:
      getPresenceWarnings(
        session
      ),

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

const createEmergencyDiscard = (
  player: any,
  required: number
) => {
  const selection:
    Record<
      string,
      number
    > = {}

  let remaining =
    Math.max(
      0,
      Number(
        required
      ) || 0
    )

  for (
    const resourceId
    of RESOURCE_IDS
  ) {
    if (
      remaining <= 0
    ) {
      break
    }

    const available =
      Math.max(
        0,
        Number(
          player
            ?.resources
            ?.[
              resourceId
            ]
        ) || 0
      )

    const quantity =
      Math.min(
        available,
        remaining
      )

    if (
      quantity > 0
    ) {
      selection[
        resourceId
      ] = quantity

      remaining -=
        quantity
    }
  }

  return selection
}

const chooseEmergencyBotCommand = (
  game: any,
  botId: string
):
  GameCommand |
  null => {
  if (
    game?.phase ===
      'event-seven' &&
    game?.sevenEvent
      ?.step ===
      'discard'
  ) {
    const entry =
      game
        .getCurrentSevenDiscardEntry
        ?.()

    const player =
      game.players
        ?.find(
          (
            candidate:
              any
          ) =>
            candidate
              ?.id ===
            botId
        )

    if (
      entry?.playerId ===
        botId &&
      player
    ) {
      return {
        type:
          'discardForSeven',

        payload: {
          selection:
            createEmergencyDiscard(
              player,
              Number(
                entry.required
              ) || 0
            )
        }
      }
    }

    return null
  }

  if (
    game
      ?.currentPlayer
      ?.id !==
    botId
  ) {
    return null
  }

  switch (
    game.phase
  ) {
    case 'setup-village': {
      const vertexId =
        game
          .getValidInitialVillageIds
          ?.()
          ?.[0]

      return vertexId
        ? {
            type:
              'placeInitialVillage',

            payload: {
              vertexId
            }
          }
        : null
    }

    case 'setup-road': {
      const roadId =
        game
          .getValidInitialRoadIds
          ?.()
          ?.[0]

      if (roadId) {
        return {
          type:
            'placeInitialRoad',

          payload: {
            edgeId:
              roadId
          }
        }
      }

      const seaRouteId =
        game
          .getValidInitialSeaRouteIds
          ?.()
          ?.[0]

      return seaRouteId
        ? {
            type:
              'placeInitialSeaRoute',

            payload: {
              edgeId:
                seaRouteId
            }
          }
        : null
    }

    case 'turn-roll':
      return {
        type:
          'rollDice',

        payload: {}
      }

    case 'turn-actions':
      return {
        type:
          'endTurn',

        payload: {}
      }

    case 'event-seven': {
      const step =
        game
          ?.sevenEvent
          ?.step

      if (
        step ===
        'choose-threat'
      ) {
        return {
          type:
            'chooseSevenThreat',

          payload: {
            threatType:
              'contrabandist'
          }
        }
      }

      if (
        step ===
        'choose-target'
      ) {
        const territoryId =
          game
            .getSevenValidTerritoryIds
            ?.()
            ?.[0]

        if (
          territoryId
        ) {
          return {
            type:
              'placeSevenThreat',

            payload: {
              targetType:
                'territory',

              targetId:
                territoryId
            }
          }
        }

        const edgeId =
          game
            .getSevenValidEdgeIds
            ?.()
            ?.[0]

        return edgeId
          ? {
              type:
                'placeSevenThreat',

              payload: {
                targetType:
                  'edge',

                targetId:
                  edgeId
              }
            }
          : null
      }

      if (
        step ===
        'choose-victim'
      ) {
        const victimId =
          game
            .getSevenEligibleVictimIds
            ?.()
            ?.[0]

        if (
          victimId
        ) {
          return {
            type:
              'resolveSevenVictim',

            payload: {
              victimId
            }
          }
        }

        if (
          game
            ?.sevenEvent
            ?.selectedThreat ===
          'storm'
        ) {
          return {
            type:
              'skipSevenTheft',

            payload: {}
          }
        }
      }

      return null
    }

    default:
      return null
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
      unknown,

    credentialsValue?:
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

    const credentialsSupplied =
      Array.isArray(
        credentialsValue
      )

    const credentials =
      credentialsSupplied
        ? normalizeSessionCredentials(
            credentialsValue
          )
        : []

    const humanCount =
      participants.filter(
        (participant) =>
          participant.kind ===
          'human'
      ).length

    if (
      !matchId ||
      participants.length !==
        MATCH_SIZE ||
      (
        credentialsSupplied &&
        credentials.length !==
          humanCount
      )
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
                participants,
                ...(credentialsSupplied
                  ? { credentials }
                  : {})
              })
          }
        )
      )

    if (
      response.ok
    ) {
      return
    }

    let message =
      'Não foi possível preparar a sessão da partida.'

    try {
      const body =
        await response
          .json() as {
            message?:
              string
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

      const reconnectToken =
        normalizeReconnectToken(
          body.reconnectToken
        )

      const action =
        body.action ===
        'command'
          ? 'command'
          : body.action ===
              'leave'
            ? 'leave'
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
                  playerId,
                  ...(reconnectToken
                    ? { reconnectToken }
                    : {})
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

  private enqueue<T>(
    callback:
      () => Promise<T>
  ):
    Promise<T> {
    const result =
      this.operation
        .then(
          callback
        )

    this.operation =
      result.then(
        () =>
          undefined,

        () =>
          undefined
      )

    return result
  }

  fetch(
    request:
      Request
  ):
    Promise<Response> {
    return this.enqueue(
      () =>
        this.handleRequest(
          request
        )
    )
  }

  alarm():
    Promise<void> {
    return this.enqueue(
      () =>
        this.handleAlarm()
    )
  }

  private async save() {
    if (
      !this.session
    ) {
      return
    }

    await this
      .state
      .storage
      .put(
        STORAGE_KEY,
        this.session
      )
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

  private getEffectiveParticipants() {
    return this.session
      ? getEffectiveParticipants(
          this.session
        )
      : []
  }

  private getNextPresenceTakeoverAt() {
    if (
      !this.session
        ?.presence
    ) {
      return 0
    }

    const deadlines =
      Object.values(
        this.session
          .presence
      )
        .filter(
          (presence) =>
            !presence.automated &&
            Number.isFinite(
              presence.takeoverAt
            ) &&
            presence.takeoverAt > 0
        )
        .map(
          (presence) =>
            presence.takeoverAt
        )

    return deadlines.length
      ? Math.min(
          ...deadlines
        )
      : 0
  }

  private chooseReplacementBotName(
    playerId:
      string
  ) {
    if (!this.session) {
      return BOT_NAMES[0]
    }

    const usedNames =
      new Set(
        this.session
          .participants
          .filter(
            (participant) =>
              participant.id !==
              playerId
          )
          .map(
            (participant) =>
              participant.name
                .toLocaleLowerCase(
                  'pt-PT'
                )
          )
      )

    const offset =
      this.session.revision %
      BOT_NAMES.length

    for (
      let index = 0;
      index < BOT_NAMES.length;
      index += 1
    ) {
      const candidate =
        BOT_NAMES[
          (offset + index) %
          BOT_NAMES.length
        ]

      if (
        !usedNames.has(
          candidate.toLocaleLowerCase(
            'pt-PT'
          )
        )
      ) {
        return candidate
      }
    }

    return BOT_NAMES[0]
  }

  private finalizePlayerAbandonment(
    game:
      any,
    playerId:
      string,
    now:
      number
  ) {
    if (!this.session) {
      return false
    }

    const participant =
      this.session
        .participants
        .find(
          (candidate) =>
            candidate.id ===
            playerId
        )

    if (!participant) {
      return false
    }

    const presence =
      this.session
        .presence?.[
          playerId
        ]

    if (
      presence &&
      Number(
        presence.abandonedAt
      ) > 0
    ) {
      return false
    }

    const previousName =
      participant.name

    const replacementName =
      this.chooseReplacementBotName(
        playerId
      )

    if (presence) {
      presence.lastSeenAt =
        Math.min(
          presence.lastSeenAt || now,
          now
        )
      presence.takeoverAt =
        0
      presence.automated =
        true
      presence.abandonedAt =
        now
    } else {
      participant.kind =
        'bot'
      participant.icon =
        BOT_ICON
    }

    participant.name =
      replacementName

    const gamePlayer =
      game?.players
        ?.find(
          (candidate:
            any) =>
            candidate?.id ===
            playerId
        )

    if (gamePlayer) {
      gamePlayer.name =
        replacementName
    }

    game?.addHistory?.(
      'player-abandoned',
      `${previousName} abandonou o jogo.`,
      {
        previousName,
        replacementName
      },
      playerId
    )

    this.session.bot = {
      actorId:
        null,
      nextActionAt:
        0
    }

    return true
  }

  private finalizeExpiredPresences(
    game:
      any,
    now:
      number
  ) {
    if (
      !this.session
        ?.presence
    ) {
      return false
    }

    let changed = false

    for (
      const [
        playerId,
        presence
      ] of Object.entries(
        this.session
          .presence
      )
    ) {
      if (
        Number(
          presence.abandonedAt
        ) > 0
      ) {
        continue
      }

      if (
        presence.automated ||
        (
          presence.takeoverAt > 0 &&
          now >=
            presence.takeoverAt
        )
      ) {
        changed =
          this.finalizePlayerAbandonment(
            game,
            playerId,
            now
          ) ||
          changed
      }
    }

    return changed
  }

  private async buildPresenceState(
    participants:
      MatchParticipant[],

    credentials:
      SessionCredential[],

    now:
      number
  ) {
    const humans =
      participants.filter(
        (participant) =>
          participant.kind ===
          'human'
      )

    if (
      credentials.length !==
      humans.length
    ) {
      throw new Error(
        'As credenciais da partida não correspondem aos jogadores humanos.'
      )
    }

    const credentialsById =
      new Map(
        credentials.map(
          (credential) => [
            credential.playerId,
            credential
          ]
        )
      )

    const presence:
      Record<
        string,
        HumanPresenceState
      > = {}

    for (
      const participant
      of humans
    ) {
      const credential =
        credentialsById.get(
          participant.id
        )

      if (!credential) {
        throw new Error(
          'Falta uma credencial segura para um dos jogadores humanos.'
        )
      }

      presence[
        participant.id
      ] = {
        tokenHash:
          await hashReconnectToken(
            credential
              .reconnectToken
          ),
        lastSeenAt:
          now,
        takeoverAt:
          now +
          PRESENCE_TIMEOUT_MS,
        automated:
          false
      }
    }

    return presence
  }

  private async authenticateHuman(
    body:
      Record<
        string,
        unknown
      >
  ) {
    if (!this.session) {
      return {
        ok: false as const,
        status: 404,
        message:
          'A sessão desta partida ainda não foi criada.'
      }
    }

    const matchId =
      normalizeId(
        body.matchId
      )

    const playerId =
      normalizeId(
        body.playerId
      )

    const reconnectToken =
      normalizeReconnectToken(
        body.reconnectToken
      )

    if (
      !matchId ||
      !playerId
    ) {
      return {
        ok: false as const,
        status: 400,
        message:
          'A sessão ou o jogador não são válidos.'
      }
    }

    if (
      this.session
        .matchId !==
      matchId
    ) {
      return {
        ok: false as const,
        status: 403,
        message:
          'A credencial apresentada não pertence a esta partida.'
      }
    }

    if (
      !this.getHumanParticipant(
        playerId
      )
    ) {
      return {
        ok: false as const,
        status: 403,
        message:
          'Este jogador não pertence à sessão online.'
      }
    }

    if (
      !this.session
        .presence
    ) {
      return {
        ok: true as const,
        playerId,
        now:
          Date.now(),
        reactivated:
          false,
        revisionBefore:
          this.session
            .revision,
        legacy:
          true as const
      }
    }

    const presence =
      this.session
        .presence[
          playerId
        ]

    if (
      !reconnectToken
    ) {
      return {
        ok: false as const,
        status: 400,
        message:
          'A credencial de reconexão é obrigatória nesta partida.'
      }
    }

    if (
      !presence?.tokenHash
    ) {
      return {
        ok: false as const,
        status: 403,
        message:
          'Esta partida não possui uma credencial de reconexão válida para este jogador.'
      }
    }

    if (
      Number(
        presence.abandonedAt
      ) > 0
    ) {
      return {
        ok: false as const,
        status: 410,
        message:
          'Este jogador abandonou esta partida.'
      }
    }

    const receivedHash =
      await hashReconnectToken(
        reconnectToken
      )

    if (
      !constantTimeEqual(
        receivedHash,
        presence.tokenHash
      )
    ) {
      return {
        ok: false as const,
        status: 403,
        message:
          'A credencial de reconexão não é válida.'
      }
    }

    const now =
      Date.now()

    if (
      presence.takeoverAt > 0 &&
      now >=
        presence.takeoverAt
    ) {
      const game =
        Game.fromJSON(
          this.session.game
        )

      if (
        this.finalizePlayerAbandonment(
          game,
          playerId,
          now
        )
      ) {
        this.session.game =
          game.toJSON()
        this.session.revision +=
          1
        this.session.updatedAt =
          now

        await this.save()

        await this
          .scheduleBot(
            game,
            now
          )
      }

      return {
        ok: false as const,
        status: 410,
        message:
          'Este jogador abandonou esta partida.'
      }
    }

    const revisionBefore =
      this.session
        .revision

    const warningWasActive =
      presence.takeoverAt > 0 &&
      now >=
        presence.takeoverAt -
        PRESENCE_WARNING_MS

    const reactivated =
      presence.automated ||
      warningWasActive

    presence.lastSeenAt =
      now

    presence.takeoverAt =
      now +
      PRESENCE_TIMEOUT_MS

    presence.automated =
      false

    if (reactivated) {
      this.session.revision +=
        1

      this.session.updatedAt =
        now
    }

    await this.save()

    return {
      ok: true as const,
      playerId,
      now,
      reactivated,
      revisionBefore,
      legacy:
        false as const
    }
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

  private async setNextAlarm(
    botActionAt = 0,
    now = Date.now()
  ) {
    if (!this.session) {
      return
    }

    const presenceAt =
      this.getNextPresenceTakeoverAt()

    const candidates =
      [
        botActionAt,
        presenceAt
      ].filter(
        (value) =>
          Number.isFinite(
            value
          ) &&
          value > 0
      )

    const desiredAt =
      candidates.length
        ? Math.min(
            ...candidates
          )
        : 0

    const currentAlarm =
      await this
        .state
        .storage
        .getAlarm()

    if (!desiredAt) {
      if (
        currentAlarm !==
        null
      ) {
        await this
          .state
          .storage
          .deleteAlarm()
      }

      return
    }

    if (
      currentAlarm ===
        null ||
      desiredAt <
        currentAlarm ||
      currentAlarm <=
        now
    ) {
      await this
        .state
        .storage
        .setAlarm(
          Math.max(
            desiredAt,
            now
          )
        )
    }
  }

  private async clearBotRuntime() {
    if (!this.session) {
      return
    }

    const hadRuntime =
      Boolean(
        this.session
          .bot
          ?.actorId ||
        this.session
          .bot
          ?.nextActionAt
      )

    this.session.bot = {
      actorId:
        null,
      nextActionAt:
        0
    }

    if (hadRuntime) {
      await this.save()
    }
  }

  private async scheduleBot(
    game:
      any,

    now =
      Date.now()
  ) {
    if (!this.session) {
      return false
    }

    const actorId =
      getConquistadorBotActorId(
        game,
        this.getEffectiveParticipants()
      )

    if (!actorId) {
      await this
        .clearBotRuntime()

      await this
        .setNextAlarm(
          0,
          now
        )

      return false
    }

    const runtime =
      this.session
        .bot

    let nextActionAt =
      runtime
        ?.nextActionAt ||
      0

    if (
      runtime
        ?.actorId !==
        actorId ||
      nextActionAt <=
        0
    ) {
      nextActionAt =
        now +
        this.getBotDelay(
          this.session
            .revision
        )

      this.session.bot = {
        actorId,
        nextActionAt
      }

      await this.save()
    }

    await this
      .setNextAlarm(
        nextActionAt,
        now
      )

    return true
  }

  private async rescheduleBotAfterFailure(
    actorId:
      string
  ) {
    if (!this.session) {
      return
    }

    const now =
      Date.now()

    const nextActionAt =
      now +
      BOT_RETRY_DELAY_MS

    this.session.bot = {
      actorId,
      nextActionAt
    }

    await this.save()

    await this
      .setNextAlarm(
        nextActionAt,
        now
      )
  }

  private async executeBotAction() {
    if (!this.session) {
      return false
    }

    const game =
      Game.fromJSON(
        this.session.game
      )

    const effectiveParticipants =
      this.getEffectiveParticipants()

    const actorId =
      getConquistadorBotActorId(
        game,
        effectiveParticipants
      )

    if (!actorId) {
      await this
        .clearBotRuntime()

      await this
        .setNextAlarm()

      return false
    }

    const runtime =
      this.session
        .bot

    if (
      runtime
        ?.actorId !==
        actorId ||
      !runtime
        ?.nextActionAt
    ) {
      await this
        .scheduleBot(
          game
        )

      return false
    }

    const now =
      Date.now()

    if (
      now <
      runtime
        .nextActionAt
    ) {
      await this
        .setNextAlarm(
          runtime
            .nextActionAt,
          now
        )

      return false
    }

    const preferredCommand =
      normalizeCommand(
        chooseConquistadorBotCommand(
          game,
          effectiveParticipants,
          actorId
        )
      )

    const fallbackCommand =
      chooseEmergencyBotCommand(
        game,
        actorId
      )

    const commands =
      [
        preferredCommand,
        fallbackCommand
      ]
        .filter(
          (
            command,
            index,
            list
          ):
            command is GameCommand =>
              Boolean(
                command
              ) &&
              list.findIndex(
                (
                  candidate
                ) =>
                  JSON.stringify(
                    candidate
                  ) ===
                  JSON.stringify(
                    command
                  )
              ) ===
              index
        )

    let success =
      false

    for (
      const command
      of commands
    ) {
      try {
        const result =
          executeCommand(
            game,
            actorId,
            command
          ) as Record<
            string,
            unknown
          >

        if (
          result
            ?.success ===
          true
        ) {
          success =
            true

          break
        }
      } catch {
        continue
      }
    }

    if (!success) {
      await this
        .rescheduleBotAfterFailure(
          actorId
        )

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

    await this.save()

    await this
      .scheduleBot(
        game,
        Date.now()
      )

    return true
  }

  private async handleAlarm() {
    if (!this.session) {
      return
    }

    const now =
      Date.now()

    const game =
      Game.fromJSON(
        this.session.game
      )

    if (
      this.finalizeExpiredPresences(
        game,
        now
      )
    ) {
      this.session.game =
        game.toJSON()

      this.session.revision +=
        1

      this.session.updatedAt =
        now

      await this.save()
    }

    await this
      .scheduleBot(
        game,
        now
      )

    await this
      .executeBotAction()
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

    const credentialsSupplied =
      Array.isArray(
        body.credentials
      )

    const credentials =
      credentialsSupplied
        ? normalizeSessionCredentials(
            body.credentials
          )
        : []

    const humanCount =
      participants.filter(
        (participant) =>
          participant.kind ===
          'human'
      ).length

    if (
      !matchId ||
      participants.length !==
        MATCH_SIZE ||
      (
        credentialsSupplied &&
        credentials.length !==
          humanCount
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            credentialsSupplied
              ? 'Não foi possível criar a composição segura da partida.'
              : 'Não foi possível criar a composição da partida.'
        },

        400
      )
    }

    const now =
      Date.now()

    let suppliedPresence:
      Record<
        string,
        HumanPresenceState
      > |
      null = null

    if (credentialsSupplied) {
      try {
        suppliedPresence =
          await this
            .buildPresenceState(
              participants,
              credentials,
              now
            )
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
                : 'Não foi possível validar as credenciais da partida.'
          },

          400
        )
      }
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

      const existingIds =
        this.session
          .participants
          .map(
            (participant) =>
              `${participant.id}:${participant.kind}`
          )
          .sort()

      const suppliedIds =
        participants
          .map(
            (participant) =>
              `${participant.id}:${participant.kind}`
          )
          .sort()

      if (
        JSON.stringify(
          existingIds
        ) !==
        JSON.stringify(
          suppliedIds
        )
      ) {
        return json(
          {
            success:
              false,

            message:
              'A composição desta sessão não corresponde ao matchmaking.'
          },

          409
        )
      }

      let presenceChanged =
        false

      if (suppliedPresence) {
        if (
          !this.session
            .presence
        ) {
          this.session.presence =
            suppliedPresence

          presenceChanged =
            true
        } else {
          for (
            const [
              playerId,
              supplied
            ] of Object.entries(
              suppliedPresence
            )
          ) {
            const existing =
              this.session
                .presence[
                  playerId
                ]

            if (!existing) {
              this.session
                .presence[
                  playerId
                ] = supplied

              presenceChanged =
                true

              continue
            }

            if (
              !constantTimeEqual(
                existing.tokenHash,
                supplied.tokenHash
              )
            ) {
              return json(
                {
                  success:
                    false,

                  message:
                    'As credenciais desta partida não correspondem à sessão já criada.'
                },

                409
              )
            }
          }
        }
      }

      if (presenceChanged) {
        await this.save()
      }

      await this
        .scheduleBot(
          Game.fromJSON(
            this.session
              .game
          ),
          now
        )

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

      ...(suppliedPresence
        ? {
            presence:
              suppliedPresence
          }
        : {}),

      bot: {
        actorId:
          null,

        nextActionAt:
          0
      }
    }

    await this.save()

    await this
      .scheduleBot(
        game,
        now
      )

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

  private async handleLeave(
    request:
      Request
  ) {
    if (!this.session) {
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

    const authentication =
      await this
        .authenticateHuman(
          body
        )

    if (!authentication.ok) {
      return json(
        {
          success:
            false,

          message:
            authentication
              .message
        },

        authentication
          .status
      )
    }

    const playerId =
      authentication
        .playerId

    const now =
      Date.now()

    const game =
      Game.fromJSON(
        this.session.game
      )

    if (
      !this.finalizePlayerAbandonment(
        game,
        playerId,
        now
      )
    ) {
      return json(
        {
          success:
            false,

          message:
            'Não foi possível entregar este lugar a um jogador automático.'
        },

        409
      )
    }

    this.session.game =
      game.toJSON()

    this.session.revision +=
      1

    this.session.updatedAt =
      now

    await this.save()

    await this
      .scheduleBot(
        game,
        now
      )

    return json({
      success:
        true,

      status:
        'left',

      matchId:
        this.session
          .matchId,

      playerId,

      revision:
        this.session
          .revision
    })
  }

  private async handleState(
    request:
      Request
  ) {
    if (!this.session) {
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

    const authentication =
      await this
        .authenticateHuman(
          body
        )

    if (!authentication.ok) {
      return json(
        {
          success:
            false,

          message:
            authentication
              .message
        },

        authentication
          .status
      )
    }

    const playerId =
      authentication
        .playerId

    await this
      .scheduleBot(
        Game.fromJSON(
          this.session
            .game
        ),
        authentication.now
      )

    const knownRevision =
      normalizeRevision(
        body.knownRevision
      )

    const presenceWarnings =
      getPresenceWarnings(
        this.session,
        Date.now()
      )

    if (
      presenceWarnings.length ===
        0 &&
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
    if (!this.session) {
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

    const authentication =
      await this
        .authenticateHuman(
          body
        )

    if (!authentication.ok) {
      return json(
        {
          success:
            false,

          message:
            authentication
              .message
        },

        authentication
          .status
      )
    }

    const playerId =
      authentication
        .playerId

    await this
      .scheduleBot(
        Game.fromJSON(
          this.session
            .game
        ),
        authentication.now
      )

    const expectedRevision =
      normalizeRevision(
        body.revision
      )

    const revisionMatches =
      expectedRevision ===
        null ||
      expectedRevision ===
        this.session
          .revision ||
      (
        authentication
          .reactivated &&
        expectedRevision ===
          authentication
            .revisionBefore
      )

    if (!revisionMatches) {
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

    await this.save()

    await this
      .scheduleBot(
        game,
        Date.now()
      )

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

        case '/leave':
          return this
            .handleLeave(
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
