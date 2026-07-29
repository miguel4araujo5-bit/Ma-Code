import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId,
  ISODate
} from '../types'

import {
  formatGIAERowForClipboard,
  formatGIAERowsForClipboard,
  type GIAEWorkspaceFilters,
  type GIAEWorkspaceRow,
  type GIAEWorkspaceRowState,
  type GIAEWorkspaceSnapshot
} from './giaeWorkspaceRepository'

interface GIAEWorkspaceViewProps {
  snapshot: GIAEWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onFiltersChange: (filters: GIAEWorkspaceFilters) => void
  onLessonSelect?: (lessonId: EntityId) => void
  onMarkSubmitted?: (lessonId: EntityId) => Promise<void> | void
  onMarkPending?: (lessonId: EntityId) => Promise<void> | void
  onMarkManySubmitted?: (lessonIds: EntityId[]) => Promise<void> | void
}

type ActionKey =
  | `copy:${EntityId}`
  | `submit:${EntityId}`
  | `pending:${EntityId}`
  | 'copy-visible'
  | 'submit-selected'
  | null

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

const emptyFilters: GIAEWorkspaceFilters = {
  query: '',
  dateFrom: null,
  dateTo: null,
  groupId: null,
  teachingAssignmentId: null,
  moduleId: null,
  state: null
}

const stateClasses: Record<GIAEWorkspaceRowState, string> = {
  missing_summary:
    'border-rose-300/20 bg-rose-300/10 text-rose-50',
  pending:
    'border-amber-300/20 bg-amber-300/10 text-amber-50',
  submitted:
    'border-emerald-300/20 bg-emerald-300/10 text-emerald-50'
}

function parseISODate(value: ISODate) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    day
  )
}

function formatDate(value: ISODate) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  ).format(
    parseISODate(value)
  )
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return '—'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  ).format(parsed)
}

function getStateLabel(
  state: GIAEWorkspaceRowState
) {
  if (
    state ===
    'missing_summary'
  ) {
    return 'Sem sumário'
  }

  if (
    state === 'pending'
  ) {
    return 'Por submeter'
  }

  return 'Submetido'
}

function isWorkspaceState(
  value: string
): value is GIAEWorkspaceRowState {
  return (
    value ===
      'missing_summary' ||
    value === 'pending' ||
    value === 'submitted'
  )
}

function getSubjectLabel(
  row: GIAEWorkspaceRow
) {
  return (
    row.subject.shortName.trim() ||
    row.subject.name
  )
}

function getModuleLabel(
  row: GIAEWorkspaceRow
) {
  return row.module.code.trim()
    ? `${row.module.code.trim()} · ${row.module.name}`
    : row.module.name
}

async function writeClipboard(
  text: string
) {
  if (!text.trim()) {
    throw new Error(
      'Não existem sumários disponíveis para copiar.'
    )
  }

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text
    )

    return
  }

  const textarea =
    document.createElement(
      'textarea'
    )

  textarea.value = text

  textarea.setAttribute(
    'readonly',
    ''
  )

  textarea.style.position =
    'fixed'

  textarea.style.opacity =
    '0'

  textarea.style.pointerEvents =
    'none'

  document.body.appendChild(
    textarea
  )

  textarea.select()

  const copied =
    document.execCommand(
      'copy'
    )

  textarea.remove()

  if (!copied) {
    throw new Error(
      'O browser não permitiu copiar o texto.'
    )
  }
}

function MetricCard({
  label,
  value,
  detail,
  className
}: {
  label: string
  value: string | number
  detail: string
  className: string
}) {
  return (
    <article
      className={`rounded-2xl border p-4 ${className}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-400">
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

function StateBadge({
  state
}: {
  state: GIAEWorkspaceRowState
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] ${stateClasses[state]}`}
    >
      {getStateLabel(state)}
    </span>
  )
}

function GIAEFilters({
  snapshot,
  loading,
  onFiltersChange
}: {
  snapshot: GIAEWorkspaceSnapshot
  loading: boolean
  onFiltersChange: (
    filters: GIAEWorkspaceFilters
  ) => void
}) {
  const visibleAssignments =
    useMemo(
      () => {
        if (
          !snapshot.filters
            .groupId
        ) {
          return snapshot.assignments
        }

        return snapshot.assignments.filter(
          (
            assignment
          ) =>
            assignment.groupId ===
            snapshot.filters.groupId
        )
      },
      [
        snapshot.assignments,
        snapshot.filters.groupId
      ]
    )

  const visibleModules =
    useMemo(
      () => {
        if (
          snapshot.filters
            .teachingAssignmentId
        ) {
          return snapshot.modules.filter(
            (
              module
            ) =>
              module.teachingAssignmentId ===
              snapshot.filters
                .teachingAssignmentId
          )
        }

        if (
          !snapshot.filters
            .groupId
        ) {
          return snapshot.modules
        }

        const assignmentIds =
          new Set(
            snapshot.assignments
              .filter(
                (
                  assignment
                ) =>
                  assignment.groupId ===
                  snapshot.filters
                    .groupId
              )
              .map(
                (
                  assignment
                ) =>
                  assignment.id
              )
          )

        return snapshot.modules.filter(
          (
            module
          ) =>
            assignmentIds.has(
              module.teachingAssignmentId
            )
        )
      },
      [
        snapshot.assignments,
        snapshot.filters.groupId,
        snapshot.filters
          .teachingAssignmentId,
        snapshot.modules
      ]
    )

  const hasFilters =
    Boolean(
      snapshot.filters.query ||
        snapshot.filters
          .dateFrom ||
        snapshot.filters
          .dateTo ||
        snapshot.filters.groupId ||
        snapshot.filters
          .teachingAssignmentId ||
        snapshot.filters.moduleId ||
        snapshot.filters.state
    )

  function handleGroupChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const groupId =
      event.target.value ||
      null

    const selectedAssignment =
      snapshot.assignments.find(
        (
          assignment
        ) =>
          assignment.id ===
          snapshot.filters
            .teachingAssignmentId
      )

    const teachingAssignmentId =
      groupId &&
      selectedAssignment?.groupId ===
        groupId
        ? selectedAssignment.id
        : null

    const selectedModule =
      snapshot.modules.find(
        (
          module
        ) =>
          module.id ===
          snapshot.filters
            .moduleId
      )

    const moduleBelongsToGroup =
      Boolean(
        selectedModule &&
          snapshot.assignments.some(
            (
              assignment
            ) =>
              assignment.id ===
                selectedModule.teachingAssignmentId &&
              assignment.groupId ===
                groupId
          )
      )

    onFiltersChange({
      ...snapshot.filters,
      groupId,
      teachingAssignmentId,
      moduleId:
        selectedModule &&
        (
          selectedModule.teachingAssignmentId ===
            teachingAssignmentId ||
          (
            !teachingAssignmentId &&
            moduleBelongsToGroup
          )
        )
          ? selectedModule.id
          : null
    })
  }

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const teachingAssignmentId =
      event.target.value ||
      null

    const selectedModule =
      snapshot.modules.find(
        (
          module
        ) =>
          module.id ===
          snapshot.filters
            .moduleId
      )

    onFiltersChange({
      ...snapshot.filters,
      teachingAssignmentId,
      moduleId:
        selectedModule
          ?.teachingAssignmentId ===
        teachingAssignmentId
          ? selectedModule.id
          : null
    })
  }

  return (
    <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Pesquisa e filtros
          </p>

          <h2 className="mt-2 text-lg font-black text-white">
            Encontrar sumários
          </h2>
        </div>

        {hasFilters ? (
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                ...emptyFilters
              })
            }
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-60"
          >
            Limpar filtros
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Pesquisa
          </span>

          <input
            type="search"
            value={
              snapshot.filters.query
            }
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ) =>
              onFiltersChange({
                ...snapshot.filters,
                query:
                  event.target.value
              })
            }
            disabled={loading}
            placeholder="Ex.: comunicação, 11.º D, UFCD 10389"
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Desde
          </span>

          <input
            type="date"
            value={
              snapshot.filters
                .dateFrom ?? ''
            }
            min={
              snapshot.academicYear
                .startDate
            }
            max={
              snapshot.academicYear
                .endDate
            }
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ) =>
              onFiltersChange({
                ...snapshot.filters,
                dateFrom:
                  event.target.value ||
                  null
              })
            }
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Até
          </span>

          <input
            type="date"
            value={
              snapshot.filters
                .dateTo ?? ''
            }
            min={
              snapshot.academicYear
                .startDate
            }
            max={
              snapshot.academicYear
                .endDate
            }
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ) =>
              onFiltersChange({
                ...snapshot.filters,
                dateTo:
                  event.target.value ||
                  null
              })
            }
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            Turma
          </span>

          <select
            value={
              snapshot.filters
                .groupId ?? ''
            }
            onChange={
              handleGroupChange
            }
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todas as turmas
            </option>

            {snapshot.groups.map(
              (
                group
              ) => (
                <option
                  key={group.id}
                  value={group.id}
                >
                  {group.label}
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
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todas as disciplinas
            </option>

            {visibleAssignments.map(
              (
                assignment
              ) => (
                <option
                  key={
                    assignment.id
                  }
                  value={
                    assignment.id
                  }
                >
                  {assignment.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            UFCD / módulo
          </span>

          <select
            value={
              snapshot.filters
                .moduleId ?? ''
            }
            onChange={(
              event: ChangeEvent<HTMLSelectElement>
            ) =>
              onFiltersChange({
                ...snapshot.filters,
                moduleId:
                  event.target.value ||
                  null
              })
            }
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todas as UFCD / módulos
            </option>

            {visibleModules.map(
              (
                module
              ) => (
                <option
                  key={module.id}
                  value={module.id}
                >
                  {module.label}
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
              snapshot.filters.state ??
              ''
            }
            onChange={(
              event: ChangeEvent<HTMLSelectElement>
            ) => {
              const value =
                event.target.value

              onFiltersChange({
                ...snapshot.filters,
                state:
                  isWorkspaceState(
                    value
                  )
                    ? value
                    : null
              })
            }}
            disabled={loading}
            className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60"
          >
            <option value="">
              Todos os estados
            </option>

            <option value="missing_summary">
              Sem sumário
            </option>

            <option value="pending">
              Por submeter
            </option>

            <option value="submitted">
              Submetidos
            </option>
          </select>
        </label>
      </div>
    </section>
  )
}

function SummaryCard({
  row,
  selected,
  disabled,
  busyAction,
  onSelectedChange,
  onCopy,
  onLessonSelect,
  onMarkSubmitted,
  onMarkPending
}: {
  row: GIAEWorkspaceRow
  selected: boolean
  disabled: boolean
  busyAction: ActionKey
  onSelectedChange: (
    lessonId: EntityId,
    selected: boolean
  ) => void
  onCopy: (
    row: GIAEWorkspaceRow
  ) => void
  onLessonSelect?: (
    lessonId: EntityId
  ) => void
  onMarkSubmitted?: (
    lessonId: EntityId
  ) => void
  onMarkPending?: (
    lessonId: EntityId
  ) => void
}) {
  return (
    <article
      className={`rounded-[1.5rem] border p-5 ${
        row.isOverdue
          ? 'border-rose-300/20 bg-rose-300/[0.035]'
          : 'border-white/10 bg-white/[0.025]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black capitalize text-white">
            {formatDate(
              row.lesson.date
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {row.lesson.startTime}–{row.lesson.endTime} ·{' '}
            {row.lesson.periodCount}{' '}
            {row.lesson.periodCount ===
            1
              ? 'tempo'
              : 'tempos'}
          </p>
        </div>

        <StateBadge
          state={row.state}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.65rem] font-bold text-slate-300">
          {row.group.name}
        </span>

        <span className="rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-2.5 py-1 text-[0.65rem] font-bold text-violet-100">
          {getSubjectLabel(row)}
        </span>

        {row.lesson.origin ===
        'extra' ? (
          <span className="rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-2.5 py-1 text-[0.65rem] font-bold text-cyan-100">
            Aula extra
          </span>
        ) : null}
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
        {getModuleLabel(row)}
      </p>

      {row.lesson.summary.trim() ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
          {row.lesson.summary}
        </p>
      ) : (
        <div className="mt-3 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-sm leading-6 text-rose-100">
          Esta aula ainda não tem sumário registado.
        </div>
      )}

      {!row.lesson.summary.trim() &&
      row.lesson.plannedActivity.trim() ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Planeado: {row.lesson.plannedActivity}
        </p>
      ) : null}

      {row.state ===
      'submitted' ? (
        <p className="mt-3 text-xs leading-5 text-emerald-200/75">
          Registado como submetido em{' '}
          {formatDateTime(
            row.lesson
              .giaeSubmittedAt
          )}.
        </p>
      ) : row.isOverdue ? (
        <p className="mt-3 text-xs font-bold leading-5 text-rose-200">
          Sumário em atraso.
        </p>
      ) : null}

      {row.canMarkSubmitted ? (
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 text-xs font-bold text-slate-300">
          <input
            type="checkbox"
            checked={selected}
            onChange={(
              event: ChangeEvent<HTMLInputElement>
            ) =>
              onSelectedChange(
                row.lesson.id,
                event.target.checked
              )
            }
            disabled={disabled}
            className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-300"
          />

          Selecionar para submissão conjunta
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
        {row.canCopy ? (
          <button
            type="button"
            onClick={() =>
              onCopy(row)
            }
            disabled={disabled}
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-xs font-bold text-cyan-50 transition hover:bg-cyan-300/12 disabled:cursor-wait disabled:opacity-50"
          >
            {busyAction ===
            `copy:${row.lesson.id}`
              ? 'A copiar...'
              : 'Copiar sumário'}
          </button>
        ) : null}

        {onLessonSelect ? (
          <button
            type="button"
            onClick={() =>
              onLessonSelect(
                row.lesson.id
              )
            }
            disabled={disabled}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-wait disabled:opacity-50"
          >
            {row.state ===
            'missing_summary'
              ? 'Preencher'
              : 'Editar'}
          </button>
        ) : null}

        {row.canMarkSubmitted &&
        onMarkSubmitted ? (
          <button
            type="button"
            onClick={() =>
              onMarkSubmitted(
                row.lesson.id
              )
            }
            disabled={disabled}
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-wait disabled:opacity-50"
          >
            {busyAction ===
            `submit:${row.lesson.id}`
              ? 'A guardar...'
              : 'Marcar submetido'}
          </button>
        ) : null}

        {row.canMarkPending &&
        onMarkPending ? (
          <button
            type="button"
            onClick={() =>
              onMarkPending(
                row.lesson.id
              )
            }
            disabled={disabled}
            className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-50 transition hover:bg-amber-300/12 disabled:cursor-wait disabled:opacity-50"
          >
            {busyAction ===
            `pending:${row.lesson.id}`
              ? 'A guardar...'
              : 'Voltar a pendente'}
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function GIAEWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onLessonSelect,
  onMarkSubmitted,
  onMarkPending,
  onMarkManySubmitted
}: GIAEWorkspaceViewProps) {
  const [
    selectedLessonIds,
    setSelectedLessonIds
  ] =
    useState<Set<EntityId>>(
      () => new Set()
    )

  const [
    busyAction,
    setBusyAction
  ] =
    useState<ActionKey>(
      null
    )

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback>(
      null
    )

  const selectableRows =
    useMemo(
      () =>
        snapshot.rows.filter(
          (
            row
          ) =>
            row.canMarkSubmitted
        ),
      [
        snapshot.rows
      ]
    )

  const selectedRows =
    useMemo(
      () =>
        snapshot.rows.filter(
          (
            row
          ) =>
            row.canMarkSubmitted &&
            selectedLessonIds.has(
              row.lesson.id
            )
        ),
      [
        selectedLessonIds,
        snapshot.rows
      ]
    )

  const visibleCopyCount =
    snapshot.rows.filter(
      (
        row
      ) =>
        row.canCopy
    ).length

  const allSelectableSelected =
    selectableRows.length >
      0 &&
    selectableRows.every(
      (
        row
      ) =>
        selectedLessonIds.has(
          row.lesson.id
        )
    )

  const disabled =
    loading ||
    busyAction !== null

  useEffect(() => {
    const validIds =
      new Set(
        snapshot.rows
          .filter(
            (
              row
            ) =>
              row.canMarkSubmitted
          )
          .map(
            (
              row
            ) =>
              row.lesson.id
          )
      )

    setSelectedLessonIds(
      (
        current
      ) => {
        const next =
          new Set(
            [
              ...current
            ].filter(
              (
                lessonId
              ) =>
                validIds.has(
                  lessonId
                )
            )
          )

        if (
          next.size ===
            current.size &&
          [
            ...next
          ].every(
            (
              lessonId
            ) =>
              current.has(
                lessonId
              )
          )
        ) {
          return current
        }

        return next
      }
    )
  }, [
    snapshot.rows
  ])

  async function runAction(
    key: Exclude<
      ActionKey,
      null
    >,
    action: () =>
      Promise<void> | void,
    successMessage: string
  ) {
    if (disabled) {
      return
    }

    setBusyAction(key)
    setFeedback(null)

    try {
      await action()

      setFeedback({
        tone: 'success',
        message:
          successMessage
      })
    } catch (
      actionError
    ) {
      setFeedback({
        tone: 'error',
        message:
          actionError instanceof Error
            ? actionError.message
            : 'Ocorreu um erro inesperado.'
      })
    } finally {
      setBusyAction(null)
    }
  }

  function handleSelectedChange(
    lessonId: EntityId,
    selected: boolean
  ) {
    setSelectedLessonIds(
      (
        current
      ) => {
        const next =
          new Set(current)

        if (selected) {
          next.add(
            lessonId
          )
        } else {
          next.delete(
            lessonId
          )
        }

        return next
      }
    )
  }

  function handleSelectAll(
    selected: boolean
  ) {
    setSelectedLessonIds(
      selected
        ? new Set(
            selectableRows.map(
              (
                row
              ) =>
                row.lesson.id
            )
          )
        : new Set()
    )
  }

  function handleCopy(
    row: GIAEWorkspaceRow
  ) {
    void runAction(
      `copy:${row.lesson.id}`,
      () =>
        writeClipboard(
          formatGIAERowForClipboard(
            row
          )
        ),
      'Sumário copiado.'
    )
  }

  function handleCopyVisible() {
    void runAction(
      'copy-visible',
      () =>
        writeClipboard(
          formatGIAERowsForClipboard(
            snapshot.rows,
            true
          )
        ),
      `${visibleCopyCount} ${
        visibleCopyCount ===
        1
          ? 'sumário copiado'
          : 'sumários copiados'
      } com identificação.`
    )
  }

  function handleMarkSubmitted(
    lessonId: EntityId
  ) {
    if (!onMarkSubmitted) {
      return
    }

    void runAction(
      `submit:${lessonId}`,
      () =>
        onMarkSubmitted(
          lessonId
        ),
      'Sumário marcado como submetido no GIAE.'
    )
  }

  function handleMarkPending(
    lessonId: EntityId
  ) {
    if (!onMarkPending) {
      return
    }

    void runAction(
      `pending:${lessonId}`,
      () =>
        onMarkPending(
          lessonId
        ),
      'Sumário devolvido ao estado pendente.'
    )
  }

  function handleMarkSelectedSubmitted() {
    if (
      !onMarkManySubmitted ||
      selectedRows.length ===
        0
    ) {
      return
    }

    const lessonIds =
      selectedRows.map(
        (
          row
        ) =>
          row.lesson.id
      )

    void runAction(
      'submit-selected',
      async () => {
        await onMarkManySubmitted(
          lessonIds
        )

        setSelectedLessonIds(
          new Set()
        )
      },
      `${lessonIds.length} ${
        lessonIds.length ===
        1
          ? 'sumário marcado'
          : 'sumários marcados'
      } como submetido${
        lessonIds.length ===
        1
          ? ''
          : 's'
      }.`
    )
  }

  return (
    <div>
      <section className="rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Sumários / GIAE
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Controlo de submissões
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Prepare os sumários, copie o texto para o GIAE e registe o que já foi submetido. O MA-Professor não acede ao portal da escola nem envia dados automaticamente.
            </p>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Ano letivo{' '}
              {snapshot.academicYear.name}{' '}
              · referência até{' '}
              <span className="capitalize">
                {formatDate(
                  snapshot.referenceDate
                )}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={
                handleCopyVisible
              }
              disabled={
                disabled ||
                visibleCopyCount ===
                  0
              }
              className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.08] px-4 py-3 text-sm font-bold text-violet-50 transition hover:bg-violet-300/13 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busyAction ===
              'copy-visible'
                ? 'A copiar...'
                : `Copiar lista (${visibleCopyCount})`}
            </button>

            {onRefresh ? (
              <button
                type="button"
                onClick={
                  onRefresh
                }
                disabled={
                  disabled
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

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Sem sumário"
            value={
              snapshot.totals
                .missingSummary
            }
            detail={`${snapshot.totals.overdue} em atraso`}
            className="border-rose-300/20 bg-rose-300/[0.055]"
          />

          <MetricCard
            label="Por submeter"
            value={
              snapshot.totals
                .pending
            }
            detail="Dados e prontos a copiar"
            className="border-amber-300/20 bg-amber-300/[0.055]"
          />

          <MetricCard
            label="Submetidos"
            value={
              snapshot.totals
                .submitted
            }
            detail="Confirmados manualmente"
            className="border-emerald-300/20 bg-emerald-300/[0.055]"
          />

          <MetricCard
            label="Total"
            value={
              snapshot.totals
                .total
            }
            detail={`${snapshot.totals.periods} tempos abrangidos`}
            className="border-cyan-300/20 bg-cyan-300/[0.055]"
          />

          <MetricCard
            label="Visíveis"
            value={
              snapshot.visibleTotals
                .total
            }
            detail={
              snapshot.visibleTotals
                .total ===
              snapshot.totals.total
                ? 'Sem redução por filtros'
                : 'Após aplicar os filtros'
            }
            className="border-violet-300/20 bg-violet-300/[0.055]"
          />
        </div>
      </section>

      <GIAEFilters
        snapshot={snapshot}
        loading={disabled}
        onFiltersChange={
          onFiltersChange
        }
      />

      {error ? (
        <div
          role="alert"
          className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
        >
          <p className="leading-6">
            Não foi possível atualizar os sumários: {error}
          </p>

          {onRefresh ? (
            <button
              type="button"
              onClick={
                onRefresh
              }
              disabled={
                disabled
              }
              className="rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-bold text-rose-50 transition hover:bg-rose-200/15 disabled:cursor-wait disabled:opacity-60"
            >
              Tentar novamente
            </button>
          ) : null}
        </div>
      ) : null}

      {feedback ? (
        <div
          role={
            feedback.tone ===
            'error'
              ? 'alert'
              : 'status'
          }
          className={`mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4 text-sm ${
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          <p className="leading-6">
            {feedback.message}
          </p>

          <button
            type="button"
            onClick={() =>
              setFeedback(null)
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold transition hover:bg-white/[0.08]"
          >
            Fechar aviso
          </button>
        </div>
      ) : null}

      <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Registos
            </p>

            <h2 className="mt-2 text-xl font-black text-white">
              {snapshot.rows.length}{' '}
              {snapshot.rows.length ===
              1
                ? 'aula encontrada'
                : 'aulas encontradas'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {selectableRows.length >
            0 ? (
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={
                    allSelectableSelected
                  }
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    handleSelectAll(
                      event.target
                        .checked
                    )
                  }
                  disabled={
                    disabled
                  }
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-300"
                />

                Selecionar todos
              </label>
            ) : null}

            {onMarkManySubmitted ? (
              <button
                type="button"
                onClick={
                  handleMarkSelectedSubmitted
                }
                disabled={
                  disabled ||
                  selectedRows.length ===
                    0
                }
                className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2.5 text-xs font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction ===
                'submit-selected'
                  ? 'A guardar...'
                  : `Marcar submetidos (${selectedRows.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {snapshot.rows.length ===
        0 ? (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/15 bg-white/[0.025] p-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.07] text-xl text-cyan-100">
              ✓
            </div>

            <h3 className="mt-5 text-lg font-black text-white">
              Nenhum registo encontrado
            </h3>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-400">
              Não existem aulas que correspondam aos filtros atuais. Limpe os filtros ou confirme se as aulas já foram criadas no calendário.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {snapshot.rows.map(
              (
                row
              ) => (
                <SummaryCard
                  key={
                    row.lesson.id
                  }
                  row={row}
                  selected={
                    selectedLessonIds.has(
                      row.lesson.id
                    )
                  }
                  disabled={
                    disabled
                  }
                  busyAction={
                    busyAction
                  }
                  onSelectedChange={
                    handleSelectedChange
                  }
                  onCopy={
                    handleCopy
                  }
                  onLessonSelect={
                    onLessonSelect
                  }
                  onMarkSubmitted={
                    handleMarkSubmitted
                  }
                  onMarkPending={
                    handleMarkPending
                  }
                />
              )
            )}
          </div>
        )}
      </section>
    </div>
  )
}
