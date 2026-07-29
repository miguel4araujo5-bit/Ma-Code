import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId,
  ISODate,
  LessonStatus
} from '../types'

import {
  getCalendarLessonStatusLabel,
  getCalendarViewModeLabel,
  type CalendarAssignmentOption,
  type CalendarDayRow,
  type CalendarEventRow,
  type CalendarLessonRow,
  type CalendarViewMode,
  type CalendarWorkspaceFilters,
  type CalendarWorkspaceSnapshot
} from './calendarWorkspaceRepository'

interface CalendarWorkspaceViewProps {
  snapshot: CalendarWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onModeChange: (
    mode: CalendarViewMode
  ) => void
  onNavigate: (
    anchorDate: ISODate
  ) => void
  onGoToday?: () => void
  onFiltersChange: (
    filters: CalendarWorkspaceFilters
  ) => void
  onLessonSelect?: (
    lessonId: EntityId
  ) => void
  onCreateLesson?: (
    date?: ISODate
  ) => void
  onEventSelect?: (
    eventId: EntityId
  ) => void
}

const weekDayLabels = [
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
  'Dom'
]

const lessonStatusClasses = {
  planned:
    'border-cyan-300/25 bg-cyan-300/10 text-cyan-50',
  taught:
    'border-emerald-300/25 bg-emerald-300/10 text-emerald-50',
  cancelled:
    'border-rose-300/25 bg-rose-300/10 text-rose-50'
} as const

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
    year,
    month - 1,
    day
  )
}

function getTodayISODate():
  ISODate {
  const today =
    new Date()

  return [
    String(
      today.getFullYear()
    ).padStart(
      4,
      '0'
    ),
    String(
      today.getMonth() +
        1
    ).padStart(
      2,
      '0'
    ),
    String(
      today.getDate()
    ).padStart(
      2,
      '0'
    )
  ].join('-')
}

function formatDate(
  value: ISODate,
  options:
    Intl.DateTimeFormatOptions
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    options
  ).format(
    parseISODate(
      value
    )
  )
}

function formatDayNumber(
  value: ISODate
) {
  return formatDate(
    value,
    {
      day: '2-digit'
    }
  )
}

function formatShortWeekday(
  value: ISODate
) {
  return formatDate(
    value,
    {
      weekday: 'short'
    }
  )
    .replace(
      '.',
      ''
    )
}

function formatFullDate(
  value: ISODate
) {
  return formatDate(
    value,
    {
      weekday:
        'long',
      day:
        '2-digit',
      month:
        'long',
      year:
        'numeric'
    }
  )
}

function formatMonthTitle(
  value: ISODate
) {
  return formatDate(
    value,
    {
      month:
        'long',
      year:
        'numeric'
    }
  )
}

function formatWeekTitle(
  snapshot:
    CalendarWorkspaceSnapshot
) {
  const startDate =
    parseISODate(
      snapshot.primaryStartDate
    )

  const endDate =
    parseISODate(
      snapshot.primaryEndDate
    )

  const sameMonth =
    startDate.getFullYear() ===
      endDate.getFullYear() &&
    startDate.getMonth() ===
      endDate.getMonth()

  if (
    sameMonth
  ) {
    return `${formatDate(
      snapshot.primaryStartDate,
      {
        day:
          '2-digit'
      }
    )}–${formatDate(
      snapshot.primaryEndDate,
      {
        day:
          '2-digit',
        month:
          'long',
        year:
          'numeric'
      }
    )}`
  }

  return `${formatDate(
    snapshot.primaryStartDate,
    {
      day:
        '2-digit',
      month:
        'short'
    }
  )} – ${formatDate(
    snapshot.primaryEndDate,
    {
      day:
        '2-digit',
      month:
        'short',
      year:
        'numeric'
    }
  )}`
}

function formatTimeRange(
  startTime: string,
  endTime: string
) {
  return `${startTime}–${endTime}`
}

function getSubjectLabel(
  option:
    CalendarAssignmentOption
) {
  return (
    option.subject
      .shortName
      .trim() ||
    option.subject.name
  )
}

function getLessonSubjectLabel(
  row: CalendarLessonRow
) {
  return (
    row.subject
      .shortName
      .trim() ||
    row.subject.name
  )
}

function getModuleLabel(
  row: CalendarLessonRow
) {
  const code =
    row.module.code.trim()

  return code
    ? `${code} · ${row.module.name}`
    : row.module.name
}

function getUniqueGroupOptions(
  options:
    CalendarAssignmentOption[]
) {
  const groupsById =
    new Map<
      EntityId,
      CalendarAssignmentOption['group']
    >()

  options.forEach(
    (
      option
    ) => {
      groupsById.set(
        option.group.id,
        option.group
      )
    }
  )

  return Array.from(
    groupsById.values()
  ).sort(
    (
      left,
      right
    ) =>
      left.name.localeCompare(
        right.name,
        'pt-PT',
        {
          numeric: true,
          sensitivity:
            'base'
        }
      )
  )
}

function getVisibleAssignmentOptions(
  snapshot:
    CalendarWorkspaceSnapshot
) {
  const selectedGroupId =
    snapshot.filters.groupId ??
    null

  return selectedGroupId
    ? snapshot
        .assignmentOptions
        .filter(
          (
            option
          ) =>
            option.group.id ===
            selectedGroupId
        )
    : snapshot.assignmentOptions
}

function isValidLessonStatus(
  value: string
): value is LessonStatus {
  return (
    value ===
      'planned' ||
    value ===
      'taught' ||
    value ===
      'cancelled'
  )
}

function getInitialSelectedDate(
  snapshot:
    CalendarWorkspaceSnapshot
): ISODate {
  const today =
    getTodayISODate()

  const todayRow =
    snapshot.days.find(
      (
        day
      ) =>
        day.date ===
        today
    )

  if (
    todayRow
  ) {
    return todayRow.date
  }

  const anchorRow =
    snapshot.days.find(
      (
        day
      ) =>
        day.date ===
        snapshot.anchorDate
    )

  if (
    anchorRow
  ) {
    return anchorRow.date
  }

  const firstDayWithWork =
    snapshot.days.find(
      (
        day
      ) =>
        day.lessons.length >
          0 ||
        day.events.length >
          0
    )

  return (
    firstDayWithWork
      ?.date ??
    snapshot.days[0]
      ?.date ??
    snapshot.anchorDate
  )
}

function LessonStatusBadge({
  status
}: {
  status:
    LessonStatus
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.1em] ${lessonStatusClasses[status]}`}
    >
      {getCalendarLessonStatusLabel(
        status
      )}
    </span>
  )
}

function WorkspaceToolbar({
  snapshot,
  loading = false,
  onRefresh,
  onModeChange,
  onNavigate,
  onGoToday,
  onCreateLesson
}: Pick<
  CalendarWorkspaceViewProps,
  | 'snapshot'
  | 'loading'
  | 'onRefresh'
  | 'onModeChange'
  | 'onNavigate'
  | 'onGoToday'
  | 'onCreateLesson'
>) {
  const title =
    snapshot.mode ===
    'week'
      ? 'As suas aulas'
      : formatMonthTitle(
          snapshot.anchorDate
        )

  const description =
    snapshot.mode ===
    'week'
      ? `${formatWeekTitle(
          snapshot
        )} · ${snapshot.academicYear.name}`
      : `${getCalendarViewModeLabel(
          snapshot.mode
        )} · ano letivo ${snapshot.academicYear.name}`

  return (
    <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Área de trabalho
          </p>

          <h1 className="mt-3 text-3xl font-black capitalize tracking-tight text-white sm:text-4xl">
            {title}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCreateLesson ? (
            <button
              type="button"
              onClick={() =>
                onCreateLesson(
                  snapshot.anchorDate
                )
              }
              className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110"
            >
              + Aula extra
            </button>
          ) : null}

          {onRefresh ? (
            <button
              type="button"
              onClick={
                onRefresh
              }
              disabled={
                loading
              }
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              {loading
                ? 'A atualizar...'
                : 'Atualizar'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (
                snapshot.previousAnchorDate
              ) {
                onNavigate(
                  snapshot.previousAnchorDate
                )
              }
            }}
            disabled={
              !snapshot.previousAnchorDate ||
              loading
            }
            aria-label="Período anterior"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={
              onGoToday
            }
            disabled={
              !onGoToday ||
              loading
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                snapshot.nextAnchorDate
              ) {
                onNavigate(
                  snapshot.nextAnchorDate
                )
              }
            }}
            disabled={
              !snapshot.nextAnchorDate ||
              loading
            }
            aria-label="Período seguinte"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ›
          </button>
        </div>

        <div className="inline-flex w-full rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
          {(
            [
              'week',
              'month'
            ] as CalendarViewMode[]
          ).map(
            (
              mode
            ) => (
              <button
                key={
                  mode
                }
                type="button"
                onClick={() =>
                  onModeChange(
                    mode
                  )
                }
                disabled={
                  loading
                }
                className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-black transition sm:flex-none ${
                  snapshot.mode ===
                  mode
                    ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/25'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
                } disabled:cursor-wait disabled:opacity-60`}
              >
                {mode ===
                'week'
                  ? 'Dia / Semana'
                  : 'Mês'}
              </button>
            )
          )}
        </div>
      </div>
    </section>
  )
}

function CompactFilters({
  snapshot,
  loading = false,
  onFiltersChange
}: Pick<
  CalendarWorkspaceViewProps,
  | 'snapshot'
  | 'loading'
  | 'onFiltersChange'
>) {
  const [
    expanded,
    setExpanded
  ] =
    useState(false)

  const groupOptions =
    getUniqueGroupOptions(
      snapshot.assignmentOptions
    )

  const assignmentOptions =
    getVisibleAssignmentOptions(
      snapshot
    )

  const hasFilters =
    Boolean(
      snapshot.filters
        .groupId ||
        snapshot.filters
          .teachingAssignmentId ||
        snapshot.filters
          .lessonStatus
    )

  function handleGroupChange(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    const groupId =
      event.target.value ||
      null

    const selectedAssignment =
      snapshot
        .assignmentOptions
        .find(
          (
            option
          ) =>
            option.assignment.id ===
            snapshot.filters
              .teachingAssignmentId
        )

    onFiltersChange({
      ...snapshot.filters,
      groupId,
      teachingAssignmentId:
        groupId &&
        selectedAssignment
          ?.group.id !==
          groupId
          ? null
          : snapshot.filters
              .teachingAssignmentId ??
            null
    })
  }

  function handleAssignmentChange(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    onFiltersChange({
      ...snapshot.filters,
      teachingAssignmentId:
        event.target.value ||
        null
    })
  }

  function handleStatusChange(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    const value =
      event.target.value

    onFiltersChange({
      ...snapshot.filters,
      lessonStatus:
        isValidLessonStatus(
          value
        )
          ? value
          : null
    })
  }

  return (
    <section className="mt-5 rounded-[1.5rem] border border-white/10 bg-slate-950/60">
      <button
        type="button"
        onClick={() =>
          setExpanded(
            (
              current
            ) =>
              !current
          )
        }
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="text-sm font-black text-white">
            Filtrar aulas
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {hasFilters
              ? 'Existem filtros ativos.'
              : 'Todas as turmas e disciplinas.'}
          </p>
        </div>

        <span className="text-lg font-black text-slate-400">
          {expanded
            ? '−'
            : '+'}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-white/10 px-5 pb-5 pt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Turma
              </span>

              <select
                value={
                  snapshot.filters
                    .groupId ??
                  ''
                }
                onChange={
                  handleGroupChange
                }
                disabled={
                  loading
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">
                  Todas as turmas
                </option>

                {groupOptions.map(
                  (
                    group
                  ) => (
                    <option
                      key={
                        group.id
                      }
                      value={
                        group.id
                      }
                    >
                      {group.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Disciplina
              </span>

              <select
                value={
                  snapshot.filters
                    .teachingAssignmentId ??
                  ''
                }
                onChange={
                  handleAssignmentChange
                }
                disabled={
                  loading
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">
                  Todas as disciplinas
                </option>

                {assignmentOptions.map(
                  (
                    option
                  ) => (
                    <option
                      key={
                        option
                          .assignment
                          .id
                      }
                      value={
                        option
                          .assignment
                          .id
                      }
                    >
                      {option.group.name} ·{' '}
                      {getSubjectLabel(
                        option
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                Estado
              </span>

              <select
                value={
                  snapshot.filters
                    .lessonStatus ??
                  ''
                }
                onChange={
                  handleStatusChange
                }
                disabled={
                  loading
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
              >
                <option value="">
                  Todos os estados
                </option>

                <option value="planned">
                  Planeadas
                </option>

                <option value="taught">
                  Dadas
                </option>

                <option value="cancelled">
                  Canceladas
                </option>
              </select>
            </label>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={() =>
                onFiltersChange({
                  groupId:
                    null,
                  teachingAssignmentId:
                    null,
                  lessonStatus:
                    null
                })
              }
              disabled={
                loading
              }
              className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function DaySelector({
  days,
  selectedDate,
  onSelect
}: {
  days:
    CalendarDayRow[]
  selectedDate:
    ISODate
  onSelect: (
    date: ISODate
  ) => void
}) {
  return (
    <section className="mt-5 overflow-x-auto pb-1">
      <div className="grid min-w-[44rem] grid-cols-7 gap-2">
        {days.map(
          (
            day
          ) => {
            const selected =
              day.date ===
              selectedDate

            const itemCount =
              day.lessons.length +
              day.events.length

            return (
              <button
                key={
                  day.date
                }
                type="button"
                onClick={() =>
                  onSelect(
                    day.date
                  )
                }
                disabled={
                  !day.isWithinAcademicYear
                }
                className={`rounded-2xl border px-3 py-4 text-center transition ${
                  selected
                    ? 'border-cyan-200/40 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/25'
                    : day.isToday
                      ? 'border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-50 hover:bg-cyan-300/[0.13]'
                      : 'border-white/10 bg-slate-950/60 text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'
                } disabled:cursor-not-allowed disabled:opacity-35`}
              >
                <p
                  className={`text-[0.65rem] font-black uppercase tracking-[0.12em] ${
                    selected
                      ? 'text-slate-700'
                      : 'text-slate-500'
                  }`}
                >
                  {formatShortWeekday(
                    day.date
                  )}
                </p>

                <p className="mt-2 text-2xl font-black">
                  {formatDayNumber(
                    day.date
                  )}
                </p>

                <p
                  className={`mt-2 text-[0.62rem] font-bold ${
                    selected
                      ? 'text-slate-700'
                      : itemCount >
                          0
                        ? 'text-slate-400'
                        : 'text-slate-600'
                  }`}
                >
                  {day.lessons.length >
                  0
                    ? `${day.lessons.length} ${
                        day.lessons.length ===
                        1
                          ? 'aula'
                          : 'aulas'
                      }`
                    : day.events.length >
                        0
                      ? `${day.events.length} ${
                          day.events.length ===
                          1
                            ? 'evento'
                            : 'eventos'
                        }`
                      : 'Livre'}
                </p>
              </button>
            )
          }
        )}
      </div>
    </section>
  )
}

function DaySummary({
  day
}: {
  day:
    CalendarDayRow
}) {
  const periodCount =
    day.lessons.reduce(
      (
        total,
        row
      ) =>
        total +
        row.lesson
          .periodCount,
      0
    )

  const pendingCount =
    day.lessons.filter(
      (
        row
      ) =>
        row.lesson
          .status ===
          'taught' &&
        (
          !row.lesson
            .summary
            .trim() ||
          row.lesson
            .giaeStatus ===
            'pending'
        )
    ).length

  return (
    <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {day.isToday ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.12em] text-cyan-100">
                Hoje
              </span>
            ) : null}

            {day.blockingEventCount >
            0 ? (
              <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-[0.62rem] font-black text-rose-100">
                {day.blockingEventCount}{' '}
                {day.blockingEventCount ===
                1
                  ? 'bloqueio'
                  : 'bloqueios'}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-2xl font-black capitalize text-white sm:text-3xl">
            {formatFullDate(
              day.date
            )}
          </h2>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <p className="text-xl font-black text-white">
              {day.lessons.length}
            </p>

            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
              Aulas
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <p className="text-xl font-black text-white">
              {periodCount}
            </p>

            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
              Tempos
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
            <p
              className={`text-xl font-black ${
                pendingCount >
                0
                  ? 'text-amber-200'
                  : 'text-emerald-200'
              }`}
            >
              {pendingCount}
            </p>

            <p className="mt-1 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
              Pendentes
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function DayEventCard({
  row,
  onSelect
}: {
  row:
    CalendarEventRow
  onSelect?: (
    eventId:
      EntityId
  ) => void
}) {
  const content = (
    <div className="flex items-start gap-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-lg ${
          row.event
            .blocksLessons
            ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
            : 'border-violet-300/20 bg-violet-300/10 text-violet-100'
        }`}
      >
        {row.event
          .blocksLessons
          ? '!'
          : '•'}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-black text-white">
            {row.event.title}
          </p>

          {row.event
            .blocksLessons ? (
            <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.08em] text-rose-100">
              Bloqueia aulas
            </span>
          ) : null}
        </div>

        <p className="mt-2 text-xs leading-5 text-slate-400">
          {row.typeLabel} ·{' '}
          {row.targetLabel}
        </p>
      </div>
    </div>
  )

  const className =
    'w-full rounded-2xl border border-violet-300/15 bg-violet-300/[0.045] p-4 text-left transition'

  return onSelect ? (
    <button
      type="button"
      onClick={() =>
        onSelect(
          row.event.id
        )
      }
      className={`${className} hover:border-violet-300/30 hover:bg-violet-300/[0.08]`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>
      {content}
    </div>
  )
}

function LessonWorkCard({
  row,
  position,
  onSelect
}: {
  row:
    CalendarLessonRow
  position:
    number
  onSelect?: (
    lessonId:
      EntityId
  ) => void
}) {
  const missingSummary =
    row.lesson.status ===
      'taught' &&
    !row.lesson.summary.trim()

  const pendingGIAE =
    row.lesson.status ===
      'taught' &&
    Boolean(
      row.lesson.summary.trim()
    ) &&
    row.lesson.giaeStatus ===
      'pending'

  const summary =
    row.lesson.summary.trim()

  const plannedActivity =
    row.lesson
      .plannedActivity
      .trim()

  return (
    <article
      className={`overflow-hidden rounded-[1.75rem] border ${
        row.lesson.status ===
        'planned'
          ? 'border-cyan-300/20 bg-slate-950/80'
          : row.lesson.status ===
              'taught'
            ? 'border-emerald-300/20 bg-slate-950/80'
            : 'border-rose-300/20 bg-slate-950/70'
      } shadow-xl shadow-black/15`}
    >
      <div className="grid md:grid-cols-[8.5rem_1fr]">
        <div className="border-b border-white/10 bg-white/[0.025] p-5 md:border-b-0 md:border-r">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500">
            Aula {position}
          </p>

          <p className="mt-3 text-2xl font-black text-white">
            {row.lesson.startTime}
          </p>

          <p className="mt-1 text-xs font-semibold text-slate-500">
            até{' '}
            {row.lesson.endTime}
          </p>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            {row.lesson.periodCount}{' '}
            {row.lesson.periodCount ===
            1
              ? 'tempo'
              : 'tempos'}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                {getLessonSubjectLabel(
                  row
                )}
              </p>

              <h3 className="mt-2 text-2xl font-black text-white">
                {row.group.name}
              </h3>

              <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
                {getModuleLabel(
                  row
                )}
              </p>
            </div>

            <LessonStatusBadge
              status={
                row.lesson.status
              }
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-200">
                Planificação
              </p>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {plannedActivity ||
                  'Ainda não existe uma atividade planificada para esta aula.'}
              </p>
            </section>

            <section
              className={`rounded-2xl border p-4 ${
                missingSummary
                  ? 'border-amber-300/20 bg-amber-300/[0.05]'
                  : 'border-white/10 bg-white/[0.025]'
              }`}
            >
              <p
                className={`text-[0.65rem] font-black uppercase tracking-[0.14em] ${
                  missingSummary
                    ? 'text-amber-200'
                    : 'text-slate-500'
                }`}
              >
                Sumário
              </p>

              <p className="mt-3 text-sm leading-7 text-slate-300">
                {summary ||
                  (
                    row.lesson.status ===
                    'planned'
                      ? 'O sumário será registado quando a aula for dada.'
                      : 'O sumário desta aula ainda está por preencher.'
                  )}
              </p>
            </section>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {row.lesson
              .origin ===
            'extra' ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[0.62rem] font-bold text-violet-100">
                Aula extra
              </span>
            ) : null}

            {!row.lesson
              .countTowardProgress ? (
              <span className="rounded-full border border-slate-300/15 bg-slate-300/[0.06] px-3 py-1.5 text-[0.62rem] font-bold text-slate-300">
                Não contabiliza
              </span>
            ) : null}

            {missingSummary ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.62rem] font-bold text-amber-100">
                Sumário pendente
              </span>
            ) : null}

            {pendingGIAE ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-[0.62rem] font-bold text-violet-100">
                Envio ao GIAE pendente
              </span>
            ) : null}
          </div>

          {onSelect ? (
            <button
              type="button"
              onClick={() =>
                onSelect(
                  row.lesson.id
                )
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-4 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110 sm:w-auto"
            >
              {row.lesson.status ===
              'planned'
                ? 'Abrir aula'
                : 'Ver ou editar aula'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

function EmptySelectedDay({
  day,
  onCreateLesson
}: {
  day:
    CalendarDayRow
  onCreateLesson?: (
    date?: ISODate
  ) => void
}) {
  return (
    <section className="mt-5 rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/55 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl text-cyan-100">
        ✓
      </div>

      <h2 className="mt-5 text-xl font-black text-white">
        Não existem aulas neste dia.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
        Pode escolher outro dia da semana ou adicionar uma aula extra.
      </p>

      {onCreateLesson &&
      day.isWithinAcademicYear ? (
        <button
          type="button"
          onClick={() =>
            onCreateLesson(
              day.date
            )
          }
          className="mt-6 rounded-2xl border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110"
        >
          + Adicionar aula extra
        </button>
      ) : null}
    </section>
  )
}

function DailyWorkspace({
  snapshot,
  selectedDate,
  onSelectedDateChange,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: {
  snapshot:
    CalendarWorkspaceSnapshot
  selectedDate:
    ISODate
  onSelectedDateChange: (
    date: ISODate
  ) => void
  onLessonSelect?:
    CalendarWorkspaceViewProps['onLessonSelect']
  onCreateLesson?:
    CalendarWorkspaceViewProps['onCreateLesson']
  onEventSelect?:
    CalendarWorkspaceViewProps['onEventSelect']
}) {
  const selectedDay =
    snapshot.days.find(
      (
        day
      ) =>
        day.date ===
        selectedDate
    ) ??
    snapshot.days[0]

  if (
    !selectedDay
  ) {
    return null
  }

  return (
    <>
      <DaySelector
        days={
          snapshot.days
        }
        selectedDate={
          selectedDay.date
        }
        onSelect={
          onSelectedDateChange
        }
      />

      <DaySummary
        day={
          selectedDay
        }
      />

      {selectedDay.events.length >
      0 ? (
        <section className="mt-5 space-y-3">
          {selectedDay.events.map(
            (
              row
            ) => (
              <DayEventCard
                key={
                  row.event.id
                }
                row={
                  row
                }
                onSelect={
                  onEventSelect
                }
              />
            )
          )}
        </section>
      ) : null}

      {selectedDay.lessons.length >
      0 ? (
        <section className="mt-5 space-y-4">
          {selectedDay.lessons.map(
            (
              row,
              index
            ) => (
              <LessonWorkCard
                key={
                  row.lesson.id
                }
                row={
                  row
                }
                position={
                  index +
                  1
                }
                onSelect={
                  onLessonSelect
                }
              />
            )
          )}

          {onCreateLesson &&
          selectedDay.isWithinAcademicYear ? (
            <button
              type="button"
              onClick={() =>
                onCreateLesson(
                  selectedDay.date
                )
              }
              className="w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-5 py-4 text-sm font-bold text-slate-500 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] hover:text-cyan-100"
            >
              + Adicionar aula extra neste dia
            </button>
          ) : null}
        </section>
      ) : (
        <EmptySelectedDay
          day={
            selectedDay
          }
          onCreateLesson={
            onCreateLesson
          }
        />
      )}
    </>
  )
}

function MonthEventChip({
  row,
  onSelect
}: {
  row:
    CalendarEventRow
  onSelect?: (
    eventId:
      EntityId
  ) => void
}) {
  const className = `w-full rounded-lg border px-2 py-1.5 text-left text-[0.62rem] font-bold leading-4 transition ${
    row.event
      .blocksLessons
      ? 'border-rose-300/15 bg-rose-300/[0.06] text-rose-100'
      : 'border-violet-300/15 bg-violet-300/[0.06] text-violet-100'
  }`

  return onSelect ? (
    <button
      type="button"
      onClick={() =>
        onSelect(
          row.event.id
        )
      }
      className={`${className} hover:brightness-110`}
    >
      {row.event.title}
    </button>
  ) : (
    <div className={className}>
      {row.event.title}
    </div>
  )
}

function MonthLessonChip({
  row,
  onSelect
}: {
  row:
    CalendarLessonRow
  onSelect?: (
    lessonId:
      EntityId
  ) => void
}) {
  const className = `w-full rounded-lg border px-2 py-2 text-left transition ${
    lessonStatusClasses[
      row.lesson.status
    ]
  }`

  const content = (
    <>
      <p className="truncate text-[0.65rem] font-black">
        {row.lesson.startTime} ·{' '}
        {row.group.name}
      </p>

      <p className="mt-1 truncate text-[0.58rem] opacity-70">
        {getLessonSubjectLabel(
          row
        )}
      </p>
    </>
  )

  return onSelect ? (
    <button
      type="button"
      onClick={() =>
        onSelect(
          row.lesson.id
        )
      }
      className={`${className} hover:brightness-110`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>
      {content}
    </div>
  )
}

function MonthDayCell({
  day,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: {
  day:
    CalendarDayRow
  onLessonSelect?:
    CalendarWorkspaceViewProps['onLessonSelect']
  onCreateLesson?:
    CalendarWorkspaceViewProps['onCreateLesson']
  onEventSelect?:
    CalendarWorkspaceViewProps['onEventSelect']
}) {
  const visibleEvents =
    day.events.slice(
      0,
      2
    )

  const visibleLessons =
    day.lessons.slice(
      0,
      3
    )

  const hiddenItemCount =
    day.events.length -
    visibleEvents.length +
    day.lessons.length -
    visibleLessons.length

  return (
    <article
      className={`min-h-[14rem] border-b border-r border-white/[0.08] p-3 ${
        day.isToday
          ? 'bg-cyan-300/[0.06]'
          : day.isInPrimaryPeriod
            ? 'bg-slate-950/55'
            : 'bg-slate-950/25'
      } ${
        day.isWithinAcademicYear
          ? ''
          : 'opacity-45'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
            day.isToday
              ? 'bg-cyan-300 text-slate-950'
              : day.isInPrimaryPeriod
                ? 'text-white'
                : 'text-slate-600'
          }`}
        >
          {formatDayNumber(
            day.date
          )}
        </p>

        {day.blockingEventCount >
        0 ? (
          <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[0.55rem] font-black text-rose-100">
            Bloqueio
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {visibleEvents.map(
          (
            row
          ) => (
            <MonthEventChip
              key={
                row.event.id
              }
              row={
                row
              }
              onSelect={
                onEventSelect
              }
            />
          )
        )}

        {visibleLessons.map(
          (
            row
          ) => (
            <MonthLessonChip
              key={
                row.lesson.id
              }
              row={
                row
              }
              onSelect={
                onLessonSelect
              }
            />
          )
        )}
      </div>

      {hiddenItemCount >
      0 ? (
        <p className="mt-3 text-center text-[0.65rem] font-bold text-slate-500">
          +{hiddenItemCount}{' '}
          {hiddenItemCount ===
          1
            ? 'item'
            : 'itens'}
        </p>
      ) : null}

      {onCreateLesson &&
      day.isWithinAcademicYear ? (
        <button
          type="button"
          onClick={() =>
            onCreateLesson(
              day.date
            )
          }
          aria-label={`Adicionar aula extra em ${formatFullDate(
            day.date
          )}`}
          className="mt-3 w-full rounded-lg border border-dashed border-white/[0.08] py-2 text-[0.65rem] font-bold text-slate-600 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] hover:text-cyan-100"
        >
          + Aula
        </button>
      ) : null}
    </article>
  )
}

function MonthView({
  snapshot,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: Pick<
  CalendarWorkspaceViewProps,
  | 'snapshot'
  | 'onLessonSelect'
  | 'onCreateLesson'
  | 'onEventSelect'
>) {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/65">
      <div className="overflow-x-auto">
        <div className="min-w-[70rem]">
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.025]">
            {weekDayLabels.map(
              (
                label
              ) => (
                <div
                  key={
                    label
                  }
                  className="border-r border-white/[0.08] px-3 py-3 text-center text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500 last:border-r-0"
                >
                  {label}
                </div>
              )
            )}
          </div>

          <div className="grid grid-cols-7">
            {snapshot.days.map(
              (
                day
              ) => (
                <MonthDayCell
                  key={
                    day.date
                  }
                  day={
                    day
                  }
                  onLessonSelect={
                    onLessonSelect
                  }
                  onCreateLesson={
                    onCreateLesson
                  }
                  onEventSelect={
                    onEventSelect
                  }
                />
              )
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkspaceEmptyState({
  snapshot,
  onCreateLesson
}: {
  snapshot:
    CalendarWorkspaceSnapshot
  onCreateLesson?:
    CalendarWorkspaceViewProps['onCreateLesson']
}) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/55 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl text-cyan-100">
        +
      </div>

      <h2 className="mt-5 text-xl font-black text-white">
        Não existem aulas neste período.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
        Não foram encontradas aulas ou eventos com os filtros selecionados.
      </p>

      {onCreateLesson ? (
        <button
          type="button"
          onClick={() =>
            onCreateLesson(
              snapshot.anchorDate
            )
          }
          className="mt-6 rounded-2xl border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:brightness-110"
        >
          Adicionar aula extra
        </button>
      ) : null}
    </section>
  )
}

export default function CalendarWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onModeChange,
  onNavigate,
  onGoToday,
  onFiltersChange,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: CalendarWorkspaceViewProps) {
  const [
    selectedDate,
    setSelectedDate
  ] =
    useState<ISODate>(
      () =>
        getInitialSelectedDate(
          snapshot
        )
    )

  const availableDates =
    useMemo(
      () =>
        new Set(
          snapshot.days.map(
            (
              day
            ) =>
              day.date
          )
        ),
      [
        snapshot.days
      ]
    )

  useEffect(() => {
    if (
      !availableDates.has(
        selectedDate
      )
    ) {
      setSelectedDate(
        getInitialSelectedDate(
          snapshot
        )
      )
    }
  }, [
    availableDates,
    selectedDate,
    snapshot
  ])

  const hasVisibleContent =
    snapshot.totals
      .lessonCount >
      0 ||
    snapshot.totals
      .eventCount >
      0

  return (
    <div className="mx-auto max-w-[100rem]">
      <WorkspaceToolbar
        snapshot={
          snapshot
        }
        loading={
          loading
        }
        onRefresh={
          onRefresh
        }
        onModeChange={
          onModeChange
        }
        onNavigate={
          onNavigate
        }
        onGoToday={
          onGoToday
        }
        onCreateLesson={
          onCreateLesson
        }
      />

      {error ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-50"
        >
          <p className="leading-6">
            Não foi possível atualizar as aulas: {error}
          </p>

          {onRefresh ? (
            <button
              type="button"
              onClick={
                onRefresh
              }
              disabled={
                loading
              }
              className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-50 transition hover:bg-amber-200/15 disabled:cursor-wait disabled:opacity-60"
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      <CompactFilters
        snapshot={
          snapshot
        }
        loading={
          loading
        }
        onFiltersChange={
          onFiltersChange
        }
      />

      {hasVisibleContent ? (
        snapshot.mode ===
        'week' ? (
          <DailyWorkspace
            snapshot={
              snapshot
            }
            selectedDate={
              selectedDate
            }
            onSelectedDateChange={
              setSelectedDate
            }
            onLessonSelect={
              onLessonSelect
            }
            onCreateLesson={
              onCreateLesson
            }
            onEventSelect={
              onEventSelect
            }
          />
        ) : (
          <MonthView
            snapshot={
              snapshot
            }
            onLessonSelect={
              onLessonSelect
            }
            onCreateLesson={
              onCreateLesson
            }
            onEventSelect={
              onEventSelect
            }
          />
        )
      ) : (
        <WorkspaceEmptyState
          snapshot={
            snapshot
          }
          onCreateLesson={
            onCreateLesson
          }
        />
      )}
    </div>
  )
}
