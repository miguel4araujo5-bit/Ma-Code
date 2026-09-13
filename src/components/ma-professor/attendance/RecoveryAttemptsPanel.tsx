import {
  useState
} from 'react'

import type {
  EntityId,
  LearningRecovery
} from '../types'

import type {
  AttendanceWorkspaceSnapshot,
  CreateWorkspaceRecoveryInput
} from './attendanceWorkspaceRepository'

import {
  getLearningRecoveryOutcomeLabel,
  summarizeLearningRecoveryAttempts,
  type LearningRecoveryOutcome
} from './learningRecoveryAttempts'

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

type Props = {
  snapshot: AttendanceWorkspaceSnapshot
  loading?: boolean
  onCreateAttempt: (
    input: CreateWorkspaceRecoveryInput
  ) => Promise<void> | void
  onSetOutcome: (
    recoveryId: EntityId,
    outcome: LearningRecoveryOutcome
  ) => Promise<void> | void
  onReferToExam: (
    moduleId: EntityId,
    studentId: EntityId
  ) => Promise<void> | void
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
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

function outcomeClass(
  recovery: LearningRecovery & {
    outcome?: LearningRecoveryOutcome | null
  }
) {
  if (recovery.outcome === 'successful') {
    return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  }

  if (recovery.outcome === 'unsuccessful') {
    return 'border-rose-300/20 bg-rose-300/10 text-rose-100'
  }

  return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
}

export default function RecoveryAttemptsPanel({
  snapshot,
  loading = false,
  onCreateAttempt,
  onSetOutcome,
  onReferToExam
}: Props) {
  const [busyAction, setBusyAction] =
    useState<string | null>(null)
  const [feedback, setFeedback] =
    useState<Feedback>(null)

  const rows =
    snapshot.rows.filter(
      row =>
        row.recoveryHistory.length > 0
    )

  if (
    !snapshot.selectedAssignment ||
    !snapshot.selectedModule ||
    rows.length === 0
  ) {
    return null
  }

  async function runAction(
    actionId: string,
    action: () => Promise<void> | void,
    successMessage: string
  ) {
    if (busyAction) {
      return
    }

    setBusyAction(actionId)
    setFeedback(null)

    try {
      await action()
      setFeedback({
        tone: 'success',
        message: successMessage
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar as tentativas de recuperação.'
      })
    } finally {
      setBusyAction(null)
    }
  }

  const busy =
    loading || Boolean(busyAction)

  return (
    <section className="rounded-[2rem] border border-violet-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
          Tentativas de recuperação
        </p>
        <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
          Até 3 tentativas por aluno
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Cada recuperação concluída deve ser classificada como “Com sucesso” ou “Sem sucesso”. Uma nova tentativa só fica disponível depois de uma tentativa sem sucesso. Após três tentativas sem sucesso, pode encaminhar o aluno para exame.
        </p>
      </div>

      {feedback ? (
        <div
          role="status"
          className={`mt-5 rounded-2xl border p-4 text-sm leading-6 ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {rows.map(row => {
          const summary =
            summarizeLearningRecoveryAttempts(
              row.recoveryHistory
            )

          return (
            <article
              key={row.student.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                    N.º {row.student.number}
                  </p>
                  <h3 className="mt-1 text-base font-black text-white">
                    {row.student.name}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {summary.attemptCount}/3 tentativa(s) registada(s)
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {summary.hasSuccessfulAttempt ? (
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-100">
                      Recuperação concluída com sucesso
                    </span>
                  ) : null}

                  {summary.referredToExamAt ? (
                    <span className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
                      Encaminhado para exame
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {summary.attempts.map((attempt, index) => (
                  <div
                    key={attempt.id}
                    className="rounded-xl border border-white/10 bg-slate-950/55 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-white">
                          Tentativa {index + 1}
                        </p>
                        <p className="mt-1 text-[0.68rem] leading-5 text-slate-500">
                          {attempt.status === 'completed'
                            ? `Concluída em ${formatDateTime(attempt.completedAt)}`
                            : attempt.status === 'in_progress'
                              ? 'Em curso'
                              : 'Pendente'}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.08em] ${outcomeClass(attempt)}`}
                      >
                        {getLearningRecoveryOutcomeLabel(
                          attempt.outcome
                        )}
                      </span>
                    </div>

                    {attempt.status === 'completed' &&
                    !attempt.outcome &&
                    !attempt.referredToExamAt ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `outcome-success-${attempt.id}`,
                              () =>
                                onSetOutcome(
                                  attempt.id,
                                  'successful'
                                ),
                              `A tentativa ${index + 1} de ${row.student.name} foi marcada com sucesso.`
                            )
                          }
                          className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-2 text-[0.68rem] font-black text-emerald-100 transition hover:bg-emerald-300/10 disabled:opacity-50"
                        >
                          Com sucesso
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              `outcome-fail-${attempt.id}`,
                              () =>
                                onSetOutcome(
                                  attempt.id,
                                  'unsuccessful'
                                ),
                              `A tentativa ${index + 1} de ${row.student.name} foi marcada sem sucesso.`
                            )
                          }
                          className="rounded-lg border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-[0.68rem] font-black text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50"
                        >
                          Sem sucesso
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {summary.canCreateNextAttempt &&
                summary.nextAttemptNumber ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void runAction(
                        `create-${row.student.id}`,
                        () =>
                          onCreateAttempt({
                            academicYearId:
                              snapshot.academicYear.id,
                            teachingAssignmentId:
                              snapshot.selectedAssignment!.id,
                            moduleId:
                              snapshot.selectedModule!.id,
                            studentId:
                              row.student.id,
                            status: 'pending'
                          }),
                        `A tentativa ${summary.nextAttemptNumber} de ${row.student.name} foi criada.`
                      )
                    }
                    className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-50"
                  >
                    Iniciar tentativa {summary.nextAttemptNumber}
                  </button>
                ) : null}

                {summary.canReferToExam ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Encaminhar ${row.student.name} para exame após três tentativas de recuperação sem sucesso?`
                        )
                      ) {
                        return
                      }

                      void runAction(
                        `exam-${row.student.id}`,
                        () =>
                          onReferToExam(
                            snapshot.selectedModule!.id,
                            row.student.id
                          ),
                        `${row.student.name} foi encaminhado para exame.`
                      )
                    }}
                    className="rounded-xl border border-violet-300/25 bg-violet-300/[0.08] px-4 py-2.5 text-xs font-black text-violet-100 transition hover:bg-violet-300/12 disabled:opacity-50"
                  >
                    Encaminhar para exame
                  </button>
                ) : null}
              </div>

              {summary.referredToExamAt ? (
                <p className="mt-3 text-xs leading-5 text-violet-200/80">
                  Encaminhamento registado em {formatDateTime(summary.referredToExamAt)}.
                </p>
              ) : null}
            </article>
          )
        })}
      </div>
    </section>
  )
}
