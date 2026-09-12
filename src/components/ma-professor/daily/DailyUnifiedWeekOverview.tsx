import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  calendarRepository
} from '../calendar/calendarRepository'
import {
  calendarWorkspaceRepository,
  type CalendarLessonRow,
  type CalendarWorkspaceSnapshot
} from '../calendar/calendarWorkspaceRepository'
import {
  getDutyEventDetails,
  type DutyEventDetails
} from '../calendar/dutyEvent'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import type {
  EntityId,
  ISODate,
  SchoolCalendarEvent
} from '../types'

interface DailyUnifiedWeekOverviewProps {
  academicYearId: EntityId
  date: ISODate
  selectedLessonId?: EntityId | null
  refreshToken?: number
  onSelectDate: (
    date: ISODate
  ) => void
  onSelectLesson: (
    date: ISODate,
    lessonId: EntityId
  ) => void
  onSaved?: () =>
    | void
    | Promise<void>
}

interface DutyOccurrence {
  event: SchoolCalendarEvent
  details: DutyEventDetails
}

interface WeekTimeSlot {
  key: string
  startTime: string
  endTime: string
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

function formatShortWeekday(
  value: ISODate
) {
  const parsed =
    parseISODate(value)

  const weekday =
    new Intl.DateTimeFormat(
      'pt-PT',
      {
        weekday: 'short'
      }
    )
      .format(parsed)
      .replace('.', '')

  return `${weekday} ${String(
    parsed.getUTCDate()
  ).padStart(2, '0')}/${String(
    parsed.getUTCMonth() + 1
  ).padStart(2, '0')}`
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
        month: 'long'
      }
    ).format(start)

  const endLabel =
    new Intl.DateTimeFormat(
      'pt-PT',
      {
        day: 'numeric',
        month: 'long',
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
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }
  ).format(
    parseISODate(value)
  )
}

function getISOWeekday(
  value: ISODate
) {
  const weekday =
    parseISODate(
      value
    ).getUTCDay()

  return weekday === 0
    ? 7
    : weekday
}

function getSubjectLabel(
  row: CalendarLessonRow
) {
  return row.subject.shortName.trim() ||
    row.subject.name
}

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error &&
    error.message.trim()
    ? error.message
    : 'Não foi possível preparar a semana.'
}

function sortDuties(
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

      return timeComparison !== 0
        ? timeComparison
        : left.details.name.localeCompare(
            right.details.name,
            'pt-PT',
            {
              sensitivity: 'base'
            }
          )
    }
  )
}

function buildTimeSlots(
  snapshot: CalendarWorkspaceSnapshot,
  duties: DutyOccurrence[]
) {
  const slots =
    new Map<string, WeekTimeSlot>()

  for (const day of snapshot.days) {
    if (
      getISOWeekday(day.date) > 5
    ) {
      continue
    }

    for (const row of day.lessons) {
      const {
        startTime,
        endTime
      } = row.lesson
      const key =
        `${startTime}-${endTime}`

      slots.set(
        key,
        {
          key,
          startTime,
          endTime
        }
      )
    }
  }

  for (const duty of duties) {
    const {
      startTime,
      endTime
    } = duty.details

    if (
      !startTime ||
      !endTime
    ) {
      continue
    }

    const key =
      `${startTime}-${endTime}`

    slots.set(
      key,
      {
        key,
        startTime,
        endTime
      }
    )
  }

  return [...slots.values()]
    .sort(
      (left, right) => {
        const startComparison =
          left.startTime.localeCompare(
            right.startTime
          )

        return startComparison !== 0
          ? startComparison
          : left.endTime.localeCompare(
              right.endTime
            )
      }
    )
}

export default function DailyUnifiedWeekOverview({
  academicYearId,
  date,
  selectedLessonId = null,
  refreshToken = 0,
  onSelectDate,
  onSelectLesson,
  onSaved
}: DailyUnifiedWeekOverviewProps) {
  const [
    snapshot,
    setSnapshot
  ] = useState<CalendarWorkspaceSnapshot | null>(
    null
  )
  const [
    duties,
    setDuties
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
    selectedDuty,
    setSelectedDuty
  ] = useState<DutyOccurrence | null>(
    null
  )
  const [
    summary,
    setSummary
  ] = useState('')
  const [
    savingDuty,
    setSavingDuty
  ] = useState(false)
  const [
    editorError,
    setEditorError
  ] = useState('')
  const editorRef =
    useRef<HTMLDivElement>(null)

  const hasUnsavedSummary =
    Boolean(
      selectedDuty &&
      summary !==
        selectedDuty.event.description
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedSummary,
    editorRef,
    DUTY_DISCARD_MESSAGE
  )

  const loadWeek =
    useCallback(
      async () => {
        setLoading(true)
        setLoadError('')

        try {
          const nextSnapshot =
            await calendarWorkspaceRepository.getWorkspace(
              academicYearId,
              'week',
              date,
              {}
            )

          const events =
            await calendarRepository.listEvents({
              academicYearId,
              dateFrom:
                nextSnapshot.primaryStartDate,
              dateTo:
                nextSnapshot.primaryEndDate,
              type:
                'school_activity'
            })

          const nextDuties =
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

          setSnapshot(
            nextSnapshot
          )
          setDuties(
            sortDuties(
              nextDuties
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
        date,
        refreshToken
      ]
    )

  useEffect(() => {
    void loadWeek()
  }, [loadWeek])

  const weekDays =
    useMemo(
      () =>
        snapshot?.days.filter(
          day =>
            getISOWeekday(
              day.date
            ) <= 5
        ) ?? [],
      [snapshot]
    )

  const timeSlots =
    useMemo(
      () =>
        snapshot
          ? buildTimeSlots(
              snapshot,
              duties
            )
          : [],
      [
        duties,
        snapshot
      ]
    )

  const untimedDuties =
    useMemo(
      () =>
        duties.filter(
          duty =>
            !duty.details.startTime ||
            !duty.details.endTime
        ),
      [duties]
    )

  function openDuty(
    duty: DutyOccurrence
  ) {
    if (savingDuty) {
      return
    }

    setSelectedDuty(
      duty
    )
    setSummary(
      duty.event.description
    )
    setEditorError('')
  }

  function closeDuty() {
    if (savingDuty) {
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

    setSelectedDuty(null)
    setSummary('')
    setEditorError('')
  }

  async function saveDutySummary() {
    if (
      !selectedDuty ||
      savingDuty
    ) {
      return
    }

    setSavingDuty(true)
    setEditorError('')

    try {
      const current =
        await calendarRepository.getEvent(
          selectedDuty.event.id
        )

      if (!current) {
        throw new Error(
          'Este Cargo já não existe.'
        )
      }

      if (
        current.updatedAt !==
          selectedDuty.event.updatedAt &&
        current.description !==
          selectedDuty.event.description
      ) {
        throw new Error(
          'Este sumário foi alterado noutra aba ou janela. Feche e volte a abrir o Cargo antes de guardar.'
        )
      }

      const updated =
        await calendarRepository.updateEvent(
          selectedDuty.event.id,
          {
            description:
              summary
          }
        )

      setDuties(
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

      setSelectedDuty(null)
      setSummary('')

      try {
        await onSaved?.()
      } catch {
        // O sumário já foi persistido localmente.
      }
    } catch (error) {
      setEditorError(
        getErrorMessage(error)
      )
    } finally {
      setSavingDuty(false)
    }
  }

  function moveToDate(
    nextDate: ISODate | null
  ) {
    if (!nextDate) {
      return
    }

    setSelectedDuty(null)
    setSummary('')
    setEditorError('')
    onSelectDate(nextDate)
  }

  return (
    <section className="bg-slate-950 px-3 pb-1 pt-3 text-white sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px] overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-white/10 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.12em] text-cyan-100">
                Componente letiva
              </span>
              <span className="rounded-lg border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-[0.6rem] font-black uppercase tracking-[0.12em] text-violet-100">
                Cargo
              </span>
            </div>

            <p className="mt-2 truncate text-xs font-bold text-slate-300">
              {snapshot
                ? formatWeekRange(
                    snapshot.primaryStartDate,
                    snapshot.primaryEndDate
                  )
                : 'Semana'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                moveToDate(
                  snapshot?.previousAnchorDate ??
                    null
                )
              }
              disabled={
                loading ||
                !snapshot?.previousAnchorDate
              }
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 disabled:opacity-35"
              aria-label="Semana anterior"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() =>
                moveToDate(
                  todayISO()
                )
              }
              disabled={loading}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.66rem] font-black text-slate-300 disabled:opacity-40"
            >
              Hoje
            </button>

            <button
              type="button"
              onClick={() =>
                moveToDate(
                  snapshot?.nextAnchorDate ??
                    null
                )
              }
              disabled={
                loading ||
                !snapshot?.nextAnchorDate
              }
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-sm font-black text-slate-300 disabled:opacity-35"
              aria-label="Semana seguinte"
            >
              ›
            </button>

            <input
              type="date"
              value={date}
              onChange={event =>
                moveToDate(
                  event.target.value
                )
              }
              disabled={loading}
              className="h-8 rounded-lg border border-white/10 bg-slate-950 px-2 text-[0.68rem] font-bold text-slate-300 outline-none focus:border-cyan-300/45 disabled:opacity-40"
              aria-label="Data da semana"
            />
          </div>
        </div>

        {loadError ? (
          <div className="m-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3">
            <p className="text-xs font-semibold text-rose-100">
              {loadError}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadWeek()
              }
              className="rounded-lg border border-rose-300/20 px-2.5 py-1 text-[0.65rem] font-black text-rose-100"
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[880px]">
              <div className="grid grid-cols-[6.5rem_repeat(5,minmax(9rem,1fr))] border-b border-white/10 bg-slate-950/55">
                <div className="border-r border-white/10 px-2 py-2 text-[0.6rem] font-black uppercase tracking-[0.12em] text-slate-600">
                  Tempos
                </div>

                {weekDays.map(
                  day => {
                    const active =
                      day.date === date

                    return (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() =>
                          moveToDate(
                            day.date
                          )
                        }
                        className={`border-r border-white/10 px-2 py-2 text-left last:border-r-0 ${
                          active
                            ? 'bg-cyan-300/[0.08]'
                            : 'hover:bg-white/[0.025]'
                        }`}
                      >
                        <span className={`block text-[0.68rem] font-black ${
                          active
                            ? 'text-cyan-100'
                            : day.isToday
                              ? 'text-emerald-200'
                              : 'text-slate-300'
                        }`}>
                          {formatShortWeekday(
                            day.date
                          )}
                        </span>
                      </button>
                    )
                  }
                )}
              </div>

              {loading && !snapshot ? (
                <div className="px-4 py-8 text-center text-xs font-semibold text-slate-500">
                  A preparar a semana…
                </div>
              ) : timeSlots.length > 0 ? (
                timeSlots.map(
                  slot => (
                    <div
                      key={slot.key}
                      className="grid grid-cols-[6.5rem_repeat(5,minmax(9rem,1fr))] border-b border-white/[0.07] last:border-b-0"
                    >
                      <div className="border-r border-white/10 bg-slate-950/35 px-2 py-2">
                        <span className="block text-[0.62rem] font-black text-slate-300">
                          {slot.startTime}
                        </span>
                        <span className="block text-[0.56rem] font-semibold text-slate-600">
                          {slot.endTime}
                        </span>
                      </div>

                      {weekDays.map(
                        day => {
                          const lessons =
                            day.lessons.filter(
                              row =>
                                row.lesson.startTime ===
                                  slot.startTime &&
                                row.lesson.endTime ===
                                  slot.endTime
                            )

                          const cellDuties =
                            duties.filter(
                              duty =>
                                duty.event.startDate ===
                                  day.date &&
                                duty.details.startTime ===
                                  slot.startTime &&
                                duty.details.endTime ===
                                  slot.endTime
                            )

                          return (
                            <div
                              key={`${day.date}-${slot.key}`}
                              className={`min-h-[4.5rem] border-r border-white/[0.07] p-1.5 last:border-r-0 ${
                                day.date === date
                                  ? 'bg-cyan-300/[0.018]'
                                  : ''
                              }`}
                            >
                              <div className="space-y-1.5">
                                {lessons.map(
                                  row => {
                                    const active =
                                      row.lesson.id ===
                                        selectedLessonId
                                    const cancelled =
                                      row.lesson.status ===
                                        'cancelled'

                                    return (
                                      <button
                                        key={row.lesson.id}
                                        type="button"
                                        onClick={() =>
                                          onSelectLesson(
                                            day.date,
                                            row.lesson.id
                                          )
                                        }
                                        title={`${row.group.name} · ${getSubjectLabel(row)}`}
                                        className={`w-full rounded-lg border px-2 py-1.5 text-left transition ${
                                          active
                                            ? 'border-cyan-300/60 bg-cyan-300/15'
                                            : cancelled
                                              ? 'border-rose-300/20 bg-rose-300/[0.06] opacity-70'
                                              : 'border-cyan-300/15 bg-cyan-300/[0.055] hover:border-cyan-300/35'
                                        }`}
                                      >
                                        <span className="block truncate text-[0.62rem] font-black text-white">
                                          {row.group.name} ·{' '}
                                          {getSubjectLabel(row)}
                                        </span>

                                        <span className="mt-0.5 block truncate text-[0.55rem] font-semibold text-slate-500">
                                          {row.module.code ||
                                            row.module.name}
                                        </span>

                                        <span className="mt-1 block text-[0.52rem] font-black uppercase tracking-[0.08em] text-cyan-200/75">
                                          Componente letiva
                                        </span>
                                      </button>
                                    )
                                  }
                                )}

                                {cellDuties.map(
                                  duty => (
                                    <button
                                      key={duty.event.id}
                                      type="button"
                                      onClick={() =>
                                        openDuty(
                                          duty
                                        )
                                      }
                                      title={duty.details.name}
                                      className="w-full rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-2 py-1.5 text-left transition hover:border-violet-300/45 hover:bg-violet-300/[0.11]"
                                    >
                                      <span className="block truncate text-[0.62rem] font-black text-white">
                                        {duty.details.name}
                                      </span>

                                      <span className={`mt-1 block text-[0.54rem] font-black ${
                                        duty.event.description.trim()
                                          ? 'text-emerald-200'
                                          : 'text-amber-200'
                                      }`}>
                                        {duty.event.description.trim()
                                          ? 'Sumário preenchido'
                                          : 'Sumário por preencher'}
                                      </span>

                                      <span className="mt-0.5 block text-[0.52rem] font-black uppercase tracking-[0.08em] text-violet-200/80">
                                        Cargo
                                      </span>
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          )
                        }
                      )}
                    </div>
                  )
                )
              ) : (
                <div className="px-4 py-7 text-center text-xs font-semibold text-slate-500">
                  Não existem componentes letivas nem Cargos nesta semana.
                </div>
              )}
            </div>
          </div>
        )}

        {untimedDuties.length > 0 ? (
          <div className="border-t border-white/10 px-3 py-2.5">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-600">
              Cargos sem hora indicada
            </p>

            <div className="mt-2 flex gap-2 overflow-x-auto">
              {untimedDuties.map(
                duty => (
                  <button
                    key={duty.event.id}
                    type="button"
                    onClick={() =>
                      openDuty(duty)
                    }
                    className="shrink-0 rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3 py-2 text-left"
                  >
                    <span className="block text-xs font-black text-white">
                      {duty.details.name}
                    </span>
                    <span className="mt-0.5 block text-[0.58rem] font-semibold text-slate-500">
                      {formatShortWeekday(
                        duty.event.startDate
                      )}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedDuty ? (
        <div
          ref={editorRef}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ma-professor-unified-duty-title"
        >
          <section className="w-full max-w-2xl rounded-[2rem] border border-violet-300/20 bg-slate-950 p-5 shadow-2xl shadow-black/50 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
                  Cargo
                </p>

                <h2
                  id="ma-professor-unified-duty-title"
                  className="mt-2 truncate text-2xl font-black text-white"
                >
                  {selectedDuty.details.name}
                </h2>

                <p className="mt-2 text-sm font-semibold text-slate-400">
                  {formatOccurrenceDate(
                    selectedDuty.event.startDate
                  )}
                  {selectedDuty.details.timeLabel
                    ? ` · ${selectedDuty.details.timeLabel}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                onClick={closeDuty}
                disabled={savingDuty}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-slate-300 disabled:opacity-40"
                aria-label="Fechar sumário do Cargo"
              >
                ×
              </button>
            </div>

            <label className="mt-6 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Sumário

              <textarea
                value={summary}
                onChange={event =>
                  setSummary(
                    event.target.value
                  )
                }
                disabled={savingDuty}
                rows={7}
                autoFocus
                className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-violet-300/55 focus:ring-2 focus:ring-violet-300/10 disabled:opacity-50"
                placeholder="Escreva o sumário desta ocorrência…"
              />
            </label>

            {editorError ? (
              <div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-3 text-sm leading-6 text-rose-100">
                {editorError}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeDuty}
                disabled={savingDuty}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-slate-300 disabled:opacity-40"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveDutySummary()
                }
                disabled={
                  savingDuty ||
                  !hasUnsavedSummary
                }
                className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingDuty
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
