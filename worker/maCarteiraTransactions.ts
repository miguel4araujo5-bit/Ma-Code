import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  isSupportedChainId,
  type ChainId,
  type ExplorerApiFamily
} from '../src/lib/maCarteiraChains'

export const MA_CARTEIRA_TRANSACTIONS_PATH = '/api/ma-carteira/transactions'

export type TransactionKind = 'native' | 'token' | 'swap' | 'contract'
export type TransactionDirection = 'in' | 'out' | 'self'
export type TransactionStatus = 'success' | 'failed' | 'pending'

export type MaCarteiraTransaction = {
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

export type MaCarteiraTransactionsResult = {
  chainId: ChainId
  address: string
  fetchedAt: string
  partial: boolean
  transactions: MaCarteiraTransaction[]
}

type UnknownRecord = Record<string, unknown>

type ExplorerResponse = {
  message?: unknown
  result?: unknown
}

type ExplorerResult = {
  ok: boolean
  items: unknown[]
}

type ExplorerAction = 'txlist' | 'tokentx' | 'txlistinternal'

const REQUEST_TIMEOUT_MS = 15_000
const DEFAULT_LIMIT = 100
const MIN_LIMIT = 10
const MAX_LIMIT = 150

export class MaCarteiraTransactionsError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'MaCarteiraTransactionsError'
    this.status = status
  }
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asRecord = (value: unknown) => (isRecord(value) ? value : null)

const toStringValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }

  return ''
}

const readString = (record: UnknownRecord | null, key: string) =>
  record ? toStringValue(record[key]).trim() : ''

const normalizeAddress = (value: string) => {
  const clean = value.trim()

  if (!clean) {
    return ''
  }

  return clean.toLowerCase().startsWith('0x')
    ? `0x${clean.slice(2)}`
    : `0x${clean}`
}

const isValidAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value)

const getAddressValue = (value: unknown) => {
  if (typeof value === 'string') {
    return value
  }

  const record = asRecord(value)

  return (
    readString(record, 'hash') ||
    readString(record, 'address_hash') ||
    readString(record, 'address')
  )
}

const normalizeTimestamp = (value: unknown) => {
  const raw = toStringValue(value).trim()

  if (!raw) {
    return new Date(0).toISOString()
  }

  const date = /^\d+$/.test(raw)
    ? new Date(Number(raw) * (raw.length <= 10 ? 1000 : 1))
    : new Date(raw)

  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString()
}

const getDirection = (
  walletAddress: string,
  from: string,
  to: string | null
): TransactionDirection => {
  const wallet = walletAddress.toLowerCase()
  const normalizedFrom = from.toLowerCase()
  const normalizedTo = (to || '').toLowerCase()

  if (normalizedFrom === wallet && normalizedTo === wallet) {
    return 'self'
  }

  if (normalizedFrom === wallet) {
    return 'out'
  }

  if (normalizedTo === wallet) {
    return 'in'
  }

  return 'self'
}

const isAddressInTransaction = (
  walletAddress: string,
  from: string,
  to: string | null
) => {
  const wallet = walletAddress.toLowerCase()

  return from.toLowerCase() === wallet || (to || '').toLowerCase() === wallet
}

const getStatus = (item: UnknownRecord): TransactionStatus => {
  const receiptStatus = readString(item, 'txreceipt_status')
  const isError = readString(item, 'isError')
  const status = readString(item, 'status').toLowerCase()
  const errorCode = readString(item, 'errCode') || readString(item, 'error')

  if (
    receiptStatus === '0' ||
    isError === '1' ||
    status === 'error' ||
    status === 'failed' ||
    (Boolean(errorCode) && errorCode !== '0')
  ) {
    return 'failed'
  }

  if (
    receiptStatus === '1' ||
    isError === '0' ||
    status === 'ok' ||
    status === 'success'
  ) {
    return 'success'
  }

  return 'pending'
}

const getFeeRaw = (item: UnknownRecord) => {
  const fee = asRecord(item.fee)
  const directFee = readString(fee, 'value') || readString(item, 'transaction_fee')

  if (directFee) {
    return directFee
  }

  try {
    const gasUsed = BigInt(
      readString(item, 'gasUsed') || readString(item, 'gas_used') || '0'
    )

    const gasPrice = BigInt(
      readString(item, 'gasPrice') || readString(item, 'gas_price') || '0'
    )

    return (gasUsed * gasPrice).toString()
  } catch {
    return '0'
  }
}

const getMethod = (item: UnknownRecord) => {
  const method =
    readString(item, 'functionName') ||
    readString(item, 'method') ||
    readString(item, 'methodId')

  if (method) {
    return method
  }

  const input = readString(item, 'input')

  return input && input !== '0x' ? 'Interação com contrato' : null
}

const getLimit = (value: string | null) => {
  const parsed = Number(value || DEFAULT_LIMIT)

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT
  }

  return Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, Math.trunc(parsed)))
}

const supportsAccountApi = (family: ExplorerApiFamily) =>
  family === 'blockscout-legacy' || family === 'etherscan-compatible'

const buildExplorerUrl = (
  apiUrl: string,
  action: ExplorerAction,
  address: string,
  limit: number
) => {
  const url = new URL(apiUrl)

  url.searchParams.set('module', 'account')
  url.searchParams.set('action', action)
  url.searchParams.set('address', address)
  url.searchParams.set('page', '1')
  url.searchParams.set('offset', String(limit))
  url.searchParams.set('sort', 'desc')

  if (action === 'txlistinternal') {
    url.searchParams.set('include_zero_value', 'false')
  }

  return url.toString()
}

const fetchExplorerItems = async (url: string): Promise<ExplorerResult> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      return {
        ok: false,
        items: []
      }
    }

    const data = (await response.json()) as ExplorerResponse

    if (Array.isArray(data.result)) {
      return {
        ok: true,
        items: data.result
      }
    }

    const message = `${toStringValue(data.message)} ${toStringValue(
      data.result
    )}`.toLowerCase()

    const empty =
      message.includes('no transactions') ||
      message.includes('no internal transactions') ||
      message.includes('no token transfers') ||
      message.includes('no records found') ||
      message.includes('no records')

    return {
      ok: empty,
      items: []
    }
  } catch {
    return {
      ok: false,
      items: []
    }
  } finally {
    clearTimeout(timer)
  }
}

const normalizeNativeTransactions = (
  items: unknown[],
  address: string,
  chainId: ChainId,
  symbol: string,
  decimals: number
): MaCarteiraTransaction[] =>
  items.flatMap((value, index) => {
    const item = asRecord(value)

    if (!item) {
      return []
    }

    const hash = readString(item, 'hash')

    if (!hash) {
      return []
    }

    const from = getAddressValue(item.from)
    const to = getAddressValue(item.to) || null

    if (!isAddressInTransaction(address, from, to)) {
      return []
    }

    const amountRaw = readString(item, 'value') || '0'

    return [
      {
        id: `${chainId}:${hash}:native:${index}`,
        chainId,
        hash,
        timestamp: normalizeTimestamp(item.timeStamp ?? item.timestamp),
        blockNumber:
          readString(item, 'blockNumber') ||
          readString(item, 'block_number') ||
          readString(item, 'block') ||
          null,
        kind: amountRaw === '0' ? 'contract' : 'native',
        direction: getDirection(address, from, to),
        status: getStatus(item),
        from,
        to,
        method: getMethod(item),
        amountRaw,
        decimals,
        symbol,
        tokenName: amountRaw === '0' ? 'Interação com contrato' : null,
        tokenAddress: null,
        feeRaw: getFeeRaw(item)
      }
    ]
  })

const normalizeTokenTransactions = (
  items: unknown[],
  address: string,
  chainId: ChainId
): MaCarteiraTransaction[] =>
  items.flatMap((value, index) => {
    const item = asRecord(value)

    if (!item) {
      return []
    }

    const hash = readString(item, 'hash') || readString(item, 'transaction_hash')

    if (!hash) {
      return []
    }

    const token = asRecord(item.token)
    const total = asRecord(item.total)
    const from = getAddressValue(item.from)
    const to = getAddressValue(item.to) || null

    if (!isAddressInTransaction(address, from, to)) {
      return []
    }

    const tokenAddress =
      readString(item, 'contractAddress') ||
      readString(token, 'address_hash') ||
      readString(token, 'address') ||
      null

    const amountRaw =
      readString(item, 'value') || readString(total, 'value') || '0'

    const rawDecimals =
      readString(item, 'tokenDecimal') ||
      readString(item, 'decimals') ||
      readString(total, 'decimals') ||
      readString(token, 'decimals') ||
      '18'

    const parsedDecimals = Number(rawDecimals)

    const decimals = Number.isFinite(parsedDecimals)
      ? Math.max(0, Math.trunc(parsedDecimals))
      : 18

    const status = getStatus(item)

    const logIndex =
      readString(item, 'logIndex') ||
      readString(item, 'log_index') ||
      readString(item, 'transactionIndex') ||
      String(index)

    return [
      {
        id: `${chainId}:${hash}:token:${logIndex}:${tokenAddress || 'unknown'}`,
        chainId,
        hash,
        timestamp: normalizeTimestamp(item.timeStamp ?? item.timestamp),
        blockNumber:
          readString(item, 'blockNumber') ||
          readString(item, 'block_number') ||
          readString(item, 'block') ||
          null,
        kind: 'token',
        direction: getDirection(address, from, to),
        status: status === 'pending' ? 'success' : status,
        from,
        to,
        method: getMethod(item),
        amountRaw,
        decimals,
        symbol:
          readString(item, 'tokenSymbol') ||
          readString(token, 'symbol') ||
          'TOKEN',
        tokenName:
          readString(item, 'tokenName') || readString(token, 'name') || null,
        tokenAddress,
        feeRaw: getFeeRaw(item)
      }
    ]
  })

const normalizeInternalTransactions = (
  items: unknown[],
  address: string,
  chainId: ChainId,
  symbol: string,
  decimals: number
): MaCarteiraTransaction[] =>
  items.flatMap((value, index) => {
    const item = asRecord(value)

    if (!item) {
      return []
    }

    const hash =
      readString(item, 'hash') ||
      readString(item, 'transactionHash') ||
      readString(item, 'transaction_hash')

    if (!hash) {
      return []
    }

    const from = getAddressValue(item.from)

    const to =
      getAddressValue(item.to) || readString(item, 'contractAddress') || null

    if (!isAddressInTransaction(address, from, to)) {
      return []
    }

    const amountRaw = readString(item, 'value') || '0'

    if (amountRaw === '0') {
      return []
    }

    const traceId =
      readString(item, 'traceId') ||
      readString(item, 'trace_id') ||
      readString(item, 'index') ||
      String(index)

    const detectedStatus = getStatus(item)

    return [
      {
        id: `${chainId}:${hash}:internal:${traceId}:${from.toLowerCase()}:${(
          to || 'contract-creation'
        ).toLowerCase()}`,
        chainId,
        hash,
        timestamp: normalizeTimestamp(item.timeStamp ?? item.timestamp),
        blockNumber:
          readString(item, 'blockNumber') ||
          readString(item, 'block_number') ||
          readString(item, 'block') ||
          null,
        kind: 'native',
        direction: getDirection(address, from, to),
        status: detectedStatus === 'pending' ? 'success' : detectedStatus,
        from,
        to,
        method: null,
        amountRaw,
        decimals,
        symbol,
        tokenName: null,
        tokenAddress: null,
        feeRaw: '0'
      }
    ]
  })

const deduplicateTransactions = (transactions: MaCarteiraTransaction[]) =>
  Array.from(
    new Map(
      transactions.map((transaction) => [transaction.id, transaction])
    ).values()
  )

const finalizeTransactions = (
  transactions: MaCarteiraTransaction[],
  limit: number
) => {
  const deduplicated = deduplicateTransactions(transactions)

  const directionsByHash = new Map<string, Set<TransactionDirection>>()

  deduplicated.forEach((transaction) => {
    if (
      transaction.kind === 'contract' ||
      transaction.status === 'failed' ||
      transaction.amountRaw === '0'
    ) {
      return
    }

    const hash = transaction.hash.toLowerCase()

    const directions =
      directionsByHash.get(hash) || new Set<TransactionDirection>()

    directions.add(transaction.direction)
    directionsByHash.set(hash, directions)
  })

  const sorted = deduplicated
    .map((transaction) => {
      if (transaction.kind === 'contract') {
        return transaction
      }

      const directions = directionsByHash.get(transaction.hash.toLowerCase())

      return directions?.has('in') && directions.has('out')
        ? {
            ...transaction,
            kind: 'swap' as const
          }
        : transaction
    })
    .sort((first, second) => {
      const byDate =
        new Date(second.timestamp).getTime() -
        new Date(first.timestamp).getTime()

      return byDate || second.id.localeCompare(first.id)
    })

  const selectedHashes = new Set<string>()

  sorted.forEach((transaction) => {
    const hash = transaction.hash.toLowerCase()

    if (selectedHashes.has(hash) || selectedHashes.size >= limit) {
      return
    }

    selectedHashes.add(hash)
  })

  return sorted.filter((transaction) =>
    selectedHashes.has(transaction.hash.toLowerCase())
  )
}

const getRequestedChainId = (url: URL): ChainId => {
  const requested = (
    url.searchParams.get('chainId') || DEFAULT_CHAIN_ID
  ).trim()

  if (!isSupportedChainId(requested)) {
    throw new MaCarteiraTransactionsError(
      'A rede indicada ainda não é suportada.',
      400
    )
  }

  return requested
}

export async function getMaCarteiraTransactions(
  url: URL
): Promise<MaCarteiraTransactionsResult> {
  const chainId = getRequestedChainId(url)
  const chain = getChainConfig(chainId)
  const address = normalizeAddress(url.searchParams.get('address') || '')
  const limit = getLimit(url.searchParams.get('limit'))

  if (chain.status !== 'active') {
    throw new MaCarteiraTransactionsError(
      `${chain.name} ainda não está ativa na MA-Carteira.`,
      409
    )
  }

  if (!isValidAddress(address)) {
    throw new MaCarteiraTransactionsError(
      'Indique um endereço público válido.',
      400
    )
  }

  if (!supportsAccountApi(chain.explorer.apiFamily)) {
    throw new MaCarteiraTransactionsError(
      `O histórico de transações ainda não está configurado para ${chain.name}.`,
      501
    )
  }

  const [nativeResult, tokenResult, internalResult] = await Promise.all([
    fetchExplorerItems(
      buildExplorerUrl(chain.explorer.apiUrl, 'txlist', address, limit)
    ),
    fetchExplorerItems(
      buildExplorerUrl(chain.explorer.apiUrl, 'tokentx', address, limit)
    ),
    fetchExplorerItems(
      buildExplorerUrl(chain.explorer.apiUrl, 'txlistinternal', address, limit)
    )
  ])

  if (!nativeResult.ok && !tokenResult.ok && !internalResult.ok) {
    throw new MaCarteiraTransactionsError(
      `Não foi possível consultar as transações em ${chain.name}.`,
      502
    )
  }

  const transactions = finalizeTransactions(
    [
      ...normalizeNativeTransactions(
        nativeResult.items,
        address,
        chainId,
        chain.nativeCurrency.symbol,
        chain.nativeCurrency.decimals
      ),
      ...normalizeTokenTransactions(tokenResult.items, address, chainId),
      ...normalizeInternalTransactions(
        internalResult.items,
        address,
        chainId,
        chain.nativeCurrency.symbol,
        chain.nativeCurrency.decimals
      )
    ],
    limit
  )

  return {
    chainId,
    address,
    fetchedAt: new Date().toISOString(),
    partial: !nativeResult.ok || !tokenResult.ok || !internalResult.ok,
    transactions
  }
}
