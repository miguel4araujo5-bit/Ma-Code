import {
  useEffect,
  useMemo,
  useRef,
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
  getChainConfig,
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

type PeriodSelection = {
  requestIdentity: string
  value: PricePeriod
}

type PriceHistoryCacheEntry = {
  cachedAt: number
  history: TokenPriceHistory
}

const PRICE_REQUEST_DELAY_MS = 350
const MAX_BROWSER_CACHE_ENTRIES = 40

const PRICE_CACHE_TTL_MS: Record<
  PricePeriod,
  number
> = {
  '15M': 2 * 60_000,
  '4H': 5 * 60_000,
  '1D': 10 * 60_000,
  '1M': 30 * 60_000,
  'Tudo': 6 * 60 * 60_000
}

const priceHistoryCache = new Map<
  string,
  PriceHistoryCacheEntry
>()

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

const createPriceCacheKey = (
  chainId: ChainId,
  contractAddress: string,
  period: PricePeriod
) =>
  `${chainId}:${contractAddress
    .trim()
    .toLowerCase()}:${period}`

const storePriceHistory = (
  key: string,
  history: TokenPriceHistory
) => {
  priceHistoryCache.delete(key)

  priceHistoryCache.set(
    key,
    {
      cachedAt: Date.now(),
      history
    }
  )

  while (
    priceHistoryCache.size >
    MAX_BROWSER_CACHE_ENTRIES
  ) {
    const oldestKey =
      priceHistoryCache.keys()
        .next().value

    if (
      typeof oldestKey !==
      'string'
    ) {
      break
    }

    priceHistoryCache.delete(
      oldestKey
    )
  }
}

const isMatchingHistory = (
  history: TokenPriceHistory,
  chainId: ChainId,
  contractAddress: string,
  period: PricePeriod
) =>
  history.chainId === chainId &&
  history.period === period &&
  history.contractAddress
    .toLowerCase() ===
    contractAddress
      .trim()
      .toLowerCase()

export default function TokenPricePanel({
  contractAddress,
  chainId = DEFAULT_CHAIN_ID,
  tokenSymbol = 'TOKEN',
  tokenName = 'Token',
  defaultPeriod = '1D',
  className = '',
  onClose
}: TokenPricePanelProps) {
  const requestIdentity =
    `${chainId}:${
      contractAddress
        .trim()
        .toLowerCase()
    }`

  const [
    periodSelection,
    setPeriodSelection
  ] = useState<PeriodSelection>(
    () => ({
      requestIdentity,
      value: defaultPeriod
    })
  )

  const period =
    periodSelection
      .requestIdentity ===
    requestIdentity
      ? periodSelection.value
      : defaultPeriod

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
    notice,
    setNotice
  ] =
    useState<string | null>(
      null
    )

  const [
    retryKey,
    setRetryKey
  ] = useState(0)

  const requestLockedRef =
    useRef(false)

  const forceRefreshRef =
    useRef(false)

  const cacheKey = useMemo(
    () =>
      createPriceCacheKey(
        chainId,
        contractAddress,
        period
      ),
    [
      chainId,
      contractAddress,
      period
    ]
  )

  const visibleHistory =
    useMemo(() => {
      if (!history) {
        return null
      }

      return isMatchingHistory(
        history,
        chainId,
        contractAddress,
        period
      )
        ? history
        : null
    }, [
      chainId,
      contractAddress,
      history,
      period
    ])

  useEffect(() => {
    requestLockedRef.current =
      false

    forceRefreshRef.current =
      false

    setPeriodSelection({
      requestIdentity,
      value: defaultPeriod
    })

    setHistory(null)
    setError(null)
    setNotice(null)
  }, [
    requestIdentity,
    defaultPeriod
  ])

  useEffect(() => {
    const forceRefresh =
      forceRefreshRef.current

    forceRefreshRef.current =
      false

    const cachedEntry =
      priceHistoryCache.get(
        cacheKey
      ) || null

    const cachedHistory =
      cachedEntry &&
      isMatchingHistory(
        cachedEntry.history,
        chainId,
        contractAddress,
        period
      )
        ? cachedEntry.history
        : null

    const cacheIsFresh =
      cachedEntry &&
      cachedHistory &&
      Date.now() -
        cachedEntry.cachedAt <=
        PRICE_CACHE_TTL_MS[
          period
        ]

    if (
      cacheIsFresh &&
      !forceRefresh
    ) {
      setHistory(
        cachedHistory
      )

      setLoading(false)
      setError(null)
      setNotice(null)

      requestLockedRef.current =
        false

      return
    }

    const controller =
      new AbortController()

    requestLockedRef.current =
      true

    setLoading(true)
    setError(null)
    setNotice(null)

    const timer =
      window.setTimeout(
        () => {
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
                controller
                  .signal
                  .aborted
              ) {
                return
              }

              storePriceHistory(
                cacheKey,
                result
              )

              setHistory(
                result
              )

              setError(null)
              setNotice(null)
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

                if (
                  cachedHistory
                ) {
                  setHistory(
                    cachedHistory
                  )

                  setError(null)

                  setNotice(
                    'Não foi possível atualizar agora. Está a ser apresentado o último gráfico disponível.'
                  )

                  return
                }

                setError(message)
              }
            )
            .finally(() => {
              if (
                controller
                  .signal
                  .aborted
              ) {
                return
              }

              setLoading(false)

              requestLockedRef.current =
                false
            })
        },
        PRICE_REQUEST_DELAY_MS
      )

    return () => {
      window.clearTimeout(
        timer
      )

      controller.abort()
    }
  }, [
    cacheKey,
    chainId,
    contractAddress,
    period,
    retryKey
  ])

  const handlePeriodChange = (
    nextPeriod: PricePeriod
  ) => {
    if (
      nextPeriod === period ||
      requestLockedRef.current
    ) {
      return
    }

    requestLockedRef.current =
      true

    setLoading(true)
    setError(null)
    setNotice(null)

    setPeriodSelection({
      requestIdentity,
      value: nextPeriod
    })
  }

  const handleRetry = () => {
    if (
      requestLockedRef.current
    ) {
      return
    }

    forceRefreshRef.current =
      true

    requestLockedRef.current =
      true

    setLoading(true)
    setError(null)
    setNotice(null)

    setRetryKey(
      (
        current
      ) =>
        current + 1
    )
  }

  const displaySymbol =
    visibleHistory?.symbol ||
    tokenSymbol ||
    'TOKEN'

  const displayName =
    visibleHistory?.name ||
    tokenName ||
    'Token'

  const isNativeAsset =
    contractAddress
      .trim()
      .toLowerCase() ===
    `native:${chainId}`

  const chain =
    getChainConfig(
      chainId
    )

  const explorerUrl =
    isNativeAsset
      ? null
      : getExplorerTokenUrl(
          contractAddress,
          chainId
        )

  const dataProvider =
    isNativeAsset
      ? 'CoinGecko'
      : 'GeckoTerminal'

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

            {explorerUrl ? (
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
            ) : (
              <span className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-semibold text-emerald-300">
                {chain.name} · Ativo nativo
              </span>
            )}
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
          loading
            ? undefined
            : handlePeriodChange
        }
        onRetry={
          loading
            ? undefined
            : handleRetry
        }
      />

      {notice ? (
        <p
          className="mx-2 mt-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs leading-5 text-amber-100/80"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 px-2 pb-1 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Dados públicos de mercado fornecidos pela {dataProvider}.
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
