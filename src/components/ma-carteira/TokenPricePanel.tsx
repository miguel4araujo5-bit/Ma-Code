import {
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  MaCarteiraApiError,
  fetchTokenPriceHistory,
  type PricePeriod,
  type TokenPriceHistory
} from '../../lib/maCarteiraApi'

import {
  DEFAULT_CHAIN_ID,
  getExplorerTokenUrl,
  type ChainId
} from '../../lib/maCarteiraChains'

import PriceChart from './PriceChart'

type TokenPricePanelProps = {
  contractAddress: string
  chainId?: ChainId
  tokenSymbol?: string
  tokenName?: string
  defaultPeriod?: PricePeriod
  className?: string
  onClose?: () => void
}

const shortContract = (
  address: string
) => {
  const clean =
    address.trim()

  if (
    clean.length <= 14
  ) {
    return clean
  }

  return `${
    clean.slice(0, 8)
  }…${
    clean.slice(-6)
  }`
}

const getTokenInitials = (
  symbol: string
) =>
  symbol
    .replace(
      /[^a-zA-Z0-9]/g,
      ''
    )
    .slice(0, 3)
    .toUpperCase() ||
  'TKN'

export default function TokenPricePanel({
  contractAddress,
  chainId = DEFAULT_CHAIN_ID,
  tokenSymbol = 'TOKEN',
  tokenName = 'Token',
  defaultPeriod = '1D',
  className = '',
  onClose
}: TokenPricePanelProps) {
  const [
    period,
    setPeriod
  ] = useState<PricePeriod>(
    defaultPeriod
  )

  const [
    history,
    setHistory
  ] =
    useState<TokenPriceHistory | null>(
      null
    )

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    error,
    setError
  ] =
    useState<string | null>(
      null
    )

  const [
    retryKey,
    setRetryKey
  ] = useState(0)

  const requestIdentity =
    `${chainId}:${
      contractAddress
        .trim()
        .toLowerCase()
    }`

  const visibleHistory =
    useMemo(() => {
      if (!history) {
        return null
      }

      return (
        history.chainId ===
          chainId &&
        history.contractAddress
          .toLowerCase() ===
          contractAddress
            .trim()
            .toLowerCase()
      )
        ? history
        : null
    }, [
      chainId,
      contractAddress,
      history
    ])

  useEffect(() => {
    setHistory(null)
    setError(null)
    setPeriod(
      defaultPeriod
    )
  }, [
    requestIdentity,
    defaultPeriod
  ])

  useEffect(() => {
    const controller =
      new AbortController()

    setLoading(true)
    setError(null)

    void fetchTokenPriceHistory(
      contractAddress,
      {
        chainId,
        period,
        signal:
          controller.signal
      }
    )
      .then((result) => {
        if (
          !controller
            .signal
            .aborted
        ) {
          setHistory(
            result
          )
        }
      })
      .catch(
        (
          caughtError:
            unknown
        ) => {
          if (
            controller
              .signal
              .aborted
          ) {
            return
          }

          const message =
            caughtError instanceof
              MaCarteiraApiError ||
            caughtError instanceof
              Error
              ? caughtError.message
              : 'Não foi possível consultar o histórico de preço.'

          setError(message)
        }
      )
      .finally(() => {
        if (
          !controller
            .signal
            .aborted
        ) {
          setLoading(false)
        }
      })

    return () =>
      controller.abort()
  }, [
    chainId,
    contractAddress,
    period,
    retryKey
  ])

  const displaySymbol =
    visibleHistory?.symbol ||
    tokenSymbol ||
    'TOKEN'

  const displayName =
    visibleHistory?.name ||
    tokenName ||
    'Token'

  const explorerUrl =
    getExplorerTokenUrl(
      contractAddress,
      chainId
    )

  return (
    <section
      className={`rounded-[2rem] border border-white/10 bg-slate-950/75 p-3 shadow-2xl shadow-black/20 backdrop-blur sm:p-4 ${className}`.trim()}
      aria-label={`Preço de ${displaySymbol}`}
    >
      <div className="flex items-start justify-between gap-4 px-1 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-[11px] font-black tracking-tight text-emerald-300">
            {getTokenInitials(
              displaySymbol
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-black text-white sm:text-lg">
                {displaySymbol}
              </h3>

              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Preço
              </span>
            </div>

            <p className="truncate text-sm text-slate-400">
              {displayName}
            </p>

            <a
              href={explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex max-w-full items-center gap-1 font-mono text-xs text-emerald-300 transition hover:text-emerald-200"
              title={
                contractAddress
              }
            >
              <span className="truncate">
                {shortContract(
                  contractAddress
                )}
              </span>

              <span aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gráfico de preço"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-lg text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-300/10 hover:text-rose-200"
          >
            ×
          </button>
        ) : null}
      </div>

      <PriceChart
        history={
          visibleHistory
        }
        period={period}
        loading={loading}
        error={error}
        onPeriodChange={
          setPeriod
        }
        onRetry={() =>
          setRetryKey(
            (
              current
            ) =>
              current + 1
          )
        }
      />

      <div className="flex flex-col gap-2 px-2 pb-1 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Dados públicos de mercado fornecidos pela GeckoTerminal.
        </p>

        {visibleHistory
          ?.fetchedAt ? (
          <p>
            Atualizado{' '}
            {new Intl.DateTimeFormat(
              'pt-PT',
              {
                hour:
                  '2-digit',
                minute:
                  '2-digit'
              }
            ).format(
              new Date(
                visibleHistory
                  .fetchedAt
              )
            )}
          </p>
        ) : null}
      </div>
    </section>
  )
}
