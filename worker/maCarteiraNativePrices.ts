import type {
  ChainId
} from '../src/lib/maCarteiraChains'

import type {
  MaCarteiraPriceHistory,
  MaCarteiraPricePoint,
  PricePeriod
} from './maCarteiraPrices'

export type NativePriceRequest = {
  chainId: ChainId
  networkId: string
  coinGeckoId: string
  contractAddress: string
  symbol: string
  name: string
  period: PricePeriod
}

type UnknownRecord =
  Record<string, unknown>

type MarketSeriesPoint = {
  timestamp: number
  value: number
}

type NativePeriodConfig = {
  days: '1' | '30' | 'max'
  interval:
    | 'hourly'
    | 'daily'
    | null
  windowMs: number | null
  freshForMs: number
}

type CacheEntry = {
  cachedAt: number
  value: MaCarteiraPriceHistory
}

type EdgeCache = {
  match: (
    request: Request
  ) => Promise<
    Response | undefined
  >
  put: (
    request: Request,
    response: Response
  ) => Promise<void>
}

const COINGECKO_API =
  'https://api.coingecko.com/api/v3'

const COINGECKO_DEMO_API_KEY_NAME =
  'COINGECKO_DEMO_API_KEY'

const REQUEST_TIMEOUT_MS =
  15_000

const MIN_REQUEST_INTERVAL_MS =
  2_500

const RATE_LIMIT_COOLDOWN_MS =
  60_000

const CACHE_ORIGIN =
  'https://ma-code.pt'

const CACHE_VERSION =
  'native-v1'

const CACHE_RETENTION_SECONDS =
  7 * 24 * 60 * 60

const MAX_MEMORY_CACHE_ENTRIES =
  40

const MAX_HISTORY_POINTS =
  1_200

const PERIOD_CONFIG: Record<
  PricePeriod,
  NativePeriodConfig
> = {
  '15M': {
    days: '1',
    interval: null,
    windowMs:
      15 * 60_000,
    freshForMs:
      2 * 60_000
  },
  '4H': {
    days: '1',
    interval: null,
    windowMs:
      4 * 60 * 60_000,
    freshForMs:
      5 * 60_000
  },
  '1D': {
    days: '1',
    interval: null,
    windowMs:
      24 * 60 * 60_000,
    freshForMs:
      10 * 60_000
  },
  '1M': {
    days: '30',
    interval: 'hourly',
    windowMs:
      30 *
      24 *
      60 *
      60_000,
    freshForMs:
      30 * 60_000
  },
  Tudo: {
    days: 'max',
    interval: 'daily',
    windowMs: null,
    freshForMs:
      6 * 60 * 60_000
  }
}

const memoryCache =
  new Map<
    string,
    CacheEntry
  >()

const requestsInFlight =
  new Map<
    string,
    Promise<
      MaCarteiraPriceHistory
    >
  >()

let requestQueue:
  Promise<void> =
  Promise.resolve()

let nextRequestAt = 0
let cooldownUntil = 0

export class MaCarteiraNativePricesError
  extends Error {
  status: number

  constructor(
    message: string,
    status = 400
  ) {
    super(message)

    this.name =
      'MaCarteiraNativePricesError'

    this.status = status
  }
}

const isRecord = (
  value: unknown
): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)

const readNumber = (
  value: unknown,
  fallback = Number.NaN
) => {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value)

  return Number.isFinite(parsed)
    ? parsed
    : fallback
}

const getCoinGeckoDemoApiKey =
  () => {
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

const runQueuedRequest =
  async <T>(
    operation: () => Promise<T>
  ): Promise<T> => {
    const previousQueue =
      requestQueue

    let releaseQueue!:
      () => void

    requestQueue =
      new Promise<void>(
        (resolve) => {
          releaseQueue = resolve
        }
      )

    await previousQueue

    try {
      const now =
        Date.now()

      if (
        cooldownUntil > now
      ) {
        throw new MaCarteiraNativePricesError(
          'O serviço de preços está temporariamente a recuperar. Tente novamente dentro de alguns segundos.',
          429
        )
      }

      const waitMs =
        Math.max(
          0,
          nextRequestAt - now
        )

      if (waitMs > 0) {
        await wait(waitMs)
      }

      nextRequestAt =
        Date.now() +
        MIN_REQUEST_INTERVAL_MS

      return await operation()
    } finally {
      releaseQueue()
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

const createCacheKey = (
  request: NativePriceRequest
) =>
  [
    request.chainId,
    request.coinGeckoId,
    request.period
  ].join(':')

const createCacheRequest = (
  key: string
) =>
  new Request(
    `${CACHE_ORIGIN}/__ma-carteira-cache/${CACHE_VERSION}/prices/${encodeURIComponent(
      key
    )}`
  )

const trimMemoryCache = () => {
  while (
    memoryCache.size >
    MAX_MEMORY_CACHE_ENTRIES
  ) {
    const oldestKey =
      memoryCache
        .keys()
        .next()
        .value

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

const readCacheEntry =
  async (
    key: string
  ): Promise<
    CacheEntry | null
  > => {
    const memoryEntry =
      memoryCache.get(key)

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
        !isRecord(
          rawEntry
        ) ||
        !isRecord(
          rawEntry.value
        )
      ) {
        return null
      }

      const cachedAt =
        readNumber(
          rawEntry.cachedAt
        )

      if (
        !Number.isFinite(
          cachedAt
        ) ||
        cachedAt <= 0
      ) {
        return null
      }

      const entry:
        CacheEntry = {
        cachedAt,
        value:
          rawEntry
            .value as MaCarteiraPriceHistory
      }

      memoryCache.set(
        key,
        entry
      )

      trimMemoryCache()

      return entry
    } catch {
      return null
    }
  }

const writeCacheEntry =
  async (
    key: string,
    entry: CacheEntry
  ) => {
    memoryCache.delete(key)

    memoryCache.set(
      key,
      entry
    )

    trimMemoryCache()

    const edgeCache =
      getEdgeCache()

    if (!edgeCache) {
      return
    }

    try {
      await edgeCache.put(
        createCacheRequest(
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
                `public, max-age=${CACHE_RETENTION_SECONDS}`
            }
          }
        )
      )
    } catch {
      /*
       * A cache é uma
       * otimização.
       *
       * Uma falha não deve
       * impedir a apresentação
       * do gráfico.
       */
    }
  }

const parseSeries = (
  value: unknown
): MarketSeriesPoint[] => {
  if (
    !Array.isArray(value)
  ) {
    return []
  }

  const byTimestamp =
    new Map<
      number,
      number
    >()

  value.forEach((row) => {
    if (
      !Array.isArray(row) ||
      row.length < 2
    ) {
      return
    }

    const timestamp =
      readNumber(row[0])

    const pointValue =
      readNumber(row[1])

    if (
      !Number.isFinite(
        timestamp
      ) ||
      !Number.isFinite(
        pointValue
      ) ||
      timestamp <= 0 ||
      pointValue < 0
    ) {
      return
    }

    byTimestamp.set(
      timestamp,
      pointValue
    )
  })

  return [
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
      (
        [
          timestamp,
          pointValue
        ]
      ) => ({
        timestamp,
        value: pointValue
      })
    )
}

const downsampleSeries = (
  series:
    MarketSeriesPoint[]
) => {
  if (
    series.length <=
    MAX_HISTORY_POINTS
  ) {
    return series
  }

  const lastIndex =
    series.length - 1

  const sampled:
    MarketSeriesPoint[] =
    []

  for (
    let index = 0;
    index <
    MAX_HISTORY_POINTS;
    index += 1
  ) {
    const sourceIndex =
      Math.round(
        (
          index *
          lastIndex
        ) /
          (
            MAX_HISTORY_POINTS -
            1
          )
      )

    const point =
      series[sourceIndex]

    const previous =
      sampled[
        sampled.length - 1
      ]

    if (
      !previous ||
      previous.timestamp !==
        point.timestamp
    ) {
      sampled.push(point)
    }
  }

  return sampled
}

const getNearestSeriesValue =
  (
    series:
      MarketSeriesPoint[],
    timestamp: number
  ) => {
    if (!series.length) {
      return 0
    }

    let left = 0

    let right =
      series.length - 1

    while (
      left <= right
    ) {
      const middle =
        Math.floor(
          (
            left +
            right
          ) /
            2
        )

      const middleTimestamp =
        series[
          middle
        ].timestamp

      if (
        middleTimestamp ===
        timestamp
      ) {
        return series[
          middle
        ].value
      }

      if (
        middleTimestamp <
        timestamp
      ) {
        left =
          middle + 1
      } else {
        right =
          middle - 1
      }
    }

    const before =
      series[
        Math.max(
          0,
          right
        )
      ]

    const after =
      series[
        Math.min(
          series.length - 1,
          left
        )
      ]

    return (
      Math.abs(
        before.timestamp -
        timestamp
      ) <=
      Math.abs(
        after.timestamp -
        timestamp
      )
        ? before
        : after
    ).value
  }

const buildPricePoints = (
  prices:
    MarketSeriesPoint[],
  volumes:
    MarketSeriesPoint[],
  windowMs:
    number | null
): MaCarteiraPricePoint[] => {
  if (!prices.length) {
    return []
  }

  const latestTimestamp =
    prices[
      prices.length - 1
    ].timestamp

  const filtered =
    windowMs === null
      ? prices
      : prices.filter(
          (point) =>
            point.timestamp >=
            latestTimestamp -
              windowMs
        )

  const selected =
    filtered.length >= 2
      ? filtered
      : prices.slice(-2)

  return downsampleSeries(
    selected
  ).map((point) => ({
    timestamp:
      new Date(
        point.timestamp
      ).toISOString(),
    open:
      point.value,
    high:
      point.value,
    low:
      point.value,
    close:
      point.value,
    volume:
      getNearestSeriesValue(
        volumes,
        point.timestamp
      )
  }))
}

const canUseStaleCache = (
  error: unknown
) =>
  error instanceof
    MaCarteiraNativePricesError &&
  (
    error.status === 429 ||
    error.status >= 500
  )

const fetchMarketChart =
  async (
    request:
      NativePriceRequest
  ): Promise<
    MaCarteiraPriceHistory
  > => {
    const apiKey =
      getCoinGeckoDemoApiKey()

    if (!apiKey) {
      throw new MaCarteiraNativePricesError(
        'A chave da API CoinGecko Demo não está disponível no Worker.',
        500
      )
    }

    const config =
      PERIOD_CONFIG[
        request.period
      ]

    const endpoint =
      new URL(
        `${COINGECKO_API}/coins/${encodeURIComponent(
          request.coinGeckoId
        )}/market_chart`
      )

    endpoint.searchParams.set(
      'vs_currency',
      'usd'
    )

    endpoint.searchParams.set(
      'days',
      config.days
    )

    endpoint.searchParams.set(
      'precision',
      'full'
    )

    if (config.interval) {
      endpoint.searchParams.set(
        'interval',
        config.interval
      )
    }

    const responseData =
      await runQueuedRequest(
        async () => {
          const controller =
            new AbortController()

          const timer =
            setTimeout(
              () =>
                controller.abort(),
              REQUEST_TIMEOUT_MS
            )

          try {
            const response =
              await fetch(
                endpoint.toString(),
                {
                  headers: {
                    Accept:
                      'application/json',
                    'x-cg-demo-api-key':
                      apiKey
                  },
                  signal:
                    controller.signal
                }
              )

            if (
              response.status ===
                401 ||
              response.status ===
                403
            ) {
              throw new MaCarteiraNativePricesError(
                'A chave da API CoinGecko Demo não foi aceite. Confirme o Secret na Cloudflare.',
                502
              )
            }

            if (
              response.status ===
              404
            ) {
              throw new MaCarteiraNativePricesError(
                'Não foram encontrados dados de preço para este ativo.',
                404
              )
            }

            if (
              response.status ===
              429
            ) {
              const retryAfterMs =
                getRetryAfterMs(
                  response
                )

              cooldownUntil =
                Date.now() +
                Math.max(
                  RATE_LIMIT_COOLDOWN_MS,
                  retryAfterMs
                )

              throw new MaCarteiraNativePricesError(
                'O serviço de preços atingiu temporariamente o limite de pedidos. Tente novamente dentro de alguns segundos.',
                429
              )
            }

            if (
              !response.ok
            ) {
              throw new MaCarteiraNativePricesError(
                'O serviço de preços não respondeu corretamente.',
                502
              )
            }

            try {
              return await response.json()
            } catch {
              throw new MaCarteiraNativePricesError(
                'O serviço de preços devolveu uma resposta inválida.',
                502
              )
            }
          } catch (error) {
            if (
              error instanceof
              MaCarteiraNativePricesError
            ) {
              throw error
            }

            if (
              error instanceof
                Error &&
              error.name ===
                'AbortError'
            ) {
              throw new MaCarteiraNativePricesError(
                'O serviço de preços demorou demasiado tempo a responder.',
                504
              )
            }

            throw new MaCarteiraNativePricesError(
              'Não foi possível comunicar com o serviço de preços.',
              502
            )
          } finally {
            clearTimeout(
              timer
            )
          }
        }
      )

    if (
      !isRecord(
        responseData
      )
    ) {
      throw new MaCarteiraNativePricesError(
        'O serviço de preços devolveu uma resposta inválida.',
        502
      )
    }

    const prices =
      parseSeries(
        responseData.prices
      )

    const volumes =
      parseSeries(
        responseData
          .total_volumes
      )

    const points =
      buildPricePoints(
        prices,
        volumes,
        config.windowMs
      )

    if (
      points.length < 2
    ) {
      throw new MaCarteiraNativePricesError(
        'Ainda não existem dados históricos de preço suficientes para este ativo.',
        404
      )
    }

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
          ) * 100
        : 0

    const latestVolume =
      points[
        points.length - 1
      ].volume

    return {
      chainId:
        request.chainId,
      networkId:
        request.networkId,
      contractAddress:
        request.contractAddress,
      symbol:
        request.symbol,
      name:
        request.name,
      period:
        request.period,
      poolAddress:
        request.coinGeckoId,
      poolName:
        'Mercado CoinGecko',
      currentPriceUsd:
        currentPrice,
      changePercentage,
      highUsd:
        Math.max(
          ...points.map(
            (point) =>
              point.high
          )
        ),
      lowUsd:
        Math.min(
          ...points.map(
            (point) =>
              point.low
          )
        ),
      volumeUsd:
        Number.isFinite(
          latestVolume
        )
          ? latestVolume
          : 0,
      liquidityUsd: 0,
      fetchedAt:
        new Date()
          .toISOString(),
      points
    }
  }

export async function getMaCarteiraNativePriceHistory(
  request:
    NativePriceRequest
): Promise<
  MaCarteiraPriceHistory
> {
  const coinGeckoId =
    request
      .coinGeckoId
      .trim()

  if (!coinGeckoId) {
    throw new MaCarteiraNativePricesError(
      'O identificador CoinGecko deste ativo não está configurado.',
      501
    )
  }

  const normalizedRequest:
    NativePriceRequest = {
    ...request,
    coinGeckoId,
    contractAddress:
      request
        .contractAddress
        .trim() ||
      `native:${request.chainId}`,
    symbol:
      request
        .symbol
        .trim() ||
      'COIN',
    name:
      request
        .name
        .trim() ||
      request
        .symbol
        .trim() ||
      'Ativo nativo'
  }

  const config =
    PERIOD_CONFIG[
      normalizedRequest.period
    ]

  const cacheKey =
    createCacheKey(
      normalizedRequest
    )

  const storedCache =
    await readCacheEntry(
      cacheKey
    )

  const cached =
    storedCache &&
    Date.now() -
      storedCache.cachedAt <=
      CACHE_RETENTION_SECONDS *
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
    cooldownUntil >
    Date.now()
  ) {
    if (cached) {
      return cached.value
    }

    throw new MaCarteiraNativePricesError(
      'O serviço de preços está temporariamente a recuperar. Tente novamente dentro de alguns segundos.',
      429
    )
  }

  const inFlight =
    requestsInFlight.get(
      cacheKey
    )

  if (inFlight) {
    return inFlight
  }

  const requestPromise =
    (async () => {
      try {
        const value =
          await fetchMarketChart(
            normalizedRequest
          )

        await writeCacheEntry(
          cacheKey,
          {
            cachedAt:
              Date.now(),
            value
          }
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
    })()

  requestsInFlight.set(
    cacheKey,
    requestPromise
  )

  try {
    return await requestPromise
  } finally {
    if (
      requestsInFlight.get(
        cacheKey
      ) ===
      requestPromise
    ) {
      requestsInFlight.delete(
        cacheKey
      )
    }
  }
}
