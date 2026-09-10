import {
  type ChangeEvent,
  type DragEvent,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  extractPlanificationPdf
} from '../planifications/planificationPdfExtractor'
import {
  readModuleDocument
} from './planificationModuleDocument'
import {
  classifySetupPdfDocument,
  type SetupDocumentClassification,
  type SetupImportDocumentKind
} from './setupDocumentClassifier'

type SetupDocumentIntakePanelProps = {
  onOpenDocument: (
    kind: Exclude<SetupImportDocumentKind, 'unknown'>,
    file: File
  ) => void
}

type IntakeDocument = {
  id: string
  file: File
  kind: SetupImportDocumentKind
  detectedKind: SetupImportDocumentKind
  confidence: SetupDocumentClassification['confidence']
  analysis: SetupDocumentClassification | null
  subjectLabel: string
  courseLabel: string
  warnings: string[]
}

const typeLabels: Record<SetupImportDocumentKind, string> = {
  schedule: 'Horário',
  planification: 'Planificação',
  criteria: 'Critérios de avaliação',
  unknown: 'Por identificar'
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10'

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
    .replace(/\s+/g, ' ')
    .trim()
}

function unique(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const cleaned = value.trim().replace(/\s+/g, ' ')
    const key = normalize(cleaned)

    if (!key || seen.has(key)) {
      continue
    }

    seen.add(key)
    result.push(cleaned)
  }

  return result
}

function fileId(file: File) {
  return [
    file.name,
    file.size,
    file.lastModified
  ].join('|')
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível analisar o documento.'
}

function confidenceLabel(
  value: SetupDocumentClassification['confidence']
) {
  if (value === 'high') return 'Confiança alta'
  if (value === 'medium') return 'Rever tipo'
  return 'Revisão necessária'
}

function isPdf(file: File) {
  return (
    file.type === 'application/pdf' ||
    /\.pdf$/i.test(file.name)
  )
}

function isDocx(file: File) {
  return /\.docx$/i.test(file.name)
}

async function analyzeFile(
  file: File
): Promise<IntakeDocument> {
  const id = fileId(file)

  if (isPdf(file)) {
    const extracted =
      await extractPlanificationPdf(file)
    const analysis =
      classifySetupPdfDocument(
        extracted,
        file.name
      )

    let subjectLabel =
      analysis.summary.subjectLabel
    let courseLabel =
      analysis.summary.courseLabel
    const warnings = [
      ...analysis.warnings
    ]

    if (
      analysis.kind === 'planification' ||
      analysis.scores.planification >= 8
    ) {
      try {
        const moduleDocument =
          await readModuleDocument(file)

        subjectLabel =
          moduleDocument.subjectLabel ||
          subjectLabel
        courseLabel =
          moduleDocument.courseLabel ||
          courseLabel
      } catch (failure) {
        warnings.push(
          `A classificação aponta para planificação, mas a extração detalhada precisa de revisão: ${errorMessage(failure)}`
        )
      }
    }

    return {
      id,
      file,
      kind: analysis.kind,
      detectedKind: analysis.kind,
      confidence: analysis.confidence,
      analysis,
      subjectLabel,
      courseLabel,
      warnings: unique(warnings)
    }
  }

  if (isDocx(file)) {
    const normalizedName = normalize(file.name)

    if (/\bcriterios?\b/.test(normalizedName)) {
      return {
        id,
        file,
        kind: 'criteria',
        detectedKind: 'criteria',
        confidence: 'medium',
        analysis: null,
        subjectLabel: '',
        courseLabel: '',
        warnings: [
          'O documento parece conter critérios, mas o importador detalhado de critérios ainda trabalha com PDF. O tipo pode ser corrigido antes de continuar.'
        ]
      }
    }

    try {
      const moduleDocument =
        await readModuleDocument(file)

      return {
        id,
        file,
        kind: 'planification',
        detectedKind: 'planification',
        confidence: 'high',
        analysis: null,
        subjectLabel:
          moduleDocument.subjectLabel,
        courseLabel:
          moduleDocument.courseLabel,
        warnings:
          moduleDocument.warnings
      }
    } catch (failure) {
      return {
        id,
        file,
        kind: 'unknown',
        detectedKind: 'unknown',
        confidence: 'low',
        analysis: null,
        subjectLabel: '',
        courseLabel: '',
        warnings: [errorMessage(failure)]
      }
    }
  }

  return {
    id,
    file,
    kind: 'unknown',
    detectedKind: 'unknown',
    confidence: 'low',
    analysis: null,
    subjectLabel: '',
    courseLabel: '',
    warnings: [
      'Nesta fase, a configuração inicial reconhece PDF e Word (.docx).'
    ]
  }
}

function agreementLabel(
  values: string[],
  label: string
) {
  const uniqueValues = unique(values)

  if (uniqueValues.length === 0) {
    return null
  }

  const confirmationsFor = (value: string) =>
    values.filter(
      current =>
        normalize(current) === normalize(value)
    ).length

  if (uniqueValues.length === 1) {
    const confirmations =
      confirmationsFor(uniqueValues[0])

    return confirmations >= 2
      ? `✓ ${label} confirmada por ${confirmations} documentos: ${uniqueValues[0]}`
      : `${label}: ${uniqueValues[0]}`
  }

  const describedValues = uniqueValues.map(value => {
    const confirmations = confirmationsFor(value)

    return confirmations >= 2
      ? `${value} ✓ ${confirmations} documentos`
      : value
  })

  return `${label}: vários valores encontrados — ${describedValues.join(' · ')}`
}

export default function SetupDocumentIntakePanel({
  onOpenDocument
}: SetupDocumentIntakePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(true)
  const [documents, setDocuments] =
    useState<IntakeDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')

  const counts = useMemo(
    () => documents.reduce(
      (result, document) => {
        result[document.kind] += 1
        return result
      },
      {
        schedule: 0,
        planification: 0,
        criteria: 0,
        unknown: 0
      } as Record<SetupImportDocumentKind, number>
    ),
    [documents]
  )

  const agreementMessages = useMemo(
    () => [
      agreementLabel(
        documents
          .map(document => document.subjectLabel)
          .filter(Boolean),
        'Disciplina'
      ),
      agreementLabel(
        documents
          .map(document => document.courseLabel)
          .filter(Boolean),
        'Curso'
      )
    ].filter(
      (value): value is string => Boolean(value)
    ),
    [documents]
  )

  async function addFiles(files: File[]) {
    const existingIds = new Set(
      documents.map(document => document.id)
    )
    const pending = files.filter(
      file => !existingIds.has(fileId(file))
    )

    if (pending.length === 0) {
      return
    }

    setBusy(true)
    setError('')

    try {
      const analyzed: IntakeDocument[] = []

      for (const file of pending) {
        analyzed.push(
          await analyzeFile(file)
        )
      }

      setDocuments(current => [
        ...current,
        ...analyzed
      ])
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    )
    event.target.value = ''

    if (files.length > 0) {
      void addFiles(files)
    }
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>
  ) {
    event.preventDefault()
    setDragActive(false)

    if (busy) {
      return
    }

    const files = Array.from(
      event.dataTransfer.files ?? []
    )

    if (files.length > 0) {
      void addFiles(files)
    }
  }

  function updateKind(
    id: string,
    kind: SetupImportDocumentKind
  ) {
    setDocuments(current =>
      current.map(document =>
        document.id === id
          ? {
              ...document,
              kind
            }
          : document
      )
    )
  }

  function removeDocument(id: string) {
    setDocuments(current =>
      current.filter(document =>
        document.id !== id
      )
    )
  }

  return (
    <section className="rounded-[1.75rem] border border-cyan-300/20 bg-slate-950/70 p-5 shadow-xl shadow-black/15 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            Configuração por documentos
          </p>
          <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
            Dê ao MA-Professor os documentos que já utiliza.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Pode selecionar de uma vez horário, planificações e critérios. O MA-Professor identifica o tipo de cada ficheiro, compara o contexto encontrado e encaminha-o para o importador certo. Pode corrigir a classificação e tratar qualquer pendência mais tarde.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07]"
        >
          {open ? 'Recolher' : 'Adicionar documentos'}
        </button>
      </div>

      {open ? (
        <div className="mt-5 space-y-5">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={busy}
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragEnter={event => {
              event.preventDefault()
              if (!busy) setDragActive(true)
            }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={event => {
              event.preventDefault()
              setDragActive(false)
            }}
            onDrop={handleDrop}
            className={`rounded-2xl border border-dashed p-5 text-center transition ${
              dragActive
                ? 'border-cyan-300/60 bg-cyan-300/[0.09]'
                : 'border-white/15 bg-white/[0.025]'
            }`}
          >
            <p className="font-black text-white">
              {busy
                ? 'A analisar os documentos…'
                : 'Arraste os documentos para aqui'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Horário · planificações · critérios de avaliação
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-50"
            >
              Selecionar documentos
            </button>
          </div>

          {documents.length > 0 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Horários</p>
                  <p className="mt-2 text-xl font-black text-white">{counts.schedule}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Planificações</p>
                  <p className="mt-2 text-xl font-black text-white">{counts.planification}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Critérios</p>
                  <p className="mt-2 text-xl font-black text-white">{counts.criteria}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Por rever</p>
                  <p className="mt-2 text-xl font-black text-white">{counts.unknown}</p>
                </div>
              </div>

              {agreementMessages.length > 0 ? (
                <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
                    Cruzamento entre documentos
                  </p>
                  <div className="mt-2 space-y-1 text-sm leading-6 text-slate-300">
                    {agreementMessages.map(message => (
                      <p key={message}>{message}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-3">
                {documents.map(document => {
                  const canOpen =
                    document.kind !== 'unknown'

                  return (
                    <article
                      key={document.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-black text-white">
                            {document.file.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {(document.file.size / 1024 / 1024).toLocaleString('pt-PT', {
                              maximumFractionDigits: 1
                            })} MB · {confidenceLabel(document.confidence)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDocument(document.id)}
                          className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-bold text-slate-400 transition hover:border-rose-300/25 hover:text-rose-100"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3 lg:grid-cols-[15rem_1fr_auto] lg:items-end">
                        <label className="block text-xs font-bold text-slate-300">
                          Tipo de documento
                          <select
                            value={document.kind}
                            onChange={event =>
                              updateKind(
                                document.id,
                                event.target.value as SetupImportDocumentKind
                              )
                            }
                            className={`${inputClassName} mt-2`}
                          >
                            <option value="schedule">Horário</option>
                            <option value="planification">Planificação</option>
                            <option value="criteria">Critérios de avaliação</option>
                            <option value="unknown">Por identificar</option>
                          </select>
                        </label>

                        <div className="text-xs leading-5 text-slate-400">
                          {document.analysis?.evidence.slice(0, 2).map(item => (
                            <p key={item}>• {item}</p>
                          ))}
                          {document.subjectLabel ? (
                            <p>• Disciplina: {document.subjectLabel}</p>
                          ) : null}
                          {document.courseLabel ? (
                            <p>• Curso: {document.courseLabel}</p>
                          ) : null}
                          {document.kind !== document.detectedKind ? (
                            <p className="text-cyan-100">• Tipo corrigido manualmente pelo professor.</p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          disabled={!canOpen}
                          onClick={() => {
                            if (document.kind === 'unknown') return
                            onOpenDocument(
                              document.kind,
                              document.file
                            )
                          }}
                          className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-4 py-2.5 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/[0.14] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Rever no importador
                        </button>
                      </div>

                      {document.warnings.length > 0 ? (
                        <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-3 text-xs leading-5 text-amber-100/80">
                          {document.warnings.map(warning => (
                            <p key={warning}>• {warning}</p>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.06] p-3 text-sm font-bold text-rose-100">
              {error}
            </p>
          ) : null}

          <p className="text-xs leading-5 text-slate-500">
            A análise é local. Nesta etapa os documentos são classificados e cruzados; cada importador continua a validar a estrutura específica antes de guardar dados.
          </p>
        </div>
      ) : null}
    </section>
  )
}
