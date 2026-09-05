import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  hasMAProfessorDirtyDraftRecord,
  reconcileMAProfessorDraftRecord
} from '../navigation/draftReconciliation'

import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'

import type {
  EntityId,
  ISODate
} from '../types'

import {
  type AssessmentWorkspaceFilters,
  type AssessmentWorkspaceSnapshot,
  type SaveModuleFinalGradeInput
} from './assessmentWorkspaceRepository'

interface AssessmentWorkspaceViewProps {
  snapshot: AssessmentWorkspaceSnapshot
  loading?: boolean
  error?: string
  onRefresh?: () => void
  onFiltersChange: (
    filters: AssessmentWorkspaceFilters
  ) => void
  onLessonSelect?: (
    lessonId: EntityId
  ) => void
  onSaveFinalGrade: (
    input: SaveModuleFinalGradeInput
  ) => Promise<void> | void
}

interface GradeDraft {
  finalGrade: string
  note: string
}

type GradeDrafts = Record<
  EntityId,
  GradeDraft
>

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

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

function formatDate(
  value: ISODate
) {
  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }
  ).format(
    parseISODate(
      value
    )
  )
}

function formatScore(
  value: number | null
) {
  if (
    value ===
    null
  ) {
    return '—'
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits:
        0,
      maximumFractionDigits:
        2
    }
  ).format(
    value
  )
}

function getSubjectLabel(
  snapshot:
    AssessmentWorkspaceSnapshot
) {
  const subject =
    snapshot.selectedSubject

  if (
    !subject
  ) {
    return 'Sem disciplina selecionada'
  }

  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function buildGradeDrafts(
  snapshot:
    AssessmentWorkspaceSnapshot
): GradeDrafts {
  return Object.fromEntries(
    snapshot.studentRows.map(
      (
        row
      ) => {
        const confirmedGrade =
          row.gradeSummary
            .confirmedFinalGrade

        const suggestedGrade =
          row.gradeSummary
            .suggestedGrade

        return [
          row.student.id,
          {
            finalGrade:
              confirmedGrade !==
              null
                ? String(
                    confirmedGrade
                  )
                : suggestedGrade !==
                    null
                  ? String(
                      suggestedGrade
                    )
                  : '',

            note:
              row.finalGradeRecord
                ?.note ??
              ''
          }
        ]
      }
    )
  ) as GradeDrafts
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

export default function AssessmentWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onLessonSelect,
  onSaveFinalGrade
}: AssessmentWorkspaceViewProps) {
  const rootRef =
    useRef<HTMLDivElement>(
      null
    )

  const persistedGradeDrafts =
    useMemo(
      () =>
        buildGradeDrafts(
          snapshot
        ),
      [
        snapshot.generatedAt
      ]
    )

  const previousPersistedGradeDraftsRef =
    useRef<GradeDrafts>(
      persistedGradeDrafts
    )

  const discardOnNextSnapshotRef =
    useRef(false)

  const [
    gradeDrafts,
    setGradeDrafts
  ] =
    useState<GradeDrafts>(
      () =>
        persistedGradeDrafts
    )

  const [
    savingStudentId,
    setSavingStudentId
  ] =
    useState<EntityId | null>(
      null
    )

  const [
    feedback,
    setFeedback
  ] =
    useState<Feedback>(
      null
    )

  useEffect(() => {
    const previousPersisted =
      previousPersistedGradeDraftsRef.current

    setGradeDrafts(
      current =>
        discardOnNextSnapshotRef.current
          ? persistedGradeDrafts
          : reconcileMAProfessorDraftRecord(
              previousPersisted,
              current,
              persistedGradeDrafts
            )
    )

    discardOnNextSnapshotRef.current =
      false

    previousPersistedGradeDraftsRef.current =
      persistedGradeDrafts
  }, [
    persistedGradeDrafts,
    snapshot.generatedAt
  ])

  const hasAssessmentUnsavedChanges =
    useMemo(
      () =>
        hasMAProfessorDirtyDraftRecord(
          persistedGradeDrafts,
          gradeDrafts
        ),
      [
        gradeDrafts,
        persistedGradeDrafts
      ]
    )

  function confirmDiscardUnsavedChanges() {
    return (
      !hasAssessmentUnsavedChanges ||
      window.confirm(
        'Existem classificações ou observações por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
      )
    )
  }

  useMAProfessorUnsavedWorkspaceProtection(
    hasAssessmentUnsavedChanges,
    rootRef,
    'Existem classificações ou observações por guardar. Se sair deste ecrã, essas alterações serão perdidas. Pretende continuar?'
  )

  function updateGradeDraft(
    studentId: EntityId,
    changes:
      Partial<GradeDraft>
  ) {
    setGradeDrafts(
      (
        current
      ) => ({
        ...current,

        [studentId]: {
          finalGrade:
            current[
              studentId
            ]?.finalGrade ??
            '',

          note:
            current[
              studentId
            ]?.note ??
            '',

          ...changes
        }
      })
    )
  }

  function handleAssignmentChange(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    if (
      !confirmDiscardUnsavedChanges()
    ) {
      return
    }

    discardOnNextSnapshotRef.current =
      true

    setFeedback(
      null
    )

    onFiltersChange({
      teachingAssignmentId:
        event.target.value ||
        null,

      moduleId:
        null
    })
  }

  function handleModuleChange(
    event:
      ChangeEvent<HTMLSelectElement>
  ) {
    if (
      !confirmDiscardUnsavedChanges()
    ) {
      return
    }

    discardOnNextSnapshotRef.current =
      true

    setFeedback(
      null
    )

    onFiltersChange({
      teachingAssignmentId:
        snapshot.filters
          .teachingAssignmentId,

      moduleId:
        event.target.value ||
        null
    })
  }

  function handleRefresh() {
    if (
      !onRefresh ||
      !confirmDiscardUnsavedChanges()
    ) {
      return
    }

    discardOnNextSnapshotRef.current =
      true

    onRefresh()
  }

  function handleLessonSelect(
    lessonId: EntityId
  ) {
    if (
      !onLessonSelect ||
      !confirmDiscardUnsavedChanges()
    ) {
      return
    }

    onLessonSelect(
      lessonId
    )
  }

  async function saveFinalGrade(
    studentId: EntityId,
    studentName: string
  ) {
    if (
      savingStudentId
    ) {
      return
    }

    const moduleId =
      snapshot.selectedModule
        ?.id

    if (
      !moduleId
    ) {
      setFeedback({
        tone: 'error',
        message:
          'Selecione uma UFCD válida antes de guardar a classificação final.'
      })

      return
    }

    const draft =
      gradeDrafts[
        studentId
      ] ?? {
        finalGrade: '',
        note: ''
      }

    const normalizedValue =
      draft.finalGrade.trim()

    const finalGrade =
      normalizedValue
        ? Number(
            normalizedValue
          )
        : null

    if (
      finalGrade !==
        null &&
      (
        !Number.isInteger(
          finalGrade
        ) ||
        finalGrade < 0 ||
        finalGrade > 20
      )
    ) {
      setFeedback({
        tone: 'error',
        message:
          `A classificação final de ${studentName} deve ser um número inteiro entre 0 e 20 valores.`
      })

      return
    }

    setSavingStudentId(
      studentId
    )

    setFeedback(
      null
    )

    try {
      await onSaveFinalGrade({
        moduleId,
        studentId,
        finalGrade,
        note:
          draft.note
      })

      setFeedback({
        tone: 'success',
        message:
          finalGrade ===
          null
            ? `A classificação final de ${studentName} foi removida.`
            : `A classificação final de ${studentName} foi guardada.`
      })
    } catch (
      saveError
    ) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível guardar a classificação final.'
      })
    } finally {
      setSavingStudentId(
        null
      )
    }
  }

  const subjectLabel =
    getSubjectLabel(
      snapshot
    )

  const moduleLabel =
    snapshot.moduleOptions.find(
      (
        option
      ) =>
        option.module.id ===
        snapshot.selectedModule
          ?.id
    )?.label ??
    'Sem UFCD selecionada'

  return (
    <div
      ref={
        rootRef
      }
      className="space-y-6"
    >
      <section className="overflow-hidden rounded-[2rem] border border-amber-300/15 bg-slate-950/75 shadow-2xl shadow-amber-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-amber-100">
                  Avaliações
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Classificações por UFCD
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Consulte as atividades, acompanhe as médias por critério e confirme a classificação final de cada aluno.
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleRefresh
              }
              disabled={
                loading ||
                !onRefresh
              }
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
            >
              {loading
                ? 'A atualizar...'
                : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 sm:px-7 xl:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Turma e disciplina
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
                loading ||
                snapshot.assignmentOptions
                  .length === 0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {snapshot.assignmentOptions
                .length === 0 ? (
                <option value="">
                  Sem turmas disponíveis
                </option>
              ) : null}

              {snapshot.assignmentOptions.map(
                (
                  option
                ) => (
                  <option
                    key={
                      option.assignment.id
                    }
                    value={
                      option.assignment.id
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-slate-200">
              UFCD ou módulo
            </span>

            <select
              value={
                snapshot.filters
                  .moduleId ??
                ''
              }
              onChange={
                handleModuleChange
              }
              disabled={
                loading ||
                snapshot.moduleOptions
                  .length === 0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/50 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {snapshot.moduleOptions
                .length === 0 ? (
                <option value="">
                  Sem UFCD disponíveis
                </option>
              ) : null}

              {snapshot.moduleOptions.map(
                (
                  option
                ) => (
                  <option
                    key={
                      option.module.id
                    }
                    value={
                      option.module.id
                    }
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
          className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
        >
          <p className="leading-6">
            {error}
          </p>

          {onRefresh ? (
            <button
              type="button"
              onClick={
                handleRefresh
              }
              disabled={
                loading
              }
              className="rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-bold text-rose-50 transition hover:bg-rose-200/15 disabled:cursor-wait disabled:opacity-50"
            >
              Tentar novamente
            </button>
          ) : null}
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

      {hasAssessmentUnsavedChanges ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm font-bold text-amber-100">
          Existem classificações ou observações por guardar.
        </div>
      ) : null}

      {!snapshot.selectedAssignment ||
      !snapshot.selectedModule ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem dados de avaliação disponíveis.
          </p>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirme se a configuração inicial possui turmas, disciplinas, UFCD, alunos e critérios de avaliação ativos.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Atividades"
              value={
                snapshot.totals
                  .activityCount
              }
              detail="Avaliações registadas nesta UFCD."
              className="border-cyan-300/15 bg-cyan-300/[0.035]"
            />

            <MetricCard
              label="Completas"
              value={
                snapshot.totals
                  .completeActivityCount
              }
              detail="Com classificação para toda a turma."
              className="border-emerald-300/15 bg-emerald-300/[0.035]"
            />

            <MetricCard
              label="Por preencher"
              value={
                snapshot.totals
                  .incompleteActivityCount
              }
              detail="Atividades ainda incompletas."
              className="border-amber-300/15 bg-amber-300/[0.035]"
            />

            <MetricCard
              label="Média da turma"
              value={
                formatScore(
                  snapshot.totals
                    .classAverage
                )
              }
              detail="Média provisória dos alunos avaliados."
              className="border-violet-300/15 bg-violet-300/[0.035]"
            />

            <MetricCard
              label="Notas finais"
              value={`${snapshot.totals.confirmedGradeCount}/${snapshot.totals.studentCount}`}
              detail="Classificações finais confirmadas."
              className="border-fuchsia-300/15 bg-fuchsia-300/[0.035]"
            />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
                  Critérios e ponderações
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  {subjectLabel}
                </h2>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {snapshot.selectedGroup?.name}{' '}
                  · {moduleLabel}
                </p>
              </div>

              {snapshot.scheme ? (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">
                  {snapshot.scheme.name}
                </span>
              ) : null}
            </div>

            {!snapshot.scheme ||
            snapshot.criteria.length ===
              0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <p className="text-sm font-black text-amber-100">
                  Não existem critérios ativos para esta UFCD.
                </p>

                <p className="mt-1 text-xs leading-5 text-amber-100/70">
                  Configure os critérios de avaliação antes de registar ou calcular classificações.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {snapshot.criteria.map(
                  (
                    criterion
                  ) => (
                    <article
                      key={
                        criterion.id
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-6 text-white">
                          {criterion.name}
                        </p>

                        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-100">
                          {formatScore(
                            criterion.weightPercent
                          )}
                          %
                        </span>
                      </div>

                      {criterion.description ? (
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {criterion.description}
                        </p>
                      ) : null}
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                  Atividades da UFCD
                </p>

                <h2 className="mt-3 text-xl font-black text-white">
                  Avaliações registadas
                </h2>
              </div>

              <p className="text-xs text-slate-500">
                {snapshot.totals.activityCount}{' '}
                {snapshot.totals.activityCount ===
                1
                  ? 'atividade'
                  : 'atividades'}
              </p>
            </div>

            {snapshot.activities.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-black text-white">
                  Ainda não existem avaliações nesta UFCD.
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  As atividades são criadas dentro da aula em que foram realizadas.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {snapshot.activities.map(
                  (
                    activity
                  ) => (
                    <article
                      key={
                        activity.assessment.id
                      }
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {activity.assessment.title}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {activity.criterion.name}{' '}
                            · {formatDate(
                              activity.lesson.date
                            )}{' '}
                            · {activity.lesson.startTime}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${
                            activity.complete
                              ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                              : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                          }`}
                        >
                          {activity.complete
                            ? 'Completa'
                            : 'Incompleta'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                            Média
                          </p>

                          <p className="mt-1 text-sm font-black text-white">
                            {formatScore(
                              activity.average
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                            Avaliados
                          </p>

                          <p className="mt-1 text-sm font-black text-cyan-100">
                            {activity.evaluatedCount}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                            Faltas
                          </p>

                          <p className="mt-1 text-sm font-black text-rose-100">
                            {activity.absentCount}
                          </p>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-slate-950/55 p-3">
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                            Dispensados
                          </p>

                          <p className="mt-1 text-sm font-black text-violet-100">
                            {activity.exemptCount}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleLessonSelect(
                            activity.lesson.id
                          )
                        }
                        disabled={
                          !onLessonSelect ||
                          loading
                        }
                        className="mt-4 w-full rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-4 py-2.5 text-xs font-black text-cyan-100 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Abrir aula e classificações
                      </button>
                    </article>
                  )
                )}
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-200">
                Resultados dos alunos
              </p>

              <h2 className="mt-3 text-xl font-black text-white">
                Médias e classificação final
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                A sugestão final só aparece depois de todos os critérios ativos possuírem pelo menos uma avaliação para o aluno.
              </p>
            </div>

            {snapshot.studentRows.length ===
            0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-black text-white">
                  A turma ainda não possui alunos ativos.
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {snapshot.studentRows.map(
                  (
                    row
                  ) => {
                    const draft =
                      gradeDrafts[
                        row.student.id
                      ] ?? {
                        finalGrade: '',
                        note: ''
                      }

                    const saving =
                      savingStudentId ===
                      row.student.id

                    const confirmed =
                      row.gradeSummary
                        .confirmedFinalGrade !==
                      null

                    return (
                      <article
                        key={
                          row.student.id
                        }
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
                            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                              Média{' '}
                              {formatScore(
                                row.gradeSummary
                                  .provisionalAverage
                              )}
                            </span>

                            <span
                              className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                                row.gradeSummary
                                  .allActiveCriteriaAssessed
                                  ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                                  : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                              }`}
                            >
                              {row.gradeSummary
                                .allActiveCriteriaAssessed
                                ? 'Critérios completos'
                                : 'Critérios incompletos'}
                            </span>

                            {confirmed ? (
                              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1.5 text-xs font-black text-violet-100">
                                Final{' '}
                                {formatScore(
                                  row.gradeSummary
                                    .confirmedFinalGrade
                                )}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {row.gradeSummary.criteria.map(
                            (
                              criterion
                            ) => (
                              <div
                                key={
                                  criterion.criterionId
                                }
                                className="rounded-xl border border-white/10 bg-slate-950/50 p-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-bold leading-5 text-slate-300">
                                    {criterion.criterionName}
                                  </p>

                                  <span className="shrink-0 text-[0.65rem] font-black text-amber-200">
                                    {formatScore(
                                      criterion.weightPercent
                                    )}
                                    %
                                  </span>
                                </div>

                                <p className="mt-2 text-lg font-black text-white">
                                  {formatScore(
                                    criterion.average
                                  )}
                                </p>

                                <p className="mt-1 text-[0.65rem] leading-5 text-slate-500">
                                  {criterion.assessmentCount}{' '}
                                  {criterion.assessmentCount ===
                                  1
                                    ? 'atividade'
                                    : 'atividades'}
                                  {' · contribuição '}
                                  {formatScore(
                                    criterion.weightedContribution
                                  )}
                                </p>
                              </div>
                            )
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 xl:grid-cols-[10rem_1fr_auto] xl:items-end">
                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-slate-300">
                              Nota final
                            </span>

                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="1"
                              value={
                                draft.finalGrade
                              }
                              onChange={(
                                event:
                                  ChangeEvent<HTMLInputElement>
                              ) =>
                                updateGradeDraft(
                                  row.student.id,
                                  {
                                    finalGrade:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={
                                saving ||
                                loading
                              }
                              placeholder="0–20"
                              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-slate-300">
                              Observação opcional
                            </span>

                            <input
                              type="text"
                              value={
                                draft.note
                              }
                              onChange={(
                                event:
                                  ChangeEvent<HTMLInputElement>
                              ) =>
                                updateGradeDraft(
                                  row.student.id,
                                  {
                                    note:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={
                                saving ||
                                loading
                              }
                              placeholder="Nota privada sobre a classificação final."
                              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

                          <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                            <button
                              type="button"
                              onClick={() =>
                                updateGradeDraft(
                                  row.student.id,
                                  {
                                    finalGrade:
                                      row.gradeSummary
                                        .suggestedGrade ===
                                      null
                                        ? ''
                                        : String(
                                            row.gradeSummary
                                              .suggestedGrade
                                          )
                                  }
                                )
                              }
                              disabled={
                                saving ||
                                loading ||
                                row.gradeSummary
                                  .suggestedGrade ===
                                null
                              }
                              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Usar sugestão{' '}
                              {formatScore(
                                row.gradeSummary
                                  .suggestedGrade
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void saveFinalGrade(
                                  row.student.id,
                                  row.student.name
                                )
                              }
                              disabled={
                                saving ||
                                loading ||
                                (
                                  !draft.finalGrade.trim() &&
                                  !confirmed
                                )
                              }
                              className="rounded-xl border border-violet-200/30 bg-gradient-to-r from-violet-300 to-fuchsia-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {saving
                                ? 'A guardar...'
                                : draft.finalGrade.trim()
                                  ? 'Guardar nota final'
                                  : 'Limpar nota final'}
                            </button>
                          </div>
                        </div>
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
