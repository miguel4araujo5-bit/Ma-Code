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

            {supportsPrices(chainId) ? (
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
  const nativeCurrency =
    getNativeCurrency(chainId)

  const wrappedNativeToken =
    getWrappedNativeToken(chainId)

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
        disabled={!wrappedNativeToken}
        onClick={() => {
          if (!wrappedNativeToken) {
            return
          }

          onOpenPrice({
            chainId,
            contractAddress:
              wrappedNativeToken,
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
                'Endereços',
                wallets.length.toString(),
                'Endereços monitorizados'
              ],
              [
                'Redes em uso',
                networkCount.toString(),
                'Redes com endereços guardados'
              ],
              [
                'Registos de saldo',
                snapshotCount.toString(),
                'Atualizações guardadas'
              ]
            ].map(
              ([
                label,
                value,
                description
              ]) => (
                <article
                  key={label}
                  className="rounded-[1.7rem] border border-white/10 bg-slate-950/60 p-5 shadow-xl shadow-black/10 backdrop-blur"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200/80">
                    {label}
                  </span>

                  <strong className="mt-2 block break-words text-3xl font-semibold tracking-tight text-white">
                    {value}
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    {description}
                  </p>
                </article>
              )
            )}
          </section>

          <form
            onSubmit={handleAddWallet}
            className="mb-6 rounded-[2rem] border border-emerald-300/15 bg-slate-950/65 p-5 shadow-2xl shadow-black/20 backdrop-blur md:p-6"
          >
            <div className="mb-5">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                Adicionar um endereço
              </span>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Dê um nome ao endereço para o
                identificar facilmente no seu
                portefólio.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-[220px_220px_minmax(0,1fr)_auto] xl:items-end">
              <div>
                <label
                  htmlFor="wallet-name"
                  className="input-label"
                >
                  Nome para identificar
                </label>

                <input
                  id="wallet-name"
                  className="input-field"
                  value={walletName}
                  maxLength={40}
                  onChange={(event) =>
                    setWalletName(
                      event.target.value
                    )
                  }
                  placeholder="Principal, Bot 01, Poupança…"
                />
              </div>

              <div>
                <label
                  htmlFor="wallet-chain"
                  className="input-label"
                >
                  Rede
                </label>

                <select
                  id="wallet-chain"
                  className="input-field"
                  value={walletChainId}
                  onChange={(event) => {
                    setWalletChainId(
                      event.target.value as ChainId
                    )
                    setWalletAddress('')
                  }}
                >
                  {activeChains.map((chain) => (
                    <option
                      key={chain.id}
                      value={chain.id}
                    >
                      {chain.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="wallet-address"
                  className="input-label"
                >
                  Endereço público {selectedChain.name}
                </label>

                <input
                  id="wallet-address"
                  className="input-field font-mono"
                  value={walletAddress}
                  onChange={(event) =>
                    setWalletAddress(
                      event.target.value
                    )
                  }
                  placeholder={getAddressPlaceholder(walletChainId)}
                  autoComplete="off"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary hightech-button min-w-44"
              >
                <span className="btn-shine" />

                <span className="relative z-10">
                  + Adicionar endereço
                </span>
              </button>
            </div>

            <p className="mt-4 text-xs leading-6 text-slate-500">
              Só precisa de introduzir um endereço
              público. A MA-Carteira nunca pede seed
              phrase, chave privada, palavra-passe ou
              autorização para movimentar fundos.
            </p>
          </form>

          <section className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 backdrop-blur">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Os seus endereços
            </h2>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <label
                  htmlFor="wallet-search"
                  className="sr-only"
                >
                  Pesquisar endereços
                </label>

                <input
                  id="wallet-search"
                  type="search"
                  className="input-field"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Pesquisar por nome ou endereço"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={actionButton}
                  disabled={!wallets.length}
                  onClick={() =>
                    void refreshAddresses(wallets)
                  }
                >
                  ↻ Atualizar todos
                </button>

                <button
                  type="button"
                  className={actionButton}
                  disabled={!wallets.length}
                  onClick={() =>
                    exportState({
                      wallets,
                      walletData,
                      history
                    })
                  }
                >
                  ⇩ Exportar dados
                </button>

                <button
                  type="button"
                  className={actionButton}
                  onClick={() =>
                    importInput.current?.click()
                  }
                >
                  ⇧ Importar dados
                </button>

                <button
                  type="button"
                  className={`${actionButton} hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-200`}
                  disabled={!wallets.length}
                  onClick={clearAll}
                >
                  × Limpar tudo
                </button>

                <input
                  ref={importInput}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </div>
            </div>
          </section>

          <section className="mb-6 rounded-[2rem] border border-emerald-300/15 bg-gradient-to-r from-emerald-300/[0.08] to-cyan-300/[0.04] p-5 md:p-6">
            <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">
                  Em breve · Conta MA
                </span>

                <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">
                  Consulte os seus endereços em
                  qualquer dispositivo.
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                  Estamos a preparar login e
                  sincronização cloud com acesso por
                  1 € via MB WAY. Até essa
                  funcionalidade estar disponível, a
                  MA-Carteira continua gratuita e
                  guarda os endereços, saldos e
                  registos apenas neste dispositivo.
                </p>
              </div>

              <a
                href="/contacto?tipo=ma-carteira"
                className={actionButton}
              >
                Avisar-me quando estiver disponível
              </a>
            </div>
          </section>

          <section aria-live="polite">
            {!wallets.length ? (
              <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] px-6 py-14 text-center">
                <div className="text-5xl">
                  ◈
                </div>

                <h2 className="mt-4 text-2xl font-semibold text-white">
                  Comece pelo seu primeiro endereço.
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-400">
                  Escolha uma rede, adicione um endereço público e atribua-lhe um nome. A MA-Carteira consulta os dados disponíveis e guarda um novo registo sempre que atualizar o endereço.
                </p>
              </div>
            ) : filteredWallets.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {filteredWallets.map(
                  (wallet) => {
                    const chainId =
                      getWalletChainId(wallet)

                    const key = addressKey(
                      wallet.address,
                      chainId
                    )

                    const data =
                      walletData[key] ||
                      emptyData(chainId)

                    const snapshots =
                      history[key] || []

                    return (
                      <article
                        key={key}
                        className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/65 shadow-2xl shadow-black/15 backdrop-blur"
                      >
                        <div className="border-b border-white/10 bg-black/15 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {wallet.pinned ? (
                                  <span className="text-amber-300">
                                    ★
                                  </span>
                                ) : null}

                                <h3 className="truncate text-2xl font-semibold tracking-tight text-white">
                                  {wallet.name}
                                </h3>

                                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300">
                                  {getChainConfig(chainId).shortName}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  void copyAddress(
                                    wallet.address
                                  )
                                }
                                className="mt-1 flex items-center gap-2 font-mono text-sm text-emerald-300 transition hover:text-emerald-200"
                                title="Copiar endereço"
                                aria-label={`Copiar endereço ${wallet.name}`}
                              >
                                {shortAddress(
                                  wallet.address
                                )}

                                <span aria-hidden="true">
                                  ⧉
                                </span>
                              </button>
                            </div>

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                title="Fixar endereço"
                                aria-label="Fixar endereço"
                                className="h-9 w-9 rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-amber-300"
                                onClick={() =>
                                  setWallets(
                                    (current) =>
                                      current.map(
                                        (item) =>
                                          addressKey(
                                            item.address,
                                            getWalletChainId(item)
                                          ) ===
                                          key
                                            ? {
                                                ...item,
                                                pinned:
                                                  !item.pinned
                                              }
                                            : item
                                      )
                                  )
                                }
                              >
                                ★
                              </button>

                              <button
                                type="button"
                                title="Editar nome"
                                aria-label="Editar nome do endereço"
                                className="h-9 w-9 rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-emerald-200"
                                onClick={() =>
                                  renameWallet(
                                    wallet
                                  )
                                }
                              >
                                ✎
                              </button>

                              <button
                                type="button"
                                title="Atualizar endereço"
                                aria-label="Atualizar endereço"
                                disabled={data.loading}
                                className="h-9 w-9 rounded-xl text-emerald-300 transition hover:bg-white/10 disabled:opacity-40"
                                onClick={() =>
                                  void refreshAddresses([wallet])
                                }
                              >
                                ↻
                              </button>

                              <button
                                type="button"
                                title="Remover endereço"
                                aria-label="Remover endereço"
                                className="h-9 w-9 rounded-xl text-red-300/80 transition hover:bg-red-400/10 hover:text-red-200"
                                onClick={() =>
                                  removeWallet(
                                    wallet
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="mb-5 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={!supportsTransactions(chainId)}
                              onClick={() =>
                                setSelectedTransactions(
                                  key
                                )
                              }
                              className="rounded-[1.35rem] border border-cyan-300/15 bg-cyan-300/[0.06] p-4 text-left transition hover:border-cyan-300/30 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200/80">
                                Transações on-chain
                              </span>

                              <strong className="mt-2 block text-sm text-white">
                                {supportsTransactions(chainId)
                                  ? 'Ver movimentos reais'
                                  : 'Ainda indisponível nesta rede'}
                              </strong>

                              <span className="mt-1 block text-xs leading-5 text-slate-400">
                                Recebidos, enviados,
                                swaps e interações.
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setSelectedHistory(
                                  key
                                )
                              }
                              className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 text-left transition hover:border-emerald-300/25 hover:bg-emerald-300/[0.07]"
                            >
                              <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">
                                Histórico de saldos
                              </span>

                              <strong className="mt-2 block text-sm text-white">
                                {snapshots.length}{' '}
                                {snapshots.length === 1
                                  ? 'registo guardado'
                                  : 'registos guardados'}
                              </strong>

                              <span className="mt-1 block text-xs leading-5 text-slate-400">
                                Estados do portefólio nas
                                atualizações anteriores.
                              </span>
                            </button>
                          </div>

                          {data.notice ? (
                            <p className="mb-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.08] p-3 text-sm leading-6 text-amber-100">
                              {data.notice}
                            </p>
                          ) : null}

                          {data.error ? (
                            <p className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                              {data.error}
                            </p>
                          ) : null}

                          <h4 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
                            Ativos do endereço (
                            {data.tokens.length + 1})
                          </h4>

                          <div className="space-y-1">
                            <NativeAssetRow
                              chainId={chainId}
                              balance={
                                data.plsBalance || ''
                              }
                              loading={data.loading}
                              error={data.error}
                              onOpenPrice={
                                setSelectedTokenPrice
                              }
                            />

                            {data.loading &&
                            !data.tokens.length ? (
                              <p className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-400">
                                A consultar os restantes ativos em {getChainConfig(chainId).name}…
                              </p>
                            ) : (
                              <TokenList
                                tokens={data.tokens}
                                chainId={chainId}
                                onOpenPrice={
                                  setSelectedTokenPrice
                                }
                              />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-slate-500">
                          <span>
                            {data.lastUpdated
                              ? `Última atualização: ${formatDateTime(
                                  data.lastUpdated
                                )}`
                              : 'Ainda não atualizado'}
                          </span>

                          <a
                            href={getWalletExplorerUrl(
                              wallet
                            )}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Ver no explorador ↗
                          </a>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
                Nenhum endereço corresponde à
                pesquisa.
              </div>
            )}
          </section>

          <footer className="mt-12 border-t border-white/10 pt-7 text-center text-xs leading-6 text-slate-500">
            <p>
              A MA-Carteira utiliza exclusivamente informação pública das redes suportadas. Não guarda chaves, não movimenta fundos e não executa transações.
            </p>

            <p>
              © {new Date().getFullYear()} MA-Code.
            </p>
          </footer>
        </div>
      </section>

      {selectedTokenPrice ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label={`Gráfico de preço de ${selectedTokenPrice.symbol}`}
          onMouseDown={(event) =>
            event.currentTarget === event.target &&
            setSelectedTokenPrice(null)
          }
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto">
            <TokenPricePanel
              contractAddress={
                selectedTokenPrice.contractAddress
              }
              chainId={
                selectedTokenPrice.chainId
              }
              tokenSymbol={
                selectedTokenPrice.symbol
              }
              tokenName={
                selectedTokenPrice.name
              }
              onClose={() =>
                setSelectedTokenPrice(null)
              }
            />
          </div>
        </div>
      ) : null}

      {selectedTransactions &&
      selectedTransactionsWallet ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-label={`Transações de ${selectedTransactionsWallet.name}`}
          onMouseDown={(event) =>
            event.currentTarget === event.target &&
            setSelectedTransactions(null)
          }
        >
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto">
            <WalletTransactionsPanel
              address={
                selectedTransactionsWallet.address
              }
              chainId={getWalletChainId(
                selectedTransactionsWallet
              )}
              walletName={
                selectedTransactionsWallet.name
              }
              onClose={() =>
                setSelectedTransactions(null)
              }
            />
          </div>
        </div>
      ) : null}

      {selectedHistory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-title"
          onMouseDown={(event) =>
            event.currentTarget === event.target &&
            setSelectedHistory(null)
          }
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
                  Registos de saldo
                </span>

                <h2
                  id="history-title"
                  className="mt-1 text-2xl font-semibold text-white"
                >
                  {selectedWallet?.name ||
                    'Endereço'}
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Saldos registados nas diferentes
                  atualizações deste endereço.
                </p>
              </div>

              <button
                type="button"
                className="h-10 w-10 rounded-2xl bg-white/[0.05] text-xl text-slate-300 hover:bg-white/10"
                onClick={() =>
                  setSelectedHistory(null)
                }
                aria-label="Fechar registos de saldo"
              >
                ×
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-5">
              {selectedSnapshots.length ? (
                selectedSnapshots.map(
                  (snapshot) => (
                    <article
                      key={snapshot.id}
                      className="mb-3 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 last:mb-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <strong className="text-white">
                            {formatDateTime(
                              snapshot.timestamp
                            )}
                          </strong>

                          <span className="mt-1 block font-mono text-xs text-slate-500">
                            {shortAddress(
                              snapshot.address
                            )}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">
                            {getNativeCurrency(snapshot.chainId).symbol}
                          </span>

                          <strong className="block text-xl text-white">
                            {formatBalance(
                              snapshot.plsBalance,
                              getNativeCurrency(snapshot.chainId).decimals,
                              4
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Tokens registados (
                          {snapshot.tokenCount})
                        </p>

                        {snapshot.topTokens
                          .slice(0, 6)
                          .map(
                            (
                              token,
                              index
                            ) => (
                              <div
                                key={`${token.contractAddress}-${index}`}
                                className="flex items-center justify-between gap-3 py-1 text-xs"
                              >
                                <span className="truncate text-slate-300">
                                  {token.symbol}{' '}
                                  <span className="text-slate-600">
                                    {
                                      token.name
                                    }
                                  </span>
                                </span>

                                <span className="shrink-0 font-mono text-emerald-200">
                                  {formatBalance(
                                    token.balance,
                                    Number(
                                      token.decimals
                                    ),
                                    4
                                  )}
                                </span>
                              </div>
                            )
                          )}
                      </div>
                    </article>
                  )
                )
              ) : (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
                  Ainda não existem registos de saldo.
                  Atualize este endereço para criar o
                  primeiro registo.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-2xl ${
            toast.error
              ? 'border-red-400/30 bg-red-950 text-red-200'
              : 'border-emerald-300/25 bg-slate-950 text-emerald-100'
          }`}
          role={
            toast.error ? 'alert' : 'status'
          }
        >
          {toast.message}
        </div>
      ) : null}
    </main>
  )
}
