import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  isSupportedChainId,
  isValidChainAddress,
  normalizeChainAddress,
  type ChainId
} from '../src/lib/maCarteiraChains'

export const MA_CARTEIRA_WALLET_PATH = '/api/ma-carteira/wallet'

export type MaCarteiraWalletToken = {
  symbol?: string
  name?: string
  balance?: string
  decimals?: string | number
  contractAddress?: string
  address?: string
  type?: string
}

export type MaCarteiraWalletResult = {
  chainId: ChainId
  address: string
  nativeBalance: string
  tokens: MaCarteiraWalletToken[]
  fetchedAt: string
  partial: boolean
  notice: string | null
}

type UnknownRecord = Record<string, unknown>

type JsonRpcResponse = {
  result?: unknown
  error?: unknown
}

const REQUEST_TIMEOUT_MS = 18_000
const MAX_SOLANA_TOKEN_ACCOUNTS = 1_500

const SOLANA_TOKEN_PROGRAM =
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const SOLANA_TOKEN_2022_PROGRAM =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

const BITCOIN_API_FALLBACKS = [
  'https://mempool.space/api'
] as const

export class MaCarteiraWalletError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'MaCarteiraWalletError'
    this.status = status
  }
}

const isRecord = (
  value: unknown
): value is UnknownRecord =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value)

const asRecord = (value: unknown) =>
  isRecord(value) ? value : null

const toStringValue = (value: unknown) => {
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
    ? toStringValue(record[key]).trim()
    : ''

const getTimeoutSignal = (
  timeoutMs = REQUEST_TIMEOUT_MS
) => {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  )

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer)
  }
}

const readResponseBody = async (
  response: Response
): Promise<unknown> => {
  const text = await response.text()

  if (!text.trim()) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const getProviderErrorMessage = (
  body: unknown,
  fallbackMessage: string
) => {
  const record = asRecord(body)

  if (record) {
    const message =
      readString(record, 'message') ||
      readString(record, 'error') ||
      readString(record, 'detail')

    if (message) {
      return message
    }
  }

  if (typeof body === 'string') {
    const clean = body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    if (
      clean &&
      clean.length <= 180
    ) {
      return clean
    }
  }

  return fallbackMessage
}

const requestJson = async (
  url: string,
  init: RequestInit,
  fallbackMessage: string
) => {
  const timeout = getTimeoutSignal()

  try {
    const response = await fetch(url, {
      ...init,
      signal: timeout.signal,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {})
      }
    })

    const body = await readResponseBody(response)

    if (!response.ok) {
      throw new MaCarteiraWalletError(
        getProviderErrorMessage(
          body,
          fallbackMessage
        ),
        response.status
      )
    }

    if (
      typeof body === 'string' ||
      body === null
    ) {
      throw new MaCarteiraWalletError(
        'O fornecedor de dados devolveu uma resposta inválida.',
        502
      )
    }

    return body
  } catch (error) {
    if (
      error instanceof MaCarteiraWalletError
    ) {
      throw error
    }

    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      throw new MaCarteiraWalletError(
        'O fornecedor de dados demorou demasiado tempo a responder.',
        504
      )
    }

    throw new MaCarteiraWalletError(
      fallbackMessage,
      502
    )
  } finally {
    timeout.clear()
  }
}

const jsonRpc = async (
  rpcUrl: string,
  method: string,
  params: unknown[],
  fallbackMessage: string
) => {
  const body = (await requestJson(
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
  )) as JsonRpcResponse

  if (
    body.error !== undefined ||
    body.result === undefined
  ) {
    const error = asRecord(body.error)

    throw new MaCarteiraWalletError(
      readString(error, 'message') ||
        fallbackMessage,
      502
    )
  }

  return body.result
}

const hexToDecimalString = (
  value: string
) => {
  try {
    return BigInt(value || '0x0').toString()
  } catch {
    throw new MaCarteiraWalletError(
      'O saldo nativo devolvido pela rede não é válido.',
      502
    )
  }
}

const normalizeDecimals = (
  value: unknown,
  fallback = 18
) => {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.max(
    0,
    Math.min(255, Math.trunc(parsed))
  )
}

const sortTokens = (
  tokens: MaCarteiraWalletToken[]
) =>
  [...tokens].sort((left, right) => {
    try {
      const leftDecimals = normalizeDecimals(
        left.decimals
      )
      const rightDecimals = normalizeDecimals(
        right.decimals
      )
      const leftBalance = BigInt(
        left.balance || '0'
      )
      const rightBalance = BigInt(
        right.balance || '0'
      )
      const commonDecimals = Math.max(
        leftDecimals,
        rightDecimals
      )
      const normalizedLeft =
        leftBalance *
        10n **
          BigInt(
            commonDecimals - leftDecimals
          )
      const normalizedRight =
        rightBalance *
        10n **
          BigInt(
            commonDecimals - rightDecimals
          )

      if (
        normalizedLeft === normalizedRight
      ) {
        return (left.symbol || '').localeCompare(
          right.symbol || ''
        )
      }

      return normalizedLeft > normalizedRight
        ? -1
        : 1
    } catch {
      return 0
    }
  })

const getEvmNativeBalance = async (
  chainId: ChainId,
  address: string
) => {
  const chain = getChainConfig(chainId)
  let lastError: MaCarteiraWalletError | null = null

  for (const rpcUrl of chain.rpcUrls) {
    try {
      const result = await jsonRpc(
        rpcUrl,
        'eth_getBalance',
        [address, 'latest'],
        `Não foi possível consultar o saldo ${chain.nativeCurrency.symbol}.`
      )

      return hexToDecimalString(
        toStringValue(result)
      )
    } catch (error) {
      lastError =
        error instanceof MaCarteiraWalletError
          ? error
          : new MaCarteiraWalletError(
              `Não foi possível consultar o saldo ${chain.nativeCurrency.symbol}.`,
              502
            )
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new MaCarteiraWalletError(
    `Não existe um RPC configurado para ${chain.name}.`,
    503
  )
}

const parsePulseChainTokens = (
  body: unknown,
  expectedType: string
) => {
  const response = asRecord(body)
  const result = response?.result

  if (!Array.isArray(result)) {
    return []
  }

  return result.flatMap(
    (item): MaCarteiraWalletToken[] => {
      const token = asRecord(item)

      if (!token) {
        return []
      }

      const balance = readString(
        token,
        'balance'
      )
      const type = readString(token, 'type')

      if (!balance || balance === '0') {
        return []
      }

      if (
        type &&
        type !== 'ERC-20' &&
        type !== expectedType
      ) {
        return []
      }

      const contractAddress =
        readString(
          token,
          'contractAddress'
        ) || readString(token, 'address')

      return [
        {
          symbol:
            readString(token, 'symbol') ||
            'TOKEN',
          name:
            readString(token, 'name') ||
            expectedType,
          balance,
          decimals: normalizeDecimals(
            token.decimals
          ),
          contractAddress:
            contractAddress || undefined,
          address:
            contractAddress || undefined,
          type: expectedType
        }
      ]
    }
  )
}

const getPulseChainPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const chain = getChainConfig(chainId)
  const nativeBalance =
    await getEvmNativeBalance(
      chainId,
      address
    )
  const expectedType =
    chain.tokenStandard || 'PRC-20'

  try {
    const tokenBody = await requestJson(
      `${chain.explorer.apiUrl}?module=account&action=tokenlist&address=${encodeURIComponent(
        address
      )}`,
      { method: 'GET' },
      `Não foi possível consultar os tokens em ${chain.name}.`
    )

    return {
      chainId,
      address,
      nativeBalance,
      tokens: sortTokens(
        parsePulseChainTokens(
          tokenBody,
          expectedType
        )
      ),
      fetchedAt: new Date().toISOString(),
      partial: false,
      notice: null
    }
  } catch {
    return {
      chainId,
      address,
      nativeBalance,
      tokens: [],
      fetchedAt: new Date().toISOString(),
      partial: true,
      notice: `O saldo ${chain.nativeCurrency.symbol} foi atualizado. A listagem de ${expectedType} está temporariamente indisponível.`
    }
  }
}

const parseBlockscoutTokens = (
  body: unknown,
  tokenStandard: string
) => {
  if (!Array.isArray(body)) {
    return []
  }

  return body.flatMap(
    (item): MaCarteiraWalletToken[] => {
      const balanceRecord = asRecord(item)
      const token = asRecord(
        balanceRecord?.token
      )

      if (!balanceRecord || !token) {
        return []
      }

      const value = readString(
        balanceRecord,
        'value'
      )
      const tokenType = readString(
        token,
        'type'
      )

      if (
        !value ||
        value === '0' ||
        (tokenType && tokenType !== 'ERC-20')
      ) {
        return []
      }

      const contractAddress =
        readString(token, 'address') ||
        readString(token, 'address_hash')

      return [
        {
          symbol:
            readString(token, 'symbol') ||
            'TOKEN',
          name:
            readString(token, 'name') ||
            tokenStandard,
          balance: value,
          decimals: normalizeDecimals(
            token.decimals
          ),
          contractAddress:
            contractAddress || undefined,
          address:
            contractAddress || undefined,
          type: tokenStandard
        }
      ]
    }
  )
}

const getBlockscoutPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const chain = getChainConfig(chainId)
  const baseUrl = chain.dataApiUrl.replace(
    /\/$/,
    ''
  )
  const nativeBalance =
    await getEvmNativeBalance(
      chainId,
      address
    )
  const tokenStandard =
    chain.tokenStandard || 'ERC-20'

  try {
    const tokenBody = await requestJson(
      `${baseUrl}/addresses/${encodeURIComponent(
        address
      )}/token-balances`,
      { method: 'GET' },
      `Não foi possível consultar os tokens em ${chain.name}.`
    )

    return {
      chainId,
      address,
      nativeBalance,
      tokens: sortTokens(
        parseBlockscoutTokens(
          tokenBody,
          tokenStandard
        )
      ),
      fetchedAt: new Date().toISOString(),
      partial: false,
      notice: null
    }
  } catch {
    return {
      chainId,
      address,
      nativeBalance,
      tokens: [],
      fetchedAt: new Date().toISOString(),
      partial: true,
      notice: `O saldo ${chain.nativeCurrency.symbol} foi atualizado. A listagem de ${tokenStandard} está temporariamente indisponível no indexador desta rede.`
    }
  }
}

const getEvmNativeOnlyPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const chain = getChainConfig(chainId)
  const nativeBalance =
    await getEvmNativeBalance(
      chainId,
      address
    )

  return {
    chainId,
    address,
    nativeBalance,
    tokens: [],
    fetchedAt: new Date().toISOString(),
    partial: true,
    notice: `O saldo ${chain.nativeCurrency.symbol} está ativo. A leitura de ${chain.tokenStandard || 'tokens'} e o histórico completo serão ligados quando o projeto tiver um indexador compatível para ${chain.name}.`
  }
}

const getSolanaTokenAccounts = async (
  rpcUrl: string,
  address: string,
  programId: string,
  tokenType: string
) => {
  const result = await jsonRpc(
    rpcUrl,
    'getTokenAccountsByOwner',
    [
      address,
      { programId },
      {
        commitment: 'confirmed',
        encoding: 'jsonParsed'
      }
    ],
    'Não foi possível consultar os tokens SPL.'
  )
  const resultRecord = asRecord(result)
  const value = resultRecord?.value

  if (!Array.isArray(value)) {
    return []
  }

  if (
    value.length >
    MAX_SOLANA_TOKEN_ACCOUNTS
  ) {
    throw new MaCarteiraWalletError(
      'O endereço tem demasiadas contas SPL para uma consulta segura.',
      413
    )
  }

  return value.flatMap(
    (
      item
    ): Array<{
      mint: string
      balance: string
      decimals: number
      type: string
    }> => {
      const account = asRecord(item)
      const accountData = asRecord(
        account?.account
      )
      const data = asRecord(
        accountData?.data
      )
      const parsed = asRecord(data?.parsed)
      const info = asRecord(parsed?.info)
      const tokenAmount = asRecord(
        info?.tokenAmount
      )
      const mint = readString(info, 'mint')
      const balance = readString(
        tokenAmount,
        'amount'
      )

      if (
        !mint ||
        !balance ||
        balance === '0'
      ) {
        return []
      }

      return [
        {
          mint,
          balance,
          decimals: normalizeDecimals(
            tokenAmount?.decimals,
            0
          ),
          type: tokenType
        }
      ]
    }
  )
}

const shortIdentifier = (value: string) =>
  value.length <= 12
    ? value
    : `${value.slice(0, 5)}…${value.slice(-5)}`

const getSolanaPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const chain = getChainConfig(chainId)
  const rpcUrl = chain.rpcUrls[0]

  if (!rpcUrl) {
    throw new MaCarteiraWalletError(
      'O RPC de Solana não está configurado.',
      503
    )
  }

  const balanceResult = await jsonRpc(
    rpcUrl,
    'getBalance',
    [address, { commitment: 'confirmed' }],
    'Não foi possível consultar o saldo SOL.'
  )
  const balanceRecord = asRecord(
    balanceResult
  )
  const nativeBalance =
    readString(balanceRecord, 'value') || '0'

  const tokenResults =
    await Promise.allSettled([
      getSolanaTokenAccounts(
        rpcUrl,
        address,
        SOLANA_TOKEN_PROGRAM,
        'SPL'
      ),
      getSolanaTokenAccounts(
        rpcUrl,
        address,
        SOLANA_TOKEN_2022_PROGRAM,
        'SPL Token-2022'
      )
    ])

  const tokenAccounts = tokenResults.flatMap(
    (result) =>
      result.status === 'fulfilled'
        ? result.value
        : []
  )
  const merged = new Map<
    string,
    {
      balance: bigint
      decimals: number
      type: string
    }
  >()

  for (const token of tokenAccounts) {
    const current = merged.get(token.mint)

    try {
      const value = BigInt(token.balance)

      if (!current) {
        merged.set(token.mint, {
          balance: value,
          decimals: token.decimals,
          type: token.type
        })
      } else if (
        current.decimals === token.decimals
      ) {
        current.balance += value
      }
    } catch {
      // Ignora apenas a conta SPL inválida.
    }
  }

  const tokens = Array.from(
    merged.entries()
  ).map(
    ([mint, token]): MaCarteiraWalletToken => ({
      symbol: shortIdentifier(mint),
      name: token.type,
      balance: token.balance.toString(),
      decimals: token.decimals,
      contractAddress: mint,
      address: mint,
      type: token.type
    })
  )
  const allTokenRequestsSucceeded =
    tokenResults.every(
      (result) => result.status === 'fulfilled'
    )

  return {
    chainId,
    address,
    nativeBalance,
    tokens: sortTokens(tokens),
    fetchedAt: new Date().toISOString(),
    partial: true,
    notice: allTokenRequestsSucceeded
      ? 'Os saldos SPL são lidos diretamente da rede. Símbolos e nomes dependem de um serviço de metadados e, por agora, são identificados pelo mint.'
      : 'O saldo SOL foi atualizado. Uma parte das contas SPL não pôde ser consultada neste momento.'
  }
}

const getTronPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const chain = getChainConfig(chainId)
  const body = await requestJson(
    `${chain.dataApiUrl.replace(
      /\/$/,
      ''
    )}/v1/accounts/${encodeURIComponent(
      address
    )}`,
    { method: 'GET' },
    'Não foi possível consultar o saldo TRX.'
  )
  const response = asRecord(body)
  const data = response?.data
  const account = Array.isArray(data)
    ? asRecord(data[0])
    : null
  const nativeBalance =
    readString(account, 'balance') || '0'

  return {
    chainId,
    address,
    nativeBalance,
    tokens: [],
    fetchedAt: new Date().toISOString(),
    partial: true,
    notice:
      'O saldo TRX e o histórico estão ativos. Os saldos TRC-20 serão adicionados quando existir no projeto um fornecedor que devolva metadados e decimais de forma consistente.'
  }
}

const getBitcoinApiUrls = (
  configuredUrl: string
) =>
  Array.from(
    new Set([
      configuredUrl.replace(/\/$/, ''),
      ...BITCOIN_API_FALLBACKS
    ])
  ).filter(Boolean)

const getBitcoinAddressData = async (
  chainId: ChainId,
  address: string
) => {
  const chain = getChainConfig(chainId)
  let lastError: MaCarteiraWalletError | null = null

  for (const baseUrl of getBitcoinApiUrls(
    chain.dataApiUrl
  )) {
    try {
      const body = await requestJson(
        `${baseUrl}/address/${encodeURIComponent(
          address
        )}`,
        { method: 'GET' },
        'Não foi possível consultar o saldo BTC.'
      )
      const response = asRecord(body)

      if (
        !response ||
        !asRecord(response.chain_stats) ||
        !asRecord(response.mempool_stats)
      ) {
        throw new MaCarteiraWalletError(
          'O fornecedor Bitcoin devolveu dados incompletos.',
          502
        )
      }

      return response
    } catch (error) {
      lastError =
        error instanceof MaCarteiraWalletError
          ? error
          : new MaCarteiraWalletError(
              'Não foi possível consultar o saldo BTC.',
              502
            )
    }
  }

  if (
    lastError &&
    (lastError.status === 400 ||
      lastError.status === 404)
  ) {
    throw new MaCarteiraWalletError(
      'O endereço Bitcoin não foi aceite pelos exploradores. Confirme se o endereço está completo e pertence à rede principal.',
      400
    )
  }

  throw (
    lastError ||
    new MaCarteiraWalletError(
      'Não foi possível consultar o saldo BTC.',
      502
    )
  )
}

const readBigIntField = (
  record: UnknownRecord,
  key: string
) => {
  try {
    return BigInt(
      readString(record, key) || '0'
    )
  } catch {
    throw new MaCarteiraWalletError(
      'O fornecedor Bitcoin devolveu um saldo inválido.',
      502
    )
  }
}

const getBitcoinPortfolio = async (
  chainId: ChainId,
  address: string
): Promise<MaCarteiraWalletResult> => {
  const response = await getBitcoinAddressData(
    chainId,
    address
  )
  const chainStats = asRecord(
    response.chain_stats
  )
  const mempoolStats = asRecord(
    response.mempool_stats
  )

  if (!chainStats || !mempoolStats) {
    throw new MaCarteiraWalletError(
      'O fornecedor Bitcoin devolveu dados incompletos.',
      502
    )
  }

  const funded = readBigIntField(
    chainStats,
    'funded_txo_sum'
  )
  const spent = readBigIntField(
    chainStats,
    'spent_txo_sum'
  )
  const mempoolFunded = readBigIntField(
    mempoolStats,
    'funded_txo_sum'
  )
  const mempoolSpent = readBigIntField(
    mempoolStats,
    'spent_txo_sum'
  )
  const nativeBalance =
    funded -
    spent +
    mempoolFunded -
    mempoolSpent

  return {
    chainId,
    address,
    nativeBalance: nativeBalance.toString(),
    tokens: [],
    fetchedAt: new Date().toISOString(),
    partial: false,
    notice: null
  }
}

const resolveChainId = (
  url: URL
): ChainId => {
  const requested =
    url.searchParams.get('chainId') ||
    DEFAULT_CHAIN_ID

  if (!isSupportedChainId(requested)) {
    throw new MaCarteiraWalletError(
      'A rede indicada não é suportada.',
      400
    )
  }

  return requested
}

export async function getMaCarteiraWallet(
  url: URL
): Promise<MaCarteiraWalletResult> {
  const chainId = resolveChainId(url)
  const chain = getChainConfig(chainId)
  const address = normalizeChainAddress(
    url.searchParams.get('address') || '',
    chainId
  )

  if (
    !isValidChainAddress(address, chainId)
  ) {
    throw new MaCarteiraWalletError(
      `O endereço indicado não é válido para ${chain.name}.`,
      400
    )
  }

  if (
    chain.portfolioProvider === 'pulsechain'
  ) {
    return getPulseChainPortfolio(
      chainId,
      address
    )
  }

  if (
    chain.portfolioProvider ===
    'blockscout-v2'
  ) {
    return getBlockscoutPortfolio(
      chainId,
      address
    )
  }

  if (
    chain.portfolioProvider ===
    'evm-native-only'
  ) {
    return getEvmNativeOnlyPortfolio(
      chainId,
      address
    )
  }

  if (
    chain.portfolioProvider === 'solana-rpc'
  ) {
    return getSolanaPortfolio(
      chainId,
      address
    )
  }

  if (
    chain.portfolioProvider === 'trongrid'
  ) {
    return getTronPortfolio(
      chainId,
      address
    )
  }

  if (
    chain.portfolioProvider === 'blockstream'
  ) {
    return getBitcoinPortfolio(
      chainId,
      address
    )
  }

  throw new MaCarteiraWalletError(
    `A consulta de saldos ainda não está configurada para ${chain.name}.`,
    501
  )
}
