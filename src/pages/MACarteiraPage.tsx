import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from 'react'

import {
  PULSECHAIN_EXPLORER,
  addSnapshot,
  addressKey,
  clearStoredState,
  emptyData,
  exportState,
  fetchWallet,
  formatBalance,
  formatDateTime,
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

type Toast = {
  message: string
  error?: boolean
} | null

const actionButton =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50'

function TokenList({
  tokens
}: {
  tokens: PulseToken[]
}) {
  if (!tokens.length) {
    return (
      <p className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-400">
        Sem tokens ERC-20 com saldo.
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
                {token.name || 'ERC-20'}
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

        return contract ? (
          <a
            key={`${contract}-${index}`}
            href={`${PULSECHAIN_EXPLORER}/${contract}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5 transition hover:bg-white/[0.05]"
          >
            {content}
          </a>
        ) : (
          <div
            key={`${token.symbol}-${index}`}
            className="flex items-center justify-between gap-4 rounded-2xl px-3 py-2.5"
          >
            {content}
          </div>
        )
      })}
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

  const [search, setSearch] = useState('')

  const [
    selectedHistory,
    setSelectedHistory
  ] = useState<string | null>(null)

  const [toast, setToast] =
    useState<Toast>(null)

  const autoRefreshStarted = useRef(false)

  const importInput =
    useRef<HTMLInputElement>(null)

  useEffect(() => {
    setPageMetadata()
  }, [])

  useEffect(() => {
    saveState({
      wallets,
      walletData,
      history
    })
  }, [wallets, walletData, history])

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
    addresses: string[],
    knownWallets = wallets
  ) => {
    if (!addresses.length) {
      return
    }
    
const keys = new Set(
  addresses.map((address) => addressKey(address))
)

    setWalletData((current) =>
      Object.fromEntries(
        Object.entries({
          ...current,
          ...Object.fromEntries(
            addresses.map((address) => [
              addressKey(address),
              current[addressKey(address)] ||
                emptyData()
            ])
          )
        }).map(([key, data]) => [
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
    )

    const results = await Promise.all(
      addresses.map(async (address) => {
        try {
          return {
            address,
            data: await fetchWallet(address),
            error: null
          }
        } catch (error) {
          return {
            address,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : 'Não foi possível atualizar esta carteira.'
          }
        }
      })
    )

    setWalletData((current) => {
      const next = {
        ...current
      }

      results.forEach((result) => {
        const key = addressKey(
          result.address
        )

        next[key] =
          result.data || {
            ...(current[key] || emptyData()),
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

        const wallet = knownWallets.find(
          (item) =>
            addressKey(item.address) ===
            addressKey(result.address)
        )

        if (wallet) {
          next = addSnapshot(
            next,
            wallet,
            result.data
          )
        }
      })

      return next
    })

    if (
      results.some((result) => result.error)
    ) {
      showToast(
        'Algumas carteiras não puderam ser atualizadas.',
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
            addressKey(wallet.address)
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

    void refreshAddresses(
      stale.map(
        (wallet) => wallet.address
      )
    )

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
            .includes(query)
      )
  }, [search, wallets])

  const totalPls = useMemo(
    () =>
      Object.values(walletData).reduce(
        (total, data) => {
          try {
            return data.plsBalance &&
              !data.error
              ? total +
                  BigInt(data.plsBalance)
              : total
          } catch {
            return total
          }
        },
        0n
      ),
    [walletData]
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
      walletAddress
    )

    if (!isValidAddress(address)) {
      showToast(
        'Introduza um endereço PulseChain válido.',
        true
      )

      return
    }

    if (
      wallets.some(
        (wallet) =>
          addressKey(wallet.address) ===
          addressKey(address)
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
      name:
        walletName.trim().slice(0, 40) ||
        `Carteira ${wallets.length + 1}`,
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
      [addressKey(address)]: {
        ...emptyData(),
        loading: true
      }
    }))

    setWalletName('')
    setWalletAddress('')

    await refreshAddresses(
      [address],
      [...wallets, wallet]
    )

    showToast('Carteira adicionada.')
  }

  const renameWallet = (wallet: Wallet) => {
    const name = window
      .prompt(
        'Nome da carteira:',
        wallet.name
      )
      ?.trim()

    if (!name) {
      return
    }

    setWallets((current) =>
      current.map((item) =>
        item.address === wallet.address
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

    const key = addressKey(wallet.address)

    setWallets((current) =>
      current.filter(
        (item) =>
          addressKey(item.address) !== key
      )
    )

    setWalletData((current) => {
      const next = {
        ...current
      }

      delete next[key]

      return next
    })

    showToast('Carteira removida.')
  }

  const clearAll = () => {
    if (
      !window.confirm(
        'Apagar todas as carteiras, saldos e histórico guardados neste dispositivo?'
      )
    ) {
      return
    }

    setWallets([])
    setWalletData({})
    setHistory({})

    clearStoredState()

    showToast('Dados locais apagados.')
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
          addressKey(wallet.address) ===
          selectedHistory
      )
    : null

  const selectedSnapshots =
    selectedHistory
      ? history[selectedHistory] || []
      : []

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
                  Produto MA-Code · Dados públicos
                  PulseChain
                </span>
              </div>

              <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                Acompanhe as suas carteiras na{' '}
                <span className="bg-gradient-to-r from-emerald-200 via-cyan-200 to-sky-300 bg-clip-text text-transparent">
                  MA-Carteira
                </span>
                .
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                Guarde endereços públicos PulseChain
                com nomes personalizados, consulte PLS
                e tokens ERC-20 e mantenha um
                histórico local de cada atualização.
              </p>

              <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-emerald-100">
                  Sem seed phrase
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200">
                  Sem ligar a carteira
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200">
                  Dados guardados localmente
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
            aria-label="Resumo do portefólio"
          >
            {[
              [
                'Carteiras',
                wallets.length.toString(),
                'Guardadas neste dispositivo'
              ],
              [
                'Total PLS',
                totalPls
                  ? formatBalance(
                      totalPls,
                      18,
                      2
                    )
                  : '—',
                'Últimos saldos atualizados'
              ],
              [
                'Histórico',
                snapshotCount.toString(),
                'Registos locais guardados'
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
            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_auto] xl:items-end">
              <div>
                <label
                  htmlFor="wallet-name"
                  className="input-label"
                >
                  Nome da carteira
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
                  htmlFor="wallet-address"
                  className="input-label"
                >
                  Endereço público PulseChain
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
                  placeholder="0x…"
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
                  + Adicionar carteira
                </span>
              </button>
            </div>

            <p className="mt-4 text-xs leading-6 text-slate-500">
              A aplicação consulta apenas informação
              pública. Nunca introduza uma seed
              phrase, chave privada ou palavra-passe.
            </p>
          </form>

          <section className="mb-6 rounded-[2rem] border border-white/10 bg-slate-950/55 p-5 backdrop-blur">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-md">
                <label
                  htmlFor="wallet-search"
                  className="sr-only"
                >
                  Pesquisar carteiras
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
                    void refreshAddresses(
                      wallets.map(
                        (wallet) =>
                          wallet.address
                      )
                    )
                  }
                >
                  ↻ Atualizar todas
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
                  ⇩ Exportar
                </button>

                <button
                  type="button"
                  className={actionButton}
                  onClick={() =>
                    importInput.current?.click()
                  }
                >
                  ⇧ Importar
                </button>

                <button
                  type="button"
                  className={`${actionButton} hover:border-red-300/30 hover:bg-red-400/10 hover:text-red-200`}
                  disabled={!wallets.length}
                  onClick={clearAll}
                >
                  × Limpar
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
                  Conta cloud em preparação
                </span>

                <h2 className="mt-2 text-xl font-semibold text-white md:text-2xl">
                  Login, sincronização entre
                  dispositivos e acesso por 1 € via
                  MB WAY.
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                  A versão atual funciona localmente
                  e gratuitamente. O pagamento e a
                  conta cloud só serão ativados
                  quando o backend e a confirmação
                  segura do pagamento estiverem
                  concluídos.
                </p>
              </div>

              <a
                href="/contacto?tipo=ma-carteira"
                className={actionButton}
              >
                Receber novidades
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
                  Ainda não existem carteiras.
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-400">
                  Adicione acima um endereço público
                  PulseChain e atribua-lhe um nome
                  para começar.
                </p>
              </div>
            ) : filteredWallets.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {filteredWallets.map(
                  (wallet) => {
                    const key = addressKey(
                      wallet.address
                    )

                    const data =
                      walletData[key] ||
                      emptyData()

                    const snapshots =
                      history[key] || []

                    return (
                      <article
                        key={wallet.address}
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
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  void copyAddress(
                                    wallet.address
                                  )
                                }
                                className="mt-1 flex items-center gap-2 font-mono text-sm text-emerald-300 transition hover:text-emerald-200"
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
                                title="Fixar"
                                aria-label="Fixar carteira"
                                className="h-9 w-9 rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-amber-300"
                                onClick={() =>
                                  setWallets(
                                    (current) =>
                                      current.map(
                                        (item) =>
                                          item.address ===
                                          wallet.address
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
                                title="Mudar nome"
                                aria-label="Mudar nome"
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
                                title="Atualizar"
                                aria-label="Atualizar carteira"
                                disabled={data.loading}
                                className="h-9 w-9 rounded-xl text-emerald-300 transition hover:bg-white/10 disabled:opacity-40"
                                onClick={() =>
                                  void refreshAddresses(
                                    [
                                      wallet.address
                                    ]
                                  )
                                }
                              >
                                ↻
                              </button>

                              <button
                                type="button"
                                title="Remover"
                                aria-label="Remover carteira"
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
                          <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                              <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
                                PLS nativo
                              </span>

                              <strong className="mt-1 block break-all text-3xl font-semibold tracking-tight text-white">
                                {data.loading &&
                                !data.plsBalance
                                  ? 'A atualizar…'
                                  : data.error
                                    ? 'Erro'
                                    : data.plsBalance
                                      ? formatBalance(
                                          data.plsBalance,
                                          18,
                                          6
                                        )
                                      : '—'}
                              </strong>
                            </div>

                            <div className="text-right text-xs text-slate-500">
                              <span className="block">
                                {snapshots.length}{' '}
                                registos
                              </span>

                              <button
                                type="button"
                                className="mt-1 font-semibold text-emerald-300 hover:text-emerald-200"
                                onClick={() =>
                                  setSelectedHistory(
                                    key
                                  )
                                }
                              >
                                Ver histórico
                              </button>
                            </div>
                          </div>

                          {data.error ? (
                            <p className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">
                              {data.error}
                            </p>
                          ) : null}

                          <h4 className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
                            Tokens ERC-20 (
                            {data.tokens.length})
                          </h4>

                          {data.loading &&
                          !data.tokens.length ? (
                            <p className="rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-400">
                              A consultar a
                              PulseChain…
                            </p>
                          ) : (
                            <TokenList
                              tokens={data.tokens}
                            />
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-slate-500">
                          <span>
                            {data.lastUpdated
                              ? `Atualizado: ${formatDateTime(
                                  data.lastUpdated
                                )}`
                              : 'Ainda não atualizado'}
                          </span>

                          <a
                            href={`${PULSECHAIN_EXPLORER}/${wallet.address}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-emerald-300 hover:text-emerald-200"
                          >
                            Explorador ↗
                          </a>
                        </div>
                      </article>
                    )
                  }
                )}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-slate-400">
                Nenhuma carteira corresponde à
                pesquisa.
              </div>
            )}
          </section>

          <footer className="mt-12 border-t border-white/10 pt-7 text-center text-xs leading-6 text-slate-500">
            <p>
              MA-Carteira consulta dados públicos da
              PulseChain. Não é uma carteira de
              custódia e não executa transações.
            </p>

            <p>
              © {new Date().getFullYear()} MA-Code.
            </p>
          </footer>
        </div>
      </section>

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
                  Histórico local
                </span>

                <h2
                  id="history-title"
                  className="mt-1 text-2xl font-semibold text-white"
                >
                  {selectedWallet?.name ||
                    'Carteira'}
                </h2>
              </div>

              <button
                type="button"
                className="h-10 w-10 rounded-2xl bg-white/[0.05] text-xl text-slate-300 hover:bg-white/10"
                onClick={() =>
                  setSelectedHistory(null)
                }
                aria-label="Fechar histórico"
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
                            PLS
                          </span>

                          <strong className="block text-xl text-white">
                            {formatBalance(
                              snapshot.plsBalance,
                              18,
                              4
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="mt-4 border-t border-white/10 pt-3">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Tokens guardados (
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
                  Ainda não existe histórico.
                  Atualize esta carteira para criar o
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
