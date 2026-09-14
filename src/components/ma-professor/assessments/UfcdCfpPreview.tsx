import {
  useMemo,
  useState
} from 'react'

import type {
  AssessmentWorkspaceSnapshot
} from './assessmentWorkspaceRepository'

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
  disabled?: boolean
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

export default function UfcdCfpPreview({
  snapshot,
  disabled = false
}: UfcdCfpPreviewProps) {
  const model =
    useMemo(
      () =>
        buildUfcdCfpModel(
          snapshot
        ),
      [snapshot]
    )

  const [
    exporting,
    setExporting
  ] = useState<
    'pdf' | 'excel' | null
  >(null)

  const [
    error,
    setError
  ] = useState('')

  async function runExport(
    kind: 'pdf' | 'excel'
  ) {
    if (
      disabled ||
      exporting
    ) {
      return
    }

    setExporting(kind)
    setError('')

    try {
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
            Modelo de avaliação
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Pré-visualização da folha CFP
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            O PDF contém apenas a CFP. O Excel contém o livro completo, incluindo HOME, P1I1, P1I2… CFP e as folhas auxiliares do modelo.
          </p>
        </div>

        <div className="grid shrink-0 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={
              disabled ||
              Boolean(exporting)
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
              disabled ||
              Boolean(exporting)
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

      {disabled ? (
        <div className="border-b border-amber-200/15 bg-amber-300/[0.05] px-5 py-3 text-xs font-semibold text-amber-100 sm:px-7">
          Guarde primeiro as alterações pendentes para garantir que o PDF e o Excel usam apenas valores persistidos.
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
                  className="w-14 border border-slate-700 px-1 py-1.5"
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
                (row, rowIndex) => (
                  <tr key={row?.studentNumber || `blank-${rowIndex}`}>
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
                      (criterion, index) => (
                        <td
                          key={criterion.id}
                          className="border border-slate-700 px-1 py-[3px] text-center"
                          style={{
                            backgroundColor:
                              criterionColor(index)
                          }}
                        >
                          {row
                            ? formatScore(
                                row.criterionScores[
                                  index
                                ] ?? null
                              )
                            : ''}
                        </td>
                      )
                    )}
                    <td
                      className="border border-slate-700 px-1 py-[3px] text-center"
                      style={{
                        backgroundColor:
                          acsColor
                      }}
                    >
                      {row
                        ? formatScore(
                            row.acsScore
                          )
                        : ''}
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
                      {row
                        ? formatScore(
                            row.automaticLevel,
                            1
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-700 px-1 py-[3px] text-center">
                      {row
                        ? formatScore(
                            row.selfAssessmentGrade,
                            0
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-700 px-1 py-[3px] text-center font-bold">
                      {row
                        ? formatScore(
                            row.finalGrade,
                            0
                          )
                        : ''}
                    </td>
                    <td className="border border-slate-700 px-1 py-[3px]" />
                  </tr>
                )
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-end justify-between gap-8 text-[8px]">
            <table className="border-collapse text-center">
              <thead>
                <tr>
                  <th className="border border-slate-700 bg-slate-300 px-3 py-1" rowSpan={2}>
                    AVALIAÇÃO GLOBAL
                  </th>
                  {model.gradeBands.map(
                    band => (
                      <th key={band.label} className="border border-slate-700 bg-slate-300 px-2 py-1">
                        {band.label}
                      </th>
                    )
                  )}
                  <th className="border border-slate-700 bg-slate-300 px-2 py-1">
                    NEGATIVO
                  </th>
                  <th className="border border-slate-700 bg-slate-300 px-2 py-1">
                    POSITIVO
                  </th>
                </tr>
                <tr>
                  {model.gradeBands.map(
                    band => (
                      <th key={band.label} className="border border-slate-700 px-2 py-1 font-medium">
                        {band.count} · {band.percent}%
                      </th>
                    )
                  )}
                  <th className="border border-slate-700 px-2 py-1 font-medium">
                    {model.negativeCount} · {model.negativePercent}%
                  </th>
                  <th className="border border-slate-700 px-2 py-1 font-medium">
                    {model.positiveCount} · {model.positivePercent}%
                  </th>
                </tr>
              </thead>
            </table>

            <div className="grid min-w-72 gap-2 text-center">
              <div className="border border-slate-700 bg-slate-300 px-3 py-1 font-bold">
                Formandos Avaliados: {model.evaluatedCount}
              </div>
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
