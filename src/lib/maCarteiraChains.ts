export type ChainStatus = 'active' | 'planned' | 'disabled'

export type ExplorerApiFamily =
  | 'blockscout-legacy'
  | 'etherscan-compatible'
  | 'custom'
  | 'none'

export type PriceProvider =
  | 'geckoterminal'
  | 'coingecko-market'

export type AddressType =
  | 'evm'
  | 'solana'
  | 'tron'
  | 'bitcoin'

export type PortfolioProvider =
  | 'pulsechain'
  | 'blockscout-v2'
  | 'evm-native-only'
  | 'solana-rpc'
  | 'trongrid'
  | 'blockstream'
export type TransactionProvider =
  | 'evm-explorer'
  | 'solana-rpc'
  | 'trongrid'
  | 'blockstream'
  | 'none'

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
  coinGeckoId: string | null
}

export type ChainCapabilities = {
  tokens: boolean
  transactions: boolean
  prices: boolean
}
export type ChainConfig = {
  id: string
  chainId: number | null
  name: string
  shortName: string
  evm: boolean
  addressType: AddressType
  tokenStandard: string | null
  addressPlaceholder: string
  status: ChainStatus
  nativeCurrency: NativeCurrency
  rpcUrls: readonly string[]
  dataApiUrl: string
  portfolioProvider: PortfolioProvider
  transactionProvider: TransactionProvider
  capabilities: ChainCapabilities
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
    addressType: 'evm',
    tokenStandard: 'PRC-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'Pulse',
      symbol: 'PLS',
      decimals: 18
    },
    rpcUrls: ['https://rpc.pulsechain.com'],
    dataApiUrl: 'https://api.scan.pulsechain.com/api',
    portfolioProvider: 'pulsechain',
    transactionProvider: 'evm-explorer',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
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
        '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
      coinGeckoId: null
    }
  },
  ethereum: {
    id: 'ethereum',
    chainId: 1,
    name: 'Ethereum',
    shortName: 'Ethereum',
    evm: true,
    addressType: 'evm',
    tokenStandard: 'ERC-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://cloudflare-eth.com/v1/mainnet'
    ],
    dataApiUrl: 'https://eth.blockscout.com/api/v2',
    portfolioProvider: 'blockscout-v2',
    transactionProvider: 'evm-explorer',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://eth.blockscout.com',
      addressUrl: 'https://eth.blockscout.com/address',
      transactionUrl: 'https://eth.blockscout.com/tx',
      tokenUrl: 'https://eth.blockscout.com/token',
      apiUrl: 'https://eth.blockscout.com/api',
      apiFamily: 'blockscout-legacy'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'eth',
      wrappedNativeToken:
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      coinGeckoId: 'ethereum'
    }
  },
  bnb: {
    id: 'bnb',
    chainId: 56,
    name: 'BNB Smart Chain',
    shortName: 'BNB Chain',
    evm: true,
    addressType: 'evm',
    tokenStandard: 'BEP-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18
    },
    rpcUrls: ['https://bsc-dataseed.bnbchain.org'],
    dataApiUrl: '',
    portfolioProvider: 'evm-native-only',
    transactionProvider: 'none',
    capabilities: {
      tokens: false,
      transactions: false,
      prices: true
    },
    explorer: {
      baseUrl: 'https://bsctrace.com',
      addressUrl: 'https://bsctrace.com/address',
      transactionUrl: 'https://bsctrace.com/tx',
      tokenUrl: 'https://bsctrace.com/token',
      apiUrl: '',
      apiFamily: 'none'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'bsc',
      wrappedNativeToken:
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      coinGeckoId: 'binancecoin'
    }
  },
  solana: {
    id: 'solana',
    chainId: null,
    name: 'Solana',
    shortName: 'Solana',
    evm: false,
    addressType: 'solana',
    tokenStandard: 'SPL',
    addressPlaceholder: 'Endereço Base58 de Solana',
    status: 'active',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    rpcUrls: ['https://api.mainnet-beta.solana.com'],
    dataApiUrl: 'https://api.mainnet-beta.solana.com',
    portfolioProvider: 'solana-rpc',
    transactionProvider: 'solana-rpc',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://explorer.solana.com',
      addressUrl: 'https://explorer.solana.com/address',
      transactionUrl: 'https://explorer.solana.com/tx',
      tokenUrl: 'https://explorer.solana.com/address',
      apiUrl: 'https://api.mainnet-beta.solana.com',
      apiFamily: 'custom'
    },
    price: {
      provider: 'coingecko-market',
      networkId: 'solana',
      wrappedNativeToken: null,
      coinGeckoId: 'solana'
    }
  },
  tron: {
    id: 'tron',
    chainId: null,
    name: 'TRON',
    shortName: 'TRON',
    evm: false,
    addressType: 'tron',
    tokenStandard: 'TRC-20',
    addressPlaceholder: 'Endereço TRON iniciado por T',
    status: 'active',
    nativeCurrency: {
      name: 'TRON',
      symbol: 'TRX',
      decimals: 6
    },
    rpcUrls: [],
    dataApiUrl: 'https://api.trongrid.io',
    portfolioProvider: 'trongrid',
    transactionProvider: 'trongrid',
    capabilities: {
      tokens: false,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://tronscan.org',
      addressUrl: 'https://tronscan.org/#/address',
      transactionUrl: 'https://tronscan.org/#/transaction',
      tokenUrl: 'https://tronscan.org/#/token20',
      apiUrl: 'https://api.trongrid.io',
      apiFamily: 'custom'
    },
    price: {
      provider: 'coingecko-market',
      networkId: 'tron',
      wrappedNativeToken: null,
      coinGeckoId: 'tron'
    }
  },
  bitcoin: {
    id: 'bitcoin',
    chainId: null,
    name: 'Bitcoin',
    shortName: 'Bitcoin',
    evm: false,
    addressType: 'bitcoin',
    tokenStandard: null,
    addressPlaceholder: 'bc1…, 1… ou 3…',
    status: 'active',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8
    },
    rpcUrls: [],
    dataApiUrl: 'https://blockstream.info/api',
    portfolioProvider: 'blockstream',
    transactionProvider: 'blockstream',
    capabilities: {
      tokens: false,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://blockstream.info',
      addressUrl: 'https://blockstream.info/address',
      transactionUrl: 'https://blockstream.info/tx',
      tokenUrl: 'https://blockstream.info/address',
      apiUrl: 'https://blockstream.info/api',
      apiFamily: 'custom'
    },
    price: {
      provider: 'coingecko-market',
      networkId: 'bitcoin',
      wrappedNativeToken: null,
      coinGeckoId: 'bitcoin'
    }
  },
  base: {
    id: 'base',
    chainId: 8453,
    name: 'Base',
    shortName: 'Base',
    evm: true,
    addressType: 'evm',
    tokenStandard: 'ERC-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://mainnet.base.org'],
    dataApiUrl: 'https://base.blockscout.com/api/v2',
    portfolioProvider: 'blockscout-v2',
    transactionProvider: 'evm-explorer',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://base.blockscout.com',
      addressUrl: 'https://base.blockscout.com/address',
      transactionUrl: 'https://base.blockscout.com/tx',
      tokenUrl: 'https://base.blockscout.com/token',
      apiUrl: 'https://base.blockscout.com/api',
      apiFamily: 'blockscout-legacy'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'base',
      wrappedNativeToken:
        '0x4200000000000000000000000000000000000006',
      coinGeckoId: 'ethereum'
    }
  },
  arbitrum: {
    id: 'arbitrum',
    chainId: 42161,
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    evm: true,
    addressType: 'evm',
    tokenStandard: 'ERC-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    dataApiUrl: 'https://arbitrum.blockscout.com/api/v2',
    portfolioProvider: 'blockscout-v2',
    transactionProvider: 'evm-explorer',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://arbitrum.blockscout.com',
      addressUrl: 'https://arbitrum.blockscout.com/address',
      transactionUrl: 'https://arbitrum.blockscout.com/tx',
      tokenUrl: 'https://arbitrum.blockscout.com/token',
      apiUrl: 'https://arbitrum.blockscout.com/api',
      apiFamily: 'blockscout-legacy'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'arbitrum',
      wrappedNativeToken:
        '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
      coinGeckoId: 'ethereum'
    }
  },
  polygon: {
    id: 'polygon',
    chainId: 137,
    name: 'Polygon PoS',
    shortName: 'Polygon',
    evm: true,
    addressType: 'evm',
    tokenStandard: 'ERC-20',
    addressPlaceholder: '0x…',
    status: 'active',
    nativeCurrency: {
      name: 'POL',
      symbol: 'POL',
      decimals: 18
    },
    rpcUrls: [
      'https://polygon.drpc.org',
      'https://polygon.publicnode.com',
      'https://polygon.api.onfinality.io/public'
    ],
    dataApiUrl: 'https://polygon.blockscout.com/api/v2',
    portfolioProvider: 'blockscout-v2',
    transactionProvider: 'evm-explorer',
    capabilities: {
      tokens: true,
      transactions: true,
      prices: true
    },
    explorer: {
      baseUrl: 'https://polygon.blockscout.com',
      addressUrl: 'https://polygon.blockscout.com/address',
      transactionUrl: 'https://polygon.blockscout.com/tx',
      tokenUrl: 'https://polygon.blockscout.com/token',
      apiUrl: 'https://polygon.blockscout.com/api',
      apiFamily: 'blockscout-legacy'
    },
    price: {
      provider: 'geckoterminal',
      networkId: 'polygon_pos',
      wrappedNativeToken:
        '0x0d500B1d8E8eD2aBC408eE5F4CeaD17D96C0F127',
      coinGeckoId: 'polygon-ecosystem-token'
    }
  }
} as const satisfies Record<string, ChainConfig>
export type ChainId = keyof typeof CHAIN_CONFIGS

export const DEFAULT_CHAIN_ID: ChainId = 'pulsechain'

export const SUPPORTED_CHAIN_IDS = Object.keys(
  CHAIN_CONFIGS
) as ChainId[]

export const ACTIVE_CHAIN_IDS = SUPPORTED_CHAIN_IDS.filter(
  (chainId) => CHAIN_CONFIGS[chainId].status === 'active'
)

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const getBase58DecodedLength = (value: string) => {
  if (!value) {
    return 0
  }

  const bytes: number[] = [0]
  for (const character of value) {
    const digit = BASE58_ALPHABET.indexOf(character)

    if (digit === -1) {
      return 0
    }

    let carry = digit

    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58
      bytes[index] = carry & 0xff
      carry >>= 8
    }

    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  let leadingZeros = 0
  while (
    leadingZeros < value.length &&
    value[leadingZeros] === '1'
  ) {
    leadingZeros += 1
  }

  return bytes.length + leadingZeros - (bytes.length === 1 && bytes[0] === 0 ? 1 : 0)
}

export function isSupportedChainId(value: string): value is ChainId {
  return value in CHAIN_CONFIGS
}

export function getChainConfig(chainId?: string | null): ChainConfig {
  if (chainId && isSupportedChainId(chainId)) {
    return CHAIN_CONFIGS[chainId]
  }

  return CHAIN_CONFIGS[DEFAULT_CHAIN_ID]
}
export function getDefaultChainConfig() {
  return CHAIN_CONFIGS[DEFAULT_CHAIN_ID]
}

export function getActiveChains() {
  return ACTIVE_CHAIN_IDS.map((chainId) => CHAIN_CONFIGS[chainId])
}

export function getRpcUrls(chainId?: string | null) {
  return [...getChainConfig(chainId).rpcUrls]
}

export function getPrimaryRpcUrl(chainId?: string | null) {
  const chain = getChainConfig(chainId)
  const rpcUrl = chain.rpcUrls[0]
  if (!rpcUrl) {
    throw new Error(`Não existe RPC configurado para ${chain.name}.`)
  }

  return rpcUrl
}

export function getExplorerAddressUrl(
  address: string,
  chainId?: string | null
) {
  return `${getChainConfig(chainId).explorer.addressUrl}/${address}`
}

export function getExplorerTransactionUrl(
  transactionHash: string,
  chainId?: string | null
) {
  return `${getChainConfig(chainId).explorer.transactionUrl}/${transactionHash}`
}
export function getExplorerTokenUrl(
  contractAddress: string,
  chainId?: string | null
) {
  return `${getChainConfig(chainId).explorer.tokenUrl}/${contractAddress}`
}

export function getExplorerApiUrl(chainId?: string | null) {
  return getChainConfig(chainId).explorer.apiUrl
}

export function getNativeCurrency(chainId?: string | null) {
  return getChainConfig(chainId).nativeCurrency
}
export function getWrappedNativeToken(chainId?: string | null) {
  return getChainConfig(chainId).price?.wrappedNativeToken || null
}

export function getPriceNetworkId(chainId?: string | null) {
  return getChainConfig(chainId).price?.networkId || null
}

export function getCoinGeckoCoinId(chainId?: string | null) {
  return getChainConfig(chainId).price?.coinGeckoId || null
}

export function getTokenStandard(chainId?: string | null) {
  return getChainConfig(chainId).tokenStandard
}
export function getAddressPlaceholder(chainId?: string | null) {
  return getChainConfig(chainId).addressPlaceholder
}

export function supportsTokens(chainId?: string | null) {
  return getChainConfig(chainId).capabilities.tokens
}

export function supportsTransactions(chainId?: string | null) {
  return getChainConfig(chainId).capabilities.transactions
}

export function supportsPrices(chainId?: string | null) {
  return getChainConfig(chainId).capabilities.prices
}
export function normalizeChainAddress(
  value: string,
  chainId: string = DEFAULT_CHAIN_ID
) {
  const clean = value.trim()
  const chain = getChainConfig(chainId)

  if (!clean) {
    return ''
  }

  if (chain.addressType === 'evm') {
    return clean.toLowerCase().startsWith('0x')
      ? `0x${clean.slice(2)}`
      : `0x${clean}`
  }

  if (
    chain.addressType === 'bitcoin' &&
    clean.toLowerCase().startsWith('bc1')
  ) {
    return clean.toLowerCase()
  }

  return clean
}
export function isValidChainAddress(
  value: string,
  chainId: string = DEFAULT_CHAIN_ID
) {
  const chain = getChainConfig(chainId)
  const address = normalizeChainAddress(value, chain.id)

  if (chain.addressType === 'evm') {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  if (chain.addressType === 'solana') {
    return (
      /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) &&
      getBase58DecodedLength(address) === 32
    )
  }
  if (chain.addressType === 'tron') {
    return (
      /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address) &&
      getBase58DecodedLength(address) === 25
    )
  }

  if (/^(bc1)[ac-hj-np-z02-9]{11,71}$/.test(address)) {
    return true
  }

  return (
    /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address) &&
    getBase58DecodedLength(address) === 25
  )
}
export function getCanonicalAddress(
  address: string,
  chainId: string = DEFAULT_CHAIN_ID
) {
  const normalized = normalizeChainAddress(address, chainId)
  const chain = getChainConfig(chainId)

  if (chain.addressType === 'evm') {
    return normalized.toLowerCase()
  }

  return normalized
}

export function createWalletStorageKey(
  chainId: string,
  address: string
) {
  const safeChainId = isSupportedChainId(chainId)
    ? chainId
    : DEFAULT_CHAIN_ID
  return `${safeChainId}:${getCanonicalAddress(address, safeChainId)}`
}

export function parseWalletStorageKey(value: string) {
  const separatorIndex = value.indexOf(':')

  if (separatorIndex === -1) {
    return {
      chainId: DEFAULT_CHAIN_ID,
      address: getCanonicalAddress(value, DEFAULT_CHAIN_ID)
    }
  }

  const possibleChainId = value.slice(0, separatorIndex).trim()
  const chainId = isSupportedChainId(possibleChainId)
    ? possibleChainId
    : DEFAULT_CHAIN_ID
  return {
    chainId,
    address: getCanonicalAddress(
      value.slice(separatorIndex + 1).trim(),
      chainId
    )
  }
}
