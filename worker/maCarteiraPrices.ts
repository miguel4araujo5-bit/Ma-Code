import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  isSupportedChainId,
  type ChainId
} from '../src/lib/maCarteiraChains'

export const MA_CARTEIRA_PRICES_PATH =
  '/api/ma-carteira/token-price-history'

export const PRICE_PERIODS = [
  '15M',
  '4H',
  '1D',
  '1M',
  'Tudo'
] as const

export type PricePeriod =
  (typeof PRICE_PERIODS)[number]

export type MaCarteiraPricePoint = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MaCarteiraPriceHistory = {
  chainId: ChainId
  networkId: string
  contractAddress: string
  symbol: string
  name: string
  period: PricePeriod
  poolAddress: string
  poolName: string
  currentPriceUsd: number
  changePercentage: number
  highUsd: number
  lowUsd: number
  volumeUsd: number
  liquidityUsd: number
  fetchedAt: string
  points: MaCarteiraPricePoint[]
}

type UnknownRecord =
  Record<string, unknown>

type PeriodConfig = {
  timeframe:
    | 'minute'
    | 'hour'
    | 'day'
  aggregate:
    | 1
    | 4
    | 5
    | 15
  limit: number
  freshForMs: number
  loadAll?: boolean
}

type PoolSelection = {
  pool: UnknownRecord
  tokenSide: 'base' | 'quote'
  poolAddress: string
}

type PoolLookup = {
  poolsResponse: UnknownRecord
  selectedPool: PoolSelection
}

type OhlcvResult = {
  points: MaCarteiraPricePoint[]
  baseAddress: string
  quoteAddress: string
}

type CacheEntry<T> = {
  cachedAt: number
  value: T
}

type MarketApiConfig = {
  baseUrl: string
  headers: Record<string, string>
}

type EdgeCache = {
  match:
    (
      request: Request
    ) =>
      Promise<
        Response | undefined
      >

  put:
    (
      request: Request,
      response: Response
    ) =>
      Promise<void>
}

const COINGECKO_DEMO_ONCHAIN_API =
  'https://api.coingecko.com/api/v3/onchain'

const COINGECKO_DEMO_API_KEY_NAME =
  'COINGECKO_DEMO_API_KEY'

const PULSECHAIN_NETWORK_ID =
  'pulsechain'

const PULSECHAIN_WPLS_ADDRESS =
  '0xa1077a294dde1b09bb078844df40758a5d0f9a27'

const PULSECHAIN_PLSX_ADDRESS =
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab'

const PULSEX_PLSX_WPLS_POOL_ADDRESS =
  '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9'

const REQUEST_TIMEOUT_MS =
  15_000

const CACHE_VERSION =
  'v2'

const CACHE_ORIGIN =
  'https://ma-code.pt'

const PRICE_CACHE_RETENTION_SECONDS =
  24 * 60 * 60

const POOL_CACHE_RETENTION_SECONDS =
  30 * 24 * 60 * 60

const POOL_CACHE_FRESH_MS =
  24 * 60 * 60 * 1000

const MAX_ALL_HISTORY_PAGES =
  2

const MIN_GECKOTERMINAL_REQUEST_INTERVAL_MS =
  2_500

const GECKOTERMINAL_RETRY_DELAY_MS =
  4_000

const GECKOTERMINAL_MAX_RETRY_DELAY_MS =
  8_000

const GECKOTERMINAL_COOLDOWN_MS =
  60_000

const MAX_MEMORY_CACHE_ENTRIES =
  250

const PERIOD_CONFIG: Record<
  PricePeriod,
  PeriodConfig
> = {
  '15M': {
    timeframe: 'minute',
    aggregate: 1,
    limit: 15,
    freshForMs: 2 * 60_000
  },

  '4H': {
    timeframe: 'minute',
    aggregate: 5,
    limit: 48,
    freshForMs: 5 * 60_000
  },

  '1D': {
    timeframe: 'minute',
    aggregate: 15,
    limit: 96,
    freshForMs: 10 * 60_000
  },

  '1M': {
    timeframe: 'hour',
    aggregate: 4,
    limit: 180,
    freshForMs: 30 * 60_000
  },

  'Tudo': {
    timeframe: 'day',
    aggregate: 1,
    limit: 1000,
    freshForMs: 6 * 60 * 60_000,
    loadAll: true
  }
}

const PERIOD_WINDOW_MS: Record<
  Exclude<PricePeriod, 'Tudo'>,
  number
> = {
  '15M': 15 * 60_000,
  '4H': 4 * 60 * 60_000,
  '1D': 24 * 60 * 60_000,
  '1M': 30 * 24 * 60 * 60_000
}

const PERIOD_FALLBACK_SOURCES: Record<
  Exclude<PricePeriod, 'Tudo'>,
  PricePeriod[]
> = {
  '15M': ['4H', '1D', '1M', 'Tudo'],
  '4H': ['1D', '1M', 'Tudo'],
  '1D': ['1M', 'Tudo'],
  '1M': ['Tudo']
}

const priceMemoryCache =
  new Map<
    string,
    CacheEntry<
      MaCarteiraPriceHistory
    >
  >()

const poolMemoryCache =
  new Map<
    string,
    CacheEntry<
      PoolLookup
    >
  >()

const priceRequestsInFlight =
  new Map<
    string,
    Promise<
      MaCarteiraPriceHistory
    >
  >()

const poolRequestsInFlight =
  new Map<
    string,
    Promise<
      PoolLookup
    >
  >()

let geckoTerminalQueue:
  Promise<void> =
    Promise.resolve()

let nextGeckoTerminalRequestAt = 0
let geckoTerminalCooldownUntil = 0

export class MaCarteiraPricesError
  extends Error {
  status: number

  constructor(
    message: string,
    status = 400
  ) {
    super(message)

    this.name =
      'MaCarteiraPricesError'

    this.status = status
  }
}

const isRecord = (
  value: unknown
): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)

const asRecord = (
  value: unknown
) =>
  isRecord(value)
    ? value
    : null

const toStringValue = (
  value: unknown
) => {
  if (typeof value === 'string') {
    return value
  }

  if (
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }

  return ''
}

const readString = (
  record: UnknownRecord | null,
  key: string
) =>
  record
    ? toStringValue(
        record[key]
      ).trim()
    : ''

const readNumber = (
  value: unknown,
  fallback = 0
) => {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

const getCoinGeckoDemoApiKey = () => {
  const runtimeProcess = (
    globalThis as unknown as {
      process?: {
        env?: Record<
          string,
          string | undefined
        >
      }
    }
  ).process

  return (
    runtimeProcess?.env?.[
      COINGECKO_DEMO_API_KEY_NAME
    ] || ''
  ).trim()
}

const getMarketApiConfig =
  (): MarketApiConfig => {
    const apiKey =
      getCoinGeckoDemoApiKey()

    if (!apiKey) {
      throw new MaCarteiraPricesError(
        'A chave da API CoinGecko Demo não está disponível no Worker.',
        500
      )
    }

    return {
      baseUrl:
        COINGECKO_DEMO_ONCHAIN_API,

      headers: {
        Accept:
          'application/json',

        'x-cg-demo-api-key':
          apiKey
      }
    }
  }

const trimMemoryCache = <T>(
  memoryCache:
    Map<
      string,
      CacheEntry<T>
    >
) => {
  while (
    memoryCache.size >
    MAX_MEMORY_CACHE_ENTRIES
  ) {
    const oldestKey =
      memoryCache.keys()
        .next().value

    if (
      typeof oldestKey !==
      'string'
    ) {
      break
    }

    memoryCache.delete(
      oldestKey
    )
  }
}

const getEdgeCache = () => {
  const cacheStorage = (
    globalThis as unknown as {
      caches?: {
        default?: EdgeCache
      }
    }
  ).caches

  return (
    cacheStorage?.default ||
    null
  )
}

const createCacheRequest = (
  scope: 'prices' | 'pools',
  key: string
) =>
  new Request(
    `${CACHE_ORIGIN}/__ma-carteira-cache/${CACHE_VERSION}/${scope}/${encodeURIComponent(
      key
    )}`
  )

const readCacheEntry = async <T>(
  scope: 'prices' | 'pools',
  key: string,
  memoryCache:
    Map<
      string,
      CacheEntry<T>
    >
): Promise<CacheEntry<T> | null> => {
  const memoryEntry =
    memoryCache.get(
      key
    )

  if (memoryEntry) {
    return memoryEntry
  }

  const edgeCache =
    getEdgeCache()

  if (!edgeCache) {
    return null
  }

  try {
    const response =
      await edgeCache.match(
        createCacheRequest(
          scope,
          key
        )
      )

    if (!response) {
      return null
    }

    const rawEntry:
      unknown =
        await response.json()

    if (
      !isRecord(rawEntry) ||
      !(
        'value' in
        rawEntry
      )
    ) {
      return null
    }

    const cachedAt =
      readNumber(
        rawEntry.cachedAt
      )

    if (cachedAt <= 0) {
      return null
    }

    const entry:
      CacheEntry<T> = {
        cachedAt,
        value:
          rawEntry.value as T
      }

    memoryCache.set(
      key,
      entry
    )

    trimMemoryCache(
      memoryCache
    )

    return entry
  } catch {
    return null
  }
}

const writeCacheEntry = async <T>(
  scope: 'prices' | 'pools',
  key: string,
  entry: CacheEntry<T>,
  memoryCache:
    Map<
      string,
      CacheEntry<T>
    >,
  retentionSeconds: number
) => {
  memoryCache.set(
    key,
    entry
  )

  trimMemoryCache(
    memoryCache
  )

  const edgeCache =
    getEdgeCache()

  if (!edgeCache) {
    return
  }

  try {
    await edgeCache.put(
      createCacheRequest(
        scope,
        key
      ),

      new Response(
        JSON.stringify(
          entry
        ),
        {
          headers: {
            'Content-Type':
              'application/json; charset=utf-8',

            'Cache-Control':
              `public, max-age=${retentionSeconds}`
          }
        }
      )
    )
  } catch {
    /*
     * A cache é uma otimização.
     * Uma falha ao gravá-la não deve
     * impedir a apresentação do preço.
     */
  }
}

const canUseStaleCache = (
  error: unknown
) =>
  error instanceof
    MaCarteiraPricesError &&
  (
    error.status === 429 ||
    error.status >= 500
  )

const normalizeAddress = (
  value: string
) => {
  const clean = value.trim()

  return (
    clean &&
    !clean.startsWith('0x')
  )
    ? `0x${clean}`
    : clean
}

const isValidEvmAddress = (
  value: string
) =>
  /^0x[a-fA-F0-9]{40}$/.test(
    value
  )

const getRequestedChainId = (
  url: URL
): ChainId => {
  const requested = (
    url.searchParams.get(
      'chainId'
    ) ||
    DEFAULT_CHAIN_ID
  ).trim()

  if (
    !isSupportedChainId(
      requested
    )
  ) {
    throw new MaCarteiraPricesError(
      'A rede indicada ainda não é suportada.',
      400
    )
  }

  return requested
}

const getRequestedPeriod = (
  url: URL
): PricePeriod => {
  const rawPeriod = (
    url.searchParams.get(
      'period'
    ) ||
    '1D'
  ).trim()

  const requested =
    PRICE_PERIODS.find(
      (period) =>
        period
          .toLowerCase() ===
        rawPeriod
          .toLowerCase()
    )

  if (!requested) {
    throw new MaCarteiraPricesError(
      'O período indicado não é válido.',
      400
    )
  }

  return requested
}

const wait = (
  milliseconds: number
) =>
  new Promise<void>(
    (resolve) => {
      setTimeout(
        resolve,
        Math.max(
          0,
          milliseconds
        )
      )
    }
  )

const getRetryAfterMs = (
  response: Response
) => {
  const retryAfter =
    response.headers.get(
      'Retry-After'
    )

  if (!retryAfter) {
    return 0
  }

  const seconds =
    Number(retryAfter)

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return seconds * 1000
  }

  const date =
    new Date(
      retryAfter
    ).getTime()

  return Number.isFinite(date)
    ? Math.max(
        0,
        date - Date.now()
      )
    : 0
}

const runGeckoTerminalRequest =
  async <T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    const previousQueue =
      geckoTerminalQueue

    let releaseQueue!: () => void

    geckoTerminalQueue =
      new Promise<void>(
        (resolve) => {
          releaseQueue = resolve
        }
      )

    await previousQueue

    try {
      const now = Date.now()

      if (
        geckoTerminalCooldownUntil >
        now
      ) {
        throw new MaCarteiraPricesError(
          'O serviço de preços está temporariamente a recuperar. Tente novamente dentro de alguns segundos.',
          429
        )
      }

      const waitMs = Math.max(
        0,
        nextGeckoTerminalRequestAt -
          now
      )

      if (waitMs > 0) {
        await wait(waitMs)
      }

      nextGeckoTerminalRequestAt =
        Date.now() +
        MIN_GECKOTERMINAL_REQUEST_INTERVAL_MS

      return await operation()
    } finally {
      releaseQueue()
    }
  }

const fetchJson = async (
  url: string,
  headers: Record<string, string>
): Promise<unknown> =>
  runGeckoTerminalRequest(
    async () => {
      for (
        let attempt = 0;
        attempt < 2;
        attempt += 1
      ) {
        const controller =
          new AbortController()

        const timer = setTimeout(
          () =>
            controller.abort(),
          REQUEST_TIMEOUT_MS
        )

        try {
          const response =
            await fetch(
              url,
              {
                headers,

                signal:
                  controller.signal
              }
            )

          if (
            response.status === 404
          ) {
            throw new MaCarteiraPricesError(
              'Não foi encontrado um mercado com preço para este token.',
              404
            )
          }

          if (
            response.status === 401 ||
            response.status === 403
          ) {
            throw new MaCarteiraPricesError(
              'A chave da API CoinGecko Demo não foi aceite. Confirme o Secret na Cloudflare.',
              502
            )
          }

          if (
            response.status === 429
          ) {
            const retryAfterMs =
              getRetryAfterMs(
                response
              )

            if (attempt === 0) {
              await wait(
                Math.min(
                  GECKOTERMINAL_MAX_RETRY_DELAY_MS,
                  Math.max(
                    GECKOTERMINAL_RETRY_DELAY_MS,
                    retryAfterMs
                  )
                )
              )

              continue
            }

            geckoTerminalCooldownUntil =
              Date.now() +
              Math.max(
                GECKOTERMINAL_COOLDOWN_MS,
                retryAfterMs
              )

            throw new MaCarteiraPricesError(
              'O serviço de preços atingiu temporariamente o limite de pedidos. Tente novamente dentro de alguns segundos.',
              429
            )
          }

          if (!response.ok) {
            throw new MaCarteiraPricesError(
              'O serviço de preços não respondeu corretamente.',
              502
            )
          }

          try {
            return await response.json()
          } catch {
            throw new MaCarteiraPricesError(
              'O serviço de preços devolveu uma resposta inválida.',
              502
            )
          }
        } catch (error) {
          if (
            error instanceof
            MaCarteiraPricesError
          ) {
            throw error
          }

          if (
            error instanceof Error &&
            error.name ===
              'AbortError'
          ) {
            throw new MaCarteiraPricesError(
              'O serviço de preços demorou demasiado tempo a responder.',
              504
            )
          }

          throw new MaCarteiraPricesError(
            'Não foi possível comunicar com o serviço de preços.',
            502
          )
        } finally {
          clearTimeout(timer)
        }
      }

      throw new MaCarteiraPricesError(
        'O serviço de preços não respondeu corretamente.',
        502
      )
    }
  )

const getResourceAddress = (
  value: unknown
) => {
  const record =
    asRecord(value)

  const attributes =
    asRecord(
      record?.attributes
    )

  const attributeAddress =
    readString(
      attributes,
      'address'
    )

  if (attributeAddress) {
    return attributeAddress
      .toLowerCase()
  }

  const id =
    readString(
      record,
      'id'
    )

  if (!id) {
    return ''
  }

  const separatorIndex =
    id.lastIndexOf('_')

  return (
    separatorIndex >= 0
      ? id.slice(
          separatorIndex + 1
        )
      : id
  ).toLowerCase()
}

const getRelationshipAddress = (
  pool: UnknownRecord,
  relationship: string
) => {
  const relationships =
    asRecord(
      pool.relationships
    )

  const relationshipRecord =
    asRecord(
      relationships?.[
        relationship
      ]
    )

  return getResourceAddress(
    relationshipRecord?.data
  )
}

const getPoolAddress = (
  pool: UnknownRecord
) => {
  const attributes =
    asRecord(
      pool.attributes
    )

  const address =
    readString(
      attributes,
      'address'
    )

  if (address) {
    return address
  }

  return getResourceAddress(
    pool
  )
}

const getPoolScore = (
  pool: UnknownRecord
) => {
  const attributes =
    asRecord(
      pool.attributes
    )

  const volume =
    asRecord(
      attributes?.volume_usd
    )

  const liquidity =
    readNumber(
      attributes
        ?.reserve_in_usd
    )

  const volume24h =
    readNumber(
      volume?.h24
    )

  /*
   * A liquidez é o fator principal.
   * O volume de 24 horas funciona
   * como critério de desempate.
   */
  return (
    liquidity * 1000 +
    volume24h
  )
}

const selectPool = (
  pools: unknown[],
  contractAddress: string
): PoolSelection | null => {
  const normalizedContract =
    contractAddress.toLowerCase()

  return (
    pools
      .filter(isRecord)
      .flatMap(
        (
          pool
        ): PoolSelection[] => {
          const baseAddress =
            getRelationshipAddress(
              pool,
              'base_token'
            )

          const quoteAddress =
            getRelationshipAddress(
              pool,
              'quote_token'
            )

          const poolAddress =
            getPoolAddress(
              pool
            )

          if (!poolAddress) {
            return []
          }

          if (
            baseAddress ===
            normalizedContract
          ) {
            return [
              {
                pool,
                tokenSide:
                  'base',
                poolAddress
              }
            ]
          }

          if (
            quoteAddress ===
            normalizedContract
          ) {
            return [
              {
                pool,
                tokenSide:
                  'quote',
                poolAddress
              }
            ]
          }

          return []
        }
      )
      .sort(
        (
          first,
          second
        ) =>
          getPoolScore(
            second.pool
          ) -
          getPoolScore(
            first.pool
          )
      )[0] || null
  )
}

const fetchPoolLookup = async (
  networkId: string,
  contractAddress: string
): Promise<PoolLookup> => {
  const apiConfig =
    getMarketApiConfig()

  const poolsUrl =
    new URL(
      `${apiConfig.baseUrl}/networks/${encodeURIComponent(
        networkId
      )}/tokens/${encodeURIComponent(
        contractAddress
      )}/pools`
    )

  poolsUrl.searchParams.set(
    'page',
    '1'
  )

  poolsUrl.searchParams.set(
    'include',
    'base_token,quote_token'
  )

  poolsUrl.searchParams.set(
    'include_inactive_source',
    'true'
  )

  const rawPoolsResponse =
    await fetchJson(
      poolsUrl.toString(),
      apiConfig.headers
    )

  const poolsResponse =
    asRecord(
      rawPoolsResponse
    )

  const pools =
    Array.isArray(
      poolsResponse?.data
    )
      ? poolsResponse.data
      : []

  const selectedPool =
    selectPool(
      pools,
      contractAddress
    )

  if (!selectedPool) {
    throw new MaCarteiraPricesError(
      'Não foi encontrado um mercado com preço para este token.',
      404
    )
  }

  if (
    !isValidEvmAddress(
      selectedPool
        .poolAddress
    )
  ) {
    throw new MaCarteiraPricesError(
      'O mercado selecionado devolveu um endereço inválido.',
      502
    )
  }

  return {
    poolsResponse:
      poolsResponse || {},

    selectedPool
  }
}

const getSharedPulsePoolLookups = (
  networkId: string,
  value: PoolLookup
) => {
  if (
    networkId !==
      PULSECHAIN_NETWORK_ID ||
    value.selectedPool.poolAddress
      .toLowerCase() !==
      PULSEX_PLSX_WPLS_POOL_ADDRESS
  ) {
    return []
  }

  const baseAddress =
    getRelationshipAddress(
      value.selectedPool.pool,
      'base_token'
    )

  const quoteAddress =
    getRelationshipAddress(
      value.selectedPool.pool,
      'quote_token'
    )

  const expectedAddresses =
    new Set([
      PULSECHAIN_PLSX_ADDRESS,
      PULSECHAIN_WPLS_ADDRESS
    ])

  if (
    !expectedAddresses.has(
      baseAddress
    ) ||
    !expectedAddresses.has(
      quoteAddress
    ) ||
    baseAddress === quoteAddress
  ) {
    return []
  }

  return [
    {
      address: baseAddress,
      value: {
        poolsResponse:
          value.poolsResponse,
        selectedPool: {
          pool:
            value.selectedPool.pool,
          tokenSide: 'base' as const,
          poolAddress:
            value.selectedPool.poolAddress
        }
      }
    },
    {
      address: quoteAddress,
      value: {
        poolsResponse:
          value.poolsResponse,
        selectedPool: {
          pool:
            value.selectedPool.pool,
          tokenSide: 'quote' as const,
          poolAddress:
            value.selectedPool.poolAddress
        }
      }
    }
  ]
}

const writePoolLookupCache = async (
  networkId: string,
  contractAddress: string,
  value: PoolLookup
) => {
  const cachedAt = Date.now()

  const sharedLookups =
    getSharedPulsePoolLookups(
      networkId,
      value
    )

  const lookups =
    sharedLookups.length
      ? sharedLookups
      : [
          {
            address:
              contractAddress.toLowerCase(),
            value
          }
        ]

  await Promise.all(
    lookups.map(
      (lookup) =>
        writeCacheEntry(
          'pools',
          [
            networkId,
            lookup.address
          ].join(':'),
          {
            cachedAt,
            value: lookup.value
          },
          poolMemoryCache,
          POOL_CACHE_RETENTION_SECONDS
        )
    )
  )
}

const getPoolLookup = async (
  networkId: string,
  contractAddress: string
): Promise<PoolLookup> => {
  const key = [
    networkId,
    contractAddress
      .toLowerCase()
  ].join(':')

  const storedCache =
    await readCacheEntry(
      'pools',
      key,
      poolMemoryCache
    )

  const cached =
    storedCache &&
    Date.now() -
      storedCache.cachedAt <=
      POOL_CACHE_RETENTION_SECONDS *
      1000
      ? storedCache
      : null

  if (
    cached &&
    Date.now() -
      cached.cachedAt <=
      POOL_CACHE_FRESH_MS
  ) {
    return cached.value
  }

  const inFlight =
    poolRequestsInFlight.get(
      key
    )

  if (inFlight) {
    return inFlight
  }

  const request = (
    async () => {
      try {
        const value =
          await fetchPoolLookup(
            networkId,
            contractAddress
          )

        await writePoolLookupCache(
          networkId,
          contractAddress,
          value
        )

        return value
      } catch (error) {
        if (
          cached &&
          canUseStaleCache(
            error
          )
        ) {
          return cached.value
        }

        throw error
      }
    }
  )()

  poolRequestsInFlight.set(
    key,
    request
  )

  try {
    return await request
  } finally {
    if (
      poolRequestsInFlight.get(
        key
      ) === request
    ) {
      poolRequestsInFlight.delete(
        key
      )
    }
  }
}

const findIncludedToken = (
  response: UnknownRecord,
  contractAddress: string
) => {
  const included =
    Array.isArray(
      response.included
    )
      ? response.included
      : []

  const normalizedContract =
    contractAddress.toLowerCase()

  return (
    included
      .filter(isRecord)
      .find((item) => {
        const attributes =
          asRecord(
            item.attributes
          )

        const address =
          (
            readString(
              attributes,
              'address'
            ) ||
            getResourceAddress(
              item
            )
          ).toLowerCase()

        return (
          address ===
          normalizedContract
        )
      }) || null
  )
}

const getOhlcvMetaAddress = (
  response: UnknownRecord,
  side: 'base' | 'quote'
) => {
  const meta =
    asRecord(
      response.meta
    )

  const token =
    asRecord(
      meta?.[side]
    )

  return readString(
    token,
    'address'
  ).toLowerCase()
}

const normalizePricePoints = (
  response: unknown
): OhlcvResult => {
  const root =
    asRecord(response)

  const data =
    asRecord(
      root?.data
    )

  const attributes =
    asRecord(
      data?.attributes
    )

  const rows =
    attributes?.ohlcv_list

  if (!Array.isArray(rows)) {
    return {
      points: [],
      baseAddress: '',
      quoteAddress: ''
    }
  }

  const byTimestamp =
    new Map<
      number,
      MaCarteiraPricePoint
    >()

  rows.forEach((row) => {
    if (
      !Array.isArray(row) ||
      row.length < 6
    ) {
      return
    }

    /*
     * GeckoTerminal:
     * [
     *   timestamp,
     *   open,
     *   high,
     *   low,
     *   close,
     *   volume
     * ]
     */
    const timestamp =
      readNumber(row[0])

    const open =
      readNumber(
        row[1],
        Number.NaN
      )

    const high =
      readNumber(
        row[2],
        Number.NaN
      )

    const low =
      readNumber(
        row[3],
        Number.NaN
      )

    const close =
      readNumber(
        row[4],
        Number.NaN
      )

    const volume =
      readNumber(
        row[5]
      )

    if (
      timestamp <= 0 ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      open <= 0 ||
      high <= 0 ||
      low <= 0 ||
      close <= 0
    ) {
      return
    }

    byTimestamp.set(
      timestamp,
      {
        timestamp:
          new Date(
            timestamp * 1000
          ).toISOString(),

        open,

        high: Math.max(
          open,
          high,
          low,
          close
        ),

        low: Math.min(
          open,
          high,
          low,
          close
        ),

        close,

        volume:
          Number.isFinite(
            volume
          ) &&
          volume > 0
            ? volume
            : 0
      }
    )
  })

  return {
    points: [
      ...byTimestamp.entries()
    ]
      .sort(
        (
          [firstTimestamp],
          [secondTimestamp]
        ) =>
          firstTimestamp -
          secondTimestamp
      )
      .map(
        ([, point]) =>
          point
      ),

    baseAddress:
      getOhlcvMetaAddress(
        root || {},
        'base'
      ),

    quoteAddress:
      getOhlcvMetaAddress(
        root || {},
        'quote'
      )
  }
}

const getTokenMetadata = (
  poolsResponse: UnknownRecord,
  pool: UnknownRecord,
  contractAddress: string,
  tokenSide: 'base' | 'quote'
) => {
  const includedToken =
    findIncludedToken(
      poolsResponse,
      contractAddress
    )

  const includedAttributes =
    asRecord(
      includedToken
        ?.attributes
    )

  const poolAttributes =
    asRecord(
      pool.attributes
    )

  const poolName =
    readString(
      poolAttributes,
      'name'
    ) ||
    'Pool GeckoTerminal'

  const fallbackSymbol =
    poolName
      .split('/')[
        tokenSide === 'base'
          ? 0
          : 1
      ]
      ?.trim()

  const symbol =
    readString(
      includedAttributes,
      'symbol'
    ) ||
    fallbackSymbol ||
    'TOKEN'

  const name =
    readString(
      includedAttributes,
      'name'
    ) ||
    symbol

  return {
    symbol,
    name,
    poolName,

    liquidityUsd:
      readNumber(
        poolAttributes
          ?.reserve_in_usd
      )
  }
}

const fetchCorrectTokenOhlcv =
  async (
    networkId: string,
    selectedPool: PoolSelection,
    contractAddress: string,
    config: PeriodConfig
  ): Promise<OhlcvResult> => {
    const apiConfig =
      getMarketApiConfig()

    const fetchPage = async (
      tokenSelector: string,
      beforeTimestamp?: number
    ) => {
      const ohlcvUrl =
        new URL(
          `${apiConfig.baseUrl}/networks/${encodeURIComponent(
            networkId
          )}/pools/${encodeURIComponent(
            selectedPool
              .poolAddress
          )}/ohlcv/${config.timeframe}`
        )

      ohlcvUrl.searchParams.set(
        'aggregate',
        String(
          config.aggregate
        )
      )

      ohlcvUrl.searchParams.set(
        'limit',
        String(
          config.limit
        )
      )

      ohlcvUrl.searchParams.set(
        'currency',
        'usd'
      )

      ohlcvUrl.searchParams.set(
        'token',
        tokenSelector
      )

      ohlcvUrl.searchParams.set(
        'include_empty_intervals',
        'true'
      )

      if (
        typeof beforeTimestamp ===
          'number' &&
        Number.isFinite(
          beforeTimestamp
        )
      ) {
        ohlcvUrl.searchParams.set(
          'before_timestamp',
          String(
            Math.floor(
              beforeTimestamp
            )
          )
        )
      }

      const response =
        await fetchJson(
          ohlcvUrl.toString(),
          apiConfig.headers
        )

      return normalizePricePoints(
        response
      )
    }

    const loadCompleteHistory =
      async (
        tokenSelector: string,
        firstPage: OhlcvResult
      ): Promise<OhlcvResult> => {
        if (!config.loadAll) {
          return firstPage
        }

        const pointsByTimestamp =
          new Map<
            string,
            MaCarteiraPricePoint
          >()

        firstPage.points.forEach(
          (point) => {
            pointsByTimestamp.set(
              point.timestamp,
              point
            )
          }
        )

        let oldestTimestamp =
          Math.min(
            ...firstPage.points.map(
              (point) =>
                new Date(
                  point.timestamp
                ).getTime() /
                1000
            )
          )

        for (
          let page = 1;
          page <
          MAX_ALL_HISTORY_PAGES;
          page += 1
        ) {
          if (
            !Number.isFinite(
              oldestTimestamp
            )
          ) {
            break
          }

          let olderPage:
            OhlcvResult

          try {
            olderPage =
              await fetchPage(
                tokenSelector,
                oldestTimestamp -
                  1
              )
          } catch (error) {
            /*
             * A primeira página já permite
             * apresentar o gráfico. Se uma
             * página histórica adicional
             * atingir o limite do fornecedor,
             * mantemos os dados já obtidos.
             */
            if (
              canUseStaleCache(
                error
              )
            ) {
              break
            }

            throw error
          }

          if (
            !olderPage
              .points.length
          ) {
            break
          }

          const previousSize =
            pointsByTimestamp.size

          olderPage.points.forEach(
            (point) => {
              pointsByTimestamp.set(
                point.timestamp,
                point
              )
            }
          )

          if (
            pointsByTimestamp.size ===
            previousSize
          ) {
            break
          }

          const nextOldestTimestamp =
            Math.min(
              ...olderPage.points.map(
                (point) =>
                  new Date(
                    point.timestamp
                  ).getTime() /
                  1000
              )
            )

          if (
            !Number.isFinite(
              nextOldestTimestamp
            ) ||
            nextOldestTimestamp >=
              oldestTimestamp
          ) {
            break
          }

          oldestTimestamp =
            nextOldestTimestamp

          if (
            olderPage
              .points.length <
            config.limit
          ) {
            break
          }
        }

        return {
          ...firstPage,

          points: [
            ...pointsByTimestamp
              .values()
          ].sort(
            (
              first,
              second
            ) =>
              new Date(
                first.timestamp
              ).getTime() -
              new Date(
                second.timestamp
              ).getTime()
          )
        }
      }

    /*
     * Primeiro pedimos explicitamente o
     * contrato selecionado.
     *
     * O base/quote fica apenas como fallback
     * para compatibilidade com respostas
     * antigas do serviço.
     */
    const tokenSelectors = [
      contractAddress,
      selectedPool.tokenSide
    ]

    let lastResponse:
      | OhlcvResult
      | null = null

    for (
      const tokenSelector of
      tokenSelectors
    ) {
      const normalized =
        await fetchPage(
          tokenSelector
        )

      lastResponse =
        normalized

      if (
        !normalized
          .points.length
      ) {
        continue
      }

      const requested =
        contractAddress
          .toLowerCase()

      /*
       * Quando a resposta inclui meta.base,
       * confirmamos que corresponde ao
       * contrato selecionado.
       *
       * Assim evitamos mostrar o gráfico
       * do outro ativo da pool.
       */
      if (
        !normalized
          .baseAddress ||
        normalized
          .baseAddress ===
          requested
      ) {
        return loadCompleteHistory(
          tokenSelector,
          normalized
        )
      }
    }

    /*
     * Algumas respostas antigas podem não
     * incluir metadata. Nesse caso aceitamos
     * apenas uma resposta com pontos válidos.
     */
    if (
      lastResponse
        ?.points.length &&
      !lastResponse
        .baseAddress
    ) {
      return lastResponse
    }

    throw new MaCarteiraPricesError(
      'O serviço de preços devolveu dados do ativo oposto da pool. Tente novamente mais tarde.',
      502
    )
  }

const createPriceCacheKey = (
  chainId: ChainId,
  networkId: string,
  contractAddress: string,
  period: PricePeriod
) =>
  [
    chainId,
    networkId,
    contractAddress.toLowerCase(),
    period
  ].join(':')

const buildHistoryFromPoints = (
  source: MaCarteiraPriceHistory,
  period: PricePeriod,
  points: MaCarteiraPricePoint[]
): MaCarteiraPriceHistory | null => {
  if (points.length < 2) {
    return null
  }

  const orderedPoints = [
    ...points
  ].sort(
    (
      first,
      second
    ) =>
      new Date(
        first.timestamp
      ).getTime() -
      new Date(
        second.timestamp
      ).getTime()
  )

  const firstPrice =
    orderedPoints[0].open

  const currentPrice =
    orderedPoints[
      orderedPoints.length - 1
    ].close

  const changePercentage =
    firstPrice > 0
      ? (
          (
            currentPrice -
            firstPrice
          ) /
          firstPrice
        ) * 100
      : 0

  return {
    ...source,
    period,
    currentPriceUsd:
      currentPrice,
    changePercentage,
    highUsd: Math.max(
      ...orderedPoints.map(
        (point) => point.high
      )
    ),
    lowUsd: Math.min(
      ...orderedPoints.map(
        (point) => point.low
      )
    ),
    volumeUsd:
      orderedPoints.reduce(
        (
          total,
          point
        ) =>
          total +
          point.volume,
        0
      ),
    points: orderedPoints
  }
}

const getCompatibleCachedHistory =
  async (
    chainId: ChainId,
    networkId: string,
    contractAddress: string,
    period: PricePeriod
  ): Promise<MaCarteiraPriceHistory | null> => {
    if (period === 'Tudo') {
      return null
    }

    const cutoff =
      Date.now() -
      PERIOD_WINDOW_MS[period]

    const candidates =
      await Promise.all(
        PERIOD_FALLBACK_SOURCES[
          period
        ].map(
          async (
            sourcePeriod
          ) => {
            const entry =
              await readCacheEntry(
                'prices',
                createPriceCacheKey(
                  chainId,
                  networkId,
                  contractAddress,
                  sourcePeriod
                ),
                priceMemoryCache
              )

            if (
              !entry ||
              Date.now() -
                entry.cachedAt >
                PRICE_CACHE_RETENTION_SECONDS *
                  1000
            ) {
              return null
            }

            const points =
              entry.value.points.filter(
                (point) => {
                  const timestamp =
                    new Date(
                      point.timestamp
                    ).getTime()

                  return (
                    Number.isFinite(
                      timestamp
                    ) &&
                    timestamp >=
                      cutoff
                  )
                }
              )

            return buildHistoryFromPoints(
              entry.value,
              period,
              points
            )
          }
        )
      )

    return (
      candidates
        .filter(
          (
            candidate
          ): candidate is MaCarteiraPriceHistory =>
            candidate !== null
        )
        .sort(
          (
            first,
            second
          ) =>
            second.points.length -
              first.points.length ||
            new Date(
              second.fetchedAt
            ).getTime() -
              new Date(
                first.fetchedAt
              ).getTime()
        )[0] || null
    )
  }

export async function getMaCarteiraPriceHistory(
  url: URL
): Promise<MaCarteiraPriceHistory> {
  const chainId =
    getRequestedChainId(
      url
    )

  const chain =
    getChainConfig(
      chainId
    )

  const period =
    getRequestedPeriod(
      url
    )

  const contractAddress =
    normalizeAddress(
      url.searchParams.get(
        'contract'
      ) ||
      url.searchParams.get(
        'address'
      ) ||
      ''
    )

  if (
    chain.status !==
    'active'
  ) {
    throw new MaCarteiraPricesError(
      `${chain.name} ainda não está ativa na MA-Carteira.`,
      409
    )
  }

  if (!chain.evm) {
    throw new MaCarteiraPricesError(
      `Os gráficos de preço ainda não estão configurados para ${chain.name}.`,
      501
    )
  }

  if (
    !isValidEvmAddress(
      contractAddress
    )
  ) {
    throw new MaCarteiraPricesError(
      'Indique um contrato de token válido.',
      400
    )
  }

  if (
    !chain.price ||
    chain.price.provider !==
      'geckoterminal'
  ) {
    throw new MaCarteiraPricesError(
      `O serviço de preços ainda não está configurado para ${chain.name}.`,
      501
    )
  }

  const networkId =
    chain.price.networkId

  const config =
    PERIOD_CONFIG[
      period
    ]

  const cacheKey =
    createPriceCacheKey(
      chainId,
      networkId,
      contractAddress,
      period
    )

  const storedCache =
    await readCacheEntry(
      'prices',
      cacheKey,
      priceMemoryCache
    )

  const cached =
    storedCache &&
    Date.now() -
      storedCache.cachedAt <=
      PRICE_CACHE_RETENTION_SECONDS *
      1000
      ? storedCache
      : null

  if (
    cached &&
    Date.now() -
      cached.cachedAt <=
      config.freshForMs
  ) {
    return cached.value
  }

  if (
    geckoTerminalCooldownUntil >
    Date.now()
  ) {
    if (cached) {
      return cached.value
    }

    const compatibleCache =
      await getCompatibleCachedHistory(
        chainId,
        networkId,
        contractAddress,
        period
      )

    if (compatibleCache) {
      return compatibleCache
    }

    throw new MaCarteiraPricesError(
      'O serviço de preços está temporariamente a recuperar. Tente novamente dentro de alguns segundos.',
      429
    )
  }

  const inFlight =
    priceRequestsInFlight.get(
      cacheKey
    )

  if (inFlight) {
    return inFlight
  }

  const request = (
    async () => {
      try {
        const {
          poolsResponse,
          selectedPool
        } =
          await getPoolLookup(
            networkId,
            contractAddress
          )

        const ohlcv =
          await fetchCorrectTokenOhlcv(
            networkId,
            selectedPool,
            contractAddress,
            config
          )

        const points =
          ohlcv.points

        if (!points.length) {
          throw new MaCarteiraPricesError(
            'Ainda não existem dados históricos de preço para este token.',
            404
          )
        }

        const metadata =
          getTokenMetadata(
            poolsResponse,
            selectedPool.pool,
            contractAddress,
            selectedPool.tokenSide
          )

        /*
         * Os pontos já estão ordenados do
         * mais antigo para o mais recente.
         */
        const firstPrice =
          points[0].open

        const currentPrice =
          points[
            points.length - 1
          ].close

        const changePercentage =
          firstPrice > 0
            ? (
                (
                  currentPrice -
                  firstPrice
                ) /
                firstPrice
              ) *
              100
            : 0

        const highUsd =
          Math.max(
            ...points.map(
              (point) =>
                point.high
            )
          )

        const lowUsd =
          Math.min(
            ...points.map(
              (point) =>
                point.low
            )
          )

        const volumeUsd =
          points.reduce(
            (
              total,
              point
            ) =>
              total +
              point.volume,
            0
          )

        const value:
          MaCarteiraPriceHistory = {
            chainId,
            networkId,
            contractAddress,

            symbol:
              metadata.symbol,

            name:
              metadata.name,

            period,

            poolAddress:
              selectedPool
                .poolAddress,

            poolName:
              metadata.poolName,

            currentPriceUsd:
              currentPrice,

            changePercentage,

            highUsd,
            lowUsd,
            volumeUsd,

            liquidityUsd:
              metadata
                .liquidityUsd,

            fetchedAt:
              new Date()
                .toISOString(),

            points
          }

        await writeCacheEntry(
          'prices',
          cacheKey,
          {
            cachedAt:
              Date.now(),

            value
          },
          priceMemoryCache,
          PRICE_CACHE_RETENTION_SECONDS
        )

        return value
      } catch (error) {
        /*
         * Se o fornecedor atingir o limite,
         * ficar indisponível ou demorar
         * demasiado, mantemos o último
         * histórico válido já guardado.
         */
        if (
          canUseStaleCache(
            error
          )
        ) {
          if (cached) {
            return cached.value
          }

          const compatibleCache =
            await getCompatibleCachedHistory(
              chainId,
              networkId,
              contractAddress,
              period
            )

          if (compatibleCache) {
            return compatibleCache
          }
        }

        throw error
      }
    }
  )()

  priceRequestsInFlight.set(
    cacheKey,
    request
  )

  try {
    return await request
  } finally {
    if (
      priceRequestsInFlight.get(
        cacheKey
      ) === request
    ) {
      priceRequestsInFlight.delete(
        cacheKey
      )
    }
  }
}
