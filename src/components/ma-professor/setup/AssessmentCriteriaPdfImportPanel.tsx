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
  assessmentCriteriaModuleRepository
} from '../assessmentCriteriaModuleRepository'
import {
  extractPlanificationPdf
} from '../planifications/planificationPdfExtractor'
import {
  maProfessorRepository,
  type AssessmentCriterionDraft,
  type SetupSnapshot
} from '../repository'
import type {
  AssessmentSchemeScope,
  EntityId
} from '../types'
import {
  useMAProfessorUnsavedWorkspaceProtection
} from '../navigation/useUnsavedWorkspaceProtection'
import {
  parseAssessmentCriteriaPdfDocument,
  type AssessmentCriteriaPdfCandidate,
  type ParsedAssessmentCriteriaPdfDocument
} from './assessmentCriteriaPdfParser'

type AssessmentCriteriaPdfImportPanelProps = {
  snapshot: SetupSnapshot
  onImported: (snapshot: SetupSnapshot) => void
}

type ImportRow = {
  id: string
  included: boolean
  name: string
  description: string
  weightPercent: string
  sourcePages: number[]
  confidence: AssessmentCriteriaPdfCandidate['confidence']
  warnings: string[]
}

const inputClassName =
  'w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50'

const textareaClassName =
  'min-h-20 w-full resize-y rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2.5 text-sm leading-6 text-white outline-none transition focus:border-cyan-300/50 focus:ring-4 focus:ring-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50'

function clean(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
}

function normalize(value: string) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-PT')
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: 2
  }).format(value)
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a importação.'
}

function importedDescription(
  candidate: AssessmentCriteriaPdfCandidate
) {
  const parts: string[] = []

  if (candidate.domainLabel) {
    parts.push(
      `Domínio/dimensão: ${candidate.domainLabel}`
    )
  }

  if (candidate.description) {
    parts.push(candidate.description)
  }

  if (candidate.subcriteria.length > 0) {
    parts.push(
      `Subcritérios:\n${candidate.subcriteria
        .map(item => `- ${item}`)
        .join('\n')}`
    )
  }

  return parts.join('\n\n')
}

function rowsFromParsed(
  parsed: ParsedAssessmentCriteriaPdfDocument
): ImportRow[] {
  return parsed.candidates.map(candidate => ({
    id: candidate.id,
    included: true,
    name: candidate.name,
    description: importedDescription(candidate),
    weightPercent:
      candidate.weightPercent === null
        ? ''
        : String(candidate.weightPercent),
    sourcePages: candidate.sourcePages,
    confidence: candidate.confidence,
    warnings: candidate.warnings
  }))
}

function criteriaStateFingerprint(
  snapshot: SetupSnapshot
) {
  const assignments = snapshot.teachingAssignments
    .map(item => [
      item.id,
      item.groupId,
      item.subjectId,
      item.active,
      item.updatedAt
    ])
    .sort((left, right) =>
      String(left[0]).localeCompare(String(right[0]))
    )
  const modules = snapshot.modules
    .map(item => [
      item.id,
      item.teachingAssignmentId,
      item.active,
      item.updatedAt
    ])
    .sort((left, right) =>
      String(left[0]).localeCompare(String(right[0]))
    )
  const schemes = snapshot.assessmentSchemes
    .map(item => [
      item.id,
      item.teachingAssignmentId,
      item.moduleId,
      item.scope,
      item.active,
      item.updatedAt
    ])
    .sort((left, right) =>
      String(left[0]).localeCompare(String(right[0]))
    )
  const criteria = snapshot.assessmentCriteria
    .map(item => [
      item.id,
      item.schemeId,
      item.active,
      item.updatedAt
    ])
    .sort((left, right) =>
      String(left[0]).localeCompare(String(right[0]))
    )

  return JSON.stringify({
    assignments,
    modules,
    schemes,
    criteria
  })
}

function confidenceLabel(
  value: ImportRow['confidence']
) {
  if (value === 'high') return 'Confiança alta'
  if (value === 'medium') return 'Rever'
  return 'Revisão necessária'
}

export default function AssessmentCriteriaPdfImportPanel({
  snapshot,
  onImported
}: AssessmentCriteriaPdfImportPanelProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [parsed, setParsed] =
    useState<ParsedAssessmentCriteriaPdfDocument | null>(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ImportRow[]>([])
  const [schemeName, setSchemeName] =
    useState('Critérios de avaliação')
  const [scope, setScope] =
    useState<AssessmentSchemeScope>('subject')
  const [assignmentIds, setAssignmentIds] =
    useState<EntityId[]>([])
  const [moduleAssignmentId, setModuleAssignmentId] =
    useState<EntityId>('')
  const [moduleId, setModuleId] =
    useState<EntityId>('')
  const [sourceFingerprint, setSourceFingerprint] =
    useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const busy = analyzing || importing
  const hasProposal =
    Boolean(parsed) ||
    rows.length > 0 ||
    Boolean(fileName)

  useMAProfessorUnsavedWorkspaceProtection(
    hasProposal,
    rootRef,
    'Existe uma proposta de critérios importada por confirmar. Se continuar, essa proposta e as correções feitas serão perdidas. Pretende continuar?'
  )

  const groupById = useMemo(
    () => new Map(
      snapshot.groups.map(group => [
        group.id,
        group
      ])
    ),
    [snapshot.groups]
  )

  const subjectById = useMemo(
    () => new Map(
      snapshot.subjects.map(subject => [
        subject.id,
        subject
      ])
    ),
    [snapshot.subjects]
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
          label:
            `${group?.name ?? 'Turma'} · ${subjectLabel}`
        }
      })
      .sort((left, right) =>
        left.label.localeCompare(
          right.label,
          'pt-PT',
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
      ),
    [
      groupById,
      snapshot.teachingAssignments,
      subjectById
    ]
  )

  const activeSubjectSchemeAssignments = useMemo(
    () => new Set(
      snapshot.assessmentSchemes
        .filter(scheme =>
          scheme.active &&
          scheme.scope === 'subject'
        )
        .map(scheme => scheme.teachingAssignmentId)
    ),
    [snapshot.assessmentSchemes]
  )

  const moduleOptions = useMemo(
    () => snapshot.modules
      .filter(module =>
        module.active &&
        module.teachingAssignmentId === moduleAssignmentId
      )
      .sort((left, right) => left.order - right.order),
    [moduleAssignmentId, snapshot.modules]
  )

  const activeModuleSchemeIds = useMemo(
    () => new Set(
      snapshot.assessmentSchemes
        .filter(scheme =>
          scheme.active &&
          scheme.scope === 'module' &&
          scheme.moduleId
        )
        .map(scheme => scheme.moduleId as EntityId)
    ),
    [snapshot.assessmentSchemes]
  )

  const includedRows = useMemo(
    () => rows.filter(row => row.included),
    [rows]
  )

  const totalWeight = useMemo(
    () => includedRows.reduce(
      (total, row) => {
        const value = Number(
          row.weightPercent.replace(',', '.')
        )
        return total + (
          Number.isFinite(value)
            ? value
            : 0
        )
      },
      0
    ),
    [includedRows]
  )

  const detectedSubject =
    parsed?.metadata.subject?.value ?? ''

  const suggestedAssignments = useMemo(
    () => {
      const normalizedSubject = normalize(detectedSubject)

      if (!normalizedSubject) {
        return []
      }

      return assignments.filter(item => {
        if (!item.subject) {
          return false
        }

        return (
          normalize(item.subject.name) === normalizedSubject ||
          normalize(item.subject.shortName) === normalizedSubject
        )
      })
    }, [assignments, detectedSubject])

  function clearProposal() {
    setParsed(null)
    setFileName('')
    setRows([])
    setSchemeName('Critérios de avaliação')
    setScope('subject')
    setAssignmentIds([])
    setModuleAssignmentId('')
    setModuleId('')
    setSourceFingerprint('')
    setDragActive(false)
  }

  async function analyzeFile(file: File) {
    if (
      file.type !== 'application/pdf' &&
      !file.name.toLocaleLowerCase('pt-PT')
        .endsWith('.pdf')
    ) {
      setError('Selecione um ficheiro PDF válido.')
      return
    }

    if (
      hasProposal &&
      !window.confirm(
        'Substituir a proposta atual e perder as correções ainda não importadas?'
      )
    ) {
      return
    }

    setAnalyzing(true)
    setError('')
    setFeedback('')

    try {
      const extracted =
        await extractPlanificationPdf(file)
      const result =
        parseAssessmentCriteriaPdfDocument(
          extracted,
          file.name
        )

      setParsed(result)
      setFileName(file.name)
      setRows(rowsFromParsed(result))
      setAssignmentIds([])
      setModuleAssignmentId('')
      setModuleId('')
      setSourceFingerprint(
        criteriaStateFingerprint(snapshot)
      )

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
      setAnalyzing(false)
    }
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]

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

    if (busy) {
      return
    }

    const file = event.dataTransfer.files?.[0]

    if (file) {
      void analyzeFile(file)
    }
  }

  function updateRow(
    id: string,
    changes: Partial<ImportRow>
  ) {
    setRows(current =>
      current.map(row =>
        row.id === id
          ? {
              ...row,
              ...changes
            }
          : row
      )
    )
    setError('')
    setFeedback('')
  }

  function toggleAssignment(id: EntityId) {
    if (
      activeSubjectSchemeAssignments.has(id)
    ) {
      return
    }

    setAssignmentIds(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    )
    setError('')
    setFeedback('')
  }

  function validateRows(): AssessmentCriterionDraft[] {
    if (!schemeName.trim()) {
      throw new Error(
        'Indique um nome para o conjunto de critérios.'
      )
    }

    if (includedRows.length === 0) {
      throw new Error(
        'Mantenha pelo menos um critério para importar.'
      )
    }

    const names = new Set<string>()

    const criteria = includedRows.map(
      (row, index): AssessmentCriterionDraft => {
        const name = clean(row.name)

        if (!name) {
          throw new Error(
            `Critério ${index + 1}: indique o nome.`
          )
        }

        const normalizedName = normalize(name)

        if (names.has(normalizedName)) {
          throw new Error(
            `O critério “${name}” está repetido. Reveja a proposta antes de importar.`
          )
        }

        names.add(normalizedName)

        const weightPercent = Number(
          row.weightPercent.replace(',', '.')
        )

        if (
          !Number.isFinite(weightPercent) ||
          weightPercent <= 0 ||
          weightPercent > 100
        ) {
          throw new Error(
            `A ponderação do critério “${name}” deve estar entre 0 e 100%.`
          )
        }

        return {
          name,
          description: row.description,
          weightPercent,
          order: index + 1,
          active: true
        }
      }
    )

    if (Math.abs(totalWeight - 100) > 0.001) {
      throw new Error(
        `Os critérios selecionados devem totalizar 100%. O total atual é ${formatPercentage(totalWeight)}%.`
      )
    }

    return criteria
  }

  function validateDestination(
    current: SetupSnapshot
  ) {
    if (scope === 'subject') {
      if (assignmentIds.length === 0) {
        throw new Error(
          'Selecione pelo menos uma turma e disciplina de destino.'
        )
      }

      for (const assignmentId of assignmentIds) {
        const assignment = current.teachingAssignments.find(
          item =>
            item.id === assignmentId &&
            item.active
        )

        if (!assignment) {
          throw new Error(
            'Uma turma e disciplina selecionada deixou de estar disponível.'
          )
        }

        const alreadyConfigured =
          current.assessmentSchemes.some(
            scheme =>
              scheme.active &&
              scheme.scope === 'subject' &&
              scheme.teachingAssignmentId === assignmentId
          )

        if (alreadyConfigured) {
          throw new Error(
            'Uma turma e disciplina selecionada já possui critérios gerais. A importação não substitui critérios existentes.'
          )
        }
      }

      return
    }

    if (!moduleAssignmentId || !moduleId) {
      throw new Error(
        'Selecione a turma, disciplina e UFCD de destino.'
      )
    }

    const assignment = current.teachingAssignments.find(
      item =>
        item.id === moduleAssignmentId &&
        item.active
    )
    const module = current.modules.find(
      item =>
        item.id === moduleId &&
        item.active &&
        item.teachingAssignmentId === moduleAssignmentId
    )

    if (!assignment || !module) {
      throw new Error(
        'A turma, disciplina ou UFCD selecionada deixou de estar disponível.'
      )
    }

    if (
      current.assessmentSchemes.some(
        scheme =>
          scheme.active &&
          scheme.scope === 'module' &&
          scheme.teachingAssignmentId === moduleAssignmentId &&
          scheme.moduleId === moduleId
      )
    ) {
      throw new Error(
        'Esta UFCD já possui critérios específicos. A importação não os substitui.'
      )
    }
  }

  async function commitImport() {
    if (
      busy ||
      !parsed ||
      rows.length === 0
    ) {
      return
    }

    setImporting(true)
    setError('')
    setFeedback('')

    try {
      const criteria = validateRows()
      const current =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      if (
        criteriaStateFingerprint(current) !==
        sourceFingerprint
      ) {
        throw new Error(
          'A configuração de critérios, disciplinas ou UFCD foi alterada desde a análise do PDF. Analise novamente o ficheiro antes de importar.'
        )
      }

      validateDestination(current)

      if (
        !window.confirm(
          'Confirmar a importação dos critérios revistos? Os critérios existentes nunca serão substituídos por esta operação.'
        )
      ) {
        return
      }

      if (scope === 'subject') {
        await assessmentCriteriaBatchRepository
          .createSubjectSchemes({
            academicYearId: snapshot.academicYear.id,
            teachingAssignmentIds: assignmentIds,
            name: schemeName,
            criteria,
            active: true
          })
      } else {
        await assessmentCriteriaModuleRepository
          .createModuleScheme(
            {
              academicYearId: snapshot.academicYear.id,
              teachingAssignmentId: moduleAssignmentId,
              moduleId,
              name: schemeName,
              active: true
            },
            criteria
          )
      }

      const nextSnapshot =
        await maProfessorRepository.getSetupSnapshot(
          snapshot.academicYear.id
        )

      clearProposal()
      setFeedback(
        `Importação concluída: ${criteria.length} critério${criteria.length === 1 ? '' : 's'} criado${criteria.length === 1 ? '' : 's'} sem substituir critérios existentes.`
      )
      onImported(nextSnapshot)
    } catch (commitError) {
      setError(errorMessage(commitError))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div ref={rootRef}>
      <section className="rounded-[1.75rem] border border-cyan-300/15 bg-slate-950/65 p-5 shadow-xl shadow-black/15 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
              Importação assistida
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              Importar critérios de um PDF
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              O PDF é analisado localmente. Nada é guardado sem revisão e confirmação; critérios existentes não são substituídos.
            </p>
          </div>

          {!open ? (
            <button
              type="button"
              onClick={() => {
                setOpen(true)
                setError('')
                setFeedback('')
              }}
              className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:brightness-110"
            >
              Importar PDF
            </button>
          ) : null}
        </div>

        {open ? (
          <div className="mt-5 space-y-5">
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
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
                {analyzing
                  ? 'A analisar o PDF…'
                  : 'Arraste o PDF para aqui'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                ou selecione o ficheiro no dispositivo
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="mt-4 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] disabled:opacity-50"
              >
                Selecionar PDF
              </button>
            </div>

            {parsed ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-white">
                        {fileName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {parsed.pageCount} página{parsed.pageCount === 1 ? '' : 's'} · {parsed.candidates.length} critério{parsed.candidates.length === 1 ? '' : 's'} proposto{parsed.candidates.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                      Revisão obrigatória
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Disciplina</p>
                      <p className="mt-2 text-sm text-slate-200">{parsed.metadata.subject?.value || 'Não identificada'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Curso</p>
                      <p className="mt-2 text-sm text-slate-200">{parsed.metadata.course?.value || 'Não identificado'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Ano</p>
                      <p className="mt-2 text-sm text-slate-200">{parsed.metadata.grade?.value || 'Não identificado'}</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-slate-500">Turma</p>
                      <p className="mt-2 text-sm text-slate-200">{parsed.metadata.group?.value || 'Não identificada'}</p>
                    </div>
                  </div>

                  {suggestedAssignments.length > 0 ? (
                    <p className="mt-3 text-xs leading-5 text-cyan-100/80">
                      Correspondência encontrada para a disciplina: {suggestedAssignments.map(item => item.label).join(', ')}. O destino continua a exigir seleção explícita.
                    </p>
                  ) : null}
                </div>

                {parsed.warnings.length > 0 ? (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                    <p className="text-sm font-black text-amber-100">
                      Avisos da análise
                    </p>
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
                      {parsed.warnings.map((warning, index) => (
                        <li key={`${warning}-${index}`}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {rows.length > 0 ? (
                  <div>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                          Proposta
                        </p>
                        <p className="mt-1 font-black text-white">
                          Reveja todos os critérios detetados
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                        Math.abs(totalWeight - 100) <= 0.001
                          ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
                          : 'border-amber-300/20 bg-amber-300/10 text-amber-100'
                      }`}>
                        Total: {formatPercentage(totalWeight)}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {rows.map((row, index) => (
                        <article
                          key={row.id}
                          className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-sm font-bold text-white">
                              <input
                                type="checkbox"
                                checked={row.included}
                                disabled={busy}
                                onChange={event =>
                                  updateRow(row.id, {
                                    included: event.target.checked
                                  })
                                }
                              />
                              Critério {index + 1}
                            </label>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[0.65rem] font-bold text-slate-300">
                                {confidenceLabel(row.confidence)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[0.65rem] font-bold text-slate-400">
                                pág. {row.sourcePages.join(', ')}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
                            <label className="block text-xs font-bold text-slate-300">
                              Nome
                              <input
                                value={row.name}
                                disabled={!row.included || busy}
                                onChange={event =>
                                  updateRow(row.id, {
                                    name: event.target.value
                                  })
                                }
                                className={`${inputClassName} mt-2`}
                              />
                            </label>
                            <label className="block text-xs font-bold text-slate-300">
                              Peso
                              <div className="relative mt-2">
                                <input
                                  type="number"
                                  min="0.01"
                                  max="100"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={row.weightPercent}
                                  disabled={!row.included || busy}
                                  onChange={event =>
                                    updateRow(row.id, {
                                      weightPercent: event.target.value
                                    })
                                  }
                                  className={`${inputClassName} pr-9`}
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-bold text-slate-500">%</span>
                              </div>
                            </label>
                          </div>

                          <label className="mt-3 block text-xs font-bold text-slate-300">
                            Descrição / estrutura preservada
                            <textarea
                              value={row.description}
                              disabled={!row.included || busy}
                              onChange={event =>
                                updateRow(row.id, {
                                  description: event.target.value
                                })
                              }
                              className={`${textareaClassName} mt-2`}
                            />
                          </label>

                          {row.warnings.length > 0 ? (
                            <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-xs leading-5 text-amber-100/80">
                              {row.warnings.map((warning, warningIndex) => (
                                <p key={`${warning}-${warningIndex}`}>• {warning}</p>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                {rows.length > 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <label className="block text-sm font-bold text-slate-200">
                      Nome do conjunto
                      <input
                        value={schemeName}
                        disabled={busy}
                        onChange={event => setSchemeName(event.target.value)}
                        className={`${inputClassName} mt-2`}
                      />
                    </label>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setScope('subject')
                          setModuleAssignmentId('')
                          setModuleId('')
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          scope === 'subject'
                            ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100'
                            : 'border-white/10 bg-white/[0.035] text-slate-300'
                        }`}
                      >
                        Critérios gerais da disciplina
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setScope('module')
                          setAssignmentIds([])
                        }}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          scope === 'module'
                            ? 'border-violet-300/35 bg-violet-300/10 text-violet-100'
                            : 'border-white/10 bg-white/[0.035] text-slate-300'
                        }`}
                      >
                        Critérios específicos de UFCD
                      </button>
                    </div>

                    {scope === 'subject' ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {assignments.map(item => {
                          const blocked =
                            activeSubjectSchemeAssignments.has(
                              item.assignment.id
                            )
                          const selected =
                            assignmentIds.includes(
                              item.assignment.id
                            )

                          return (
                            <label
                              key={item.assignment.id}
                              className={`rounded-xl border p-3 text-sm ${
                                blocked
                                  ? 'cursor-not-allowed border-white/10 bg-white/[0.02] opacity-55'
                                  : selected
                                    ? 'cursor-pointer border-cyan-300/30 bg-cyan-300/[0.08]'
                                    : 'cursor-pointer border-white/10 bg-slate-950/45'
                              }`}
                            >
                              <span className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  disabled={blocked || busy}
                                  onChange={() =>
                                    toggleAssignment(
                                      item.assignment.id
                                    )
                                  }
                                  className="mt-1"
                                />
                                <span>
                                  <span className="block font-bold text-white">{item.label}</span>
                                  <span className="mt-1 block text-xs text-slate-500">
                                    {item.group?.courseName
                                      ? `Curso: ${item.group.courseName}`
                                      : 'Curso não indicado'}
                                    {blocked
                                      ? ' · Já possui critérios gerais'
                                      : ''}
                                  </span>
                                </span>
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs font-bold text-slate-300">
                          Turma e disciplina
                          <select
                            value={moduleAssignmentId}
                            disabled={busy}
                            onChange={event => {
                              setModuleAssignmentId(event.target.value)
                              setModuleId('')
                            }}
                            className={`${inputClassName} mt-2`}
                          >
                            <option value="">Selecione…</option>
                            {assignments.map(item => (
                              <option
                                key={item.assignment.id}
                                value={item.assignment.id}
                              >
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block text-xs font-bold text-slate-300">
                          UFCD ou módulo
                          <select
                            value={moduleId}
                            disabled={!moduleAssignmentId || busy}
                            onChange={event => setModuleId(event.target.value)}
                            className={`${inputClassName} mt-2`}
                          >
                            <option value="">Selecione…</option>
                            {moduleOptions.map(module => (
                              <option
                                key={module.id}
                                value={module.id}
                                disabled={activeModuleSchemeIds.has(module.id)}
                              >
                                {module.code ? `${module.code} — ` : ''}{module.name}{activeModuleSchemeIds.has(module.id) ? ' — já possui critérios' : ''}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    )}

                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      A importação cria apenas novos conjuntos. Não existe substituição, fusão ou alteração silenciosa de critérios já guardados.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {rows.length > 0 ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void commitImport()}
                      className="inline-flex flex-1 items-center justify-center rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:opacity-45"
                    >
                      {importing
                        ? 'A importar…'
                        : 'Confirmar importação revista'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        !hasProposal ||
                        window.confirm(
                          'Descartar esta proposta de importação?'
                        )
                      ) {
                        clearProposal()
                        setError('')
                        setFeedback('')
                        setOpen(false)
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm leading-6 text-rose-100"
          >
            {error}
          </div>
        ) : null}

        {feedback ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-sm leading-6 text-emerald-100"
          >
            {feedback}
          </div>
        ) : null}
      </section>
    </div>
  )
}
