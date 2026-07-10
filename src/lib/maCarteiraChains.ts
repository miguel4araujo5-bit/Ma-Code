export type ChainStatus = 'active' | 'planned' | 'disabled'

export type ExplorerApiFamily =
  | 'blockscout-legacy'
  | 'etherscan-compatible'
  | 'custom'

export type PriceProvider = 'geckoterminal'

export type NativeCurrency = {
  name: string
  symbol: string
  decimals: number
}

export type ChainExplorerConfig = {
  baseUrl: string
  addressUrl: string
  transactionUrl: string
  tokenUrl: string
  apiUrl: string
  apiFamily: ExplorerApiFamily
}

export type ChainPriceConfig = {
  provider: PriceProvider
  networkId: string
  wrappedNativeToken: string | null
}

export type ChainConfig = {
  id: string
  chainId: number
  name: string
  shortName: string
  evm: boolean
  status: ChainStatus
  nativeCurrency: NativeCurrency
  rpcUrls: readonly string[]
  explorer: ChainExplorerConfig
  price: ChainPriceConfig | null
}

export const CHAIN_CONFIGS = {
  pulsechain: {
    id: 'pulsechain',
    chainId: 369,
    name: 'PulseChain',
    shortName: 'PulseChain',
    evm: true,
    status: 'active',
    nativeCurrency: {
      name: 'Pulse',
      symbol: 'PLS',
      decimals: 18
    },
    rpcUrls: [
      'https://rpc.pulsechain.com'
    ],
    explorer: {
      baseUrl: 'https://scan.pulsechain.com',
      addressUrl: 'https://scan.pulsechain.com/address',
      transactionUrl: 'https://scan.pulsechain.com/tx',
      tokenUrl: 'https://scan.pulsechain.com/token',
      apiUrl: 'https://api.scan.pulsechain.com/api',
      apiFamily: 'blockscout-legacy'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'pulsechain',
      wrappedNativeToken:
        '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'
    }
  }
} as const satisfies Record<string, ChainConfig>

export type ChainId = keyof typeof CHAIN_CONFIGS

export const DEFAULT_CHAIN_ID: ChainId = 'pulsechain'

export const SUPPORTED_CHAIN_IDS = Object.keys(
  CHAIN_CONFIGS
) as ChainId[]

export const ACTIVE_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(
  (chainId) =>
    CHAIN_CONFIGS[chainId].status === 'active'
)

export function isSupportedChainId(
  value: string
): value is ChainId {
  return value in CHAIN_CONFIGS
}

export function getChainConfig(
  chainId?: string | null
): ChainConfig {
  if (
    chainId &&
    isSupportedChainId(chainId)
  ) {
    return CHAIN_CONFIGS[chainId]
  }

  return CHAIN_CONFIGS[DEFAULT_CHAIN_ID]
}

export function getDefaultChainConfig() {
  return CHAIN_CONFIGS[DEFAULT_CHAIN_ID]
}

export function getActiveChains() {
  return ACTIVE_CHAIN_IDS.map(
    (chainId) => CHAIN_CONFIGS[chainId]
  )
}

export function getRpcUrls(
  chainId?: string | null
) {
  return [
    ...getChainConfig(chainId).rpcUrls
  ]
}

export function getPrimaryRpcUrl(
  chainId?: string | null
) {
  const chain = getChainConfig(chainId)
  const rpcUrl = chain.rpcUrls[0]

  if (!rpcUrl) {
    throw new Error(
      `Não existe RPC configurado para ${chain.name}.`
    )
  }

  return rpcUrl
}

export function getExplorerAddressUrl(
  address: string,
  chainId?: string | null
) {
  const chain = getChainConfig(chainId)

  return `${chain.explorer.addressUrl}/${address}`
}

export function getExplorerTransactionUrl(
  transactionHash: string,
  chainId?: string | null
) {
  const chain = getChainConfig(chainId)

  return `${chain.explorer.transactionUrl}/${transactionHash}`
}

export function getExplorerTokenUrl(
  contractAddress: string,
  chainId?: string | null
) {
  const chain = getChainConfig(chainId)

  return `${chain.explorer.tokenUrl}/${contractAddress}`
}

export function getExplorerApiUrl(
  chainId?: string | null
) {
  return getChainConfig(chainId).explorer.apiUrl
}

export function getNativeCurrency(
  chainId?: string | null
) {
  return getChainConfig(chainId).nativeCurrency
}

export function getWrappedNativeToken(
  chainId?: string | null
) {
  return (
    getChainConfig(chainId).price
      ?.wrappedNativeToken || null
  )
}

export function getPriceNetworkId(
  chainId?: string | null
) {
  return (
    getChainConfig(chainId).price
      ?.networkId || null
  )
}

export function createWalletStorageKey(
  chainId: string,
  address: string
) {
  return `${chainId}:${address.toLowerCase()}`
}

export function parseWalletStorageKey(
  value: string
) {
  const separatorIndex = value.indexOf(':')

  if (separatorIndex === -1) {
    return {
      chainId: DEFAULT_CHAIN_ID,
      address: value.toLowerCase()
    }
  }

  const possibleChainId = value
    .slice(0, separatorIndex)
    .trim()

  const address = value
    .slice(separatorIndex + 1)
    .trim()
    .toLowerCase()

  return {
    chainId: isSupportedChainId(
      possibleChainId
    )
      ? possibleChainId
      : DEFAULT_CHAIN_ID,
    address
  }
}
