import type { ChangeEvent } from 'react'

import type { EntityId, ISODate, LessonStatus } from '../types'
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
  onModeChange: (mode: CalendarViewMode) => void
  onNavigate: (anchorDate: ISODate) => void
  onGoToday?: () => void
  onFiltersChange: (filters: CalendarWorkspaceFilters) => void
  onLessonSelect?: (lessonId: EntityId) => void
  onCreateLesson?: (date?: ISODate) => void
  onEventSelect?: (eventId: EntityId) => void
}

interface MetricCardProps {
  label: string
  value: string | number
  detail: string
  tone?: 'cyan' | 'emerald' | 'amber' | 'violet'
}

const weekDayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const metricToneClasses = {
  cyan: 'border-cyan-300/20 bg-cyan-300/[0.055]',
  emerald: 'border-emerald-300/20 bg-emerald-300/[0.055]',
  amber: 'border-amber-300/20 bg-amber-300/[0.055]',
  violet: 'border-violet-300/20 bg-violet-300/[0.055]'
} as const

const lessonStatusClasses = {
  planned: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-50',
  taught: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-50',
  cancelled: 'border-rose-300/20 bg-rose-300/10 text-rose-50'
} as const

function parseISODate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(value: ISODate, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-PT', options).format(parseISODate(value))
}

function formatDayNumber(value: ISODate) {
  return formatDate(value, { day: '2-digit' })
}

function formatDayLabel(value: ISODate) {
  return formatDate(value, {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })
}

function formatFullDate(value: ISODate) {
  return formatDate(value, {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

function formatPeriodTitle(snapshot: CalendarWorkspaceSnapshot) {
  if (snapshot.mode === 'month') {
    return formatDate(snapshot.anchorDate, {
      month: 'long',
      year: 'numeric'
    })
  }

  const startDate = parseISODate(snapshot.primaryStartDate)
  const endDate = parseISODate(snapshot.primaryEndDate)
  const sameMonth =
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth()

  if (sameMonth) {
    return `${formatDate(snapshot.primaryStartDate, {
      day: '2-digit'
    })}–${formatDate(snapshot.primaryEndDate, {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    })}`
  }

  return `${formatDate(snapshot.primaryStartDate, {
    day: '2-digit',
    month: 'short'
  })} – ${formatDate(snapshot.primaryEndDate, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })}`
}

function formatTimeRange(startTime: string, endTime: string) {
  return `${startTime}–${endTime}`
}

function getModuleLabel(row: CalendarLessonRow) {
  return row.module.code.trim()
    ? `${row.module.code.trim()} · ${row.module.name}`
    : row.module.name
}

function getSubjectLabel(option: CalendarAssignmentOption) {
  return option.subject.shortName.trim() || option.subject.name
}

function getLessonSubjectLabel(row: CalendarLessonRow) {
  return row.subject.shortName.trim() || row.subject.name
}

function getUniqueGroupOptions(options: CalendarAssignmentOption[]) {
  const groupsById = new Map<EntityId, CalendarAssignmentOption['group']>()

  options.forEach((option) => {
    groupsById.set(option.group.id, option.group)
  })

  return Array.from(groupsById.values()).sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-PT', {
      numeric: true,
      sensitivity: 'base'
    })
  )
}

function getVisibleAssignmentOptions(snapshot: CalendarWorkspaceSnapshot) {
  const selectedGroupId = snapshot.filters.groupId ?? null

  return selectedGroupId
    ? snapshot.assignmentOptions.filter(
        (option) => option.group.id === selectedGroupId
      )
    : snapshot.assignmentOptions
}

function isValidLessonStatus(value: string): value is LessonStatus {
  return value === 'planned' || value === 'taught' || value === 'cancelled'
}

function MetricCard({ label, value, detail, tone = 'cyan' }: MetricCardProps) {
  return (
    <article
      className={`rounded-2xl border p-4 shadow-lg shadow-black/10 ${metricToneClasses[tone]}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-black text-white">
        {value}
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {detail}
      </p>
    </article>
  )
}

function CalendarToolbar({
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
  return (
    <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
            Calendário letivo
          </p>

          <h1 className="mt-3 text-3xl font-black capitalize tracking-tight text-white sm:text-4xl">
            {formatPeriodTitle(snapshot)}
          </h1>

          <p className="mt-3 text-sm leading-7 text-slate-400">
            {getCalendarViewModeLabel(snapshot.mode)} · ano letivo{' '}
            {snapshot.academicYear.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onCreateLesson ? (
            <button
              type="button"
              onClick={() => onCreateLesson(snapshot.anchorDate)}
              className="rounded-2xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/25 transition hover:brightness-110"
            >
              + Aula extra
            </button>
          ) : null}

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? 'A atualizar...' : 'Atualizar'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (snapshot.previousAnchorDate) {
                onNavigate(snapshot.previousAnchorDate)
              }
            }}
            disabled={!snapshot.previousAnchorDate || loading}
            aria-label="Período anterior"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={onGoToday}
            disabled={!onGoToday || loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => {
              if (snapshot.nextAnchorDate) {
                onNavigate(snapshot.nextAnchorDate)
              }
            }}
            disabled={!snapshot.nextAnchorDate || loading}
            aria-label="Período seguinte"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg font-black text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          >
            ›
          </button>
        </div>

        <div className="inline-flex w-full rounded-2xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
          {(['week', 'month'] as CalendarViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onModeChange(mode)}
              disabled={loading}
              className={`flex-1 rounded-xl px-5 py-2.5 text-sm font-black transition sm:flex-none ${
                snapshot.mode === mode
                  ? 'bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/25'
                  : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'
              } disabled:cursor-wait disabled:opacity-60`}
            >
              {getCalendarViewModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function CalendarFilters({
  snapshot,
  loading = false,
  onFiltersChange
}: Pick<
  CalendarWorkspaceViewProps,
  'snapshot' | 'loading' | 'onFiltersChange'
>) {
  const groupOptions = getUniqueGroupOptions(snapshot.assignmentOptions)
  const assignmentOptions = getVisibleAssignmentOptions(snapshot)
  const hasFilters = Boolean(
    snapshot.filters.groupId ||
      snapshot.filters.teachingAssignmentId ||
      snapshot.filters.lessonStatus
  )

  function handleGroupChange(event: ChangeEvent<HTMLSelectElement>) {
    const groupId = event.target.value || null
    const selectedAssignment = snapshot.assignmentOptions.find(
      (option) =>
        option.assignment.id === snapshot.filters.teachingAssignmentId
    )

    onFiltersChange({
      ...snapshot.filters,
      groupId,
      teachingAssignmentId:
        groupId && selectedAssignment?.group.id !== groupId
          ? null
          : snapshot.filters.teachingAssignmentId ?? null
    })
  }

  function handleAssignmentChange(event: ChangeEvent<HTMLSelectElement>) {
    onFiltersChange({
      ...snapshot.filters,
      teachingAssignmentId: event.target.value || null
    })
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value

    onFiltersChange({
      ...snapshot.filters,
      lessonStatus: isValidLessonStatus(value) ? value : null
    })
  }

  return (
    <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Filtros
          </p>

          <h2 className="mt-2 text-lg font-black text-white">
            Ajustar o calendário
          </h2>
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                groupId: null,
                teachingAssignmentId: null,
                lessonStatus: null
              })
            }
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Turma
          </span>

          <select
            value={snapshot.filters.groupId ?? ''}
            onChange={handleGroupChange}
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todas as turmas
            </option>

            {groupOptions.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Disciplina
          </span>

          <select
            value={snapshot.filters.teachingAssignmentId ?? ''}
            onChange={handleAssignmentChange}
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todas as disciplinas
            </option>

            {assignmentOptions.map((option) => (
              <option key={option.assignment.id} value={option.assignment.id}>
                {option.group.name} · {getSubjectLabel(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Estado da aula
          </span>

          <select
            value={snapshot.filters.lessonStatus ?? ''}
            onChange={handleStatusChange}
            disabled={loading}
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
    </section>
  )
}

function LessonStatusBadge({ status }: { status: LessonStatus }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] ${lessonStatusClasses[status]}`}
    >
      {getCalendarLessonStatusLabel(status)}
    </span>
  )
}

function CalendarEventChip({
  row,
  compact = false,
  onSelect
}: {
  row: CalendarEventRow
  compact?: boolean
  onSelect?: (eventId: EntityId) => void
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p
          className={`font-black leading-5 ${
            compact ? 'text-[0.7rem]' : 'text-xs'
          }`}
        >
          {row.event.title}
        </p>

        {row.event.blocksLessons ? (
          <span className="shrink-0 rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-0.5 text-[0.55rem] font-black uppercase tracking-[0.08em] text-rose-100">
            Bloqueia
          </span>
        ) : null}
      </div>

      {!compact ? (
        <p className="mt-1 text-[0.68rem] leading-5 text-slate-400">
          {row.typeLabel} · {row.targetLabel}
        </p>
      ) : null}
    </>
  )

  const className = `w-full rounded-xl border p-2.5 text-left transition ${
    row.event.blocksLessons
      ? 'border-rose-300/15 bg-rose-300/[0.055] text-rose-50'
      : 'border-violet-300/15 bg-violet-300/[0.055] text-violet-50'
  } ${onSelect ? 'hover:brightness-110' : ''}`

  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(row.event.id)}
      className={className}
    >
      {content}
    </button>
  ) : (
    <div className={className}>
      {content}
    </div>
  )
}

function CalendarLessonCard({
  row,
  compact = false,
  onSelect
}: {
  row: CalendarLessonRow
  compact?: boolean
  onSelect?: (lessonId: EntityId) => void
}) {
  const missingSummary =
    row.lesson.status === 'taught' && !row.lesson.summary.trim()

  const pendingGIAE =
    row.lesson.status === 'taught' &&
    Boolean(row.lesson.summary.trim()) &&
    row.lesson.giaeStatus === 'pending'

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`truncate font-black text-white ${
              compact ? 'text-[0.72rem]' : 'text-sm'
            }`}
          >
            {row.group.name} · {getLessonSubjectLabel(row)}
          </p>

          <p
            className={`mt-1 text-slate-400 ${
              compact ? 'text-[0.62rem]' : 'text-xs'
            }`}
          >
            {formatTimeRange(row.lesson.startTime, row.lesson.endTime)}
          </p>
        </div>

        {!compact ? (
          <LessonStatusBadge status={row.lesson.status} />
        ) : null}
      </div>

      {!compact ? (
        <>
          <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">
            {getModuleLabel(row)}
          </p>

          {row.lesson.plannedActivity ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
              {row.lesson.plannedActivity}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {row.lesson.origin === 'extra' ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[0.62rem] font-bold text-violet-100">
                Aula extra
              </span>
            ) : null}

            {!row.lesson.countTowardProgress ? (
              <span className="rounded-full border border-slate-300/15 bg-slate-300/[0.06] px-2.5 py-1 text-[0.62rem] font-bold text-slate-300">
                Não contabiliza
              </span>
            ) : null}

            {missingSummary ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-[0.62rem] font-bold text-amber-100">
                Sumário pendente
              </span>
            ) : null}

            {pendingGIAE ? (
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[0.62rem] font-bold text-violet-100">
                GIAE pendente
              </span>
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              row.lesson.status === 'planned'
                ? 'bg-cyan-300'
                : row.lesson.status === 'taught'
                  ? 'bg-emerald-300'
                  : 'bg-rose-300'
            }`}
          />

          <span className="truncate text-[0.6rem] text-slate-500">
            {getCalendarLessonStatusLabel(row.lesson.status)}
            {missingSummary
              ? ' · sem sumário'
              : pendingGIAE
                ? ' · GIAE pendente'
                : ''}
          </span>
        </div>
      )}
    </>
  )

  const className = `w-full rounded-xl border p-3 text-left transition ${
    lessonStatusClasses[row.lesson.status]
  } ${onSelect ? 'hover:-translate-y-0.5 hover:brightness-110' : ''}`

  return onSelect ? (
    <button
      type="button"
      onClick={() => onSelect(row.lesson.id)}
      className={className}
    >
      {content}
    </button>
  ) : (
    <div className={className}>
      {content}
    </div>
  )
}

function EmptyDayState({
  date,
  onCreateLesson
}: {
  date: ISODate
  onCreateLesson?: (date?: ISODate) => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
      <p className="text-xs font-semibold text-slate-500">
        Sem aulas nem eventos.
      </p>

      {onCreateLesson ? (
        <button
          type="button"
          onClick={() => onCreateLesson(date)}
          className="mt-3 text-xs font-black text-cyan-200 transition hover:text-cyan-100"
        >
          + Adicionar aula extra
        </button>
      ) : null}
    </div>
  )
}

function WeekDayCard({
  day,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: {
  day: CalendarDayRow
  onLessonSelect?: (lessonId: EntityId) => void
  onCreateLesson?: (date?: ISODate) => void
  onEventSelect?: (eventId: EntityId) => void
}) {
  return (
    <article
      className={`rounded-[1.5rem] border p-4 ${
        day.isToday
          ? 'border-cyan-300/35 bg-cyan-300/[0.055] shadow-lg shadow-cyan-950/20'
          : day.isWithinAcademicYear
            ? 'border-white/10 bg-slate-950/65'
            : 'border-white/[0.06] bg-slate-950/35 opacity-55'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {formatDayLabel(day.date)}
          </p>

          <p className="mt-1 text-2xl font-black text-white">
            {formatDayNumber(day.date)}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {day.isToday ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.1em] text-cyan-100">
              Hoje
            </span>
          ) : null}

          {day.blockingEventCount > 0 ? (
            <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-[0.6rem] font-black text-rose-100">
              {day.blockingEventCount}{' '}
              {day.blockingEventCount === 1 ? 'bloqueio' : 'bloqueios'}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {day.events.map((row) => (
          <CalendarEventChip
            key={row.event.id}
            row={row}
            onSelect={onEventSelect}
          />
        ))}

        {day.lessons.map((row) => (
          <CalendarLessonCard
            key={row.lesson.id}
            row={row}
            onSelect={onLessonSelect}
          />
        ))}

        {day.events.length === 0 && day.lessons.length === 0 ? (
          <EmptyDayState
            date={day.date}
            onCreateLesson={
              day.isWithinAcademicYear
                ? onCreateLesson
                : undefined
            }
          />
        ) : onCreateLesson && day.isWithinAcademicYear ? (
          <button
            type="button"
            onClick={() => onCreateLesson(day.date)}
            className="w-full rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs font-bold text-slate-500 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.04] hover:text-cyan-100"
          >
            + Aula extra neste dia
          </button>
        ) : null}
      </div>
    </article>
  )
}

function WeekView({
  snapshot,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: Pick<
  CalendarWorkspaceViewProps,
  'snapshot' | 'onLessonSelect' | 'onCreateLesson' | 'onEventSelect'
>) {
  return (
    <section className="mt-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
        {snapshot.days.map((day) => (
          <WeekDayCard
            key={day.date}
            day={day}
            onLessonSelect={onLessonSelect}
            onCreateLesson={onCreateLesson}
            onEventSelect={onEventSelect}
          />
        ))}
      </div>
    </section>
  )
}

function MonthDayCell({
  day,
  onLessonSelect,
  onCreateLesson,
  onEventSelect
}: {
  day: CalendarDayRow
  onLessonSelect?: (lessonId: EntityId) => void
  onCreateLesson?: (date?: ISODate) => void
  onEventSelect?: (eventId: EntityId) => void
}) {
  const visibleEvents = day.events.slice(0, 2)
  const visibleLessons = day.lessons.slice(0, 3)
  const hiddenItemCount =
    day.events.length -
    visibleEvents.length +
    day.lessons.length -
    visibleLessons.length

  return (
    <article
      className={`min-h-[15rem] border-b border-r border-white/[0.08] p-3 ${
        day.isToday
          ? 'bg-cyan-300/[0.06]'
          : day.isInPrimaryPeriod
            ? 'bg-slate-950/55'
            : 'bg-slate-950/25'
      } ${day.isWithinAcademicYear ? '' : 'opacity-45'}`}
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
          {formatDayNumber(day.date)}
        </p>

        {day.blockingEventCount > 0 ? (
          <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-[0.55rem] font-black text-rose-100">
            Bloqueio
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {visibleEvents.map((row) => (
          <CalendarEventChip
            key={row.event.id}
            row={row}
            compact
            onSelect={onEventSelect}
          />
        ))}

        {visibleLessons.map((row) => (
          <CalendarLessonCard
            key={row.lesson.id}
            row={row}
            compact
            onSelect={onLessonSelect}
          />
        ))}
      </div>

      {hiddenItemCount > 0 ? (
        <p className="mt-3 text-center text-[0.65rem] font-bold text-slate-500">
          +{hiddenItemCount} {hiddenItemCount === 1 ? 'item' : 'itens'}
        </p>
      ) : null}

      {onCreateLesson && day.isWithinAcademicYear ? (
        <button
          type="button"
          onClick={() => onCreateLesson(day.date)}
          aria-label={`Adicionar aula extra em ${formatFullDate(day.date)}`}
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
  'snapshot' | 'onLessonSelect' | 'onCreateLesson' | 'onEventSelect'
>) {
  return (
    <section className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950/65">
      <div className="overflow-x-auto">
        <div className="min-w-[70rem]">
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.025]">
            {weekDayLabels.map((label) => (
              <div
                key={label}
                className="border-r border-white/[0.08] px-3 py-3 text-center text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-500 last:border-r-0"
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {snapshot.days.map((day) => (
              <MonthDayCell
                key={day.date}
                day={day}
                onLessonSelect={onLessonSelect}
                onCreateLesson={onCreateLesson}
                onEventSelect={onEventSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CalendarLegend() {
  return (
    <section className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-xs text-slate-400">
      <span className="font-bold uppercase tracking-[0.12em] text-slate-500">
        Legenda
      </span>

      <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-cyan-100">
        Planeada
      </span>

      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-100">
        Dada
      </span>

      <span className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1.5 text-rose-100">
        Cancelada ou bloqueio
      </span>

      <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-violet-100">
        Evento escolar
      </span>
    </section>
  )
}

function CalendarEmptyState({
  onCreateLesson,
  anchorDate
}: {
  onCreateLesson?: (date?: ISODate) => void
  anchorDate: ISODate
}) {
  return (
    <section className="mt-6 rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/55 p-8 text-center sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-2xl text-cyan-100">
        +
      </div>

      <h2 className="mt-5 text-xl font-black text-white">
        Este período está vazio.
      </h2>

      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
        Não existem aulas ou eventos que correspondam aos filtros selecionados.
      </p>

      {onCreateLesson ? (
        <button
          type="button"
          onClick={() => onCreateLesson(anchorDate)}
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
  const hasVisibleContent =
    snapshot.totals.lessonCount > 0 ||
    snapshot.totals.eventCount > 0

  return (
    <div className="mx-auto max-w-[100rem]">
      <CalendarToolbar
        snapshot={snapshot}
        loading={loading}
        onRefresh={onRefresh}
        onModeChange={onModeChange}
        onNavigate={onNavigate}
        onGoToday={onGoToday}
        onCreateLesson={onCreateLesson}
      />

      {error ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm text-amber-50"
        >
          <p className="leading-6">
            Não foi possível atualizar o calendário: {error}
          </p>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-bold text-amber-50 transition hover:bg-amber-200/15 disabled:cursor-wait disabled:opacity-60"
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Aulas"
          value={snapshot.totals.lessonCount}
          detail={`${snapshot.totals.periodCount} tempos neste período`}
          tone="cyan"
        />

        <MetricCard
          label="Aulas dadas"
          value={snapshot.totals.taughtLessonCount}
          detail={`${snapshot.totals.plannedLessonCount} planeadas · ${snapshot.totals.cancelledLessonCount} canceladas`}
          tone="emerald"
        />

        <MetricCard
          label="Sumários pendentes"
          value={
            snapshot.totals.missingSummaryCount +
            snapshot.totals.pendingGIAECount
          }
          detail={`${snapshot.totals.missingSummaryCount} por preencher · ${snapshot.totals.pendingGIAECount} no GIAE`}
          tone="amber"
        />

        <MetricCard
          label="Eventos"
          value={snapshot.totals.eventCount}
          detail={`${snapshot.totals.blockingEventCount} bloqueiam aulas · ${snapshot.totals.extraLessonCount} aulas extra`}
          tone="violet"
        />
      </div>

      <CalendarFilters
        snapshot={snapshot}
        loading={loading}
        onFiltersChange={onFiltersChange}
      />

      {hasVisibleContent ? (
        snapshot.mode === 'week' ? (
          <WeekView
            snapshot={snapshot}
            onLessonSelect={onLessonSelect}
            onCreateLesson={onCreateLesson}
            onEventSelect={onEventSelect}
          />
        ) : (
          <MonthView
            snapshot={snapshot}
            onLessonSelect={onLessonSelect}
            onCreateLesson={onCreateLesson}
            onEventSelect={onEventSelect}
          />
        )
      ) : (
        <CalendarEmptyState
          anchorDate={snapshot.anchorDate}
          onCreateLesson={onCreateLesson}
        />
      )}

      <CalendarLegend />
    </div>
  )
}
