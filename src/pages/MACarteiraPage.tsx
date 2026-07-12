import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react'

import {
  addSnapshot,
  addressKey,
  clearStoredState,
  emptyData,
  exportState,
  fetchWallet,
  formatBalance,
  formatDateTime,
  getTokenExplorerUrl,
  getWalletChainId,
  getWalletExplorerUrl,
  importState,
  isValidAddress,
  loadState,
  normalizeAddress,
  saveState,
  setPageMetadata,
  shortAddress,
  type HistoryMap,
  type PulseToken,
  type Wallet,
  type WalletDataMap
} from '../lib/maCarteira'

import {
  DEFAULT_CHAIN_ID,
  getActiveChains,
  getAddressPlaceholder,
  getChainConfig,
  getNativeCurrency,
  getTokenStandard,
  getWrappedNativeToken,
  supportsPrices,
  supportsTokens,
  supportsTransactions,
  type ChainId
} from '../lib/maCarteiraChains'

import TokenPricePanel from '../components/ma-carteira/TokenPricePanel'
import WalletTransactionsPanel from '../components/ma-carteira/WalletTransactionsPanel'

type Toast = {
  message: string
  error?: boolean
} | null

type SelectedTokenPrice = {
  chainId: ChainId
  contractAddress: string
  symbol: string
  name: string
}

const actionButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

function TokenList({
  tokens,
  chainId,
  onOpenPrice
}: {
  tokens: PulseToken[]
  chainId: ChainId
  onOpenPrice: (
    token: SelectedTokenPrice
  ) => void
}) {
  if (!tokens.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
        {supportsTokens(chainId)
          ? `Não foram encontrados outros ${getTokenStandard(chainId) || 'tokens'} com saldo.`
          : 'A listagem de tokens ainda não está disponível nesta rede.'}
      </p>
    )
  }

  return (
    <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
      {tokens.map((token, index) => {
        const contract =
          token.contractAddress || token.address

        const content = (
          <>
            <span className="min-w-0">
              <strong className="block truncate text-sm text-white">
                {token.symbol || 'Token'}
              </strong>

              <span className="block truncate text-xs text-slate-500">
                {token.name || getTokenStandard(chainId) || 'Token'}
              </span>
            </span>

            <span className="shrink-0 text-right font-mono text-sm text-emerald-200">
              {formatBalance(
                token.balance || '0',
                Number(token.decimals || 18),
                4
              )}
            </span>
          </>
        )

        if (!contract) {
          return (
            <div
              key={`${token.symbol}-${index}`}
              className="flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5"
            >
              {content}
            </div>
          )
        }

        return (
          <div
            key={`${contract}-${index}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-3 py-2.5 transition hover:bg-white/[0.05]"
          >
            <a
              href={getTokenExplorerUrl(
                contract,
                chainId
              )}
              target="_blank"
              rel="noreferrer noopener"
              className="flex min-w-0 items-center justify-between gap-4"
              title="Abrir token no explorador"
            >
              {content}
            </a>

            {supportsPrices(chainId) &&
            getChainConfig(chainId).price?.provider ===
              'geckoterminal' ? (
              <button
                type="button"
                onClick={() =>
                  onOpenPrice({
                    chainId,
                    contractAddress: contract,
                    symbol:
                      token.symbol || 'TOKEN',
                    name:
                      token.name ||
                      token.symbol ||
                      'Token'
                  })
                }
                className="min-h-9 shrink-0 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-2.5 text-xs font-bold text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/15 hover:text-white"
                aria-label={`Ver gráfico de preço de ${
                  token.symbol || 'token'
                }`}
              >
                Ver gráfico
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function NativeAssetRow({
  chainId,
  balance,
  loading,
  error,
  onOpenPrice
}: {
  chainId: ChainId
  balance: string
  loading: boolean
  error: string | null
  onOpenPrice: (
    token: SelectedTokenPrice
  ) => void
}) {
  const chain =
    getChainConfig(chainId)

  const nativeCurrency =
    getNativeCurrency(chainId)

  const wrappedNativeToken =
    getWrappedNativeToken(chainId)

  const nativePriceReference =
    chain.price?.provider ===
    'coingecko-market'
      ? `native:${chainId}`
      : wrappedNativeToken

  const canOpenPrice =
    supportsPrices(chainId) &&
    Boolean(nativePriceReference)

  const formattedBalance =
    loading && !balance
      ? 'A atualizar…'
      : error
        ? 'Erro'
        : balance
          ? formatBalance(
              balance,
              nativeCurrency.decimals,
              6
            )
          : '—'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl bg-emerald-300/[0.045] px-3 py-2.5 ring-1 ring-inset ring-emerald-300/10">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <span className="min-w-0">
          <strong className="block truncate text-sm text-white">
            {nativeCurrency.symbol}
          </strong>

          <span className="block truncate text-xs text-slate-500">
            {nativeCurrency.name} · Ativo nativo
          </span>
        </span>

        <span className="shrink-0 text-right font-mono text-sm text-emerald-200">
          {formattedBalance}
        </span>
      </div>

      <button
        type="button"
        disabled={!canOpenPrice}
        onClick={() => {
          if (
            !canOpenPrice ||
            !nativePriceReference
          ) {
            return
          }

          onOpenPrice({
            chainId,
            contractAddress:
              nativePriceReference,
            symbol:
              nativeCurrency.symbol,
            name:
              nativeCurrency.name
          })
        }}
        className="min-h-9 shrink-0 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] px-2.5 text-xs font-bold text-emerald-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Ver gráfico de preço de ${nativeCurrency.symbol}`}
      >
        Ver gráfico
      </button>
    </div>
  )
}

export default function MACarteiraPage() {
  const initial = useMemo(
    () => loadState(),
    []
  )

  const [wallets, setWallets] =
    useState<Wallet[]>(initial.wallets)

  const [walletData, setWalletData] =
    useState<WalletDataMap>(
      initial.walletData
    )

  const [history, setHistory] =
    useState<HistoryMap>(initial.history)

  const [walletName, setWalletName] =
    useState('')

  const [walletAddress, setWalletAddress] =
    useState('')

  const [walletChainId, setWalletChainId] =
    useState<ChainId>(DEFAULT_CHAIN_ID)

  const activeChains = useMemo(
    () => getActiveChains(),
    []
  )

  const selectedChain = getChainConfig(
    walletChainId
  )

  const [search, setSearch] = useState('')

  const [
    selectedHistory,
    setSelectedHistory
  ] = useState<string | null>(null)

  const [
    selectedTransactions,
    setSelectedTransactions
  ] = useState<string | null>(null)

  const [toast, setToast] =
    useState<Toast>(null)

  const [
    selectedTokenPrice,
    setSelectedTokenPrice
  ] = useState<SelectedTokenPrice | null>(
    null
  )

  const autoRefreshStarted = useRef(false)
  const storageWarningShown = useRef(false)

  const importInput =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPageMetadata()
  }, [])

  useEffect(() => {
    const saved = saveState({
      wallets,
      walletData,
      history
    })

    if (
      !saved &&
      !storageWarningShown.current
    ) {
      storageWarningShown.current = true

      setToast({
        message:
          'O navegador não permitiu guardar os dados locais. Exporte uma cópia para não perder os endereços e registos.',
        error: true
      })
    }
  }, [wallets, walletData, history])

  useEffect(() => {
    if (
      !selectedHistory &&
      !selectedTransactions &&
      !selectedTokenPrice
    ) {
      return
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key !== 'Escape') {
        return
      }

      setSelectedHistory(null)
      setSelectedTransactions(null)
      setSelectedTokenPrice(null)
    }

    document.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () =>
      document.removeEventListener(
        'keydown',
        handleKeyDown
      )
  }, [
    selectedHistory,
    selectedTransactions,
    selectedTokenPrice
  ])

  useEffect(() => {
    if (!toast) {
      return
    }

    const timer = window.setTimeout(
      () => setToast(null),
      2600
    )

    return () =>
      window.clearTimeout(timer)
  }, [toast])

  const showToast = (
    message: string,
    error = false
  ) => {
    setToast({
      message,
      error
    })
  }

  const refreshAddresses = async (
    walletsToRefresh: Wallet[]
  ) => {
    if (!walletsToRefresh.length) {
      return
    }

    const keys = new Set(
      walletsToRefresh.map((wallet) =>
        addressKey(
          wallet.address,
          getWalletChainId(wallet)
        )
      )
    )

    setWalletData((current) => {
      const next = {
        ...current
      }

      walletsToRefresh.forEach((wallet) => {
        const chainId = getWalletChainId(wallet)
        const key = addressKey(wallet.address, chainId)

        next[key] = {
          ...(current[key] || emptyData(chainId)),
          loading: true,
          error: null
        }
      })

      return Object.fromEntries(
        Object.entries(next).map(([key, data]) => [
          key,
          keys.has(key)
            ? {
                ...data,
                loading: true,
                error: null
              }
            : data
        ])
      )
    })

    const results = await Promise.all(
      walletsToRefresh.map(async (wallet) => {
        const chainId = getWalletChainId(wallet)

        try {
          return {
            wallet,
            data: await fetchWallet(
              wallet.address,
              chainId
            ),
            error: null
          }
        } catch (error) {
          return {
            wallet,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Não foi possível atualizar este endereço.'
          }
        }
      })
    )

    setWalletData((current) => {
      const next = {
        ...current
      }

      results.forEach((result) => {
        const chainId = getWalletChainId(
          result.wallet
        )
        const key = addressKey(
          result.wallet.address,
          chainId
        )

        next[key] =
          result.data || {
            ...(current[key] || emptyData(chainId)),
            loading: false,
            error: result.error,
            lastUpdated:
              new Date().toISOString()
          }
      })

      return next
    })

    setHistory((current) => {
      let next = current

      results.forEach((result) => {
        if (!result.data) {
          return
        }

        next = addSnapshot(
          next,
          result.wallet,
          result.data
        )
      })

      return next
    })

    if (
      results.some((result) => result.error)
    ) {
      showToast(
        'Alguns endereços não puderam ser atualizados.',
        true
      )
    }
  }

  useEffect(() => {
    if (
      autoRefreshStarted.current ||
      !wallets.length
    ) {
      return
    }

    autoRefreshStarted.current = true

    const stale = wallets.filter(
      (wallet) => {
        const lastUpdated =
          walletData[
            addressKey(
              wallet.address,
              getWalletChainId(wallet)
            )
          ]?.lastUpdated

        return (
          !lastUpdated ||
          Date.now() -
            new Date(
              lastUpdated
            ).getTime() >
            5 * 60 * 1000
        )
      }
    )

    void refreshAddresses(stale)

    // Executar apenas na abertura da página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredWallets = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase()

    return [...wallets]
      .sort(
        (a, b) =>
          Number(b.pinned) -
            Number(a.pinned) ||
          a.name.localeCompare(
            b.name,
            'pt'
          )
      )
      .filter(
        (wallet) =>
          !query ||
          wallet.name
            .toLowerCase()
            .includes(query) ||
          wallet.address
            .toLowerCase()
            .includes(query) ||
          getChainConfig(
            getWalletChainId(wallet)
          ).name
            .toLowerCase()
            .includes(query)
      )
  }, [search, wallets])

  const networkCount = useMemo(
    () =>
      new Set(
        wallets.map((wallet) =>
          getWalletChainId(wallet)
        )
      ).size,
    [wallets]
  )

  const snapshotCount = useMemo(
    () =>
      Object.values(history).reduce(
        (total, snapshots) =>
          total + snapshots.length,
        0
      ),
    [history]
  )

  const handleAddWallet = async (
    event: FormEvent
  ) => {
    event.preventDefault()

    const address = normalizeAddress(
      walletAddress,
      walletChainId
    )

    if (!isValidAddress(address, walletChainId)) {
      showToast(
        `Introduza um endereço válido para ${selectedChain.name}.`,
        true
      )

      return
    }

    if (
      wallets.some(
        (wallet) =>
          addressKey(
            wallet.address,
            getWalletChainId(wallet)
          ) ===
          addressKey(address, walletChainId)
      )
    ) {
      showToast(
        'Este endereço já está guardado.',
        true
      )

      return
    }

    const wallet: Wallet = {
      address,
      chainId: walletChainId,
      name:
        walletName.trim().slice(0, 40) ||
        `Endereço ${wallets.length + 1}`,
      createdAt:
        new Date().toISOString(),
      pinned: false
    }

    setWallets((current) => [
      ...current,
      wallet
    ])

    setWalletData((current) => ({
      ...current,
      [addressKey(address, walletChainId)]: {
        ...emptyData(walletChainId),
        loading: true
      }
    }))

    setWalletName('')
    setWalletAddress('')

    await refreshAddresses([wallet])

    showToast('Endereço adicionado.')
  }

  const renameWallet = (wallet: Wallet) => {
    const name = window
      .prompt(
        'Nome do endereço:',
        wallet.name
      )
      ?.trim()

    if (!name) {
      return
    }

    setWallets((current) =>
      current.map((item) =>
        addressKey(
          item.address,
          getWalletChainId(item)
        ) ===
        addressKey(
          wallet.address,
          getWalletChainId(wallet)
        )
          ? {
              ...item,
              name: name.slice(0, 40)
            }
          : item
      )
    )
  }

  const removeWallet = (wallet: Wallet) => {
    if (
      !window.confirm(
        `Remover “${wallet.name}” deste dispositivo?`
      )
    ) {
      return
    }

    const key = addressKey(
      wallet.address,
      getWalletChainId(wallet)
    )

    setWallets((current) =>
      current.filter(
        (item) =>
          addressKey(
            item.address,
            getWalletChainId(item)
          ) !== key
      )
    )

    setWalletData((current) => {
      const next = {
        ...current
      }

      delete next[key]

      return next
    })

    if (selectedHistory === key) {
      setSelectedHistory(null)
    }

    if (selectedTransactions === key) {
      setSelectedTransactions(null)
    }

    showToast('Endereço removido.')
  }

  const clearAll = () => {
    if (
      !window.confirm(
        'Apagar todos os endereços, saldos e registos guardados neste dispositivo?'
      )
    ) {
      return
    }

    setWallets([])
    setWalletData({})
    setHistory({})

    const cleared =
      clearStoredState()

    showToast(
      cleared
        ? 'Dados locais apagados.'
        : 'Os dados foram removidos da aplicação, mas o navegador não permitiu limpar todo o armazenamento local.',
      !cleared
    )
  }

  const copyAddress = async (
    address: string
  ) => {
    try {
      await navigator.clipboard.writeText(
        address
      )
    } catch {
      const input =
        document.createElement('textarea')

      input.value = address

      document.body.appendChild(input)

      input.select()
      document.execCommand('copy')
      input.remove()
    }

    showToast('Endereço copiado.')
  }

  const handleImport = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const next = await importState(
        file,
        {
          wallets,
          walletData,
          history
        }
      )

      setWallets(next.wallets)
      setWalletData(next.walletData)
      setHistory(next.history)

      showToast('Dados importados.')
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Não foi possível importar o ficheiro.',
        true
      )
    }
  }

  const selectedWallet = selectedHistory
    ? wallets.find(
        (wallet) =>
          addressKey(
            wallet.address,
            getWalletChainId(wallet)
          ) === selectedHistory
      )
    : null

  const selectedSnapshots =
    selectedHistory
      ? history[selectedHistory] || []
      : []

  const selectedTransactionsWallet =
    selectedTransactions
      ? wallets.find(
          (wallet) =>
            addressKey(
              wallet.address,
              getWalletChainId(wallet)
            ) === selectedTransactions
        ) || null
      : null

  return (
    <main className="site-shell">
      <div className="site-bg-orb site-bg-orb-one" />
      <div className="site-bg-orb site-bg-orb-two" />
      <div className="site-grid" />
      <div className="site-noise" />

      <section className="relative z-10 px-5 pb-20 pt-6 sm:px-6 md:px-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <a
              href="/"
              className="brand-mark"
              aria-label="MA-Code.pt - Página inicial"
            >
              <img
                src="/ma-code.png"
                alt="MA-Code.pt"
                loading="eager"
                decoding="async"
              />

              <span>MA-Code.pt</span>
            </a>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/produtos"
                className={actionButton}
              >
                Produtos
              </a>

              <a
                href="/produtos/ma-carteira"
                className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-100"
              >
                MA-Carteira
              </a>
            </div>
          </header>

          <div className="mb-8 grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
            <div className="animate-fade-in-up">
              <div className="hero-topline border-emerald-300/20 text-emerald-100">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.75)]" />

                <span>
                  Produto MA-Code · Portefólios multichain
                </span>
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Todos os seus endereços públicos,{' '}
                <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-sky-300 bg-clip-text text-transparent">
                  organizados num só portefólio
                </span>
                .
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                Adicione endereços de PulseChain, Ethereum, BNB Chain, Solana, TRON, Bitcoin, Base, Arbitrum e Polygon. Consulte saldos, tokens, gráficos e transações conforme as capacidades públicas de cada rede.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-emerald-100">
                  Apenas leitura
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200">
                  Sem ligar a carteira
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200">
                  Dados guardados neste dispositivo
                </span>
              </div>
            </div>

            <div
              className="relative hidden lg:block"
              aria-hidden="true"
            >
              <div className="absolute inset-x-8 bottom-0 h-16 rounded-full bg-emerald-300/20 blur-3xl" />

              <div className="relative rounded-[2rem] border border-emerald-300/20 bg-slate-950/70 p-5 shadow-2xl shadow-emerald-950/30 backdrop-blur">
                <div className="flex aspect-square flex-col items-center justify-center rounded-[1.6rem] border border-emerald-200/25 bg-emerald-300/[0.06] text-center">
                  <span className="text-6xl">
                    ◈
                  </span>

                  <strong className="mt-4 text-3xl tracking-tight text-white">
                    MA
                  </strong>

                  <span className="text-lg font-semibold text-emerald-200">
                    Carteira
                  </span>
                </div>
              </div>
            </div>
          </div>

          <section
            className="mb-6 grid gap-4 md:grid-cols-3"
            aria-label="Resumo do portefólio consolidado"
          >
            {[
              [
                'End
