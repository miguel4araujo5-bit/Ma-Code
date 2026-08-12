import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  isSupportedChainId,
  isValidChainAddress,
  normalizeChainAddress,
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

  return Number.isNaN(date.getTime())
    ? new Date(0).toISOString()
    : date.toISOString()
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
          readString(item, 'tokenName') ||
          readString(token, 'name') ||
          null,
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
      getAddressValue(item.to) ||
      readString(item, 'contractAddress') ||
      null

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

      const directions =
        directionsByHash.get(transaction.hash.toLowerCase())

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

const requestJson = async (
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<unknown> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {})
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new MaCarteiraTransactionsError(
        fallbackMessage,
        response.status
      )
    }

    return await response.json()
  } catch (error) {
    if (error instanceof MaCarteiraTransactionsError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new MaCarteiraTransactionsError(
        'O fornecedor de dados demorou demasiado tempo a responder.',
        504
      )
    }

    throw new MaCarteiraTransactionsError(
      fallbackMessage,
      502
    )
  } finally {
    clearTimeout(timer)
  }
}

const requestJsonRpc = async (
  rpcUrl: string,
  method: string,
  params: unknown[],
  fallbackMessage: string
) => {
  const body = asRecord(
    await requestJson(
      rpcUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `${Date.now()}-${Math.random()}`,
          method,
          params
        })
      },
      fallbackMessage
    )
  )

  if (!body || body.error !== undefined || body.result === undefined) {
    const error = asRecord(body?.error)

    throw new MaCarteiraTransactionsError(
      readString(error, 'message') || fallbackMessage,
      502
    )
  }

  return body.result
}

const requestJsonRpcBatch = async (
  rpcUrl: string,
  requests: Array<{
    id: string
    method: string
    params: unknown[]
  }>,
  fallbackMessage: string
): Promise<Map<string, unknown>> => {
  if (requests.length === 0) {
    return new Map()
  }

  const body = await requestJson(
    rpcUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        requests.map((request) => ({
          jsonrpc: '2.0',
          id: request.id,
          method: request.method,
          params: request.params
        }))
      )
    },
    fallbackMessage
  )

  if (!Array.isArray(body)) {
    throw new MaCarteiraTransactionsError(
      fallbackMessage,
      502
    )
  }

  const results = new Map<string, unknown>()

  body.forEach((value) => {
    const response = asRecord(value)
    const id = readString(response, 'id')

    if (
      !response ||
      !id ||
      response.error !== undefined ||
      response.result === undefined
    ) {
      return
    }

    results.set(
      id,
      response.result
    )
  })

  return results
}

const getBitcoinTransactions = async (
  chainId: ChainId,
  address: string,
  limit: number
): Promise<MaCarteiraTransactionsResult> => {
  const chain = getChainConfig(chainId)

  const body = await requestJson(
    `${chain.dataApiUrl.replace(/\/$/, '')}/address/${encodeURIComponent(
      address
    )}/txs`,
    {
      method: 'GET'
    },
    'Não foi possível consultar as transações Bitcoin.'
  )

  if (!Array.isArray(body)) {
    throw new MaCarteiraTransactionsError(
      'O histórico Bitcoin devolveu um formato inválido.',
      502
    )
  }

  const transactions = body.flatMap(
    (value, index): MaCarteiraTransaction[] => {
      const item = asRecord(value)
      const hash = readString(item, 'txid')

      if (!item || !hash) {
        return []
      }

      const vin = Array.isArray(item.vin)
        ? item.vin
        : []

      const vout = Array.isArray(item.vout)
        ? item.vout
        : []

      const inputAddresses = vin.flatMap((input): string[] => {
        const record = asRecord(input)
        const previousOutput = asRecord(record?.prevout)
        const inputAddress = readString(
          previousOutput,
          'scriptpubkey_address'
        )

        return inputAddress
          ? [inputAddress]
          : []
      })

      const outputAddresses = vout.flatMap((output): string[] => {
        const record = asRecord(output)
        const outputAddress = readString(
          record,
          'scriptpubkey_address'
        )

        return outputAddress
          ? [outputAddress]
          : []
      })

      const inputFromWallet = vin.reduce<bigint>((total, input) => {
        const record = asRecord(input)
        const previousOutput = asRecord(record?.prevout)

        if (
          readString(previousOutput, 'scriptpubkey_address') !==
          address
        ) {
          return total
        }

        try {
          return total + BigInt(
            readString(previousOutput, 'value') || '0'
          )
        } catch {
          return total
        }
      }, 0n)

      const outputToWallet = vout.reduce<bigint>((total, output) => {
        const record = asRecord(output)

        if (
          readString(record, 'scriptpubkey_address') !==
          address
        ) {
          return total
        }

        try {
          return total + BigInt(
            readString(record, 'value') || '0'
          )
        } catch {
          return total
        }
      }, 0n)

      const delta =
        outputToWallet -
        inputFromWallet

      const direction: TransactionDirection =
        inputFromWallet > 0n &&
        outputToWallet > 0n &&
        delta === 0n
          ? 'self'
          : delta < 0n
            ? 'out'
            : 'in'

      const statusRecord = asRecord(item.status)
      const confirmed = statusRecord?.confirmed === true
      const blockTime = readString(statusRecord, 'block_time')

      const timestamp = blockTime
        ? normalizeTimestamp(blockTime)
        : new Date().toISOString()

      const from =
        inputAddresses[0] ||
        address

      const to =
        direction === 'out'
          ? outputAddresses.find(
              (candidate) => candidate !== address
            ) || null
          : address

      let fee = 0n

      try {
        fee = BigInt(
          readString(item, 'fee') ||
          '0'
        )
      } catch {
        fee = 0n
      }

      const absoluteDelta =
        delta < 0n
          ? -delta
          : delta

      const transferredAmount =
        direction === 'out' &&
        absoluteDelta >= fee
          ? absoluteDelta - fee
          : absoluteDelta

      return [
        {
          id: `${chainId}:${hash}:native:${index}`,
          chainId,
          hash,
          timestamp,
          blockNumber:
            readString(statusRecord, 'block_height') ||
            null,
          kind: 'native',
          direction,
          status:
            confirmed
              ? 'success'
              : 'pending',
          from,
          to,
          method: null,
          amountRaw:
            transferredAmount.toString(),
          decimals:
            chain.nativeCurrency.decimals,
          symbol:
            chain.nativeCurrency.symbol,
          tokenName: null,
          tokenAddress: null,
          feeRaw:
            fee.toString()
        }
      ]
    }
  )

  return {
    chainId,
    address,
    fetchedAt:
      new Date().toISOString(),
    partial:
      body.length >= 25,
    transactions:
      finalizeTransactions(
        transactions,
        limit
      )
  }
}

const getSolanaTransactions = async (
  chainId: ChainId,
  address: string,
  limit: number
): Promise<MaCarteiraTransactionsResult> => {
  const chain =
    getChainConfig(chainId)

  const rpcUrl =
    chain.rpcUrls[0]

  if (!rpcUrl) {
    throw new MaCarteiraTransactionsError(
      'O RPC de Solana não está configurado.',
      503
    )
  }

  const safeLimit =
    Math.min(
      limit,
      35
    )

  const signaturesResult =
    await requestJsonRpc(
      rpcUrl,
      'getSignaturesForAddress',
      [
        address,
        {
          limit:
            safeLimit,
          commitment:
            'confirmed'
        }
      ],
      'Não foi possível consultar as assinaturas de Solana.'
    )

  if (
    !Array.isArray(
      signaturesResult
    )
  ) {
    throw new MaCarteiraTransactionsError(
      'O histórico Solana devolveu um formato inválido.',
      502
    )
  }

  const signatureDetails =
    signaturesResult.flatMap(
      (
        signatureItem,
        index
      ) => {
        const summary =
          asRecord(
            signatureItem
          )

        const signature =
          readString(
            summary,
            'signature'
          )

        if (
          !summary ||
          !signature
        ) {
          return []
        }

        return [
          {
            batchId:
              `solana-transaction-${index}`,
            signature,
            summary
          }
        ]
      }
    )

  let batchResults =
    new Map<
      string,
      unknown
    >()

  try {
    batchResults =
      await requestJsonRpcBatch(
        rpcUrl,
        signatureDetails.map(
          (detail) => ({
            id:
              detail.batchId,

            method:
              'getTransaction',

            params: [
              detail.signature,
              {
                commitment:
                  'confirmed',

                encoding:
                  'jsonParsed',

                maxSupportedTransactionVersion:
                  0
              }
            ]
          })
        ),
        'Não foi possível consultar o lote de transações Solana.'
      )
  } catch {
    batchResults =
      new Map()
  }

  const details =
    await Promise.all(
      signatureDetails.map(
        async (detail) => {
          if (
            batchResults.has(
              detail.batchId
            )
          ) {
            return {
              signature:
                detail.signature,

              summary:
                detail.summary,

              transaction:
                asRecord(
                  batchResults.get(
                    detail.batchId
                  )
                )
            }
          }

          try {
            const transaction =
              await requestJsonRpc(
                rpcUrl,
                'getTransaction',
                [
                  detail.signature,
                  {
                    commitment:
                      'confirmed',

                    encoding:
                      'jsonParsed',

                    maxSupportedTransactionVersion:
                      0
                  }
                ],
                'Não foi possível consultar uma transação de Solana.'
              )

            return {
              signature:
                detail.signature,

              summary:
                detail.summary,

              transaction:
                asRecord(
                  transaction
                )
            }
          } catch {
            return {
              signature:
                detail.signature,

              summary:
                detail.summary,

              transaction:
                null
            }
          }
        }
      )
    )

  const transactions =
    details.flatMap(
      (
        detail,
        index
      ): MaCarteiraTransaction[] => {
        const summary =
          detail.summary

        const transaction =
          detail.transaction

        const meta =
          asRecord(
            transaction?.meta
          )

        const transactionData =
          asRecord(
            transaction?.transaction
          )

        const message =
          asRecord(
            transactionData?.message
          )

        const accountKeys =
          Array.isArray(
            message?.accountKeys
          )
            ? message.accountKeys
            : []

        const normalizedKeys =
          accountKeys.map(
            (key) => {
              if (
                typeof key ===
                'string'
              ) {
                return {
                  pubkey:
                    key,
                  signer:
                    false
                }
              }

              const keyRecord =
                asRecord(key)

              return {
                pubkey:
                  readString(
                    keyRecord,
                    'pubkey'
                  ),

                signer:
                  keyRecord?.signer ===
                  true
              }
            }
          )

        const walletIndex =
          normalizedKeys.findIndex(
            (key) =>
              key.pubkey ===
              address
          )

        const preBalances =
          Array.isArray(
            meta?.preBalances
          )
            ? meta.preBalances
            : []

        const postBalances =
          Array.isArray(
            meta?.postBalances
          )
            ? meta.postBalances
            : []

        let preBalance =
          0n

        let postBalance =
          0n

        try {
          preBalance =
            BigInt(
              toStringValue(
                preBalances[
                  walletIndex
                ]
              ) ||
              '0'
            )

          postBalance =
            BigInt(
              toStringValue(
                postBalances[
                  walletIndex
                ]
              ) ||
              '0'
            )
        } catch {
          preBalance =
            0n

          postBalance =
            0n
        }

        let delta =
          postBalance -
          preBalance

        let fee =
          0n

        try {
          fee =
            BigInt(
              readString(
                meta,
                'fee'
              ) ||
              '0'
            )
        } catch {
          fee =
            0n
        }

        const direction: TransactionDirection =
          delta < 0n
            ? 'out'
            : delta > 0n
              ? 'in'
              : 'self'

        if (
          direction ===
            'out' &&
          -delta >=
            fee
        ) {
          delta +=
            fee
        }

        const from =
          normalizedKeys.find(
            (key) =>
              key.signer
          )?.pubkey ||
          address

        let to:
          string | null =
          address

        if (
          direction ===
          'out'
        ) {
          const positiveIndex =
            postBalances.findIndex(
              (
                value,
                keyIndex
              ) => {
                try {
                  return (
                    keyIndex !==
                      walletIndex &&
                    BigInt(
                      toStringValue(
                        value
                      ) ||
                      '0'
                    ) >
                      BigInt(
                        toStringValue(
                          preBalances[
                            keyIndex
                          ]
                        ) ||
                        '0'
                      )
                  )
                } catch {
                  return false
                }
              }
            )

          to =
            normalizedKeys[
              positiveIndex
            ]?.pubkey ||
            null
        }

        const blockTime =
          readString(
            transaction,
            'blockTime'
          ) ||
          readString(
            summary,
            'blockTime'
          )

        const blockNumber =
          readString(
            transaction,
            'slot'
          ) ||
          readString(
            summary,
            'slot'
          ) ||
          null

        const failed =
          meta?.err !== null &&
          meta?.err !== undefined

        const amountRaw =
          delta < 0n
            ? -delta
            : delta

        return [
          {
            id:
              `${chainId}:${detail.signature}:native:${index}`,

            chainId,

            hash:
              detail.signature,

            timestamp:
              blockTime
                ? normalizeTimestamp(
                    blockTime
                  )
                : new Date()
                    .toISOString(),

            blockNumber,

            kind:
              amountRaw === 0n
                ? 'contract'
                : 'native',

            direction,

            status:
              failed
                ? 'failed'
                : transaction
                  ? 'success'
                  : 'pending',

            from,

            to,

            method:
              amountRaw === 0n
                ? 'Programa Solana'
                : null,

            amountRaw:
              amountRaw.toString(),

            decimals:
              chain.nativeCurrency.decimals,

            symbol:
              chain.nativeCurrency.symbol,

            tokenName:
              null,

            tokenAddress:
              null,

            feeRaw:
              fee.toString()
          }
        ]
      }
    )

  return {
    chainId,
    address,
    fetchedAt:
      new Date().toISOString(),
    partial:
      true,
    transactions:
      finalizeTransactions(
        transactions,
        limit
      )
  }
}

const hexToBytes = (value: string) => {
  const clean =
    value.startsWith('0x')
      ? value.slice(2)
      : value

  if (
    !/^[a-fA-F0-9]+$/.test(clean) ||
    clean.length % 2 !== 0
  ) {
    return null
  }

  const bytes =
    new Uint8Array(
      clean.length / 2
    )

  for (
    let index = 0;
    index < clean.length;
    index += 2
  ) {
    bytes[index / 2] =
      Number.parseInt(
        clean.slice(
          index,
          index + 2
        ),
        16
      )
  }

  return bytes
}

const encodeBase58 = (bytes: Uint8Array) => {
  const alphabet =
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

  const digits = [0]

  for (
    const byte of
    bytes
  ) {
    let carry =
      byte

    for (
      let index = 0;
      index < digits.length;
      index += 1
    ) {
      carry +=
        digits[index] <<
        8

      digits[index] =
        carry % 58

      carry =
        Math.floor(
          carry / 58
        )
    }

    while (
      carry > 0
    ) {
      digits.push(
        carry % 58
      )

      carry =
        Math.floor(
          carry / 58
        )
    }
  }

  let leadingZeros =
    0

  while (
    leadingZeros <
      bytes.length &&
    bytes[
      leadingZeros
    ] === 0
  ) {
    leadingZeros +=
      1
  }

  return (
    '1'.repeat(
      leadingZeros
    ) +
    digits
      .reverse()
      .map(
        (digit) =>
          alphabet[digit]
      )
      .join('')
  )
}

const tronHexToBase58 = async (value: string) => {
  if (
    !/^41[a-fA-F0-9]{40}$/.test(value)
  ) {
    return value
  }

  const payload =
    hexToBytes(value)

  if (!payload) {
    return value
  }

  const firstHash =
    await crypto.subtle.digest(
      'SHA-256',
      payload
    )

  const secondHash =
    await crypto.subtle.digest(
      'SHA-256',
      firstHash
    )

  const checksum =
    new Uint8Array(
      secondHash
    ).slice(
      0,
      4
    )

  const combined =
    new Uint8Array(
      payload.length +
      checksum.length
    )

  combined.set(
    payload
  )

  combined.set(
    checksum,
    payload.length
  )

  return encodeBase58(
    combined
  )
}

const getTronTransactions = async (
  chainId: ChainId,
  address: string,
  limit: number
): Promise<MaCarteiraTransactionsResult> => {
  const chain =
    getChainConfig(chainId)

  const baseUrl =
    chain.dataApiUrl.replace(
      /\/$/,
      ''
    )

  const safeLimit =
    Math.min(
      limit,
      100
    )

  const [
    nativeBody,
    tokenBody
  ] =
    await Promise.all([
      requestJson(
        `${baseUrl}/v1/accounts/${encodeURIComponent(
          address
        )}/transactions?only_confirmed=true&limit=${safeLimit}`,
        {
          method: 'GET'
        },
        'Não foi possível consultar as transações TRX.'
      ),

      requestJson(
        `${baseUrl}/v1/accounts/${encodeURIComponent(
          address
        )}/transactions/trc20?only_confirmed=true&limit=${safeLimit}`,
        {
          method: 'GET'
        },
        'Não foi possível consultar as transferências TRC-20.'
      ).catch(
        () => null
      )
    ])

  const nativeResponse =
    asRecord(
      nativeBody
    )

  const tokenResponse =
    asRecord(
      tokenBody
    )

  const nativeData =
    Array.isArray(
      nativeResponse?.data
    )
      ? nativeResponse.data
      : []

  const tokenData =
    Array.isArray(
      tokenResponse?.data
    )
      ? tokenResponse.data
      : []

  const nativeTransactions =
    await Promise.all(
      nativeData.map(
        async (
          value,
          index
        ): Promise<
          MaCarteiraTransaction | null
        > => {
          const item =
            asRecord(value)

          const hash =
            readString(
              item,
              'txID'
            )

          const rawData =
            asRecord(
              item?.raw_data
            )

          const contracts =
            Array.isArray(
              rawData?.contract
            )
              ? rawData.contract
              : []

          const contract =
            asRecord(
              contracts[0]
            )

          const contractType =
            readString(
              contract,
              'type'
            )

          const parameter =
            asRecord(
              contract?.parameter
            )

          const parameterValue =
            asRecord(
              parameter?.value
            )

          if (
            !item ||
            !hash ||
            contractType !==
              'TransferContract' ||
            !parameterValue
          ) {
            return null
          }

          const rawFrom =
            readString(
              parameterValue,
              'owner_address'
            )

          const rawTo =
            readString(
              parameterValue,
              'to_address'
            )

          const from =
            await tronHexToBase58(
              rawFrom
            )

          const to =
            await tronHexToBase58(
              rawTo
            )

          if (
            from !==
              address &&
            to !==
              address
          ) {
            return null
          }

          const ret =
            Array.isArray(
              item.ret
            )
              ? asRecord(
                  item.ret[0]
                )
              : null

          const success =
            readString(
              ret,
              'contractRet'
            ) ===
            'SUCCESS'

          return {
            id:
              `${chainId}:${hash}:native:${index}`,

            chainId,

            hash,

            timestamp:
              normalizeTimestamp(
                item.block_timestamp
              ),

            blockNumber:
              readString(
                item,
                'blockNumber'
              ) ||
              null,

            kind:
              'native',

            direction:
              getDirection(
                address,
                from,
                to
              ),

            status:
              success
                ? 'success'
                : 'failed',

            from,

            to,

            method:
              null,

            amountRaw:
              readString(
                parameterValue,
                'amount'
              ) ||
              '0',

            decimals:
              chain.nativeCurrency.decimals,

            symbol:
              chain.nativeCurrency.symbol,

            tokenName:
              null,

            tokenAddress:
              null,

            feeRaw:
              readString(
                ret,
                'fee'
              ) ||
              '0'
          }
        }
      )
    )

  const tokenTransactions =
    tokenData.flatMap(
      (
        value,
        index
      ): MaCarteiraTransaction[] => {
        const item =
          asRecord(value)

        const hash =
          readString(
            item,
            'transaction_id'
          )

        const from =
          readString(
            item,
            'from'
          )

        const to =
          readString(
            item,
            'to'
          )

        const tokenInfo =
          asRecord(
            item?.token_info
          )

        if (
          !item ||
          !hash ||
          (
            from !==
              address &&
            to !==
              address
          )
        ) {
          return []
        }

        const decimalsValue =
          Number(
            readString(
              tokenInfo,
              'decimals'
            ) ||
            '0'
          )

        const decimals =
          Number.isFinite(
            decimalsValue
          )
            ? Math.max(
                0,
                Math.trunc(
                  decimalsValue
                )
              )
            : 0

        return [
          {
            id:
              `${chainId}:${hash}:token:${index}`,

            chainId,

            hash,

            timestamp:
              normalizeTimestamp(
                item.block_timestamp
              ),

            blockNumber:
              null,

            kind:
              'token',

            direction:
              getDirection(
                address,
                from,
                to
              ),

            status:
              'success',

            from,

            to,

            method:
              readString(
                item,
                'type'
              ) ||
              null,

            amountRaw:
              readString(
                item,
                'value'
              ) ||
              '0',

            decimals,

            symbol:
              readString(
                tokenInfo,
                'symbol'
              ) ||
              'TRC-20',

            tokenName:
              readString(
                tokenInfo,
                'name'
              ) ||
              null,

            tokenAddress:
              readString(
                tokenInfo,
                'address'
              ) ||
              null,

            feeRaw:
              '0'
          }
        ]
      }
    )

  return {
    chainId,
    address,
    fetchedAt:
      new Date().toISOString(),
    partial:
      tokenBody === null,
    transactions:
      finalizeTransactions(
        [
          ...nativeTransactions.filter(
            (
              transaction
            ): transaction is MaCarteiraTransaction =>
              Boolean(
                transaction
              )
          ),
          ...tokenTransactions
        ],
        limit
      )
  }
}

const getRequestedChainId = (url: URL): ChainId => {
  const requested =
    (
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
  const chainId =
    getRequestedChainId(
      url
    )

  const chain =
    getChainConfig(
      chainId
    )

  const address =
    normalizeChainAddress(
      url.searchParams.get(
        'address'
      ) ||
        '',
      chainId
    )

  const limit =
    getLimit(
      url.searchParams.get(
        'limit'
      )
    )

  if (
    chain.status !==
    'active'
  ) {
    throw new MaCarteiraTransactionsError(
      `${chain.name} ainda não está ativa na MA-Carteira.`,
      409
    )
  }

  if (
    !isValidChainAddress(
      address,
      chainId
    )
  ) {
    throw new MaCarteiraTransactionsError(
      `Indique um endereço público válido para ${chain.name}.`,
      400
    )
  }

  if (
    chain.transactionProvider ===
    'blockstream'
  ) {
    return getBitcoinTransactions(
      chainId,
      address,
      limit
    )
  }

  if (
    chain.transactionProvider ===
    'solana-rpc'
  ) {
    return getSolanaTransactions(
      chainId,
      address,
      limit
    )
  }

  if (
    chain.transactionProvider ===
    'trongrid'
  ) {
    return getTronTransactions(
      chainId,
      address,
      limit
    )
  }

  if (
    chain.transactionProvider ===
    'none'
  ) {
    throw new MaCarteiraTransactionsError(
      `O histórico de transações ainda não está configurado para ${chain.name}.`,
      501
    )
  }

  if (
    !supportsAccountApi(
      chain.explorer.apiFamily
    )
  ) {
    throw new MaCarteiraTransactionsError(
      `O histórico de transações ainda não está configurado para ${chain.name}.`,
      501
    )
  }

  const [
    nativeResult,
    tokenResult,
    internalResult
  ] =
    await Promise.all([
      fetchExplorerItems(
        buildExplorerUrl(
          chain.explorer.apiUrl,
          'txlist',
          address,
          limit
        )
      ),

      fetchExplorerItems(
        buildExplorerUrl(
          chain.explorer.apiUrl,
          'tokentx',
          address,
          limit
        )
      ),

      fetchExplorerItems(
        buildExplorerUrl(
          chain.explorer.apiUrl,
          'txlistinternal',
          address,
          limit
        )
      )
    ])

  if (
    !nativeResult.ok &&
    !tokenResult.ok &&
    !internalResult.ok
  ) {
    throw new MaCarteiraTransactionsError(
      `Não foi possível consultar as transações em ${chain.name}.`,
      502
    )
  }

  const transactions =
    finalizeTransactions(
      [
        ...normalizeNativeTransactions(
          nativeResult.items,
          address,
          chainId,
          chain.nativeCurrency.symbol,
          chain.nativeCurrency.decimals
        ),

        ...normalizeTokenTransactions(
          tokenResult.items,
          address,
          chainId
        ),

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
    fetchedAt:
      new Date().toISOString(),
    partial:
      !nativeResult.ok ||
      !tokenResult.ok ||
      !internalResult.ok,
    transactions
  }
}
