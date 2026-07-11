import {
  useId,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react'

import {
  PRICE_PERIODS,
  type PricePeriod,
  type TokenPriceHistory,
  type TokenPricePoint
} from '../../lib/maCarteiraApi'

type PriceChartProps = {
  history: TokenPriceHistory | null
  period: PricePeriod
  loading?: boolean
  error?: string | null
  className?: string
  onPeriodChange?: (
    period: PricePeriod
  ) => void
  onRetry?: () => void
}

type ChartPoint = TokenPricePoint & {
  time: number
  x: number
  y: number
}

const CHART_WIDTH = 720
const CHART_HEIGHT = 250

const PADDING_LEFT = 20
const PADDING_RIGHT = 20
const PADDING_TOP = 22
const PADDING_BOTTOM = 42

const formatUsd = (
  value: number
) => {
  const absolute = Math.abs(value)

  if (!Number.isFinite(value)) {
    return '—'
  }

  if (absolute === 0) {
    return '$0,00'
  }

  const maximumFractionDigits =
    absolute >= 1000
      ? 0
      : absolute >= 1
        ? 4
        : absolute >= 0.01
          ? 6
          : 10

  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits:
        absolute >= 1
          ? 2
          : 0,
      maximumFractionDigits
    }
  ).format(value)
}

const formatCompactUsd = (
  value: number
) => {
  if (!Number.isFinite(value)) {
    return '—'
  }

  if (Math.abs(value) < 1000) {
    return formatUsd(value)
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2
    }
  ).format(value)
}

const formatPercentage = (
  value: number
) =>
  `${value >= 0 ? '+' : ''}${new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(value)}%`

const formatPointDate = (
  timestamp: string,
  period: PricePeriod,
  includeTime = false
) => {
  const date = new Date(timestamp)

  if (Number.isNaN(date.getTime())) {
    return '—'
  }

  if (
    period === '15M' ||
    period === '4H' ||
    period === '1D'
  ) {
    return new Intl.DateTimeFormat(
      'pt-PT',
      includeTime
        ? {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
          }
        : {
            hour: '2-digit',
            minute: '2-digit'
          }
    ).format(date)
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      year:
        period === 'Tudo'
          ? '2-digit'
          : undefined
    }
  ).format(date)
}

const getGridLines = () => [
  0,
  0.25,
  0.5,
  0.75,
  1
]

const cleanPoints = (
  points: TokenPricePoint[]
) => {
  const byTimestamp = new Map<
    number,
    TokenPricePoint
  >()

  points.forEach((point) => {
    const time = new Date(
      point.timestamp
    ).getTime()

    if (
      !Number.isFinite(time) ||
      !Number.isFinite(point.open) ||
      !Number.isFinite(point.high) ||
      !Number.isFinite(point.low) ||
      !Number.isFinite(point.close) ||
      point.open <= 0 ||
      point.high <= 0 ||
      point.low <= 0 ||
      point.close <= 0
    ) {
      return
    }

    byTimestamp.set(
      time,
      {
        ...point,

        timestamp: new Date(
          time
        ).toISOString(),

        high: Math.max(
          point.open,
          point.high,
          point.low,
          point.close
        ),

        low: Math.min(
          point.open,
          point.high,
          point.low,
          point.close
        ),

        volume:
          Number.isFinite(
            point.volume
          ) &&
          point.volume > 0
            ? point.volume
            : 0
      }
    )
  })

  return [
    ...byTimestamp.entries()
  ]
    .sort(
      (
        [firstTimestamp],
        [secondTimestamp]
      ) =>
        firstTimestamp -
        secondTimestamp
    )
    .map(
      ([, point]) => point
    )
}

export default function PriceChart({
  history,
  period,
  loading = false,
  error = null,
  className = '',
  onPeriodChange,
  onRetry
}: PriceChartProps) {
  const gradientId =
    useId().replace(
      /:/g,
      ''
    )

  const [
    activeIndex,
    setActiveIndex
  ] = useState<number | null>(
    null
  )

  const chart = useMemo(() => {
    const source = cleanPoints(
      history?.points || []
    )

    if (!source.length) {
      return null
    }

    const times = source.map(
      (point) =>
        new Date(
          point.timestamp
        ).getTime()
    )

    const firstTime =
      Math.min(...times)

    const lastTime =
      Math.max(...times)

    const timeRange = Math.max(
      lastTime - firstTime,
      1
    )

    const values = source.flatMap(
      (point) => [
        point.low,
        point.high
      ]
    )

    const rawMin =
      Math.min(...values)

    const rawMax =
      Math.max(...values)

    const rawRange =
      rawMax - rawMin

    const pricePadding =
      rawRange > 0
        ? rawRange * 0.08
        : Math.max(
            rawMax * 0.03,
            0.0000000001
          )

    const minimum = Math.max(
      0,
      rawMin - pricePadding
    )

    const maximum =
      rawMax + pricePadding

    const priceRange = Math.max(
      maximum - minimum,
      0.0000000001
    )

    const drawableWidth =
      CHART_WIDTH -
      PADDING_LEFT -
      PADDING_RIGHT

    const drawableHeight =
      CHART_HEIGHT -
      PADDING_TOP -
      PADDING_BOTTOM

    const points: ChartPoint[] =
      source.map((point) => {
        const time = new Date(
          point.timestamp
        ).getTime()

        const timePosition =
          source.length === 1
            ? 0.5
            : (
                time -
                firstTime
              ) /
              timeRange

        return {
          ...point,
          time,

          x:
            PADDING_LEFT +
            timePosition *
              drawableWidth,

          y:
            PADDING_TOP +
            (
              1 -
              (
                point.close -
                minimum
              ) /
              priceRange
            ) *
            drawableHeight
        }
      })

    const linePath = points
      .map(
        (
          point,
          index
        ) =>
          `${
            index === 0
              ? 'M'
              : 'L'
          } ${point.x} ${point.y}`
      )
      .join(' ')

    const areaPath = [
      `M ${points[0].x} ${
        CHART_HEIGHT -
        PADDING_BOTTOM
      }`,

      ...points.map(
        (point) =>
          `L ${point.x} ${point.y}`
      ),

      `L ${
        points[
          points.length - 1
        ].x
      } ${
        CHART_HEIGHT -
        PADDING_BOTTOM
      }`,

      'Z'
    ].join(' ')

    return {
      points,
      linePath,
      areaPath,
      minimum,
      maximum,
      drawableHeight
    }
  }, [history])

  const activePoint =
    chart &&
    activeIndex !== null
      ? chart.points[
          activeIndex
        ] || null
      : null

  const handlePointerMove = (
    event:
      ReactPointerEvent<SVGSVGElement>
  ) => {
    if (!chart?.points.length) {
      return
    }

    const bounds =
      event.currentTarget
        .getBoundingClientRect()

    const relativeX =
      (
        (
          event.clientX -
          bounds.left
        ) /
        bounds.width
      ) *
      CHART_WIDTH

    let closestIndex = 0
    let closestDistance =
      Number.POSITIVE_INFINITY

    chart.points.forEach(
      (
        point,
        index
      ) => {
        const distance =
          Math.abs(
            point.x -
            relativeX
          )

        if (
          distance <
          closestDistance
        ) {
          closestDistance =
            distance

          closestIndex =
            index
        }
      }
    )

    setActiveIndex(
      closestIndex
    )
  }

  const isPositive =
    (
      history
        ?.changePercentage ||
      0
    ) >= 0

  const currentPrice =
    chart?.points[
      chart.points.length - 1
    ]?.close ||
    history?.currentPriceUsd ||
    0

  const firstPoint =
    chart?.points[0] || null

  const middlePoint =
    chart?.points[
      Math.floor(
        (
          chart.points.length -
          1
        ) /
        2
      )
    ] || null

  const lastPoint =
    chart?.points[
      chart.points.length -
      1
    ] || null

  return (
    <section
      className={`overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 ${className}`.trim()}
      aria-label="Histórico de preço do token"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Preço atual
          </p>

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <strong className="break-all text-2xl font-black tracking-tight text-white sm:text-3xl">
              {history
                ? formatUsd(
                    currentPrice
                  )
                : '—'}
            </strong>

            {history ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  isPositive
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-rose-400/10 text-rose-300'
                }`}
              >
                {formatPercentage(
                  history.changePercentage
                )}
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-slate-500">
            {history
              ? `${history.symbol} · ${history.poolName}`
              : 'Histórico em USD'}
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          {PRICE_PERIODS.map(
            (option) => (
              <button
                key={option}
                type="button"
                onClick={() =>
                  onPeriodChange?.(
                    option
                  )
                }
                disabled={
                  !onPeriodChange ||
                  (
                    loading &&
                    option === period
                  )
                }
                aria-pressed={
                  option === period
                }
                className={`min-h-9 rounded-xl px-3 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  option === period
                    ? 'bg-emerald-300 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {option}
              </button>
            )
          )}
        </div>
      </div>

      <div className="relative min-h-[260px] px-2 py-4 sm:px-4">
        {loading && !chart ? (
          <div
            className="flex min-h-[230px] flex-col justify-end gap-3 px-2 pb-4"
            aria-live="polite"
          >
            <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />

            <div className="h-36 animate-pulse rounded-3xl bg-gradient-to-b from-emerald-300/10 to-transparent" />

            <p className="text-center text-sm text-slate-500">
              A carregar o histórico de preço…
            </p>
          </div>
        ) : error && !chart ? (
          <div className="flex min-h-[230px] flex-col items-center justify-center px-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-lg text-rose-300">
              !
            </span>

            <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
              {error}
            </p>

            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 min-h-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-emerald-300/30 hover:bg-emerald-300/10"
              >
                Tentar novamente
              </button>
            ) : null}
          </div>
        ) : chart && history ? (
          <>
            <div className="relative">
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                role="img"
                aria-label={`Gráfico cronológico de preço de ${history.symbol} no período ${period}`}
                className="h-auto w-full touch-none overflow-visible"
                onPointerMove={
                  handlePointerMove
                }
                onPointerLeave={() =>
                  setActiveIndex(null)
                }
              >
                <defs>
                  <linearGradient
                    id={`${gradientId}-area`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="rgb(110 231 183)"
                      stopOpacity="0.28"
                    />

                    <stop
                      offset="100%"
                      stopColor="rgb(110 231 183)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                {getGridLines().map(
                  (position) => {
                    const y =
                      PADDING_TOP +
                      position *
                        (
                          CHART_HEIGHT -
                          PADDING_TOP -
                          PADDING_BOTTOM
                        )

                    const value =
                      chart.maximum -
                      position *
                        (
                          chart.maximum -
                          chart.minimum
                        )

                    return (
                      <g key={position}>
                        <line
                          x1={
                            PADDING_LEFT
                          }
                          x2={
                            CHART_WIDTH -
                            PADDING_RIGHT
                          }
                          y1={y}
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.12)"
                          strokeWidth="1"
                          strokeDasharray="4 8"
                        />

                        {(
                          position === 0 ||
                          position === 1
                        ) ? (
                          <text
                            x={
                              CHART_WIDTH -
                              PADDING_RIGHT
                            }
                            y={
                              position === 0
                                ? y + 12
                                : y - 7
                            }
                            textAnchor="end"
                            fill="rgb(100 116 139)"
                            fontSize="11"
                          >
                            {formatUsd(
                              value
                            )}
                          </text>
                        ) : null}
                      </g>
                    )
                  }
                )}

                <path
                  d={chart.areaPath}
                  fill={`url(#${gradientId}-area)`}
                />

                <path
                  d={chart.linePath}
                  fill="none"
                  stroke="rgb(110 231 183)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />

                {activePoint ? (
                  <g>
                    <line
                      x1={
                        activePoint.x
                      }
                      x2={
                        activePoint.x
                      }
                      y1={
                        PADDING_TOP
                      }
                      y2={
                        CHART_HEIGHT -
                        PADDING_BOTTOM
                      }
                      stroke="rgba(226, 232, 240, 0.28)"
                      strokeWidth="1"
                      strokeDasharray="4 5"
                    />

                    <circle
                      cx={
                        activePoint.x
                      }
                      cy={
                        activePoint.y
                      }
                      r="7"
                      fill="rgb(15 23 42)"
                      stroke="rgb(110 231 183)"
                      strokeWidth="3"
                    />
                  </g>
                ) : null}

                {firstPoint ? (
                  <text
                    x={
                      PADDING_LEFT
                    }
                    y={
                      CHART_HEIGHT -
                      8
                    }
                    fill="rgb(100 116 139)"
                    fontSize="11"
                  >
                    {formatPointDate(
                      firstPoint.timestamp,
                      period
                    )}
                  </text>
                ) : null}

                {middlePoint ? (
                  <text
                    x={
                      CHART_WIDTH /
                      2
                    }
                    y={
                      CHART_HEIGHT -
                      8
                    }
                    textAnchor="middle"
                    fill="rgb(100 116 139)"
                    fontSize="11"
                  >
                    {formatPointDate(
                      middlePoint.timestamp,
                      period
                    )}
                  </text>
                ) : null}

                {lastPoint ? (
                  <text
                    x={
                      CHART_WIDTH -
                      PADDING_RIGHT
                    }
                    y={
                      CHART_HEIGHT -
                      8
                    }
                    textAnchor="end"
                    fill="rgb(100 116 139)"
                    fontSize="11"
                  >
                    {formatPointDate(
                      lastPoint.timestamp,
                      period
                    )}
                  </text>
                ) : null}
              </svg>

              {activePoint ? (
                <div
                  className="pointer-events-none absolute top-2 z-10 min-w-36 -translate-x-1/2 rounded-2xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur"
                  style={{
                    left: `${
                      (
                        activePoint.x /
                        CHART_WIDTH
                      ) *
                      100
                    }%`
                  }}
                >
                  <p className="text-[11px] font-semibold text-slate-400">
                    {formatPointDate(
                      activePoint.timestamp,
                      period,
                      true
                    )}
                  </p>

                  <p className="mt-1 text-sm font-black text-white">
                    {formatUsd(
                      activePoint.close
                    )}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Volume{' '}
                    {formatCompactUsd(
                      activePoint.volume
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            {loading ? (
              <div className="absolute right-5 top-5 rounded-full border border-emerald-300/20 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg">
                A atualizar…
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex min-h-[230px] items-center justify-center px-5 text-center text-sm text-slate-500">
            Ainda não existem dados de preço para apresentar.
          </div>
        )}
      </div>

      {history ? (
        <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-4">
          {[
            [
              'Máximo',
              formatUsd(
                history.highUsd
              )
            ],
            [
              'Mínimo',
              formatUsd(
                history.lowUsd
              )
            ],
            [
              'Volume',
              formatCompactUsd(
                history.volumeUsd
              )
            ],
            [
              'Liquidez',
              formatCompactUsd(
                history.liquidityUsd
              )
            ]
          ].map(
            ([
              label,
              value
            ]) => (
              <div
                key={label}
                className="border-white/10 px-4 py-3 odd:border-r sm:border-r sm:last:border-r-0"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                  {label}
                </p>

                <p
                  className="mt-1 truncate text-sm font-bold text-slate-200"
                  title={value}
                >
                  {value}
                </p>
              </div>
            )
          )}
        </div>
      ) : null}

      <p className="border-t border-white/10 px-4 py-3 text-[0.68rem] leading-5 text-slate-600 sm:px-5">
        Os pontos são ordenados pela data real de cada vela. O preço apresentado corresponde ao contrato selecionado, em USD.
      </p>
    </section>
  )
}
