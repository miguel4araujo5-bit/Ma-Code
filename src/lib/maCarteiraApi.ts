import {
  DEFAULT_CHAIN_ID,
  isSupportedChainId,
  isValidChainAddress,
  normalizeChainAddress,
  type ChainId
} from './maCarteiraChains'

export const MA_CARTEIRA_WALLET_API =
  '/api/ma-carteira/wallet'

export const MA_CARTEIRA_TRANSACTIONS_API =
  '/api/ma-carteira/transactions'

export const MA_CARTEIRA_PRICE_HISTORY_API =
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

export type TransactionKind =
  | 'native'
  | 'token'
  | 'swap'
  | 'contract'

export type TransactionDirection =
  | 'in'
  | 'out'
  | 'self'

export type TransactionStatus =
  | 'success'
  | 'failed'
  | 'pending'

export type WalletTransaction = {
  id: string
  chainId: ChainId
  hash: string
  timestamp: string
  blockNumber: string | null
  kind: TransactionKind
  direction: TransactionDirection
  status: TransactionStatus
  from: string
  to: string | null
  method: string | null
  amountRaw: string
  decimals: number
  symbol: string
  tokenName: string | null
  tokenAddress: string | null
  feeRaw: string
}

export type WalletTransactionsResult = {
  chainId: ChainId
  address: string
  fetchedAt: string
  partial: boolean
  transactions: WalletTransaction[]
}

export type WalletPortfolioToken = {
  symbol?: string
  name?: string
  balance?: string
  decimals?: string | number
  contractAddress?: string
  address?: string
  type?: string
}

export type WalletPortfolioResult = {
  chainId: ChainId
  address: string
  nativeBalance: string
  tokens: WalletPortfolioToken[]
  fetchedAt: string
  partial: boolean
  notice: string | null
}

export type TokenPricePoint = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type TokenPriceHistory = {
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
  points: TokenPricePoint[]
}

export type ApiRequestOptions = {
  signal?: AbortSignal
  timeoutMs?: number
}

export type WalletRequestOptions =
  ApiRequestOptions & {
    chainId?: ChainId
  }

export type TransactionsRequestOptions =
  ApiRequestOptions & {
    chainId?: ChainId
    limit?: number
  }

export type PriceHistoryRequestOptions =
  ApiRequestOptions & {
    chainId?: ChainId
    period?: PricePeriod
  }

type UnknownRecord =
  Record<string, unknown>

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_TRANSACTION_LIMIT = 100
const MIN_TRANSACTION_LIMIT = 10
const MAX_TRANSACTION_LIMIT = 150

export class MaCarteiraApiError
  extends Error {
  status: number

  constructor(
    message: string,
    status = 500
  ) {
    super(message)

    this.name =
      'MaCarteiraApiError'

    this.status = status
  }
}

const isRecord = (
  value: unknown
): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)

const toStringValue = (
  value: unknown
) =>
  typeof value === 'string'
    ? value
    : ''

const readErrorMessage = (
  value: unknown,
  fallback: string
) => {
  if (!isRecord(value)) {
    return fallback
  }

  const message =
    toStringValue(
      value.message
    ).trim()

  return message || fallback
}

const getSafeTransactionLimit = (
  value: number | undefined
) => {
  if (
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return DEFAULT_TRANSACTION_LIMIT
  }

  return Math.max(
    MIN_TRANSACTION_LIMIT,
    Math.min(
      MAX_TRANSACTION_LIMIT,
      Math.trunc(value)
    )
  )
}

const isPricePeriod = (
  value: unknown
): value is PricePeriod =>
  typeof value === 'string' &&
  PRICE_PERIODS.includes(
    value as PricePeriod
  )

const requestJson = async (
  url: string,
  fallbackMessage: string,
  options: ApiRequestOptions = {}
): Promise<unknown> => {
  const controller =
    new AbortController()

  const timeoutMs =
    options.timeoutMs &&
    Number.isFinite(
      options.timeoutMs
    )
      ? Math.max(
          1000,
          Math.trunc(
            options.timeoutMs
          )
        )
      : DEFAULT_TIMEOUT_MS

  const handleExternalAbort = () =>
    controller.abort()

  if (options.signal) {
    if (
      options.signal.aborted
    ) {
      controller.abort()
    } else {
      options.signal.addEventListener(
        'abort',
        handleExternalAbort,
        {
          once: true
        }
      )
    }
  }

  const timer =
    window.setTimeout(
      () =>
        controller.abort(),
      timeoutMs
    )

  try {
    const response =
      await fetch(
        url,
        {
          method: 'GET',
          headers: {
            Accept:
              'application/json'
          },
          signal:
            controller.signal
        }
      )

    let body: unknown = null

    try {
      body =
        await response.json()
    } catch {
      throw new MaCarteiraApiError(
        'O servidor devolveu uma resposta inválida.',
        502
      )
    }

    if (!response.ok) {
      throw new MaCarteiraApiError(
        readErrorMessage(
          body,
          fallbackMessage
        ),
        response.status
      )
    }

    if (
      !isRecord(body) ||
      body.success !== true
    ) {
      throw new MaCarteiraApiError(
        readErrorMessage(
          body,
          fallbackMessage
        ),
        502
      )
    }

    return body
  } catch (error) {
    if (
      error instanceof
      MaCarteiraApiError
    ) {
      throw error
    }

    if (
      error instanceof DOMException &&
      error.name ===
        'AbortError'
    ) {
      if (
        options.signal
          ?.aborted
      ) {
        throw new MaCarteiraApiError(
          'O pedido foi cancelado.',
          499
        )
      }

      throw new MaCarteiraApiError(
        'O pedido demorou demasiado tempo a responder.',
        504
      )
    }

    throw new MaCarteiraApiError(
      fallbackMessage,
      502
    )
  } finally {
    window.clearTimeout(timer)

    options.signal
      ?.removeEventListener(
        'abort',
        handleExternalAbort
      )
  }
}

const parseChainId = (
  value: unknown,
  fallback: ChainId
): ChainId => {
  if (
    typeof value === 'string' &&
    isSupportedChainId(value)
  ) {
    return value
  }

  return fallback
}

const parseTransactions = (
  value: unknown,
  fallbackChainId: ChainId
): WalletTransaction[] => {
  if (!Array.isArray(value)) {
    throw new MaCarteiraApiError(
      'O histórico de transações devolveu um formato inválido.',
      502
    )
  }

  return value.flatMap(
    (
      item
    ): WalletTransaction[] => {
      if (
        !isRecord(item) ||
        typeof item.id !==
          'string' ||
        typeof item.hash !==
          'string' ||
        typeof item.timestamp !==
          'string'
      ) {
        return []
      }

      const kind =
        item.kind

      const direction =
        item.direction

      const status =
        item.status

      if (
        kind !== 'native' &&
        kind !== 'token' &&
        kind !== 'swap' &&
        kind !== 'contract'
      ) {
        return []
      }

      if (
        direction !== 'in' &&
        direction !== 'out' &&
        direction !== 'self'
      ) {
        return []
      }

      if (
        status !== 'success' &&
        status !== 'failed' &&
        status !== 'pending'
      ) {
        return []
      }

      return [
        {
          id: item.id,
          chainId:
            parseChainId(
              item.chainId,
              fallbackChainId
            ),
          hash:
            item.hash,
          timestamp:
            item.timestamp,
          blockNumber:
            typeof item.blockNumber ===
              'string'
              ? item.blockNumber
              : null,
          kind,
          direction,
          status,
          from:
            toStringValue(
              item.from
            ),
          to:
            typeof item.to ===
              'string'
              ? item.to
              : null,
          method:
            typeof item.method ===
              'string'
              ? item.method
              : null,
          amountRaw:
            toStringValue(
              item.amountRaw
            ) || '0',
          decimals:
            Number.isFinite(
              Number(
                item.decimals
              )
            )
              ? Math.max(
                  0,
                  Math.trunc(
                    Number(
                      item.decimals
                    )
                  )
                )
              : 18,
          symbol:
            toStringValue(
              item.symbol
            ) || 'TOKEN',
          tokenName:
            typeof item.tokenName ===
              'string'
              ? item.tokenName
              : null,
          tokenAddress:
            typeof item.tokenAddress ===
              'string'
              ? item.tokenAddress
              : null,
          feeRaw:
            toStringValue(
              item.feeRaw
            ) || '0'
        }
      ]
    }
  )
}

const parsePricePoints = (
  value: unknown
): TokenPricePoint[] => {
  if (!Array.isArray(value)) {
    throw new MaCarteiraApiError(
      'O histórico de preço devolveu um formato inválido.',
      502
    )
  }

  return value.flatMap(
    (
      item
    ): TokenPricePoint[] => {
      if (
        !isRecord(item) ||
        typeof item.timestamp !==
          'string'
      ) {
        return []
      }

      const open =
        Number(item.open)

      const high =
        Number(item.high)

      const low =
        Number(item.low)

      const close =
        Number(item.close)

      const volume =
        Number(item.volume)

      if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        return []
      }

      return [
        {
          timestamp:
            item.timestamp,
          open,
          high,
          low,
          close,
          volume:
            Number.isFinite(volume)
              ? volume
              : 0
        }
      ]
    }
  )
}

const parseWalletTokens = (
  value: unknown
): WalletPortfolioToken[] => {
  if (!Array.isArray(value)) {
    throw new MaCarteiraApiError(
      'A carteira devolveu uma lista de tokens inválida.',
      502
    )
  }

  return value.flatMap(
    (
      item
    ): WalletPortfolioToken[] => {
      if (!isRecord(item)) {
        return []
      }

      return [
        {
          symbol:
            typeof item.symbol ===
              'string'
              ? item.symbol
              : undefined,
          name:
            typeof item.name ===
              'string'
              ? item.name
              : undefined,
          balance:
            typeof item.balance ===
              'string'
              ? item.balance
              : undefined,
          decimals:
            typeof item.decimals ===
              'string' ||
            typeof item.decimals ===
              'number'
              ? item.decimals
              : undefined,
          contractAddress:
            typeof item.contractAddress ===
              'string'
              ? item.contractAddress
              : undefined,
          address:
            typeof item.address ===
              'string'
              ? item.address
              : undefined,
          type:
            typeof item.type ===
              'string'
              ? item.type
              : undefined
        }
      ]
    }
  )
}

export async function fetchWalletPortfolio(
  address: string,
  options: WalletRequestOptions = {}
): Promise<WalletPortfolioResult> {
  const chainId =
    options.chainId ||
    DEFAULT_CHAIN_ID

  const normalizedAddress =
    normalizeChainAddress(
      address,
      chainId
    )

  if (
    !isValidChainAddress(
      normalizedAddress,
      chainId
    )
  ) {
    throw new MaCarteiraApiError(
      'O endereço indicado não é válido para a rede selecionada.',
      400
    )
  }

  const parameters =
    new URLSearchParams({
      chainId,
      address:
        normalizedAddress
    })

  const body =
    await requestJson(
      `${MA_CARTEIRA_WALLET_API}?${parameters.toString()}`,
      'Não foi possível consultar os saldos deste endereço.',
      options
    )

  if (!isRecord(body)) {
    throw new MaCarteiraApiError(
      'A carteira devolveu um formato inválido.',
      502
    )
  }

  return {
    chainId:
      parseChainId(
        body.chainId,
        chainId
      ),
    address:
      toStringValue(
        body.address
      ) ||
      normalizedAddress,
    nativeBalance:
      toStringValue(
        body.nativeBalance
      ) || '0',
    tokens:
      parseWalletTokens(
        body.tokens
      ),
    fetchedAt:
      toStringValue(
        body.fetchedAt
      ) ||
      new Date().toISOString(),
    partial:
      body.partial === true,
    notice:
      typeof body.notice ===
        'string' &&
      body.notice.trim()
        ? body.notice.trim()
        : null
  }
}

export async function fetchWalletTransactions(
  address: string,
  options: TransactionsRequestOptions = {}
): Promise<WalletTransactionsResult> {
  const chainId =
    options.chainId ||
    DEFAULT_CHAIN_ID

  const normalizedAddress =
    normalizeChainAddress(
      address,
      chainId
    )

  if (
    !isValidChainAddress(
      normalizedAddress,
      chainId
    )
  ) {
    throw new MaCarteiraApiError(
      'O endereço indicado não é válido para a rede selecionada.',
      400
    )
  }

  const limit =
    getSafeTransactionLimit(
      options.limit
    )

  const parameters =
    new URLSearchParams({
      chainId,
      address:
        normalizedAddress,
      limit:
        String(limit)
    })

  const body =
    await requestJson(
      `${MA_CARTEIRA_TRANSACTIONS_API}?${parameters.toString()}`,
      'Não foi possível consultar o histórico de transações.',
      options
    )

  if (!isRecord(body)) {
    throw new MaCarteiraApiError(
      'O histórico de transações devolveu um formato inválido.',
      502
    )
  }

  return {
    chainId:
      parseChainId(
        body.chainId,
        chainId
      ),
    address:
      toStringValue(
        body.address
      ) ||
      normalizedAddress,
    fetchedAt:
      toStringValue(
        body.fetchedAt
      ) ||
      new Date().toISOString(),
    partial:
      body.partial === true,
    transactions:
      parseTransactions(
        body.transactions,
        chainId
      )
  }
}

export async function fetchTokenPriceHistory(
  contractAddress: string,
  options: PriceHistoryRequestOptions = {}
): Promise<TokenPriceHistory> {
  const chainId =
    options.chainId ||
    DEFAULT_CHAIN_ID

  const nativePriceReference =
    `native:${chainId}`

  const isNativePriceRequest =
    contractAddress
      .trim()
      .toLowerCase() ===
    nativePriceReference

  const normalizedContract =
    isNativePriceRequest
      ? nativePriceReference
      : normalizeChainAddress(
          contractAddress,
          chainId
        )

  if (
    !isNativePriceRequest &&
    !/^0x[a-fA-F0-9]{40}$/.test(
      normalizedContract
    )
  ) {
    throw new MaCarteiraApiError(
      'O identificador do ativo não é válido.',
      400
    )
  }

  const period =
    options.period ||
    '1D'

  if (
    !isPricePeriod(period)
  ) {
    throw new MaCarteiraApiError(
      'O período selecionado não é válido.',
      400
    )
  }

  const parameters =
    new URLSearchParams({
      chainId,
      contract:
        normalizedContract,
      period
    })

  const body =
    await requestJson(
      `${MA_CARTEIRA_PRICE_HISTORY_API}?${parameters.toString()}`,
      'Não foi possível consultar o histórico de preço.',
      options
    )

  if (!isRecord(body)) {
    throw new MaCarteiraApiError(
      'O histórico de preço devolveu um formato inválido.',
      502
    )
  }

  const responsePeriod =
    isPricePeriod(
      body.period
    )
      ? body.period
      : period

  return {
    chainId:
      parseChainId(
        body.chainId,
        chainId
      ),
    networkId:
      toStringValue(
        body.networkId
      ),
    contractAddress:
      toStringValue(
        body.contractAddress
      ) ||
      normalizedContract,
    symbol:
      toStringValue(
        body.symbol
      ) ||
      'TOKEN',
    name:
      toStringValue(
        body.name
      ) ||
      'Token',
    period:
      responsePeriod,
    poolAddress:
      toStringValue(
        body.poolAddress
      ),
    poolName:
      toStringValue(
        body.poolName
      ) ||
      'Pool',
    currentPriceUsd:
      Number(
        body.currentPriceUsd
      ) || 0,
    changePercentage:
      Number(
        body.changePercentage
      ) || 0,
    highUsd:
      Number(
        body.highUsd
      ) || 0,
    lowUsd:
      Number(
        body.lowUsd
      ) || 0,
    volumeUsd:
      Number(
        body.volumeUsd
      ) || 0,
    liquidityUsd:
      Number(
        body.liquidityUsd
      ) || 0,
    fetchedAt:
      toStringValue(
        body.fetchedAt
      ) ||
      new Date().toISOString(),
    points:
      parsePricePoints(
        body.points
      )
  }
}
