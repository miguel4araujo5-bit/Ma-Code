import {
  Fragment,
  useEffect,
  useMemo,
  useState
} from 'react'

import type {
  EntityId
} from '../types'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

import type {
  UfcdFinalGradeDraft
} from './UfcdFinalGradeGridBase'

import {
  resolveModuleCompletionDate
} from './ufcdCompletionDate'

import {
  buildUfcdCfpModel
} from './ufcdCfpModel'

import {
  exportUfcdCfpPdf
} from './ufcdCfpPdfExport'

import {
  exportUfcdFinalGradeExcel
} from './ufcdFinalGradeExcelExport'

interface UfcdCfpPreviewProps {
  snapshot: AssessmentWorkspaceSnapshot
  gradeDrafts: Record<
    EntityId,
    UfcdFinalGradeDraft
  >
  loading?: boolean
  savingStudentId: EntityId | null
  exportDisabled?: boolean
  onDraftChange: (
    studentId: EntityId,
    changes: Partial<UfcdFinalGradeDraft>
  ) => void
  onSaveStudent: (
    studentId: EntityId,
    studentName: string
  ) => Promise<void> | void
}

const criterionColors = [
  '#9fc5e8',
  '#d99694',
  '#b6d7a8',
  '#b4a7d6',
  '#fce5cd',
  '#f6b26b'
]

function criterionColor(
  index: number
) {
  return criterionColors[
    index % criterionColors.length
  ]
}

function formatScore(
  value: number | null,
  decimals = 2
) {
  if (value === null) {
    return ''
  }

  return new Intl.NumberFormat(
    'pt-PT',
    {
      maximumFractionDigits:
        decimals
    }
  ).format(value)
}

function buildPersistedDraft(
  row: AssessmentWorkspaceSnapshot['studentRows'][number]
): UfcdFinalGradeDraft {
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
      confirmedGrade !== null
        ? String(confirmedGrade)
        : suggestedGrade !== null
          ? String(suggestedGrade)
          : '',
    selfAssessmentGrade:
      selfAssessmentGrade === null
        ? ''
        : String(selfAssessmentGrade),
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

function parseFinalGrade(
  value: string
) {
  const normalized =
    value.trim()

  if (!normalized) {
    return null
  }

  const grade =
    Number(normalized)

  if (
    !Number.isInteger(grade) ||
    grade < 0 ||
    grade > 20
  ) {
    return null
  }

  return grade
}

function percentage(
  count: number,
  total: number
) {
  if (total === 0) {
    return 0
  }

  return Math.round(
    (count / total) * 100
  )
}

export default function UfcdCfpPreview({
  snapshot,
  gradeDrafts,
  loading = false,
  savingStudentId,
  exportDisabled = false,
  onDraftChange,
  onSaveStudent
}: UfcdCfpPreviewProps) {
  const [
    completionVersion,
    setCompletionVersion
  ] = useState(0)

  useEffect(() => {
    let active = true

    void resolveModuleCompletionDate(
      snapshot.selectedModule
    )
      .then(() => {
        if (active) {
          setCompletionVersion(
            current => current + 1
          )
        }
      })
      .catch(() => {
        // O erro volta a ser apresentado se o utilizador tentar exportar.
      })

    return () => {
      active = false
    }
  }, [
    snapshot.generatedAt,
    snapshot.selectedModule?.id
  ])

  const model =
    useMemo(
      () =>
        buildUfcdCfpModel(
          snapshot
        ),
      [
        snapshot,
        completionVersion
      ]
    )

  const [
    exporting,
    setExporting
  ] = useState<
    'pdf' | 'excel' | null
  >(null)

  const [
    savingAll,
    setSavingAll
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const pendingRows =
    snapshot.studentRows.filter(
      row => {
        const persisted =
          buildPersistedDraft(row)

        const current =
          gradeDrafts[
            row.student.id
          ] ?? persisted

        const requiresConfirmation =
          row.gradeSummary
            .confirmedFinalGrade === null &&
          Boolean(
            current.finalGrade.trim()
          )

        return (
          isDraftDirty(
            current,
            persisted
          ) ||
          requiresConfirmation
        )
      }
    )

  const hasUnsavedDraftChanges =
    snapshot.studentRows.some(
      row => {
        const persisted =
          buildPersistedDraft(row)

        const current =
          gradeDrafts[
            row.student.id
          ] ?? persisted

        return isDraftDirty(
          current,
          persisted
        )
      }
    )

  const finalGrades =
    snapshot.studentRows.flatMap(
      row => {
        const persisted =
          buildPersistedDraft(row)

        const current =
          gradeDrafts[
            row.student.id
          ] ?? persisted

        const grade =
          parseFinalGrade(
            current.finalGrade
          )

        return grade === null
          ? []
          : [grade]
      }
    )

  const gradeBandDefinitions = [
    ['1 - 6', 1, 6],
    ['7 - 9', 7, 9],
    ['10 - 13', 10, 13],
    ['14 - 17', 14, 17],
    ['18 - 20', 18, 20]
  ] as const

  const summaryItems = [
    ...gradeBandDefinitions.map(
      ([label, minimum, maximum]) => {
        const count =
          finalGrades.filter(
            grade =>
              grade >= minimum &&
              grade <= maximum
          ).length

        return {
          label,
          count,
          percent:
            percentage(
              count,
              finalGrades.length
            )
        }
      }
    ),
    {
      label: 'NEGATIVO',
      count:
        finalGrades.filter(
          grade => grade < 10
        ).length,
      percent:
        percentage(
          finalGrades.filter(
            grade => grade < 10
          ).length,
          finalGrades.length
        )
    },
    {
      label: 'POSITIVO',
      count:
        finalGrades.filter(
          grade => grade >= 10
        ).length,
      percent:
        percentage(
          finalGrades.filter(
            grade => grade >= 10
          ).length,
          finalGrades.length
        )
    }
  ]

  const editingDisabled =
    loading ||
    Boolean(savingStudentId) ||
    savingAll

  async function saveAllChanges() {
    if (
      editingDisabled ||
      pendingRows.length === 0
    ) {
      return
    }

    setSavingAll(true)
    setError('')

    try {
      for (const row of pendingRows) {
        await onSaveStudent(
          row.student.id,
          row.student.name
        )
      }
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Não foi possível guardar a avaliação final.'
      )
    } finally {
      setSavingAll(false)
    }
  }

  async function runExport(
    kind: 'pdf' | 'excel'
  ) {
    if (
      exportDisabled ||
      exporting ||
      savingAll
    ) {
      return
    }

    setExporting(kind)
    setError('')

    try {
      await resolveModuleCompletionDate(
        snapshot.selectedModule
      )
      setCompletionVersion(
        current => current + 1
      )

      if (kind === 'pdf') {
        await exportUfcdCfpPdf(
          snapshot
        )
      } else {
        await exportUfcdFinalGradeExcel(
          snapshot
        )
      }
    } catch (
      currentError
    ) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Não foi possível exportar a avaliação.'
      )
    } finally {
      setExporting(null)
    }
  }

  const previewRows =
    Array.from(
      {
        length:
          Math.max(
            25,
            model.rows.length
          )
      },
      (_, index) =>
        model.rows[index] ?? null
    )

  const blankDomainSlotCount =
    Math.max(
      0,
      5 - model.criteria.length
    )

  const blankDomainSlots =
    Array.from(
      {
        length:
          blankDomainSlotCount
      },
      (_, index) => index
    )

  const acsColor =
    criterionColor(
      model.criteria.length
    )

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-300/20 bg-slate-950/70 shadow-xl shadow-black/20">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:px-7 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Avaliação final · UFCD/UC
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Folha de avaliação final
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Edite a autoavaliação, a classificação final e a indicação ACS diretamente na folha oficial. O PDF contém apenas a CFP; o Excel contém o livro XLSM completo.
          </p>
        </div>

        <div className="grid shrink-0 gap-2 sm:grid-cols-3">
          <button
            type="button"
            disabled={
              editingDisabled ||
              pendingRows.length === 0
            }
            onClick={() =>
              void saveAllChanges()
            }
            className="rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-50 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
          >
            {savingAll
              ? 'A guardar…'
              : pendingRows.length > 0
                ? `Guardar / confirmar · ${pendingRows.length}`
                : 'Avaliação guardada'}
          </button>

          <button
            type="button"
            disabled={
              exportDisabled ||
              Boolean(exporting) ||
              savingAll
            }
            onClick={() =>
              void runExport('pdf')
            }
            className="rounded-xl border border-rose-200/25 bg-rose-300/10 px-4 py-2.5 text-sm font-black text-rose-50 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
          >
            {exporting === 'pdf'
              ? 'A exportar PDF…'
              : 'Exportar PDF · CFP'}
          </button>

          <button
            type="button"
            disabled={
              exportDisabled ||
              Boolean(exporting) ||
              savingAll
            }
            onClick={() =>
              void runExport('excel')
            }
            className="rounded-xl border border-emerald-200/25 bg-emerald-300/10 px-4 py-2.5 text-sm font-black text-emerald-50 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-slate-600"
          >
            {exporting === 'excel'
              ? 'A exportar Excel…'
              : 'Exportar Excel completo'}
          </button>
        </div>
      </div>

      {hasUnsavedDraftChanges ? (
        <div className="border-b border-amber-200/15 bg-amber-300/[0.05] px-5 py-3 text-xs font-semibold text-amber-100 sm:px-7">
          Existem alterações por guardar. O PDF e o Excel ficam bloqueados até guardar a avaliação final.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="border-b border-rose-200/15 bg-rose-300/[0.06] px-5 py-3 text-xs font-semibold text-rose-100 sm:px-7"
        >
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto bg-slate-900/65 p-4 sm:p-6">
        <div className="mx-auto min-w-[1060px] max-w-[1320px] rounded-sm bg-white p-5 text-slate-950 shadow-2xl shadow-black/40">
          <div className="grid grid-cols-3 gap-3 text-center text-[10px] font-black">
            <div className="border border-rose-700 bg-slate-200 px-3 py-2">
              CÁLCULOS DE FINAL DE MÓDULO/UFCD
            </div>
            <div className="border border-rose-700 bg-slate-200 px-3 py-2">
              CURSO: {model.course}
            </div>
            <div className="border border-rose-700 bg-slate-200 px-3 py-2">
              MÓDULO/UFCD: {model.moduleLabel}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-[2fr_0.8fr_0.7fr_1.2fr] gap-3 text-center text-[9px] font-bold">
            <div className="border border-slate-700 px-2 py-1.5">
              Disciplina: {model.subject}
            </div>
            <div className="border border-slate-700 px-2 py-1.5">
              Ano: {model.gradeLevel}
            </div>
            <div className="border border-slate-700 px-2 py-1.5">
              Turma: {model.group}
            </div>
            <div className="border border-slate-700 px-2 py-1.5">
              Ano letivo: {model.academicYear}
            </div>
          </div>

          <table className="mt-3 w-full border-collapse text-[8px]">
            <thead>
              <tr>
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                {model.criteria.map(
                  (criterion, index) => (
                    <th
                      key={criterion.id}
                      className="border border-slate-700 px-1 py-1 text-center font-black"
                      style={{
                        backgroundColor:
                          criterionColor(index)
                      }}
                    >
                      {criterion.weightPercent}%
                    </th>
                  )
                )}
                <th
                  className="border border-slate-700 px-1 py-1 text-center font-black"
                  style={{
                    backgroundColor:
                      acsColor
                  }}
                >
                  100%
                </th>
                {blankDomainSlots.map(
                  slotIndex => (
                    <th
                      key={`blank-weight-${slotIndex}`}
                      className="border border-slate-700 px-1 py-1"
                      style={{
                        backgroundColor:
                          criterionColor(
                            model.criteria.length +
                              1 +
                              slotIndex
                          )
                      }}
                    />
                  )
                )}
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
                <th className="border border-slate-700 bg-slate-300 px-1 py-1" />
              </tr>

              <tr className="font-black">
                <th className="w-16 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Nº Processo
                </th>
                <th className="w-9 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Nº
                </th>
                <th className="min-w-56 border border-slate-700 bg-slate-300 px-2 py-1.5 text-left">
                  Aluno / Domínio
                </th>
                {model.criteria.map(
                  (criterion, index) => (
                    <th
                      key={criterion.id}
                      title={criterion.name}
                      className="w-14 border border-slate-700 px-1 py-1.5"
                      style={{
                        backgroundColor:
                          criterionColor(index)
                      }}
                    >
                      {criterion.label}
                    </th>
                  )
                )}
                <th
                  className="w-16 border border-slate-700 px-1 py-1.5"
                  style={{
                    backgroundColor:
                      acsColor
                  }}
                >
                  ACS
                </th>
                {blankDomainSlots.map(
                  slotIndex => (
                    <th
                      key={`blank-header-${slotIndex}`}
                      className="w-14 border border-slate-700 px-1 py-1.5"
                      style={{
                        backgroundColor:
                          criterionColor(
                            model.criteria.length +
                              1 +
                              slotIndex
                          )
                      }}
                    />
                  )
                )}
                <th className="w-20 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Nível Automático
                </th>
                <th className="w-20 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Autoavaliação
                </th>
                <th className="w-16 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Nível Final
                </th>
                <th className="min-w-32 border border-slate-700 bg-slate-300 px-1 py-1.5">
                  Assinatura do Formando
                </th>
              </tr>
            </thead>

            <tbody>
              {previewRows.map(
                (row, rowIndex) => {
                  const sourceRow =
                    snapshot.studentRows[
                      rowIndex
                    ] ?? null

                  const persistedDraft =
                    sourceRow
                      ? buildPersistedDraft(
                          sourceRow
                        )
                      : null

                  const currentDraft =
                    sourceRow &&
                    persistedDraft
                      ? gradeDrafts[
                          sourceRow.student.id
                        ] ?? persistedDraft
                      : null

                  const ready =
                    Boolean(
                      sourceRow?.gradeSummary
                        .allActiveCriteriaAssessed &&
                      sourceRow.gradeSummary
                        .provisionalAverage !== null &&
                      sourceRow.gradeSummary
                        .suggestedGrade !== null
                    )

                  const rowDisabled =
                    editingDisabled ||
                    !ready

                  return (
                    <tr
                      key={
                        sourceRow?.student.id ||
                        row?.studentNumber ||
                        `blank-${rowIndex}`
                      }
                    >
                      <td className="border border-slate-700 px-1 py-[3px] text-center">
                        {row?.processNumber || ''}
                      </td>
                      <td className="border border-slate-700 px-1 py-[3px] text-center">
                        {row?.studentNumber || ''}
                      </td>
                      <td className="border border-slate-700 px-2 py-[3px] font-medium">
                        {row?.studentName || ''}
                      </td>

                      {model.criteria.map(
                        (criterion, index) => {
                          const criterionScore =
                            sourceRow?.gradeSummary
                              .criteria.find(
                                current =>
                                  current.criterionId ===
                                  criterion.id
                              )?.average ?? null

                          return (
                            <td
                              key={criterion.id}
                              className="border border-slate-700 px-1 py-[3px] text-center"
                              style={{
                                backgroundColor:
                                  criterionColor(index)
                              }}
                            >
                              {currentDraft?.usesAcs
                                ? ''
                                : formatScore(
                                    criterionScore
                                  )}
                            </td>
                          )
                        }
                      )}

                      <td
                        className="border border-slate-700 px-1 py-[3px] text-center"
                        style={{
                          backgroundColor:
                            acsColor
                        }}
                      >
                        {sourceRow &&
                        currentDraft ? (
                          <label className="flex items-center justify-center gap-1">
                            <input
                              type="checkbox"
                              checked={
                                currentDraft.usesAcs
                              }
                              onChange={event =>
                                onDraftChange(
                                  sourceRow.student.id,
                                  {
                                    usesAcs:
                                      event.target.checked
                                  }
                                )
                              }
                              disabled={
                                rowDisabled
                              }
                              aria-label={`ACS de ${sourceRow.student.name}`}
                              className="h-3 w-3 accent-slate-900 disabled:opacity-40"
                            />
                            <span className="font-bold">
                              {currentDraft.usesAcs
                                ? formatScore(
                                    sourceRow.gradeSummary
                                      .provisionalAverage
                                  )
                                : ''}
                            </span>
                          </label>
                        ) : ''}
                      </td>

                      {blankDomainSlots.map(
                        slotIndex => (
                          <td
                            key={`blank-cell-${rowIndex}-${slotIndex}`}
                            className="border border-slate-700 px-1 py-[3px]"
                            style={{
                              backgroundColor:
                                criterionColor(
                                  model.criteria.length +
                                    1 +
                                    slotIndex
                                )
                            }}
                          />
                        )
                      )}

                      <td className="border border-slate-700 px-1 py-[3px] text-center">
                        {sourceRow
                          ? formatScore(
                              sourceRow.gradeSummary
                                .provisionalAverage,
                              1
                            )
                          : ''}
                      </td>

                      <td className="border border-slate-700 p-0.5 text-center">
                        {sourceRow &&
                        currentDraft ? (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            value={
                              currentDraft.selfAssessmentGrade
                            }
                            onChange={event =>
                              onDraftChange(
                                sourceRow.student.id,
                                {
                                  selfAssessmentGrade:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              rowDisabled
                            }
                            aria-label={`Autoavaliação de ${sourceRow.student.name}`}
                            className="h-7 w-full min-w-[3rem] border border-slate-400 bg-white px-1 text-center text-[9px] font-bold text-slate-950 outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        ) : ''}
                      </td>

                      <td className="border border-slate-700 p-0.5 text-center font-bold">
                        {sourceRow &&
                        currentDraft ? (
                          <input
                            type="number"
                            min="0"
                            max="20"
                            step="1"
                            value={
                              currentDraft.finalGrade
                            }
                            onChange={event =>
                              onDraftChange(
                                sourceRow.student.id,
                                {
                                  finalGrade:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              rowDisabled
                            }
                            aria-label={`Nível final de ${sourceRow.student.name}`}
                            className="h-7 w-full min-w-[3rem] border border-slate-400 bg-white px-1 text-center text-[9px] font-black text-slate-950 outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        ) : ''}
                      </td>

                      <td className="border border-slate-700 px-1 py-[3px]" />
                    </tr>
                  )
                }
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-start justify-end gap-4 text-[8px]">
            <table className="border-collapse text-center">
              <thead>
                <tr>
                  <th
                    className="border border-slate-700 bg-slate-300 px-3 py-1"
                    rowSpan={3}
                  >
                    AVALIAÇÃO GLOBAL
                  </th>
                  {summaryItems.map(
                    item => (
                      <th
                        key={item.label}
                        colSpan={2}
                        className="border border-slate-700 bg-slate-300 px-2 py-1"
                      >
                        {item.label}
                      </th>
                    )
                  )}
                </tr>
                <tr>
                  {summaryItems.map(
                    item => (
                      <Fragment key={`summary-label-${item.label}`}>
                        <th className="border border-slate-700 px-1 py-0.5 font-semibold">
                          Nº
                        </th>
                        <th className="border border-slate-700 px-1 py-0.5 font-semibold">
                          %
                        </th>
                      </Fragment>
                    )
                  )}
                </tr>
                <tr>
                  {summaryItems.map(
                    item => (
                      <Fragment key={`summary-value-${item.label}`}>
                        <th className="border border-slate-700 px-1 py-1 font-medium">
                          {item.count}
                        </th>
                        <th className="border border-slate-700 px-1 py-1 font-medium">
                          {item.percent}%
                        </th>
                      </Fragment>
                    )
                  )}
                </tr>
              </thead>
            </table>

            <div className="w-32 shrink-0 text-center">
              <div className="border border-slate-700 bg-slate-300 px-2 py-1 font-bold">
                Formandos Avaliados
              </div>
              <div className="border-x border-b border-slate-700 px-2 py-1.5 font-medium">
                {finalGrades.length}
              </div>
            </div>

            <div className="grid w-48 shrink-0 gap-2 text-center">
              <div>
                <div className="border border-slate-700 bg-slate-300 px-3 py-1 font-bold">
                  Data de Conclusão do Módulo
                </div>
                <div className="border-x border-b border-slate-700 px-3 py-1.5">
                  {model.completionDate}
                </div>
              </div>
              <div>
                <div className="border border-slate-700 bg-slate-300 px-3 py-1 font-bold">
                  O/A Professor(a)
                </div>
                <div className="h-8 border-x border-b border-slate-700" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
