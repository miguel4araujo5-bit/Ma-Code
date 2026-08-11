const API_PREFIX =
  '/api/conquistador/matchmaking'

const STORAGE_KEY =
  'conquistador-matchmaking-v1'

const GLOBAL_OBJECT_NAME =
  'conquistador-matchmaking-global'

const MATCH_WINDOW_MS = 5_000
const MATCH_SIZE = 4
const TICKET_RETENTION_MS = 20 * 60_000
const MATCH_RETENTION_MS = 30 * 60_000
const MAX_NAME_LENGTH = 24

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

type PlayerKind =
  | 'human'
  | 'bot'

type MatchParticipant = {
  id: string
  name: string
  kind: PlayerKind
  icon: string | null
}

type TicketStatus =
  | 'waiting'
  | 'matched'
  | 'left'

type QueueTicket = {
  id: string
  playerId: string
  playerName: string
  reconnectToken: string
  joinedAt: number
  deadlineAt: number
  status: TicketStatus
  matchId: string | null
}

type MatchCredential = {
  playerId: string
  reconnectToken: string
}

type MatchRecord = {
  id: string
  createdAt: number
  participants: MatchParticipant[]
  gameSessionCredentials?: MatchCredential[]
}

type StoredState = {
  tickets: Record<string, QueueTicket>
  queue: string[]
  matches: Record<string, MatchRecord>
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

export type ConquistadorMatchmakingEnv = {
  CONQUISTADOR_MATCHMAKING:
    DurableObjectNamespaceLike
}

const createInitialState =
  (): StoredState => ({
    tickets: {},
    queue: [],
    matches: {}
  })

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

const createId = (
  prefix: string
) => {
  const uuid =
    globalThis.crypto?.randomUUID?.()

  if (uuid) {
    return `${prefix}-${uuid}`
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}`
}

const createReconnectToken = () => {
  const bytes =
    new Uint8Array(32)

  globalThis.crypto
    .getRandomValues(
      bytes
    )

  return Array.from(
    bytes,
    (byte) =>
      byte
        .toString(16)
        .padStart(2, '0')
  ).join('')
}

const getDurableObject = (
  env: ConquistadorMatchmakingEnv
) => {
  const id =
    env.CONQUISTADOR_MATCHMAKING
      .idFromName(
        GLOBAL_OBJECT_NAME
      )

  return env.CONQUISTADOR_MATCHMAKING
    .get(id)
}

export const isConquistadorMatchmakingApiPath = (
  pathname: string
) =>
  pathname === API_PREFIX ||
  pathname.startsWith(
    `${API_PREFIX}/`
  )

export const handleConquistadorMatchmakingApiRequest =
  async (
    request: Request,
    env: ConquistadorMatchmakingEnv
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
        403
      )
    }

    const response =
      await getDurableObject(env)
        .fetch(request)

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
  }

export class ConquistadorMatchmakingDurableObject {
  private readonly state:
    DurableObjectStateLike

  private storedState:
    StoredState | null = null

  private operation:
    Promise<void>

  constructor(
    state: DurableObjectStateLike,
    _env: ConquistadorMatchmakingEnv
  ) {
    this.state = state

    this.operation =
      this.state.blockConcurrencyWhile(
        async () => {
          this.storedState =
            (
              await this.state.storage.get<StoredState>(
                STORAGE_KEY
              )
            ) ||
            createInitialState()

          this.cleanup(
            Date.now()
          )

          await this.save()
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

  private async getState() {
    if (!this.storedState) {
      this.storedState =
        (
          await this.state.storage.get<StoredState>(
            STORAGE_KEY
          )
        ) ||
        createInitialState()
    }

    return this.storedState
  }

  private async save() {
    if (!this.storedState) {
      return
    }

    await this.state.storage.put(
      STORAGE_KEY,
      this.storedState
    )
  }

  private cleanup(
    now: number
  ) {
    if (!this.storedState) {
      return
    }

    const state =
      this.storedState

    state.queue =
      state.queue.filter(
        (ticketId) => {
          const ticket =
            state.tickets[
              ticketId
            ]

          return Boolean(
            ticket &&
            ticket.status ===
              'waiting' &&
            now -
              ticket.joinedAt <
              TICKET_RETENTION_MS
          )
        }
      )

    for (
      const [
        ticketId,
        ticket
      ] of Object.entries(
        state.tickets
      )
    ) {
      if (
        ticket.status !==
          'waiting' &&
        now -
          ticket.joinedAt >=
          TICKET_RETENTION_MS
      ) {
        delete state.tickets[
          ticketId
        ]
      }
    }

    for (
      const [
        matchId,
        match
      ] of Object.entries(
        state.matches
      )
    ) {
      if (
        now -
          match.createdAt >=
          MATCH_RETENTION_MS
      ) {
        delete state.matches[
          matchId
        ]
      }
    }
  }

  private getWaitingTickets(
    state: StoredState
  ) {
    return state.queue
      .map(
        (ticketId) =>
          state.tickets[
            ticketId
          ]
      )
      .filter(
        (
          ticket
        ): ticket is QueueTicket =>
          Boolean(
            ticket &&
            ticket.status ===
              'waiting'
          )
      )
      .sort(
        (first, second) =>
          first.joinedAt -
          second.joinedAt
      )
  }

  private chooseBotNames(
    humanNames: string[],
    quantity: number
  ) {
    const blocked =
      new Set(
        humanNames.map(
          (name) =>
            name.toLocaleLowerCase(
              'pt-PT'
            )
        )
      )

    const available =
      BOT_NAMES.filter(
        (name) =>
          !blocked.has(
            name.toLocaleLowerCase(
              'pt-PT'
            )
          )
      )

    const offset =
      Math.floor(
        Math.random() *
          Math.max(
            1,
            available.length
          )
      )

    return Array.from(
      {
        length: quantity
      },
      (_, index) =>
        available[
          (
            offset + index
          ) %
          available.length
        ] ||
        `Adversário ${
          index + 1
        }`
    )
  }

  private createMatch(
    state: StoredState,
    tickets: QueueTicket[],
    now: number
  ) {
    const matchId =
      createId('match')

    for (
      const ticket
      of tickets
    ) {
      if (
        !ticket.reconnectToken
      ) {
        ticket.reconnectToken =
          createReconnectToken()
      }
    }

    const humans:
      MatchParticipant[] =
      tickets.map(
        (ticket) => ({
          id:
            ticket.playerId,
          name:
            ticket.playerName,
          kind: 'human',
          icon: null
        })
      )

    const botCount =
      Math.max(
        0,
        MATCH_SIZE -
          humans.length
      )

    const botNames =
      this.chooseBotNames(
        humans.map(
          (player) =>
            player.name
        ),
        botCount
      )

    const bots:
      MatchParticipant[] =
      botNames.map(
        (name, index) => ({
          id:
            `${matchId}-bot-${
              index + 1
            }`,
          name,
          kind: 'bot',
          icon: BOT_ICON
        })
      )

    const match:
      MatchRecord = {
        id: matchId,
        createdAt: now,
        participants: [
          ...humans,
          ...bots
        ],
        gameSessionCredentials:
          tickets.map(
            (ticket) => ({
              playerId:
                ticket.playerId,
              reconnectToken:
                ticket.reconnectToken
            })
          )
      }

    state.matches[
      matchId
    ] = match

    for (
      const ticket
      of tickets
    ) {
      ticket.status =
        'matched'

      ticket.matchId =
        matchId
    }

    const matchedIds =
      new Set(
        tickets.map(
          (ticket) =>
            ticket.id
        )
      )

    state.queue =
      state.queue.filter(
        (ticketId) =>
          !matchedIds.has(
            ticketId
          )
      )

    return match
  }

  private finalizeReadyMatches(
    state: StoredState,
    now: number
  ) {
    let waiting =
      this.getWaitingTickets(
        state
      )

    while (
      waiting.length > 0
    ) {
      const oldest =
        waiting[0]

      const fullGroup =
        waiting.length >=
        MATCH_SIZE

      const deadlineReached =
        now >=
        oldest.deadlineAt

      if (
        !fullGroup &&
        !deadlineReached
      ) {
        break
      }

      const group =
        waiting.slice(
          0,
          Math.min(
            MATCH_SIZE,
            waiting.length
          )
        )

      this.createMatch(
        state,
        group,
        now
      )

      waiting =
        this.getWaitingTickets(
          state
        )
    }
  }

  private buildTicketResponse(
    state: StoredState,
    ticket: QueueTicket,
    now: number
  ) {
    if (
      ticket.status ===
        'matched' &&
      ticket.matchId
    ) {
      const match =
        state.matches[
          ticket.matchId
        ]

      if (match) {
        return {
          success: true,
          status: 'matched',
          ticketId:
            ticket.id,
          matchId:
            match.id,
          playerId:
            ticket.playerId,
          reconnectToken:
            ticket.reconnectToken,
          gameSessionCredentials:
            match.gameSessionCredentials ||
            [],
          participants:
            match.participants,
          humanCount:
            match.participants.filter(
              (player) =>
                player.kind ===
                'human'
            ).length,
          botCount:
            match.participants.filter(
              (player) =>
                player.kind ===
                'bot'
            ).length
        }
      }
    }

    if (
      ticket.status ===
      'left'
    ) {
      return {
        success: true,
        status: 'left',
        ticketId:
          ticket.id
      }
    }

    return {
      success: true,
      status: 'waiting',
      ticketId:
        ticket.id,
      playerId:
        ticket.playerId,
      reconnectToken:
        ticket.reconnectToken,
      deadlineAt:
        ticket.deadlineAt,
      remainingMs:
        Math.max(
          0,
          ticket.deadlineAt -
            now
        )
    }
  }

  private async handleJoin(
    body: Record<string, unknown>
  ) {
    const state =
      await this.getState()

    const now =
      Date.now()

    this.cleanup(now)
    this.finalizeReadyMatches(
      state,
      now
    )

    const playerName =
      normalizeName(
        body.name
      )

    if (!playerName) {
      return json(
        {
          success: false,
          message:
            'Indique um nome para entrar no matchmaking.'
        },
        400
      )
    }

    const ticketId =
      createId('ticket')

    const ticket:
      QueueTicket = {
        id: ticketId,
        playerId:
          createId('human'),
        playerName,
        reconnectToken:
          createReconnectToken(),
        joinedAt: now,
        deadlineAt:
          now +
          MATCH_WINDOW_MS,
        status: 'waiting',
        matchId: null
      }

    state.tickets[
      ticketId
    ] = ticket

    state.queue.push(
      ticketId
    )

    this.finalizeReadyMatches(
      state,
      now
    )

    await this.save()

    return json(
      this.buildTicketResponse(
        state,
        ticket,
        now
      )
    )
  }

  private async handleStatus(
    body: Record<string, unknown>
  ) {
    const state =
      await this.getState()

    const ticketId =
      typeof body.ticketId ===
        'string'
        ? body.ticketId
        : ''

    const ticket =
      state.tickets[
        ticketId
      ]

    if (!ticket) {
      return json(
        {
          success: false,
          message:
            'A procura desta partida já não existe.'
        },
        404
      )
    }

    const now =
      Date.now()

    this.cleanup(now)
    this.finalizeReadyMatches(
      state,
      now
    )

    await this.save()

    return json(
      this.buildTicketResponse(
        state,
        ticket,
        now
      )
    )
  }

  private async handleLeave(
    body: Record<string, unknown>
  ) {
    const state =
      await this.getState()

    const ticketId =
      typeof body.ticketId ===
        'string'
        ? body.ticketId
        : ''

    const ticket =
      state.tickets[
        ticketId
      ]

    if (!ticket) {
      return json({
        success: true,
        status: 'left'
      })
    }

    if (
      ticket.status ===
      'waiting'
    ) {
      ticket.status =
        'left'

      state.queue =
        state.queue.filter(
          (queuedTicketId) =>
            queuedTicketId !==
            ticketId
        )
    }

    await this.save()

    return json({
      success: true,
      status:
        ticket.status,
      ticketId:
        ticket.id,
      matchId:
        ticket.matchId
    })
  }

  private async handleRequest(
    request: Request
  ) {
    const url =
      new URL(request.url)

    if (
      !isConquistadorMatchmakingApiPath(
        url.pathname
      )
    ) {
      return json(
        {
          success: false,
          message:
            'Endpoint não encontrado.'
        },
        404
      )
    }

    try {
      const body =
        await getBody(request)

      const action =
        url.pathname.slice(
          API_PREFIX.length
        ) || '/'

      switch (action) {
        case '/join':
          return this.handleJoin(
            body
          )

        case '/status':
          return this.handleStatus(
            body
          )

        case '/leave':
          return this.handleLeave(
            body
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
          : 'Não foi possível processar o matchmaking.'

      return json(
        {
          success: false,
          message
        },
        message.includes('JSON') ||
        message.includes('válido')
          ? 400
          : 500
      )
    }
  }
}
