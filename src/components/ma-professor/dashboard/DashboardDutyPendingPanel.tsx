import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react'

import {
  calendarRepository
} from '../calendar/calendarRepository'
import {
  getDutyEventDetails
} from '../calendar/dutyEvent'
import {
  MA_PROFESSOR_OPEN_DAILY_EVENT
} from '../setup/setupReadiness'
import type {
  EntityId,
  ISODate,
  SchoolCalendarEvent
} from '../types'

interface DashboardDutyPendingPanelProps {
  academicYearId: EntityId
  academicYearStartDate: ISODate
  referenceDate: ISODate
  refreshToken?: number
}

interface PendingDutyRow {
  event: SchoolCalendarEvent
  name: string
  timeLabel: string
}

const MAX_VISIBLE_PENDING_DUTIES = 8

function parseISODate(
  value: ISODate
) {
  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  )
}

function formatDate(
  value: ISODate
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short'
    }
  ).format(
    parseISODate(value)
  )
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível consultar os sumários pendentes dos Cargos.'
}

function sortPendingDuties(
  rows: PendingDutyRow[]
) {
  return [...rows].sort(
    (left, right) => {
      const dateComparison =
        right.event.startDate.localeCompare(
          left.event.startDate
        )

      if (dateComparison !== 0) {
        return dateComparison
      }

      const timeComparison =
        right.timeLabel.localeCompare(
          left.timeLabel
        )

      return timeComparison !== 0
        ? timeComparison
        : left.name.localeCompare(
            right.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

export default function DashboardDutyPendingPanel({
  academicYearId,
  academicYearStartDate,
  referenceDate,
  refreshToken = 0
}: DashboardDutyPendingPanelProps) {
  const [
    pendingDuties,
    setPendingDuties
  ] = useState<PendingDutyRow[]>([])
  const [
    loading,
    setLoading
  ] = useState(true)
  const [
    error,
    setError
  ] = useState('')

  const loadPendingDuties =
    useCallback(
      async () => {
        setLoading(true)
        setError('')

        try {
          const events =
            await calendarRepository.listEvents({
              academicYearId,
              dateFrom:
                academicYearStartDate,
              dateTo:
                referenceDate,
              type:
                'school_activity'
            })

          const nextRows =
            events.flatMap<PendingDutyRow>(
              event => {
                const details =
                  getDutyEventDetails(
                    event
                  )

                if (
                  !details ||
                  event.description.trim()
                ) {
                  return []
                }

                return [
                  {
                    event,
                    name:
                      details.name,
                    timeLabel:
                      details.timeLabel
                  }
                ]
              }
            )

          setPendingDuties(
            sortPendingDuties(
              nextRows
            )
          )
        } catch (loadError) {
          setError(
            getErrorMessage(
              loadError
            )
          )
        } finally {
          setLoading(false)
        }
      },
      [
        academicYearId,
        academicYearStartDate,
        referenceDate,
        refreshToken
      ]
    )

  useEffect(() => {
    void loadPendingDuties()
  }, [loadPendingDuties])

  const visiblePendingDuties =
    useMemo(
      () =>
        pendingDuties.slice(
          0,
          MAX_VISIBLE_PENDING_DUTIES
        ),
      [pendingDuties]
    )

  if (
    !loading &&
    !error &&
    pendingDuties.length === 0
  ) {
    return null
  }

  return (
    <section className="mx-auto mt-6 max-w-[110rem] px-4 sm:px-6 lg:px-8">
      <div className="rounded-[1.75rem] border border-violet-300/20 bg-violet-300/[0.055] p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
              Cargos
            </p>

            <h2 className="mt-2 text-xl font-black text-white">
              Sumários por preencher
            </h2>

            {!loading && !error ? (
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {pendingDuties.length}{' '}
                {pendingDuties.length === 1
                  ? 'ocorrência já realizada continua sem sumário.'
                  : 'ocorrências já realizadas continuam sem sumário.'}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void loadPendingDuties()
              }
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 transition hover:border-violet-300/30 hover:text-white disabled:opacity-50"
            >
              {loading
                ? 'A atualizar…'
                : 'Atualizar'}
            </button>

            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new Event(
                    MA_PROFESSOR_OPEN_DAILY_EVENT
                  )
                )
              }
              className="rounded-xl border border-violet-200/30 bg-violet-300 px-3 py-2 text-xs font-black text-slate-950 transition hover:brightness-110"
            >
              Abrir Diário
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm leading-6 text-rose-100">
            {error}
          </div>
        ) : loading ? (
          <p className="mt-4 text-sm font-semibold text-slate-500">
            A consultar Cargos…
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {visiblePendingDuties.map(
                row => (
                  <article
                    key={row.event.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/65 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">
                          {row.name}
                        </p>

                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {formatDate(
                            row.event.startDate
                          )}
                          {row.timeLabel
                            ? ` · ${row.timeLabel}`
                            : ''}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.6rem] font-black text-amber-100">
                        Pendente
                      </span>
                    </div>
                  </article>
                )
              )}
            </div>

            {pendingDuties.length >
            visiblePendingDuties.length ? (
              <p className="mt-3 text-xs font-semibold text-slate-500">
                +{' '}
                {pendingDuties.length -
                  visiblePendingDuties.length}{' '}
                ocorrências anteriores por preencher.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  )
}
