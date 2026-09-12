import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  getDutyEventDetails,
  type DutyEventDetails
} from '../calendar/dutyEvent'
import {
  calendarRepository
} from '../calendar/calendarRepository'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import type {
  EntityId,
  ISODate,
  SchoolCalendarEvent
} from '../types'

interface DailyDutyWeekPanelProps {
  academicYearId: EntityId
  initialDate?: ISODate
  onSaved?: () =>
    | void
    | Promise<void>
}

interface DutyOccurrence {
  event: SchoolCalendarEvent
  details: DutyEventDetails
}

const DUTY_DISCARD_MESSAGE =
  'Existem alterações por guardar neste sumário de Cargo. Se continuar, essas alterações serão perdidas. Pretende continuar?'

function todayISO(): ISODate {
  const date = new Date()

  return [
    String(
      date.getFullYear()
    ).padStart(4, '0'),
    String(
      date.getMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getDate()
    ).padStart(2, '0')
  ].join('-')
}

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

function formatISODate(
  value: Date
): ISODate {
  return [
    String(
      value.getUTCFullYear()
    ).padStart(4, '0'),
    String(
      value.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      value.getUTCDate()
    ).padStart(2, '0')
  ].join('-')
}

function addDays(
  value: ISODate,
  amount: number
): ISODate {
  const date =
    parseISODate(value)

  date.setUTCDate(
    date.getUTCDate() + amount
  )

  return formatISODate(
    date
  )
}

function getWeekStart(
  value: ISODate
): ISODate {
  const date =
    parseISODate(value)
  const weekday =
    date.getUTCDay()
  const offset =
    weekday === 0
      ? -6
      : 1 - weekday

  date.setUTCDate(
    date.getUTCDate() + offset
  )

  return formatISODate(
    date
  )
}

function formatWeekRange(
  startDate: ISODate,
  endDate: ISODate
) {
  const start =
    parseISODate(startDate)
  const end =
    parseISODate(endDate)

  const startLabel =
    new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: 'numeric',
        month: 'short'
      }
    ).format(start)

  const endLabel =
    new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }
    ).format(end)

  return `${startLabel} — ${endLabel}`
}

function formatOccurrenceDate(
  value: ISODate
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
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
    : 'Não foi possível carregar os Cargos desta semana.'
}

function sortOccurrences(
  rows: DutyOccurrence[]
) {
  return [...rows].sort(
    (left, right) => {
      const dateComparison =
        left.event.startDate.localeCompare(
          right.event.startDate
        )

      if (dateComparison !== 0) {
        return dateComparison
      }

      const timeComparison =
        left.details.startTime.localeCompare(
          right.details.startTime
        )

      if (timeComparison !== 0) {
        return timeComparison
      }

      return left.details.name.localeCompare(
        right.details.name,
        'pt-PT',
        {
          sensitivity: 'base'
        }
      )
    }
  )
}

export default function DailyDutyWeekPanel({
  academicYearId,
  initialDate,
  onSaved
}: DailyDutyWeekPanelProps) {
  const [
    weekStart,
    setWeekStart
  ] = useState<ISODate>(() =>
    getWeekStart(
      initialDate ?? todayISO()
    )
  )
  const [
    occurrences,
    setOccurrences
  ] = useState<DutyOccurrence[]>([])
  const [
    loading,
    setLoading
  ] = useState(true)
  const [
    loadError,
    setLoadError
  ] = useState('')
  const [
    selected,
    setSelected
  ] = useState<DutyOccurrence | null>(
    null
  )
  const [
    summary,
    setSummary
  ] = useState('')
  const [
    saving,
    setSaving
  ] = useState(false)
  const [
    editorError,
    setEditorError
  ] = useState('')
  const editorRef =
    useRef<HTMLDivElement>(null)

  const weekEnd =
    useMemo(
      () =>
        addDays(
          weekStart,
          4
        ),
      [weekStart]
    )

  const hasUnsavedSummary =
    Boolean(
      selected &&
      summary !==
        selected.event.description
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedSummary,
    editorRef,
    DUTY_DISCARD_MESSAGE
  )

  useEffect(() => {
    if (!initialDate) {
      return
    }

    setWeekStart(
      getWeekStart(initialDate)
    )
  }, [initialDate])

  const loadOccurrences =
    useCallback(
      async () => {
        setLoading(true)
        setLoadError('')

        try {
          const events =
            await calendarRepository.listEvents({
              academicYearId,
              dateFrom:
                weekStart,
              dateTo:
                weekEnd,
              type:
                'school_activity'
            })

          const nextOccurrences =
            events.flatMap<DutyOccurrence>(
              event => {
                const details =
                  getDutyEventDetails(
                    event
                  )

                return details
                  ? [
                      {
                        event,
                        details
                      }
                    ]
                  : []
              }
            )

          setOccurrences(
            sortOccurrences(
              nextOccurrences
            )
          )
        } catch (error) {
          setLoadError(
            getErrorMessage(error)
          )
        } finally {
          setLoading(false)
        }
      },
      [
        academicYearId,
        weekEnd,
        weekStart
      ]
    )

  useEffect(() => {
    void loadOccurrences()
  }, [loadOccurrences])

  function openSummary(
    occurrence: DutyOccurrence
  ) {
    if (saving) {
      return
    }

    setSelected(
      occurrence
    )
    setSummary(
      occurrence.event.description
    )
    setEditorError('')
  }

  function closeSummary() {
    if (saving) {
      return
    }

    if (
      hasUnsavedSummary &&
      !window.confirm(
        DUTY_DISCARD_MESSAGE
      )
    ) {
      return
    }

    setSelected(null)
    setSummary('')
    setEditorError('')
  }

  async function saveSummary() {
    if (
      !selected ||
      saving
    ) {
      return
    }

    setSaving(true)
    setEditorError('')

    try {
      const current =
        await calendarRepository.getEvent(
          selected.event.id
        )

      if (!current) {
        throw new Error(
          'Este Cargo já não existe.'
        )
      }

      if (
        current.updatedAt !==
          selected.event.updatedAt &&
        current.description !==
          selected.event.description
      ) {
        throw new Error(
          'Este sumário foi alterado noutra aba ou janela. Feche e volte a abrir o Cargo antes de guardar.'
        )
      }

      const updated =
        await calendarRepository.updateEvent(
          selected.event.id,
          {
            description:
              summary
          }
        )

      setOccurrences(
        currentRows =>
          currentRows.map(
            row =>
              row.event.id ===
                updated.id
                ? {
                    ...row,
                    event:
                      updated
                  }
                : row
          )
      )

      setSelected(null)
      setSummary('')

      try {
        await onSaved?.()
      } catch {
        // O sumário já ficou persistido; uma atualização auxiliar não altera esse resultado.
      }
    } catch (error) {
      setEditorError(
        getErrorMessage(error)
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="bg-slate-950 px-3 pt-2 text-white sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px] rounded-2xl border border-violet-300/15 bg-violet-300/[0.045] px-3 py-2.5 shadow-lg shadow-black/10">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.12em] text-violet-100">
              Cargos
            </span>

            <p className="truncate text-xs font-bold text-slate-300">
              {formatWeekRange(
                weekStart,
                weekEnd
              )}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setWeekStart(
                  current =>
                    addDays(
                      current,
                      -7
                    )
                )
              }
              disabled={
                loading || saving
              }
              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 disabled:opacity-40"
              aria-label="Semana anterior de Cargos"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() =>
                setWeekStart(
                  getWeekStart(
                    todayISO()
                  )
                )
              }
              disabled={
                loading || saving
              }
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-black text-slate-300 disabled:opacity-40"
            >
              Esta semana
            </button>

            <button
              type="button"
              onClick={() =>
                setWeekStart(
                  current =>
                    addDays(
                      current,
                      7
                    )
                )
              }
              disabled={
                loading || saving
              }
              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 disabled:opacity-40"
              aria-label="Semana seguinte de Cargos"
            >
              ›
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            A carregar Cargos…
          </p>
        ) : loadError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold text-rose-200">
              {loadError}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadOccurrences()
              }
              className="rounded-lg border border-rose-300/20 bg-rose-300/[0.07] px-2.5 py-1 text-[0.65rem] font-black text-rose-100"
            >
              Tentar novamente
            </button>
          </div>
        ) : occurrences.length > 0 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
            {occurrences.map(
              occurrence => (
                <button
                  key={
                    occurrence.event.id
                  }
                  type="button"
                  onClick={() =>
                    openSummary(
                      occurrence
                    )
                  }
                  className="min-w-[12rem] shrink-0 rounded-xl border border-violet-300/15 bg-slate-950/70 px-3 py-2 text-left transition hover:border-violet-300/40 hover:bg-violet-300/[0.07]"
                >
                  <span className="block truncate text-xs font-black text-white">
                    {occurrence.details.name}
                  </span>

                  <span className="mt-0.5 block text-[0.62rem] font-semibold text-slate-400">
                    {formatOccurrenceDate(
                      occurrence.event.startDate
                    )}
                    {occurrence.details.timeLabel
                      ? ` · ${occurrence.details.timeLabel}`
                      : ''}
                  </span>

                  <span className={`mt-1 block text-[0.6rem] font-black ${
                    occurrence.event.description.trim()
                      ? 'text-emerald-200'
                      : 'text-amber-200'
                  }`}>
                    {occurrence.event.description.trim()
                      ? 'Sumário preenchido'
                      : 'Sumário por preencher'}
                  </span>
                </button>
              )
            )}
          </div>
        ) : (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Não existem Cargos nesta semana.
          </p>
        )}
      </div>

      {selected ? (
        <div
          ref={editorRef}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ma-professor-daily-duty-summary-title"
        >
          <section className="w-full max-w-2xl rounded-[2rem] border border-violet-300/20 bg-slate-950 p-5 shadow-2xl shadow-black/50 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
                  Cargo
                </p>

                <h2
                  id="ma-professor-daily-duty-summary-title"
                  className="mt-2 truncate text-2xl font-black text-white"
                >
                  {selected.details.name}
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  {formatOccurrenceDate(
                    selected.event.startDate
                  )}
                  {selected.details.timeLabel
                    ? ` · ${selected.details.timeLabel}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={closeSummary}
                disabled={saving}
                aria-label="Fechar"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-black text-white">
                Sumário
              </span>

              <textarea
                value={summary}
                onChange={event =>
                  setSummary(
                    event.target.value
                  )
                }
                disabled={saving}
                rows={7}
                placeholder="Escreva o sumário deste Cargo."
                className="w-full resize-y rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:opacity-60"
              />
            </label>

            {editorError ? (
              <p className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm leading-6 text-rose-100">
                {editorError}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeSummary}
                disabled={saving}
                className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveSummary()
                }
                disabled={saving}
                className="rounded-xl border border-violet-200/30 bg-gradient-to-r from-violet-300 to-fuchsia-300 px-5 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
              >
                {saving
                  ? 'A guardar…'
                  : 'Guardar sumário'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
