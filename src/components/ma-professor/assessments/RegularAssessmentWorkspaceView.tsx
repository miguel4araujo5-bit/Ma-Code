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

import type {
  AssessmentWorkspaceFilters,
  AssessmentWorkspaceSnapshot,
  SaveModuleFinalGradeInput
} from './assessmentWorkspaceRepository'

import {
  getSummativeAssessmentScale,
  validateSummativeNumericValue
} from './regularAssessmentScale'

export interface RegularAssessmentWorkspaceViewProps {
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

type GradeDraft = {
  finalGrade: string
  selfAssessmentGrade: string
  usesAcs: boolean
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
    parseISODate(value)
  )
}

function formatScore(
  value: number | null
) {
  if (value === null) {
    return '—'
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(value)
}

function buildGradeDrafts(
  snapshot: AssessmentWorkspaceSnapshot
): GradeDrafts {
  return Object.fromEntries(
    snapshot.studentRows.map(row => [
      row.student.id,
      {
        finalGrade:
          row.gradeSummary
            .confirmedFinalGrade === null
            ? ''
            : String(
                row.gradeSummary
                  .confirmedFinalGrade
              ),
        selfAssessmentGrade:
          row.finalGradeRecord
            ?.selfAssessmentGrade === null ||
          row.finalGradeRecord
            ?.selfAssessmentGrade === undefined
            ? ''
            : String(
                row.finalGradeRecord
                  .selfAssessmentGrade
              ),
        usesAcs:
          row.finalGradeRecord
            ?.usesAcs ?? false,
        note:
          row.finalGradeRecord
            ?.note ?? ''
      }
    ])
  ) as GradeDrafts
}

function getSubjectLabel(
  snapshot: AssessmentWorkspaceSnapshot
) {
  const subject =
    snapshot.selectedSubject

  if (!subject) {
    return 'Disciplina'
  }

  return (
    subject.shortName.trim() ||
    subject.name
  )
}

function MetricCard({
  label,
  value,
  detail
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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

export default function RegularAssessmentWorkspaceView({
  snapshot,
  loading = false,
  error = '',
  onRefresh,
  onFiltersChange,
  onLessonSelect,
  onSaveFinalGrade
}: RegularAssessmentWorkspaceViewProps) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const scale =
    getSummativeAssessmentScale(
      snapshot.selectedGroup
    )

  const persistedDrafts =
    useMemo(
      () => buildGradeDrafts(snapshot),
      [snapshot.generatedAt]
    )

  const previousPersistedDraftsRef =
    useRef<GradeDrafts>(
      persistedDrafts
    )

  const discardOnNextSnapshotRef =
    useRef(false)

  const [
    gradeDrafts,
    setGradeDrafts
  ] = useState<GradeDrafts>(
    () => persistedDrafts
  )

  const [
    savingStudentId,
    setSavingStudentId
  ] = useState<EntityId | null>(
    null
  )

  const [
    feedback,
    setFeedback
  ] = useState<Feedback>(null)

  useEffect(() => {
    const previousPersisted =
      previousPersistedDraftsRef.current

    setGradeDrafts(current =>
      discardOnNextSnapshotRef.current
        ? persistedDrafts
        : reconcileMAProfessorDraftRecord(
            previousPersisted,
            current,
            persistedDrafts
          )
    )

    discardOnNextSnapshotRef.current = false
    previousPersistedDraftsRef.current =
      persistedDrafts
  }, [
    persistedDrafts,
    snapshot.generatedAt
  ])

  const hasUnsavedChanges =
    useMemo(
      () =>
        hasMAProfessorDirtyDraftRecord(
          persistedDrafts,
          gradeDrafts
        ),
      [
        gradeDrafts,
        persistedDrafts
      ]
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedChanges,
    rootRef,
    'Existem classificações ou observações por guardar. Se sair deste ecrã, essas alterações serão perdidas. Pretende continuar?'
  )

  function confirmDiscard() {
    return (
      !hasUnsavedChanges ||
      window.confirm(
        'Existem classificações ou observações por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
      )
    )
  }

  function handleAssignmentChange(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    if (!confirmDiscard()) {
      return
    }

    discardOnNextSnapshotRef.current = true
    setFeedback(null)

    onFiltersChange({
      teachingAssignmentId:
        event.target.value || null,
      moduleId: null
    })
  }

  function handleRefresh() {
    if (
      !onRefresh ||
      !confirmDiscard()
    ) {
      return
    }

    discardOnNextSnapshotRef.current = true
    onRefresh()
  }

  function handleLessonSelect(
    lessonId: EntityId
  ) {
    if (
      !onLessonSelect ||
      !confirmDiscard()
    ) {
      return
    }

    onLessonSelect(lessonId)
  }

  function updateDraft(
    studentId: EntityId,
    changes: Partial<GradeDraft>
  ) {
    setGradeDrafts(current => ({
      ...current,
      [studentId]: {
        finalGrade:
          current[studentId]
            ?.finalGrade ?? '',
        selfAssessmentGrade:
          current[studentId]
            ?.selfAssessmentGrade ?? '',
        usesAcs:
          current[studentId]
            ?.usesAcs ?? false,
        note:
          current[studentId]
            ?.note ?? '',
        ...changes
      }
    }))
  }

  async function saveFinalGrade(
    studentId: EntityId,
    studentName: string
  ) {
    if (
      savingStudentId ||
      !snapshot.selectedModule
    ) {
      return
    }

    if (
      scale.kind === 'qualitative' ||
      scale.kind === 'unsupported'
    ) {
      setFeedback({
        tone: 'error',
        message: scale.description
      })
      return
    }

    const draft =
      gradeDrafts[studentId] ?? {
        finalGrade: '',
        selfAssessmentGrade: '',
        usesAcs: false,
        note: ''
      }

    const finalGrade =
      draft.finalGrade.trim()
        ? Number(draft.finalGrade)
        : null

    const selfAssessmentGrade =
      draft.selfAssessmentGrade.trim()
        ? Number(
            draft.selfAssessmentGrade
          )
        : null

    try {
      if (finalGrade !== null) {
        validateSummativeNumericValue(
          snapshot.selectedGroup,
          finalGrade,
          'classificação final'
        )
      }

      if (
        selfAssessmentGrade !== null
      ) {
        validateSummativeNumericValue(
          snapshot.selectedGroup,
          selfAssessmentGrade,
          'autoavaliação'
        )
      }
    } catch (validationError) {
      setFeedback({
        tone: 'error',
        message:
          validationError instanceof Error
            ? validationError.message
            : 'A classificação indicada não é válida.'
      })
      return
    }

    setSavingStudentId(studentId)
    setFeedback(null)

    try {
      await onSaveFinalGrade({
        moduleId:
          snapshot.selectedModule.id,
        studentId,
        finalGrade,
        selfAssessmentGrade,
        usesAcs: draft.usesAcs,
        note: draft.note
      })

      setFeedback({
        tone: 'success',
        message:
          finalGrade === null
            ? `A avaliação final de ${studentName} foi atualizada.`
            : `A avaliação final de ${studentName} foi guardada.`
      })
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível guardar a avaliação final.'
      })
    } finally {
      setSavingStudentId(null)
    }
  }

  const subjectLabel =
    getSubjectLabel(snapshot)

  return (
    <div
      ref={rootRef}
      className="space-y-6"
    >
      <section className="overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-slate-950/75 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-6 sm:px-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.14em] text-emerald-100">
                  Avaliações · Ensino regular
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-bold text-slate-400">
                  {snapshot.academicYear.name}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Avaliação da disciplina
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                Consulte as atividades e os critérios da disciplina e registe a avaliação sumativa na escala adequada ao ano de escolaridade.
              </p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={
                loading || !onRefresh
              }
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-3 text-sm font-black text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-wait disabled:opacity-50"
            >
              {loading
                ? 'A atualizar...'
                : 'Atualizar'}
            </button>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-7">
          <label className="block max-w-2xl">
            <span className="mb-2 block text-sm font-bold text-slate-200">
              Turma e disciplina
            </span>
            <select
              value={
                snapshot.filters
                  .teachingAssignmentId ?? ''
              }
              onChange={
                handleAssignmentChange
              }
              disabled={
                loading ||
                snapshot.assignmentOptions
                  .length === 0
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {snapshot.assignmentOptions
                .length === 0 ? (
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
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-50"
        >
          {error}
        </div>
      ) : null}

      {feedback ? (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm leading-6 ${
            feedback.tone === 'success'
              ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-50'
              : 'border-rose-300/20 bg-rose-300/[0.07] text-rose-50'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {hasUnsavedChanges ? (
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm font-bold text-amber-100">
          Existem classificações ou observações por guardar.
        </div>
      ) : null}

      {!snapshot.selectedAssignment ||
      !snapshot.selectedGroup ||
      !snapshot.selectedModule ? (
        <section className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/60 p-8 text-center">
          <p className="text-lg font-black text-white">
            Ainda não existem dados de avaliação disponíveis.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirme se a turma, a disciplina, o horário, os alunos e os critérios de avaliação estão configurados.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Atividades"
              value={snapshot.totals.activityCount}
              detail="Avaliações registadas nesta disciplina."
            />
            <MetricCard
              label="Completas"
              value={snapshot.totals.completeActivityCount}
              detail="Com registos para toda a turma."
            />
            <MetricCard
              label="Média das atividades"
              value={
                formatScore(
                  snapshot.totals.classAverage
                )
              }
              detail="Indicador interno das atividades na escala atual de 0–20."
            />
            <MetricCard
              label="Avaliações finais"
              value={`${snapshot.totals.confirmedGradeCount}/${snapshot.totals.studentCount}`}
              detail={scale.description}
            />
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Critérios e ponderações
            </p>
            <h2 className="mt-3 text-xl font-black text-white">
              {subjectLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {snapshot.selectedGroup.name} · componente anual
            </p>

            {snapshot.criteria.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
                Ainda não existem critérios ativos para esta disciplina.
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {snapshot.criteria.map(
                  criterion => (
                    <article
                      key={criterion.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-black leading-6 text-white">
                          {criterion.name}
                        </p>
                        <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-black text-amber-100">
                          {formatScore(
                            criterion.weightPercent
                          )}%
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
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-200">
                  Atividades da disciplina
                </p>
                <h2 className="mt-3 text-xl font-black text-white">
                  Avaliações registadas
                </h2>
              </div>
              <p className="text-xs text-slate-500">
                {snapshot.totals.activityCount} atividade(s)
              </p>
            </div>

            {snapshot.activities.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center">
                <p className="text-sm font-black text-white">
                  Ainda não existem avaliações nesta disciplina.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  As atividades são criadas dentro da aula em que foram realizadas.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {snapshot.activities.map(
                  activity => (
                    <article
                      key={activity.assessment.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">
                            {activity.assessment.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {activity.criterion.name} · {formatDate(activity.lesson.date)} · {activity.lesson.startTime}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${
                          activity.complete
                            ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                            : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                        }`}>
                          {activity.complete
                            ? 'Completa'
                            : 'Incompleta'}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/55 p-3">
                        <div>
                          <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                            Média interna
                          </p>
                          <p className="mt-1 text-sm font-black text-white">
                            {formatScore(activity.average)} / 20
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {activity.evaluatedCount} avaliado(s)
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
                          !onLessonSelect || loading
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

          <section className="rounded-[2rem] border border-emerald-300/15 bg-slate-950/70 p-5 shadow-xl shadow-black/20 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              Fecho da disciplina
            </p>
            <h2 className="mt-3 text-xl font-black text-white">
              Avaliação sumativa
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              {scale.description}
            </p>

            {scale.kind === 'qualitative' ||
            scale.kind === 'unsupported' ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
                {scale.kind === 'qualitative'
                  ? 'O fecho numérico está desativado para esta turma. As atividades e os critérios continuam disponíveis, mas o MA-Professor não transforma automaticamente resultados numéricos numa menção qualitativa.'
                  : scale.description}
              </div>
            ) : snapshot.studentRows.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm font-bold text-slate-400">
                A turma ainda não possui alunos ativos.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {snapshot.studentRows.map(row => {
                  const draft =
                    gradeDrafts[row.student.id] ?? {
                      finalGrade: '',
                      selfAssessmentGrade: '',
                      usesAcs: false,
                      note: ''
                    }

                  const saving =
                    savingStudentId ===
                    row.student.id

                  return (
                    <article
                      key={row.student.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="min-w-0 xl:w-72">
                          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                            N.º {row.student.number}
                          </p>
                          <p className="mt-1 truncate text-sm font-black text-white">
                            {row.student.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Média interna das atividades: {formatScore(row.gradeSummary.provisionalAverage)} / 20
                          </p>
                        </div>

                        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-[8rem_8rem_1fr_auto]">
                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-slate-300">
                              {scale.inputLabel}
                            </span>
                            <input
                              type="number"
                              min={scale.min ?? undefined}
                              max={scale.max ?? undefined}
                              step="1"
                              value={draft.finalGrade}
                              onChange={event =>
                                updateDraft(
                                  row.student.id,
                                  {
                                    finalGrade:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={saving || loading}
                              placeholder={scale.placeholder}
                              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-slate-300">
                              Autoavaliação
                            </span>
                            <input
                              type="number"
                              min={scale.min ?? undefined}
                              max={scale.max ?? undefined}
                              step="1"
                              value={draft.selfAssessmentGrade}
                              onChange={event =>
                                updateDraft(
                                  row.student.id,
                                  {
                                    selfAssessmentGrade:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={saving || loading}
                              placeholder={scale.placeholder}
                              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-2 block text-xs font-bold text-slate-300">
                              Observação opcional
                            </span>
                            <input
                              type="text"
                              value={draft.note}
                              onChange={event =>
                                updateDraft(
                                  row.student.id,
                                  {
                                    note:
                                      event.target.value
                                  }
                                )
                              }
                              disabled={saving || loading}
                              placeholder="Nota privada sobre a avaliação final."
                              className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                            />
                          </label>

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
                                row.gradeSummary
                                  .confirmedFinalGrade === null
                              )
                            }
                            className="rounded-xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {saving
                              ? 'A guardar...'
                              : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
