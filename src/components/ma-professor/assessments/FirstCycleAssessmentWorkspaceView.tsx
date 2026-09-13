import {
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
  FirstCycleQualitativeGrade
} from '../types'

import RegularAssessmentWorkspaceView, {
  type RegularAssessmentWorkspaceViewProps
} from './RegularAssessmentWorkspaceView'

import {
  FIRST_CYCLE_QUALITATIVE_GRADES
} from './regularAssessmentScale'

type QualitativeDraft = {
  qualitativeFinalGrade:
    FirstCycleQualitativeGrade | ''
  descriptiveAssessment: string
}

type QualitativeDrafts = Record<
  EntityId,
  QualitativeDraft
>

type Feedback = {
  tone: 'success' | 'error'
  message: string
} | null

function buildDrafts(
  snapshot:
    RegularAssessmentWorkspaceViewProps['snapshot']
): QualitativeDrafts {
  return Object.fromEntries(
    snapshot.studentRows.map(row => [
      row.student.id,
      {
        qualitativeFinalGrade:
          row.finalGradeRecord
            ?.qualitativeFinalGrade ?? '',
        descriptiveAssessment:
          row.finalGradeRecord
            ?.descriptiveAssessment ?? ''
      }
    ])
  ) as QualitativeDrafts
}

function QualitativeClosurePanel({
  snapshot,
  loading = false,
  onSaveFinalGrade
}: Pick<
  RegularAssessmentWorkspaceViewProps,
  'snapshot' | 'loading' | 'onSaveFinalGrade'
>) {
  const rootRef =
    useRef<HTMLDivElement>(null)

  const persistedDrafts =
    useMemo(
      () => buildDrafts(snapshot),
      [snapshot.generatedAt]
    )

  const previousPersistedDraftsRef =
    useRef<QualitativeDrafts>(
      persistedDrafts
    )

  const [drafts, setDrafts] =
    useState<QualitativeDrafts>(
      () => persistedDrafts
    )

  const [savingStudentId, setSavingStudentId] =
    useState<EntityId | null>(null)

  const [feedback, setFeedback] =
    useState<Feedback>(null)

  useEffect(() => {
    const previousPersisted =
      previousPersistedDraftsRef.current

    setDrafts(current =>
      reconcileMAProfessorDraftRecord(
        previousPersisted,
        current,
        persistedDrafts
      )
    )

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
          drafts
        ),
      [drafts, persistedDrafts]
    )

  useMAProfessorUnsavedWorkspaceProtection(
    hasUnsavedChanges,
    rootRef,
    'Existem menções ou apreciações descritivas por guardar. Se continuar, essas alterações serão perdidas. Pretende continuar?'
  )

  if (
    !snapshot.selectedModule ||
    !snapshot.selectedGroup
  ) {
    return null
  }

  function updateDraft(
    studentId: EntityId,
    changes: Partial<QualitativeDraft>
  ) {
    setDrafts(current => ({
      ...current,
      [studentId]: {
        qualitativeFinalGrade:
          current[studentId]
            ?.qualitativeFinalGrade ?? '',
        descriptiveAssessment:
          current[studentId]
            ?.descriptiveAssessment ?? '',
        ...changes
      }
    }))
    setFeedback(null)
  }

  async function saveStudent(
    studentId: EntityId,
    studentName: string
  ) {
    if (
      savingStudentId ||
      !snapshot.selectedModule
    ) {
      return
    }

    const draft =
      drafts[studentId] ?? {
        qualitativeFinalGrade: '',
        descriptiveAssessment: ''
      }

    if (!draft.qualitativeFinalGrade) {
      setFeedback({
        tone: 'error',
        message:
          `Selecione a menção qualitativa de ${studentName}.`
      })
      return
    }

    if (!draft.descriptiveAssessment.trim()) {
      setFeedback({
        tone: 'error',
        message:
          `Registe a apreciação descritiva de ${studentName}.`
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
        finalGrade: null,
        selfAssessmentGrade: null,
        qualitativeFinalGrade:
          draft.qualitativeFinalGrade,
        descriptiveAssessment:
          draft.descriptiveAssessment
      })

      setFeedback({
        tone: 'success',
        message:
          `A avaliação qualitativa de ${studentName} foi guardada.`
      })
    } catch (saveError) {
      setFeedback({
        tone: 'error',
        message:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível guardar a avaliação qualitativa.'
      })
    } finally {
      setSavingStudentId(null)
    }
  }

  async function clearStudent(
    studentId: EntityId,
    studentName: string
  ) {
    if (
      savingStudentId ||
      !snapshot.selectedModule ||
      !window.confirm(
        `Limpar o fecho qualitativo de ${studentName}?`
      )
    ) {
      return
    }

    setSavingStudentId(studentId)
    setFeedback(null)

    try {
      await onSaveFinalGrade({
        moduleId:
          snapshot.selectedModule.id,
        studentId,
        finalGrade: null,
        selfAssessmentGrade: null,
        qualitativeFinalGrade: null,
        descriptiveAssessment: ''
      })

      setDrafts(current => ({
        ...current,
        [studentId]: {
          qualitativeFinalGrade: '',
          descriptiveAssessment: ''
        }
      }))

      setFeedback({
        tone: 'success',
        message:
          `O fecho qualitativo de ${studentName} foi limpo.`
      })
    } catch (clearError) {
      setFeedback({
        tone: 'error',
        message:
          clearError instanceof Error
            ? clearError.message
            : 'Não foi possível limpar a avaliação qualitativa.'
      })
    } finally {
      setSavingStudentId(null)
    }
  }

  return (
    <section
      ref={rootRef}
      className="rounded-[2rem] border border-emerald-300/20 bg-slate-950/75 p-5 shadow-xl shadow-black/20 sm:p-7"
    >
      <div className="max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
          Fecho qualitativo do 1.º ciclo
        </p>
        <h2 className="mt-3 text-xl font-black text-white sm:text-2xl">
          Menção e apreciação descritiva
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-400">
          Selecione a menção e registe a apreciação descritiva de cada aluno. O MA-Professor não determina a menção a partir das médias das atividades.
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

      {hasUnsavedChanges ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4 text-sm font-bold text-amber-100">
          Existem menções ou apreciações descritivas por guardar.
        </div>
      ) : null}

      {snapshot.studentRows.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm font-bold text-slate-400">
          A turma ainda não possui alunos ativos.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {snapshot.studentRows.map(row => {
            const draft =
              drafts[row.student.id] ?? {
                qualitativeFinalGrade: '',
                descriptiveAssessment: ''
              }

            const saving =
              savingStudentId ===
              row.student.id

            const persisted =
              row.finalGradeRecord
                ?.qualitativeFinalGrade ?? null

            return (
              <article
                key={row.student.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="grid gap-4 xl:grid-cols-[14rem_13rem_1fr_auto] xl:items-end">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-slate-500">
                      N.º {row.student.number}
                    </p>
                    <p className="mt-1 truncate text-sm font-black text-white">
                      {row.student.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {persisted
                        ? `Fecho atual: ${persisted}`
                        : 'Sem fecho qualitativo confirmado.'}
                    </p>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-300">
                      Menção qualitativa
                    </span>
                    <select
                      value={
                        draft.qualitativeFinalGrade
                      }
                      onChange={event =>
                        updateDraft(
                          row.student.id,
                          {
                            qualitativeFinalGrade:
                              event.target.value as
                                FirstCycleQualitativeGrade | ''
                          }
                        )
                      }
                      disabled={saving || loading}
                      className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                    >
                      <option value="">
                        Selecionar…
                      </option>
                      {FIRST_CYCLE_QUALITATIVE_GRADES.map(
                        grade => (
                          <option
                            key={grade}
                            value={grade}
                          >
                            {grade}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-300">
                      Apreciação descritiva
                    </span>
                    <textarea
                      value={
                        draft.descriptiveAssessment
                      }
                      onChange={event =>
                        updateDraft(
                          row.student.id,
                          {
                            descriptiveAssessment:
                              event.target.value
                          }
                        )
                      }
                      disabled={saving || loading}
                      rows={3}
                      placeholder="Registe a apreciação descritiva do desempenho do aluno."
                      className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10 disabled:cursor-wait disabled:opacity-60"
                    />
                  </label>

                  <div className="flex gap-2 xl:flex-col">
                    <button
                      type="button"
                      onClick={() =>
                        void saveStudent(
                          row.student.id,
                          row.student.name
                        )
                      }
                      disabled={
                        saving ||
                        loading ||
                        !draft.qualitativeFinalGrade ||
                        !draft.descriptiveAssessment.trim()
                      }
                      className="flex-1 rounded-xl border border-emerald-200/30 bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {saving
                        ? 'A guardar...'
                        : 'Guardar'}
                    </button>

                    {persisted ? (
                      <button
                        type="button"
                        onClick={() =>
                          void clearStudent(
                            row.student.id,
                            row.student.name
                          )
                        }
                        disabled={saving || loading}
                        className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] px-4 py-2.5 text-xs font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Limpar fecho
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function FirstCycleAssessmentWorkspaceView(
  props: RegularAssessmentWorkspaceViewProps
) {
  return (
    <div className="space-y-6">
      <RegularAssessmentWorkspaceView
        {...props}
      />
      <QualitativeClosurePanel
        snapshot={props.snapshot}
        loading={props.loading}
        onSaveFinalGrade={
          props.onSaveFinalGrade
        }
      />
    </div>
  )
}
