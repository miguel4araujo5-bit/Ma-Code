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

type GroupType =
  | 'swap'
  | 'received'
  | 'sent'
  | 'self'
  | 'interaction'

type GroupedMovement = {
  key: string
  direction: WalletTransaction['direction']
  amountRaw: string
  decimals: number
  symbol: string
  tokenName: string | null
  tokenAddress: string | null
  kind: WalletTransaction['kind']
}

type TransactionGroup = {
  id: string
  chainId: ChainId
  hash: string
  timestamp: string
  blockNumber: string | null
  status: WalletTransaction['status']
  type: GroupType
  method: string | null
  movements: GroupedMovement[]
  feeRaw: string
  initiatedByWallet: boolean
  counterparties: string[]
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

const toBigInt = (value: string) => {
  try {
    return BigInt(value || '0')
  } catch {
    return 0n
  }
}

const maxRawAmount = (
  values: string[]
) =>
  values.reduce(
    (largest, value) => {
      const current = toBigInt(value)

      return current > largest
        ? current
        : largest
    },
    0n
  ).toString()

const hasVisibleAmount = (
  transaction: WalletTransaction
) =>
  toBigInt(transaction.amountRaw) !== 0n

const getMovementKey = (
  transaction: WalletTransaction
) =>
  [
    transaction.direction,
    transaction.tokenAddress?.toLowerCase() ||
      'native',
    transaction.symbol.toUpperCase(),
    transaction.decimals
  ].join(':')

const getGroupStatus = (
  transactions: WalletTransaction[]
): WalletTransaction['status'] => {
  if (
    transactions.some(
      (transaction) =>
        transaction.status === 'failed'
    )
  ) {
    return 'failed'
  }

  if (
    transactions.some(
      (transaction) =>
        transaction.status === 'pending'
    )
  ) {
    return 'pending'
  }

  return 'success'
}

const getGroupMethod = (
  transactions: WalletTransaction[]
) => {
  const specificMethod =
    transactions.find(
      (transaction) =>
        transaction.method &&
        transaction.method !==
          'Interação com contrato'
    )?.method

  if (specificMethod) {
    return specificMethod
  }

  return (
    transactions.find(
      (transaction) =>
        transaction.method
    )?.method || null
  )
}

const getCounterparties = (
  transactions: WalletTransaction[],
  walletAddress: string
) => {
  const wallet =
    walletAddress.toLowerCase()

  return Array.from(
    new Set(
      transactions.flatMap(
        (transaction) =>
          [
            transaction.from,
            transaction.to || ''
          ]
            .map((value) => value.trim())
            .filter(
              (value) =>
                value &&
                value.toLowerCase() !==
                  wallet
            )
      )
    )
  )
}

const getGroupType = (
  transactions: WalletTransaction[],
  movements: GroupedMovement[]
): GroupType => {
  const hasIncoming =
    movements.some(
      (movement) =>
        movement.direction === 'in'
    )

  const hasOutgoing =
    movements.some(
      (movement) =>
        movement.direction === 'out'
    )

  if (
    (hasIncoming && hasOutgoing) ||
    transactions.some(
      (transaction) =>
        transaction.kind === 'swap'
    )
  ) {
    return 'swap'
  }

  if (hasIncoming) {
    return 'received'
  }

  if (hasOutgoing) {
    return 'sent'
  }

  if (
    movements.some(
      (movement) =>
        movement.direction === 'self'
    )
  ) {
    return 'self'
  }

  return 'interaction'
}

const groupTransactions = (
  transactions: WalletTransaction[],
  walletAddress: string
): TransactionGroup[] => {
  const byHash = new Map<
    string,
    WalletTransaction[]
  >()

  transactions.forEach((transaction) => {
    const key =
      transaction.hash.toLowerCase()

    const current =
      byHash.get(key) || []

    current.push(transaction)
    byHash.set(key, current)
  })

  return Array.from(byHash.values())
    .map((items) => {
      const movementMap = new Map<
        string,
        GroupedMovement
      >()

      items.forEach((transaction) => {
        if (!hasVisibleAmount(transaction)) {
          return
        }

        const key =
          getMovementKey(transaction)

        const existing =
          movementMap.get(key)

        if (existing) {
          movementMap.set(key, {
            ...existing,
            amountRaw: (
              toBigInt(existing.amountRaw) +
              toBigInt(
                transaction.amountRaw
              )
            ).toString()
          })

          return
        }

        movementMap.set(key, {
          key,
          direction:
            transaction.direction,
          amountRaw:
            transaction.amountRaw,
          decimals:
            transaction.decimals,
          symbol:
            transaction.symbol,
          tokenName:
            transaction.tokenName,
          tokenAddress:
            transaction.tokenAddress,
          kind:
            transaction.kind
        })
      })

      const movements =
        Array.from(
          movementMap.values()
        ).sort((first, second) => {
          const directionOrder = {
            out: 0,
            in: 1,
            self: 2
          }

          return (
            directionOrder[
              first.direction
            ] -
              directionOrder[
                second.direction
              ] ||
            first.symbol.localeCompare(
              second.symbol,
              'pt'
            )
          )
        })

      const newest = [...items].sort(
        (first, second) =>
          new Date(
            second.timestamp
          ).getTime() -
          new Date(
            first.timestamp
          ).getTime()
      )[0]

      const wallet =
        walletAddress.toLowerCase()

      return {
        id: `${newest.chainId}:${newest.hash.toLowerCase()}`,
        chainId: newest.chainId,
        hash: newest.hash,
        timestamp: newest.timestamp,
        blockNumber:
          newest.blockNumber ||
          items.find(
            (transaction) =>
              transaction.blockNumber
          )?.blockNumber ||
          null,
        status: getGroupStatus(items),
        type: getGroupType(
          items,
          movements
        ),
        method: getGroupMethod(items),
        movements,
        feeRaw: maxRawAmount(
          items.map(
            (transaction) =>
              transaction.feeRaw
          )
        ),
        initiatedByWallet:
          items.some(
            (transaction) =>
              transaction.from.toLowerCase() ===
              wallet
          ),
        counterparties:
          getCounterparties(
            items,
            walletAddress
          )
      }
    })
    .sort(
      (first, second) =>
        new Date(
          second.timestamp
        ).getTime() -
          new Date(
            first.timestamp
          ).getTime() ||
        second.id.localeCompare(first.id)
    )
}

const getGroupTypeLabel = (
  type: GroupType
) => {
  if (type === 'swap') {
    return 'Troca'
  }

  if (type === 'received') {
    return 'Recebido'
  }

  if (type === 'sent') {
    return 'Enviado'
  }

  if (type === 'self') {
    return 'Próprio endereço'
  }

  return 'Interação'
}

const getGroupTypeClasses = (
  type: GroupType
) => {
  if (type === 'swap') {
    return 'border-violet-300/25 bg-violet-300/10 text-violet-100'
  }

  if (type === 'received') {
    return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  }

  if (type === 'sent') {
    return 'border-amber-300/25 bg-amber-300/10 text-amber-100'
  }

  if (type === 'self') {
    return 'border-sky-300/25 bg-sky-300/10 text-sky-100'
  }

  return 'border-slate-300/20 bg-slate-300/10 text-slate-200'
}

const getStatusLabel = (
  status: WalletTransaction['status']
) => {
  if (status === 'failed') {
    return 'Falhou'
  }

  if (status === 'pending') {
    return 'Pendente'
  }

  return 'Confirmada'
}

const getStatusClasses = (
  status: WalletTransaction['status']
) => {
  if (status === 'failed') {
    return 'text-red-300'
  }

  if (status === 'pending') {
    return 'text-amber-300'
  }

  return 'text-emerald-300'
}

const getMovementDirectionLabel = (
  direction: WalletTransaction['direction']
) => {
  if (direction === 'in') {
    return 'Recebido'
  }

  if (direction === 'out') {
    return 'Enviado'
  }

  return 'Movimento interno'
}

const getMovementAmountPrefix = (
  direction: WalletTransaction['direction']
) => {
  if (direction === 'in') {
    return '+'
  }

  if (direction === 'out') {
    return '−'
  }

  return ''
}

const getMovementAmountClasses = (
  direction: WalletTransaction['direction']
) => {
  if (direction === 'in') {
    return 'text-emerald-200'
  }

  if (direction === 'out') {
    return 'text-amber-200'
  }

  return 'text-sky-200'
}

const getGroupTitle = (
  group: TransactionGroup
) => {
  if (group.type === 'swap') {
    return 'Troca de ativos'
  }

  if (group.type === 'received') {
    return 'Ativos recebidos'
  }

  if (group.type === 'sent') {
    return 'Ativos enviados'
  }

  if (group.type === 'self') {
    return 'Movimento no próprio endereço'
  }

  return 'Interação com contrato'
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
        limit: 150,
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

  const groups = useMemo(
    () =>
      groupTransactions(
        transactions,
        address
      ),
    [transactions, address]
  )

  const receivedCount = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.type === 'received'
      ).length,
    [groups]
  )

  const sentCount = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.type === 'sent'
      ).length,
    [groups]
  )

  const swapCount = useMemo(
    () =>
      groups.filter(
        (group) =>
          group.type === 'swap'
      ).length,
    [groups]
  )

  return (
    <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200/80">
            Transações on-chain
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
              rel="noreferrer noopener"
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
              aria-label="Fechar transações"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-xl text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-b border-white/10 bg-black/10 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {[
          [
            'Operações',
            groups.length.toString()
          ],
          [
            'Recebidas',
            receivedCount.toString()
          ],
          [
            'Enviadas',
            sentCount.toString()
          ],
          [
            'Trocas',
            swapCount.toString()
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
              Não foi possível carregar as transações.
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
        ) : groups.length ? (
          <div className="space-y-3">
            {groups.map((group) => (
              <article
                key={group.id}
                className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 transition hover:border-emerald-300/20 hover:bg-white/[0.05] sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] ${getGroupTypeClasses(
                          group.type
                        )}`}
                      >
                        {getGroupTypeLabel(
                          group.type
                        )}
                      </span>

                      <span
                        className={`text-xs font-bold ${getStatusClasses(
                          group.status
                        )}`}
                      >
                        {getStatusLabel(
                          group.status
                        )}
                      </span>
                    </div>

                    <h3 className="mt-3 text-base font-semibold text-white">
                      {getGroupTitle(group)}
                    </h3>

                    {group.method ? (
                      <p className="mt-1 break-all text-xs text-slate-400">
                        Método: {group.method}
                      </p>
                    ) : null}

                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(
                        group.timestamp
                      )}
                      {group.blockNumber
                        ? ` · Bloco ${group.blockNumber}`
                        : ''}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <span className="block text-[0.68rem] font-black uppercase tracking-[0.14em] text-slate-500">
                      {group.initiatedByWallet
                        ? 'Taxa paga'
                        : 'Taxa da transação'}
                    </span>

                    <strong className="mt-1 block font-mono text-sm text-slate-200">
                      {formatRawAmount(
                        group.feeRaw,
                        chain.nativeCurrency
                          .decimals,
                        6
                      )}{' '}
                      {
                        chain.nativeCurrency
                          .symbol
                      }
                    </strong>
                  </div>
                </div>

                {group.status === 'failed' ? (
                  <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs leading-5 text-red-100">
                    Esta operação falhou. Os valores abaixo correspondem à tentativa registada e não a ativos efetivamente movimentados.
                  </p>
                ) : null}

                {group.movements.length ? (
                  <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                    {group.movements.map(
                      (movement) => (
                        <div
                          key={movement.key}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="block text-[0.66rem] font-black uppercase tracking-[0.14em] text-slate-500">
                              {getMovementDirectionLabel(
                                movement.direction
                              )}
                            </span>

                            <strong className="mt-1 block truncate text-sm text-white">
                              {movement.symbol}
                            </strong>

                            {movement.tokenName ? (
                              <span className="mt-0.5 block truncate text-xs text-slate-500">
                                {movement.tokenName}
                              </span>
                            ) : !movement.tokenAddress ? (
                              <span className="mt-0.5 block text-xs text-slate-500">
                                Ativo nativo
                              </span>
                            ) : null}
                          </div>

                          <strong
                            className={`shrink-0 font-mono text-base ${getMovementAmountClasses(
                              movement.direction
                            )}`}
                          >
                            {getMovementAmountPrefix(
                              movement.direction
                            )}
                            {formatRawAmount(
                              movement.amountRaw,
                              movement.decimals
                            )}{' '}
                            {movement.symbol}
                          </strong>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-sm leading-6 text-slate-400">
                    Interação com contrato ou programa sem transferência direta de {chain.nativeCurrency.symbol} ou tokens detetada.
                  </p>
                )}

                {group.counterparties.length ? (
                  <div className="mt-4 border-t border-white/10 pt-4">
                    <span className="block text-[0.66rem] font-black uppercase tracking-[0.14em] text-slate-600">
                      Endereços envolvidos
                    </span>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {group.counterparties
                        .slice(0, 4)
                        .map((counterparty) => (
                          <a
                            key={counterparty.toLowerCase()}
                            href={getExplorerAddressUrl(
                              counterparty,
                              group.chainId
                            )}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 font-mono text-[0.68rem] text-slate-300 transition hover:border-emerald-300/25 hover:text-emerald-200"
                          >
                            {shortAddress(
                              counterparty
                            )} ↗
                          </a>
                        ))}

                      {group.counterparties.length > 4 ? (
                        <span className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-[0.68rem] text-slate-500">
                          +{group.counterparties.length - 4}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <span className="font-mono text-[0.68rem] text-slate-600">
                    {shortAddress(group.hash)}
                  </span>

                  <a
                    href={getExplorerTransactionUrl(
                      group.hash,
                      group.chainId
                    )}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs font-bold text-emerald-300 transition hover:text-emerald-200"
                  >
                    Ver transação no explorador ↗
                  </a>
                </div>
              </article>
            ))}
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

        {error && result ? (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            A atualização mais recente falhou. Continuam visíveis os últimos dados carregados: {error}
          </p>
        ) : null}

        {result?.partial ? (
          <p className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            O fornecedor devolveu dados parciais. Algumas entradas, sobretudo movimentos internos ou transferências de tokens, podem ainda não estar incluídas.
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
