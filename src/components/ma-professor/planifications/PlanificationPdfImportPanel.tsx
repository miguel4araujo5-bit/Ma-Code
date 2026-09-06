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
  type ParsedPlanificationPdfDocument,
  type ParsedPlanificationPdfSection
} from './planificationPdfParser'
import {
  buildPlanificationPdfPreview
} from './planificationPdfPreview'
import type {
  PlanificationWorkspaceSnapshot
} from './planificationWorkspaceRepository'

interface PlanificationPdfImportPanelProps {
  snapshot: PlanificationWorkspaceSnapshot
  onSelectAssignment?: (
    teachingAssignmentId: string
  ) => void
  onImported?: () => void
  disabled?: boolean
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
  'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm leading-6 text-white outline-none transition focus:border-violet-300/50 focus:ring-4 focus:ring-violet-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a importação.'
}

function displayText(
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

function stateForDestination(
  previous: RowState | undefined,
  destination: PlanificationPdfImportDestination | null,
  section: ParsedPlanificationPdfSection
): RowState {
  const sameDestination =
    Boolean(
      previous?.destinationId &&
      destination?.moduleId ===
        previous.destinationId
    )

  return {
    included:
      previous?.included ?? true,
    destinationId:
      destination?.moduleId ?? '',
    mode:
      destination
        ? destination.existingPlanification ===
          'yes'
          ? sameDestination &&
            (
              previous?.mode === 'append' ||
              previous?.mode === 'skip'
            )
            ? previous.mode
            : null
          : 'create'
        : null,
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
  onSelectAssignment,
  onImported,
  disabled = false
}: PlanificationPdfImportPanelProps) {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [
    parsed,
    setParsed
  ] = useState<ParsedPlanificationPdfDocument | null>(null)
  const [
    file,
    setFile
  ] = useState<File | null>(null)
  const [
    destinations,
    setDestinations
  ] = useState<PlanificationPdfImportDestination[]>([])
  const [
    rows,
    setRows
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
      setRows({})
      return
    }

    setRows(current => {
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
        const suggestedDestination =
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
          stateForDestination(
            previous,
            suggestedDestination,
            row.section
          )
      })

      return next
    })
  }, [
    destinations,
    preview
  ])

  const busy =
    analyzing ||
    importing

  async function analyzeFile(nextFile: File) {
    if (
      !nextFile.name
        .toLocaleLowerCase('pt-PT')
        .endsWith('.pdf')
    ) {
      setError('Selecione um ficheiro PDF válido.')
      return
    }

    setAnalyzing(true)
    setError('')
    setFeedback('')
    setCompleted(false)
    setFile(nextFile)
    setParsed(null)
    setDestinations([])
    setRows({})

    try {
      const [
        extracted,
        loadedDestinations
      ] = await Promise.all([
        extractPlanificationPdf(nextFile),
        loadPlanificationPdfImportDestinations(
          snapshot.academicYear.id
        )
      ])

      const result =
        parsePlanificationPdfDocument(
          extracted,
          nextFile.name
        )

      setDestinations(loadedDestinations)
      setParsed(result)

      if (!result.sections.length) {
        setError(
          result.warnings[0] ||
          'Não foi possível identificar UFCD com segurança neste PDF.'
        )
      }
    } catch (analysisError) {
      setError(
        getErrorMessage(analysisError)
      )
      setParsed(null)
      setDestinations([])
    } finally {
      setAnalyzing(false)
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const nextFile =
      event.target.files?.[0]

    if (nextFile) {
      void analyzeFile(nextFile)
    }

    event.target.value = ''
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()
    setDragActive(false)

    if (
      disabled ||
      busy
    ) {
      return
    }

    const nextFile =
      event.dataTransfer.files?.[0]

    if (nextFile) {
      void analyzeFile(nextFile)
    }
  }

  function updateRow(
    key: string,
    changes: Partial<RowState>
  ) {
    setRows(current => {
      const existing =
        current[key]

      if (!existing) {
        return current
      }

      return {
        ...current,
        [key]: {
          ...existing,
          ...changes
        }
      }
    })
    setError('')
    setFeedback('')
    setCompleted(false)
  }

  function changeDestination(
    key: string,
    moduleId: string,
    section: ParsedPlanificationPdfSection
  ) {
    const destination =
      destinations.find(
        item =>
          item.moduleId ===
          moduleId
      ) ?? null

    setRows(current => ({
      ...current,
      [key]:
        stateForDestination(
          current[key],
          destination,
          section
        )
    }))
    setError('')
    setFeedback('')
    setCompleted(false)
  }

  function validate() {
    if (
      !preview ||
      !file
    ) {
      return 'Selecione e analise primeiro um PDF.'
    }

    const selectedRows =
      preview.rows.filter(
        row =>
          rows[row.key]?.included
      )

    if (!selectedRows.length) {
      return 'Selecione pelo menos uma UFCD para importar.'
    }

    const writeDestinations =
      new Set<string>()

    for (
      let index = 0;
      index < selectedRows.length;
      index += 1
    ) {
      const row =
        selectedRows[index]
      const state =
        rows[row.key]
      const label =
        row.section.code
          ? `UFCD ${row.section.code}`
          : `UFCD ${index + 1}`

      if (
        !state?.destinationId ||
        !state.expectedStateFingerprint
      ) {
        return `${label}: escolha o destino.`
      }

      const destination =
        destinations.find(
          item =>
            item.moduleId ===
            state.destinationId
        )

      if (!destination) {
        return `${label}: o destino deixou de estar disponível.`
      }

      if (
        destination.existingPlanification === 'yes'
      ) {
        if (
          state.mode !== 'append' &&
          state.mode !== 'skip'
        ) {
          return `${label}: escolha explicitamente Acrescentar ou Ignorar.`
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
          writeDestinations.has(
            state.destinationId
          )
        ) {
          return 'O mesmo destino foi escolhido para mais do que uma secção. Reveja a associação antes de importar.'
        }

        writeDestinations.add(
          state.destinationId
        )
      }
    }

    return ''
  }

  async function commit() {
    if (
      disabled ||
      busy ||
      completed ||
      !preview ||
      !file
    ) {
      return
    }

    const validationError =
      validate()

    if (validationError) {
      setError(validationError)
      return
    }

    if (
      !window.confirm(
        'Confirmar a importação? Todas as UFCD deste PDF são tratadas na mesma transação: se alguma falhar, nenhuma alteração será gravada.'
      )
    ) {
      return
    }

    const confirmedRows =
      preview.rows.flatMap(
        (
          row,
          index
        ) => {
          const state =
            rows[row.key]

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
              section: row.section,
              sectionOrdinal:
                index + 1,
              destination,
              mode: state.mode,
              content: state.content,
              objectives: state.objectives,
              activity: state.activity,
              resources: state.resources,
              evaluation: state.evaluation,
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
          file,
          confirmedRows
        )

      const count = (
        action:
          | 'created'
          | 'appended'
          | 'skipped'
          | 'alreadyImported'
      ) =>
        result.results.filter(
          item =>
            item.action === action
        ).length

      setCompleted(true)
      setFeedback(
        `Importação concluída. Criadas: ${count('created')}; acrescentadas: ${count('appended')}; ignoradas: ${count('skipped')}; já importadas: ${count('alreadyImported')}.`
      )

      if (onImported) {
        onImported()
      } else if (
        onSelectAssignment &&
        snapshot.selectedAssignment
      ) {
        onSelectAssignment(
          snapshot.selectedAssignment.id
        )
      }
    } catch (importError) {
      setError(
        getErrorMessage(importError)
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
            O PDF é analisado localmente. Reveja a turma, disciplina, UFCD e os conteúdos antes da confirmação final. Não são inventados sumários.
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
            : 'Arraste o PDF da planificação para aqui'}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Nesta fase, cada confirmação trata um PDF completo para manter todas as UFCD do documento no mesmo rollback.
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

      {file ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300">
          <span className="font-black text-white">
            Ficheiro:
          </span>{' '}
          {file.name}
        </p>
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

      {preview?.rows.map(row => {
        const state =
          rows[row.key]
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
            `O destino selecionado tem o código ${destination.code || 'sem código'}, diferente de ${row.section.code}. Confirme esta correção manual.`
          )
        }

        if (
          destination?.existingPlanification ===
          'yes'
        ) {
          warnings.push(
            'Já existe uma planificação ativa neste destino. Apenas é permitido acrescentar no fim ou ignorar; não existe substituição automática.'
          )
        }

        return (
          <article
            key={row.key}
            className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">
                  UFCD {row.section.code || 'sem código'}
                </span>
                <h3 className="mt-3 text-lg font-black text-white">
                  {displayText(
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
                Incluir
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
                label="Páginas"
                value={
                  row.section.sourcePages.join(', ') ||
                  'Não identificadas'
                }
              />
            </div>

            {state?.included !== false ? (
              <>
                <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <label>
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
                      {destinations.map(item => (
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
                      ))}
                    </select>
                  </label>

                  <label>
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
                    {([
                      [
                        'Conteúdos',
                        'content',
                        state?.content ??
                          row.section.contentsText,
                        6
                      ],
                      [
                        'Objetivos / competências',
                        'objectives',
                        state?.objectives ??
                          row.section.objectivesText,
                        6
                      ],
                      [
                        'Metodologias / atividades',
                        'activity',
                        state?.activity ??
                          row.section.methodologyText,
                        5
                      ],
                      [
                        'Recursos',
                        'resources',
                        state?.resources ??
                          row.section.resourcesText,
                        5
                      ],
                      [
                        'Avaliação',
                        'evaluation',
                        state?.evaluation ??
                          row.section.evaluationText,
                        4
                      ]
                    ] as const).map(
                      ([
                        label,
                        field,
                        value,
                        rowCount
                      ]) => (
                        <label
                          key={field}
                          className={
                            field === 'evaluation'
                              ? 'lg:col-span-2'
                              : ''
                          }
                        >
                          <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-400">
                            {label}
                          </span>
                          <textarea
                            value={value}
                            onChange={event =>
                              updateRow(
                                row.key,
                                {
                                  [field]:
                                    event.target.value
                                }
                              )
                            }
                            disabled={
                              importing ||
                              completed
                            }
                            rows={rowCount}
                            className={textAreaClass}
                          />
                        </label>
                      )
                    )}
                  </div>
                ) : null}

                {warnings.length ? (
                  <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                    <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-50/90">
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

      {preview?.rows.length ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-white">
                Confirmação final
              </p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                A duração e as aulas previstas são apenas informativas. A importação não altera aulas, sumários existentes, assiduidade, avaliações, GIAE, módulos, horários, carga horária ou progresso.
              </p>
            </div>

            <button
              type="button"
              onClick={commit}
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
        </div>
      ) : null}
    </section>
  )
}
