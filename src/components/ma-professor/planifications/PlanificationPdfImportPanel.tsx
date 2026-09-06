import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  commitPlanificationPdfImport,
  loadPlanificationPdfImportDestinations,
  type PlanificationPdfImportDestination
} from './planificationPdfImportAdapter'
import {
  extractPlanificationPdf
} from './planificationPdfExtractor'
import {
  parsePlanificationPdfDocument,
  type ParsedPlanificationPdfDocument
} from './planificationPdfParser'
import {
  buildPlanificationPdfPreview
} from './planificationPdfPreview'
import type {
  PlanificationWorkspaceSnapshot
} from './planificationWorkspaceRepository'

interface PlanificationPdfImportPanelProps {
  snapshot: PlanificationWorkspaceSnapshot
  disabled?: boolean
  onImported?: () => void
}

type ImportMode =
  | 'create'
  | 'append'
  | 'skip'

type RowState = {
  included: boolean
  destinationId: string
  mode: ImportMode | null
  expectedStateFingerprint: string
  content: string
  objectives: string
  activity: string
  resources: string
  evaluation: string
}

type RowStates =
  Record<string, RowState>

const selectClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50'

const textAreaClass =
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a importação.'
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

function rowStateFromDestination(
  previous: RowState | undefined,
  destination:
    PlanificationPdfImportDestination | null,
  section: {
    contentsText: string
    objectivesText: string
    methodologyText: string
    resourcesText: string
    evaluationText: string
  }
): RowState {
  const keepDestination =
    Boolean(
      previous?.destinationId &&
      destination?.moduleId ===
        previous.destinationId
    )

  const mode =
    destination
      ? destination.existingPlanification ===
        'yes'
        ? keepDestination &&
          (
            previous?.mode === 'append' ||
            previous?.mode === 'skip'
          )
          ? previous.mode
          : null
        : 'create'
      : null

  return {
    included:
      previous?.included ?? true,
    destinationId:
      destination?.moduleId ?? '',
    mode,
    expectedStateFingerprint:
      destination?.stateFingerprint ?? '',
    content:
      previous?.content ??
      section.contentsText,
    objectives:
      previous?.objectives ??
      section.objectivesText,
    activity:
      previous?.activity ??
      section.methodologyText,
    resources:
      previous?.resources ??
      section.resourcesText,
    evaluation:
      previous?.evaluation ??
      section.evaluationText
  }
}

export default function PlanificationPdfImportPanel({
  snapshot,
  disabled = false,
  onImported
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
    selectedFile,
    setSelectedFile
  ] = useState<File | null>(null)

  const [
    destinations,
    setDestinations
  ] = useState<
    PlanificationPdfImportDestination[]
  >([])

  const [
    rowStates,
    setRowStates
  ] = useState<RowStates>({})

  const [
    analyzing,
    setAnalyzing
  ] = useState(false)

  const [
    importing,
    setImporting
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
    feedback,
    setFeedback
  ] = useState('')

  const [
    completed,
    setCompleted
  ] = useState(false)

  const busy =
    analyzing ||
    importing

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
      setRowStates({})
      return
    }

    setRowStates(current => {
      const next: RowStates = {}

      preview.rows.forEach(row => {
        const previous =
          current[row.key]

        const previousDestination =
          previous?.destinationId
            ? destinations.find(
                destination =>
                  destination.moduleId ===
                  previous.destinationId
              ) ?? null
            : null

        const automaticDestination =
          previousDestination ??
          (
            row.candidates.length === 1
              ? destinations.find(
                  destination =>
                    destination.moduleId ===
                    row.candidates[0]
                      .moduleId
                ) ?? null
              : null
          )

        next[row.key] =
          rowStateFromDestination(
            previous,
            automaticDestination,
            row.section
          )
      })

      return next
    })
  }, [
    destinations,
    preview
  ])

  async function analyzeFile(file: File) {
    if (
      !file.name
        .toLocaleLowerCase('pt-PT')
        .endsWith('.pdf')
    ) {
      setError(
        'Selecione um ficheiro PDF válido.'
      )
      return
    }

    setAnalyzing(true)
    setError('')
    setFeedback('')
    setCompleted(false)
    setSelectedFile(file)
    setParsed(null)
    setDestinations([])
    setRowStates({})

    try {
      const [
        extracted,
        nextDestinations
      ] = await Promise.all([
        extractPlanificationPdf(file),
        loadPlanificationPdfImportDestinations(
          snapshot.academicYear.id
        )
      ])

      const result =
        parsePlanificationPdfDocument(
          extracted,
          file.name
        )

      setDestinations(
        nextDestinations
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
      setDestinations([])
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

  function updateRow(
    key: string,
    changes: Partial<RowState>
  ) {
    setRowStates(current => ({
      ...current,
      [key]: {
        ...current[key],
        ...changes
      }
    }))
    setError('')
    setFeedback('')
    setCompleted(false)
  }

  function changeDestination(
    key: string,
    destinationId: string,
    section: {
      contentsText: string
      objectivesText: string
      methodologyText: string
      resourcesText: string
      evaluationText: string
    }
  ) {
    const destination =
      destinations.find(
        item =>
          item.moduleId ===
          destinationId
      ) ?? null

    setRowStates(current => ({
      ...current,
      [key]:
        rowStateFromDestination(
          current[key],
          destination,
          section
        )
    }))
    setError('')
    setFeedback('')
    setCompleted(false)
  }

  function validateRows() {
    if (
      !preview ||
      !selectedFile
    ) {
      return 'Selecione e analise primeiro um PDF.'
    }

    const includedRows =
      preview.rows.filter(
        row =>
          rowStates[row.key]
            ?.included
      )

    if (!includedRows.length) {
      return 'Selecione pelo menos uma UFCD para importar.'
    }

    const destinationIds =
      new Set<string>()

    for (
      let index = 0;
      index < includedRows.length;
      index += 1
    ) {
      const row =
        includedRows[index]
      const state =
        rowStates[row.key]
      const label =
        row.section.code
          ? `UFCD ${row.section.code}`
          : `UFCD ${index + 1}`

      if (
        !state?.destinationId ||
        !state.expectedStateFingerprint
      ) {
        return `${label}: escolha e confirme o destino.`
      }

      const destination =
        destinations.find(
          item =>
            item.moduleId ===
            state.destinationId
        )

      if (!destination) {
        return `${label}: o destino selecionado deixou de estar disponível.`
      }

      if (
        destination.existingPlanification ===
        'yes'
      ) {
        if (
          state.mode !== 'append' &&
          state.mode !== 'skip'
        ) {
          return `${label}: já existe uma planificação. Escolha explicitamente Acrescentar ou Ignorar.`
        }
      } else if (
        state.mode !== 'create'
      ) {
        return `${label}: o modo válido é Criar.`
      }

      if (
        state.mode !== 'skip' &&
        !(
          state.content.trim() ||
          state.objectives.trim() ||
          state.activity.trim() ||
          state.resources.trim() ||
          state.evaluation.trim()
        )
      ) {
        return `${label}: não existe conteúdo estruturado para guardar.`
      }

      if (
        state.mode !== 'skip'
      ) {
        if (
          destinationIds.has(
            state.destinationId
          )
        ) {
          return 'O mesmo destino foi escolhido para mais do que uma secção do PDF. Reveja a associação antes de importar.'
        }

        destinationIds.add(
          state.destinationId
        )
      }
    }

    return ''
  }

  async function importConfirmedRows() {
    if (
      importing ||
      disabled ||
      completed ||
      !preview ||
      !selectedFile
    ) {
      return
    }

    const validationError =
      validateRows()

    if (validationError) {
      setError(validationError)
      setFeedback('')
      return
    }

    const confirmed =
      window.confirm(
        'Confirmar a importação das UFCD selecionadas? A operação é atómica: se alguma UFCD falhar, nenhuma alteração deste PDF será gravada.'
      )

    if (!confirmed) {
      return
    }

    const confirmedRows =
      preview.rows.flatMap(
        (
          row,
          index
        ) => {
          const state =
            rowStates[row.key]

          if (
            !state?.included ||
            !state.destinationId ||
            !state.mode
          ) {
            return []
          }

          const destination =
            destinations.find(
              item =>
                item.moduleId ===
                state.destinationId
            )

          if (!destination) {
            return []
          }

          return [
            {
              section:
                row.section,
              sectionOrdinal:
                index + 1,
              destination,
              mode:
                state.mode,
              content:
                state.content,
              objectives:
                state.objectives,
              activity:
                state.activity,
              resources:
                state.resources,
              evaluation:
                state.evaluation,
              expectedStateFingerprint:
                state.expectedStateFingerprint
            }
          ]
        }
      )

    setImporting(true)
    setError('')
    setFeedback('')

    try {
      const result =
        await commitPlanificationPdfImport(
          selectedFile,
          confirmedRows
        )

      const created =
        result.results.filter(
          item =>
            item.action === 'created'
        ).length
      const appended =
        result.results.filter(
          item =>
            item.action === 'appended'
        ).length
      const skipped =
        result.results.filter(
          item =>
            item.action === 'skipped'
        ).length
      const alreadyImported =
        result.results.filter(
          item =>
            item.action === 'alreadyImported'
        ).length

      setCompleted(true)
      setFeedback(
        `Importação concluída. Criadas: ${created}; acrescentadas: ${appended}; ignoradas: ${skipped}; já importadas: ${alreadyImported}.`
      )
      onImported?.()
    } catch (importError) {
      setError(
        getErrorMessage(
          importError
        )
      )
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="rounded-[2rem] border border-violet-300/20 bg-violet-300/[0.035] p-5 shadow-xl shadow-violet-950/10 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-200">
            Importar planificação PDF
          </p>
          <h2 className="mt-3 text-xl font-black text-white">
            PDF → UFCD → revisão → importação
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            O PDF é analisado localmente. Reveja cada UFCD, o destino e os conteúdos antes da confirmação final. Não são gerados sumários automaticamente.
          </p>
        </div>

        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-[0.12em] text-emerald-100">
          Importação atómica
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        disabled={
          disabled ||
          busy
        }
        className="hidden"
      />

      <div
        onDragEnter={event => {
          event.preventDefault()
          if (!disabled) {
            setDragActive(true)
          }
        }}
        onDragOver={event =>
          event.preventDefault()
        }
        onDragLeave={event => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={event => {
          if (
            disabled ||
            busy
          ) {
            event.preventDefault()
            return
          }
          handleDrop(event)
        }}
        className={`mt-6 rounded-2xl border-2 border-dashed p-6 text-center transition ${
          dragActive
            ? 'border-violet-300/60 bg-violet-300/10'
            : 'border-white/15 bg-slate-950/45'
        } ${
          disabled
            ? 'opacity-50'
            : ''
        }`}
      >
        <p className="text-sm font-black text-white">
          {analyzing
            ? 'A analisar o PDF...'
            : 'Arraste o PDF da planificação para aqui'}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Um PDF de cada vez, para manter a confirmação e o rollback de todas as UFCD desse documento na mesma transação.
        </p>
        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          disabled={
            disabled ||
            busy
          }
          className="mt-4 rounded-xl border border-violet-200/25 bg-violet-300/10 px-4 py-2.5 text-xs font-black text-violet-50 disabled:opacity-50"
        >
          Selecionar PDF
        </button>
      </div>

      {disabled ? (
        <p className="mt-3 text-xs leading-5 text-amber-200">
          Guarde ou descarte primeiro as alterações manuais pendentes na planificação antes de iniciar uma importação PDF.
        </p>
      ) : null}

      {selectedFile ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          <span className="font-black text-white">
            Ficheiro:
          </span>{' '}
          {selectedFile.name}
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

      {feedback ? (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4 text-sm leading-6 text-emerald-50"
        >
          {feedback}
        </div>
      ) : null}

      {preview &&
      preview.rows.length > 0 ? (
        <div className="mt-6 space-y-5">
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
            const state =
              rowStates[row.key]
            const destination =
              state?.destinationId
                ? destinations.find(
                    item =>
                      item.moduleId ===
                      state.destinationId
                  ) ?? null
                : null
            const warnings = [
              ...row.warnings
            ]

            if (
              destination &&
              row.section.code &&
              destination.code.trim() !==
                row.section.code
            ) {
              warnings.push(
                `O destino escolhido tem o código ${destination.code || 'sem código'}, diferente de ${row.section.code}. Confirme esta correção manual.`
              )
            }

            if (
              destination?.existingPlanification ===
              'yes'
            ) {
              warnings.push(
                'Este destino já possui uma planificação ativa. Apenas é permitido acrescentar novos itens no fim ou ignorar esta UFCD; a planificação existente não será substituída.'
              )
            }

            return (
              <article
                key={row.key}
                className={`rounded-2xl border p-5 ${
                  state?.included !== false
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
                      checked={
                        state?.included ?? true
                      }
                      disabled={
                        importing ||
                        completed
                      }
                      onChange={event =>
                        updateRow(
                          row.key,
                          {
                            included:
                              event.target.checked
                          }
                        )
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

                {state?.included !== false ? (
                  <>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
                      <label className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          Destino confirmado
                        </span>
                        <select
                          value={
                            state?.destinationId ?? ''
                          }
                          onChange={event =>
                            changeDestination(
                              row.key,
                              event.target.value,
                              row.section
                            )
                          }
                          disabled={
                            importing ||
                            completed
                          }
                          className={selectClass}
                        >
                          <option value="">
                            Escolher turma, disciplina e UFCD…
                          </option>
                          {destinations.map(
                            item => (
                              <option
                                key={item.moduleId}
                                value={item.moduleId}
                              >
                                {item.label}
                                {item.existingPlanification ===
                                'yes'
                                  ? ' — já tem planificação'
                                  : ''}
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                          Ação
                        </span>
                        {destination?.existingPlanification ===
                        'yes' ? (
                          <select
                            value={
                              state?.mode ?? ''
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  mode:
                                    (
                                      event.target.value ||
                                      null
                                    ) as ImportMode | null
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            className={selectClass}
                          >
                            <option value="">
                              Escolha explicitamente…
                            </option>
                            <option value="append">
                              Acrescentar no fim
                            </option>
                            <option value="skip">
                              Ignorar esta UFCD
                            </option>
                          </select>
                        ) : (
                          <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-2.5 text-sm font-black text-emerald-100">
                            {destination
                              ? 'Criar nova planificação'
                              : 'A aguardar destino'}
                          </div>
                        )}
                      </label>
                    </div>

                    {state?.mode !== 'skip' ? (
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <label>
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            Conteúdos
                          </span>
                          <textarea
                            value={
                              state?.content ??
                              row.section.contentsText
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  content:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={6}
                            className={textAreaClass}
                          />
                        </label>

                        <label>
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            Objetivos / competências
                          </span>
                          <textarea
                            value={
                              state?.objectives ??
                              row.section.objectivesText
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  objectives:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={6}
                            className={textAreaClass}
                          />
                        </label>

                        <label>
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            Metodologias / atividades
                          </span>
                          <textarea
                            value={
                              state?.activity ??
                              row.section.methodologyText
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  activity:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={5}
                            className={textAreaClass}
                          />
                        </label>

                        <label>
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            Recursos
                          </span>
                          <textarea
                            value={
                              state?.resources ??
                              row.section.resourcesText
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  resources:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={5}
                            className={textAreaClass}
                          />
                        </label>

                        <label className="lg:col-span-2">
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            Avaliação
                          </span>
                          <textarea
                            value={
                              state?.evaluation ??
                              row.section.evaluationText
                            }
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  evaluation:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={4}
                            className={textAreaClass}
                          />
                        </label>
                      </div>
                    ) : null}

                    {warnings.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-100">
                          Avisos / ambiguidades
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/90">
                          {Array.from(
                            new Set(warnings)
                          ).map(warning => (
                            <li key={warning}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            )
          })}

          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-white">
                  Confirmação final
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  A duração e o número de aulas do PDF são apenas informativos e não alteram automaticamente a carga horária, o horário, as aulas ou o progresso.
                </p>
              </div>

              <button
                type="button"
                onClick={
                  importConfirmedRows
                }
                disabled={
                  disabled ||
                  busy ||
                  completed
                }
                className="rounded-xl bg-violet-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing
                  ? 'A importar…'
                  : completed
                    ? 'Importação concluída'
                    : 'Importar planificações confirmadas'}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-500">
              O importador apenas grava planificações e respetivos itens. Não cria aulas, não altera sumários existentes, assiduidade, avaliações, notas, GIAE, módulos, carga horária, horários ou progresso.
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
