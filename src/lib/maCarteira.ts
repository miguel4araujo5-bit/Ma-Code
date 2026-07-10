import {
  DEFAULT_CHAIN_ID,
  createWalletStorageKey,
  getChainConfig,
  getExplorerAddressUrl,
  getExplorerApiUrl,
  getExplorerTokenUrl,
  getExplorerTransactionUrl,
  getPrimaryRpcUrl,
  isSupportedChainId,
  parseWalletStorageKey,
  type ChainId
} from './maCarteiraChains'

export const MA_CARTEIRA_URL = 'https://ma-code.pt/produtos/ma-carteira'

const DEFAULT_CHAIN = getChainConfig(DEFAULT_CHAIN_ID)

export const PULSECHAIN_EXPLORER = DEFAULT_CHAIN.explorer.addressUrl

const MAX_HISTORY = 120

const keys = {
  portfolio: 'ma_carteira_v1_portfolio',
  data: 'ma_carteira_v1_data',
  history: 'ma_carteira_v1_history',
  pulsefolioPortfolio: 'pulsefolio_v2_portfolio',
  pulsefolioData: 'pulsefolio_v2_data',
  pulsefolioHistory: 'pulsefolio_v2_history',
  legacyWallets: 'pulsefolio_wallets',
  legacyData: 'pulsefolio_data'
} as const

export type Wallet = {
  address: string
  name: string
  createdAt: string
  pinned: boolean
  chainId?: ChainId
}

export type PulseToken = {
  symbol?: string
  name?: string
  balance?: string
  decimals?: string | number
  contractAddress?: string
  address?: string
  type?: string
}

export type WalletData = {
  chainId: ChainId
  plsBalance: string | null
  tokens: PulseToken[]
  loading: boolean
  error: string | null
  lastUpdated: string | null
}

export type Snapshot = {
  id: string
  chainId: ChainId
  address: string
  walletName: string
  timestamp: string
  plsBalance: string
  tokenCount: number
  topTokens: Array<{
    symbol: string
    name: string
    balance: string
    decimals: string | number
    contractAddress: string | null
  }>
}

export type WalletDataMap = Record<string, WalletData>
export type HistoryMap = Record<string, Snapshot[]>

export type StoredState = {
  wallets: Wallet[]
  walletData: WalletDataMap
  history: HistoryMap
}

const emptyData = (
  chainId: ChainId = DEFAULT_CHAIN_ID
): WalletData => ({
  chainId,
  plsBalance: null,
  tokens: [],
  loading: false,
  error: null,
  lastUpdated: null
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readJson = (key: string): unknown => {
  try {
    const raw = localStorage.getItem(key)

    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const normalizeAddress = (value: string) => {
  const clean = value.trim()

  return clean && !clean.startsWith('0x') ? `0x${clean}` : clean
}

export const isValidAddress = (value: string) =>
  /^0x[a-fA-F0-9]{40}$/.test(value)

export const addressKey = (
  value: string,
  chainId: ChainId = DEFAULT_CHAIN_ID
) =>
  createWalletStorageKey(
    chainId,
    normalizeAddress(value)
  )

export const shortAddress = (value: string) =>
  `${value.slice(0, 6)}…${value.slice(-4)}`

export const getWalletChainId = (
  wallet: Pick<Wallet, 'chainId'>
): ChainId => wallet.chainId || DEFAULT_CHAIN_ID

export const getWalletExplorerUrl = (
  wallet: Pick<Wallet, 'address' | 'chainId'>
) =>
  getExplorerAddressUrl(
    wallet.address,
    getWalletChainId(wallet)
  )

export const getAddressExplorerUrl = (
  address: string,
  chainId: ChainId = DEFAULT_CHAIN_ID
) => getExplorerAddressUrl(address, chainId)

export const getTransactionExplorerUrl = (
  transactionHash: string,
  chainId: ChainId = DEFAULT_CHAIN_ID
) =>
  getExplorerTransactionUrl(
    transactionHash,
    chainId
  )

export const getTokenExplorerUrl = (
  contractAddress: string,
  chainId: ChainId = DEFAULT_CHAIN_ID
) =>
  getExplorerTokenUrl(
    contractAddress,
    chainId
  )

const cleanWallets = (value: unknown): Wallet[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.address !== 'string') {
      return []
    }

    const address = normalizeAddress(item.address)

    if (!isValidAddress(address)) {
      return []
    }

    const chainId =
      typeof item.chainId === 'string' &&
      isSupportedChainId(item.chainId)
        ? item.chainId
        : DEFAULT_CHAIN_ID

    return [
      {
        address,
        name:
          typeof item.name === 'string' && item.name.trim()
            ? item.name.trim().slice(0, 40)
            : `Carteira ${index + 1}`,
        createdAt:
          typeof item.createdAt === 'string'
            ? item.createdAt
            : new Date().toISOString(),
        pinned: Boolean(item.pinned),
        chainId
      }
    ]
  })
}

const cleanData = (value: unknown): WalletDataMap => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (!isRecord(item)) {
        return []
      }

      const parsedKey = parseWalletStorageKey(key)

      const chainId =
        typeof item.chainId === 'string' &&
        isSupportedChainId(item.chainId)
          ? item.chainId
          : parsedKey.chainId

      return [
        [
          addressKey(parsedKey.address, chainId),
          {
            chainId,
            plsBalance:
              typeof item.plsBalance === 'string'
                ? item.plsBalance
                : null,
            tokens: Array.isArray(item.tokens)
              ? (item.tokens as PulseToken[])
              : [],
            loading: false,
            error:
              typeof item.error === 'string'
                ? item.error
                : null,
            lastUpdated:
              typeof item.lastUpdated === 'string'
                ? item.lastUpdated
                : null
          } satisfies WalletData
        ]
      ]
    })
  )
}

const cleanHistory = (value: unknown): HistoryMap => {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, list]) => {
      if (!Array.isArray(list)) {
        return []
      }

      const parsedKey = parseWalletStorageKey(key)
      const firstSnapshot = list.find(isRecord)

      const chainId =
        firstSnapshot &&
        typeof firstSnapshot.chainId === 'string' &&
        isSupportedChainId(firstSnapshot.chainId)
          ? firstSnapshot.chainId
          : parsedKey.chainId

      const snapshots = list
        .flatMap((item): Snapshot[] => {
          if (
            !isRecord(item) ||
            typeof item.timestamp !== 'string' ||
            typeof item.plsBalance !== 'string'
          ) {
            return []
          }

          const snapshotChainId =
            typeof item.chainId === 'string' &&
            isSupportedChainId(item.chainId)
              ? item.chainId
              : chainId

          return [
            {
              id:
                typeof item.id === 'string'
                  ? item.id
                  : crypto.randomUUID(),
              chainId: snapshotChainId,
              address:
                typeof item.address === 'string'
                  ? item.address
                  : parsedKey.address,
              walletName:
                typeof item.walletName === 'string'
                  ? item.walletName
                  : shortAddress(parsedKey.address),
              timestamp: item.timestamp,
              plsBalance: item.plsBalance,
              tokenCount:
                typeof item.tokenCount === 'number'
                  ? item.tokenCount
                  : 0,
              topTokens: Array.isArray(item.topTokens)
                ? (item.topTokens as Snapshot['topTokens'])
                : []
            }
          ]
        })
        .slice(0, MAX_HISTORY)

      return snapshots.length
        ? [
            [
              addressKey(
                parsedKey.address,
                chainId
              ),
              snapshots
            ]
          ]
        : []
    })
  )
}

export function loadState(): StoredState {
  const currentPortfolio = readJson(keys.portfolio)
  const oldPortfolio = readJson(keys.pulsefolioPortfolio)
  const legacyWallets = readJson(keys.legacyWallets)

  let wallets: Wallet[] = []

  if (isRecord(currentPortfolio)) {
    wallets = cleanWallets(currentPortfolio.wallets)
  }

  if (!wallets.length && isRecord(oldPortfolio)) {
    wallets = cleanWallets(oldPortfolio.wallets)
  }

  if (!wallets.length && Array.isArray(legacyWallets)) {
    wallets = cleanWallets(
      legacyWallets.map((address, index) => ({
        address,
        name: `Carteira ${index + 1}`
      }))
    )
  }

  const currentData = cleanData(
    readJson(keys.data)
  )

  const oldData = cleanData(
    readJson(keys.pulsefolioData)
  )

  const legacyData = cleanData(
    readJson(keys.legacyData)
  )

  const currentHistory = cleanHistory(
    readJson(keys.history)
  )

  const oldHistory = cleanHistory(
    readJson(keys.pulsefolioHistory)
  )

  const state = {
    wallets,
    walletData: Object.keys(currentData).length
      ? currentData
      : Object.keys(oldData).length
        ? oldData
        : legacyData,
    history: Object.keys(currentHistory).length
      ? currentHistory
      : oldHistory
  }

  saveState(state)

  return state
}

export function saveState({
  wallets,
  walletData,
  history
}: StoredState) {
  localStorage.setItem(
    keys.portfolio,
    JSON.stringify({
      version: 2,
      updatedAt: new Date().toISOString(),
      wallets: wallets.map((wallet) => ({
        ...wallet,
        chainId: getWalletChainId(wallet)
      }))
    })
  )

  localStorage.setItem(
    keys.data,
    JSON.stringify(walletData)
  )

  localStorage.setItem(
    keys.history,
    JSON.stringify(history)
  )
}

export function clearStoredState() {
  localStorage.removeItem(keys.portfolio)
  localStorage.removeItem(keys.data)
  localStorage.removeItem(keys.history)
}

export function formatBalance(
  raw: string | bigint | null,
  decimals = 18,
  maxFraction = 6
) {
  if (!raw) {
    return '0'
  }

  try {
    const value =
      typeof raw === 'bigint'
        ? raw
        : BigInt(raw)

    const divisor = 10n ** BigInt(decimals)
    const whole = value / divisor

    let fraction = (value % divisor)
      .toString()
      .padStart(decimals, '0')
      .replace(/0+$/, '')

    fraction = fraction.slice(
      0,
      maxFraction
    )

    const formattedWhole =
      new Intl.NumberFormat(
        'pt-PT'
      ).format(whole)

    return fraction
      ? `${formattedWhole},${fraction}`
      : formattedWhole
  } catch {
    return String(raw)
  }
}

export function formatDateTime(
  value: string | null
) {
  if (!value) {
    return 'Nunca'
  }

  return new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

const tokenValue = (token: PulseToken) => {
  try {
    const decimals = Number(
      token.decimals ?? 18
    )

    const balance = BigInt(
      token.balance ?? '0'
    )

    return (
      balance /
      10n **
        BigInt(
          Math.max(
            0,
            decimals - 6
          )
        )
    )
  } catch {
    return 0n
  }
}

export async function fetchWallet(
  address: string,
  chainId: ChainId = DEFAULT_CHAIN_ID
): Promise<WalletData> {
  const chain = getChainConfig(chainId)
  const rpcUrl = getPrimaryRpcUrl(chainId)

  const explorerApiUrl =
    getExplorerApiUrl(chainId)

  const rpcPromise = fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBalance',
      params: [address, 'latest'],
      id: Date.now()
    })
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Erro ao consultar o saldo ${chain.nativeCurrency.symbol}.`
      )
    }

    const data = (await response.json()) as {
      result?: string
      error?: {
        message?: string
      }
    }

    if (data.error || !data.result) {
      throw new Error(
        data.error?.message ||
          `Saldo ${chain.nativeCurrency.symbol} indisponível.`
      )
    }

    return data.result
  })

  const tokenPromise = fetch(
    `${explorerApiUrl}?module=account&action=tokenlist&address=${encodeURIComponent(
      address
    )}`
  ).then(async (response) => {
    if (!response.ok) {
      throw new Error(
        `Erro ao consultar tokens em ${chain.name}.`
      )
    }

    const data = (await response.json()) as {
      message?: string
      result?: PulseToken[]
    }

    if (
      data.message !== 'OK' ||
      !Array.isArray(data.result)
    ) {
      return []
    }

    return data.result
      .filter(
        (token) =>
          token.type === 'ERC-20' &&
          token.balance &&
          token.balance !== '0'
      )
      .sort((a, b) =>
        tokenValue(a) === tokenValue(b)
          ? 0
          : tokenValue(a) > tokenValue(b)
            ? -1
            : 1
      )
  })

  const [plsBalance, tokens] =
    await Promise.all([
      rpcPromise,
      tokenPromise
    ])

  return {
    chainId,
    plsBalance,
    tokens,
    loading: false,
    error: null,
    lastUpdated: new Date().toISOString()
  }
}

export function createSnapshot(
  wallet: Wallet,
  data: WalletData
): Snapshot {
  const chainId =
    getWalletChainId(wallet)

  return {
    id: crypto.randomUUID(),
    chainId,
    address: wallet.address,
    walletName: wallet.name,
    timestamp: new Date().toISOString(),
    plsBalance: data.plsBalance || '0',
    tokenCount: data.tokens.length,
    topTokens: data.tokens
      .slice(0, 12)
      .map((token) => ({
        symbol: token.symbol || '???',
        name:
          token.name ||
          token.symbol ||
          'Token',
        balance: token.balance || '0',
        decimals: token.decimals || 18,
        contractAddress:
          token.contractAddress ||
          token.address ||
          null
      }))
  }
}

export function addSnapshot(
  history: HistoryMap,
  wallet: Wallet,
  data: WalletData
): HistoryMap {
  const key = addressKey(
    wallet.address,
    getWalletChainId(wallet)
  )

  return {
    ...history,
    [key]: [
      createSnapshot(
        wallet,
        data
      ),
      ...(history[key] || [])
    ].slice(0, MAX_HISTORY)
  }
}

export function exportState(
  state: StoredState
) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          app: 'MA-Carteira',
          version: 2,
          exportedAt:
            new Date().toISOString(),
          ...state
        },
        null,
        2
      )
    ],
    {
      type: 'application/json'
    }
  )

  const url =
    URL.createObjectURL(blob)

  const link =
    document.createElement('a')

  link.href = url

  link.download = `ma-carteira-${new Date()
    .toISOString()
    .slice(0, 10)}.json`

  link.click()

  URL.revokeObjectURL(url)
}

export async function importState(
  file: File,
  current: StoredState
): Promise<StoredState> {
  const parsed = JSON.parse(
    await file.text()
  ) as Record<string, unknown>

  const incomingWallets = cleanWallets(
    parsed.wallets
  )

  if (!incomingWallets.length) {
    throw new Error(
      'O ficheiro não contém carteiras válidas.'
    )
  }

  const currentWallets =
    current.wallets.map(
      (wallet) => ({
        ...wallet,
        chainId:
          getWalletChainId(wallet)
      })
    )

  const existing = new Set(
    currentWallets.map((wallet) =>
      addressKey(
        wallet.address,
        getWalletChainId(wallet)
      )
    )
  )

  const wallets = [
    ...currentWallets,
    ...incomingWallets.filter(
      (wallet) =>
        !existing.has(
          addressKey(
            wallet.address,
            getWalletChainId(wallet)
          )
        )
    )
  ]

  return {
    wallets,
    walletData: {
      ...cleanData(
        parsed.walletData
      ),
      ...current.walletData
    },
    history: {
      ...cleanHistory(
        parsed.history
      ),
      ...current.history
    }
  }
}

export function setPageMetadata() {
  const setMeta = (
    selector: string,
    attr: 'name' | 'property',
    key: string,
    content: string
  ) => {
    let element =
      document.querySelector<HTMLMetaElement>(
        selector
      )

    if (!element) {
      element =
        document.createElement('meta')

      element.setAttribute(
        attr,
        key
      )

      document.head.appendChild(
        element
      )
    }

    element.content = content
  }

  document.title =
    'MA-Carteira | Portefólio PulseChain | MA-Code'

  const description =
    'Acompanhe endereços públicos PulseChain, saldos PLS, tokens ERC-20 e histórico local, sem ligar a carteira nem partilhar chaves privadas.'

  setMeta(
    'meta[name="description"]',
    'name',
    'description',
    description
  )

  setMeta(
    'meta[name="keywords"]',
    'name',
    'keywords',
    'MA-Carteira, PulseChain, carteira PulseChain, portefólio crypto, saldo PLS, tokens ERC-20, MA-Code'
  )

  setMeta(
    'meta[name="robots"]',
    'name',
    'robots',
    'index, follow, max-image-preview:large, max-snippet:-1'
  )

  setMeta(
    'meta[property="og:type"]',
    'property',
    'og:type',
    'website'
  )

  setMeta(
    'meta[property="og:site_name"]',
    'property',
    'og:site_name',
    'MA-Code'
  )

  setMeta(
    'meta[property="og:url"]',
    'property',
    'og:url',
    MA_CARTEIRA_URL
  )

  setMeta(
    'meta[property="og:title"]',
    'property',
    'og:title',
    'MA-Carteira | Portefólio PulseChain'
  )

  setMeta(
    'meta[property="og:description"]',
    'property',
    'og:description',
    description
  )

  setMeta(
    'meta[property="og:image"]',
    'property',
    'og:image',
    'https://ma-code.pt/ma-code.png'
  )

  setMeta(
    'meta[name="twitter:card"]',
    'name',
    'twitter:card',
    'summary_large_image'
  )

  setMeta(
    'meta[name="twitter:title"]',
    'name',
    'twitter:title',
    'MA-Carteira | Portefólio PulseChain'
  )

  setMeta(
    'meta[name="twitter:description"]',
    'name',
    'twitter:description',
    description
  )

  setMeta(
    'meta[name="twitter:image"]',
    'name',
    'twitter:image',
    'https://ma-code.pt/ma-code.png'
  )

  let canonical =
    document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    )

  if (!canonical) {
    canonical =
      document.createElement('link')

    canonical.rel = 'canonical'

    document.head.appendChild(
      canonical
    )
  }

  canonical.href =
    MA_CARTEIRA_URL

  let schema =
    document.querySelector<HTMLScriptElement>(
      'script[data-schema-id="ma-carteira"]'
    )

  if (!schema) {
    schema =
      document.createElement('script')

    schema.type =
      'application/ld+json'

    schema.dataset.schemaId =
      'ma-carteira'

    document.head.appendChild(
      schema
    )
  }

  schema.textContent =
    JSON.stringify({
      '@context':
        'https://schema.org',
      '@type':
        'SoftwareApplication',
      name:
        'MA-Carteira',
      applicationCategory:
        'FinanceApplication',
      operatingSystem:
        'Web',
      url:
        MA_CARTEIRA_URL,
      description,
      creator: {
        '@type':
          'Organization',
        name:
          'MA-Code',
        url:
          'https://ma-code.pt'
      },
      offers: {
        '@type':
          'Offer',
        price:
          '0',
        priceCurrency:
          'EUR',
        description:
          'Funcionalidades locais gratuitas; conta cloud em preparação.'
      }
    })
}

export { emptyData }
