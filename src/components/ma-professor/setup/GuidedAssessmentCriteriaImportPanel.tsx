import {
  type ChangeEvent,
  type DragEvent,
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

function gradeNumber(value: string) {
  return value.match(/\b(10|11|12)\b/)?.[1] ?? ''
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
  return JSON.stringify({
    assignments: snapshot.teachingAssignments
      .map(item => [item.id, item.groupId, item.subjectId, item.active, item.updatedAt])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    schemes: snapshot.assessmentSchemes
      .map(item => [item.id, item.teachingAssignmentId, item.scope, item.active, item.updatedAt])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    criteria: snapshot.assessmentCriteria
      .map(item => [item.id, item.schemeId, item.active, item.updatedAt])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
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

  const groupById = useMemo(
    () => new Map(snapshot.groups.map(group => [group.id, group])),
    [snapshot.groups]
  )
  const subjectById = useMemo(
    () => new Map(snapshot.subjects.map(subject => [subject.id, subject])),
    [snapshot.subjects]
  )
  const blockedAssignments = useMemo(
    () => new Set(
      snapshot.assessmentSchemes
        .filter(scheme => scheme.active && scheme.scope === 'subject')
        .map(scheme => scheme.teachingAssignmentId)
    ),
    [snapshot.assessmentSchemes]
  )
  const assignments = useMemo(
    () => snapshot.teachingAssignments
      .filter(assignment => assignment.active)
      .map(assignment => {
        const group = groupById.get(assignment.groupId)
        const subject = subjectById.get(assignment.subjectId)
        const subjectLabel =
          subject?.shortName.trim() ||
          subject?.name ||
          assignment.displayName

        return {
          assignment,
          group,
          subject,
          label: `${group?.name ?? 'Turma'} · ${subjectLabel}`
        }
      })
      .filter(item => !blockedAssignments.has(item.assignment.id))
      .sort((left, right) =>
        left.label.localeCompare(right.label, 'pt-PT', {
          numeric: true,
          sensitivity: 'base'
        })
      ),
    [
      blockedAssignments,
      groupById,
      snapshot.teachingAssignments,
      subjectById
    ]
  )

  const detectedSubject = parsed?.metadata.subject?.value ?? ''
  const detectedGroup = parsed?.metadata.group?.value ?? ''
  const detectedGrade = parsed?.metadata.grade?.value ?? ''

  const destinationCandidates = useMemo(() => {
    const subjectKey = normalize(detectedSubject)
    let candidates = subjectKey
      ? assignments.filter(item =>
          Boolean(item.subject) && (
            normalize(item.subject?.name ?? '') === subjectKey ||
            normalize(item.subject?.shortName ?? '') === subjectKey
          )
        )
      : assignments

    if (detectedGroup) {
      const groupKey = normalize(detectedGroup)
      const matches = candidates.filter(item =>
        normalize(item.group?.name ?? '') === groupKey
      )
      if (matches.length > 0) candidates = matches
    } else if (detectedGrade) {
      const grade = gradeNumber(detectedGrade)
      const matches = grade
        ? candidates.filter(item =>
            gradeNumber(item.group?.gradeLevel ?? '') === grade ||
            gradeNumber(item.group?.name ?? '') === grade
          )
        : []
      if (matches.length > 0) candidates = matches
    }

    return candidates
  }, [assignments, detectedGrade, detectedGroup, detectedSubject])

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
    assignmentIds.length > 0

  function clearProposal() {
    setParsed(null)
    setFileName('')
    setRows([])
    setAssignmentIds([])
    setSourceFingerprint('')
    setShowDetails(false)
    setDragActive(false)
  }

  async function analyzeFile(file: File) {
    if (
      hasProposal &&
      !window.confirm('Substituir a proposta atual e perder as correções ainda não importadas?')
    ) {
      return
    }

    setBusy(true)
    setError('')
    setFeedback('')

    try {
      const document = await readAssessmentCriteriaDocument(file)
      const result = parseAssessmentCriteriaPdfDocument(document, file.name)
      const nextRows = rowsFromParsed(result)
      const subjectKey = normalize(result.metadata.subject?.value ?? '')
      let candidates = subjectKey
        ? assignments.filter(item =>
            Boolean(item.subject) && (
              normalize(item.subject?.name ?? '') === subjectKey ||
              normalize(item.subject?.shortName ?? '') === subjectKey
            )
          )
        : assignments
      const groupKey = normalize(result.metadata.group?.value ?? '')
      const grade = gradeNumber(result.metadata.grade?.value ?? '')

      if (groupKey) {
        const matches = candidates.filter(item =>
          normalize(item.group?.name ?? '') === groupKey
        )
        if (matches.length > 0) candidates = matches
      } else if (grade) {
        const matches = candidates.filter(item =>
          gradeNumber(item.group?.gradeLevel ?? '') === grade ||
          gradeNumber(item.group?.name ?? '') === grade
        )
        if (matches.length > 0) candidates = matches
      }

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
      setAssignmentIds(
        candidates.length === 1
          ? [candidates[0].assignment.id]
          : []
      )
      setSourceFingerprint(criteriaStateFingerprint(snapshot))
      setShowDetails(!completeRows || Math.abs(total - 100) > 0.001)

      if (result.candidates.length === 0) {
        setError(
          result.warnings[0] ||
          'Não foi possível identificar critérios com segurança.'
        )
      }
    } catch (analysisError) {
      clearProposal()
      setError(errorMessage(analysisError))
    } finally {
      setBusy(false)
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
    if (busy) return
    const file = event.dataTransfer.files?.[0]
    if (file) void analyzeFile(file)
  }

  function toggleAssignment(id: EntityId) {
    setAssignmentIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
    setError('')
  }

  function updateRow(id: string, changes: Partial<ImportRow>) {
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
    if (!parsed || busy) return

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
        if (!assignment) {
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

      if (!window.confirm('Aplicar estes critérios aos destinos selecionados? Critérios existentes não serão substituídos.')) {
        return
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
      clearProposal()
      setFeedback('Critérios importados com sucesso.')
      onImported(nextSnapshot)
    } catch (commitError) {
      setError(errorMessage(commitError))
    } finally {
      setBusy(false)
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

            {destinationCandidates.length === 1 && assignmentIds.length === 1 ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4 text-sm">
                <p className="font-black text-emerald-100">✓ Destino reconhecido</p>
                <p className="mt-1 text-slate-300">{destinationCandidates[0].label}</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
                <p className="text-sm font-black text-amber-100">Confirme onde aplicar</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {destinationCandidates.map(item => (
                    <label
                      key={item.assignment.id}
                      className={`cursor-pointer rounded-xl border p-3 text-sm ${
                        assignmentIds.includes(item.assignment.id)
                          ? 'border-cyan-300/30 bg-cyan-300/[0.08]'
                          : 'border-white/10 bg-white/[0.025]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={assignmentIds.includes(item.assignment.id)}
                        onChange={() => toggleAssignment(item.assignment.id)}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
                {destinationCandidates.length === 0 ? (
                  <p className="mt-3 text-xs leading-5 text-amber-100/80">
                    Não encontramos uma disciplina ativa com correspondência segura. Pode tratar este caso na configuração avançada.
                  </p>
                ) : null}
              </div>
            )}

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
