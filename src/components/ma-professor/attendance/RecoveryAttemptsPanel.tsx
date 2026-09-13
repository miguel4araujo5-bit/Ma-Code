import {
  useState
} from 'react'

import type {
  AssessmentCriterion,
  EntityId,
  LearningRecovery
} from '../types'

import type {
  AttendanceWorkspaceSnapshot,
  CreateWorkspaceRecoveryInput
} from './attendanceWorkspaceRepository'

import {
  calculateRecoveryAssessmentGrade,
  type LearningRecoveryAssessmentRecord,
  type RecoveryAssessmentScores
} from './recoveryAssessmentRepository'

import {
  getLearningRecoveryOutcomeLabel,
  summarizeLearningRecoveryAttempts,
  type LearningRecoveryOutcome
} from './learningRecoveryAttempts'

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

type AssessmentDrafts =
  Record<
    EntityId,
    Record<EntityId, string>
  >

type Props = {
  snapshot: AttendanceWorkspaceSnapshot
  assessmentCriteria: AssessmentCriterion[]
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
  onSaveAssessment: (
    recoveryId: EntityId,
    scores: RecoveryAssessmentScores
  ) => Promise<void> | void
  onClearAssessment: (
    recoveryId: EntityId
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

function formatScore(
  value: number
) {
  return new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(value)
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

function buildAssessmentDraft(
  recovery: LearningRecovery,
  criteria: AssessmentCriterion[]
) {
  const record =
    recovery as
      LearningRecoveryAssessmentRecord

  return Object.fromEntries(
    criteria.map(
      criterion => [
        criterion.id,
        record.assessmentScores?.[
          criterion.id
        ]?.toString() ?? ''
      ]
    )
  ) as Record<EntityId, string>
}

function parseAssessmentDraft(
  draft: Record<EntityId, string>,
  criteria: AssessmentCriterion[]
): RecoveryAssessmentScores {
  const scores:
    RecoveryAssessmentScores = {}

  for (const criterion of criteria) {
    const raw =
      (draft[criterion.id] ?? '')
        .trim()
        .replace(',', '.')

    if (!raw) {
      throw new Error(
        `Preencha a classificação de “${criterion.name}”.`
      )
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
      throw new Error(
        `A classificação de “${criterion.name}” deve estar entre 0 e 20 valores.`
      )
    }

    const score = Number(raw)

    if (
      !Number.isFinite(score) ||
      score < 0 ||
      score > 20
    ) {
      throw new Error(
        `A classificação de “${criterion.name}” deve estar entre 0 e 20 valores.`
      )
    }

    scores[criterion.id] = score
  }

  return scores
}

function getCurrentAssessmentGrade(
  recovery: LearningRecovery,
  criteria: AssessmentCriterion[]
) {
  const record =
    recovery as
      LearningRecoveryAssessmentRecord

  if (
    record.status !== 'completed' ||
    !record.completedAt ||
    !record.assessmentRecordedAt ||
    record.assessmentRecordedAt <
      record.completedAt
  ) {
    return null
  }

  return calculateRecoveryAssessmentGrade(
    criteria,
    record.assessmentScores
  )
}

export default function RecoveryAttemptsPanel({
  snapshot,
  assessmentCriteria,
  loading = false,
  onCreateAttempt,
  onSetOutcome,
  onReferToExam,
  onSaveAssessment,
  onClearAssessment
}: Props) {
  const [busyAction, setBusyAction] =
    useState<string | null>(null)
  const [feedback, setFeedback] =
    useState<Feedback>(null)
  const [assessmentEditorId, setAssessmentEditorId] =
    useState<EntityId | null>(null)
  const [assessmentDrafts, setAssessmentDrafts] =
    useState<AssessmentDrafts>({})

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
      return false
    }

    setBusyAction(actionId)
    setFeedback(null)

    try {
      await action()
      setFeedback({
        tone: 'success',
        message: successMessage
      })
      return true
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível atualizar as tentativas de recuperação.'
      })
      return false
    } finally {
      setBusyAction(null)
    }
  }

  function openAssessmentEditor(
    recovery: LearningRecovery
  ) {
    setAssessmentDrafts(
      current => ({
        ...current,
        [recovery.id]:
          buildAssessmentDraft(
            recovery,
            assessmentCriteria
          )
      })
    )
    setAssessmentEditorId(
      recovery.id
    )
    setFeedback(null)
  }

  function updateAssessmentDraft(
    recoveryId: EntityId,
    criterionId: EntityId,
    value: string
  ) {
    setAssessmentDrafts(
      current => ({
        ...current,
        [recoveryId]: {
          ...(current[recoveryId] ?? {}),
          [criterionId]: value
        }
      })
    )
  }

  async function saveAssessment(
    recovery: LearningRecovery,
    studentName: string,
    attemptNumber: number
  ) {
    let scores:
      RecoveryAssessmentScores

    try {
      scores =
        parseAssessmentDraft(
          assessmentDrafts[recovery.id] ?? {},
          assessmentCriteria
        )
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Não foi possível validar as classificações da recuperação.'
      })
      return
    }

    const saved =
      await runAction(
        `assessment-save-${recovery.id}`,
        () =>
          onSaveAssessment(
            recovery.id,
            scores
          ),
        `A tentativa ${attemptNumber} de ${studentName} passou a contar como avaliação adicional.`
      )

    if (saved) {
      setAssessmentEditorId(null)
    }
  }

  async function clearAssessment(
    recovery: LearningRecovery,
    studentName: string,
    attemptNumber: number
  ) {
    if (
      !window.confirm(
        `Retirar a tentativa ${attemptNumber} de ${studentName} da avaliação? A recuperação e o seu histórico serão preservados.`
      )
    ) {
      return
    }

    const cleared =
      await runAction(
        `assessment-clear-${recovery.id}`,
        () =>
          onClearAssessment(
            recovery.id
          ),
        `A tentativa ${attemptNumber} de ${studentName} deixou de contar na avaliação.`
      )

    if (cleared) {
      setAssessmentEditorId(null)
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
        <p className="mt-2 text-sm leading-7 text-slate-500">
          Uma recuperação concluída não altera notas automaticamente. Se pretender, pode usá-la explicitamente como avaliação adicional, atribuindo uma classificação de 0 a 20 em todos os critérios ativos.
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
                {summary.attempts.map((attempt, index) => {
                  const assessmentGrade =
                    getCurrentAssessmentGrade(
                      attempt,
                      assessmentCriteria
                    )

                  const editingAssessment =
                    assessmentEditorId ===
                    attempt.id

                  return (
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

                      {attempt.status === 'completed' &&
                      assessmentCriteria.length > 0 ? (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          {assessmentGrade !== null ? (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-[0.62rem] font-black text-cyan-100">
                                Conta na avaliação · {formatScore(assessmentGrade)}/20
                              </span>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    openAssessmentEditor(
                                      attempt
                                    )
                                  }
                                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.65rem] font-black text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                                >
                                  Alterar
                                </button>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void clearAssessment(
                                      attempt,
                                      row.student.name,
                                      index + 1
                                    )
                                  }
                                  className="rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2 text-[0.65rem] font-black text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50"
                                >
                                  Retirar
                                </button>
                              </div>
                            </div>
                          ) : !editingAssessment ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                openAssessmentEditor(
                                  attempt
                                )
                              }
                              className="w-full rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2.5 text-[0.68rem] font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:opacity-50"
                            >
                              Usar como avaliação adicional
                            </button>
                          ) : null}

                          {editingAssessment ? (
                            <div className="mt-3 space-y-3 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.025] p-3">
                              <p className="text-[0.68rem] leading-5 text-slate-400">
                                Esta avaliação é opcional. Só será guardada quando todos os critérios tiverem uma classificação válida.
                              </p>

                              {assessmentCriteria.map(
                                criterion => (
                                  <label
                                    key={criterion.id}
                                    className="block"
                                  >
                                    <span className="mb-1.5 flex items-center justify-between gap-2 text-[0.65rem] font-bold text-slate-300">
                                      <span>
                                        {criterion.name}
                                      </span>
                                      <span className="text-slate-600">
                                        {criterion.weightPercent}%
                                      </span>
                                    </span>

                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={
                                        assessmentDrafts[
                                          attempt.id
                                        ]?.[
                                          criterion.id
                                        ] ?? ''
                                      }
                                      onChange={event =>
                                        updateAssessmentDraft(
                                          attempt.id,
                                          criterion.id,
                                          event.target.value
                                        )
                                      }
                                      disabled={busy}
                                      placeholder="0–20"
                                      className="w-full rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm font-bold text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10 disabled:opacity-50"
                                    />
                                  </label>
                                )
                              )}

                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    setAssessmentEditorId(null)
                                  }
                                  className="rounded-lg border border-white/10 px-3 py-2 text-[0.65rem] font-black text-slate-400 disabled:opacity-50"
                                >
                                  Cancelar
                                </button>

                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void saveAssessment(
                                      attempt,
                                      row.student.name,
                                      index + 1
                                    )
                                  }
                                  className="rounded-lg bg-cyan-300 px-3 py-2 text-[0.65rem] font-black text-slate-950 disabled:opacity-50"
                                >
                                  {busyAction ===
                                  `assessment-save-${attempt.id}`
                                    ? 'A guardar…'
                                    : 'Guardar avaliação'}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
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
