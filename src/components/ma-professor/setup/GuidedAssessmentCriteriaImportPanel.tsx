import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'

import {
  assessmentCriteriaBatchRepository
} from '../assessmentCriteriaBatchRepository'
import {
  maProfessorRepository,
  type AssessmentCriterionDraft,
  type SetupSnapshot
} from '../repository'
import type { EntityId } from '../types'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import {
  parseAssessmentCriteriaPdfDocument,
  type AssessmentCriteriaPdfCandidate,
  type ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParser'
import {
  readAssessmentCriteriaDocument
} from './assessmentCriteriaDocumentReader'
import { resolveAssessmentCriteriaDestinations } from './assessmentCriteriaDestinations'

type Props = {
  snapshot: SetupSnapshot
  onImported: (snapshot: SetupSnapshot) => void
}

type ImportRow = {
  id: string
  included: boolean
  name: string
  description: string
  weightPercent: string
  confidence: AssessmentCriteriaPdfCandidate['confidence']
  warnings: string[]
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:opacity-50'

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function rowsFromParsed(
  parsed: ParsedAssessmentCriteriaPdfDocument
): ImportRow[] {
  return parsed.candidates.map(candidate => ({
    id: candidate.id,
    included: true,
    name: candidate.name,
    description: [
      candidate.domainLabel
        ? `Domínio/dimensão: ${candidate.domainLabel}`
        : '',
      candidate.description,
      candidate.subcriteria.length > 0
        ? `Subcritérios:\n${candidate.subcriteria.map(item => `- ${item}`).join('\n')}`
        : ''
    ].filter(Boolean).join('\n\n'),
    weightPercent:
      candidate.weightPercent === null
        ? ''
        : String(candidate.weightPercent),
    confidence: candidate.confidence,
    warnings: candidate.warnings
  }))
}

function criteriaStateFingerprint(snapshot: SetupSnapshot) {
  const ordered = <T extends { id: string }>(items: T[]) =>
    [...items].sort((left, right) => left.id.localeCompare(right.id))
  return JSON.stringify({
    academicYearId: snapshot.academicYear.id,
    groups: ordered(snapshot.groups),
    subjects: ordered(snapshot.subjects),
    assignments: ordered(snapshot.teachingAssignments),
    schemes: ordered(snapshot.assessmentSchemes),
    criteria: ordered(snapshot.assessmentCriteria)
  })
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a importação.'
}

export default function GuidedAssessmentCriteriaImportPanel({
  snapshot,
  onImported
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ParsedAssessmentCriteriaPdfDocument | null>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [assignmentIds, setAssignmentIds] = useState<EntityId[]>([])
  const [sourceFingerprint, setSourceFingerprint] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [showDestinations, setShowDestinations] = useState(false)
  const operation = useRef(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const hasProposal = Boolean(parsed || fileName || rows.length)

  useMAProfessorUnsavedWorkspaceProtection(
    hasProposal,
    rootRef,
    'Existe uma proposta de critérios por confirmar. Se continuar, essa proposta e as correções feitas serão perdidas. Pretende continuar?'
  )

  const detectedSubject = parsed?.metadata.subject?.value ?? ''
  const destinationResolution = useMemo(
    () => resolveAssessmentCriteriaDestinations(snapshot, detectedSubject),
    [snapshot, detectedSubject]
  )
  const assignments = destinationResolution.available
  const destinationCandidates = destinationResolution.candidates
  const destinationOptions =
    destinationCandidates.length > 0
      ? destinationCandidates
      : assignments
  const selectedDestinations = assignments.filter(item => assignmentIds.includes(item.assignment.id))

  const includedRows = useMemo(
    () => rows.filter(row => row.included),
    [rows]
  )
  const totalWeight = useMemo(
    () => includedRows.reduce((total, row) => {
      const value = Number(row.weightPercent.replace(',', '.'))
      return total + (Number.isFinite(value) ? value : 0)
    }, 0),
    [includedRows]
  )
  const rowsReady = useMemo(
    () => includedRows.length > 0 && includedRows.every(row => {
      const weight = Number(row.weightPercent.replace(',', '.'))
      return Boolean(clean(row.name)) && Number.isFinite(weight) && weight > 0 && weight <= 100
    }),
    [includedRows]
  )
  const proposalReady =
    rowsReady &&
    Math.abs(totalWeight - 100) <= 0.001 &&
    assignmentIds.length > 0 &&
    selectedDestinations.length === assignmentIds.length

  function clearProposal() {
    setParsed(null)
    setFileName('')
    setRows([])
    setAssignmentIds([])
    setSourceFingerprint('')
    setShowDetails(false)
    setShowDestinations(false)
    setDragActive(false)
  }

  async function analyzeFile(file: File) {
    if (operation.current) return
    if (
      hasProposal &&
      !window.confirm('Substituir a proposta atual e perder as correções ainda não importadas?')
    ) {
      return
    }

    operation.current = true
    setBusy(true)
    setError('')
    setFeedback('')

    try {
      const document = await readAssessmentCriteriaDocument(file)
      const result = parseAssessmentCriteriaPdfDocument(document, file.name)
      const nextRows = rowsFromParsed(result)
      const destinations = resolveAssessmentCriteriaDestinations(
        snapshot, result.metadata.subject?.value ?? ''
      )
      if (!mounted.current) return

      const total = nextRows.reduce((sum, row) => {
        const value = Number(row.weightPercent.replace(',', '.'))
        return sum + (Number.isFinite(value) ? value : 0)
      }, 0)
      const completeRows =
        nextRows.length > 0 &&
        nextRows.every(row => {
          const weight = Number(row.weightPercent.replace(',', '.'))
          return Boolean(clean(row.name)) && Number.isFinite(weight) && weight > 0 && weight <= 100
        })

      setParsed(result)
      setFileName(file.name)
      setRows(nextRows)
      setAssignmentIds(destinations.suggestedAssignmentIds)
      setShowDestinations(false)
      setSourceFingerprint(criteriaStateFingerprint(snapshot))
      setShowDetails(!completeRows || Math.abs(total - 100) > 0.001)

      if (result.candidates.length === 0) {
        setError(
          result.warnings[0] ||
          'Não foi possível identificar critérios com segurança.'
        )
      }
    } catch (analysisError) {
      if (!mounted.current) return
      clearProposal()
      setError(errorMessage(analysisError))
    } finally {
      operation.current = false
      if (mounted.current) setBusy(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void analyzeFile(file)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (operation.current) return
    if (event.dataTransfer.files.length !== 1) {
      setError('Adicione um documento de critérios de cada vez.')
      return
    }
    const file = event.dataTransfer.files?.[0]
    if (file) void analyzeFile(file)
  }

  function toggleAssignment(id: EntityId) {
    if (operation.current) return
    setAssignmentIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
    setError('')
  }

  function updateRow(id: string, changes: Partial<ImportRow>) {
    if (operation.current) return
    setRows(current => current.map(row =>
      row.id === id
        ? { ...row, ...changes }
        : row
    ))
    setError('')
  }

  function validatedCriteria(): AssessmentCriterionDraft[] {
    if (!rowsReady || includedRows.length === 0) {
      throw new Error('Reveja os critérios assinalados antes de importar.')
    }
    if (Math.abs(totalWeight - 100) > 0.001) {
      throw new Error(`Os critérios devem totalizar 100%. O total atual é ${totalWeight.toLocaleString('pt-PT')}%.`)
    }

    const names = new Set<string>()
    return includedRows.map((row, index) => {
      const name = clean(row.name)
      const key = normalize(name)
      if (names.has(key)) {
        throw new Error(`O critério “${name}” está repetido.`)
      }
      names.add(key)
      return {
        name,
        description: row.description,
        weightPercent: Number(row.weightPercent.replace(',', '.')),
        order: index + 1,
        active: true
      }
    })
  }

  async function commitImport() {
    if (!parsed || operation.current) return

    operation.current = true
    setBusy(true)
    setError('')
    setFeedback('')

    try {
      const criteria = validatedCriteria()
      const current = await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )

      if (criteriaStateFingerprint(current) !== sourceFingerprint) {
        throw new Error('A configuração mudou desde a análise. Analise novamente o documento antes de importar.')
      }

      if (assignmentIds.length === 0) {
        throw new Error('Confirme pelo menos um destino para estes critérios.')
      }

      for (const assignmentId of assignmentIds) {
        const assignment = current.teachingAssignments.find(item =>
          item.id === assignmentId && item.active
        )
        const group = current.groups.find(item => item.id === assignment?.groupId && item.active && item.academicYearId === current.academicYear.id)
        const subject = current.subjects.find(item => item.id === assignment?.subjectId && item.active && item.academicYearId === current.academicYear.id)
        if (!assignment || !group || !subject) {
          throw new Error('Um dos destinos selecionados deixou de estar disponível.')
        }
        if (current.assessmentSchemes.some(scheme =>
          scheme.active &&
          scheme.scope === 'subject' &&
          scheme.teachingAssignmentId === assignmentId
        )) {
          throw new Error('Um dos destinos selecionados já possui critérios gerais. Nada foi substituído.')
        }
      }

      await assessmentCriteriaBatchRepository.createSubjectSchemes({
        academicYearId: snapshot.academicYear.id,
        teachingAssignmentIds: assignmentIds,
        name: 'Critérios de avaliação',
        criteria,
        active: true
      })

      const nextSnapshot = await maProfessorRepository.getSetupSnapshot(
        snapshot.academicYear.id
      )
      if (!mounted.current) return
      clearProposal()
      setFeedback('Critérios importados com sucesso.')
      onImported(nextSnapshot)
    } catch (commitError) {
      if (mounted.current) setError(errorMessage(commitError))
    } finally {
      operation.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div ref={rootRef}>
      <section className="rounded-3xl border border-cyan-300/20 bg-slate-950/70 p-5 text-white shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black">Adicionar critérios</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Adicione um PDF ou Word. Mostramos primeiro apenas o resultado e o destino proposto.
            </p>
          </div>
        </div>

        {!parsed ? (
          <>
            <input
              ref={inputRef}
              type="file"
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
              className={`mt-5 rounded-2xl border-2 border-dashed p-6 text-center transition ${
                dragActive
                  ? 'border-cyan-300/55 bg-cyan-300/[0.08]'
                  : 'border-cyan-300/20 bg-cyan-300/[0.025]'
              }`}
            >
              <p className="font-black">Arraste os critérios ou selecione um ficheiro</p>
              <p className="mt-1 text-sm text-slate-500">PDF ou Word (.docx), um documento de cada vez</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-4 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
              >
                {busy ? 'A analisar…' : 'Selecionar ficheiro'}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <p className="break-words font-black">{fileName}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-300">
                  {detectedSubject || 'Disciplina por confirmar'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-slate-300">
                  {includedRows.length} {includedRows.length === 1 ? 'critério' : 'critérios'}
                </span>
                <span className={`rounded-full border px-3 py-1.5 ${
                  Math.abs(totalWeight - 100) <= 0.001
                    ? 'border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-100'
                    : 'border-amber-300/20 bg-amber-300/[0.07] text-amber-100'
                }`}>
                  Total {totalWeight.toLocaleString('pt-PT')}%
                </span>
              </div>
            </div>

            <div className={`rounded-2xl border p-4 text-sm ${selectedDestinations.length && destinationResolution.confidence === 'high' ? 'border-emerald-300/20 bg-emerald-300/[0.055]' : 'border-amber-300/20 bg-amber-300/[0.05]'}`}>
              <p className={`font-black ${selectedDestinations.length && destinationResolution.confidence === 'high' ? 'text-emerald-100' : 'text-amber-100'}`}>
                {selectedDestinations.length
                  ? (destinationResolution.confidence === 'high' ? '✓ Disciplina e turmas reconhecidas' : 'Associação a rever')
                  : 'Destino por associar'}
              </p>
              {selectedDestinations.length ? <>
                <p className="mt-1 font-bold text-slate-200">{[...new Set(selectedDestinations.map(item => item.subject.name))].join(' · ')}</p>
                <p className="mt-1 text-slate-300">{selectedDestinations.map(item => item.group.name).join(', ')}</p>
                <p className="mt-2 text-xs text-slate-400">Critérios comuns à disciplina, aplicáveis aos vários anos e turmas selecionados.</p>
              </> : null}
              {destinationResolution.confidence === 'medium' ? <p className="mt-2 text-xs text-amber-100">Correspondência provável pela sigla. Pode corrigir a associação ou aplicar os critérios aos destinos propostos.</p> : null}
              {destinationResolution.preservedCount > 0 ? <p className="mt-2 text-xs text-slate-400">{destinationResolution.preservedCount} {destinationResolution.preservedCount === 1 ? 'turma já tem critérios gerais; serão preservados.' : 'turmas já têm critérios gerais; serão preservados.'}</p> : null}
              {destinationResolution.preservedCount > 0 && !destinationCandidates.length ? <p className="mt-2 text-xs text-slate-400">Os destinos reconhecidos já estão configurados. Pode continuar para o passo seguinte.</p> : null}
              <button type="button" disabled={busy} onClick={() => setShowDestinations(value => !value)} className="mt-3 text-xs font-bold text-cyan-200 underline underline-offset-4">
                {showDestinations ? 'Fechar escolha de destinos' : 'Corrigir associação'}
              </button>
              {showDestinations || !assignmentIds.length ? <>
                {destinationCandidates.length === 0 && assignments.length > 0 && !destinationResolution.preservedCount ? (
                  <p className="mt-2 text-xs leading-5 text-amber-100/80">
                    Não foi possível reconhecer automaticamente o destino. Escolha abaixo a turma e a disciplina onde pretende aplicar estes critérios.
                  </p>
                ) : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {(showDestinations ? assignments : destinationOptions).map(item => (
                    <label key={item.assignment.id} className={`cursor-pointer rounded-xl border p-3 text-sm ${assignmentIds.includes(item.assignment.id) ? 'border-cyan-300/30 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}>
                      <input type="checkbox" disabled={busy} className="mr-2" checked={assignmentIds.includes(item.assignment.id)} onChange={() => toggleAssignment(item.assignment.id)} />
                      {item.label}
                    </label>
                  ))}
                </div>
                {assignments.length === 0 ? <p className="mt-3 text-xs leading-5 text-amber-100/80">Não existem destinos ativos disponíveis sem critérios gerais. Os conjuntos já guardados são preservados.</p> : null}
              </> : null}
            </div>

            {parsed.warnings.length > 0 ? (
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
                {parsed.warnings.map((warning, index) => (
                  <p key={`${warning}-${index}`}>• {warning}</p>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-black">
                  {proposalReady
                    ? '✓ Proposta pronta para aplicar'
                    : 'Revisão necessária'}
                </p>
                <button
                  type="button"
                  onClick={() => setShowDetails(value => !value)}
                  className="text-xs font-bold text-slate-400 underline decoration-slate-700 underline-offset-4"
                >
                  {showDetails ? 'Ocultar detalhes' : 'Editar critérios'}
                </button>
              </div>

              {showDetails ? (
                <div className="mt-4 space-y-3">
                  {rows.map((row, index) => (
                    <article key={row.id} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.included}
                          disabled={busy}
                          onChange={event => updateRow(row.id, { included: event.target.checked })}
                        />
                        <span className="text-xs font-black text-slate-400">Critério {index + 1}</span>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
                        <label className="text-xs font-bold text-slate-300">
                          Nome
                          <input
                            className={`${inputClassName} mt-1`}
                            value={row.name}
                            disabled={!row.included || busy}
                            onChange={event => updateRow(row.id, { name: event.target.value })}
                          />
                        </label>
                        <label className="text-xs font-bold text-slate-300">
                          Peso (%)
                          <input
                            className={`${inputClassName} mt-1`}
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={row.weightPercent}
                            disabled={!row.included || busy}
                            onChange={event => updateRow(row.id, { weightPercent: event.target.value })}
                          />
                        </label>
                      </div>
                      <label className="mt-3 block text-xs font-bold text-slate-300">
                        Descrição / estrutura preservada
                        <textarea className={`${inputClassName} mt-1 min-h-24`} value={row.description}
                          disabled={!row.included || busy}
                          onChange={event => updateRow(row.id, { description: event.target.value })} />
                      </label>
                      {row.warnings.length > 0 ? (
                        <div className="mt-2 text-xs leading-5 text-amber-100/80">
                          {row.warnings.map((warning, warningIndex) => (
                            <p key={`${warning}-${warningIndex}`}>• {warning}</p>
                          ))}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-400">
                  {includedRows.map(row => `${row.name} ${row.weightPercent || '—'}%`).join(' · ') || 'Nenhum critério válido encontrado.'}
                </p>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!hasProposal || window.confirm('Descartar esta proposta?')) {
                    clearProposal()
                    setError('')
                  }
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy || !proposalReady}
                onClick={() => void commitImport()}
                className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40"
              >
                {busy ? 'A importar…' : 'Aplicar critérios'}
              </button>
            </div>
          </div>
        )}

        {error ? (
          <div role="alert" className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm leading-6 text-rose-100">
            {error}
          </div>
        ) : null}
        {feedback ? (
          <div role="status" className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-sm leading-6 text-emerald-100">
            {feedback}
          </div>
        ) : null}
      </section>
    </div>
  )
}
