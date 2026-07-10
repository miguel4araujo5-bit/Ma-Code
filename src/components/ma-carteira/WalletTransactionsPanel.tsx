import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  MaCarteiraApiError,
  fetchWalletTransactions,
  type WalletTransaction,
  type WalletTransactionsResult
} from '../../lib/maCarteiraApi'

import {
  getChainConfig,
  getExplorerAddressUrl,
  getExplorerTransactionUrl,
  type ChainId
} from '../../lib/maCarteiraChains'

import {
  formatDateTime,
  shortAddress
} from '../../lib/maCarteira'

type WalletTransactionsPanelProps = {
  address: string
  chainId: ChainId
  walletName: string
  onClose?: () => void
}

const formatRawAmount = (
  raw: string,
  decimals: number,
  maxFraction = 6
) => {
  try {
    const value = BigInt(raw || '0')
    const safeDecimals = Math.max(
      0,
      Math.trunc(decimals)
    )

    const divisor =
      10n ** BigInt(safeDecimals)

    const whole = value / divisor

    const fraction = (value % divisor)
      .toString()
      .padStart(safeDecimals, '0')
      .replace(/0+$/, '')
      .slice(0, maxFraction)

    const wholeFormatted =
      new Intl.NumberFormat(
        'pt-PT'
      ).format(whole)

    return fraction
      ? `${wholeFormatted},${fraction}`
      : wholeFormatted
  } catch {
    return raw || '0'
  }
}

const getDirectionLabel = (
  transaction: WalletTransaction
) => {
  if (transaction.direction === 'in') {
    return 'Recebido'
  }

  if (transaction.direction === 'out') {
    return 'Enviado'
  }

  return 'Próprio endereço'
}

const getDirectionClasses = (
  transaction: WalletTransaction
) => {
  if (transaction.direction === 'in') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (transaction.direction === 'out') {
    return 'border-amber-300/25 bg-amber-300/10 text-amber-100'
  }

  return 'border-sky-300/25 bg-sky-300/10 text-sky-100'
}

const getKindLabel = (
  transaction: WalletTransaction
) => {
  if (transaction.kind === 'native') {
    return 'Transferência nativa'
  }

  if (transaction.kind === 'token') {
    return 'Transferência de token'
  }

  if (transaction.kind === 'swap') {
    return 'Swap'
  }

  return 'Interação com contrato'
}

const getStatusLabel = (
  transaction: WalletTransaction
) => {
  if (transaction.status === 'failed') {
    return 'Falhou'
  }

  if (transaction.status === 'pending') {
    return 'Pendente'
  }

  return 'Confirmada'
}

const getStatusClasses = (
  transaction: WalletTransaction
) => {
  if (transaction.status === 'failed') {
    return 'text-red-300'
  }

  if (transaction.status === 'pending') {
    return 'text-amber-300'
  }

  return 'text-emerald-300'
}

const hasVisibleAmount = (
  transaction: WalletTransaction
) => {
  try {
    return BigInt(
      transaction.amountRaw || '0'
    ) !== 0n
  } catch {
    return transaction.amountRaw !== '0'
  }
}

export default function WalletTransactionsPanel({
  address,
  chainId,
  walletName,
  onClose
}: WalletTransactionsPanelProps) {
  const [result, setResult] =
    useState<WalletTransactionsResult | null>(
      null
    )

  const [loading, setLoading] =
    useState(false)

  const [error, setError] =
    useState<string | null>(null)

  const [retryKey, setRetryKey] =
    useState(0)

  const requestIdentity = `${chainId}:${address.toLowerCase()}`

  useEffect(() => {
    setResult(null)
    setError(null)
  }, [requestIdentity])

  useEffect(() => {
    const controller =
      new AbortController()

    setLoading(true)
    setError(null)

    void fetchWalletTransactions(
      address,
      {
        chainId,
        limit: 120,
        signal: controller.signal
      }
    )
      .then((nextResult) => {
        if (!controller.signal.aborted) {
          setResult(nextResult)
        }
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        const message =
          caughtError instanceof
            MaCarteiraApiError ||
          caughtError instanceof Error
            ? caughtError.message
            : 'Não foi possível consultar as transações.'

        setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [
    address,
    chainId,
    retryKey
  ])

  const chain = useMemo(
    () => getChainConfig(chainId),
    [chainId]
  )

  const transactions =
    result?.transactions || []

  const receivedCount = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.direction === 'in'
      ).length,
    [transactions]
  )

  const sentCount = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.direction === 'out'
      ).length,
    [transactions]
  )

  return (
    <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
            Histórico de transações
          </span>

          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white">
            {walletName}
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>{chain.name}</span>

            <a
              href={getExplorerAddressUrl(
                address,
                chainId
              )}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-emerald-300 transition hover:text-emerald-200"
            >
              {shortAddress(address)} ↗
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setRetryKey(
                (current) => current + 1
              )
            }
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-slate-200 transition hover:border-emerald-300/30 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'A atualizar…'
              : '↻ Atualizar'}
          </button>

          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar histórico de transações"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 bg-black/10 px-5 py-4 sm:grid-cols-3 sm:px-6">
        {[
          [
            'Transações',
            transactions.length.toString()
          ],
          [
            'Recebidas',
            receivedCount.toString()
          ],
          [
            'Enviadas',
            sentCount.toString()
          ]
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3"
          >
            <span className="block text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-500">
              {label}
            </span>

            <strong className="mt-1 block text-xl text-white">
              {value}
            </strong>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {loading && !result ? (
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-8 text-center text-sm text-slate-400">
            A consultar as transações reais deste endereço…
          </div>
        ) : error && !result ? (
          <div className="rounded-[1.5rem] border border-red-400/20 bg-red-400/10 p-6 text-center">
            <strong className="text-red-200">
              Não foi possível carregar o histórico.
            </strong>

            <p className="mt-2 text-sm leading-6 text-red-100/80">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setRetryKey(
                  (current) => current + 1
                )
              }
              className="mt-4 rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-100 transition hover:bg-red-300/15"
            >
              Tentar novamente
            </button>
          </div>
        ) : transactions.length ? (
          <div className="space-y-3">
            {transactions.map(
              (transaction) => {
                const visibleAmount =
                  hasVisibleAmount(
                    transaction
                  )

                return (
                  <article
                    key={transaction.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 transition hover:border-emerald-300/20 hover:bg-white/[0.05] sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] ${getDirectionClasses(
                              transaction
                            )}`}
                          >
                            {getDirectionLabel(
                              transaction
                            )}
                          </span>

                          <span className="text-xs font-semibold text-slate-400">
                            {getKindLabel(
                              transaction
                            )}
                          </span>

                          <span
                            className={`text-xs font-bold ${getStatusClasses(
                              transaction
                            )}`}
                          >
                            {getStatusLabel(
                              transaction
                            )}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-semibold text-white">
                          {transaction.method ||
                            getKindLabel(
                              transaction
                            )}
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDateTime(
                            transaction.timestamp
                          )}
                          {transaction.blockNumber
                            ? ` · Bloco ${transaction.blockNumber}`
                            : ''}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <strong className="block font-mono text-base text-emerald-100">
                          {visibleAmount
                            ? `${
                                transaction.direction ===
                                'out'
                                  ? '−'
                                  : transaction.direction ===
                                      'in'
                                    ? '+'
                                    : ''
                              }${formatRawAmount(
                                transaction.amountRaw,
                                transaction.decimals
                              )} ${transaction.symbol}`
                            : 'Interação'}
                        </strong>

                        <span className="mt-1 block text-xs text-slate-500">
                          Taxa:{' '}
                          {formatRawAmount(
                            transaction.feeRaw,
                            chain.nativeCurrency
                              .decimals,
                            6
                          )}{' '}
                          {
                            chain.nativeCurrency
                              .symbol
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-xs sm:grid-cols-2">
                      <div className="min-w-0">
                        <span className="block font-black uppercase tracking-[0.14em] text-slate-600">
                          De
                        </span>

                        <span className="mt-1 block truncate font-mono text-slate-300">
                          {transaction.from
                            ? shortAddress(
                                transaction.from
                              )
                            : '—'}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="block font-black uppercase tracking-[0.14em] text-slate-600">
                          Para
                        </span>

                        <span className="mt-1 block truncate font-mono text-slate-300">
                          {transaction.to
                            ? shortAddress(
                                transaction.to
                              )
                            : 'Criação de contrato'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <span className="font-mono text-[0.68rem] text-slate-600">
                        {shortAddress(
                          transaction.hash
                        )}
                      </span>

                      <a
                        href={getExplorerTransactionUrl(
                          transaction.hash,
                          transaction.chainId
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-emerald-300 transition hover:text-emerald-200"
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
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-8 text-center">
            <strong className="text-white">
              Ainda não foram encontradas transações.
            </strong>

            <p className="mt-2 text-sm leading-6 text-slate-400">
              Este endereço pode ainda não ter atividade pública nesta rede.
            </p>
          </div>
        )}

        {result?.partial ? (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            O explorador devolveu um histórico parcial. São apresentadas as transações mais recentes disponíveis.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/10 px-5 py-3 text-xs text-slate-500 sm:px-6">
        <span>
          Dados públicos on-chain. A MA-Carteira não executa transações.
        </span>

        {result?.fetchedAt ? (
          <span>
            Atualizado:{' '}
            {formatDateTime(
              result.fetchedAt
            )}
          </span>
        ) : null}
      </div>
    </div>
  )
}
