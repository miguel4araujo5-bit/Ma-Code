import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  isSupportedChainId,
  type ChainId
} from '../src/lib/maCarteiraChains'

export const MA_CARTEIRA_PRICES_PATH =
  '/api/ma-carteira/token-price-history'

export const PRICE_PERIODS = [
  '24H',
  '7D',
  '30D',
  '90D',
  '1A'
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
  timeframe: 'hour' | 'day'
  aggregate: 1 | 4
  limit: number
}

type PoolSelection = {
  pool: UnknownRecord
  tokenSide: 'base' | 'quote'
  poolAddress: string
}

type OhlcvResult = {
  points: MaCarteiraPricePoint[]
  baseAddress: string
  quoteAddress: string
}

const GECKOTERMINAL_API =
  'https://api.geckoterminal.com/api/v2'

const GECKOTERMINAL_VERSION =
  '20230203'

const REQUEST_TIMEOUT_MS =
  15_000

const PERIOD_CONFIG: Record<
  PricePeriod,
  PeriodConfig
> = {
  '24H': {
    timeframe: 'hour',
    aggregate: 1,
    limit: 24
  },

  '7D': {
    timeframe: 'hour',
    aggregate: 4,
    limit: 42
  },

  '30D': {
    timeframe: 'day',
    aggregate: 1,
    limit: 30
  },

  '90D': {
    timeframe: 'day',
    aggregate: 1,
    limit: 90
  },

  '1A': {
    timeframe: 'day',
    aggregate: 1,
    limit: 365
  }
}

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
  const requested = (
    url.searchParams.get(
      'period'
    ) ||
    '7D'
  ).toUpperCase()

  if (
    !PRICE_PERIODS.includes(
      requested as PricePeriod
    )
  ) {
    throw new MaCarteiraPricesError(
      'O período indicado não é válido.',
      400
    )
  }

  return requested as PricePeriod
}

const fetchJson = async (
  url: string
): Promise<unknown> => {
  const controller =
    new AbortController()

  const timer = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  )

  try {
    const response = await fetch(
      url,
      {
        headers: {
          Accept:
            `application/json;version=${GECKOTERMINAL_VERSION}`
        },

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
      response.status === 429
    ) {
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
      const ohlcvUrl =
        new URL(
          `${GECKOTERMINAL_API}/networks/${encodeURIComponent(
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

      const response =
        await fetchJson(
          ohlcvUrl.toString()
        )

      const normalized =
        normalizePricePoints(
          response
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
        return normalized
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

  const poolsUrl =
    new URL(
      `${GECKOTERMINAL_API}/networks/${encodeURIComponent(
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
      poolsUrl.toString()
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

  const config =
    PERIOD_CONFIG[
      period
    ]

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
      poolsResponse || {},
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

  return {
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
}
