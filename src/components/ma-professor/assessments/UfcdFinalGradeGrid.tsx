import type {
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

export interface UfcdFinalGradeDraft {
  finalGrade: string
  selfAssessmentGrade: string
  usesAcs: boolean
}

interface UfcdFinalGradeGridProps {
  snapshot: AssessmentWorkspaceSnapshot
  gradeDrafts: Record<
    EntityId,
    UfcdFinalGradeDraft
  >
  loading?: boolean
  savingStudentId: EntityId | null
  onDraftChange: (
    studentId: EntityId,
    changes: Partial<UfcdFinalGradeDraft>
  ) => void
  onSaveStudent: (
    studentId: EntityId,
    studentName: string
  ) => Promise<void> | void
}

const criterionHeaderClasses = [
  'border-sky-300/20 bg-sky-300/[0.09] text-sky-50',
  'border-rose-300/20 bg-rose-300/[0.09] text-rose-50',
  'border-amber-300/20 bg-amber-300/[0.09] text-amber-50',
  'border-cyan-300/20 bg-cyan-300/[0.09] text-cyan-50'
]

const criterionCellClasses = [
  'bg-sky-300/[0.045]',
  'bg-rose-300/[0.045]',
  'bg-amber-300/[0.045]',
  'bg-cyan-300/[0.045]'
]

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ).format(
    value
  )
}

function formatAutomaticLevel(
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
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }
  ).format(
    value
  )
}

function formatPercent(
  count: number,
  total: number
) {
  if (
    total ===
    0
  ) {
    return '0%'
  }

  return `${Math.round(
    (
      count /
      total
    ) *
      100
  )}%`
}

function formatCompletionDate(
  value: string | null
) {
  if (
    !value
  ) {
    return 'Em curso'
  }

  return new Intl.DateTimeFormat(
    'pt-PT',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }
  ).format(
    new Date(
      value
    )
  )
}

function getPersistedDraft(
  snapshot: AssessmentWorkspaceSnapshot,
  studentId: EntityId
): UfcdFinalGradeDraft {
  const row =
    snapshot.studentRows.find(
      current =>
        current.student.id ===
        studentId
    )

  if (
    !row
  ) {
    return {
      finalGrade: '',
      selfAssessmentGrade: '',
      usesAcs: false
    }
  }

  const confirmedGrade =
    row.gradeSummary
      .confirmedFinalGrade

  const suggestedGrade =
    row.gradeSummary
      .suggestedGrade

  const selfAssessmentGrade =
    row.finalGradeRecord
      ?.selfAssessmentGrade ??
    null

  return {
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

    selfAssessmentGrade:
      selfAssessmentGrade ===
      null
        ? ''
        : String(
            selfAssessmentGrade
          ),

    usesAcs:
      row.finalGradeRecord
        ?.usesAcs ??
      false
  }
}

function isDraftDirty(
  current: UfcdFinalGradeDraft,
  persisted: UfcdFinalGradeDraft
) {
  return (
    current.finalGrade !==
      persisted.finalGrade ||
    current.selfAssessmentGrade !==
      persisted.selfAssessmentGrade ||
    current.usesAcs !==
      persisted.usesAcs
  )
}

function getFinalGradeBands(
  values: number[]
) {
  const bands = [
    {
      label: '1–6',
      count:
        values.filter(
          value =>
            value <=
            6
        ).length
    },
    {
      label: '7–9',
      count:
        values.filter(
          value =>
            value >=
              7 &&
            value <=
              9
        ).length
    },
    {
      label: '10–13',
      count:
        values.filter(
          value =>
            value >=
              10 &&
            value <=
              13
        ).length
    },
    {
      label: '14–17',
      count:
        values.filter(
          value =>
            value >=
              14 &&
            value <=
              17
        ).length
    },
    {
      label: '18–20',
      count:
        values.filter(
          value =>
            value >=
              18 &&
            value <=
              20
        ).length
    }
  ]

  return bands
}

export default function UfcdFinalGradeGrid({
  snapshot,
  gradeDrafts,
  loading = false,
  savingStudentId,
  onDraftChange,
  onSaveStudent
}: UfcdFinalGradeGridProps) {
  const confirmedGrades =
    snapshot.studentRows.flatMap(
      row =>
        row.gradeSummary
          .confirmedFinalGrade ===
        null
          ? []
          : [
              row.gradeSummary
                .confirmedFinalGrade
            ]
    )

  const gradeBands =
    getFinalGradeBands(
      confirmedGrades
    )

  const negativeCount =
    confirmedGrades.filter(
      value =>
        value <
        10
    ).length

  const positiveCount =
    confirmedGrades.filter(
      value =>
        value >=
        10
    ).length

  const allConfirmed =
    snapshot.studentRows.length >
      0 &&
    confirmedGrades.length ===
      snapshot.studentRows.length

  const latestConfirmedAt =
    allConfirmed
      ? snapshot.studentRows
          .flatMap(
            row =>
              row.finalGradeRecord
                ?.confirmedAt
                ? [
                    row.finalGradeRecord
                      .confirmedAt
                  ]
                : []
          )
          .sort()
          .at(-1) ??
        null
      : null

  return (
    <section className="overflow-hidden rounded-[2rem] border border-emerald-300/15 bg-slate-950/70 shadow-xl shadow-black/20">
      <div className="border-b border-white/10 px-5 py-6 sm:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
              Fecho da UFCD
            </p>

            <h2 className="mt-3 text-xl font-black text-white">
              Grelha final da UFCD
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              As médias dos domínios vêm diretamente das avaliações já registadas. Marque ACS nos alunos com medidas; nesses casos a média global é apresentada na coluna ACS a 100%.
            </p>
          </div>

          <div className="grid shrink-0 gap-2 text-xs sm:grid-cols-2 xl:min-w-[22rem]">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              <span className="block font-bold text-slate-500">
                Curso
              </span>
              <span className="mt-1 block font-black text-slate-200">
                {snapshot.selectedGroup
                  ?.courseName ||
                  '—'}
              </span>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
              <span className="block font-bold text-slate-500">
                Turma
              </span>
              <span className="mt-1 block font-black text-slate-200">
                {snapshot.selectedGroup
                  ?.name ||
                  '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {snapshot.criteria.length ===
      0 ? (
        <div className="px-5 py-6 sm:px-7">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100">
            A grelha final fica disponível quando existirem critérios de avaliação ativos para esta UFCD.
          </div>
        </div>
      ) : snapshot.studentRows.length ===
        0 ? (
        <div className="px-5 py-6 sm:px-7">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm font-bold text-slate-400">
            A turma ainda não possui alunos ativos.
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-[1050px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-slate-900/80">
                  <th className="w-20 border-r border-white/10 px-3 py-3 text-center font-black text-slate-300">
                    N.º
                  </th>

                  <th className="min-w-[15rem] border-r border-white/10 px-4 py-3 font-black text-slate-300">
                    Aluno
                  </th>

                  {snapshot.criteria.map(
                    (
                      criterion,
                      index
                    ) => (
                      <th
                        key={
                          criterion.id
                        }
                        title={
                          criterion.name
                        }
                        className={`min-w-[7.5rem] border-r px-3 py-2.5 text-center ${
                          criterionHeaderClasses[
                            index %
                              criterionHeaderClasses.length
                          ]
                        }`}
                      >
                        <span className="block text-[0.62rem] font-black uppercase tracking-[0.1em] opacity-80">
                          {formatScore(
                            criterion.weightPercent
                          )}
                          %
                        </span>

                        <span className="mt-1 block text-sm font-black">
                          D{index + 1}
                        </span>

                        <span className="mt-1 block max-w-[8rem] truncate text-[0.58rem] font-semibold opacity-65">
                          {criterion.name}
                        </span>
                      </th>
                    )
                  )}

                  <th className="min-w-[7rem] border-r border-emerald-300/20 bg-emerald-300/[0.09] px-3 py-2.5 text-center text-emerald-50">
                    <span className="block text-[0.62rem] font-black uppercase tracking-[0.1em] opacity-80">
                      100%
                    </span>
                    <span className="mt-1 block text-sm font-black">
                      ACS
                    </span>
                  </th>

                  <th className="min-w-[8rem] border-r border-violet-300/20 bg-violet-300/[0.08] px-3 py-2.5 text-center font-black text-violet-50">
                    Nível automático
                  </th>

                  <th className="min-w-[8rem] border-r border-orange-300/20 bg-orange-300/[0.08] px-3 py-2.5 text-center font-black text-orange-50">
                    Autoavaliação
                  </th>

                  <th className="min-w-[8rem] border-r border-fuchsia-300/20 bg-fuchsia-300/[0.08] px-3 py-2.5 text-center font-black text-fuchsia-50">
                    Nível final
                  </th>

                  <th className="w-28 px-3 py-2.5 text-center font-black text-slate-300">
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {snapshot.studentRows.map(
                  row => {
                    const draft =
                      gradeDrafts[
                        row.student.id
                      ] ??
                      getPersistedDraft(
                        snapshot,
                        row.student.id
                      )

                    const persistedDraft =
                      getPersistedDraft(
                        snapshot,
                        row.student.id
                      )

                    const rowDirty =
                      isDraftDirty(
                        draft,
                        persistedDraft
                      )

                    const ready =
                      row.gradeSummary
                        .allActiveCriteriaAssessed &&
                      row.gradeSummary
                        .provisionalAverage !==
                        null &&
                      row.gradeSummary
                        .suggestedGrade !==
                        null

                    const confirmed =
                      row.gradeSummary
                        .confirmedFinalGrade !==
                      null

                    const requiresConfirmation =
                      !confirmed &&
                      Boolean(
                        draft.finalGrade.trim()
                      )

                    const saving =
                      savingStudentId ===
                      row.student.id

                    return (
                      <tr
                        key={
                          row.student.id
                        }
                        className="border-b border-white/[0.07] bg-slate-950/25 last:border-b-0"
                      >
                        <td className="border-r border-white/[0.07] px-3 py-3 text-center font-black text-slate-300">
                          {row.student.number}
                        </td>

                        <td className="border-r border-white/[0.07] px-4 py-3">
                          <p className="font-black text-white">
                            {row.student.name}
                          </p>

                          <label className="mt-2 inline-flex items-center gap-2 text-[0.65rem] font-bold text-slate-400">
                            <input
                              type="checkbox"
                              checked={
                                draft.usesAcs
                              }
                              onChange={event =>
                                onDraftChange(
                                  row.student.id,
                                  {
                                    usesAcs:
                                      event.target.checked
                                  }
                                )
                              }
                              disabled={
                                !ready ||
                                saving ||
                                loading
                              }
                              className="h-3.5 w-3.5 rounded border-white/20 bg-slate-900 text-emerald-300 focus:ring-emerald-300/30 disabled:opacity-40"
                            />
                            Aluno com medidas · ACS
                          </label>

                          {!ready ? (
                            <p className="mt-1 text-[0.62rem] font-semibold text-amber-200/80">
                              A aguardar todos os domínios.
                            </p>
                          ) : null}
                        </td>

                        {snapshot.criteria.map(
                          (
                            criterion,
                            index
                          ) => {
                            const breakdown =
                              row.gradeSummary
                                .criteria.find(
                                  current =>
                                    current.criterionId ===
                                    criterion.id
                                )

                            return (
                              <td
                                key={
                                  criterion.id
                                }
                                className={`border-r border-white/[0.07] px-3 py-3 text-center text-sm font-black text-slate-100 ${
                                  criterionCellClasses[
                                    index %
                                      criterionCellClasses.length
                                  ]
                                }`}
                              >
                                {draft.usesAcs
                                  ? '—'
                                  : formatScore(
                                      breakdown
                                        ?.average ??
                                        null
                                    )}
                              </td>
                            )
                          }
                        )}

                        <td className="border-r border-emerald-300/10 bg-emerald-300/[0.035] px-3 py-3 text-center text-sm font-black text-emerald-100">
                          {draft.usesAcs
                            ? formatScore(
                                row.gradeSummary
                                  .provisionalAverage
                              )
                            : '—'}
                        </td>

                        <td className="border-r border-violet-300/10 bg-violet-300/[0.03] px-3 py-3 text-center text-sm font-black text-violet-100">
                          {formatAutomaticLevel(
                            row.gradeSummary
                              .provisionalAverage
                          )}
                        </td>

                        <td className="border-r border-orange-300/10 bg-orange-300/[0.025] px-2 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            value={
                              draft.selfAssessmentGrade
                            }
                            onChange={event =>
                              onDraftChange(
                                row.student.id,
                                {
                                  selfAssessmentGrade:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              !ready ||
                              saving ||
                              loading
                            }
                            aria-label={`Autoavaliação de ${row.student.name}`}
                            placeholder="—"
                            className="w-full rounded-lg border border-white/10 bg-slate-950/75 px-2 py-2 text-center text-sm font-black text-white outline-none transition placeholder:text-slate-700 focus:border-orange-300/50 focus:ring-2 focus:ring-orange-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                          />
                        </td>

                        <td className="border-r border-fuchsia-300/10 bg-fuchsia-300/[0.025] px-2 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            value={
                              draft.finalGrade
                            }
                            onChange={event =>
                              onDraftChange(
                                row.student.id,
                                {
                                  finalGrade:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              !ready ||
                              saving ||
                              loading
                            }
                            aria-label={`Nível final de ${row.student.name}`}
                            placeholder="—"
                            className="w-full rounded-lg border border-white/10 bg-slate-950/75 px-2 py-2 text-center text-sm font-black text-white outline-none transition placeholder:text-slate-700 focus:border-fuchsia-300/50 focus:ring-2 focus:ring-fuchsia-300/10 disabled:cursor-not-allowed disabled:opacity-45"
                          />
                        </td>

                        <td className="px-3 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              void onSaveStudent(
                                row.student.id,
                                row.student.name
                              )
                            }
                            disabled={
                              !ready ||
                              loading ||
                              saving ||
                              (
                                !rowDirty &&
                                !requiresConfirmation
                              )
                            }
                            className="w-full rounded-lg border border-emerald-200/25 bg-emerald-300/10 px-3 py-2 text-[0.65rem] font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
                          >
                            {saving
                              ? 'A guardar...'
                              : requiresConfirmation
                                ? 'Confirmar'
                                : rowDirty
                                  ? 'Guardar'
                                  : confirmed
                                    ? 'Guardado'
                                    : '—'}
                          </button>
                        </td>
                      </tr>
                    )
                  }
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-white/10 px-5 py-6 sm:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Avaliação global
                </p>

                <div className="mt-3 overflow-x-auto">
                  <div className="grid min-w-[680px] grid-cols-7 gap-2">
                    {gradeBands.map(
                      band => (
                        <div
                          key={
                            band.label
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center"
                        >
                          <p className="text-[0.6rem] font-black text-slate-500">
                            {band.label}
                          </p>
                          <p className="mt-1 text-base font-black text-white">
                            {band.count}
                          </p>
                          <p className="text-[0.58rem] font-bold text-slate-600">
                            {formatPercent(
                              band.count,
                              confirmedGrades.length
                            )}
                          </p>
                        </div>
                      )
                    )}

                    <div className="rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-3 text-center">
                      <p className="text-[0.6rem] font-black text-rose-200/70">
                        Negativo
                      </p>
                      <p className="mt-1 text-base font-black text-rose-100">
                        {negativeCount}
                      </p>
                      <p className="text-[0.58rem] font-bold text-rose-200/50">
                        {formatPercent(
                          negativeCount,
                          confirmedGrades.length
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3 text-center">
                      <p className="text-[0.6rem] font-black text-emerald-200/70">
                        Positivo
                      </p>
                      <p className="mt-1 text-base font-black text-emerald-100">
                        {positiveCount}
                      </p>
                      <p className="text-[0.58rem] font-bold text-emerald-200/50">
                        {formatPercent(
                          positiveCount,
                          confirmedGrades.length
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid shrink-0 gap-2 sm:grid-cols-2 xl:w-[25rem]">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                    Formandos avaliados
                  </p>
                  <p className="mt-1 text-lg font-black text-white">
                    {confirmedGrades.length}/
                    {snapshot.studentRows.length}
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-slate-500">
                    Conclusão da UFCD
                  </p>
                  <p className="mt-1 text-sm font-black text-white">
                    {formatCompletionDate(
                      latestConfirmedAt
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
