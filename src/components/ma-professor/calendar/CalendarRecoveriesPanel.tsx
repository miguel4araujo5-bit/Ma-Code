import {
  getLearningRecoveryOutcomeLabel,
  MAX_LEARNING_RECOVERY_ATTEMPTS
} from '../attendance/learningRecoveryAttempts'
import type {
  ISODate,
  LearningRecoveryStatus
} from '../types'
import type {
  CalendarRecoveryRow,
  CalendarRecoveryWorkspaceSnapshot
} from './calendarRecoveryWorkspace'

interface CalendarRecoveriesPanelProps {
  snapshot: CalendarRecoveryWorkspaceSnapshot
}

function parseISODate(
  value: ISODate
) {
  const [year, month, day] =
    value.split('-').map(Number)

  return new Date(
    year,
    month - 1,
    day
  )
}

function formatDate(
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

function getStatusLabel(
  status: LearningRecoveryStatus
) {
  if (status === 'completed') {
    return 'Concluída'
  }

  if (status === 'in_progress') {
    return 'Em curso'
  }

  return 'Pendente'
}

function getSubjectLabel(
  row: CalendarRecoveryRow
) {
  return (
    row.subject.shortName.trim() ||
    row.subject.name
  )
}

function getModuleLabel(
  row: CalendarRecoveryRow
) {
  const code =
    row.module.code.trim()

  return code
    ? `${code} · ${row.module.name}`
    : row.module.name
}

function getStatusClass(
  row: CalendarRecoveryRow
) {
  if (
    row.recovery.outcome ===
    'successful'
  ) {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  }

  if (
    row.recovery.outcome ===
    'unsuccessful'
  ) {
    return 'border-rose-300/20 bg-rose-300/10 text-rose-100'
  }

  if (
    row.recovery.status ===
    'in_progress'
  ) {
    return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
  }

  return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
}

function RecoveryCard({
  row
}: {
  row: CalendarRecoveryRow
}) {
  const outcomeLabel =
    row.recovery.status ===
      'completed'
      ? getLearningRecoveryOutcomeLabel(
          row.recovery.outcome
        )
      : null

  return (
    <article className="rounded-2xl border border-violet-300/15 bg-slate-950/70 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-violet-200">
            Tentativa {row.attemptNumber}/{MAX_LEARNING_RECOVERY_ATTEMPTS}
          </p>

          <h4 className="mt-2 truncate text-base font-black text-white">
            {row.student.name}
          </h4>

          <p className="mt-1 text-xs font-semibold text-slate-400">
            N.º {row.student.number} · {row.group.name} · {getSubjectLabel(row)}
          </p>

          <p className="mt-2 text-sm font-semibold text-slate-300">
            {getModuleLabel(row)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <span
            className={`rounded-full border px-3 py-1.5 text-[0.62rem] font-black ${getStatusClass(row)}`}
          >
            {getStatusLabel(
              row.recovery.status
            )}
          </span>

          {outcomeLabel ? (
            <span className={`rounded-full border px-3 py-1.5 text-[0.62rem] font-black ${getStatusClass(row)}`}>
              {outcomeLabel}
            </span>
          ) : null}

          {row.recovery.referredToExamAt ? (
            <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-[0.62rem] font-black text-violet-100">
              Encaminhado para exame
            </span>
          ) : null}
        </div>
      </div>

      {row.recovery.activity.trim() ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs leading-6 text-slate-400">
          {row.recovery.activity}
        </p>
      ) : null}
    </article>
  )
}

export default function CalendarRecoveriesPanel({
  snapshot
}: CalendarRecoveriesPanelProps) {
  const daysWithRecoveries =
    snapshot.days.filter(
      day =>
        day.recoveries.length > 0
    )

  if (
    daysWithRecoveries.length === 0
  ) {
    return null
  }

  return (
    <section className="mx-auto mt-6 max-w-[100rem] rounded-[2rem] border border-violet-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
            Recuperações neste período
          </p>

          <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
            Datas previstas de recuperação
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            As recuperações aparecem aqui apenas quando têm uma data prevista e respeitam os filtros de turma e disciplina do calendário.
          </p>
        </div>

        <span className="w-fit rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
          {snapshot.totals.recoveryCount}{' '}
          {snapshot.totals.recoveryCount === 1
            ? 'recuperação'
            : 'recuperações'}
        </span>
      </div>

      <div className="mt-6 space-y-6">
        {daysWithRecoveries.map(
          day => (
            <section
              key={day.date}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-black capitalize text-white">
                  {formatDate(day.date)}
                </h3>

                <span className="text-xs font-bold text-slate-500">
                  {day.recoveries.length}{' '}
                  {day.recoveries.length === 1
                    ? 'recuperação'
                    : 'recuperações'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {day.recoveries.map(
                  row => (
                    <RecoveryCard
                      key={row.recovery.id}
                      row={row}
                    />
                  )
                )}
              </div>
            </section>
          )
        )}
      </div>
    </section>
  )
}
