import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  extractPlanificationPdf
} from './planificationPdfExtractor'
import {
  parsePlanificationPdfDocument,
  type ParsedPlanificationPdfDocument
} from './planificationPdfParser'
import {
  buildPlanificationPdfPreview,
  type PlanificationPdfPreviewDestination
} from './planificationPdfPreview'
import type {
  PlanificationWorkspaceSnapshot
} from './planificationWorkspaceRepository'

interface PlanificationPdfImportPanelProps {
  snapshot: PlanificationWorkspaceSnapshot
  onSelectAssignment: (
    teachingAssignmentId: string
  ) => void
}

type RowChoice = {
  included: boolean
  destinationId: string
}

type RowChoices =
  Record<string, RowChoice>

const selectClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível analisar o PDF.'
}

function optionalText(
  value: string,
  fallback = 'Não identificado com segurança.'
) {
  return value.trim() || fallback
}

function Detail({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">
        {value}
      </p>
    </div>
  )
}

export default function PlanificationPdfImportPanel({
  snapshot,
  onSelectAssignment
}: PlanificationPdfImportPanelProps) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [
    parsed,
    setParsed
  ] = useState<
    ParsedPlanificationPdfDocument | null
  >(null)

  const [
    fileName,
    setFileName
  ] = useState('')

  const [
    analyzing,
    setAnalyzing
  ] = useState(false)

  const [
    dragActive,
    setDragActive
  ] = useState(false)

  const [
    error,
    setError
  ] = useState('')

  const [
    confirmedAssignmentId,
    setConfirmedAssignmentId
  ] = useState('')

  const [
    rowChoices,
    setRowChoices
  ] = useState<RowChoices>({})

  const [
    reviewMessage,
    setReviewMessage
  ] = useState('')

  useEffect(() => {
    if (
      !parsed &&
      snapshot.assignmentOptions.length === 1
    ) {
      setConfirmedAssignmentId(
        snapshot.assignmentOptions[0]
          .assignment.id
      )
    }
  }, [
    parsed,
    snapshot.assignmentOptions
  ])

  const assignmentReady =
    Boolean(
      confirmedAssignmentId &&
      snapshot.selectedAssignment?.id ===
        confirmedAssignmentId
    )

  const destinations =
    useMemo<PlanificationPdfPreviewDestination[]>(
      () => {
        if (!assignmentReady) {
          return []
        }

        return snapshot.moduleOptions.map(
          option => {
            const isCurrentModule =
              snapshot.selectedModule?.id ===
              option.module.id

            const existingPlanification =
              isCurrentModule
                ? snapshot.planification?.active
                  ? 'yes' as const
                  : 'no' as const
                : 'unknown' as const

            return {
              moduleId:
                option.module.id,
              teachingAssignmentId:
                confirmedAssignmentId,
              code:
                option.module.code,
              name:
                option.module.name,
              label:
                option.label,
              existingPlanification
            }
          }
        )
      },
      [
        assignmentReady,
        confirmedAssignmentId,
        snapshot.moduleOptions,
        snapshot.planification,
        snapshot.selectedModule
      ]
    )

  const preview =
    useMemo(
      () =>
        parsed
          ? buildPlanificationPdfPreview(
              parsed,
              destinations
            )
          : null,
      [
        parsed,
        destinations
      ]
    )

  useEffect(() => {
    if (!preview) {
      return
    }

    setRowChoices(current => {
      const next: RowChoices = {}

      for (const row of preview.rows) {
        const previous = current[row.key]
        const previousStillValid =
          previous?.destinationId &&
          destinations.some(
            destination =>
              destination.moduleId ===
              previous.destinationId
          )

        next[row.key] = {
          included:
            previous?.included ?? true,
          destinationId:
            previousStillValid
              ? previous.destinationId
              : row.suggestedDestinationId ?? ''
        }
      }

      return next
    })
  }, [
    destinations,
    preview
  ])

  async function analyzeFile(file: File) {
    setAnalyzing(true)
    setError('')
    setReviewMessage('')
    setFileName(file.name)
    setRowChoices({})

    if (
      snapshot.assignmentOptions.length > 1
    ) {
      setConfirmedAssignmentId('')
    } else if (
      snapshot.assignmentOptions.length === 1
    ) {
      const onlyAssignment =
        snapshot.assignmentOptions[0]
          .assignment.id

      setConfirmedAssignmentId(
        onlyAssignment
      )

      if (
        snapshot.selectedAssignment?.id !==
        onlyAssignment
      ) {
        onSelectAssignment(
          onlyAssignment
        )
      }
    }

    try {
      const extracted =
        await extractPlanificationPdf(file)
      const result =
        parsePlanificationPdfDocument(
          extracted,
          file.name
        )

      setParsed(result)

      if (result.sections.length === 0) {
        setError(
          result.warnings[0] ||
          'Não foi possível identificar UFCD com segurança neste PDF.'
        )
      }
    } catch (analysisError) {
      setParsed(null)
      setError(
        getErrorMessage(
          analysisError
        )
      )
    } finally {
      setAnalyzing(false)
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0]

    if (file) {
      void analyzeFile(file)
    }

    event.target.value = ''
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()
    setDragActive(false)

    const file =
      event.dataTransfer.files?.[0]

    if (file) {
      void analyzeFile(file)
    }
  }

  function chooseAssignment(
    event: ChangeEvent<HTMLSelectElement>
  ) {
    const assignmentId =
      event.target.value

    setConfirmedAssignmentId(
      assignmentId
    )
    setReviewMessage('')

    if (assignmentId) {
      onSelectAssignment(
        assignmentId
      )
    }
  }

  function validateReview() {
    if (!preview) {
      return
    }

    if (!confirmedAssignmentId) {
      setReviewMessage(
        'Confirme primeiro a turma e a disciplina. Nenhum destino foi escolhido automaticamente.'
      )
      return
    }

    if (!assignmentReady) {
      setReviewMessage(
        'A carregar as UFCD da turma e disciplina escolhidas. Confirme os destinos quando ficarem disponíveis.'
      )
      return
    }

    const includedRows =
      preview.rows.filter(
        row =>
          rowChoices[row.key]
            ?.included
      )

    if (includedRows.length === 0) {
      setReviewMessage(
        'Selecione pelo menos uma UFCD para a importação.'
      )
      return
    }

    const missingDestination =
      includedRows.some(
        row =>
          !rowChoices[row.key]
            ?.destinationId
      )

    if (missingDestination) {
      setReviewMessage(
        'Existem UFCD incluídas sem destino confirmado. Corrija-as antes de continuar.'
      )
      return
    }

    setReviewMessage(
      'Revisão coerente. A gravação continua bloqueada até o AGENTE 1 fornecer o contrato oficial de persistência.'
    )
  }

  return (
    <section className="rounded-[2rem] border border-violet-300/20 bg-violet-300/[0.035] p-5 shadow-xl shadow-violet-950/10 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
            Importar planificação PDF
          </p>
          <h2 className="mt-3 text-xl font-black text-white">
            Analisar primeiro. Gravar só depois de confirmar.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            O PDF é analisado localmente. Nenhuma planificação é criada ou substituída durante esta fase de preview.
          </p>
        </div>

        <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-amber-100">
          Persistência desligada
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <div
        onDragEnter={event => {
          event.preventDefault()
          setDragActive(true)
        }}
        onDragOver={event =>
          event.preventDefault()
        }
        onDragLeave={event => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={handleDrop}
        className={`mt-6 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-violet-300/60 bg-violet-300/10'
            : 'border-white/15 bg-slate-950/45'
        }`}
      >
        <p className="text-sm font-black text-white">
          {analyzing
            ? 'A analisar o PDF...'
            : 'Arraste o PDF para aqui'}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          ou selecione manualmente o ficheiro no dispositivo
        </p>
        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={analyzing}
          className="mt-4 rounded-xl border border-violet-200/25 bg-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-50 disabled:opacity-50"
        >
          Selecionar PDF
        </button>
      </div>

      {fileName ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          <span className="font-black text-white">
            Ficheiro:
          </span>{' '}
          {fileName}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm leading-6 text-rose-100"
        >
          {error}
        </div>
      ) : null}

      {preview &&
      preview.rows.length > 0 ? (
        <div className="mt-6 space-y-5">
          <label className="block rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-4">
            <span className="mb-2 block text-sm font-black text-cyan-50">
              Confirmar turma e disciplina
            </span>
            <select
              value={confirmedAssignmentId}
              onChange={chooseAssignment}
              className={selectClass}
            >
              {snapshot.assignmentOptions.length > 1 ? (
                <option value="">
                  Escolher explicitamente…
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
            {confirmedAssignmentId &&
            !assignmentReady ? (
              <p className="mt-2 text-xs text-amber-200">
                A atualizar as UFCD disponíveis para esta turma e disciplina.
              </p>
            ) : null}
          </label>

          {preview.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-100">
                Avisos do documento
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/90">
                {preview.warnings.map(
                  warning => (
                    <li key={warning}>
                      {warning}
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}

          {preview.rows.map(row => {
            const choice =
              rowChoices[row.key] ?? {
                included: true,
                destinationId: ''
              }
            const selectedDestination =
              destinations.find(
                destination =>
                  destination.moduleId ===
                  choice.destinationId
              ) ?? null
            const dynamicWarnings = [
              ...row.warnings
            ]

            if (
              selectedDestination &&
              row.section.code &&
              selectedDestination.code.trim() !==
                row.section.code
            ) {
              dynamicWarnings.push(
                `O destino escolhido tem o código ${selectedDestination.code || 'sem código'}, diferente de ${row.section.code}. Confirme esta correção manual.`
              )
            }

            if (
              selectedDestination
                ?.existingPlanification ===
              'yes'
            ) {
              dynamicWarnings.push(
                'Este destino já possui uma planificação ativa. A substituição exigirá confirmação explícita quando a persistência for ligada.'
              )
            }

            if (
              selectedDestination
                ?.existingPlanification ===
              'unknown'
            ) {
              dynamicWarnings.push(
                'Ainda não foi possível provar se este destino tem uma planificação ativa. A gravação permanece bloqueada.'
              )
            }

            const suggested =
              row.candidates.length === 1
                ? row.candidates[0]
                : null

            return (
              <article
                key={row.key}
                className={`rounded-2xl border p-5 ${
                  choice.included
                    ? 'border-white/10 bg-slate-950/60'
                    : 'border-slate-500/10 bg-slate-950/30 opacity-65'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">
                        UFCD {row.section.code || 'sem código'}
                      </span>
                      <span className="text-xs text-slate-500">
                        páginas {row.section.sourcePages.join(', ')}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">
                      {optionalText(
                        row.section.name,
                        'Designação não identificada'
                      )}
                    </h3>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={choice.included}
                      onChange={event =>
                        setRowChoices(current => ({
                          ...current,
                          [row.key]: {
                            ...choice,
                            included:
                              event.target.checked
                          }
                        }))
                      }
                    />
                    Incluir na importação
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Detail
                    label="Código exato"
                    value={
                      row.section.code ||
                      'Não identificado'
                    }
                  />
                  <Detail
                    label="Duração"
                    value={
                      row.section.durationHours === null
                        ? 'Não identificada'
                        : `${row.section.durationHours} h`
                    }
                  />
                  <Detail
                    label="Aulas previstas"
                    value={
                      row.section.plannedLessons === null
                        ? 'Não identificadas'
                        : String(
                            row.section.plannedLessons
                          )
                    }
                  />
                  <Detail
                    label="Páginas de origem"
                    value={
                      row.section.sourcePages.join(', ') ||
                      'Não identificadas'
                    }
                  />
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <Detail
                    label="Conteúdos"
                    value={optionalText(
                      row.section.contentsText
                    )}
                  />
                  <Detail
                    label="Objetivos / competências"
                    value={optionalText(
                      row.section.objectivesText
                    )}
                  />
                  <Detail
                    label="Metodologias"
                    value={optionalText(
                      row.section.methodologyText
                    )}
                  />
                  <Detail
                    label="Recursos"
                    value={optionalText(
                      row.section.resourcesText
                    )}
                  />
                  <Detail
                    label="Avaliação"
                    value={optionalText(
                      row.section.evaluationText
                    )}
                  />
                  <Detail
                    label="Período"
                    value={optionalText(
                      row.section.periodLabel
                    )}
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      Destino sugerido
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white">
                      {!confirmedAssignmentId
                        ? 'Confirme primeiro a turma e disciplina.'
                        : !assignmentReady
                          ? 'A carregar os destinos da turma escolhida.'
                          : suggested
                            ? suggested.label
                            : row.candidates.length > 1
                              ? 'Há vários destinos possíveis; escolha manualmente.'
                              : 'Não existe correspondência exata nesta turma/disciplina.'}
                    </p>
                  </div>

                  <label className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                    <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                      Destino confirmado
                    </span>
                    <select
                      value={choice.destinationId}
                      onChange={event =>
                        setRowChoices(current => ({
                          ...current,
                          [row.key]: {
                            ...choice,
                            destinationId:
                              event.target.value
                          }
                        }))
                      }
                      disabled={
                        !choice.included ||
                        !assignmentReady
                      }
                      className={selectClass}
                    >
                      <option value="">
                        Escolher UFCD manualmente…
                      </option>
                      {destinations.map(
                        destination => (
                          <option
                            key={destination.moduleId}
                            value={destination.moduleId}
                          >
                            {destination.label}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>

                {dynamicWarnings.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-100">
                      Avisos / ambiguidades
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/90">
                      {Array.from(
                        new Set(dynamicWarnings)
                      ).map(warning => (
                        <li key={warning}>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            )
          })}

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={validateReview}
                className="rounded-xl border border-cyan-200/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-black text-cyan-50"
              >
                Confirmar revisão
              </button>

              <button
                type="button"
                disabled
                title="Aguarda o contrato oficial de persistência do AGENTE 1."
                className="rounded-xl border border-slate-400/10 bg-slate-400/[0.05] px-4 py-2.5 text-sm font-black text-slate-500"
              >
                Importação final indisponível
              </button>
            </div>

            {reviewMessage ? (
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {reviewMessage}
              </p>
            ) : null}

            <p className="mt-3 text-xs leading-5 text-slate-500">
              Nenhum dado é persistido por este painel. A ligação à criação/substituição de planificações só deve ser implementada depois de o AGENTE 1 fornecer o contrato oficial e o critério de confirmação de substituição.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
