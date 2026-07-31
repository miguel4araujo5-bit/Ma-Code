import DailyWorkspaceView from '../daily/DailyWorkspaceView'

import {
  getDashboardPendingReasonLabel,
  type DashboardAssignmentRow,
  type DashboardAttendanceAlertRow,
  type DashboardLessonRow,
  type DashboardPendingSummaryRow,
  type DashboardSnapshot
} from './dashboardRepository'

interface DashboardViewProps {
  snapshot: DashboardSnapshot
  refreshing?: boolean
  onRefresh?: () => void
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Sem previsão'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

function formatLongDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day))
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  }).format(value)
}

function getModuleTitle(code: string, name: string) {
  return code.trim() ? `${code.trim()} · ${name}` : name
}

function getSubjectLabel(row: DashboardAssignmentRow) {
  return row.subject.shortName.trim() || row.subject.name
}

function ProgressBar({
  value,
  label
}: {
  value: number
  label: string
}) {
  const normalizedValue = Math.min(100, Math.max(0, value))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-slate-400">{label}</span>
        <span className="font-black text-cyan-100">
          {formatPercentage(normalizedValue)}%
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 transition-[width] duration-500"
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string
  title: string
  description?: string
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function EmptyState({
  title,
  description
}: {
  title: string
  description: string
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center">
      <p className="font-black text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  tone
}: {
  label: string
  value: string | number
  detail: string
  tone: 'cyan' | 'violet' | 'amber' | 'emerald'
}) {
  const toneClasses = {
    cyan: 'border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-100',
    violet:
      'border-violet-300/20 bg-violet-300/[0.06] text-violet-100',
    amber:
      'border-amber-300/20 bg-amber-300/[0.06] text-amber-100',
    emerald:
      'border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100'
  } as const

  return (
    <article
      className={`rounded-[1.5rem] border p-5 shadow-xl shadow-black/15 ${toneClasses[tone]}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p>
    </article>
  )
}

function AssignmentCard({ row }: { row: DashboardAssignmentRow }) {
  const moduleTitle = row.currentModule
    ? getModuleTitle(row.currentModule.code, row.currentModule.name)
    : 'Sem UFCD ativa'

  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100">
              {row.group.name}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-slate-300">
              {getSubjectLabel(row)}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-black text-white">
            {row.subject.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {row.group.courseName || row.assignment.displayName}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.06] px-4 py-3 text-right">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-violet-200/75">
            Conclusão global
          </p>
          <p className="mt-1 text-2xl font-black text-white">
            {formatPercentage(row.completionPercent)}%
          </p>
        </div>
      </div>

      <div className="mt-6">
        <ProgressBar
          value={row.completionPercent}
          label={`${row.periodsTaught} de ${row.periodsPlanned} tempos dados`}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            UFCD atual
          </p>
          <p className="mt-2 text-sm font-black leading-6 text-white">
            {moduleTitle}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            Tempos em falta
          </p>
          <p className="mt-2 text-2xl font-black text-white">
            {row.periodsRemaining}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
            Previsão da UFCD
          </p>
          <p className="mt-2 text-sm font-black leading-6 text-white">
            {formatDate(
              row.currentModuleProgress?.estimatedCompletionDate ?? null
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-cyan-200/70">
            Próximo conteúdo
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
            {row.nextPlanificationItem?.content ||
              row.nextPlanificationItem?.suggestedSummary ||
              'Sem conteúdo seguinte definido na planificação.'}
          </p>
        </div>

        <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-4">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-violet-200/70">
            Próxima aula
          </p>

          {row.nextLesson ? (
            <>
              <p className="mt-2 text-sm font-black text-white">
                {formatDate(row.nextLesson.date)} ·{' '}
                {row.nextLesson.startTime}–{row.nextLesson.endTime}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {row.nextLesson.periodCount}{' '}
                {row.nextLesson.periodCount === 1
                  ? 'tempo'
                  : 'tempos'}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Não existem aulas futuras agendadas.
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function UpcomingLessonItem({
  row
}: {
  row: DashboardLessonRow
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-white">
            {row.group.name} ·{' '}
            {row.subject.shortName || row.subject.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {getModuleTitle(row.module.code, row.module.name)}
          </p>
        </div>

        <span className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.07] px-3 py-2 text-xs font-black text-cyan-100">
          {row.lesson.periodCount}{' '}
          {row.lesson.periodCount === 1 ? 'tempo' : 'tempos'}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {formatDate(row.lesson.date)} · {row.lesson.startTime}–
        {row.lesson.endTime}
      </p>

      {row.lesson.plannedActivity ? (
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {row.lesson.plannedActivity}
        </p>
      ) : null}
    </article>
  )
}

function PendingSummaryItem({
  row
}: {
  row: DashboardPendingSummaryRow
}) {
  const missingSummary = row.reason === 'missing_summary'

  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">
            {row.group.name} ·{' '}
            {row.subject.shortName || row.subject.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(row.lesson.date)} · {row.lesson.startTime}–
            {row.lesson.endTime}
          </p>
        </div>

        <span
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
            missingSummary
              ? 'border-amber-300/20 bg-amber-300/10 text-amber-100'
              : 'border-violet-300/20 bg-violet-300/10 text-violet-100'
          }`}
        >
          {getDashboardPendingReasonLabel(row.reason)}
        </span>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {getModuleTitle(row.module.code, row.module.name)}
      </p>

      {!missingSummary && row.lesson.summary ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
          {row.lesson.summary}
        </p>
      ) : null}
    </article>
  )
}

function AttendanceAlertItem({
  row
}: {
  row: DashboardAttendanceAlertRow
}) {
  const recoveryRequired =
    row.summary.warningLevel === 'recovery_required'

  return (
    <article
      className={`rounded-2xl border p-4 ${
        recoveryRequired
          ? 'border-rose-300/20 bg-rose-300/[0.055]'
          : 'border-amber-300/20 bg-amber-300/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-white">
            {row.student.number} · {row.student.name}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {row.assignment.displayName} ·{' '}
            {getModuleTitle(row.module.code, row.module.name)}
          </p>
        </div>

        <span
          className={`rounded-xl border px-3 py-2 text-sm font-black ${
            recoveryRequired
              ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
              : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
          }`}
        >
          {formatPercentage(row.summary.absencePercent)}%
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-slate-300">
          {row.summary.absences} faltas em{' '}
          {row.summary.lessonsTaught} aulas
        </span>

        <span
          className={`rounded-full border px-3 py-1.5 font-bold ${
            recoveryRequired
              ? 'border-rose-300/20 bg-rose-300/10 text-rose-100'
              : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
          }`}
        >
          {recoveryRequired
            ? 'Recuperação necessária'
            : 'Atenção à assiduidade'}
        </span>

        {row.recovery ? (
          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 font-bold text-violet-100">
            Recuperação em curso
          </span>
        ) : null}
      </div>
    </article>
  )
}

export default function DashboardView({
  snapshot,
  refreshing = false,
  onRefresh
}: DashboardViewProps) {
  const { totals } = snapshot

  return (
    <div className="mx-auto max-w-[110rem]">
      <DailyWorkspaceView
        academicYearId={snapshot.academicYear.id}
        onSaved={onRefresh}
      />

      <section className="mt-8 rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
              Painel do ano letivo
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {snapshot.academicYear.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Estado calculado até{' '}
              {formatLongDate(snapshot.referenceDate)}.
            </p>
          </div>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-60"
            >
              {refreshing
                ? 'A atualizar...'
                : 'Atualizar painel'}
            </button>
          ) : null}
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Tempos dados"
            value={totals.periodsTaught}
            detail={`${totals.periodsPlanned} tempos previstos no total`}
            tone="cyan"
          />

          <MetricCard
            label="Tempos em falta"
            value={totals.periodsRemaining}
            detail={`${formatPercentage(
              totals.completionPercent
            )}% do ano concluído`}
            tone="violet"
          />

          <MetricCard
            label="Sumários pendentes"
            value={
              totals.pendingSummaryCount +
              totals.pendingGIAECount
            }
            detail={`${totals.pendingSummaryCount} por preencher · ${totals.pendingGIAECount} no GIAE`}
            tone="amber"
          />

          <MetricCard
            label="Alertas de faltas"
            value={
              totals.attendanceWarningCount +
              totals.recoveryRequiredCount
            }
            detail={`${totals.recoveryRequiredCount} recuperações necessárias`}
            tone="emerald"
          />
        </div>

        <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <ProgressBar
            value={totals.completionPercent}
            label="Progresso letivo global"
          />

          <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div>
              <p className="text-2xl font-black text-white">
                {totals.activeGroupCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Turmas
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-white">
                {totals.activeStudentCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Alunos
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-white">
                {totals.activeModuleCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                UFCD
              </p>
            </div>

            <div>
              <p className="text-2xl font-black text-white">
                {totals.taughtLessonCount}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Aulas dadas
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionHeading
          eyebrow="Progresso por turma"
          title="Disciplinas e UFCD em curso"
          description="Tempos dados, previsão de conclusão e próximo conteúdo de cada turma e disciplina."
        />

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {snapshot.assignments.length > 0 ? (
            snapshot.assignments.map(row => (
              <AssignmentCard
                key={row.assignment.id}
                row={row}
              />
            ))
          ) : (
            <div className="xl:col-span-2">
              <EmptyState
                title="Ainda não existem disciplinas configuradas."
                description="Conclua a configuração de turmas, disciplinas e UFCD para começar a acompanhar o progresso."
              />
            </div>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
          <SectionHeading
            eyebrow="Agenda"
            title="Próximas aulas"
            description={`${totals.plannedLessonCount} aulas planeadas no calendário.`}
          />

          <div className="mt-5 space-y-3">
            {snapshot.upcomingLessons.length > 0 ? (
              snapshot.upcomingLessons.map(row => (
                <UpcomingLessonItem
                  key={row.lesson.id}
                  row={row}
                />
              ))
            ) : (
              <EmptyState
                title="Sem próximas aulas."
                description="As aulas futuras aparecerão aqui depois de serem geradas a partir do horário ou adicionadas manualmente."
              />
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
          <SectionHeading
            eyebrow="Trabalho pendente"
            title="Sumários e GIAE"
            description="Aulas dadas que ainda exigem preenchimento ou registo externo."
          />

          <div className="mt-5 space-y-3">
            {snapshot.pendingSummaries.length > 0 ? (
              snapshot.pendingSummaries.map(row => (
                <PendingSummaryItem
                  key={`${row.lesson.id}-${row.reason}`}
                  row={row}
                />
              ))
            ) : (
              <EmptyState
                title="Tudo em dia."
                description="Não existem sumários por preencher nem registos pendentes no GIAE."
              />
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-[1.75rem] border border-white/10 bg-slate-950/65 p-5 sm:p-6">
        <SectionHeading
          eyebrow="Assiduidade"
          title="Alertas de faltas e recuperações"
          description="Alunos que atingiram o nível de aviso ou ultrapassaram o limite definido para recuperação."
        />

        <div className="mt-5 grid gap-3 xl:grid-cols-2">
          {snapshot.attendanceAlerts.length > 0 ? (
            snapshot.attendanceAlerts.map(row => (
              <AttendanceAlertItem
                key={`${row.student.id}-${row.module.id}`}
                row={row}
              />
            ))
          ) : (
            <div className="xl:col-span-2">
              <EmptyState
                title="Sem alertas de assiduidade."
                description="Os avisos aparecerão automaticamente à medida que forem registadas presenças e faltas nas aulas dadas."
              />
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
