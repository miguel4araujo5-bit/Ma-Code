import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId,
  LearningRecovery,
  LearningRecoveryStatus
} from '../types'

import {
  getAbsenceWarningLevelLabel
} from './attendanceRepository'

import {
  getRecoveryStatusLabel,
  type AttendanceWorkspaceFilters,
  type AttendanceWorkspaceSnapshot,
  type CreateWorkspaceRecoveryInput
} from './attendanceWorkspaceRepository'

interface AttendanceWorkspaceViewProps {
  snapshot: AttendanceWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void

  onFiltersChange: (
    filters: AttendanceWorkspaceFilters
  ) => void

  onCreateRecovery: (
    input: CreateWorkspaceRecoveryInput
  ) => Promise<void> | void

  onUpdateRecovery: (
    recoveryId: EntityId,
    changes: {
      contents?: string
      activity?: string
      plannedDate?: string | null
      status?: LearningRecoveryStatus
      result?: string
    }
  ) => Promise<void> | void

  onDeletePendingRecovery: (
    recoveryId: EntityId
  ) => Promise<void> | void

  onSynchronizeRecoveries: (
    moduleId: EntityId
  ) => Promise<void> | void
}

interface RecoveryDraft {
  contents: string
  activity: string
  plannedDate: string
  status: LearningRecoveryStatus
  result: string
}

type RecoveryDrafts = Record<
  EntityId,
  RecoveryDraft
>

type Feedback =
  | {
      tone: 'success' | 'error'
      message: string
    }
  | null

const fieldClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-wait disabled:opacity-60'

function getErrorMessage(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : 'Ocorreu um erro inesperado.'
}

function formatPercent(
  value: number
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(
    value
  )
}

function formatDate(
  value: string | null
) {
  if (
    !value
  ) {
    return 'Sem data'
  }

  const [
    year,
    month,
    day
  ] = value
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  )
}

function createDraft(
  recovery: LearningRecovery | null
): RecoveryDraft {
  return {
    contents:
      recovery?.contents ??
      '',
    activity:
      recovery?.activity ??
      '',
    plannedDate:
      recovery?.plannedDate ??
      '',
    status:
      recovery?.status ??
      'pending',
    result:
      recovery?.result ??
      ''
  }
}

function buildDrafts(
  snapshot: AttendanceWorkspaceSnapshot
): RecoveryDrafts {
  return Object.fromEntries(
    snapshot.rows.map(
      row => [
        row.student.id,
        createDraft(
          row.recovery
        )
      ]
    )
  ) as RecoveryDrafts
}

function FieldLabel({
  children,
  optional = false
}: {
  children: string
  optional?: boolean
}) {
  return (
    <span className="mb-2 flex items-center justify-between gap-3 text-xs font-bold text-slate-300">
      <span>
        {children}
      </span>

      {optional ? (
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-600">
          Opcional
        </span>
      ) : null}
    </span>
  )
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

function warningClass(
  warningLevel:
    AttendanceWorkspaceSnapshot['rows'][number]['summary']['warningLevel']
) {
  if (
    warningLevel ===
    'recovery_required'
  ) {
    return 'border-rose-300/20 bg-rose-300/10 text-rose-100'
  }

  if (
    warningLevel ===
    'warning'
  ) {
    return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
  }

  return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
}

function recoveryClass(
  status: LearningRecoveryStatus
) {
  if (
    status ===
    'completed'
  ) {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  }

  if (
    status ===
    'in_progress'
  ) {
    return 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100'
  }

  return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
}

export default function AttendanceWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onCreateRecovery,
  onUpdateRecovery,
  onDeletePendingRecovery,
  onSynchronizeRecoveries
}: AttendanceWorkspaceViewProps) {
  const [
    drafts,
    setDrafts
  ] = useState<RecoveryDrafts>(
    () =>
      buildDrafts(
        snapshot
      )
  )

  const [
    onlyProblems,
    setOnlyProblems
  ] = useState(false)

  const [
    expandedStudentId,
    setExpandedStudentId
  ] = useState<EntityId | null>(
    null
  )

  const [
    busyAction,
    setBusyAction
  ] = useState<string | null>(
    null
  )

  const [
    feedback,
    setFeedback
  ] = useState<Feedback>(
    null
  )

  useEffect(() => {
    setDrafts(
      buildDrafts(
        snapshot
      )
    )
  }, [
    snapshot.generatedAt
  ])

  const visibleRows = useMemo(
    () =>
      onlyProblems
        ? snapshot.rows.filter(
            row =>
              row.summary.warningLevel !==
              'regular'
          )
        : snapshot.rows,
    [
      onlyProblems,
      snapshot.rows
    ]
  )

  const busy =
    loading ||
    Boolean(
      busyAction
    )

  async function runAction(
    actionId: string,
    action: () => Promise<void> | void,
    successMessage: string
  ) {
    if (
      busyAction
    ) {
      return
    }

    setBusyAction(
      actionId
    )
    setFeedback(null)

    try {
      await action()

      setFeedback({
        tone: 'success',
        message: successMessage
      })
    } catch (
      actionError
    ) {
      setFeedback({
        tone: 'error',
        message:
          getErrorMessage(
            actionError
          )
      })
    } finally {
      setBusyAction(null)
    }
  }

  function updateDraft(
    studentId: EntityId,
    changes: Partial<RecoveryDraft>
  ) {
    setDrafts(
      current => ({
        ...current,
        [studentId]: {
          ...(current[studentId] ??
            createDraft(null)),
          ...changes
        }
      })
    )
  }

  async function saveRecovery(
    event: FormEvent<HTMLFormElement>,
    studentId: EntityId,
    studentName: string,
    recovery: LearningRecovery | null
  ) {
    event.preventDefault()

    const assignmentId =
      snapshot.selectedAssignment?.id

    const moduleId =
      snapshot.selectedModule?.id

    if (
      !assignmentId ||
      !moduleId
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Selecione uma turma, disciplina e UFCD válidas.'
      })
      return
    }

    const draft =
      drafts[studentId] ??
      createDraft(null)

    await runAction(
      `save-${studentId}`,
      () =>
        recovery
          ? onUpdateRecovery(
              recovery.id,
              {
                contents:
                  draft.contents,
                activity:
                  draft.activity,
                plannedDate:
                  draft.plannedDate ||
                  null,
                status:
                  draft.status,
                result:
                  draft.result
              }
            )
          : onCreateRecovery({
              academicYearId:
                snapshot.academicYear.id,
              teachingAssignmentId:
                assignmentId,
              moduleId,
              studentId,
              contents:
                draft.contents,
              activity:
                draft.activity,
              plannedDate:
                draft.plannedDate ||
                null,
              status:
                draft.status,
              result:
                draft.result
            }),
      recovery
        ? `A recuperação de ${studentName} foi atualizada.`
        : `A recuperação de ${studentName} foi criada.`
    )
  }

  async function deleteRecovery(
    recovery: LearningRecovery,
    studentName: string
  ) {
    const confirmed =
      window.confirm(
        `Eliminar a recuperação pendente de ${studentName}?`
      )

    if (
      !confirmed
    ) {
      return
    }

    await runAction(
      `delete-${recovery.id}`,
      () =>
        onDeletePendingRecovery(
          recovery.id
        ),
      `A recuperação pendente de ${studentName} foi eliminada.`
    )
  }

  async function synchronize() {
    const moduleId =
      snapshot.selectedModule?.id

    if (
      !moduleId
    ) {
      return
    }

    await runAction(
      'synchronize',
      () =>
        onSynchronizeRecoveries(
          moduleId
        ),
      'As recuperações necessárias foram verificadas.'
    )
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950/75 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-cyan-100">
                  Faltas e recuperações
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Acompanhamento por UFCD
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Consulte as faltas de cada aluno e organize as atividades de recuperação sem perder o histórico.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  void synchronize()
                }
                disabled={
                  busy ||
                  !snapshot.selectedModule
                }
                className="rounded-2xl border border-amber-200/25 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-50 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {busyAction ===
                'synchronize'
                  ? 'A verificar...'
                  : 'Verificar recuperações'}
              </button>

              <button
                type="button"
                onClick={onRefresh}
                disabled={
                  busy ||
                  !onRefresh
                }
                className="rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
              >
                {loading
                  ? 'A atualizar...'
                  : 'Atualizar'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-7 xl:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Turma e disciplina
            </span>

            <select
              value={
                snapshot.filters
                  .teachingAssignmentId ??
                ''
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                onFiltersChange({
                  teachingAssignmentId:
                    event.target.value ||
                    null,
                  moduleId: null
                })
              }
              disabled={
                busy ||
                snapshot.assignmentOptions
                  .length === 0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
            >
              {snapshot.assignmentOptions.length ===
              0 ? (
                <option value="">
                  Sem turmas disponíveis
                </option>
              ) : null}

              {snapshot.assignmentOptions.map(
                option => (
                  <option
                    key={option.assignment.id}
                    value={option.assignment.id}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span className="mb-2 block text-sm font-bold text-slate-200">
              UFCD ou módulo
            </span>

            <select
              value={
                snapshot.filters.moduleId ??
                ''
              }
              onChange={(
                event: ChangeEvent<HTMLSelectElement>
              ) =>
                onFiltersChange({
                  teachingAssignmentId:
                    snapshot.filters
                      .teachingAssignmentId,
                  moduleId:
                    event.target.value ||
                    null
                })
              }
              disabled={
                busy ||
                snapshot.moduleOptions.length ===
                  0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50"
            >
              {snapshot.moduleOptions.length ===
              0 ? (
                <option value="">
                  Sem UFCD disponíveis
                </option>
              ) : null}

              {snapshot.moduleOptions.map(
                option => (
                  <option
                    key={option.module.id}
                    value={option.module.id}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm leading-6 ${
            feedback.tone ===
            'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {!snapshot.selectedAssignment ||
      !snapshot.selectedModule ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem dados de assiduidade disponíveis.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirme a turma, a disciplina, a UFCD e os alunos na configuração do MA-Professor.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              label="Alunos"
              value={snapshot.totals.studentCount}
              detail="Alunos ativos na turma."
              className="border-cyan-300/15 bg-cyan-300/[0.035]"
            />

            <MetricCard
              label="Média de faltas"
              value={`${formatPercent(
                snapshot.totals
                  .averageAbsencePercent
              )}%`}
              detail="Percentagem média da turma."
              className="border-violet-300/15 bg-violet-300/[0.035]"
            />

            <MetricCard
              label="Regular"
              value={snapshot.totals.regularCount}
              detail="Abaixo do limite de aviso."
              className="border-emerald-300/15 bg-emerald-300/[0.035]"
            />

            <MetricCard
              label="Atenção"
              value={snapshot.totals.warningCount}
              detail={`A partir de ${formatPercent(
                snapshot.settings
                  .absenceWarningPercent
              )}%.`}
              className="border-amber-300/15 bg-amber-300/[0.035]"
            />

            <MetricCard
              label="Recuperação"
              value={
                snapshot.totals
                  .recoveryRequiredCount
              }
              detail={`Acima de ${formatPercent(
                snapshot.settings
                  .learningRecoveryThresholdPercent
              )}%.`}
              className="border-rose-300/15 bg-rose-300/[0.035]"
            />

            <MetricCard
              label="Em aberto"
              value={
                snapshot.totals
                  .activeRecoveryCount
              }
              detail={`${snapshot.totals.completedRecoveryCount} concluídas.`}
              className="border-sky-300/15 bg-sky-300/[0.035]"
            />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Alunos
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  Situação de assiduidade
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  As percentagens consideram apenas aulas dadas e contabilizadas nesta UFCD.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>
                  ) =>
                    setOnlyProblems(
                      event.target.checked
                    )
                  }
                  className="h-4 w-4 rounded border-white/20 bg-slate-900 text-cyan-300 focus:ring-cyan-300/30"
                />

                Mostrar apenas avisos
              </label>
            </div>

            {visibleRows.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-black text-white">
                  Não existem alunos para apresentar neste filtro.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {visibleRows.map(
                  row => {
                    const recovery =
                      row.recovery

                    const activeRecovery =
                      recovery &&
                      recovery.status !==
                        'completed'
                        ? recovery
                        : null

                    const draft =
                      drafts[row.student.id] ??
                      createDraft(
                        recovery
                      )

                    const expanded =
                      expandedStudentId ===
                      row.student.id

                    return (
                      <article
                        key={row.student.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                              N.º {row.student.number}
                            </p>

                            <h3 className="mt-1 truncate text-base font-black text-white">
                              {row.student.name}
                            </h3>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1.5 text-xs font-black text-slate-300">
                              {row.summary.absences}/{row.summary.lessonsTaught} faltas
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1.5 text-xs font-black ${warningClass(
                                row.summary.warningLevel
                              )}`}
                            >
                              {formatPercent(
                                row.summary
                                  .absencePercent
                              )}% ·{' '}
                              {getAbsenceWarningLevelLabel(
                                row.summary.warningLevel
                              )}
                            </span>

                            {activeRecovery ? (
                              <span
                                className={`rounded-full border px-3 py-1.5 text-xs font-black ${recoveryClass(
                                  activeRecovery.status
                                )}`}
                              >
                                {getRecoveryStatusLabel(
                                  activeRecovery.status
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Aulas dadas
                            </p>

                            <p className="mt-1 text-lg font-black text-white">
                              {row.summary.lessonsTaught}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Faltas
                            </p>

                            <p className="mt-1 text-lg font-black text-rose-100">
                              {row.summary.absences}
                            </p>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                            <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                              Recuperações
                            </p>

                            <p className="mt-1 text-lg font-black text-cyan-100">
                              {row.recoveryHistory.length}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedStudentId(
                                current =>
                                  current ===
                                  row.student.id
                                    ? null
                                    : row.student.id
                              )

                              if (
                                !drafts[row.student.id]
                              ) {
                                updateDraft(
                                  row.student.id,
                                  createDraft(
                                    recovery
                                  )
                                )
                              }
                            }}
                            disabled={busy}
                            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-60"
                          >
                            {expanded
                              ? 'Fechar recuperação'
                              : recovery
                                ? 'Gerir recuperação'
                                : 'Criar recuperação'}
                          </button>

                          {recovery?.status ===
                          'completed' ? (
                            <button
                              type="button"
                              onClick={() => {
                                updateDraft(
                                  row.student.id,
                                  {
                                    status:
                                      'in_progress'
                                  }
                                )

                                setExpandedStudentId(
                                  row.student.id
                                )
                              }}
                              disabled={busy}
                              className="rounded-xl border border-violet-300/20 bg-violet-300/[0.07] px-4 py-2.5 text-xs font-black text-violet-100 transition hover:bg-violet-300/10 disabled:opacity-60"
                            >
                              Reabrir recuperação
                            </button>
                          ) : null}
                        </div>

                        {expanded ? (
                          <form
                            onSubmit={(event: FormEvent<HTMLFormElement>) =>
                              void saveRecovery(
                                event,
                                row.student.id,
                                row.student.name,
                                recovery
                              )
                            }
                            className="mt-5 rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-4 sm:p-5"
                          >
                            <div className="grid gap-4 lg:grid-cols-2">
                              <label>
                                <FieldLabel optional>
                                  Conteúdos a recuperar
                                </FieldLabel>

                                <textarea
                                  value={draft.contents}
                                  onChange={(
                                    event: ChangeEvent<HTMLTextAreaElement>
                                  ) =>
                                    updateDraft(
                                      row.student.id,
                                      {
                                        contents:
                                          event.target.value
                                      }
                                    )
                                  }
                                  disabled={busy}
                                  rows={3}
                                  placeholder="Conteúdos essenciais que o aluno deve recuperar."
                                  className={`${fieldClass} resize-y`}
                                />
                              </label>

                              <label>
                                <FieldLabel optional>
                                  Atividade de recuperação
                                </FieldLabel>

                                <textarea
                                  value={draft.activity}
                                  onChange={(
                                    event: ChangeEvent<HTMLTextAreaElement>
                                  ) =>
                                    updateDraft(
                                      row.student.id,
                                      {
                                        activity:
                                          event.target.value
                                      }
                                    )
                                  }
                                  disabled={busy}
                                  rows={3}
                                  placeholder="Trabalho, ficha, apresentação ou outra atividade."
                                  className={`${fieldClass} resize-y`}
                                />
                              </label>

                              <label>
                                <FieldLabel optional>
                                  Data prevista
                                </FieldLabel>

                                <input
                                  type="date"
                                  value={draft.plannedDate}
                                  min={snapshot.academicYear.startDate}
                                  max={snapshot.academicYear.endDate}
                                  onChange={(
                                    event: ChangeEvent<HTMLInputElement>
                                  ) =>
                                    updateDraft(
                                      row.student.id,
                                      {
                                        plannedDate:
                                          event.target.value
                                      }
                                    )
                                  }
                                  disabled={busy}
                                  className={fieldClass}
                                />
                              </label>

                              <label>
                                <FieldLabel>
                                  Estado
                                </FieldLabel>

                                <select
                                  value={draft.status}
                                  onChange={(
                                    event: ChangeEvent<HTMLSelectElement>
                                  ) =>
                                    updateDraft(
                                      row.student.id,
                                      {
                                        status:
                                          event.target.value as LearningRecoveryStatus
                                      }
                                    )
                                  }
                                  disabled={busy}
                                  className={fieldClass}
                                >
                                  <option value="pending">
                                    Pendente
                                  </option>

                                  <option value="in_progress">
                                    Em curso
                                  </option>

                                  <option value="completed">
                                    Concluída
                                  </option>
                                </select>
                              </label>

                              <label className="lg:col-span-2">
                                <FieldLabel
                                  optional={
                                    draft.status !==
                                    'completed'
                                  }
                                >
                                  Resultado
                                </FieldLabel>

                                <textarea
                                  value={draft.result}
                                  onChange={(
                                    event: ChangeEvent<HTMLTextAreaElement>
                                  ) =>
                                    updateDraft(
                                      row.student.id,
                                      {
                                        result:
                                          event.target.value
                                      }
                                    )
                                  }
                                  disabled={busy}
                                  rows={3}
                                  placeholder="Resultado, evidências e observações da recuperação."
                                  className={`${fieldClass} resize-y`}
                                />
                              </label>
                            </div>

                            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                {recovery ? (
                                  <p className="text-xs leading-5 text-slate-500">
                                    Registada com {recovery.absenceCountAtTrigger} faltas em {recovery.lessonCountAtTrigger} aulas ({formatPercent(
                                      recovery.absencePercentAtTrigger
                                    )}%).
                                  </p>
                                ) : (
                                  <p className="text-xs leading-5 text-slate-500">
                                    A recuperação será ligada a esta UFCD e ao aluno selecionado.
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                                {recovery?.status ===
                                'pending' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deleteRecovery(
                                        recovery,
                                        row.student.name
                                      )
                                    }
                                    disabled={busy}
                                    className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] px-4 py-2.5 text-xs font-black text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
                                  >
                                    Eliminar pendente
                                  </button>
                                ) : null}

                                <button
                                  type="submit"
                                  disabled={busy}
                                  className="rounded-xl border border-cyan-200/30 bg-gradient-to-r from-cyan-300 to-sky-300 px-5 py-2.5 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:opacity-60"
                                >
                                  {busyAction ===
                                  `save-${row.student.id}`
                                    ? 'A guardar...'
                                    : recovery
                                      ? 'Guardar recuperação'
                                      : 'Criar recuperação'}
                                </button>
                              </div>
                            </div>

                            {row.recoveryHistory.length >
                            0 ? (
                              <div className="mt-5 border-t border-white/10 pt-5">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                  Histórico
                                </p>

                                <div className="mt-3 space-y-2">
                                  {row.recoveryHistory.map(
                                    historyItem => (
                                      <div
                                        key={historyItem.id}
                                        className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div>
                                          <p className="text-xs font-black text-slate-200">
                                            {getRecoveryStatusLabel(
                                              historyItem.status
                                            )}
                                          </p>

                                          <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                                            Data prevista: {formatDate(
                                              historyItem.plannedDate
                                            )}
                                            {' · '}
                                            {formatPercent(
                                              historyItem.absencePercentAtTrigger
                                            )}% no momento do registo
                                          </p>
                                        </div>

                                        <span
                                          className={`rounded-full border px-3 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${recoveryClass(
                                            historyItem.status
                                          )}`}
                                        >
                                          {getRecoveryStatusLabel(
                                            historyItem.status
                                          )}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            ) : null}
                          </form>
                        ) : null}
                      </article>
                    )
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
